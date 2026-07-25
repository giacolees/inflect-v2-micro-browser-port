import { execFileSync } from "node:child_process";

const python = process.env.PYTHON ?? ".venv/bin/python";
function run(command, args) {
	return execFileSync(command, args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
}
try {
	process.stdout.write(run(python, ["scripts/check_onnx.py"]));
	process.stdout.write(run(python, ["scripts/validate_wav.py"]));
	process.stdout.write(run(python, ["scripts/test_ort_native.py"]));
	process.stdout.write(run(python, ["scripts/test_padding_parity.py"]));
	process.stdout.write(run("node", ["scripts/frontend_parity.mjs"]));
	const browserOutput = run("node", ["scripts/browser_proof.mjs"]);
	if (!browserOutput.includes("CHROMIUM_ORT_WEB_OK")) {
		throw new Error(`browser proof did not report success\n${browserOutput}`);
	}
	process.stdout.write(browserOutput);
	console.log(
		"FRONTEND_PARITY_OK ephone/eSpeak-NG WASM matches the six-case frontend fixture",
	);
	console.log(
		"METHOD_STATUS: frontend, ORT-Web/WASM synthesis, WAV generation, and renderer smoke checks pass; listening review, cancellation, target-runtime acceptance, and downstream offline packaging remain outside this method assessment.",
	);
} catch (error) {
	console.error(error.stack ?? error);
	process.exitCode = 1;
}
