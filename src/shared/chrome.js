// Site-wide chrome that every page runs unconditionally: the back-to-top
// button and the header brand's live-status dot. Importing this module for
// its side effects is enough — same as the unconditional calls at the
// bottom of the old shared.js.
import { previewNow, findLastLaunchedEntry, LIVE_WINDOW_DAYS } from "./dates.js";

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
