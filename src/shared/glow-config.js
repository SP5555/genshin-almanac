// Tunable knobs for the "release" glow (corona behind the portrait +
// bloom ring on the face). Edit the numbers below and reload. Only
// Timeline and Calendar import this (via glow.js) — Landing and Server
// Clocks don't render release glow, so they never pull it in.
export const GLOW_CONFIG = {
	halo: {
		// Portrait radius = 100. Inner ramp (AA), full at the crop, fade out.
		fadeIn: 95,
		full: 100,
		fadeOut: 140,
		durationS: 5.5,
		opacityMin: 0.2,
		opacityMax: 0.8
	},
	bloom: {
		five: { ringWidth: 3, innerBlur: 6, innerSpread: 3, outerBlur: 12, outerSpread: 6 },
		four: { ringWidth: 2, innerBlur: 4, innerSpread: 2, outerBlur: 8, outerSpread: 4 }
	}
};

(function applyGlowConfig(cfg) {
	let root = document.documentElement.style;
	let h = cfg.halo;
	let outerMul = h.fadeOut / 100;
	root.setProperty("--halo-inset", `${((outerMul - 1) / 2 * 100).toFixed(4)}%`);
	root.setProperty("--halo-in", `${(h.fadeIn / h.fadeOut * 100).toFixed(4)}%`);
	root.setProperty("--halo-full", `${(h.full / h.fadeOut * 100).toFixed(4)}%`);
	root.setProperty("--halo-dur", `${h.durationS}s`);
	root.setProperty("--halo-opacity-min", h.opacityMin);
	root.setProperty("--halo-opacity-max", h.opacityMax);

	root.setProperty("--five-ring-w", `${cfg.bloom.five.ringWidth}px`);
	root.setProperty("--five-inner-blur", `${cfg.bloom.five.innerBlur}px`);
	root.setProperty("--five-inner-spread", `${cfg.bloom.five.innerSpread}px`);
	root.setProperty("--five-outer-blur", `${cfg.bloom.five.outerBlur}px`);
	root.setProperty("--five-outer-spread", `${cfg.bloom.five.outerSpread}px`);

	root.setProperty("--four-ring-w", `${cfg.bloom.four.ringWidth}px`);
	root.setProperty("--four-inner-blur", `${cfg.bloom.four.innerBlur}px`);
	root.setProperty("--four-inner-spread", `${cfg.bloom.four.innerSpread}px`);
	root.setProperty("--four-outer-blur", `${cfg.bloom.four.outerBlur}px`);
	root.setProperty("--four-outer-spread", `${cfg.bloom.four.outerSpread}px`);
})(GLOW_CONFIG);
