const fs = require("fs");

// Catches a new major that never got a version-notes row (blank region
// title / missing jpg), and stale keys after a data edit. Not a copy review.
module.exports = function checkVersionNotes({ versionNotes, data, assetPath }) {
	let problems = [];
	let majors = new Set(data.map(entry => String(entry.version).split(".")[0]));
	for (let major of majors) {
		if (!(major in versionNotes)) problems.push(`version-notes.json: missing entry for major "${major}"`);
	}
	for (let major of Object.keys(versionNotes)) {
		if (!majors.has(major)) problems.push(`version-notes.json: "${major}" doesn't match any version in data.json`);
		let meta = versionNotes[major] || {};
		if (!meta.region) problems.push(`version-notes.json: "${major}" is missing region`);
		if (!meta.tagline) problems.push(`version-notes.json: "${major}" is missing tagline`);
		if (!meta.bgImage) {
			problems.push(`version-notes.json: "${major}" is missing bgImage`);
		} else if (!fs.existsSync(assetPath("regions", `${meta.bgImage}.jpg`))) {
			problems.push(`version-notes.json: "${major}" bgImage "${meta.bgImage}" but assets/regions/${meta.bgImage}.jpg doesn't exist`);
		}
	}
	return problems;
};
