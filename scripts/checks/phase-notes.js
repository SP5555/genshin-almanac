// Flags phase-notes.json keys ("<version>-<phase#>") that don't match any
// real phase in data.json (stale overrides left behind after a data edit).
module.exports = function checkPhaseNotes({ phaseNotes, validPhaseKeys }) {
	let problems = [];
	for (let key of Object.keys(phaseNotes)) {
		if (!validPhaseKeys.has(key)) problems.push(`phase-notes.json: "${key}" doesn't match any phase in data.json`);
	}
	return problems;
};
