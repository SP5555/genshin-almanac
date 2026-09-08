var characterIndex = {};
var characterNotes = {};
var phaseNotes = {};
var versionMeta = {};
var characterElements = {};
var characterAliases = {};

function groupByMajor(data) {
	let groups = [];
	let byMajor = {};
	for (let i = 0; i < data.length; i++) {
		let entry = data[i];
		let major = entry.version.split(".")[0];
		if (!byMajor[major]) {
			byMajor[major] = { major, versions: [] };
			groups.push(byMajor[major]);
		}
		byMajor[major].versions.push(entry);
	}
	return groups;
}

function normalizeChar(name) {
	let notes = characterNotes[name] || {};
	return { name, rateDown: !!notes.rateDown, preexisting: !!notes.preexisting };
}

function buildNode(version, phaseLabel, phase, charCount, isFiller, variant, date) {
	let card = document.createElement("div");
	card.className = "trail-node phase-card" + (isFiller ? " is-filler" : "") + (variant ? ` is-${variant}` : "");
	card.dataset.version = version;
	card.dataset.phaseLabel = phaseLabel;

	let badge = document.createElement("div");
	badge.className = "phase-tag";
	badge.textContent = phaseLabel;
	card.appendChild(badge);

	let body = document.createElement("div");
	body.className = "phase-card-body";

	let fiveGroup = document.createElement("div");
	fiveGroup.className = "phase-five-group";
	let fiveUnits = [];
	for (let i = 0; i < phase["5"].length; i++) {
		let { name: character, rateDown, preexisting } = normalizeChar(phase["5"][i]);
		charCount[character] = (charCount[character] || 0) + 1;
		let count = charCount[character];

		let isRelease = !preexisting && count === 1;
		(characterIndex[character] = characterIndex[character] || []).push({
			version, phaseLabel, rarity: "5", isRelease, rerun: count - 1, rateDown, preexisting, isFiller, variant, date
		});

		let unit = document.createElement("div");
		unit.className = "phase-five-unit char-trigger";
		unit.tabIndex = 0;
		unit.setAttribute("role", "button");
		unit.setAttribute("aria-label", `View ${character}'s appearance history`);
		unit.dataset.character = character;
		let avatarWrap = document.createElement("div");
		avatarWrap.className = "avatar-wrap avatar-wrap-lg" + (isRelease ? " is-release" : "");
		if (isRelease) avatarWrap.appendChild(buildRays(GLOW_CONFIG.rays.countLg, "var(--five-glow)"));
		avatarWrap.appendChild(faceImg(character, "phase-face-lg" + (isRelease ? " is-release" : "")));
		unit.appendChild(avatarWrap);

		let text = document.createElement("div");
		text.className = "phase-five-text";
		let name = document.createElement("span");
		name.className = "char-name" + (isRelease ? " is-release" : "");
		name.textContent = character;
		text.appendChild(name);
		if (!preexisting) {
			let tag = document.createElement("span");
			tag.className = "rerun-tag" + (count === 1 ? " is-first" : "");
			tag.textContent = count === 1 ? "Release" : `Rerun ${count - 1}`;
			text.appendChild(tag);
		}
		if (rateDown) {
			let poolTag = document.createElement("span");
			poolTag.className = "rate-down-tag";
			poolTag.textContent = "Rate-down";
			poolTag.title = "Not a truly exclusive/limited character — already available via the standard rate-down pool";
			text.appendChild(poolTag);
		}
		unit.appendChild(text);

		fiveUnits.push(unit);
	}

	fiveUnits.forEach(u => fiveGroup.appendChild(u));
	body.appendChild(fiveGroup);

	if (phase["4"] && phase["4"].length > 0) {
		let divider = document.createElement("div");
		divider.className = "phase-divider";
		body.appendChild(divider);

		let fourGroup = document.createElement("div");
		fourGroup.className = "phase-four-group";
		let fourUnits = [];
		for (let i = 0; i < phase["4"].length; i++) {
			let { name: character, rateDown: fourRateDown, preexisting: fourPreexisting } = normalizeChar(phase["4"][i]);
			charCount[character] = (charCount[character] || 0) + 1;
			let fourCount = charCount[character];
			let isFourRelease = !fourPreexisting && fourCount === 1;
			(characterIndex[character] = characterIndex[character] || []).push({
				version, phaseLabel, rarity: "4", isRelease: isFourRelease, rerun: fourCount - 1,
				rateDown: fourRateDown, preexisting: fourPreexisting, isFiller, variant, date
			});

			let row = document.createElement("div");
			row.className = "phase-four-unit char-trigger";
			row.tabIndex = 0;
			row.setAttribute("role", "button");
			row.setAttribute("aria-label", `View ${character}'s appearance history`);
			row.dataset.character = character;
			let avatarWrapSm = document.createElement("div");
			avatarWrapSm.className = "avatar-wrap avatar-wrap-sm" + (isFourRelease ? " is-release" : "");
			if (isFourRelease) avatarWrapSm.appendChild(buildRays(GLOW_CONFIG.rays.countSm, "var(--four-glow)"));
			avatarWrapSm.appendChild(faceImg(character, "char-face-sm" + (isFourRelease ? " is-release" : "")));
			row.appendChild(avatarWrapSm);
			let name = document.createElement("span");
			name.className = "char-name" + (isFourRelease ? " is-release" : "");
			name.textContent = character;
			row.appendChild(name);
			fourUnits.push(row);
		}

		if (variant === "chronicled" || variant === "lightrace") {
			let half = Math.ceil(fourUnits.length / 2);
			[fourUnits.slice(0, half), fourUnits.slice(half)].forEach(colUnits => {
				if (colUnits.length === 0) return;
				let col = document.createElement("div");
				col.className = "phase-four-col";
				colUnits.forEach(u => col.appendChild(u));
				fourGroup.appendChild(col);
			});
		} else {
			fourUnits.forEach(u => fourGroup.appendChild(u));
		}
		body.appendChild(fourGroup);
	} else if (variant === "lightrace") {
		// Real Lightrace Wish behavior: EVERY 4-star character in the game is a
		// selectable designated-pull target, not a small curated subset — 50 of
		// them as of this card's 6.7 debut, confirmed against Fandom's banner
		// page. Rendering 50 individual icons isn't viable (a dozen already
		// needed the chronicled column-split above), and since Lightrace is a
		// permanent, ever-recurring banner, a hand-maintained name list would
		// only ever grow — so data.json deliberately omits a "4" array here and
		// this count is derived live from characterIndex (everyone who's
		// appeared as a 4-star by this point in the timeline) instead.
		let divider = document.createElement("div");
		divider.className = "phase-divider";
		body.appendChild(divider);

		let fourStarCount = Object.keys(characterIndex).filter(n => characterIndex[n][0].rarity === "4").length;
		let summary = document.createElement("div");
		summary.className = "phase-four-summary";
		// A literal <br> at a fixed clause break (rather than relying on
		// max-width to wrap wherever it lands) is what lets the box's CSS
		// width:fit-content hug the longer of the two actual lines — a
		// width/max-width alone always resolves to the constraint itself once
		// content forces a wrap, not the narrower width the wrapped text
		// actually rendered at.
		summary.append("Every 4-star character", document.createElement("br"), `released so far (${fourStarCount})`);
		body.appendChild(summary);
	}

	card.appendChild(body);

	return card;
}

// Mirrors the Timeline's own .vt-marker-col technique (a rail with a
// ::before line + marker bubble) at list scale. entry.isRelease gets an
// extra glow ring; entry.variant (chronicled/lightrace) recolors the dot +
// version text with that banner's own accent.
function buildAppearanceRow(entry) {
	let row = document.createElement("div");
	row.className = "char-appear-row" + (entry.isFiller ? " is-filler" : "");

	let rail = document.createElement("span");
	rail.className = "char-appear-rail";
	let dot = document.createElement("span");
	dot.className = "char-appear-dot " + (entry.rarity === "5" ? "is-five" : "is-four")
		+ (entry.isRelease ? " is-release" : "")
		+ (entry.variant ? ` is-${entry.variant}` : "");
	rail.appendChild(dot);
	row.appendChild(rail);

	let label = document.createElement("div");
	label.className = "char-appear-label";

	let ver = document.createElement("span");
	ver.className = "char-appear-version is-jumpable" + (entry.variant ? ` is-${entry.variant}` : "");
	ver.textContent = `${entry.version} — ${entry.phaseLabel}`;
	ver.tabIndex = 0;
	ver.setAttribute("role", "button");
	ver.setAttribute("aria-label", `Jump to ${entry.version} ${entry.phaseLabel} card`);
	onActivate(ver, () => jumpToCard(entry.version, entry.phaseLabel));
	label.appendChild(ver);

	let meta = document.createElement("div");
	meta.className = "char-appear-meta";
	let status = document.createElement("span");
	status.className = "char-appear-tag";
	if (entry.preexisting) {
		status.textContent = `Rerun ${entry.rerun + 1}`;
	} else if (entry.rerun === 0) {
		status.textContent = "Release";
		status.classList.add("is-release");
	} else {
		status.textContent = `Rerun ${entry.rerun}`;
	}
	meta.appendChild(status);
	if (entry.date) {
		let dateEl = document.createElement("span");
		dateEl.className = "char-appear-date";
		dateEl.textContent = formatDate(entry.date);
		meta.appendChild(dateEl);
	}
	label.appendChild(meta);

	row.appendChild(label);
	return row;
}

function openCharPanel(character) {
	let entries = characterIndex[character] || [];
	if (entries.length === 0) return;

	let notes = characterNotes[character] || {};
	let header = document.getElementById("detailPanelHeader");
	let content = document.getElementById("detailPanelContent");
	header.innerHTML = "";
	content.innerHTML = "";

	let element = characterElements[character];
	if (element) {
		content.style.backgroundImage =
			`linear-gradient(rgba(13,13,20,0.94), rgba(13,13,20,0.94)), url(assets/elements/${element.toLowerCase()}.svg)`;
	} else {
		content.style.backgroundImage = "";
	}

	let rarity = entries[0].rarity;
	buildCharacterHeader(header, character, rarity, notes);

	if (notes.preexisting) {
		let note = document.createElement("p");
		note.className = "detail-panel-note";
		note.textContent = "Already in the game at launch — these appearances are technically reruns, not a debut.";
		content.appendChild(note);
	}

	let stats = document.createElement("div");
	stats.className = "detail-panel-stats";
	stats.textContent = `${entries.length} banner appearance${entries.length === 1 ? "" : "s"}`;
	content.appendChild(stats);

	let list = document.createElement("div");
	list.className = "char-appear-list";
	entries.forEach(entry => list.appendChild(buildAppearanceRow(entry)));
	content.appendChild(list);

	document.getElementById("detailPanel").classList.add("is-open");
	document.getElementById("detailPanel").setAttribute("aria-hidden", "false");
	document.getElementById("detailPanelBackdrop").classList.add("is-open");
	document.body.classList.add("panel-open");
	document.documentElement.classList.add("panel-open");
}

function closeCharPanel() {
	document.getElementById("detailPanel").classList.remove("is-open");
	document.getElementById("detailPanel").setAttribute("aria-hidden", "true");
	document.getElementById("detailPanelBackdrop").classList.remove("is-open");
	document.body.classList.remove("panel-open");
	document.documentElement.classList.remove("panel-open");
}

function pageOffsetTop(el) {
	let top = 0;
	while (el) {
		top += el.offsetTop;
		el = el.offsetParent;
	}
	return top;
}

function jumpToCard(version, phaseLabel) {
	let card = document.querySelector(
		`.phase-card[data-version="${CSS.escape(version)}"][data-phase-label="${CSS.escape(phaseLabel)}"]`
	);
	if (!card) return;
	let top = pageOffsetTop(card) - 20;
	window.scrollTo({ top, behavior: "smooth" });
	card.classList.add("is-highlighted");
	setTimeout(() => card.classList.remove("is-highlighted"), 1800);
}

function initCharPanel() {
	onDelegatedActivate(document.getElementById("timelineRoot"), ".char-trigger", trigger => openCharPanel(trigger.dataset.character));
	document.getElementById("detailPanelClose").addEventListener("click", closeCharPanel);
	document.getElementById("detailPanelBackdrop").addEventListener("click", closeCharPanel);
	document.addEventListener("keydown", e => {
		if (e.key === "Escape") closeCharPanel();
	});
	initPanelGrabberDrag(closeCharPanel);
}

function buildMarkerCol(markerEl) {
	let col = document.createElement("div");
	col.className = "vt-marker-col";
	col.appendChild(markerEl);
	return col;
}

function buildMajorRow(group) {
	let row = document.createElement("div");
	row.className = "vt-row vt-major-row container";

	let marker = document.createElement("div");
	marker.className = "vt-major-marker";
	marker.textContent = group.major;
	row.appendChild(buildMarkerCol(marker));

	let content = document.createElement("div");
	content.className = "vt-content";

	let meta = versionMeta[group.major] || {};

	let title = document.createElement("div");
	title.className = "vt-major-title";
	title.textContent = meta.region || `Version ${meta.label || group.major}`;
	content.appendChild(title);

	if (meta.tagline) {
		let tagline = document.createElement("div");
		tagline.className = "vt-major-tagline";
		tagline.textContent = meta.tagline;
		content.appendChild(tagline);
	}

	let range = document.createElement("div");
	range.className = "vt-major-range";
	let first = group.versions[0].version;
	let last = group.versions[group.versions.length - 1].version;
	range.textContent = first === last ? first : `${first} – ${last}`;
	content.appendChild(range);

	row.appendChild(content);
	return row;
}

function buildPatchRow(entry, charCount, isLive) {
	let version = entry.version;
	let row = document.createElement("div");
	row.className = "vt-row vt-patch-row container";

	let marker = document.createElement("div");
	marker.className = "vt-patch-marker" + (isLive ? " is-live" : "");
	marker.textContent = version;
	row.appendChild(buildMarkerCol(marker));

	let content = document.createElement("div");
	content.className = "vt-content";

	if (entry.date) {
		let dateEl = document.createElement("div");
		dateEl.className = "vt-patch-date";
		dateEl.textContent = formatDate(entry.date);
		content.appendChild(dateEl);
	}

	let phasesWrap = document.createElement("div");
	phasesWrap.className = "vt-phases";
	let realPhaseCount = 0;
	let phaseCards = [];
	for (let p = 0; p < entry.banner.length; p++) {
		let phase = entry.banner[p];
		let notes = phaseNotes[`${version}-${p + 1}`] || {};
		let isFiller = !!notes.filler;
		let label = isFiller ? "Filler" : `Phase ${++realPhaseCount}`;
		let date = getPhaseStartDate(entry, p, phaseNotes);
		let card = buildNode(version, label, phase, charCount, isFiller, null, date);
		phasesWrap.appendChild(card);
		phaseCards.push(card);
	}

	// Tracks whichever card currently sits right after each real phase, so a
	// second special banner targeting the same phase (e.g. a future version
	// with both a Chronicled Wish and a Lightrace Wish in Phase 1) inserts
	// after the first one instead of both racing for the same "afterend"
	// spot and landing in reverse order.
	let phaseAnchors = phaseCards.slice();
	function insertAfterPhase(phaseNum, card) {
		let anchorIdx = phaseNum - 1;
		let anchor = phaseAnchors[anchorIdx];
		if (anchor) anchor.insertAdjacentElement("afterend", card);
		else phasesWrap.appendChild(card);
		phaseAnchors[anchorIdx] = card;
	}

	if (entry.chronicled) {
		let c = entry.chronicled;
		let label = `Chronicled Wish — ${c.theme}`;
		// No exact chronicled-banner date is tracked anywhere on this site —
		// reusing the parent phase's own start date is the closest real anchor.
		let date = getPhaseStartDate(entry, c.phase - 1, phaseNotes);
		insertAfterPhase(c.phase, buildNode(version, label, c, charCount, false, "chronicled", date));
	}

	// Lightrace Wish: a permanent, ever-rotating banner (debuted 6.7) that
	// features characters getting Stellar-Conduct reaction buffs, not a
	// region theme — so no "— theme" suffix on its label the way Chronicled
	// gets one. Weapons are part of the real banner too, but this site
	// deliberately only tracks character banners (see CLAUDE.md), so those
	// aren't recorded here.
	if (entry.lightrace) {
		let l = entry.lightrace;
		let date = getPhaseStartDate(entry, l.phase - 1, phaseNotes);
		insertAfterPhase(l.phase, buildNode(version, "Lightrace Wish", l, charCount, false, "lightrace", date));
	}

	content.appendChild(phasesWrap);

	row.appendChild(content);
	return row;
}

function buildVersionBlock(group, charCount, lastVersion) {
	let block = document.createElement("div");
	block.className = "vt-block";
	block.id = `v-section-${group.major}`;
	block.appendChild(buildMajorRow(group));
	for (let v = 0; v < group.versions.length; v++) {
		let entry = group.versions[v];
		block.appendChild(buildPatchRow(entry, charCount, entry.version === lastVersion));
	}
	return block;
}

function buildVersionNav(groups) {
	let nav = document.getElementById("versionNav");
	groups.forEach(group => {
		let meta = versionMeta[group.major] || {};
		let a = document.createElement("a");
		a.href = `#v-section-${group.major}`;
		a.dataset.label = meta.region ? `Version ${meta.label || group.major} — ${meta.region}` : `Version ${group.major}`;
		a.dataset.target = `v-section-${group.major}`;
		nav.appendChild(a);
	});

	nav.addEventListener("click", e => {
		let a = e.target.closest("a[data-target]");
		if (!a) return;
		e.preventDefault();
		let target = document.getElementById(a.dataset.target);
		let top = target.offsetTop - 12;
		window.scrollTo({ top, behavior: "smooth" });
	});
}

function init(data) {
	let groups = groupByMajor(data);
	let charCount = {};
	let root = document.getElementById("timelineRoot");
	let majorBlocks = [];
	let LIVE_WINDOW_DAYS = 42;
	let now = previewNow().getTime();
	// data.json's last entry isn't always the currently-live version — it can be
	// pre-staged ahead of its official date once announced, same edge case the
	// Server Clocks update estimate handles. Walk backward for the last entry
	// that's actually launched rather than assuming the array's last item is it.
	let launchedEntry = null;
	for (let i = data.length - 1; i >= 0; i--) {
		if (new Date(data[i].date + "T00:00:00").getTime() <= now) {
			launchedEntry = data[i];
			break;
		}
	}
	let daysSinceLastEntry = launchedEntry
		? (now - new Date(launchedEntry.date + "T00:00:00").getTime()) / 86400000
		: Infinity;
	let lastVersion = (launchedEntry && daysSinceLastEntry <= LIVE_WINDOW_DAYS) ? launchedEntry.version : null;

	groups.forEach(group => {
		let block = buildVersionBlock(group, charCount, lastVersion);
		root.appendChild(block);
		majorBlocks.push(block);

		let blockObserver = new IntersectionObserver(entries => {
			entries.forEach(entry => {
				if (entry.isIntersecting) entry.target.classList.add("in-view");
			});
		}, { threshold: 0.05 });
		blockObserver.observe(block);
	});

	buildVersionNav(groups);

	let navLinks = document.querySelectorAll("#versionNav a");
	let navObserver = new IntersectionObserver(entries => {
		entries.forEach(entry => {
			let link = document.querySelector(`#versionNav a[data-target="${entry.target.id}"]`);
			if (!link) return;
			if (entry.isIntersecting) {
				navLinks.forEach(l => l.classList.remove("active"));
				link.classList.add("active");
				let major = entry.target.id.replace("v-section-", "");
				setRegionBackground(major);
			}
		});
	}, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
	majorBlocks.forEach(block => navObserver.observe(block));
}

var activeRegionLayer = "A";
var currentRegionMajor = null;
function setRegionBackground(major) {
	if (major === currentRegionMajor) return;
	let meta = versionMeta[major] || {};
	if (!meta.bgImage) return;
	currentRegionMajor = major;

	let nextLayer = document.getElementById(activeRegionLayer === "A" ? "regionBgB" : "regionBgA");
	let prevLayer = document.getElementById(activeRegionLayer === "A" ? "regionBgA" : "regionBgB");
	nextLayer.style.backgroundImage =
		`linear-gradient(rgba(7,7,12,0.78), rgba(7,7,12,0.9)), url(assets/regions/${meta.bgImage}.jpg)`;
	nextLayer.classList.add("is-active");
	prevLayer.classList.remove("is-active");
	activeRegionLayer = activeRegionLayer === "A" ? "B" : "A";
}

async function loadJSON(path) {
	let res = await fetch(path);
	if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
	return res.json();
}

async function bootstrap() {
	try {
		let [data, notes, phases, versions, elements, aliases] = await Promise.all([
			loadJSON("data/data.json"),
			loadJSON("data/character-notes.json"),
			loadJSON("data/phase-notes.json"),
			loadJSON("data/version-notes.json"),
			loadJSON("data/character-elements.json"),
			loadJSON("data/character-aliases.json")
		]);
		characterNotes = notes;
		phaseNotes = phases;
		versionMeta = versions;
		characterElements = elements;
		characterAliases = aliases;

		init(data);
		initCharPanel();
		initCharSearch(() => Object.keys(characterIndex), characterAliases, openCharPanel);
	} catch (err) {
		console.error(err);
		document.getElementById("timelineRoot").textContent = "Failed to load banner data — please refresh the page.";
	}
}

bootstrap();
