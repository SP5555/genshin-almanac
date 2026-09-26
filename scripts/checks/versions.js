const { FULL_ROSTER } = require("./util");

function checkSlot(where, rarity, slot) {
	let label = `${where} "${rarity}"`;
	if (slot === undefined) return `${label} is missing`;
	if (slot === FULL_ROSTER) return null;
	if (!Array.isArray(slot)) {
		return `${label} must be an array of names or "${FULL_ROSTER}"`;
	}
	for (let i = 0; i < slot.length; i++) {
		let n = slot[i];
		if (n === FULL_ROSTER) {
			return `${label} lists "${FULL_ROSTER}" as a name — use "${FULL_ROSTER}" as the value, not inside the array`;
		}
		if (typeof n !== "string" || !n.trim()) {
			return `${label}[${i}] is not a character name`;
		}
	}
	return null;
}

function checkRoster(where, obj) {
	let problems = [];
	for (let rarity of ["5", "4"]) {
		let msg = checkSlot(where, rarity, obj[rarity]);
		if (msg) problems.push(msg);
	}
	return problems;
}

// Titles, plus every `"5"`/`"4"` slot is either a name list or the
// full-roster sentinel "*" (empty array still means 5-stars confirmed
// first — see AGENTS.md).
module.exports = function checkVersions({ data }) {
	let problems = [];
	for (let entry of data) {
		let title = entry.title;
		if (!title) problems.push(`versions.json: missing title for ${entry.version}`);
		else if (typeof title !== "string" || !title.trim()) {
			problems.push(`versions.json: "${entry.version}" title is empty`);
		}
		entry.banner.forEach((phase, i) => {
			problems.push(...checkRoster(`versions.json ${entry.version} phase ${i + 1}`, phase));
		});
		if (entry.chronicled) {
			problems.push(...checkRoster(`versions.json ${entry.version} chronicled`, entry.chronicled));
		}
		if (entry.lightrace) {
			problems.push(...checkRoster(`versions.json ${entry.version} lightrace`, entry.lightrace));
		}
	}
	return problems;
};
