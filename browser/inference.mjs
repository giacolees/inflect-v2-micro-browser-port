import { createInflectFrontend } from "/browser/frontend.mjs";
import { seededNormalNoise } from "/browser/runtime.mjs";

export const SAMPLE_RATE = 24000;
export const MODEL_BASE_URL =
	"https://huggingface.co/giacolees/Inflect-Micro-v2-ONNX/resolve/main";
const OFFICIAL_MODEL_BASE_URL =
	"https://huggingface.co/owensong/Inflect-Micro-v2-ONNX/resolve/main/onnx";

function runtimeThreads() {
	if (!globalThis.crossOriginIsolated) return 1;
	return Math.max(1, Math.min(4, navigator.hardwareConcurrency ?? 1));
}

async function fetchModel(url) {
	const response = await fetch(url);
	if (!response.ok)
		throw new Error(`Could not download ${url} (${response.status})`);
	return response.arrayBuffer();
}

function validateControls({ speed, variation, seed }) {
	if (!Number.isFinite(speed) || speed < 0.5 || speed > 2)
		throw new RangeError("Speed must be between 0.5 and 2.0");
	if (!Number.isFinite(variation) || variation < 0 || variation > 1)
		throw new RangeError("Variation must be between 0 and 1");
	if (!Number.isSafeInteger(seed)) throw new RangeError("Seed must be an integer");
}

async function createSessions(durationModel) {
	const graphOptions = { graphOptimizationLevel: "all" };
	ort.env.wasm.numThreads = runtimeThreads();
	const duration = await ort.InferenceSession.create(durationModel, {
		...graphOptions,
		executionProviders: ["wasm"],
	});
	if (navigator.gpu) {
		try {
			const decoderModel = await fetchModel(
				`${MODEL_BASE_URL}/decode-webgpu-fp16.onnx`,
			);
			const decoder = await ort.InferenceSession.create(decoderModel, {
				...graphOptions,
				executionProviders: ["webgpu"],
			});
			return {
				duration,
				decoder,
				provider: "wasm+webgpu",
				threads: ort.env.wasm.numThreads,
			};
		} catch (error) {
			console.warn("WebGPU initialization failed; using WASM", error);
		}
	}

	const decoderModel = await fetchModel(
		`${OFFICIAL_MODEL_BASE_URL}/decode.onnx`,
	);
	const decoder = await ort.InferenceSession.create(decoderModel, {
		...graphOptions,
		executionProviders: ["wasm"],
	});
	return {
		duration,
		decoder,
		provider: "wasm",
		threads: ort.env.wasm.numThreads,
	};
}

/**
 * Runs dynamic duration on WASM and prefers an FP16 WebGPU decoder in Electron,
 * with an official FP32 WASM fallback. Chunks are exposed for immediate playback.
 */
export async function createInflectInference() {
	// Electron renderers expose Node's process. Hide it while ORT selects a web
	// backend so Obsidian does not accidentally enter ORT's Node worker path.
	const nodeProcess = globalThis.process;
	try {
		globalThis.process = undefined;
		ort.env.wasm.wasmPaths = "/node_modules/onnxruntime-web/dist/";
		const [durationModel, frontend] = await Promise.all([
			fetchModel(`${MODEL_BASE_URL}/duration.onnx`),
			createInflectFrontend(),
		]);
		const runtime = await createSessions(durationModel);

		const synthesizeChunk = async (output, speed, variation, seed) => {
			const tokens = BigInt64Array.from(output.ids, BigInt);
			const durationOutput = await runtime.duration.run({
				tokens: new ort.Tensor("int64", tokens, [1, tokens.length]),
				lengths: new ort.Tensor(
					"int64",
					BigInt64Array.of(BigInt(tokens.length)),
					[1],
				),
				length_scale: new ort.Tensor(
					"float32",
					Float32Array.of(1 / speed),
					[],
				),
			});
			const [batch, channels, frames] = durationOutput.m_p_exp.dims;
			if (batch !== 1 || channels !== 192 || !Number.isInteger(frames) || frames < 1)
				throw new Error(`Invalid predicted latent shape ${durationOutput.m_p_exp.dims}`);
			const waveform = (
				await runtime.decoder.run({
					m_p_exp: durationOutput.m_p_exp,
					logs_p_exp: durationOutput.logs_p_exp,
					y_mask: durationOutput.y_mask,
					zp_noise: new ort.Tensor(
						"float32",
						seededNormalNoise(seed, channels, frames),
						[batch, channels, frames],
					),
					noise_scale: new ort.Tensor(
						"float32",
						Float32Array.of(variation),
						[],
					),
				})
			).waveform.data;
			return { frames, waveform };
		};

		return {
			frontend,
			runtime: {
				provider: runtime.provider,
				threads: runtime.threads,
			},
			async synthesize(
				text,
				{
					speed = 1,
					variation = 0.667,
					seed = 0,
					zeroNoise = false,
					onChunk,
				} = {},
			) {
				if (zeroNoise) variation = 0;
				validateControls({ speed, variation, seed });
				const outputs = frontend.phonemizeChunks(text);
				const sourceChunks = outputs.map((output) => output.source);
				const pieces = [];
				for (let index = 0; index < outputs.length; index += 1) {
					const piece = await synthesizeChunk(
						outputs[index],
						speed,
						variation,
						seed + index,
					);
					pieces.push(piece);
					await onChunk?.({
						...piece,
						index,
						total: outputs.length,
						source: sourceChunks[index],
					});
				}
				return { sourceChunks, outputs, pieces };
			},
		};
	} finally {
		globalThis.process = nodeProcess;
	}
}
