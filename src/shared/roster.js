// A rarity slot is a list of display names, or "*" for the full roster of
// that rarity released so far. Empty array already means "unconfirmed"
// (5-stars posted first), so the all-of-them signal cannot be [] or an
// omitted key.

export const FULL_ROSTER = "*";

export function isFullRoster(slot) {
	return slot === FULL_ROSTER;
}

// Names to iterate. "*" yields [] — callers that need the meaning (the
// full-roster summary) must also check isFullRoster. Missing keys stay
// undefined so `for...of` still throws, same as before.
export function listedNames(slot) {
	if (isFullRoster(slot)) return [];
	return slot;
}
