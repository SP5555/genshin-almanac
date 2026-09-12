const fs = require("fs");

// Every character needs exactly one element, and that element needs a
// matching assets/elements/*.svg — checks both directions plus the asset.
module.exports = function checkCharacterElements({ elements, canonicalNames, assetPath }) {
	let problems = [];
	for (let name of Object.keys(elements)) {
		if (!canonicalNames.has(name)) problems.push(`character-elements.json: "${name}" doesn't match any character in data.json`);
	}
	for (let name of canonicalNames) {
		if (!(name in elements)) problems.push(`character-elements.json: missing entry for "${name}"`);
	}
	for (let [name, element] of Object.entries(elements)) {
		let svgPath = assetPath("elements", `${element.toLowerCase()}.svg`);
		if (!fs.existsSync(svgPath)) {
			problems.push(`character-elements.json: "${name}" has element "${element}" but assets/elements/${element.toLowerCase()}.svg doesn't exist`);
		}
	}
	return problems;
};
