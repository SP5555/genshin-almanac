// Flags character-notes.json entries that don't correspond to any real
// character in data.json (stale keys left behind after a rename/removal).
module.exports = function checkCharacterNotes({ notes, canonicalNames }) {
	let problems = [];
	for (let name of Object.keys(notes)) {
		if (!canonicalNames.has(name)) problems.push(`character-notes.json: "${name}" doesn't match any character in data.json`);
	}
	return problems;
};
