const fs = require("fs");

// Catches a new major that never got a majors.json row (blank region
// art / tagline on Timeline + landing).
module.exports = function checkMajors({ majors, data, assetPath }) {
	let problems = [];
	let used = new Set(data.map(e => e.version.split(".")[0]));
	for (let major of used) {
		if (!(major in majors)) problems.push(`majors.json: missing entry for major "${major}"`);
	}
	for (let major of Object.keys(majors)) {
		if (!used.has(major)) problems.push(`majors.json: "${major}" doesn't match any version in versions.json`);
		let meta = majors[major] || {};
		if (!meta.region) problems.push(`majors.json: "${major}" is missing region`);
		if (!meta.tagline) problems.push(`majors.json: "${major}" is missing tagline`);
		if (!meta.bgImage) {
			problems.push(`majors.json: "${major}" is missing bgImage`);
		} else if (!fs.existsSync(assetPath("regions", `${meta.bgImage}.jpg`))) {
			problems.push(`majors.json: "${major}" bgImage "${meta.bgImage}" but assets/regions/${meta.bgImage}.jpg doesn't exist`);
		}
	}
	return problems;
};
