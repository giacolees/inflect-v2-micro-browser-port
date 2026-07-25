import {
	createInflectFrontend,
	MAX_TOKENS,
	splitText,
} from "/browser/frontend.mjs";
import { seededNormalNoise } from "/browser/runtime.mjs";

export const SAMPLE_RATE = 24000;
const MAX_FRAMES = 4000;
const LATENT_CHANNELS = 192;

async function fetchModel(path) {
	const response = await fetch(path);
	if (!response.ok) throw new Error(`Missing model: ${path}`);
	return response.arrayBuffer();
}

/**
 * Loads the browser-only text frontend and the two ONNX Runtime Web/WASM graphs.
 * The returned synthesize function exposes each completed inference chunk so a UI
 * can play it before the full request finishes.
 */
export async function createInflectInference() {
	// Electron can expose Node's process in its renderer. Hide it only while ORT
	// selects its backend so it consistently uses the browser/WASM implementation.
	const nodeProcess = globalThis.process;
	try {
		globalThis.process = undefined;
		ort.env.wasm.wasmPaths = "/node_modules/onnxruntime-web/dist/";
		ort.env.wasm.numThreads = 1;
		const [core, decoder, frontend] = await Promise.all([
			fetchModel("/browser/inflect-core.onnx").then((model) =>
				ort.InferenceSession.create(model, { executionProviders: ["wasm"] }),
			),
			fetchModel("/browser/inflect-decoder.onnx").then((model) =>
				ort.InferenceSession.create(model, { executionProviders: ["wasm"] }),
			),
			createInflectFrontend(),
		]);

		const synthesizeChunk = async (output, seed, zeroNoise) => {
			if (output.ids.length > MAX_TOKENS)
				throw new Error(`Token limit exceeded: ${output.ids.length}`);
			const tokens = new BigInt64Array(MAX_TOKENS);
			output.ids.forEach((id, index) => {
				tokens[index] = BigInt(id);
			});
			const coreOutput = await core.run({
				tokens: new ort.Tensor("int64", tokens, [1, MAX_TOKENS]),
				lengths: new ort.Tensor(
					"int64",
					BigInt64Array.of(BigInt(output.ids.length)),
					[1],
				),
				latent_noise: new ort.Tensor(
					"float32",
					zeroNoise
						? new Float32Array(LATENT_CHANNELS * MAX_FRAMES)
						: seededNormalNoise(seed, LATENT_CHANNELS, MAX_FRAMES),
					[1, LATENT_CHANNELS, MAX_FRAMES],
				),
			});
			const frames = Number(coreOutput.frame_lengths.data[0]);
			if (!Number.isInteger(frames) || frames < 1 || frames > MAX_FRAMES)
				throw new Error(`Invalid predicted frame length ${frames}`);
			const latent = new Float32Array(LATENT_CHANNELS * frames);
			for (let channel = 0; channel < LATENT_CHANNELS; channel += 1)
				latent.set(
					coreOutput.latent.data.subarray(
						channel * MAX_FRAMES,
						channel * MAX_FRAMES + frames,
					),
					channel * frames,
				);
			const waveform = (
				await decoder.run({
					latent: new ort.Tensor("float32", latent, [
						1,
						LATENT_CHANNELS,
						frames,
					]),
				})
			).waveform.data;
			return { frames, waveform, latent };
		};

		return {
			frontend,
			async synthesize(text, { zeroNoise = false, onChunk } = {}) {
				const sourceChunks = splitText(text);
				const outputs = frontend.phonemizeChunks(text);
				if (sourceChunks.length !== outputs.length)
					throw new Error("Frontend chunk mismatch");
				const pieces = [];
				for (let index = 0; index < outputs.length; index += 1) {
					const piece = await synthesizeChunk(outputs[index], index, zeroNoise);
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
