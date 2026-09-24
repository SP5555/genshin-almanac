// Small DOM/formatting building blocks shared across pages. No dependencies
// on any other module in this project.

/** Filename stem: "Hu Tao" → "hutao". Same rule as scripts/checks/util.js. */
export function slug(name) {
	return name.replace(/\s/g, "").toLowerCase();
}

/** @param {string} character @returns {string} */
export function facePath(character) {
	return `assets/faces/${slug(character)}.png`;
}

/** @param {string} character @returns {string} */
export function namecardPath(character) {
	return `assets/namecards/${slug(character)}.jpg`;
}

/**
 * @param {string} character
 * @param {string} className
 * @returns {HTMLImageElement}
 */
export function faceImg(character, className) {
	let img = document.createElement("img");
	img.className = className;
	img.src = facePath(character);
	img.alt = character;
	img.loading = "lazy";
	return img;
}

/** @param {string} isoDate @returns {string} */
export function formatDate(isoDate) {
	let d = new Date(isoDate + "T00:00:00");
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Oxford-comma join for a short name list: "A", "A and B", "A, B, and C".
 * @param {string[]} names
 * @returns {string}
 */
export function joinNames(names) {
	if (names.length === 1) return names[0];
	if (names.length === 2) return `${names[0]} and ${names[1]}`;
	return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * @param {"4"|"5"} rarity
 * @returns {{className: string, text: string}}
 */
export function rarityBadge(rarity) {
	return { className: "detail-panel-badge " + (rarity === "5" ? "is-five" : "is-four"), text: rarity === "5" ? "5-Star" : "4-Star" };
}

/**
 * Wires click + Enter/Space keydown on `el` to the same zero-arg action —
 * the "clickable text that also acts like a button" pattern (e.g. a
 * char-appear-row's jumpable version link).
 * @param {Element} el
 * @param {() => void} action
 */
export function onActivate(el, action) {
	el.addEventListener("click", action);
	el.addEventListener("keydown", e => {
		if (e.key === "Enter" || e.key === " ") { e.preventDefault(); action(); }
	});
}

/**
 * Same pairing, delegated: fires `handler(trigger)` on a click or Enter/
 * Space keydown anywhere inside `container` whose target matches `selector`.
 * @param {Element} container
 * @param {string} selector
 * @param {(trigger: Element) => void} handler
 */
export function onDelegatedActivate(container, selector, handler) {
	container.addEventListener("click", e => {
		let trigger = e.target.closest(selector);
		if (trigger) handler(trigger);
	});
	container.addEventListener("keydown", e => {
		if (e.key !== "Enter" && e.key !== " ") return;
		let trigger = e.target.closest(selector);
		if (trigger) { e.preventDefault(); handler(trigger); }
	});
}
