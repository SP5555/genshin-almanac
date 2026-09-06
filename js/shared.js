// Shared across any page that renders a character face or a date — moved
// here from app.js once the landing page also needed them, rather than
// duplicating. clocks.js doesn't need these and doesn't use them.
function facePath(character) {
	return `assets/faces/${character.replace(/\s/g, "").toLowerCase()}.png`;
}

function faceImg(character, className) {
	let img = document.createElement("img");
	img.className = className;
	img.src = facePath(character);
	img.alt = character;
	img.loading = "lazy";
	return img;
}

function formatDate(isoDate) {
	let d = new Date(isoDate + "T00:00:00");
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

function previewNow() {
	return new Date(Date.now() + PREVIEW_TIME_OFFSET_MS);
}

function initBackToTop() {
	let btn = document.getElementById("backToTop");
	if (!btn) return;
	let SHOW_AFTER_PX = 250;
	function onScroll() {
		btn.classList.toggle("is-visible", window.scrollY > SHOW_AFTER_PX);
	}
	window.addEventListener("scroll", onScroll, { passive: true });
	onScroll();
	btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

// Same "is the tracked data actually current" rule as the timeline's
// .is-live patch marker (see app.js) — kept here too since the header brand
// dot needs it on both pages. Walking backward past any future-staged entry
// matters here too: same edge case as the live-ripple/update-card fixes.
const LIVE_WINDOW_DAYS = 42;

function findLastLaunchedEntry(data, now) {
	for (let i = data.length - 1; i >= 0; i--) {
		if (new Date(data[i].date + "T00:00:00").getTime() <= now) return data[i];
	}
	return null;
}

async function initBrandLivePulse() {
	let dot = document.getElementById("brandLiveDot");
	if (!dot) return;
	try {
		let res = await fetch("data/data.json");
		if (!res.ok) return;
		let data = await res.json();
		let now = previewNow().getTime();
		let launched = findLastLaunchedEntry(data, now);
		if (!launched) return;
		let daysSince = (now - new Date(launched.date + "T00:00:00").getTime()) / 86400000;
		if (daysSince <= LIVE_WINDOW_DAYS) {
			dot.classList.add("is-live");
			dot.title = `${launched.version} is the current live version`;
		}
	} catch (err) {
		console.error(err);
	}
}

initBackToTop();
initBrandLivePulse();
