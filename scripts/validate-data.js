#!/usr/bin/env node
// Cross-checks data/*.json against each other and against assets/. Each
// concern lives in its own file under scripts/checks/ — this file just loads
// the shared data once, hands it to every check, and reports the results.
const { readJSON, assetPath, slug, buildCanonicalData } = require("./checks/util");

const checks = [
	require("./checks/character-notes"),
	require("./checks/character-elements"),
	require("./checks/character-aliases"),
	require("./checks/phase-notes"),
	require("./checks/character-assets"),
];

let data = readJSON("data.json");
let notes = readJSON("character-notes.json");
let elements = readJSON("character-elements.json");
let aliases = readJSON("character-aliases.json");
let phaseNotes = readJSON("phase-notes.json");
let { canonicalNames, validPhaseKeys } = buildCanonicalData(data);

let ctx = { data, notes, elements, aliases, phaseNotes, canonicalNames, validPhaseKeys, assetPath, slug };

let problems = checks.flatMap(check => check(ctx));

if (problems.length) {
	console.error(`Found ${problems.length} issue(s):\n`);
	problems.forEach(p => console.error(`  - ${p}`));
	process.exit(1);
} else {
	console.log(`All good — ${canonicalNames.size} characters cross-checked across data.json, character-notes.json, character-elements.json, character-aliases.json, and phase-notes.json.`);
}
