const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const readJSON = file => JSON.parse(fs.readFileSync(path.join(ROOT, "data", file), "utf8"));
const assetPath = (...p) => path.join(ROOT, "assets", ...p);
const slug = name => name.replace(/\s/g, "").toLowerCase();

// data.json (banner phases + chronicled + lightrace entries) is the single
// source of truth for "which characters have appeared" and "which phases
// exist" — every check derives from this rather than re-deriving its own copy.
function buildCanonicalData(data) {
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
		if (v.lightrace) {
			for (let rarity of ["5", "4"]) (v.lightrace[rarity] || []).forEach(n => canonicalNames.add(n));
		}
	}
	return { canonicalNames, validPhaseKeys };
}

module.exports = { ROOT, readJSON, assetPath, slug, buildCanonicalData };
