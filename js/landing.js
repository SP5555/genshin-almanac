// Phase length confirmed at 21 days (not a round 20) via cross-checked
// sources — see CLAUDE.md. Only reliable for the live version's normal
// 2-phase, ~42-day cycle; historical irregular-length versions (delays,
// shortened recovery patches, 3-phase versions) aren't handled here, since
// this only ever needs to be right for whichever version is currently live.
const PHASE_LENGTH_DAYS = 21;

function getCurrentPhaseIndex(entry, now) {
	let phases = entry.banner;
	if (phases.length <= 1) return 0;
	let start = new Date(entry.date + "T00:00:00Z").getTime();
	let daysSince = Math.max(0, (now - start) / 86400000);
	return Math.min(Math.floor(daysSince / PHASE_LENGTH_DAYS), phases.length - 1);
}

// Lightweight stand-in for app.js's characterIndex tracking — that only
// gets built as a side effect of rendering the entire 52-version timeline
// (see CLAUDE.md's "Decouple building characterIndex..." note), which this
// page doesn't do. Counting appearances just through the current point is
// enough to know Release vs. Rerun N for the handful of characters shown here.
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

// Same hex values baked into assets/elements/*.svg (HoYoverse's own element
// colors), reused here so the banner glow / 4-star badges match the element
// icon exactly instead of an approximated palette.
const ELEMENT_COLORS = {
	Anemo:   { c: "#32D7A0", glow: "rgba(50,215,160,0.45)" },
	Cryo:    { c: "#80FFFF", glow: "rgba(128,255,255,0.45)" },
	Dendro:  { c: "#90CC00", glow: "rgba(144,204,0,0.45)" },
	Electro: { c: "#CC80FF", glow: "rgba(204,128,255,0.45)" },
	Geo:     { c: "#FFAC00", glow: "rgba(255,172,0,0.45)" },
	Hydro:   { c: "#00C0FF", glow: "rgba(0,192,255,0.45)" },
	Pyro:    { c: "#FF6640", glow: "rgba(255,102,64,0.45)" },
};

// The actual in-game wish-reveal splash art — dynamic action pose, dramatic
// effects, genuine transparent-alpha cutout (confirmed via ffprobe:
// yuva420p) — e.g. "assets/splash/arlecchino.webp", sourced from the
// Genshin Fandom wiki (File:<Name>_Wish.png; served as WebP despite the
// .png-looking URL, same as the Server Clocks background). Genuinely
// uniform across characters — every one checked (7+, including 4-stars) is
// exactly 2048x1024, since this is HoYoverse's own fixed-size UI template,
// not just similar-looking promotional art. Two other Fandom assets were
// tried and rejected first: File:<Name> Card.png bakes the gacha-pull card
// frame/logo into the image itself (not croppable away), and
// File:Character <Name> Game.png / Full Wish.png are real splash art but
// not uniformly sized. Same filename convention as faces/namecards
// (lowercase, spaces stripped). Only downloaded for characters actually
// featured on the landing page so far — see CLAUDE.md's art provenance
// section for the sourcing method and which characters are covered.
function splashPath(character) {
	return `assets/splash/${character.replace(/\s/g, "").toLowerCase()}.webp`;
}

function buildSpotlightFigure(character, data, versionIdx, phaseIdx, notes) {
	let charNotes = notes[character] || {};
	let count = countAppearancesThrough(data, versionIdx, phaseIdx, character);

	let figure = document.createElement("div");
	figure.className = "spotlight-figure";

	let img = document.createElement("img");
	img.className = "spotlight-figure-img";
	img.src = splashPath(character);
	img.alt = character;
	img.loading = "lazy";
	// Otherwise the browser's native "drag to save image" gesture hijacks the
	// carousel's own pointer-drag sequence, firing pointercancel instead of
	// pointerup partway through.
	img.draggable = false;
	// Not every featured character has splash art downloaded yet — fall back
	// to the square face icon (already sourced for all of them) rather than
	// showing a broken image.
	img.onerror = () => { img.onerror = null; img.src = facePath(character); img.classList.add("is-fallback"); };
	figure.appendChild(img);

	let label = document.createElement("div");
	label.className = "spotlight-figure-label";
	let name = document.createElement("span");
	name.className = "spotlight-figure-name";
	name.textContent = character;
	label.appendChild(name);
	let tags = document.createElement("div");
	tags.className = "spotlight-figure-tags";
	if (!charNotes.preexisting) {
		let tag = document.createElement("span");
		tag.className = "rerun-tag" + (count === 1 ? " is-first" : "");
		tag.textContent = count === 1 ? "Release" : `Rerun ${count - 1}`;
		tags.appendChild(tag);
	}
	if (charNotes.rateDown) {
		let poolTag = document.createElement("span");
		poolTag.className = "rate-down-tag";
		poolTag.textContent = "Rate-down";
		tags.appendChild(poolTag);
	}
	label.appendChild(tags);
	figure.appendChild(label);
	return figure;
}

const CAROUSEL_INTERVAL_MS = 5000;
const CAROUSEL_SETTLE_MS = 320;
const CAROUSEL_MAX_BLUR_PX = 10;
// How dark an off-center slot gets at dist >= 1 — a literal "spotlight
// swinging away" dim, layered on top of the existing blur/fade/opacity.
const CAROUSEL_MIN_BRIGHTNESS = 0.1;
// position-units are "how many carousel widths of drag" — 1.0 = exactly one
// full slide over. Velocity below FLING_MIN is treated as a plain release
// (snap immediately); above it, momentum keeps going and decays by
// FRICTION_PER_MS every millisecond until it drops below MOMENTUM_STOP.
const CAROUSEL_FLING_MIN_VELOCITY = 0.0006;
const CAROUSEL_MOMENTUM_STOP_VELOCITY = 0.00006;
const CAROUSEL_FRICTION_PER_MS = 0.9955;
// Only pointer samples from within this many ms of "now" count toward the
// release-velocity estimate — see the pointermove/endDrag handlers below.
const CAROUSEL_VELOCITY_WINDOW_MS = 100;

// One shared card instead of two separate posters, so both 5-stars read as
// belonging to the same banner rather than two disconnected boxes. Only one
// character shows at a time (carousel, dot nav below) — with two figures
// competing for the same width, showing one at a time is what lets it
// render bigger. The glow wash and corner watermark crossfade to track
// whichever character is currently nearest center, not both at once — see
// applyActiveElement() below.
function buildSpotlightBanner(fiveStars, data, versionIdx, phaseIdx, notes, elements) {
	let banner = document.createElement("div");
	banner.className = "spotlight-banner";

	// Two-layer A/B crossfade for both the glow wash and the corner
	// watermark — same technique as #regionBgA/#regionBgB in app.js's
	// setRegionBackground(): write the new value to whichever layer is
	// currently inactive, toggle is-active on both, let the CSS opacity
	// transition handle the rest. A plain custom property swap can't be
	// smoothly transitioned by the browser on its own, which is what made
	// the old single-layer version snap instantly.
	let glowA = document.createElement("div");
	glowA.className = "spotlight-banner-glow";
	let glowB = document.createElement("div");
	glowB.className = "spotlight-banner-glow";
	banner.append(glowA, glowB);

	// One A/B pair per icon POSITION — exploring top-left + bottom-right
	// right now (see the conversation), so each pair gets its own position
	// modifier class but all pairs always show the same element in lockstep.
	let makeIconPair = extraClass => {
		let a = document.createElement("div");
		a.className = "spotlight-banner-icon" + (extraClass ? " " + extraClass : "");
		let b = document.createElement("div");
		b.className = "spotlight-banner-icon" + (extraClass ? " " + extraClass : "");
		banner.append(a, b);
		return { a, b };
	};
	let iconPairs = [makeIconPair(), makeIconPair("is-bottom-right")];

	let activeLayer = "A";
	let currentElementChar = null;
	let applyActiveElement = character => {
		// render() calls this on every single frame during a drag or
		// momentum coast, not just when baseIndex actually changes — without
		// this guard, every one of those frames would re-toggle the A/B
		// layers, restarting (and so interrupting) the opacity transition
		// before it ever gets to finish, which is what made it look like an
		// instant snap while dragging even though the auto-timer's
		// once-per-settle calls faded smoothly.
		if (character === currentElementChar) return;
		currentElementChar = character;
		let element = elements[character];
		let colors = ELEMENT_COLORS[element];
		if (!colors) return;
		let nextGlow = activeLayer === "A" ? glowB : glowA;
		let prevGlow = activeLayer === "A" ? glowA : glowB;
		nextGlow.style.background = `radial-gradient(circle at 30% 20%, ${colors.glow} 0%, transparent 60%)`;
		nextGlow.classList.add("is-active");
		prevGlow.classList.remove("is-active");

		iconPairs.forEach(pair => {
			let nextIcon = activeLayer === "A" ? pair.b : pair.a;
			let prevIcon = activeLayer === "A" ? pair.a : pair.b;
			nextIcon.style.backgroundImage = `url(assets/elements/${element.toLowerCase()}.svg)`;
			nextIcon.classList.add("is-active");
			prevIcon.classList.remove("is-active");
		});

		activeLayer = activeLayer === "A" ? "B" : "A";
	};
	applyActiveElement(fiveStars[0]);

	let carousel = document.createElement("div");
	carousel.className = "spotlight-carousel";
	banner.appendChild(carousel);

	if (fiveStars.length === 1) {
		carousel.appendChild(buildSpotlightFigure(fiveStars[0], data, versionIdx, phaseIdx, notes));
		return banner;
	}
	carousel.classList.add("is-interactive");

	let n = fiveStars.length;
	let normalize = i => ((i % n) + n) % n;

	let dots = document.createElement("div");
	dots.className = "spotlight-dots";
	let dotEls = fiveStars.map((character, i) => {
		let dot = document.createElement("button");
		dot.type = "button";
		dot.className = "spotlight-dot" + (i === 0 ? " is-active" : "");
		dot.setAttribute("aria-label", `Show ${character}`);
		dots.appendChild(dot);
		return dot;
	});
	banner.appendChild(dots);

	// Three FIXED-ROLE slots — prev(-1), center(0), next(+1) — each a real,
	// independent DOM element, rather than one element per character. With
	// only 2 characters, the "other" one needs two separate on-screen
	// instances (one resting on each side), so reversing direction mid-drag
	// just means the OTHER instance starts sliding in — no single shared
	// element ever has to jump from one side to the other. A slot's content
	// only gets reassigned in resolveRotation() below, at the exact moment
	// it's the farthest slot and therefore guaranteed fully hidden — never
	// mid-transition.
	let slots = [-1, 0, 1].map(offset => {
		let el = document.createElement("div");
		el.className = "spotlight-figure";
		carousel.appendChild(el);
		return { offset, el, character: undefined };
	});
	let baseIndex = 0;
	// Continuous drag/settle offset, relative to baseIndex — kept within
	// roughly [-1, 1] at all times by resolveRotation(), never allowed to
	// drift to large magnitudes the way a single global position did before.
	let position = 0;
	// One shared rAF handle for whichever animation loop is currently
	// driving `position` — momentum coast or a settle sweep. The two are
	// mutually exclusive by construction (starting either one stops both
	// first), so there's never a reason to track them separately.
	let animationRAF = null;
	let advanceTimer = null;

	let assign = slot => {
		let character = fiveStars[normalize(baseIndex + slot.offset)];
		if (slot.character === character) return;
		slot.character = character;
		let fresh = buildSpotlightFigure(character, data, versionIdx, phaseIdx, notes);
		slot.el.replaceChildren(...fresh.childNodes);
	};
	slots.forEach(assign);

	let getSlotPx = () => carousel.getBoundingClientRect().width || 1;
	let render = () => {
		slots.forEach(slot => {
			let diff = slot.offset - position;
			let dist = Math.abs(diff);
			// Reaches full dim by dist 0.5, not 1 — matching opacity's falloff
			// meant it only got noticeably darker right as it was already
			// nearly invisible from fading out. Ramping twice as fast makes
			// the dim itself the visible part of the transition.
			let brightness = 1 - Math.min(1, dist * 2) * (1 - CAROUSEL_MIN_BRIGHTNESS);
			slot.el.style.transform = `translateX(${diff * getSlotPx()}px)`;
			slot.el.style.opacity = String(Math.max(0, 1 - dist));
			slot.el.style.filter = `blur(${Math.min(CAROUSEL_MAX_BLUR_PX, dist * CAROUSEL_MAX_BLUR_PX * 1.4)}px) brightness(${brightness})`;
			slot.el.classList.toggle("is-active", slot.offset === 0);
		});
		dotEls.forEach((d, i) => d.classList.toggle("is-active", i === baseIndex));
		applyActiveElement(fiveStars[baseIndex]);
	};

	// Whenever `position` has drifted a full step away from baseIndex,
	// rotate roles instead of re-deriving each slot's side from scratch.
	// Recycles whichever slot is CURRENTLY farthest (always safely
	// invisible — dist >= 1.5 at the moment this triggers, since it only
	// fires once position crosses ±0.5) into the newly-needed role and
	// gives it fresh content. The other two slots just get relabeled: same
	// DOM element, same continuous transform, no jump, no content swap.
	let resolveRotation = () => {
		while (Math.round(position) !== 0) {
			let step = position > 0 ? 1 : -1;
			baseIndex = normalize(baseIndex + step);
			position -= step;
			if (step > 0) slots.push(slots.shift());
			else slots.unshift(slots.pop());
			slots.forEach((slot, i) => { slot.offset = i - 1; });
			slots.forEach(assign);
		}
	};

	let stopAnimation = () => {
		if (animationRAF !== null) cancelAnimationFrame(animationRAF);
		animationRAF = null;
	};
	// The one clean eased move to an exact resting position — always a
	// continuous JS-driven sweep (position updated as a per-frame delta,
	// same incremental pattern the drag/momentum code already uses, which
	// composes correctly with resolveRotation()), never a CSS transition.
	// A CSS transition only animates cleanly toward ONE target; an earlier
	// version used one for single-character moves and chained several for
	// multi-character jumps — technically correct (every character got
	// painted) but each chained hop eased to a dead stop before the next
	// one re-accelerated from rest, reading as a stutter at every character
	// passed through. One continuous eased curve across the full distance,
	// used for every case including a plain 1-character or drift-only
	// move, has no such seams.
	// `steps` is how many characters forward (or back, if negative) to
	// move from wherever we currently are; 0 just corrects any leftover
	// drag/momentum drift back to whichever character is already nearest
	// (used for a plain drag release with no fling).
	let settle = (steps = 0) => {
		stopAnimation();
		let start = position;
		let distance = Math.round(position) + steps - start;
		if (distance === 0) { resolveRotation(); render(); return; }
		let duration = CAROUSEL_SETTLE_MS * (0.5 + Math.abs(steps) * 0.5);
		let startTime = performance.now();
		let prevEased = 0;
		let frame = now => {
			let t = Math.min(1, (now - startTime) / duration);
			let eased = 1 - Math.pow(1 - t, 3);
			position += (eased - prevEased) * distance;
			prevEased = eased;
			resolveRotation();
			render();
			animationRAF = t < 1 ? requestAnimationFrame(frame) : null;
		};
		animationRAF = requestAnimationFrame(frame);
	};
	// Shortest signed step count from baseIndex to targetIndex, so a dot
	// click always takes the short way around instead of spinning through
	// every character in between.
	let goTo = targetIndex => {
		let raw = normalize(targetIndex - baseIndex);
		settle(raw > n / 2 ? raw - n : raw);
	};

	let startAutoAdvance = () => {
		// Idempotent, not just paired with stopAutoAdvance — mouseleave and
		// endDrag can each independently decide "we should be running now"
		// without knowing the other already started a timer, so this has to
		// self-correct rather than assume exactly one is active.
		clearInterval(advanceTimer);
		advanceTimer = setInterval(() => settle(1), CAROUSEL_INTERVAL_MS);
	};
	let stopAutoAdvance = () => clearInterval(advanceTimer);

	dotEls.forEach((dot, i) => dot.addEventListener("click", () => {
		stopAutoAdvance();
		goTo(i);
		startAutoAdvance();
	}));
	// Pause on hover so a reader mid-look at one character doesn't have it
	// swapped out from under them.
	banner.addEventListener("mouseenter", stopAutoAdvance);
	banner.addEventListener("mouseleave", startAutoAdvance);

	let runMomentum = velocity => {
		let last = performance.now();
		let step = now => {
			let dt = now - last;
			last = now;
			position += velocity * dt;
			velocity *= Math.pow(CAROUSEL_FRICTION_PER_MS, dt);
			resolveRotation();
			render();
			if (Math.abs(velocity) > CAROUSEL_MOMENTUM_STOP_VELOCITY) {
				animationRAF = requestAnimationFrame(step);
			} else {
				animationRAF = null;
				settle();
				startAutoAdvance();
			}
		};
		animationRAF = requestAnimationFrame(step);
	};

	// Pointer Events (not separate touch/mouse handlers) drive both
	// touch-swipe and mouse-drag from the same code — same convention as the
	// mobile char-panel drag-to-dismiss in app.js. touch-action:pan-y in CSS
	// keeps vertical page scroll native while this handles the horizontal
	// gesture itself.
	let dragging = false;
	let lastPointerX = 0;
	let velocityHistory = [];
	// A stale sample (pointer held still before something reads the
	// history, so no pointermove refreshed it) shouldn't count toward a
	// velocity estimate — used by both pointermove (to bound the array's
	// growth) and endDrag (to size up the release velocity).
	let pruneVelocityHistory = now => {
		while (velocityHistory.length > 1 && now - velocityHistory[0].t > CAROUSEL_VELOCITY_WINDOW_MS) velocityHistory.shift();
	};

	carousel.addEventListener("pointerdown", e => {
		stopAutoAdvance();
		stopAnimation();
		carousel.classList.add("is-dragging");
		// Capture so pointermove/pointerup still fire on this element even if
		// the drag continues outside the carousel's bounds.
		carousel.setPointerCapture(e.pointerId);
		dragging = true;
		lastPointerX = e.clientX;
		velocityHistory = [{ x: e.clientX, t: performance.now() }];
	});
	carousel.addEventListener("pointermove", e => {
		if (!dragging) return;
		// 1:1 tracking: dragging by dx px moves the active figure by exactly
		// dx px, since dx/slotPx position-units * slotPx px = dx.
		let dx = e.clientX - lastPointerX;
		lastPointerX = e.clientX;
		position -= dx / getSlotPx();
		resolveRotation();
		render();
		let now = performance.now();
		velocityHistory.push({ x: e.clientX, t: now });
		// Time-windowed, not just capped at N samples — a fast drag that then
		// pauses before release would otherwise leave only old, fast-motion
		// samples in the array with nothing newer to push them out, so
		// release velocity would still read as fast even though the pointer
		// had already stopped moving.
		pruneVelocityHistory(now);
	});
	let endDrag = () => {
		if (!dragging) return;
		dragging = false;
		carousel.classList.remove("is-dragging");

		let now = performance.now();
		pruneVelocityHistory(now);
		let velocity = 0;
		// A stale last sample (pointer held still before release, so no
		// pointermove refreshed it) means there's no recent motion to
		// measure — treat that as a plain release, not a fling.
		let stillFresh = velocityHistory.length >= 2 && now - velocityHistory[velocityHistory.length - 1].t < CAROUSEL_VELOCITY_WINDOW_MS;
		if (stillFresh) {
			let first = velocityHistory[0];
			let last = velocityHistory[velocityHistory.length - 1];
			let dt = last.t - first.t;
			// px/ms -> position-units/ms, sign matches the drag convention
			// used in pointermove above.
			if (dt > 0) velocity = -((last.x - first.x) / dt) / getSlotPx();
		}
		if (Math.abs(velocity) > CAROUSEL_FLING_MIN_VELOCITY) {
			runMomentum(velocity);
		} else {
			settle();
			startAutoAdvance();
		}
	};
	carousel.addEventListener("pointerup", endDrag);
	carousel.addEventListener("pointercancel", endDrag);

	render();
	// This first render happens before `banner` is attached to the document
	// (the caller inserts it after this function returns), so getSlotPx()
	// falls back to 1px here instead of the real width — invisible for now
	// since inactive slots are opacity:0 regardless, but it leaves their
	// resting transform at the wrong pixel value. Re-render once actually
	// attached so the very first interaction animates in from the correct
	// off-to-the-side position instead of fading in place.
	requestAnimationFrame(render);
	startAutoAdvance();

	return banner;
}

// Small "trading card" per 4-star — face icon, faint element-symbol
// watermark, name — instead of a bare row of icons, so the supporting cast
// gets the same card language as the 5-star banner rather than reading as
// an afterthought. Watermark is a dedicated ::before layer (see
// .spotlight-fourcard-element in landing.css) with real CSS opacity, not a
// dark gradient stacked over the SVG — a color overlay darkens the icon
// toward black instead of genuinely fading it.
function buildSpotlightFourCard(character, data, versionIdx, phaseIdx, notes, elements) {
	let charNotes = notes[character] || {};
	let count = countAppearancesThrough(data, versionIdx, phaseIdx, character);
	let isRelease = !charNotes.preexisting && count === 1;
	let element = elements[character];
	let colors = ELEMENT_COLORS[element];

	let card = document.createElement("div");
	card.className = "spotlight-fourcard" + (isRelease ? " is-release" : "");
	if (colors) {
		card.style.setProperty("--el", colors.c);
		card.style.setProperty("--el-glow", colors.glow);
	}
	if (element) {
		// Relative to css/landing.css, not the page — a url() inside a custom
		// property resolves against the stylesheet that consumes it via var(),
		// not the document, so a document-relative path here 404s silently.
		card.style.setProperty("--el-icon", `url(../assets/elements/${element.toLowerCase()}.svg)`);
	}

	let avatarWrap = document.createElement("div");
	avatarWrap.className = "spotlight-fourcard-avatar-wrap";
	avatarWrap.appendChild(faceImg(character, "spotlight-fourcard-face"));
	card.appendChild(avatarWrap);

	let name = document.createElement("span");
	name.className = "spotlight-fourcard-name" + (isRelease ? " is-release" : "");
	name.textContent = character;
	card.appendChild(name);

	return card;
}

function buildSpotlight(data, versionIdx, phaseIdx, notes, elements) {
	let entry = data[versionIdx];
	let phase = entry.banner[phaseIdx];
	let frag = document.createDocumentFragment();

	let isRelease = character => {
		let charNotes = notes[character] || {};
		return !charNotes.preexisting && countAppearancesThrough(data, versionIdx, phaseIdx, character) === 1;
	};
	// A debut character leads the banner. Stable sort means two reruns (or
	// two debuts) keep data.json's original order — this only ever reorders
	// when exactly one side is a genuine release.
	let fiveStars = [...phase["5"]].sort((a, b) => Number(isRelease(b)) - Number(isRelease(a)));

	frag.appendChild(buildSpotlightBanner(fiveStars, data, versionIdx, phaseIdx, notes, elements));

	if (phase["4"].length > 0) {
		let fourRow = document.createElement("div");
		fourRow.className = "spotlight-fourcards";
		phase["4"].forEach(character => {
			fourRow.appendChild(buildSpotlightFourCard(character, data, versionIdx, phaseIdx, notes, elements));
		});
		frag.appendChild(fourRow);
	}

	return frag;
}

async function bootstrapLanding() {
	try {
		let [dataRes, notesRes, versionRes, elementsRes] = await Promise.all([
			fetch("data/data.json"),
			fetch("data/character-notes.json"),
			fetch("data/version-notes.json"),
			fetch("data/character-elements.json"),
		]);
		if (!dataRes.ok) throw new Error(`Failed to load data.json: ${dataRes.status}`);
		if (!notesRes.ok) throw new Error(`Failed to load character-notes.json: ${notesRes.status}`);
		if (!versionRes.ok) throw new Error(`Failed to load version-notes.json: ${versionRes.status}`);
		if (!elementsRes.ok) throw new Error(`Failed to load character-elements.json: ${elementsRes.status}`);
		let data = await dataRes.json();
		let notes = await notesRes.json();
		let versionMeta = await versionRes.json();
		let elements = await elementsRes.json();

		let versionIdx = data.length - 1;
		let entry = data[versionIdx];
		let phaseIdx = getCurrentPhaseIndex(entry, Date.now());

		document.getElementById("spotlightHeading").textContent = `Version ${entry.version} — Phase ${phaseIdx + 1}`;
		document.getElementById("spotlightSub").textContent = `Live since ${formatDate(entry.date)}`;
		document.getElementById("spotlightCard").replaceWith(buildSpotlight(data, versionIdx, phaseIdx, notes, elements));

		// Same background recipe as the Timeline's per-version region art (see
		// setRegionBackground() in app.js) — always the *current* region rather
		// than a hardcoded image, so this doesn't go stale the moment a new
		// region drops.
		let major = entry.version.split(".")[0];
		let meta = versionMeta[major];
		if (meta && meta.bgImage) {
			document.getElementById("landingBg").style.backgroundImage =
				`linear-gradient(rgba(7,7,12,0.78), rgba(7,7,12,0.9)), url(assets/regions/${meta.bgImage}.jpg)`;
		}
	} catch (err) {
		console.error(err);
		document.getElementById("spotlightCard").textContent = "Couldn't load the current banner.";
	}
}

bootstrapLanding();
