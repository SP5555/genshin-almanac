// Tunable knobs for the "release" glow effect (sunburst rays + bloom ring
// around a character's first-ever portrait). Edit the numbers below and
// reload — nothing else in js/app.js or css/style.css needs to change.
var GLOW_CONFIG = {
	rays: {
		countLg: 4,        // number of ray blades behind a 5-star release portrait
		countSm: 8,        // number of ray blades behind a 4-star release portrait
		widthLg: 8,        // px width of each 5-star ray blade
		widthSm: 6,        // px width of each 4-star ray blade
		blurLg: 2,         // px blur applied to each 5-star ray blade
		blurSm: 1,         // px blur applied to each 4-star ray blade
		peakOpacity: 2.0,  // opacity a ray reaches at the peak of its flicker
		delayMaxS: 4,      // each ray gets a random start delay between 0 and this (s)
		durationMinS: 2,   // fastest possible flicker cycle length (s)
		durationMaxS: 4    // slowest possible flicker cycle length (s)
	},
	bloom: {
		five: { ringWidth: 3, blur: 12, spread: 6 },
		four: { ringWidth: 2, blur: 8, spread: 4 }
	}
};

(function applyGlowConfig(cfg) {
	let root = document.documentElement.style;
	root.setProperty("--ray-width-lg", `${cfg.rays.widthLg}px`);
	root.setProperty("--ray-width-sm", `${cfg.rays.widthSm}px`);
	root.setProperty("--ray-blur-lg", `${cfg.rays.blurLg}px`);
	root.setProperty("--ray-blur-sm", `${cfg.rays.blurSm}px`);
	root.setProperty("--ray-peak-opacity", cfg.rays.peakOpacity);

	root.setProperty("--five-ring-w", `${cfg.bloom.five.ringWidth}px`);
	root.setProperty("--five-blur", `${cfg.bloom.five.blur}px`);
	root.setProperty("--five-spread", `${cfg.bloom.five.spread}px`);

	root.setProperty("--four-ring-w", `${cfg.bloom.four.ringWidth}px`);
	root.setProperty("--four-blur", `${cfg.bloom.four.blur}px`);
	root.setProperty("--four-spread", `${cfg.bloom.four.spread}px`);
})(GLOW_CONFIG);
