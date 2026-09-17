// Date/phase-math helpers shared across pages. No dependencies on any other
// module in this project.

/**
 * A phase's real-world start date, applying phase-notes.json's override for
 * the handful of historically irregular phases (1.3's 3-phase structure,
 * 3.0-3.2's compressed cadence — see CLAUDE.md). Same 21-day cadence as
 * PHASE_LENGTH_DAYS in src/pages/landing/landing.js (duplicated there as a
 * literal rather than importing this, since that constant also drives
 * unrelated landing-only math).
 * @param {{version: string, date: string}} entry - a data.json version entry
 * @param {number} phaseIndex - 0-based phase index within entry.banner
 * @param {Object<string, {date?: string}>} phaseNotes - phase-notes.json
 * @returns {string} ISO date (YYYY-MM-DD)
 */
export function getPhaseStartDate(entry, phaseIndex, phaseNotes) {
	let override = (phaseNotes[`${entry.version}-${phaseIndex + 1}`] || {}).date;
	if (override) return override;
	let d = new Date(entry.date + "T00:00:00Z");
	d.setUTCDate(d.getUTCDate() + phaseIndex * 21);
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
// unaffected and shouldn't use this. Per-URL only, not persisted — the
// param has to be on whatever page you're actually testing.
const PREVIEW_TIME_OFFSET_MS = (() => {
	let isLocalDev = location.hostname === "localhost" || location.hostname === "127.0.0.1";
	if (!isLocalDev) return 0;
	let fakeDate = new URLSearchParams(location.search).get("fakeDate");
	if (!fakeDate) return 0;
	let parsed = new Date(fakeDate);
	return isNaN(parsed.getTime()) ? 0 : parsed.getTime() - Date.now();
})();

/** @returns {Date} */
export function previewNow() {
	return new Date(Date.now() + PREVIEW_TIME_OFFSET_MS);
}

// Same "is the tracked data actually current" rule the timeline's .is-live
// patch marker and the header brand dot both need.
export const LIVE_WINDOW_DAYS = 42;

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
		if (new Date(data[i].date + "T00:00:00").getTime() <= now) return data[i];
	}
	return null;
}
