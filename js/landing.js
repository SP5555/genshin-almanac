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

function buildSpotlightPoster(character, data, versionIdx, phaseIdx, notes) {
	let charNotes = notes[character] || {};
	let count = countAppearancesThrough(data, versionIdx, phaseIdx, character);

	let poster = document.createElement("div");
	poster.className = "spotlight-poster";

	let imgWrap = document.createElement("div");
	imgWrap.className = "spotlight-poster-img-wrap";
	let img = document.createElement("img");
	img.className = "spotlight-poster-img";
	img.src = splashPath(character);
	img.alt = character;
	img.loading = "lazy";
	// Not every featured character has splash art downloaded yet — fall back
	// to the square face icon (already sourced for all of them) rather than
	// showing a broken image.
	img.onerror = () => { img.onerror = null; img.src = facePath(character); img.classList.add("is-fallback"); };
	imgWrap.appendChild(img);
	poster.appendChild(imgWrap);

	let label = document.createElement("div");
	label.className = "spotlight-poster-label";
	let name = document.createElement("span");
	name.className = "spotlight-poster-name";
	name.textContent = character;
	label.appendChild(name);
	if (!charNotes.preexisting) {
		let tag = document.createElement("span");
		tag.className = "rerun-tag" + (count === 1 ? " is-first" : "");
		tag.textContent = count === 1 ? "Release" : `Rerun ${count - 1}`;
		label.appendChild(tag);
	}
	if (charNotes.rateDown) {
		let poolTag = document.createElement("span");
		poolTag.className = "rate-down-tag";
		poolTag.textContent = "Rate-down";
		label.appendChild(poolTag);
	}
	poster.appendChild(label);
	return poster;
}

function buildSpotlightFourUnit(character, data, versionIdx, phaseIdx, notes) {
	let charNotes = notes[character] || {};
	let count = countAppearancesThrough(data, versionIdx, phaseIdx, character);
	let isRelease = !charNotes.preexisting && count === 1;

	let row = document.createElement("div");
	row.className = "spotlight-fourstar-unit";
	let avatarWrapSm = document.createElement("div");
	avatarWrapSm.className = "avatar-wrap avatar-wrap-sm" + (isRelease ? " is-release" : "");
	avatarWrapSm.appendChild(faceImg(character, "char-face-sm" + (isRelease ? " is-release" : "")));
	row.appendChild(avatarWrapSm);
	let name = document.createElement("span");
	name.className = "char-name" + (isRelease ? " is-release" : "");
	name.textContent = character;
	row.appendChild(name);
	return row;
}

function buildSpotlight(data, versionIdx, phaseIdx, notes) {
	let entry = data[versionIdx];
	let phase = entry.banner[phaseIdx];
	let frag = document.createDocumentFragment();

	let posters = document.createElement("div");
	posters.className = "spotlight-posters";
	phase["5"].forEach(character => {
		posters.appendChild(buildSpotlightPoster(character, data, versionIdx, phaseIdx, notes));
	});
	frag.appendChild(posters);

	if (phase["4"].length > 0) {
		let fourRow = document.createElement("div");
		fourRow.className = "spotlight-fourstars";
		phase["4"].forEach(character => {
			fourRow.appendChild(buildSpotlightFourUnit(character, data, versionIdx, phaseIdx, notes));
		});
		frag.appendChild(fourRow);
	}

	return frag;
}

async function bootstrapLanding() {
	try {
		let [dataRes, notesRes, versionRes] = await Promise.all([
			fetch("data/data.json"),
			fetch("data/character-notes.json"),
			fetch("data/version-notes.json"),
		]);
		if (!dataRes.ok) throw new Error(`Failed to load data.json: ${dataRes.status}`);
		if (!notesRes.ok) throw new Error(`Failed to load character-notes.json: ${notesRes.status}`);
		if (!versionRes.ok) throw new Error(`Failed to load version-notes.json: ${versionRes.status}`);
		let data = await dataRes.json();
		let notes = await notesRes.json();
		let versionMeta = await versionRes.json();

		let versionIdx = data.length - 1;
		let entry = data[versionIdx];
		let phaseIdx = getCurrentPhaseIndex(entry, Date.now());

		document.getElementById("spotlightHeading").textContent = `Version ${entry.version} — Phase ${phaseIdx + 1}`;
		document.getElementById("spotlightSub").textContent = `Live since ${formatDate(entry.date)}`;
		document.getElementById("spotlightCard").replaceWith(buildSpotlight(data, versionIdx, phaseIdx, notes));

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
