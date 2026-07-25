import { createInflectInference, SAMPLE_RATE } from "/browser/inference.mjs";
import {
	boundaryPauseSeconds,
	concatenateChunks,
	edgeFade,
	encodeFloat32Wav,
} from "/browser/runtime.mjs";

const params = new URLSearchParams(location.search);
const isTest = params.has("test");
const started = performance.now();
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
		latent: completed.pieces[0].latent,
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
			zeroNoise: params.has("zeroNoise"),
		});
		const output = resultFor(completed, performance.now() - started, null);
		window.__inflectWaveform = output.waveform;
		window.__inflectLatent = output.latent;
		window.__inflectIds = output.ids;
		document.body.textContent = JSON.stringify(output.result);
		return;
	}

	const textArea = document.querySelector("#text");
	const button = document.querySelector("#synthesize");
	const status = document.querySelector("#status");
	const audio = document.querySelector("#audio");
	textArea.value = inputText;
	document.querySelector("#intro").textContent =
		"The browser frontend and ONNX Runtime Web/WASM sessions are ready.";
	document.querySelector("#runtime-state").textContent =
		"Ready · WASM execution provider";
	button.disabled = false;
	button.onclick = async () => {
		button.disabled = true;
		const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
		let nextStart = audioContext.currentTime + 0.05;
		let firstAudioMs = null;
		try {
			await audioContext.resume();
			const completed = await inference.synthesize(textArea.value, {
				onChunk: ({ index, total, ...piece }) => {
					status.textContent = `Running ONNX graph for chunk ${index + 1} of ${total}…`;
					nextStart = queueAudio(
						audioContext,
						piece,
						piece.source,
						index + 1 === total,
						nextStart,
					);
					if (firstAudioMs === null) firstAudioMs = performance.now() - started;
				},
			});
			const output = resultFor(
				completed,
				performance.now() - started,
				firstAudioMs,
			);
			if (downloadUrl) URL.revokeObjectURL(downloadUrl);
			downloadUrl = URL.createObjectURL(
				new Blob([output.wav], { type: "audio/wav" }),
			);
			audio.src = downloadUrl;
			document.querySelector("#download").href = downloadUrl;
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
