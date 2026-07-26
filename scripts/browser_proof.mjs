import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = process.cwd();
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
	if (!path.startsWith(root)) {
		response.writeHead(403).end();
		return;
	}
	try {
		const body = await readFile(path);
		response
			.writeHead(200, {
				"Content-Type": mime[extname(path)] ?? "application/octet-stream",
				"Cross-Origin-Opener-Policy": "same-origin",
				"Cross-Origin-Embedder-Policy": "require-corp",
			})
			.end(body);
	} catch {
		response.writeHead(404).end();
	}
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const browser = await chromium.launch({
	executablePath:
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	headless: true,
});
try {
	const page = await browser.newPage();
	page.on("console", (message) =>
		console.error(`BROWSER_CONSOLE ${message.type()} ${message.text()}`),
	);
	page.on("pageerror", (error) =>
		console.error(`BROWSER_PAGE_ERROR ${error.stack}`),
	);
	const queryParams = new URLSearchParams({ test: "1" });
	for (const name of ["TEXT", "SPEED", "VARIATION", "SEED"])
		if (process.env[name]) queryParams.set(name.toLowerCase(), process.env[name]);
	const query = `?${queryParams}`;
	await page.goto(`http://127.0.0.1:${port}/browser/index.html${query}`, {
		waitUntil: "networkidle",
		timeout: 120000,
	});
	const result = JSON.parse(await page.locator("body").textContent());
	if (
		!result.ok ||
		!result.finite ||
		!Number.isInteger(result.frames) ||
		result.samples < result.frames * 256 ||
		!result.wavValid ||
		result.wavBytes !== 44 + result.samples * 4
	) {
		throw new Error(`BROWSER_ORT_FAILED ${JSON.stringify(result)}`);
	}
	const heapBeforeWarm = await page.evaluate(
		() => performance.memory?.usedJSHeapSize ?? null,
	);
	const warmStarted = performance.now();
	await page.reload({ waitUntil: "networkidle", timeout: 120000 });
	const warmResult = JSON.parse(await page.locator("body").textContent());
	if (!warmResult.ok || !warmResult.finite || !warmResult.wavValid) {
		throw new Error(`BROWSER_WARM_FAILED ${JSON.stringify(warmResult)}`);
	}
	const heapAfterWarm = await page.evaluate(
		() => performance.memory?.usedJSHeapSize ?? null,
	);
	console.log(
		`CHROMIUM_ORT_WEB_OK ${JSON.stringify({ ...result, warmMs: performance.now() - warmStarted, heapBeforeWarm, heapAfterWarm })}`,
	);
} finally {
	await browser.close();
	server.close();
}
