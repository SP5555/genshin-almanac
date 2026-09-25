// Release-glow (CSS corona on .avatar-wrap.is-release) + the shared
// detail-panel character header. Only imported by pages that actually
// render release glow (Timeline, Calendar) — this is what used to be an
// accidental coupling (shared.js referenced GLOW_CONFIG even on pages
// that never loaded glow-config.js, and only worked because those pages
// never called these functions). Splitting them out here makes the
// dependency real: importing glow.js is what pulls in glow-config.js,
// not a page's own <script> tag order.
import "./glow-config.js";
import { faceImg, rarityBadge, namecardPath } from "./dom.js";

/**
 * The detail panel's character-view header — namecard title card (art +
 * left-weighted scrim, type overlaid), identical between Timeline's
 * openCharPanel and Calendar's renderCharacterPanel. Only the header
 * itself: each caller still sets its own content background, preexisting
 * note, stats, and appearance list around it. Assumes `header` has
 * already been cleared. Drops any leftover inline background (Calendar
 * day views put region art on this same node). Always a release-style
 * hero shot (halo + bloom), not tied to whether *this* appearance was a
 * debut.
 * @param {HTMLElement} header
 * @param {string} name
 * @param {"4"|"5"} rarity
 * @param {{rateDown?: boolean}} notes
 */
export function buildCharacterHeader(header, name, rarity, notes) {
	header.classList.add("is-character");
	header.style.backgroundImage = "";

	let art = document.createElement("div");
	art.className = "detail-panel-header-art";
	art.style.backgroundImage = `url(${namecardPath(name)})`;
	header.appendChild(art);

	let scrim = document.createElement("div");
	scrim.className = "detail-panel-header-scrim";
	header.appendChild(scrim);

	let avatarWrap = document.createElement("div");
	avatarWrap.className = "avatar-wrap avatar-wrap-lg is-release" + (rarity === "4" ? " is-four" : "");
	avatarWrap.appendChild(faceImg(name, "phase-face-lg is-release" + (rarity === "4" ? " rarity-four" : "")));
	header.appendChild(avatarWrap);

	let textCol = document.createElement("div");
	textCol.className = "detail-panel-header-text";

	let nameEl = document.createElement("h2");
	nameEl.className = "detail-panel-name";
	nameEl.textContent = name;
	textCol.appendChild(nameEl);

	let tagsWrap = document.createElement("div");
	tagsWrap.className = "detail-panel-tags";
	let badge = rarityBadge(rarity);
	let rarityTag = document.createElement("span");
	rarityTag.className = badge.className;
	rarityTag.textContent = badge.text;
	tagsWrap.appendChild(rarityTag);
	if (notes.rateDown) {
		let poolTag = document.createElement("span");
		poolTag.className = "rate-down-tag";
		poolTag.textContent = "Rate-down";
		tagsWrap.appendChild(poolTag);
	}
	textCol.appendChild(tagsWrap);

	header.appendChild(textCol);
}
