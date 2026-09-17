// Sticky pill character search — shared by Timeline's #charSearch and
// Calendar's identical port, since both pages already build their own
// name -> entries index independently (Timeline's characterIndex,
// Calendar's characterAppearances) and just need the same matching/
// ranking/DOM logic driven off whichever one they have.
import { faceImg } from "./dom.js";

/** @param {string} s @returns {string} */
export function searchStrip(s) {
	return s.toLowerCase().replace(/\s+/g, "");
}

/**
 * Ranks a character's match into 4 tiers so primary-name matches always
 * outrank alias matches: 0 = name starts with query, 1 = name contains it,
 * 2 = an alias starts with it, 3 = an alias only contains it. `key` is the
 * matched string, used to alphabetize within a tier.
 * @param {string} name
 * @param {string} strippedQuery
 * @param {Object<string, string[]>} characterAliases
 * @returns {{tier: number, key: string}|null}
 */
export function matchInfo(name, strippedQuery, characterAliases) {
	let nameStripped = searchStrip(name);
	if (nameStripped.includes(strippedQuery)) {
		return { tier: nameStripped.startsWith(strippedQuery) ? 0 : 1, key: nameStripped };
	}
	let matches = (characterAliases[name] || [])
		.map(searchStrip)
		.filter(a => a.includes(strippedQuery));
	if (matches.length === 0) return null;
	let starts = matches.filter(a => a.startsWith(strippedQuery));
	let pool = (starts.length ? starts : matches).sort();
	return { tier: starts.length ? 2 : 3, key: pool[0] };
}

/**
 * @param {string} name
 * @param {string} strippedQuery
 * @returns {DocumentFragment}
 */
export function highlightMatches(name, strippedQuery) {
	let frag = document.createDocumentFragment();
	if (!strippedQuery) {
		frag.appendChild(document.createTextNode(name));
		return frag;
	}

	let map = [];
	let stripped = "";
	for (let i = 0; i < name.length; i++) {
		if (!/\s/.test(name[i])) {
			map.push(i);
			stripped += name[i].toLowerCase();
		}
	}

	let cursor = 0;
	let i = 0;
	while (i < stripped.length) {
		let idx = stripped.indexOf(strippedQuery, i);
		if (idx === -1) break;
		let startOrig = map[idx];
		let endOrig = map[idx + strippedQuery.length - 1] + 1;
		if (startOrig > cursor) frag.appendChild(document.createTextNode(name.slice(cursor, startOrig)));
		let mark = document.createElement("span");
		mark.className = "char-search-match";
		mark.textContent = name.slice(startOrig, endOrig);
		frag.appendChild(mark);
		cursor = endOrig;
		i = idx + strippedQuery.length;
	}
	if (cursor < name.length) frag.appendChild(document.createTextNode(name.slice(cursor)));
	return frag;
}

/**
 * @param {() => string[]} getCharacterNames - called fresh on every
 *   keystroke so each page's own index only needs to exist by the time the
 *   user types, not by the time this is called.
 * @param {Object<string, string[]>} characterAliases
 * @param {(name: string) => void} onSelect - what a chosen result does
 *   (Timeline opens its char panel directly; Calendar pushes it onto its
 *   panel stack).
 */
export function initCharSearch(getCharacterNames, characterAliases, onSelect) {
	let input = document.getElementById("charSearchInput");
	let results = document.getElementById("charSearchResults");
	let currentMatches = [];
	let activeIndex = -1;

	function applyActiveClass() {
		[...results.children].forEach((el, i) => el.classList.toggle("is-active", i === activeIndex));
	}

	function updateActiveHighlight() {
		applyActiveClass();
		let activeEl = results.children[activeIndex];
		if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
	}

	function selectResult(name) {
		if (!name) return;
		onSelect(name);
		input.value = "";
		currentMatches = [];
		activeIndex = -1;
		results.innerHTML = "";
		results.classList.remove("has-results");
		input.blur();
	}

	input.addEventListener("input", () => {
		let strippedQuery = searchStrip(input.value.trim());
		activeIndex = -1;
		results.innerHTML = "";
		results.classList.remove("has-results");
		currentMatches = [];
		if (!strippedQuery) return;

		currentMatches = getCharacterNames()
			.map(name => ({ name, info: matchInfo(name, strippedQuery, characterAliases) }))
			.filter(x => x.info)
			.sort((a, b) => {
				if (a.info.tier !== b.info.tier) return a.info.tier - b.info.tier;
				if (a.info.key !== b.info.key) return a.info.key.localeCompare(b.info.key);
				return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
			})
			.map(x => x.name);
		if (currentMatches.length === 0) return;

		currentMatches.forEach((name, i) => {
			let item = document.createElement("div");
			item.className = "char-search-result";
			item.appendChild(faceImg(name, "char-search-avatar"));

			let textWrap = document.createElement("div");
			textWrap.className = "char-search-result-text";

			let nameWrap = document.createElement("span");
			nameWrap.className = "char-search-name";
			nameWrap.appendChild(highlightMatches(name, strippedQuery));
			textWrap.appendChild(nameWrap);

			let aliases = (characterAliases[name] || []).filter(a => searchStrip(a).includes(strippedQuery));
			if (aliases.length) {
				let aliasWrap = document.createElement("span");
				aliasWrap.className = "char-search-alias";
				aliases.forEach((alias, idx) => {
					if (idx > 0) aliasWrap.appendChild(document.createTextNode(", "));
					aliasWrap.appendChild(highlightMatches(alias, strippedQuery));
				});
				textWrap.appendChild(aliasWrap);
			}

			item.appendChild(textWrap);
			item.addEventListener("click", () => selectResult(name));
			item.addEventListener("mouseenter", () => {
				activeIndex = i;
				applyActiveClass();
			});
			results.appendChild(item);
		});
		results.classList.add("has-results");
	});

	results.addEventListener("mouseleave", () => {
		activeIndex = -1;
		applyActiveClass();
	});

	input.addEventListener("keydown", e => {
		if (currentMatches.length === 0) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			activeIndex = Math.min(activeIndex + 1, currentMatches.length - 1);
			updateActiveHighlight();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			activeIndex = Math.max(activeIndex - 1, 0);
			updateActiveHighlight();
		} else if (e.key === "Enter") {
			e.preventDefault();
			selectResult(currentMatches[activeIndex === -1 ? 0 : activeIndex]);
		}
	});
}
