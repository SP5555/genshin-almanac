// Generic animation helpers for the shared detail panel. No dependencies on
// any other module in this project.

/**
 * Generic "swap this container's content with a smooth fade + resize."
 * Locks the container's current height as a px value, fades fadeEls out,
 * calls renderFn once invisible, measures the new natural height, then
 * animates to it while fading back in — CSS can't transition to/from
 * `auto`, so height has to be measured/set explicitly on both ends.
 * @param {HTMLElement} container - resizes to match the new content. Its own
 *   CSS must already include `height` in its `transition` list (each
 *   component owns that list, usually combined with other transitions).
 * @param {HTMLElement[]} fadeEls - elements toggled `.is-fading` during the
 *   swap (component CSS defines what that means, e.g.
 *   `.trivia-text.is-fading{opacity:0}`). Often just [container]; sometimes
 *   specific children (Calendar fades header+content while the panel itself
 *   resizes).
 * @param {() => void} renderFn - mutates the DOM to the new state, called
 *   once invisible.
 * @param {number} [fadeMs] - wait before swapping (default 200, matching
 *   every current caller's own CSS transition duration).
 *
 * Respects prefers-reduced-motion — renders instantly, no animation.
 */
export function swapWithFade(container, fadeEls, renderFn, fadeMs = 200) {
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

/**
 * Mobile drag-to-dismiss for the detail panel's grabber pill: 1:1 finger
 * tracking via inline transform, and a qualifying swipe (>25% of the
 * panel's height) calls onDismiss() — always a full close, matching a
 * backdrop tap, never a partial action, on both Timeline's single-level
 * panel and Calendar's panel stack. A non-qualifying release just lets the
 * existing CSS transition snap back into place.
 * @param {() => void} onDismiss
 */
export function initPanelGrabberDrag(onDismiss) {
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
