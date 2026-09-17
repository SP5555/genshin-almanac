// Release-glow rays + the shared detail-panel character header. Only
// imported by pages that actually render release glow (Timeline, Calendar)
// — this is what used to be an accidental coupling (shared.js referenced
// GLOW_CONFIG even on pages that never loaded glow-config.js, and only
// worked because those pages never called these two functions). Splitting
// them out here makes the dependency real: importing glow.js is what pulls
// in glow-config.js, not a page's own <script> tag order.
import { GLOW_CONFIG } from "./glow-config.js";
import { faceImg, rarityBadge } from "./dom.js";

/**
 * Flickering sunburst rays behind a release portrait — each ray is a
 * separate blade with a randomized angle/delay/duration (baked in as inline
 * CSS vars here, so the flicker itself runs on CSS alone with no recurring
 * JS). Shared by Timeline's phase cards/character header and Calendar's
 * character header. Calendar's compact day-panel phase cards deliberately
 * skip this — see docs/calendar.md — but a single-character header has the
 * room.
 * @param {number} count
 * @param {string} colorVar
 * @returns {HTMLDivElement}
 */
export function buildRays(count, colorVar) {
	let wrap = document.createElement("div");
	wrap.className = "rays-wrap";
	let cfg = GLOW_CONFIG.rays;
	let arcSize = 360 / count;
	for (let i = 0; i < count; i++) {
		let ray = document.createElement("div");
		ray.className = "ray";
		let angle = i * arcSize + Math.random() * arcSize;
		ray.style.setProperty("--ray-angle", `${angle.toFixed(1)}deg`);
		ray.style.setProperty("--ray-delay", `${(Math.random() * cfg.delayMaxS).toFixed(2)}s`);
		ray.style.setProperty("--ray-dur", `${(cfg.durationMinS + Math.random() * (cfg.durationMaxS - cfg.durationMinS)).toFixed(2)}s`);
		ray.style.setProperty("--ray-color", colorVar);
		wrap.appendChild(ray);
	}
	return wrap;
}

/**
 * The detail panel's character-view header (avatar+rays on the left,
 * name+tags on the right) — identical between Timeline's openCharPanel and
 * Calendar's renderCharacterPanel, so it's built once here instead of
 * twice. Only the header itself: each caller still sets its own content
 * background, preexisting note, stats, and appearance list around it,
 * since those differ (or don't exist at all) per page. Assumes `header`
 * has already been cleared.
 * @param {HTMLElement} header
 * @param {string} name
 * @param {"4"|"5"} rarity
 * @param {{rateDown?: boolean}} notes
 */
export function buildCharacterHeader(header, name, rarity, notes) {
	header.classList.add("is-character");

	let namecardPath = `assets/namecards/${name.replace(/\s/g, "").toLowerCase()}.jpg`;
	header.style.backgroundImage = `linear-gradient(to bottom, rgba(13,13,20,0.45), rgba(13,13,20,0.94)), url(${namecardPath})`;

	let avatarWrap = document.createElement("div");
	avatarWrap.className = "avatar-wrap avatar-wrap-lg";
	avatarWrap.appendChild(buildRays(GLOW_CONFIG.rays.countHeader, rarity === "4" ? "var(--four-glow)" : "var(--five-glow)"));
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
