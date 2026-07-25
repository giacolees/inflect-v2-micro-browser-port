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
const server = http.createServer(async (request, response) => {
	const path = normalize(
		join(root, new URL(request.url, "http://localhost").pathname),
	);
	if (!path.startsWith(root)) return response.writeHead(403).end();
	try {
		const body = await readFile(path);
		response.writeHead(200, {
			"Content-Type": mime[extname(path)] ?? "application/octet-stream",
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Embedder-Policy": "require-corp",
		});
		response.end(body);
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
	const results = [];
	for (let run = 0; run < runs; run += 1) {
		const page = await browser.newPage();
		await page.goto(
			`http://127.0.0.1:${server.address().port}/browser/index.html?text=${encodeURIComponent(text)}`,
			{ waitUntil: "networkidle", timeout: 120000 },
		);
		const button = page.locator("#synthesize");
		await button.waitFor({ state: "visible", timeout: 120000 });
		await button.click();
		await page.waitForFunction(() => window.__inflectLastResult !== null, null, {
			timeout: 120000,
		});
		const result = await page.evaluate(() => window.__inflectLastResult);
		if (!result?.ok)
			throw new Error(`BENCHMARK_FAILED ${JSON.stringify(result)}`);
		results.push({
			firstAudioMs: result.firstAudioMs,
			ms: result.loadMs,
			chunks: result.chunks,
			samples: result.samples,
		});
		await page.close();
	}
	const median = (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
	console.log(
		`BROWSER_BENCHMARK ${JSON.stringify({
			runs: results,
			medianFirstAudioMs: median(results.map((result) => result.firstAudioMs)),
			medianTotalMs: median(results.map((result) => result.ms)),
		})}`,
	);
} finally {
	await browser.close();
	await new Promise((resolve) => server.close(resolve));
}
