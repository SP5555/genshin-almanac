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

// One shared card instead of two separate posters, so both 5-stars read as
// belonging to the same banner rather than two disconnected boxes. The glow
// wash is tinted per element (via --el-a/--el-b, set inline since it's
// data-driven) and the splash art's own alpha cutout sits directly on it —
// no sub-panel around each character.
function buildSpotlightBanner(fiveStars, data, versionIdx, phaseIdx, notes, elements) {
	let banner = document.createElement("div");
	banner.className = "spotlight-banner" + (fiveStars.length > 1 ? " has-two" : "");

	let glow = document.createElement("div");
	glow.className = "spotlight-banner-glow";
	banner.appendChild(glow);

	let glowColors = fiveStars.map(c => (ELEMENT_COLORS[elements[c]] || {}).glow).filter(Boolean);
	if (glowColors[0]) banner.style.setProperty("--el-a", glowColors[0]);
	// With only one 5-star, mirror --el-a into --el-b instead of falling back
	// to the site's default purple glow — a single-color wash reads as
	// intentional, a color that doesn't belong to either character doesn't.
	if (glowColors[1] || glowColors[0]) banner.style.setProperty("--el-b", glowColors[1] || glowColors[0]);

	// Same mirroring for the two edge-watermark icons (see .spotlight-banner
	// ::before/::after) — left watermark for the left-side character, right
	// for the right-side one, same element on both sides when there's only
	// one. Path is relative to css/landing.css, not the page — see the
	// --el-icon note on the 4-star cards for why.
	let iconUrls = fiveStars.map(c => elements[c] ? `url(../assets/elements/${elements[c].toLowerCase()}.svg)` : null).filter(Boolean);
	if (iconUrls[0]) banner.style.setProperty("--el-icon-a", iconUrls[0]);
	if (iconUrls[1] || iconUrls[0]) banner.style.setProperty("--el-icon-b", iconUrls[1] || iconUrls[0]);

	let figures = document.createElement("div");
	figures.className = "spotlight-banner-figures" + (fiveStars.length > 1 ? " has-two" : "");
	fiveStars.forEach(character => {
		figures.appendChild(buildSpotlightFigure(character, data, versionIdx, phaseIdx, notes));
	});
	banner.appendChild(figures);

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
