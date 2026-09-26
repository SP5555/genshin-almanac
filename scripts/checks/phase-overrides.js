// Flags phase-overrides.json keys ("<version>-<phase#>") that don't match any
// real phase in versions.json (stale overrides left behind after a data edit).
module.exports = function checkPhaseOverrides({ phaseOverrides, validPhaseKeys }) {
	let problems = [];
	for (let key of Object.keys(phaseOverrides)) {
		if (!validPhaseKeys.has(key)) problems.push(`phase-overrides.json: "${key}" doesn't match any phase in versions.json`);
	}
	return problems;
};
