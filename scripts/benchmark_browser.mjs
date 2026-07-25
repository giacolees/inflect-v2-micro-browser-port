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
			`http://127.0.0.1:${server.address().port}/browser/index.html?test=1&text=${encodeURIComponent(text)}`,
			{ waitUntil: "networkidle", timeout: 120000 },
		);
		const result = JSON.parse(
			await page.locator("body").textContent({ timeout: 120000 }),
		);
		if (!result.ok)
			throw new Error(`BENCHMARK_FAILED ${JSON.stringify(result)}`);
		results.push({
			ms: result.loadMs,
			chunks: result.chunks,
			samples: result.samples,
		});
		await page.close();
	}
	const times = results.map((result) => result.ms).sort((a, b) => a - b);
	console.log(
		`BROWSER_BENCHMARK ${JSON.stringify({ runs: results, medianMs: times[Math.floor(times.length / 2)] })}`,
	);
} finally {
	await browser.close();
	await new Promise((resolve) => server.close(resolve));
}
