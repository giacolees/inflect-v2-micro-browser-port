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
	const browserOutput = run("node", ["scripts/browser_proof.mjs"]);
	if (!browserOutput.includes("CHROMIUM_ORT_WEB_OK")) {
		throw new Error(`browser proof did not report success\n${browserOutput}`);
	}
	process.stdout.write(browserOutput);
	console.log(
		"FRONTEND_PARITY_BLOCKED exact eSpeak-NG frontend is Python/native only; no browser-equivalent was validated",
	);
	console.log(
		"GO_NO_GO_SUMMARY NO-GO: padded core and dynamic decoder run in ORT Web/WASM, but browser frontend parity remains unsolved; do not integrate into Obsidian.",
	);
} catch (error) {
	console.error(error.stack ?? error);
	process.exitCode = 1;
}
