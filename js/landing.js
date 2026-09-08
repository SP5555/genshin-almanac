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

// In-game wish-reveal splash art, e.g. "assets/splash/arlecchino.webp" —
// same filename convention as faces/namecards. Only downloaded for
// characters actually featured on the landing page so far; see
// data/SOURCES.md for where these come from and how to add more.
function splashPath(character) {
	return `assets/splash/${character.replace(/\s/g, "").toLowerCase()}.webp`;
}

function buildSpotlightFiveCard(character, data, versionIdx, phaseIdx, notes) {
	let charNotes = notes[character] || {};
	let count = countAppearancesThrough(data, versionIdx, phaseIdx, character);

	let card = document.createElement("div");
	card.className = "spotlight-fivecard";

	// See .spotlight-fivecard-img-wrap in landing.css for why this wrapper
	// exists — it reserves the height, the <img> inside bleeds past its
	// sides on purpose instead of being cropped to fit.
	let imgWrap = document.createElement("div");
	imgWrap.className = "spotlight-fivecard-img-wrap";
	let img = document.createElement("img");
	img.className = "spotlight-fivecard-img";
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
	card.appendChild(imgWrap);

	let label = document.createElement("div");
	label.className = "spotlight-fivecard-label";
	let name = document.createElement("span");
	name.className = "spotlight-fivecard-name";
	name.textContent = character;
	label.appendChild(name);
	let tags = document.createElement("div");
	tags.className = "spotlight-fivecard-tags";
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
	card.appendChild(label);
	return card;
}

// 4-star drag toy's tuning — a real damping ratio ζ (same bounce shape the
// carousel below borrows and slows down), tuned to feel right on a 240Hz
// display. stiffness/damping are discrete per-step multipliers against
// SPRING_STEP_MS, not a runtime tick rate — see deriveSpringConstants() for
// what they mean, and CLAUDE.md for the full differential-equations
// derivation (damping ratio ζ, per-step vs. per-second, time-dilation).
const SPRING_STIFFNESS = 0.3104;
const SPRING_DAMPING = 0.7567769695999043;
const SPRING_STEP_MS = 1000 / 60;

// Converts discrete per-step stiffness/damping into the underlying
// continuous damped-oscillator's real parameters — decay rate and damped
// angular frequency — via eigenvalue analysis of the discrete recurrence's
// transition matrix [[1-damping*stiffness, damping], [-damping*stiffness,
// damping]] (see CLAUDE.md for the full derivation). Only valid for an
// underdamped tuning (complex eigenvalues); a critically-damped or
// overdamped stiffness/damping pair needs a different closed form.
function deriveSpringConstants(stiffness, damping, stepMs) {
	let stepSec = stepMs / 1000;
	let trace = 1 + damping - damping * stiffness;
	let determinant = damping;
	let discriminant = trace * trace - 4 * determinant;
	let magnitude = Math.sqrt(determinant);
	let theta = Math.atan2(Math.sqrt(Math.max(0, -discriminant)) / 2, trace / 2);
	return { decay: -Math.log(magnitude) / stepSec, omegaD: theta / stepSec };
}

// Carousel spring: same shape (damping ratio ζ) as the 4-star toy's, but
// slowed down — stiffness÷n², damping^(1/n) preserves ζ exactly while
// stretching the motion over n times more real time.
const CAROUSEL_SLOWDOWN = 2;
const CAROUSEL_SPRING_STIFFNESS = SPRING_STIFFNESS / (CAROUSEL_SLOWDOWN * CAROUSEL_SLOWDOWN);
const CAROUSEL_SPRING_DAMPING = Math.pow(SPRING_DAMPING, 1 / CAROUSEL_SLOWDOWN);
const { decay: CAROUSEL_SPRING_DECAY, omegaD: CAROUSEL_SPRING_OMEGA_D } = deriveSpringConstants(CAROUSEL_SPRING_STIFFNESS, CAROUSEL_SPRING_DAMPING, SPRING_STEP_MS);

// Exact solution to a damped harmonic oscillator over `dt` seconds, given
// its current offset from rest (e) and velocity (v) — not an approximation
// stepped in small increments, the actual closed-form position/velocity a
// real spring would have after exactly dt seconds. This is what makes both
// spring users below frame-rate independent without needing a fixed-
// timestep accumulator: a naive Euler step (`v += a*dt; e += v*dt`) only
// approximates the curve and needs a small dt to stay accurate/stable,
// whereas this formula is exact for any dt — a slow frame just steps
// further along the same curve in one call instead of needing several
// smaller ones, and an enormous dt (e.g. a backgrounded tab waking up)
// naturally decays toward e=0 via the e^(-decay*dt) term rather than
// needing a manual clamp to avoid blowing up. decay/omegaD are explicit
// parameters (not module constants) since the carousel and the 4-star toy
// each derive their own from different stiffness/damping tuning.
function stepSpring(e, v, dt, decay, omegaD) {
	let decayTerm = Math.exp(-decay * dt);
	let cosT = Math.cos(omegaD * dt);
	let sinT = Math.sin(omegaD * dt);
	let b = (v + decay * e) / omegaD;
	return {
		e: decayTerm * (e * cosT + b * sinT),
		v: decayTerm * ((b * omegaD - decay * e) * cosT - (e * omegaD + decay * b) * sinT),
	};
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
// (springSettle() runs immediately); above it, momentum coasts (decaying by
// FRICTION_PER_MS every millisecond) until it drops below MOMENTUM_STOP,
// which then hands its *actual remaining velocity* — not zero — off to
// springSettle() for the pull-back-to-center bounce. A higher MOMENTUM_STOP
// means an earlier handoff with more leftover velocity (a stronger bounce);
// lower lets the friction coast remove more speed first (a gentler one).
const CAROUSEL_FLING_MIN_VELOCITY = 0.0006;
const CAROUSEL_MOMENTUM_STOP_VELOCITY = 0.002;
const CAROUSEL_FRICTION_PER_MS = 0.9955;
// Only pointer samples from within this many ms of "now" count toward the
// release-velocity estimate — see the pointermove/endDrag handlers below.
const CAROUSEL_VELOCITY_WINDOW_MS = 100;

// One shared card instead of two separate posters, so both 5-stars read as
// belonging to the same banner rather than two disconnected boxes. Only one
// character shows at a time (carousel, dot nav below) — with two cards
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
		carousel.appendChild(buildSpotlightFiveCard(fiveStars[0], data, versionIdx, phaseIdx, notes));
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
		el.className = "spotlight-fivecard";
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
		let fresh = buildSpotlightFiveCard(character, data, versionIdx, phaseIdx, notes);
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
	// Returns the total step applied (0 if no rotation happened) — springSettle()
	// below needs this to keep its own target in the same renumbered frame;
	// every other caller ignores it, same as before.
	let resolveRotation = () => {
		let totalStep = 0;
		while (Math.round(position) !== 0) {
			let step = position > 0 ? 1 : -1;
			totalStep += step;
			baseIndex = normalize(baseIndex + step);
			position -= step;
			if (step > 0) slots.push(slots.shift());
			else slots.unshift(slots.pop());
			slots.forEach((slot, i) => { slot.offset = i - 1; });
			slots.forEach(assign);
		}
		return totalStep;
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
	// `steps` is how many characters forward (or back, if negative) to move
	// from wherever we currently are — used for auto-advance (always 1) and
	// dot-clicks (goTo()'s shortest-path count). A plain drag-release/
	// momentum-stop correcting back to the nearest character uses
	// springSettle() below instead, not this — see that function's comment
	// for why a "move nothing the user's hand prompted" and "the exact
	// moment they let go" call for different motion.
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
	// The physical "letting go" moment — a plain drag-release or a momentum
	// coast that's slowed to a stop, pulling back to whichever character is
	// nearest. Reuses the exact same tuned underdamped spring as the 4-star
	// card's drag toy (stepSpring(), driven by real per-frame dt rather than
	// a fixed step — see that function's comment for why an exact solution
	// stays correct at any frame rate), so the same signature bounce shows
	// up here as the visible "give" when momentum runs out, rather than
	// settle()'s calm, non-bouncy sweep — deliberately kept for auto-
	// advance/dot-clicks, moves the user's hand didn't make.
	//
	// Tracks its own `target` + `offset` (position = target + offset)
	// instead of springing `position` directly at a fixed target, because
	// resolveRotation() can fire mid-bounce on a big enough overshoot,
	// renumbering baseIndex and shifting `position` by an integer step —
	// `target` shifts by that same step (via resolveRotation()'s return
	// value) so `offset` (and the velocity driving it) stays continuous
	// across the renumbering instead of jumping.
	let springSettle = (initialVelocityPerMs = 0) => {
		stopAnimation();
		let target = Math.round(position);
		let offset = position - target;
		let velocity = initialVelocityPerMs * 1000; // position-units/ms -> /s
		// Same 0.4px perceptual stopping tolerance as the 4-star spring toy,
		// converted to position-units (fraction of a slide) via the
		// carousel's current pixel width rather than reusing 0.4 directly —
		// 0.4 of a whole slide would stop the animation while still
		// visibly far from centered. restVelocity mirrors the same 0.4px/step
		// feel but rescaled to a per-second rate (multiplying by the tuning
		// reference's 60 steps/sec) now that velocity is a real per-second
		// quantity rather than a per-discrete-step one.
		let restOffset = 0.4 / getSlotPx();
		let restVelocity = restOffset * (1000 / SPRING_STEP_MS);
		let lastFrameTime = null;
		let frame = now => {
			let dt = lastFrameTime === null ? 0 : (now - lastFrameTime) / 1000;
			lastFrameTime = now;
			let stepped = stepSpring(offset, velocity, dt, CAROUSEL_SPRING_DECAY, CAROUSEL_SPRING_OMEGA_D);
			offset = stepped.e; velocity = stepped.v;
			let settled = Math.abs(offset) < restOffset && Math.abs(velocity) < restVelocity;
			if (settled) offset = 0;
			position = target + offset;
			target -= resolveRotation();
			render();
			if (settled) { animationRAF = null; return; }
			animationRAF = requestAnimationFrame(frame);
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
				springSettle(velocity);
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
		// 1:1 tracking: dragging by dx px moves the active card by exactly
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
			springSettle(velocity);
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

// Reusable "spring toy" drag, not tied to any one component — `handleEl`
// is the hit area (pointer events), `targetEl` is what actually moves.
// Nothing happens on release except targetEl bouncing back to its resting
// transform, unlike the carousel's drag (which actually navigates). See
// CLAUDE.md's Spotlight carousel section for the full physics writeup:
// why it's one continuous simulation rather than "snap during drag, spring
// after release," the radial (not per-axis) rubber-band cap, the
// underdamped tuning, and the time-dilation math behind the constants
// below. Mouse-only: skipped entirely on pure-touch devices (matchMedia)
// and double-checked per-event (pointerType), same reasoning as the
// landing link-card chevron's hover:hover gate — a touch drag here would
// fight the page's own vertical scroll, and the payoff (a tiny wobble)
// isn't worth solving that.
function attachSpringDrag(handleEl, targetEl, options = {}) {
	if (!window.matchMedia("(hover: hover)").matches) return;
	let {
		maxPull = 26, stiffness = SPRING_STIFFNESS, damping = SPRING_DAMPING, rest = 0.4,
		draggableClass = "is-spring-draggable", draggingClass = "is-dragging",
		// Whatever transform targetEl already has (centering, etc.) is
		// preserved underneath the spring offset. A fixed string can be
		// passed for an element whose base transform is known upfront;
		// left undefined (the default), it's read fresh via getComputedStyle
		// at the start of each drag *that begins from a fully settled,
		// CSS-controlled state* (see the simRAF-guarded call below) rather
		// than once here at attach time — attach happens right after e.g.
		// an <img>'s src is set, before it's actually loaded (or possibly
		// fails over to a differently-positioned fallback), so reading it
		// here would risk baking in a stale pre-load transform. By the time
		// a user actually starts dragging, any such async state has long
		// since settled.
		getBaseTransform = () => {
			let computed = getComputedStyle(targetEl).transform;
			return computed === "none" ? "" : computed;
		},
	} = options;
	let hasFixedBaseTransform = typeof options.baseTransform === "string";
	let baseTransform = hasFixedBaseTransform ? options.baseTransform : "";
	// Derived once per call (cheap — a handful of trig/log ops, not per-frame
	// work) from whatever stiffness/damping this call actually received, so
	// a caller overriding them gets a spring derived from ITS tuning rather
	// than a silently-ignored option.
	let { decay, omegaD } = deriveSpringConstants(stiffness, damping, SPRING_STEP_MS);

	if (targetEl.tagName === "IMG") targetEl.draggable = false;

	let dragging = false;
	let startX = 0, startY = 0;
	// targetX/Y is where the "pull" currently wants targetEl to be — the
	// (capped) mouse offset while dragging, or (0,0) once released. x/y/vx/vy
	// are targetEl's own simulated position/velocity, which never jumps
	// straight to the target — it's always being accelerated toward
	// wherever the target currently is. One continuous simulation for the
	// entire gesture (start dragging -> still dragging -> released ->
	// settled), not two separate phases: dragging never sets a position
	// directly, it only ever moves the target the spring is chasing. That's
	// what makes it visibly lag/trail behind the cursor while still being
	// dragged, not just snap back once you let go.
	let targetX = 0, targetY = 0;
	let x = 0, y = 0, vx = 0, vy = 0;
	let simRAF = null;

	// Rubber-band on the pull's radial distance (iOS-scroll-bounce formula:
	// approaches `maxPull` asymptotically, never exceeds it), not capped per
	// axis — a per-axis cap would let a diagonal pull reach up to
	// maxPull*sqrt(2) from center (both axes at their own cap
	// simultaneously), which caps the *force* but not evenly in every
	// direction. Scaling the original vector by the banded magnitude keeps
	// its direction exact while bounding how far the mouse can pull
	// regardless of how far it actually travels on a large monitor — the
	// position itself is never clamped anywhere; this asymptotic ceiling on
	// the target is the only bound in the whole simulation, and targetEl's
	// actual position just happens to settle near it at equilibrium since
	// nothing else is pulling on the spring.
	let rubberBand = (dx, dy) => {
		let dist = Math.hypot(dx, dy);
		if (dist === 0) return [0, 0];
		let banded = maxPull * (1 - 1 / (dist / maxPull + 1));
		let scale = banded / dist;
		return [dx * scale, dy * scale];
	};

	let setOffset = (px, py) => {
		targetEl.style.transform = `${baseTransform} translate(${px}px, ${py}px)`;
	};

	// Contract: targetEl must have no CSS transition on `transform` — this
	// drives that property every frame (during the drag and the spring-back),
	// and a transition would ease each update instead, reading as input lag
	// and a fought-over motion. Don't "fix" this with a save/restore of
	// targetEl's inline `transition` for the drag+settle window — re-grabbing
	// before settle re-saves the already-suspended "none" as the "original"
	// value, permanently wiping the transition on restore. If targetEl also
	// needs a transitioned effect (e.g. a hover-zoom), give that effect its
	// own nested element instead — see the drag-layer/img split in
	// buildSpotlightFourCard() for the pattern.

	// Driven by stepSpring() (module scope, above) using the real elapsed
	// time each frame — frame-rate independent, since a per-frame discrete
	// step would otherwise run faster on a higher-refresh display (more
	// callbacks per real second). rest is a position tolerance (px);
	// restVelocity rescales it into an equivalent per-second velocity
	// tolerance now that velocity is a real per-second rate.
	let restVelocity = rest * (1000 / SPRING_STEP_MS);
	let lastFrameTime = null;

	// Named stopSim (not settle) to avoid reading as the same thing as this
	// file's other settle() (the carousel's auto-advance/dot-click sweep) —
	// different scope so no actual collision, just an avoidable false-friend.
	let stopSim = () => {
		simRAF = null;
		lastFrameTime = null;
		// Cleared entirely (not set to the resolved baseTransform) when
		// auto-detected, so a live CSS rule like translateX(-50%) keeps
		// adapting if targetEl's size changes later — the resolved matrix
		// baked in at drag-start would otherwise go stale after a resize.
		// Only baked in when the caller passed a fixed baseTransform
		// explicitly, since then there may be no CSS rule to fall back to
		// at all.
		targetEl.style.transform = hasFixedBaseTransform ? baseTransform : "";
	};

	let tick = now => {
		let dt = lastFrameTime === null ? 0 : (now - lastFrameTime) / 1000;
		lastFrameTime = now;
		let stepX = stepSpring(x - targetX, vx, dt, decay, omegaD);
		let stepY = stepSpring(y - targetY, vy, dt, decay, omegaD);
		x = targetX + stepX.e; vx = stepX.v;
		y = targetY + stepY.e; vy = stepY.v;
		if (!dragging && Math.abs(x) < rest && Math.abs(y) < rest && Math.abs(vx) < restVelocity && Math.abs(vy) < restVelocity) {
			stopSim();
			return;
		}
		setOffset(x, y);
		simRAF = requestAnimationFrame(tick);
	};
	let startSim = () => { if (simRAF === null) simRAF = requestAnimationFrame(tick); };

	handleEl.classList.add(draggableClass);
	handleEl.addEventListener("pointerdown", e => {
		if (e.pointerType !== "mouse") return;
		dragging = true;
		startX = e.clientX; startY = e.clientY;
		targetX = 0; targetY = 0;
		// Re-derived on every drag start (not cached from attach time) — see
		// getBaseTransform's own comment above for why. Guarded to only fire
		// when simRAF is null (no simulation currently running, so targetEl's
		// transform is genuinely whatever CSS put there): re-grabbing before
		// a previous drag's spring-back has settled would otherwise read
		// back our OWN in-flight offset via getComputedStyle and bake it in
		// as the new "base," visually doubling the current offset on the
		// spot and leaving the true center polluted until the next full
		// settle clears it.
		if (!hasFixedBaseTransform && simRAF === null) baseTransform = getBaseTransform();
		handleEl.classList.add(draggingClass);
		handleEl.setPointerCapture(e.pointerId);
		startSim();
	});
	handleEl.addEventListener("pointermove", e => {
		if (!dragging) return;
		[targetX, targetY] = rubberBand(e.clientX - startX, e.clientY - startY);
	});
	let endDrag = () => {
		if (!dragging) return;
		dragging = false;
		handleEl.classList.remove(draggingClass);
		targetX = 0; targetY = 0;
		// tick() is already running (started on pointerdown) and keeps
		// going on its own — nothing else to kick off here, the target
		// just moved back to center for it to chase.
	};
	handleEl.addEventListener("pointerup", endDrag);
	handleEl.addEventListener("pointercancel", endDrag);
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

	// Same splash art + fallback pattern as buildSpotlightFiveCard() — not
	// every future 4-star will have art downloaded immediately, so this
	// must degrade to the face icon rather than show a broken image.
	// dragLayer/img split: attachSpringDrag() drives dragLayer's transform
	// every frame (no CSS transition, ever), while img keeps its own
	// separately-transitioned transform for the hover-zoom — see
	// attachSpringDrag()'s contract comment for why sharing one transform
	// between "driven every frame by JS" and "eased by CSS" doesn't work.
	let imgWrap = document.createElement("div");
	imgWrap.className = "spotlight-fourcard-img-wrap";
	let dragLayer = document.createElement("div");
	dragLayer.className = "spotlight-fourcard-drag";
	let img = document.createElement("img");
	img.className = "spotlight-fourcard-img";
	img.src = splashPath(character);
	img.alt = character;
	img.loading = "lazy";
	img.draggable = false;
	img.onerror = () => { img.onerror = null; img.src = facePath(character); img.classList.add("is-fallback"); };
	dragLayer.appendChild(img);
	imgWrap.appendChild(dragLayer);
	card.appendChild(imgWrap);
	attachSpringDrag(card, dragLayer);

	let label = document.createElement("div");
	label.className = "spotlight-fourcard-label";
	let name = document.createElement("span");
	name.className = "spotlight-fourcard-name";
	name.textContent = character;
	label.appendChild(name);
	// Same tag mechanism as the 5-star cards (rerun-tag/is-first), rather
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
		swapWithFade(textEl, [textEl], () => { textEl.textContent = cards[index]; });
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

		let now = previewNow();
		// Not always data[data.length-1] — a version can be pre-staged in
		// data.json up to a week before its real launch (roster/art set,
		// announced, but not live yet). Walk backward for the last entry
		// that's actually launched — same pattern as findLastLaunchedEntry()
		// (shared.js, used by the header's live dot) and the Timeline's own
		// live-ripple logic — otherwise the spotlight would confidently show
		// the *next* version as already live during that pre-staged week.
		let entry = findLastLaunchedEntry(data, now.getTime()) || data[0];
		let versionIdx = data.indexOf(entry);
		let phaseIdx = getCurrentPhaseIndex(entry, now.getTime());

		document.getElementById("spotlightHeading").textContent = `Version ${entry.version} — Phase ${phaseIdx + 1}`;
		// The *phase's* start date, not the version's launch date — same
		// PHASE_LENGTH_DAYS math getCurrentPhaseIndex() already used to pick
		// this phase, so it's consistent (and correctly falls back to
		// entry.date itself for phase 1).
		let phaseStart = new Date(entry.date + "T00:00:00Z");
		phaseStart.setUTCDate(phaseStart.getUTCDate() + phaseIdx * PHASE_LENGTH_DAYS);
		document.getElementById("spotlightSub").textContent = `Live since ${formatDate(phaseStart.toISOString().slice(0, 10))}`;
		// Same LIVE_WINDOW_DAYS staleness rule as the header's brand dot
		// (shared.js) — once data.json hasn't been updated in that long, this
		// card is almost certainly showing an old version/phase rather than
		// whatever's actually live, so say so instead of confidently
		// displaying stale info with no indication anything's off.
		let daysSinceLaunch = (now.getTime() - new Date(entry.date + "T00:00:00Z").getTime()) / 86400000;
		let staleEl = document.getElementById("spotlightStale");
		if (daysSinceLaunch > LIVE_WINDOW_DAYS) {
			staleEl.textContent = "This might be old news by now — we may be behind on the latest update.";
			staleEl.hidden = false;
		}
		document.getElementById("spotlightCard").replaceWith(buildSpotlight(data, versionIdx, phaseIdx, notes, elements));

		let triviaCards = shuffle([...getAnniversaryCards(data, versionMeta, notes, now), ...sampleTrivia(triviaPool, 3)]);
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
