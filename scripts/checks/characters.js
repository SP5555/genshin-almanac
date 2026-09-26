const fs = require("fs");

// characters.json: every versions.json name has element + birthday; leftover
// keys, bad birthdays, missing element SVGs, and duplicate aliases.
module.exports = function checkCharacters({ characters, canonicalNames, assetPath }) {
	let problems = [];
	for (let name of Object.keys(characters)) {
		if (!canonicalNames.has(name)) {
			problems.push(`characters.json: "${name}" doesn't match any character in versions.json`);
		}
	}
	for (let name of canonicalNames) {
		let rec = characters[name];
		if (!rec) {
			problems.push(`characters.json: missing entry for "${name}"`);
			continue;
		}
		if (!rec.element) problems.push(`characters.json: "${name}" is missing element`);
		if (!rec.birthday) problems.push(`characters.json: "${name}" is missing birthday`);
	}
	let aliasOwner = new Map();
	for (let [name, rec] of Object.entries(characters)) {
		if (rec.element) {
			let svgPath = assetPath("elements", `${rec.element.toLowerCase()}.svg`);
			if (!fs.existsSync(svgPath)) {
				problems.push(`characters.json: "${name}" has element "${rec.element}" but assets/elements/${rec.element.toLowerCase()}.svg doesn't exist`);
			}
		}
		let md = rec.birthday;
		if (md !== undefined) {
			if (typeof md !== "string" || !/^\d{2}-\d{2}$/.test(md)) {
				problems.push(`characters.json: "${name}" has birthday "${md}", expected MM-DD`);
			} else {
				let mm = parseInt(md.slice(0, 2), 10);
				let dd = parseInt(md.slice(3, 5), 10);
				let probe = new Date(2024, mm - 1, dd);
				if (probe.getMonth() !== mm - 1 || probe.getDate() !== dd) {
					problems.push(`characters.json: "${name}" has invalid birthday "${md}"`);
				}
			}
		}
		for (let alias of rec.aliases || []) {
			let key = alias.toLowerCase();
			let owner = aliasOwner.get(key);
			if (owner && owner !== name) {
				problems.push(`characters.json: alias "${alias}" is used by both "${owner}" and "${name}"`);
			}
			aliasOwner.set(key, name);
		}
	}
	return problems;
};
