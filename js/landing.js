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

	// See .spotlight-figure-img-wrap in landing.css for why this wrapper
	// exists — it reserves the height, the <img> inside bleeds past its
	// sides on purpose instead of being cropped to fit.
	let imgWrap = document.createElement("div");
	imgWrap.className = "spotlight-figure-img-wrap";
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
	imgWrap.appendChild(img);
	figure.appendChild(imgWrap);

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
const CAROUSEL_SETTLE_MS = 1000;
// How dark an off-center slot gets at dist >= 1 — a literal "spotlight
// swinging away" dim, layered on top of the existing fade/tilt.
const CAROUSEL_MIN_BRIGHTNESS = 0.1;
// Max 3D tilt (deg) a slot reaches, pivoting around its own center (see
// .spotlight-carousel's `perspective` in landing.css) — a card turning away
// in real depth rather than just sliding flat.
const CAROUSEL_MAX_TILT_DEG = 38;
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
			// Same "reach full effect by dist 0.4, not 1" fix as brightness
			// above, for the same reason — ramping the tilt all the way to
			// dist 1 meant it only got visibly large right as opacity had
			// already faded the card out, so it never read as depth. The
			// resting (fully off-center) card is invisible either way, so
			// front-loading this doesn't cost anything there.
			let tiltFraction = Math.max(-1, Math.min(1, diff / 0.4));
			let tilt = tiltFraction * CAROUSEL_MAX_TILT_DEG;
			slot.el.style.transform = `translateX(${diff * getSlotPx()}px) rotateY(${-tilt}deg)`;
			slot.el.style.opacity = String(Math.max(0, 1 - dist));
			slot.el.style.filter = `brightness(${brightness})`;
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
			// Ease-in-out cubic, not ease-out-only — the old curve snapped to
			// full speed instantly and only decelerated into the stop, which
			// reads as an abrupt kick at the very start of every auto-advance/
			// dot-click/drag-correction move. Symmetric slow-start,
			// fast-middle, slow-stop feels calmer for a move nothing prompted
			// (mid cubic-bezier "ease-in-out" territory).
			let eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
	let element = elements[character];
	let colors = ELEMENT_COLORS[element];

	let card = document.createElement("div");
	card.className = "spotlight-fourcard";
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

	// Same splash art + fallback pattern as buildSpotlightFigure() — not
	// every future 4-star will have art downloaded immediately, so this
	// must degrade to the face icon rather than show a broken image.
	let imgWrap = document.createElement("div");
	imgWrap.className = "spotlight-fourcard-img-wrap";
	let img = document.createElement("img");
	img.className = "spotlight-fourcard-img";
	img.src = splashPath(character);
	img.alt = character;
	img.loading = "lazy";
	img.onerror = () => { img.onerror = null; img.src = facePath(character); img.classList.add("is-fallback"); };
	imgWrap.appendChild(img);
	card.appendChild(imgWrap);

	let label = document.createElement("div");
	label.className = "spotlight-fourcard-label";
	let name = document.createElement("span");
	name.className = "spotlight-fourcard-name";
	name.textContent = character;
	label.appendChild(name);
	// Same tag mechanism as the 5-star figures (rerun-tag/is-first), rather
	// than the old grayscale-filter + colored-ring distinction — one
	// convention for "is this a release or a rerun" instead of two.
	if (!charNotes.preexisting) {
		let tag = document.createElement("span");
		tag.className = "rerun-tag" + (count === 1 ? " is-first" : "");
		tag.textContent = count === 1 ? "Release" : `Rerun ${count - 1}`;
		label.appendChild(tag);
	}
	card.appendChild(label);

	return card;
}

const TRIVIA_INTERVAL_MS = 6000;

function formatMonthDayYear(dateStr) {
	return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Oxford-comma join for a short name list: "A", "A and B", "A, B, and C".
function joinNames(names) {
	if (names.length === 1) return names[0];
	if (names.length === 2) return `${names[0]} and ${names[1]}`;
	return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

// 5-stars first, then 4-stars — both rarities debut here (reads more
// immersive than headlining only the 5-star), but 5-star debuts are still
// the more headline-worthy fact so they lead the list rather than being
// interleaved in banner order. Plenty of versions still won't have any
// debut at all (pure-rerun phases), which is fine — callers just omit the
// clause rather than force an empty/awkward one.
// Chronicled banners are deliberately not scanned here — by definition
// they only ever bring back characters from an already-released region,
// so they can never contain a genuine debut.
function getDebuts(data, versionIdx, notes) {
	let phases = data[versionIdx].banner;
	let seen = new Set();
	let fiveDebuts = [];
	let fourDebuts = [];
	for (let rarity of ["5", "4"]) {
		let bucket = rarity === "5" ? fiveDebuts : fourDebuts;
		for (let phase of phases) {
			for (let name of phase[rarity]) {
				if (seen.has(name)) continue;
				seen.add(name);
				// preexisting characters (the 1.0 launch roster) technically have a
				// "first tracked appearance" too, but it isn't a real debut — same
				// distinction the Release/Rerun tags already make.
				if ((notes[name] || {}).preexisting) continue;
				if (countAppearancesThrough(data, versionIdx, phases.length - 1, name) === 1) {
					bucket.push(name);
				}
			}
		}
	}
	return [...fiveDebuts, ...fourDebuts];
}

// data.json only has ~52 launch dates spread across 365 possible days, so a
// strict "exact date match" would be empty on ~86% of days (checked against
// the real data). Instead this always surfaces the nearest anniversary —
// past and future — falling back to a real "on this day" card on the rare
// day one lands exactly (e.g. 1.0 and 3.1 both launched on Sep 28, in
// different years).
function getAnniversaryCards(data, versionMeta, notes, now) {
	let year = now.getFullYear();
	// Normalized to local midnight — thisCycle is always midnight too, so
	// diffing against the raw now() (with its time-of-day) would round the
	// day count up or down depending on what time it is when the page loads.
	let today = new Date(year, now.getMonth(), now.getDate());
	let best = { past: null, future: null };
	for (let entry of data) {
		let launch = new Date(entry.date + "T00:00:00");
		let thisCycle = new Date(year, launch.getMonth(), launch.getDate());
		let diffDays = Math.round((thisCycle - today) / 86400000);
		// A version that itself launched earlier this same year has no real
		// anniversary yet — "N days ago" would just be describing its actual
		// original launch, and "0 years since" reads as nonsense. Skip it from
		// the day-count buckets and let the search fall through to the next
		// real (>=1 year) anniversary instead. The diffDays===0 case below is
		// exempt — a version launching exactly today is a genuine "on this
		// day" moment, not an anniversary, so that one's fine as-is.
		if (diffDays !== 0 && launch.getFullYear() === year) continue;
		if (diffDays <= 0) {
			// Ties (two versions sharing a month-day) break toward whichever
			// real occurrence is chronologically closest to now.
			if (!best.past || diffDays > best.past.diffDays ||
				(diffDays === best.past.diffDays && Math.abs(year - launch.getFullYear()) < Math.abs(year - best.past.launch.getFullYear()))) {
				best.past = { entry, launch, diffDays };
			}
		} else {
			if (!best.future || diffDays < best.future.diffDays ||
				(diffDays === best.future.diffDays && Math.abs(year - launch.getFullYear()) < Math.abs(year - best.future.launch.getFullYear()))) {
				best.future = { entry, launch, diffDays };
			}
		}
	}

	let region = entry => (versionMeta[entry.version.split(".")[0]] || {}).region || "";

	if (best.past && best.past.diffDays === 0) {
		let { entry, launch } = best.past;
		return [`On this day in ${launch.getFullYear()}, version ${entry.version} (${region(entry)}) launched!`];
	}

	// Guaranteed >=1 by the same-year skip above, so no "0 years" case to
	// guard against here.
	let yearsSince = launch => year - launch.getFullYear();

	// Appended only when the version actually had one — most versions are
	// pure reruns of existing characters, so forcing this clause in every
	// card would mean either an empty "introducing" or a misleading one.
	let debutClause = entry => {
		let debuts = getDebuts(data, data.indexOf(entry), notes);
		return debuts.length ? `, introducing ${joinNames(debuts)}` : "";
	};

	let cards = [];
	if (best.past) {
		let { entry, diffDays, launch } = best.past;
		let daysAgo = -diffDays;
		let years = yearsSince(launch);
		cards.push(`${daysAgo} day${daysAgo === 1 ? "" : "s"} ago — version ${entry.version} (${region(entry)}) marked ${years} year${years === 1 ? "" : "s"} since its ${formatMonthDayYear(entry.date)} launch${debutClause(entry)}.`);
	}
	if (best.future) {
		let { entry, diffDays, launch } = best.future;
		let years = yearsSince(launch);
		cards.push(`Coming up in ${diffDays} day${diffDays === 1 ? "" : "s"} — version ${entry.version} (${region(entry)}) will mark ${years} year${years === 1 ? "" : "s"} since its ${formatMonthDayYear(entry.date)} launch${debutClause(entry)}.`);
	}
	return cards;
}

function shuffle(arr) {
	let result = arr.slice();
	for (let i = result.length - 1; i > 0; i--) {
		let j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

function sampleTrivia(pool, n) {
	return shuffle(pool).slice(0, n);
}

function buildTriviaTicker(cards) {
	let wrap = document.createElement("div");
	wrap.className = "trivia-ticker";

	let textEl = document.createElement("p");
	textEl.className = "trivia-text";
	textEl.setAttribute("aria-live", "polite");

	let dots = document.createElement("div");
	dots.className = "trivia-dots";
	let dotEls = cards.map((_, i) => {
		let dot = document.createElement("button");
		dot.type = "button";
		dot.className = "trivia-dot" + (i === 0 ? " is-active" : "");
		dot.setAttribute("aria-label", `Show fact ${i + 1}`);
		dots.appendChild(dot);
		return dot;
	});

	// No point animating a countdown for a state that never advances — also
	// keeps the bar from implying auto-advance is happening when reduced
	// motion has actually turned it off.
	let autoAdvanceEnabled = cards.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	let activeIndex = 0;

	let progress = null;
	let progressFill = null;
	if (autoAdvanceEnabled) {
		progress = document.createElement("div");
		progress.className = "trivia-progress";
		progressFill = document.createElement("div");
		progressFill.className = "trivia-progress-fill";
		progressFill.style.animationDuration = TRIVIA_INTERVAL_MS + "ms";
		// The progress bar's own CSS animation *is* the auto-advance timer —
		// advancing exactly when it visually finishes, rather than tracking
		// elapsed/remaining time by hand in JS. That also makes pausing
		// trivially correct: animation-play-state:paused (toggled by
		// setPaused() below) is a real browser-native pause/resume, so the
		// bar and the actual advance timing can never disagree.
		progressFill.addEventListener("animationend", () => goTo(activeIndex + 1));
		progress.appendChild(progressFill);
	}

	function resetProgress() {
		if (!progressFill) return;
		progressFill.classList.remove("is-animating");
		void progressFill.offsetWidth; // force reflow so the restart below actually restarts the animation
		progressFill.classList.add("is-animating");
	}

	function setPaused(paused) {
		if (progressFill) progressFill.classList.toggle("is-paused", paused);
	}

	function render(index) {
		// Locks the box at its current rendered height before the swap, then
		// measures the new content's natural height (with height:auto, so
		// min-height still applies as a floor) and animates to that — CSS
		// can't transition to/from "auto" on its own, so this "flip" pair of
		// forced-reflow reads is what gives the transition real start/end
		// pixel values to animate between.
		let startHeight = textEl.getBoundingClientRect().height;
		textEl.style.height = startHeight + "px";
		textEl.classList.add("is-fading");
		setTimeout(() => {
			textEl.textContent = cards[index];
			textEl.style.height = "auto";
			let endHeight = textEl.getBoundingClientRect().height;
			textEl.style.height = startHeight + "px";
			textEl.offsetHeight; // force reflow so the revert above commits before animating
			textEl.style.height = endHeight + "px";
			textEl.classList.remove("is-fading");
		}, 200);
		dotEls.forEach((d, i) => d.classList.toggle("is-active", i === index));
		resetProgress();
	}

	function goTo(i) {
		activeIndex = (i + cards.length) % cards.length;
		render(activeIndex);
	}

	dotEls.forEach((dot, i) => dot.addEventListener("click", () => goTo(i)));

	// Pausing tracks whichever signal actually means "the user is engaged
	// with this card" for the current input method. Real hover on devices
	// that have it; on touch (no hover to leave) a mouseenter/mouseleave
	// pair would pause on tap and then never get a matching leave to
	// resume — so instead, pause exactly when the most recent click
	// anywhere on the page landed inside .landing-trivia (including a dot,
	// including the label), and resume the moment a click lands outside it.
	let section = document.querySelector(".landing-trivia");
	if (window.matchMedia("(hover: hover)").matches) {
		section.addEventListener("mouseenter", () => setPaused(true));
		section.addEventListener("mouseleave", () => setPaused(false));
	} else {
		document.addEventListener("click", e => setPaused(section.contains(e.target)));
	}

	wrap.appendChild(textEl);
	if (cards.length > 1) wrap.appendChild(dots);
	if (progress) wrap.appendChild(progress);
	textEl.textContent = cards[0];
	resetProgress();

	return wrap;
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
		let [dataRes, notesRes, versionRes, elementsRes, triviaRes] = await Promise.all([
			fetch("data/data.json"),
			fetch("data/character-notes.json"),
			fetch("data/version-notes.json"),
			fetch("data/character-elements.json"),
			fetch("data/trivia.json"),
		]);
		if (!dataRes.ok) throw new Error(`Failed to load data.json: ${dataRes.status}`);
		if (!notesRes.ok) throw new Error(`Failed to load character-notes.json: ${notesRes.status}`);
		if (!versionRes.ok) throw new Error(`Failed to load version-notes.json: ${versionRes.status}`);
		if (!elementsRes.ok) throw new Error(`Failed to load character-elements.json: ${elementsRes.status}`);
		if (!triviaRes.ok) throw new Error(`Failed to load trivia.json: ${triviaRes.status}`);
		let data = await dataRes.json();
		let notes = await notesRes.json();
		let versionMeta = await versionRes.json();
		let elements = await elementsRes.json();
		let triviaPool = await triviaRes.json();

		let versionIdx = data.length - 1;
		let entry = data[versionIdx];
		let phaseIdx = getCurrentPhaseIndex(entry, Date.now());

		document.getElementById("spotlightHeading").textContent = `Version ${entry.version} — Phase ${phaseIdx + 1}`;
		document.getElementById("spotlightSub").textContent = `Live since ${formatDate(entry.date)}`;
		document.getElementById("spotlightCard").replaceWith(buildSpotlight(data, versionIdx, phaseIdx, notes, elements));

		let triviaCards = shuffle([...getAnniversaryCards(data, versionMeta, notes, new Date()), ...sampleTrivia(triviaPool, 3)]);
		document.getElementById("triviaTicker").replaceWith(buildTriviaTicker(triviaCards));

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
