const { readFileSync, writeFileSync } = require("node:fs");
const { phonemize } = require("phonemize");

let fixture;
try {
	fixture = JSON.parse(
		readFileSync("fixtures/vits-frontend-fixture.json", "utf8"),
	);
} catch (error) {
	console.error(`Could not load VITS frontend fixture: ${error.message}`);
	process.exit(1);
}
const report = fixture.map((row) => {
	const actual = phonemize(row.normalized_text, { language: "en-US" });
	let matching = 0;
	for (
		let index = 0;
		index < Math.min(actual.length, row.phoneme_text.length);
		index += 1
	) {
		if (actual[index] === row.phoneme_text[index]) matching += 1;
	}
	return {
		id: row.id,
		expected: row.phoneme_text,
		actual,
		exact: actual === row.phoneme_text,
		prefix_character_match_rate:
			matching / Math.max(actual.length, row.phoneme_text.length),
		characters_absent_from_reference: [
			...new Set(
				[...actual].filter(
					(character) => ![...row.phoneme_text].includes(character),
				),
			),
		],
	};
});
writeFileSync(
	"fixtures/permissive-g2p-evaluation.json",
	`${JSON.stringify(report, null, 2)}\n`,
);
console.log(
	`PERMISSIVE_G2P_EVALUATED exact=${report.filter((row) => row.exact).length}/${report.length}`,
);
for (const row of report)
	console.log(
		`${row.id} match=${row.prefix_character_match_rate.toFixed(3)} absent_from_reference=${row.characters_absent_from_reference.join("") || "none"}`,
	);
