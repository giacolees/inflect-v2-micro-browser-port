import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = process.cwd();
const types = {
	".html": "text/html",
	".js": "text/javascript",
	".mjs": "text/javascript",
	".json": "application/json",
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
		response
			.writeHead(200, {
				"Content-Type": types[extname(path)] ?? "application/octet-stream",
				"Cross-Origin-Opener-Policy": "same-origin",
				"Cross-Origin-Embedder-Policy": "require-corp",
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
	await page.goto(
		`http://127.0.0.1:${server.address().port}/browser/index.html?parity=1`,
		{ waitUntil: "networkidle", timeout: 120000 },
	);
	const result = JSON.parse(await page.locator("body").textContent());
	if (!result.ok)
		throw new Error(`FRONTEND_PARITY_FAILED ${JSON.stringify(result)}`);
	console.log(`FRONTEND_PARITY_OK cases=${result.cases.length}`);
} finally {
	await browser.close();
	server.close();
}
