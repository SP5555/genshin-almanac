#!/usr/bin/env node
// Cross-checks data/*.json against each other. data.json (banner phases +
// chronicled entries) is the single source of truth for "which characters
// have appeared" — this script derives that set from it and flags anything
// in the other data files that doesn't line up, plus missing face/namecard
// art (which fail silently in the UI, with no onerror fallback).
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const readJSON = file => JSON.parse(fs.readFileSync(path.join(ROOT, "data", file), "utf8"));
const assetPath = (...p) => path.join(ROOT, "assets", ...p);
const slug = name => name.replace(/\s/g, "").toLowerCase();

let data = readJSON("data.json");
let notes = readJSON("character-notes.json");
let elements = readJSON("character-elements.json");
let aliases = readJSON("character-aliases.json");
let phaseNotes = readJSON("phase-notes.json");

let problems = [];
let warn = msg => problems.push(msg);

let canonicalNames = new Set();
let validPhaseKeys = new Set();
for (let v of data) {
	v.banner.forEach((phase, i) => {
		validPhaseKeys.add(`${v.version}-${i + 1}`);
		for (let rarity of ["5", "4"]) (phase[rarity] || []).forEach(n => canonicalNames.add(n));
	});
	if (v.chronicled) {
		for (let rarity of ["5", "4"]) (v.chronicled[rarity] || []).forEach(n => canonicalNames.add(n));
	}
}

for (let name of Object.keys(notes)) {
	if (!canonicalNames.has(name)) warn(`character-notes.json: "${name}" doesn't match any character in data.json`);
}

for (let name of Object.keys(elements)) {
	if (!canonicalNames.has(name)) warn(`character-elements.json: "${name}" doesn't match any character in data.json`);
}
for (let name of canonicalNames) {
	if (!(name in elements)) warn(`character-elements.json: missing entry for "${name}"`);
}
for (let [name, element] of Object.entries(elements)) {
	let svgPath = assetPath("elements", `${element.toLowerCase()}.svg`);
	if (!fs.existsSync(svgPath)) {
		warn(`character-elements.json: "${name}" has element "${element}" but assets/elements/${element.toLowerCase()}.svg doesn't exist`);
	}
}

for (let name of Object.keys(aliases)) {
	if (!canonicalNames.has(name)) warn(`character-aliases.json: "${name}" doesn't match any character in data.json`);
}
let aliasOwner = new Map();
for (let [name, list] of Object.entries(aliases)) {
	for (let alias of list) {
		let key = alias.toLowerCase();
		let owner = aliasOwner.get(key);
		if (owner && owner !== name) warn(`character-aliases.json: alias "${alias}" is used by both "${owner}" and "${name}"`);
		aliasOwner.set(key, name);
	}
}

for (let key of Object.keys(phaseNotes)) {
	if (!validPhaseKeys.has(key)) warn(`phase-notes.json: "${key}" doesn't match any phase in data.json`);
}

for (let name of canonicalNames) {
	let s = slug(name);
	if (!fs.existsSync(assetPath("faces", `${s}.png`))) warn(`Missing face asset for "${name}": assets/faces/${s}.png`);
	if (!fs.existsSync(assetPath("namecards", `${s}.jpg`))) warn(`Missing namecard asset for "${name}": assets/namecards/${s}.jpg`);
}

if (problems.length) {
	console.error(`Found ${problems.length} issue(s):\n`);
	problems.forEach(p => console.error(`  - ${p}`));
	process.exit(1);
} else {
	console.log(`All good — ${canonicalNames.size} characters cross-checked across data.json, character-notes.json, character-elements.json, character-aliases.json, and phase-notes.json.`);
}
