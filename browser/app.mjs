import { createInflectInference, SAMPLE_RATE } from "/browser/inference.mjs";
import {
	boundaryPauseSeconds,
	concatenateChunks,
	edgeFade,
	encodeFloat32Wav,
} from "/browser/runtime.mjs";

const params = new URLSearchParams(location.search);
const isTest = params.has("test");
const pageStarted = performance.now();
let downloadUrl;

function resultFor(completed, loadMs, firstAudioMs) {
	const waveform = concatenateChunks(
		completed.pieces.map((piece) => piece.waveform),
		completed.sourceChunks,
	);
	const wav = encodeFloat32Wav(waveform);
	const view = new DataView(wav);
	return {
		result: {
			ok: true,
			chunks: completed.outputs.length,
			tokenCount: completed.outputs.reduce(
				(sum, output) => sum + output.ids.length,
				0,
			),
			loadMs,
			firstAudioMs,
			frames: completed.pieces.reduce((sum, piece) => sum + piece.frames, 0),
			samples: waveform.length,
			finite: waveform.every(Number.isFinite),
			wavBytes: wav.byteLength,
			wavValid:
				view.getUint32(0, false) === 0x52494646 &&
				view.getUint32(8, false) === 0x57415645,
		},
		waveform,
		ids: completed.outputs[0].ids,
		wav,
	};
}

function queueAudio(audioContext, piece, source, isLast, nextStart) {
	const samples = edgeFade(piece.waveform, SAMPLE_RATE);
	const buffer = audioContext.createBuffer(1, samples.length, SAMPLE_RATE);
	buffer.copyToChannel(samples, 0);
	const node = audioContext.createBufferSource();
	node.buffer = buffer;
	node.connect(audioContext.destination);
	const startAt = Math.max(nextStart, audioContext.currentTime + 0.05);
	node.start(startAt);
	return (
		startAt + buffer.duration + (isLast ? 0 : boundaryPauseSeconds(source))
	);
}

async function runParity(frontend) {
	const [fixture, prompts] = await Promise.all([
		fetch("/fixtures/vits-frontend-fixture.json").then((response) =>
			response.json(),
		),
		fetch("/fixtures/prompts.json").then((response) => response.json()),
	]);
	const texts = new Map(prompts.map((prompt) => [prompt.id, prompt.text]));
	const cases = fixture.map((expected) => {
		const actual = frontend.phonemize(texts.get(expected.id));
		return {
			id: expected.id,
			normalized: actual.normalizedText === expected.normalized_text,
			phonemes: actual.phonemeText === expected.phoneme_text,
			ids: JSON.stringify(actual.ids) === JSON.stringify(expected.ids),
		};
	});
	document.body.textContent = JSON.stringify({
		ok: cases.every((item) => item.normalized && item.phonemes && item.ids),
		cases,
	});
}

async function main() {
	const inputText =
		params.get("text") ?? "The quick brown fox jumps over the lazy dog.";
	const inference = await createInflectInference();
	if (params.has("parity")) return runParity(inference.frontend);
	if (isTest) {
		const completed = await inference.synthesize(inputText, {
			speed: Number(params.get("speed") ?? 1),
			variation: Number(params.get("variation") ?? 0.667),
			seed: Number(params.get("seed") ?? 0),
			zeroNoise: params.has("zeroNoise"),
		});
		const output = resultFor(completed, performance.now() - pageStarted, null);
		window.__inflectWaveform = output.waveform;
		window.__inflectIds = output.ids;
		document.body.textContent = JSON.stringify(output.result);
		return;
	}

	const textArea = document.querySelector("#text");
	const button = document.querySelector("#synthesize");
	const status = document.querySelector("#status");
	const audio = document.querySelector("#audio");
	const speed = document.querySelector("#speed");
	const variation = document.querySelector("#variation");
	const seed = document.querySelector("#seed");
	const bindOutput = (input, output, digits) => {
		const update = () => {
			output.value = Number(input.value).toFixed(digits);
		};
		input.addEventListener("input", update);
		update();
	};
	bindOutput(speed, document.querySelector("#speed-value"), 2);
	bindOutput(variation, document.querySelector("#variation-value"), 3);
	textArea.value = inputText;
	document.querySelector("#intro").textContent =
		"The browser frontend and ONNX Runtime sessions are ready.";
	document.querySelector("#runtime-state").textContent =
		inference.runtime.provider.includes("webgpu")
			? "Ready · WASM duration + WebGPU FP16 decoder"
			: `Ready · WASM · ${inference.runtime.threads} thread(s)`;
	button.disabled = false;
	window.__inflectLastResult = null;
	button.onclick = async () => {
		button.disabled = true;
		window.__inflectLastResult = null;
		status.textContent = "Preparing a new synthesis…";
		const runStarted = performance.now();
		const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
		let nextStart = audioContext.currentTime + 0.05;
		let firstAudioMs = null;
		try {
			await audioContext.resume();
			const completed = await inference.synthesize(textArea.value, {
				speed: Number(speed.value),
				variation: Number(variation.value),
				seed: Number(seed.value),
				onChunk: ({ index, total, ...piece }) => {
					status.textContent = `Running ONNX graph for chunk ${index + 1} of ${total}…`;
					nextStart = queueAudio(
						audioContext,
						piece,
						piece.source,
						index + 1 === total,
						nextStart,
					);
					if (firstAudioMs === null)
						firstAudioMs = performance.now() - runStarted;
				},
			});
			const output = resultFor(
				completed,
				performance.now() - runStarted,
				firstAudioMs,
			);
			if (downloadUrl) URL.revokeObjectURL(downloadUrl);
			downloadUrl = URL.createObjectURL(
				new Blob([output.wav], { type: "audio/wav" }),
			);
			audio.src = downloadUrl;
			document.querySelector("#download").href = downloadUrl;
			window.__inflectLastResult = output.result;
			status.textContent = `${output.result.chunks} chunk(s) · ${output.result.tokenCount} token IDs · first audio ${(firstAudioMs / 1000).toFixed(2)} s · complete ${(output.result.loadMs / 1000).toFixed(2)} s`;
		} catch (error) {
			status.textContent = `Synthesis failed: ${error.message}`;
			console.error(error);
		} finally {
			button.disabled = false;
		}
	};
}

main().catch((error) => {
	console.error(error);
	document.body.textContent = JSON.stringify({
		ok: false,
		error: String(error),
		stack: error.stack,
	});
});
