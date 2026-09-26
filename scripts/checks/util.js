const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const readJSON = file => JSON.parse(fs.readFileSync(path.join(ROOT, "data", file), "utf8"));
const assetPath = (...p) => path.join(ROOT, "assets", ...p);
// Same rule as src/shared/dom.js slug() — keep in sync; this file is CJS
// and cannot import that ESM module.
const slug = name => name.replace(/\s/g, "").toLowerCase();

// Twin of src/shared/roster.js — CJS validate cannot import that ESM file.
const FULL_ROSTER = "*";
const isFullRoster = slot => slot === FULL_ROSTER;
function listedNames(slot) {
	if (isFullRoster(slot)) return [];
	return slot;
}

function unpackCharacters(characters) {
	let notes = {};
	let elements = {};
	let aliases = {};
	let birthdays = {};
	for (let [name, rec] of Object.entries(characters)) {
		if (rec.element) elements[name] = rec.element;
		if (rec.birthday) birthdays[name] = rec.birthday;
		if (rec.aliases && rec.aliases.length) aliases[name] = rec.aliases;
		let n = {};
		if (rec.rateDown) n.rateDown = true;
		if (rec.preexisting) n.preexisting = true;
		if (n.rateDown || n.preexisting) notes[name] = n;
	}
	return { notes, elements, aliases, birthdays };
}

// versions.json (banner phases + chronicled + lightrace entries) is the single
// source of truth for "which characters have appeared" and "which phases
// exist" — every check derives from this rather than re-deriving its own copy.
function buildCanonicalData(data) {
	let canonicalNames = new Set();
	let validPhaseKeys = new Set();
	for (let v of data) {
		v.banner.forEach((phase, i) => {
			validPhaseKeys.add(`${v.version}-${i + 1}`);
			for (let rarity of ["5", "4"]) listedNames(phase[rarity] || []).forEach(n => canonicalNames.add(n));
		});
		if (v.chronicled) {
			for (let rarity of ["5", "4"]) listedNames(v.chronicled[rarity] || []).forEach(n => canonicalNames.add(n));
		}
		if (v.lightrace) {
			for (let rarity of ["5", "4"]) listedNames(v.lightrace[rarity] || []).forEach(n => canonicalNames.add(n));
		}
	}
	return { canonicalNames, validPhaseKeys };
}

module.exports = { ROOT, readJSON, assetPath, slug, FULL_ROSTER, isFullRoster, listedNames, buildCanonicalData, unpackCharacters };
