// Every data.json version has an official English title in
// version-titles.json (and that file has no leftover keys).
module.exports = function checkVersionTitles({ versionTitles, data }) {
	let problems = [];
	let versions = data.map(entry => entry.version);
	for (let version of versions) {
		let title = versionTitles[version];
		if (!title) problems.push(`version-titles.json: missing title for ${version}`);
		else if (typeof title !== "string" || !title.trim()) {
			problems.push(`version-titles.json: "${version}" title is empty`);
		}
	}
	for (let version of Object.keys(versionTitles)) {
		if (!versions.includes(version)) {
			problems.push(`version-titles.json: "${version}" doesn't match any version in data.json`);
		}
	}
	return problems;
};
