#!/usr/bin/env node
// Cross-checks data/*.json against each other and against assets/. Each
// concern lives in its own file under scripts/checks/ — this file just loads
// the shared data once, hands it to every check, and reports the results.
const { readJSON, assetPath, slug, buildCanonicalData } = require("./checks/util");

const checks = [
	require("./checks/characters"),
	require("./checks/phase-overrides"),
	require("./checks/character-assets"),
	require("./checks/majors"),
	require("./checks/versions"),
];

let data = readJSON("versions.json");
let characters = readJSON("characters.json");
let phaseOverrides = readJSON("phase-overrides.json");
let majors = readJSON("majors.json");
let { canonicalNames, validPhaseKeys } = buildCanonicalData(data);

let ctx = { data, characters, phaseOverrides, majors, canonicalNames, validPhaseKeys, assetPath, slug };

let problems = checks.flatMap(check => check(ctx));

if (problems.length) {
	console.error(`Found ${problems.length} issue(s):\n`);
	problems.forEach(p => console.error(`  - ${p}`));
	process.exit(1);
} else {
	console.log(`All good — ${canonicalNames.size} characters cross-checked across versions.json, characters.json, phase-overrides.json, and majors.json.`);
}
