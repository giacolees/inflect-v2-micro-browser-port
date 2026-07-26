import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = process.cwd();
const loopbackOrigin =
	process.env.BENCHMARK_ORIGIN ?? ["http:", "", "127.0.0.1"].join("/");
const hubOrigin =
	process.env.HF_HUB_ORIGIN ?? ["https:", "", "huggingface.co"].join("/");
const officialBase = `${hubOrigin}/owensong/Inflect-Micro-v2-ONNX/resolve/main/onnx`;
const fp16Base =
	process.env.FP16_MODEL_BASE ??
	`${hubOrigin}/giacolees/Inflect-Micro-v2-ONNX/resolve/main`;
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
	const url = new URL(request.url, loopbackOrigin);
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
	const pageOrigin = `${loopbackOrigin}:${server.address().port}`;
	await page.goto(`${pageOrigin}/benchmark.html`);
	await page.addScriptTag({
		url: `${pageOrigin}/node_modules/onnxruntime-web/dist/ort.webgpu.min.js`,
	});
	const result = await page.evaluate(
		async ({ text, runs, officialBase, fp16Base }) => {
			const { createInflectFrontend } = await import("/browser/frontend.mjs");
			const { seededNormalNoise } = await import("/browser/runtime.mjs");

			const fetchModel = async (url) => {
				const response = await fetch(url);
				if (!response.ok) throw new Error(`Could not download ${url}`);
				return response.arrayBuffer();
			};
			ort.env.wasm.wasmPaths = "/node_modules/onnxruntime-web/dist/";
			ort.env.wasm.numThreads = 1;
			const createSessions = (
				provider,
				base = officialBase,
				durationName = "duration.onnx",
				decodeName = "decode.onnx",
			) =>
				Promise.all([
					fetchModel(`${base}/${durationName}`).then((model) =>
						ort.InferenceSession.create(model, {
							executionProviders: [provider],
							graphOptimizationLevel: "all",
						}),
					),
					fetchModel(`${base}/${decodeName}`).then((model) =>
						ort.InferenceSession.create(model, {
							executionProviders: [provider],
							graphOptimizationLevel: "all",
						}),
					),
				]);
			const frontend = await createInflectFrontend();
			const official = await createSessions("wasm");
			const webgpu = await createSessions("webgpu");
			const fp16Webgpu = await createSessions(
				"webgpu",
				fp16Base,
				"duration.onnx",
				"decode-webgpu-fp16.onnx",
			);
			const fp16Wasm = await createSessions(
				"wasm",
				fp16Base,
				"duration.onnx",
				"decode-webgpu-fp16.onnx",
			);
			const output = frontend.phonemizeChunks(text)[0];
			const firstAudio = async ([duration, decode]) => {
				const tokens = BigInt64Array.from(output.ids, BigInt);
				const durationOutput = await duration.run({
					tokens: new ort.Tensor("int64", tokens, [1, tokens.length]),
					lengths: new ort.Tensor(
						"int64",
						BigInt64Array.of(BigInt(tokens.length)),
						[1],
					),
					length_scale: new ort.Tensor("float32", Float32Array.of(1), []),
				});
				return (
					await decode.run({
						m_p_exp: durationOutput.m_p_exp,
						logs_p_exp: durationOutput.logs_p_exp,
						y_mask: durationOutput.y_mask,
						zp_noise: new ort.Tensor(
							"float32",
							seededNormalNoise(
								0,
								durationOutput.m_p_exp.dims[1],
								durationOutput.m_p_exp.dims[2],
							),
							durationOutput.m_p_exp.dims,
						),
						noise_scale: new ort.Tensor("float32", Float32Array.of(0.667), []),
					})
				).waveform.data;
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
				return {
					runsMs: values,
					medianMs: values[Math.floor(values.length / 2)],
				};
			};
			const officialWaveform = await firstAudio([official[0], webgpu[1]]);
			const fp16Waveform = await firstAudio([official[0], fp16Webgpu[1]]);
			let squaredError = 0;
			let maxError = 0;
			for (let index = 0; index < officialWaveform.length; index += 1) {
				const error = officialWaveform[index] - fp16Waveform[index];
				squaredError += error * error;
				maxError = Math.max(maxError, Math.abs(error));
			}
			return {
				firstChunkTokenIds: output.ids.length,
				chunks: frontend.phonemizeChunks(text).length,
				officialWasm: await measure(() => firstAudio(official)),
				officialWebgpu: await measure(() => firstAudio(webgpu)),
				fp16Webgpu: await measure(() => firstAudio(fp16Webgpu)),
				fp16Wasm: await measure(() => firstAudio(fp16Wasm)),
				mixedWasmFp16Webgpu: await measure(() =>
					firstAudio([official[0], fp16Webgpu[1]]),
				),
				fp16VsOfficialWebgpu: {
					maxAbsError: maxError,
					rmse: Math.sqrt(squaredError / officialWaveform.length),
				},
			};
		},
		{ text, runs, officialBase, fp16Base },
	);
	process.stdout.write(
		`ONNX_FIRST_AUDIO_BENCHMARK ${JSON.stringify(result)}\n`,
	);
} finally {
	await browser.close();
	await new Promise((resolve) => server.close(resolve));
}
