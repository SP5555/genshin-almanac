// Site-wide chrome that every page runs unconditionally: the back-to-top
// button and the header brand's live-status dot. Importing this module for
// its side effects is enough — same as the unconditional calls at the
// bottom of the old shared.js.
import { previewNow, findLastLaunchedEntry, LIVE_WINDOW_DAYS, versionLaunchInstant, isLocalDevHost } from "./dates.js";
import { smoothScrollY } from "./scroll.js";

function initBackToTop() {
	let btn = document.getElementById("backToTop");
	if (!btn) return;
	let SHOW_AFTER_PX = 250;
	function onScroll() {
		btn.classList.toggle("is-visible", window.scrollY > SHOW_AFTER_PX);
	}
	window.addEventListener("scroll", onScroll, { passive: true });
	onScroll();
	btn.addEventListener("click", () => smoothScrollY(0));
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
		let daysSince = (now - versionLaunchInstant(launched.date)) / 86400000;
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
preserveFakeDateOnLinks();

// Localhost only: copy ?fakeDate= onto same-origin page links so Timeline
// / Calendar / Clocks / landing keep the same preview. GitHub and hashes
// stay untouched. Production never has a non-zero offset anyway.
function preserveFakeDateOnLinks() {
	if (!isLocalDevHost()) return;
	let fake = new URLSearchParams(location.search).get("fakeDate");
	if (!fake) return;
	function apply(a) {
		let href = a.getAttribute("href");
		if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
		let url;
		try { url = new URL(href, location.href); }
		catch { return; }
		if (url.origin !== location.origin) return;
		url.searchParams.set("fakeDate", fake);
		let file = url.pathname.replace(/^.*\//, "") || "index.html";
		a.setAttribute("href", file + url.search + url.hash);
	}
	document.querySelectorAll("a[href]").forEach(apply);
	document.addEventListener("click", e => {
		let a = e.target.closest("a[href]");
		if (a) apply(a);
	}, true);
}
