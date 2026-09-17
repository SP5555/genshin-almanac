// A single row in a character's own appearance-history list — one row per
// banner appearance, jumpable back to wherever that banner lives on the
// calling page. Was duplicated byte-for-byte between Timeline's app.js and
// Calendar's calendar.js (differing only in the jump target and the
// aria-label's trailing phrase); unified here since the `entry` shape is
// identical between the two pages' indexes ({version, phaseLabel, rarity,
// isRelease, rerun, rateDown, preexisting, isFiller, variant, date}).
import { onActivate, formatDate } from "./dom.js";

/**
 * @param {{version: string, phaseLabel: string, rarity: "4"|"5", isRelease: boolean,
 *   rerun: number, preexisting: boolean, isFiller: boolean, variant: string|null, date?: string}} entry
 * @param {() => void} onJump - what clicking/activating the version link does
 *   (Timeline: jumpToCard(entry.version, entry.phaseLabel); Calendar: jumpToDate(entry.date))
 * @param {string} jumpContext - trailing phrase for the aria-label, e.g.
 *   "card" (Timeline) or "on the calendar" (Calendar)
 * @returns {HTMLDivElement}
 */
export function buildAppearanceRow(entry, onJump, jumpContext) {
	let row = document.createElement("div");
	row.className = "char-appear-row" + (entry.isFiller ? " is-filler" : "");

	let rail = document.createElement("span");
	rail.className = "char-appear-rail";
	let dot = document.createElement("span");
	dot.className = "char-appear-dot " + (entry.rarity === "5" ? "is-five" : "is-four")
		+ (entry.isRelease ? " is-release" : "")
		+ (entry.variant ? ` is-${entry.variant}` : "");
	rail.appendChild(dot);
	row.appendChild(rail);

	let label = document.createElement("div");
	label.className = "char-appear-label";

	let ver = document.createElement("span");
	ver.className = "char-appear-version is-jumpable" + (entry.variant ? ` is-${entry.variant}` : "");
	ver.textContent = `${entry.version} — ${entry.phaseLabel}`;
	ver.tabIndex = 0;
	ver.setAttribute("role", "button");
	ver.setAttribute("aria-label", `Jump to ${entry.version} ${entry.phaseLabel} ${jumpContext}`);
	onActivate(ver, onJump);
	label.appendChild(ver);

	let meta = document.createElement("div");
	meta.className = "char-appear-meta";
	let status = document.createElement("span");
	status.className = "char-appear-tag";
	if (entry.preexisting) {
		status.textContent = `Rerun ${entry.rerun + 1}`;
	} else if (entry.rerun === 0) {
		status.textContent = "Release";
		status.classList.add("is-release");
	} else {
		status.textContent = `Rerun ${entry.rerun}`;
	}
	meta.appendChild(status);
	if (entry.date) {
		let dateEl = document.createElement("span");
		dateEl.className = "char-appear-date";
		dateEl.textContent = formatDate(entry.date);
		meta.appendChild(dateEl);
	}
	label.appendChild(meta);

	row.appendChild(label);
	return row;
}
