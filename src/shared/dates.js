// Date/phase-math helpers shared across pages. No dependencies on any other
// module in this project.

export const PHASE_LENGTH_DAYS = 21;
export const LIVE_WINDOW_DAYS = 42;
const DAY_MS = 86400000;

/**
 * A phase's real-world start date, applying phase-notes.json's override for
 * the handful of historically irregular phases (1.3's 3-phase structure,
 * 3.0-3.2's compressed cadence — see AGENTS.md). Same 21-day cadence as
 * landing's live spotlight (`PHASE_LENGTH_DAYS`).
 * @param {{version: string, date: string}} entry - a data.json version entry
 * @param {number} phaseIndex - 0-based phase index within entry.banner
 * @param {Object<string, {date?: string}>} phaseNotes - phase-notes.json
 * @returns {string} ISO date (YYYY-MM-DD)
 */
export function getPhaseStartDate(entry, phaseIndex, phaseNotes) {
	let override = (phaseNotes[`${entry.version}-${phaseIndex + 1}`] || {}).date;
	if (override) return override;
	let d = new Date(entry.date + "T00:00:00Z");
	d.setUTCDate(d.getUTCDate() + phaseIndex * PHASE_LENGTH_DAYS);
	return d.toISOString().slice(0, 10);
}

/**
 * Lightweight stand-in for a full characterIndex build — counts how many
 * times `character` has appeared in banner[] phases up through
 * (versionIdx, phaseIdx) inclusive. Enough to know Release vs. Rerun N
 * without rendering the entire timeline. Never scans chronicled/lightrace
 * (both are reruns by definition, so they never affect a first-appearance
 * count).
 * @param {Array} data - data.json
 * @param {number} versionIdx
 * @param {number} phaseIdx
 * @param {string} character
 * @returns {number}
 */
export function countAppearancesThrough(data, versionIdx, phaseIdx, character) {
	let count = 0;
	for (let vi = 0; vi <= versionIdx; vi++) {
		let phases = data[vi].banner;
		let maxPi = vi === versionIdx ? phaseIdx : phases.length - 1;
		for (let pi = 0; pi <= maxPi; pi++) {
			if (phases[pi]["5"].includes(character) || phases[pi]["4"].includes(character)) count++;
		}
	}
	return count;
}

// Dev-only time travel for testing date/time-sensitive UI (phase math,
// countdowns, live indicators) without touching the system clock. Reads
// ?fakeDate=<ISO date or datetime, e.g. 2026-09-30T14:30:00> from the URL —
// gated to the dev-server hostname (localhost/127.0.0.1) so it's
// structurally inert on the real deployed site regardless of what URL a
// visitor tries. The offset is computed once at page load and held fixed,
// so time keeps flowing forward normally from that starting instant rather
// than freezing there — every call to previewNow() re-reads the real clock
// and re-applies the same offset, which is what keeps a setInterval-driven
// countdown ticking realistically during testing. Every "now" read for UI
// purposes across the site should go through this instead of a bare
// Date.now()/new Date() — parsing a *stored* date from data.json is
// unaffected and shouldn't use this. Not localStorage: chrome.js copies
// the param onto in-site links so clicking around stays in the same
// preview. Off localhost the offset is 0, not merely hidden.
export function isLocalDevHost() {
	return typeof location !== "undefined"
		&& (location.hostname === "localhost" || location.hostname === "127.0.0.1");
}

const PREVIEW_TIME_OFFSET_MS = (() => {
	if (!isLocalDevHost()) return 0;
	let fakeDate = new URLSearchParams(location.search).get("fakeDate");
	if (!fakeDate) return 0;
	let parsed = new Date(fakeDate);
	return isNaN(parsed.getTime()) ? 0 : parsed.getTime() - Date.now();
})();

/** @returns {Date} */
export function previewNow() {
	return new Date(Date.now() + PREVIEW_TIME_OFFSET_MS);
}

// data.json's "date" is the CST calendar date a version went live.
// Maintenance starts at 06:00 China Standard Time (UTC+8) for every server
// at once — same fact Server Clocks uses. Local midnight of that date is
// many hours late in America; UTC midnight is still two hours after
// maintenance actually started. Displayed calendar dates stay YYYY-MM-DD;
// only "has this launched" / "how old is this" comparisons use this instant.
export const CST_OFFSET_HOURS = 8;
export const MAINTENANCE_START_HOUR_CST = 6;

/**
 * @param {string} isoDate - YYYY-MM-DD (CST calendar date)
 * @param {number} [hourCst]
 * @returns {Date}
 */
export function cstDateToUtcInstant(isoDate, hourCst = MAINTENANCE_START_HOUR_CST) {
	let [y, m, d] = isoDate.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d, hourCst - CST_OFFSET_HOURS, 0, 0, 0));
}

/** Epoch ms of a version's real launch (06:00 CST on its data.json date). */
export function versionLaunchInstant(isoDate) {
	return cstDateToUtcInstant(isoDate).getTime();
}

/**
 * The most recently *launched* entry — walks backward from the end rather
 * than just taking data[data.length-1], since a version can be pre-staged
 * in data.json ahead of its official date (announced but not live yet).
 * @param {Array} data - data.json
 * @param {number} now - epoch ms
 * @returns {Object|null}
 */
export function findLastLaunchedEntry(data, now) {
	for (let i = data.length - 1; i >= 0; i--) {
		if (versionLaunchInstant(data[i].date) <= now) return data[i];
	}
	return null;
}

/**
 * Live spotlight phase. Only reliable on a normal 21-day live cycle —
 * landing does not apply historical phase-notes overrides here.
 * @param {{banner: Array, date: string}} entry
 * @param {number} nowMs
 */
export function getCurrentPhaseIndex(entry, nowMs) {
	let phases = entry.banner;
	if (phases.length <= 1) return 0;
	let daysSince = Math.max(0, (nowMs - versionLaunchInstant(entry.date)) / DAY_MS);
	return Math.min(Math.floor(daysSince / PHASE_LENGTH_DAYS), phases.length - 1);
}

/**
 * Header live-dot + landing spotlight: last launched version, which phase,
 * and whether the 42-day window has closed (stale dataset).
 */
export function liveBannerState(data, nowMs) {
	let entry = findLastLaunchedEntry(data, nowMs);
	if (!entry) {
		return { entry: null, phaseIdx: 0, daysSinceLaunch: null, isLive: false, stale: false };
	}
	let daysSinceLaunch = (nowMs - versionLaunchInstant(entry.date)) / DAY_MS;
	return {
		entry,
		phaseIdx: getCurrentPhaseIndex(entry, nowMs),
		daysSinceLaunch,
		isLive: daysSinceLaunch <= LIVE_WINDOW_DAYS,
		stale: daysSinceLaunch > LIVE_WINDOW_DAYS
	};
}

/**
 * Server Clocks next-update card. Newest data.json row may be pre-staged
 * (still in the future) — that is a confirmed countdown, not +42 days.
 */
export function nextVersionUpdate(data, nowMs) {
	if (!data.length) return null;
	let lastEntry = data[data.length - 1];
	let prevEntry = data.length > 1 ? data[data.length - 2] : null;
	let lastAnchor = versionLaunchInstant(lastEntry.date);
	let isUpcoming = nowMs < lastAnchor;
	let liveEntry = isUpcoming && prevEntry ? prevEntry : lastEntry;
	let liveAnchorMs = versionLaunchInstant(liveEntry.date);
	let targetMs = isUpcoming ? lastAnchor : liveAnchorMs + LIVE_WINDOW_DAYS * DAY_MS;
	return {
		lastEntry,
		liveEntry,
		isUpcoming,
		isOverdue: !isUpcoming && nowMs > targetMs,
		targetMs,
		liveAnchorMs
	};
}
