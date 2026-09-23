// Window scrolling on display vsync (`requestAnimationFrame` + wall-clock
// duration), not Chromium's `behavior: "smooth"` (that clock sits well
// below a high-Hz panel).
//
// Ease-in-out sine — accelerate, then decelerate. Exponential ease-out
// jumped on the first frame and coasted; cubic ease-in-out's t³ start
// sat still for several 240Hz frames and read as lag. Sine is the same
// S-curve with a gentler dead-start. Duration grows with sqrt(distance)
// so a long jump coasts instead of warping.

let raf = null;

function cancelSmoothScroll() {
	if (raf === null) return;
	cancelAnimationFrame(raf);
	raf = null;
}

let interruptArmed = false;
function armInterrupt() {
	if (interruptArmed) return;
	interruptArmed = true;
	let opts = { capture: true, passive: true };
	window.addEventListener("wheel", cancelSmoothScroll, opts);
	window.addEventListener("touchstart", cancelSmoothScroll, opts);
}

/**
 * @param {number} top
 */
export function smoothScrollY(top) {
	armInterrupt();
	cancelSmoothScroll();
	if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
		window.scrollTo(0, top);
		return;
	}
	let maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
	top = Math.max(0, Math.min(maxY, top));
	let startY = window.scrollY;
	let distance = top - startY;
	if (Math.abs(distance) < 0.5) return;

	// Seconds. Short hops ~0.35s, full-page ~0.7s.
	let duration = Math.min(0.7, 0.26 + Math.sqrt(Math.abs(distance)) / 220);
	let t0 = performance.now();

	let frame = now => {
		let t = Math.min(1, (now - t0) / 1000 / duration);
		let eased = 0.5 - 0.5 * Math.cos(Math.PI * t);
		window.scrollTo(0, startY + distance * eased);
		if (t >= 1) {
			window.scrollTo(0, top);
			raf = null;
			return;
		}
		raf = requestAnimationFrame(frame);
	};
	raf = requestAnimationFrame(frame);
}

/**
 * @param {Element} el
 * @param {{ block?: "start" | "center", offset?: number }} [opts]
 */
export function smoothScrollToEl(el, opts) {
	let block = (opts && opts.block) || "start";
	let offset = (opts && opts.offset) || 0;
	let rect = el.getBoundingClientRect();
	let top = window.scrollY + rect.top + offset;
	if (block === "center") top -= (window.innerHeight - rect.height) / 2;
	smoothScrollY(top);
}
