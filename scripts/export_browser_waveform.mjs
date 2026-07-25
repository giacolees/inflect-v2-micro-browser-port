import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
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
		`http://127.0.0.1:${server.address().port}/browser/index.html?test=1&zeroNoise=1`,
		{ waitUntil: "networkidle", timeout: 120000 },
	);
	const [values, latent, ids] = await page.evaluate(() => [
		Array.from(window.__inflectWaveform),
		Array.from(window.__inflectLatent),
		window.__inflectIds,
	]);
	await writeFile("artifacts/browser-zero-noise.f32", Buffer.from(new Float32Array(values).buffer));
	await writeFile("artifacts/browser-zero-noise-latent.f32", Buffer.from(new Float32Array(latent).buffer));
	await writeFile("artifacts/browser-zero-noise-ids.json", JSON.stringify(ids));
	console.log(`BROWSER_WAVEFORM_EXPORTED samples=${values.length} latent=${latent.length}`);
} finally {
	await browser.close();
	server.close();
}
