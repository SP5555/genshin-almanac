// Aliases must point at a real character, and no single alias string may be
// claimed by two different characters (the search index keys off it).
module.exports = function checkCharacterAliases({ aliases, canonicalNames }) {
	let problems = [];
	for (let name of Object.keys(aliases)) {
		if (!canonicalNames.has(name)) problems.push(`character-aliases.json: "${name}" doesn't match any character in data.json`);
	}
	let aliasOwner = new Map();
	for (let [name, list] of Object.entries(aliases)) {
		for (let alias of list) {
			let key = alias.toLowerCase();
			let owner = aliasOwner.get(key);
			if (owner && owner !== name) problems.push(`character-aliases.json: alias "${alias}" is used by both "${owner}" and "${name}"`);
			aliasOwner.set(key, name);
		}
	}
	return problems;
};
