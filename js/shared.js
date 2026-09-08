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

// Same 21-day cadence as landing.js's PHASE_LENGTH_DAYS (duplicated there
// as a literal rather than calling this — see landing.js). Walks every
// historical phase, so it leans on phase-notes.json's date overrides for
// the known exceptions (1.3's 3-phase structure, 3.0-3.2's compressed
// cadence — see CLAUDE.md).
function getPhaseStartDate(entry, phaseIndex, phaseNotes) {
	let override = (phaseNotes[`${entry.version}-${phaseIndex + 1}`] || {}).date;
	if (override) return override;
	let d = new Date(entry.date + "T00:00:00Z");
	d.setUTCDate(d.getUTCDate() + phaseIndex * 21);
	return d.toISOString().slice(0, 10);
}

// Lightweight stand-in for app.js's characterIndex tracking — that only gets
// built as a side effect of rendering the entire 52-version timeline, which
// neither the landing page nor the calendar page do. Counting appearances
// just through a given point is enough to know Release vs. Rerun N (landing)
// or true-debut-vs-rerun (calendar's debut markers) without needing the full
// index. Only scans banner[] phases, never chronicled/lightrace — both are
// reruns by definition, so they never affect a first-appearance count.
function countAppearancesThrough(data, versionIdx, phaseIdx, character) {
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

function previewNow() {
	return new Date(Date.now() + PREVIEW_TIME_OFFSET_MS);
}

// Generic "swap this container's content with a smooth fade + resize."
// Locks the container's current height as a px value, fades fadeEls out,
// calls renderFn once invisible, measures the new natural height, then
// animates to it while fading back in — CSS can't transition to/from
// `auto`, so height has to be measured/set explicitly on both ends.
//   container — resizes to match the new content. Its own CSS must already
//               include `height` in its `transition` list (each component
//               owns that list, usually combined with other transitions).
//   fadeEls   — elements toggled `.is-fading` during the swap (component
//               CSS defines what that means, e.g. `.trivia-text.is-fading
//               {opacity:0}`). Often just [container]; sometimes specific
//               children (Calendar fades header+content while the panel
//               itself resizes).
//   renderFn  — mutates the DOM to the new state, called once invisible.
//   fadeMs    — wait before swapping (default 200, matching every current
//               caller's own CSS transition duration).
// Respects prefers-reduced-motion — renders instantly, no animation.
function swapWithFade(container, fadeEls, renderFn, fadeMs = 200) {
	if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
		renderFn();
		return;
	}
	let startHeight = container.getBoundingClientRect().height;
	container.style.height = startHeight + "px";
	fadeEls.forEach(el => el.classList.add("is-fading"));
	setTimeout(() => {
		renderFn();
		container.style.height = "auto";
		let endHeight = container.getBoundingClientRect().height;
		container.style.height = startHeight + "px";
		container.offsetHeight; // force reflow so the revert above commits before animating
		container.style.height = endHeight + "px";
		fadeEls.forEach(el => el.classList.remove("is-fading"));
	}, fadeMs);
}

// Sticky pill character search — shared by Timeline's #charSearch and
// Calendar's identical port, since both pages already build their own
// name -> entries index independently (app.js's characterIndex,
// calendar.js's characterAppearances) and just need the same matching/
// ranking/DOM logic driven off whichever one they have.
function highlightMatches(name, strippedQuery) {
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

function searchStrip(s) {
	return s.toLowerCase().replace(/\s+/g, "");
}

// Ranks a character's match into 4 tiers so primary-name matches always
// outrank alias matches: 0 = name starts with query, 1 = name contains it,
// 2 = an alias starts with it, 3 = an alias only contains it. `key` is the
// matched string, used to alphabetize within a tier.
function matchInfo(name, strippedQuery, characterAliases) {
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

// getCharacterNames — () => string[], called fresh on every keystroke so
// each page's own index only needs to exist by the time the user types, not
// by the time this is called. onSelect(name) — what a chosen result does
// (Timeline opens its char panel directly; Calendar pushes it onto its
// panel stack).
function initCharSearch(getCharacterNames, characterAliases, onSelect) {
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

// Flickering sunburst rays behind a release portrait — each ray is a
// separate blade with a randomized angle/delay/duration (baked in as inline
// CSS vars here, so the flicker itself runs on CSS alone with no recurring
// JS). Shared by Timeline's phase cards/character header and Calendar's
// character header (both load glow-config.js for GLOW_CONFIG/the CSS custom
// properties it sets). Calendar's compact day-panel phase cards deliberately
// skip this — see CLAUDE.md — but a single-character header has the room.
function buildRays(count, colorVar) {
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

// The detail panel's character-view header (avatar+rays on the left,
// name+tags on the right) — identical between Timeline's openCharPanel and
// Calendar's renderCharacterPanel, so it's built once here instead of
// twice. Only the header itself: each caller still sets its own content
// background, preexisting note, stats, and appearance list around it,
// since those differ (or don't exist at all) per page. Assumes `header`
// has already been cleared and glow-config.js has already run.
function buildCharacterHeader(header, name, rarity, notes) {
	header.classList.add("is-character");

	let namecardPath = `assets/namecards/${name.replace(/\s/g, "").toLowerCase()}.jpg`;
	header.style.backgroundImage = `linear-gradient(to bottom, rgba(13,13,20,0.45), rgba(13,13,20,0.94)), url(${namecardPath})`;

	let avatarWrap = document.createElement("div");
	avatarWrap.className = "avatar-wrap avatar-wrap-lg";
	avatarWrap.appendChild(buildRays(GLOW_CONFIG.rays.countLg, rarity === "4" ? "var(--four-glow)" : "var(--five-glow)"));
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

function rarityBadge(rarity) {
	return { className: "detail-panel-badge " + (rarity === "5" ? "is-five" : "is-four"), text: rarity === "5" ? "5-Star" : "4-Star" };
}

// Wires click + Enter/Space keydown on `el` to the same zero-arg action —
// the "clickable text that also acts like a button" pattern (e.g. a
// char-appear-row's jumpable version link).
function onActivate(el, action) {
	el.addEventListener("click", action);
	el.addEventListener("keydown", e => {
		if (e.key === "Enter" || e.key === " ") { e.preventDefault(); action(); }
	});
}

// Same pairing, delegated: fires `handler(trigger)` on a click or Enter/
// Space keydown anywhere inside `container` whose target matches `selector`.
function onDelegatedActivate(container, selector, handler) {
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

// Mobile drag-to-dismiss for the detail panel's grabber pill: 1:1 finger
// tracking via inline transform, and a qualifying swipe (>25% of the
// panel's height) calls onDismiss() — always a full close, matching a
// backdrop tap, never a partial action, on both Timeline's single-level
// panel and Calendar's panel stack. A non-qualifying release just lets the
// existing CSS transition snap back into place.
function initPanelGrabberDrag(onDismiss) {
	let grabber = document.getElementById("detailPanelGrabber");
	let panel = document.getElementById("detailPanel");
	let dragging = false;
	let startY = 0;
	let dragDistance = 0;

	grabber.addEventListener("pointerdown", e => {
		dragging = true;
		startY = e.clientY;
		dragDistance = 0;
		panel.style.transition = "none";
		grabber.setPointerCapture(e.pointerId);
	});
	grabber.addEventListener("pointermove", e => {
		if (!dragging) return;
		dragDistance = Math.max(0, e.clientY - startY);
		panel.style.transform = `translateY(${dragDistance}px)`;
	});
	function endGrabberDrag() {
		if (!dragging) return;
		dragging = false;
		let shouldDismiss = dragDistance > panel.offsetHeight * 0.25;
		panel.style.transition = "";
		panel.style.transform = "";
		if (shouldDismiss) onDismiss();
	}
	grabber.addEventListener("pointerup", endGrabberDrag);
	grabber.addEventListener("pointercancel", endGrabberDrag);
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
