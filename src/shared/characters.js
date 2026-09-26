// Unpack characters.json into the maps pages already use (notes / element /
// aliases / birthday). One object in the file; lookup shapes stay cheap.

export function unpackCharacters(characters) {
	let notes = {};
	let elements = {};
	let aliases = {};
	let birthdays = {};
	for (let [name, rec] of Object.entries(characters)) {
		if (rec.element) elements[name] = rec.element;
		if (rec.birthday) birthdays[name] = rec.birthday;
		if (rec.aliases && rec.aliases.length) aliases[name] = rec.aliases;
		let n = {};
		if (rec.rateDown) n.rateDown = true;
		if (rec.preexisting) n.preexisting = true;
		if (n.rateDown || n.preexisting) notes[name] = n;
	}
	return { notes, elements, aliases, birthdays };
}

export function titlesFromVersions(data) {
	let out = {};
	for (let entry of data) {
		if (entry.title) out[entry.version] = entry.title;
	}
	return out;
}
