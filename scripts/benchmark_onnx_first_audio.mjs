import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = process.cwd();
const loopbackOrigin =
	process.env.BENCHMARK_ORIGIN ?? ["http:", "", "127.0.0.1"].join("/");
const hubOrigin =
	process.env.HF_HUB_ORIGIN ?? ["https:", "", "huggingface.co"].join("/");
const modelBase = `${hubOrigin}/giacolees/Inflect-Micro-v2-ONNX/resolve/main`;
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
		async ({ text, runs, modelBase }) => {
			const { createInflectFrontend } = await import("/browser/frontend.mjs");
			const { seededNormalNoise } = await import("/browser/runtime.mjs");
			const fetchModel = async (name) => {
				const response = await fetch(`${modelBase}/${name}`);
				if (!response.ok) throw new Error(`Could not download ${name}`);
				return response.arrayBuffer();
			};
			ort.env.wasm.wasmPaths = "/node_modules/onnxruntime-web/dist/";
			ort.env.wasm.numThreads = 1;
			const durationModel = await fetchModel("duration.onnx");
			const decoderModel = await fetchModel("decode-fp32.onnx");
			const createSessions = async (provider) => [
				await ort.InferenceSession.create(durationModel, {
					executionProviders: [provider],
					graphOptimizationLevel: "all",
				}),
				await ort.InferenceSession.create(decoderModel, {
					executionProviders: [provider],
					graphOptimizationLevel: "all",
				}),
			];
			const frontend = await createInflectFrontend();
			const wasm = await createSessions("wasm");
			const webgpu = await createSessions("webgpu");
			const output = frontend.phonemizeChunks(text)[0];
			const firstAudio = async ([duration, decoder]) => {
				const tokens = BigInt64Array.from(output.ids, BigInt);
				const acoustic = await duration.run({
					tokens: new ort.Tensor("int64", tokens, [1, tokens.length]),
					lengths: new ort.Tensor(
						"int64",
						BigInt64Array.of(BigInt(tokens.length)),
						[1],
					),
					length_scale: new ort.Tensor("float32", Float32Array.of(1), []),
				});
				return decoder.run({
					m_p_exp: acoustic.m_p_exp,
					logs_p_exp: acoustic.logs_p_exp,
					y_mask: acoustic.y_mask,
					zp_noise: new ort.Tensor(
						"float32",
						seededNormalNoise(
							0,
							acoustic.m_p_exp.dims[1],
							acoustic.m_p_exp.dims[2],
						),
						acoustic.m_p_exp.dims,
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
				return {
					runsMs: values,
					medianMs: values[Math.floor(values.length / 2)],
				};
			};
			return {
				firstChunkTokenIds: output.ids.length,
				chunks: frontend.phonemizeChunks(text).length,
				fp32Wasm: await measure(() => firstAudio(wasm)),
				fp32Webgpu: await measure(() => firstAudio(webgpu)),
				electronHybrid: await measure(() => firstAudio([wasm[0], webgpu[1]])),
			};
		},
		{ text, runs, modelBase },
	);
	process.stdout.write(
		`ONNX_FIRST_AUDIO_BENCHMARK ${JSON.stringify(result)}\n`,
	);
} finally {
	await browser.close();
	await new Promise((resolve) => server.close(resolve));
}
