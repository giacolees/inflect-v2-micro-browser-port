import { execFileSync } from 'node:child_process';

const python = process.env.PYTHON ?? '.venv/bin/python';
function run(command, args) { return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
try {
  process.stdout.write(run(python, ['scripts/check_onnx.py']));
  process.stdout.write(run(python, ['scripts/validate_wav.py']));
  try {
    const output = run('node', ['scripts/browser_proof.mjs']);
    throw new Error(`unexpected browser success; reconsider REPORT.md\n${output}`);
  } catch (error) {
    const text = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    if (!text.includes('BROWSER_ORT_FAILED')) throw error;
    console.log('CHROMIUM_ORT_WEB_EXPECTED_FAILURE confirmed');
  }
  console.log('FRONTEND_PARITY_BLOCKED exact eSpeak-NG frontend is Python/native only; no browser-equivalent was validated');
  console.log('GO_NO_GO_SUMMARY NO-GO: ORT Web/WASM renderer cannot execute the exported synthesis graph; do not integrate into Obsidian.');
} catch (error) {
  console.error(error.stack ?? error);
  process.exitCode = 1;
}
