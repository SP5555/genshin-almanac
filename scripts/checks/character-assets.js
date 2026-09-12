const fs = require("fs");

// Missing face/namecard art fails silently in the UI (neither <img> has an
// onerror fallback), so this is the only thing that would ever catch it.
module.exports = function checkCharacterAssets({ canonicalNames, assetPath, slug }) {
	let problems = [];
	for (let name of canonicalNames) {
		let s = slug(name);
		if (!fs.existsSync(assetPath("faces", `${s}.png`))) problems.push(`Missing face asset for "${name}": assets/faces/${s}.png`);
		if (!fs.existsSync(assetPath("namecards", `${s}.jpg`))) problems.push(`Missing namecard asset for "${name}": assets/namecards/${s}.jpg`);
	}
	return problems;
};
