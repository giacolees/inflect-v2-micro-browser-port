import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".wasm": "application/wasm", ".onnx": "application/octet-stream" };
const server = http.createServer(async (request, response) => {
  const path = normalize(join(root, new URL(request.url, "http://localhost").pathname === "/" ? "/browser/index.html" : new URL(request.url, "http://localhost").pathname));
  if (!path.startsWith(root)) return response.writeHead(403).end();
  try {
    const body = await readFile(path);
    response.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream", "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" }).end(body);
  } catch { response.writeHead(404).end(); }
});
server.listen(4173, "127.0.0.1", () => console.log("Inflect harness: http://127.0.0.1:4173"));
