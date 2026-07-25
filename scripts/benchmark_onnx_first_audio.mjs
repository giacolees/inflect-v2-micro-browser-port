import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = process.cwd();
const runs = Number(process.env.RUNS ?? 3);
const text =
	process.env.TEXT ??
	"This is a practical note-length synthesis benchmark with several complete sentences. ".repeat(
		5,
	);
const mime = {
	".html": "text/html",
	".js": "text/javascript",
	".mjs": "text/javascript",
	".wasm": "application/wasm",
	".onnx": "application/octet-stream",
};
const headers = {
	"Cross-Origin-Opener-Policy": "same-origin",
	"Cross-Origin-Embedder-Policy": "require-corp",
};
const server = http.createServer(async (request, response) => {
	const url = new URL(request.url, "http://localhost");
	if (url.pathname === "/benchmark.html") {
		response.writeHead(200, { ...headers, "Content-Type": "text/html" });
		response.end("<!doctype html><title>ONNX benchmark</title>");
		return;
	}
	const path = normalize(join(root, url.pathname));
	if (!path.startsWith(root)) return response.writeHead(403).end();
	try {
		const body = await readFile(path);
		response
			.writeHead(200, {
				...headers,
				"Content-Type": mime[extname(path)] ?? "application/octet-stream",
			})
			.end(body);
	} catch {
		response.writeHead(404).end();
	}
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({
	executablePath:
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	headless: true,
});

try {
	const page = await browser.newPage();
	await page.goto(`http://127.0.0.1:${server.address().port}/benchmark.html`);
	await page.addScriptTag({
		url: `http://127.0.0.1:${server.address().port}/node_modules/onnxruntime-web/dist/ort.wasm.min.js`,
	});
	const result = await page.evaluate(async ({ text, runs }) => {
		const { createInflectFrontend } = await import("/browser/frontend.mjs");
		const { seededNormalNoise } = await import("/browser/runtime.mjs");
		const currentBase =
			"https://huggingface.co/giacolees/Inflect-Micro-v2-ONNX/resolve/main";
		const officialBase =
			"https://huggingface.co/owensong/Inflect-Micro-v2/resolve/main/onnx";
		const fetchModel = async (url) => {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`Could not download ${url}`);
			return response.arrayBuffer();
		};
		ort.env.wasm.wasmPaths = "/node_modules/onnxruntime-web/dist/";
		ort.env.wasm.numThreads = 1;
		const [[core, decoder], [duration, decode], frontend] = await Promise.all([
			Promise.all([
				fetchModel(`${currentBase}/inflect-core.onnx`).then((model) =>
					ort.InferenceSession.create(model, { executionProviders: ["wasm"] }),
				),
				fetchModel(`${currentBase}/inflect-decoder.onnx`).then((model) =>
					ort.InferenceSession.create(model, { executionProviders: ["wasm"] }),
				),
			]),
			Promise.all([
				fetchModel(`${officialBase}/duration.onnx`).then((model) =>
					ort.InferenceSession.create(model, { executionProviders: ["wasm"] }),
				),
				fetchModel(`${officialBase}/decode.onnx`).then((model) =>
					ort.InferenceSession.create(model, { executionProviders: ["wasm"] }),
				),
			]),
			createInflectFrontend(),
		]);
		const output = frontend.phonemizeChunks(text)[0];
		const currentFirstAudio = async () => {
			const tokens = new BigInt64Array(512);
			output.ids.forEach((id, index) => {
				tokens[index] = BigInt(id);
			});
			const coreOutput = await core.run({
				tokens: new ort.Tensor("int64", tokens, [1, 512]),
				lengths: new ort.Tensor(
					"int64",
					BigInt64Array.of(BigInt(output.ids.length)),
					[1],
				),
				latent_noise: new ort.Tensor(
					"float32",
					seededNormalNoise(0, 192, 4000),
					[1, 192, 4000],
				),
			});
			const frames = Number(coreOutput.frame_lengths.data[0]);
			const latent = new Float32Array(192 * frames);
			for (let channel = 0; channel < 192; channel += 1)
				latent.set(
					coreOutput.latent.data.subarray(
						channel * 4000,
						channel * 4000 + frames,
					),
					channel * frames,
				);
			await decoder.run({
				latent: new ort.Tensor("float32", latent, [1, 192, frames]),
			});
		};
		const officialFirstAudio = async () => {
			const tokens = BigInt64Array.from(output.ids, BigInt);
			const durationOutput = await duration.run({
				tokens: new ort.Tensor("int64", tokens, [1, tokens.length]),
				lengths: new ort.Tensor("int64", BigInt64Array.of(BigInt(tokens.length)), [1]),
				length_scale: new ort.Tensor("float32", Float32Array.of(1), []),
			});
			await decode.run({
				m_p_exp: durationOutput.m_p_exp,
				logs_p_exp: durationOutput.logs_p_exp,
				y_mask: durationOutput.y_mask,
				zp_noise: new ort.Tensor(
					"float32",
					seededNormalNoise(0, durationOutput.m_p_exp.dims[1], durationOutput.m_p_exp.dims[2]),
					durationOutput.m_p_exp.dims,
				),
				noise_scale: new ort.Tensor("float32", Float32Array.of(0.667), []),
			});
		};
		const measure = async (run) => {
			await run();
			const values = [];
			for (let index = 0; index < runs; index += 1) {
				const started = performance.now();
				await run();
				values.push(performance.now() - started);
			}
			values.sort((a, b) => a - b);
			return { runsMs: values, medianMs: values[Math.floor(values.length / 2)] };
		};
		return {
			firstChunkTokenIds: output.ids.length,
			chunks: frontend.phonemizeChunks(text).length,
			current: await measure(currentFirstAudio),
			official: await measure(officialFirstAudio),
		};
	}, { text, runs });
	console.log(`ONNX_FIRST_AUDIO_BENCHMARK ${JSON.stringify(result)}`);
} finally {
	await browser.close();
	await new Promise((resolve) => server.close(resolve));
}
