// Every character in data.json needs a birthday, and leftover keys after a
// rename shouldn't linger. Format is MM-DD (Bennett's 02-29 is valid).
module.exports = function checkCharacterBirthdays({ birthdays, canonicalNames }) {
	let problems = [];
	for (let name of Object.keys(birthdays)) {
		if (!canonicalNames.has(name)) problems.push(`character-birthdays.json: "${name}" doesn't match any character in data.json`);
	}
	for (let name of canonicalNames) {
		if (!(name in birthdays)) problems.push(`character-birthdays.json: missing entry for "${name}"`);
	}
	for (let [name, md] of Object.entries(birthdays)) {
		if (typeof md !== "string" || !/^\d{2}-\d{2}$/.test(md)) {
			problems.push(`character-birthdays.json: "${name}" has "${md}", expected MM-DD`);
			continue;
		}
		let mm = parseInt(md.slice(0, 2), 10);
		let dd = parseInt(md.slice(3, 5), 10);
		// 2024 is a leap year so 02-29 round-trips; other invalid days don't.
		let probe = new Date(2024, mm - 1, dd);
		if (probe.getMonth() !== mm - 1 || probe.getDate() !== dd) {
			problems.push(`character-birthdays.json: "${name}" has invalid day "${md}"`);
		}
	}
	return problems;
};
