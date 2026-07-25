import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

let prompts;
try {
	prompts = JSON.parse(readFileSync("fixtures/prompts.json", "utf8"));
} catch (error) {
	throw new Error("could not load corpus fixture", { cause: error });
}
const results = [];
for (const prompt of prompts.filter((entry) => entry.id !== "long")) {
	const output = execFileSync("node", ["scripts/browser_proof.mjs"], {
		encoding: "utf8",
		env: { ...process.env, TEXT: prompt.text },
	});
	const match = output.match(/CHROMIUM_ORT_WEB_OK (.+)$/m);
	if (!match) throw new Error(`missing browser result for ${prompt.id}`);
	try {
		results.push({ id: prompt.id, ...JSON.parse(match[1]) });
	} catch (error) {
		throw new Error(`could not parse browser result for ${prompt.id}`, {
			cause: error,
		});
	}
}
writeFileSync(
	"fixtures/browser-corpus-results.json",
	`${JSON.stringify(results, null, 2)}\n`,
);
console.log(`BROWSER_CORPUS_OK cases=${results.length}`);
console.log(
	"BROWSER_CORPUS_LONG_TEXT_DEFERRED requires chunk concatenation runtime",
);
