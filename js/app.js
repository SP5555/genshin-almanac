var t1v2 = new Date().getTime();

var characterIndex = {};
var characterNotes = {};
var phaseNotes = {};
var versionMeta = {};
var characterElements = {};

function facePath(character) {
	return `assets/faces/${character.replace(/\s/g, "").toLowerCase()}.png`;
}

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

function faceImg(character, className) {
	let img = document.createElement("img");
	img.className = className;
	img.src = facePath(character);
	img.alt = character;
	img.loading = "lazy";
	return img;
}

function buildRays(count, colorVar) {
	let wrap = document.createElement("div");
	wrap.className = "rays-wrap";
	let cfg = GLOW_CONFIG.rays;
	for (let i = 0; i < count; i++) {
		let ray = document.createElement("div");
		ray.className = "ray";
		ray.style.setProperty("--ray-angle", `${(Math.random() * 360).toFixed(1)}deg`);
		ray.style.setProperty("--ray-delay", `${(Math.random() * cfg.delayMaxS).toFixed(2)}s`);
		ray.style.setProperty("--ray-dur", `${(cfg.durationMinS + Math.random() * (cfg.durationMaxS - cfg.durationMinS)).toFixed(2)}s`);
		ray.style.setProperty("--ray-color", colorVar);
		wrap.appendChild(ray);
	}
	return wrap;
}

function normalizeChar(name) {
	let notes = characterNotes[name] || {};
	return { name, rateDown: !!notes.rateDown, preexisting: !!notes.preexisting };
}

function buildNode(version, phaseLabel, phase, charCount, isFiller, isChronicled) {
	let card = document.createElement("div");
	card.className = "trail-node phase-card" + (isFiller ? " is-filler" : "") + (isChronicled ? " is-chronicled" : "");

	let badge = document.createElement("div");
	badge.className = "phase-tag";
	badge.textContent = phaseLabel;
	card.appendChild(badge);

	let fiveGroup = document.createElement("div");
	fiveGroup.className = "phase-five-group";
	let fiveUnits = [];
	for (let i = 0; i < phase["5"].length; i++) {
		let { name: character, rateDown, preexisting } = normalizeChar(phase["5"][i]);
		charCount[character] = (charCount[character] || 0) + 1;
		let count = charCount[character];

		let isRelease = !preexisting && count === 1;
		(characterIndex[character] = characterIndex[character] || []).push({
			version, phaseLabel, rarity: "5", isRelease, rerun: count - 1, rateDown, preexisting, isFiller
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

	if (isChronicled) {
		let half = Math.ceil(fiveUnits.length / 2);
		[fiveUnits.slice(0, half), fiveUnits.slice(half)].forEach(rowUnits => {
			if (rowUnits.length === 0) return;
			let row = document.createElement("div");
			row.className = "phase-five-row";
			rowUnits.forEach(u => row.appendChild(u));
			fiveGroup.appendChild(row);
		});
	} else {
		fiveUnits.forEach(u => fiveGroup.appendChild(u));
	}
	card.appendChild(fiveGroup);

	if (phase["4"].length > 0) {
		let divider = document.createElement("div");
		divider.className = "phase-divider";
		card.appendChild(divider);

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
				rateDown: fourRateDown, preexisting: fourPreexisting, isFiller
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

		if (isChronicled) {
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
		card.appendChild(fourGroup);
	}

	return card;
}

function buildAppearanceRow(entry) {
	let row = document.createElement("div");
	row.className = "char-appear-row" + (entry.isFiller ? " is-filler" : "");

	let dot = document.createElement("span");
	dot.className = "char-appear-dot " + (entry.rarity === "5" ? "is-five" : "is-four");
	row.appendChild(dot);

	let label = document.createElement("div");
	label.className = "char-appear-label";

	let ver = document.createElement("span");
	ver.className = "char-appear-version";
	ver.textContent = `${entry.version} — ${entry.phaseLabel}`;
	label.appendChild(ver);

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
	label.appendChild(status);

	row.appendChild(label);
	return row;
}

function openCharPanel(character) {
	let entries = characterIndex[character] || [];
	if (entries.length === 0) return;

	let notes = characterNotes[character] || {};
	let header = document.getElementById("charPanelHeader");
	let content = document.getElementById("charPanelContent");
	header.innerHTML = "";
	content.innerHTML = "";

	let namecardPath = `assets/namecards/${character.replace(/\s/g, "").toLowerCase()}.jpg`;
	header.style.backgroundImage = `linear-gradient(to bottom, rgba(13,13,20,0.45), rgba(13,13,20,0.94)), url(${namecardPath})`;

	let element = characterElements[character];
	if (element) {
		content.style.backgroundImage =
			`linear-gradient(rgba(13,13,20,0.94), rgba(13,13,20,0.94)), url(assets/elements/${element.toLowerCase()}.svg)`;
	} else {
		content.style.backgroundImage = "";
	}

	let rarity = entries[0].rarity;

	let avatarWrap = document.createElement("div");
	avatarWrap.className = "avatar-wrap avatar-wrap-lg";
	avatarWrap.appendChild(faceImg(character, "phase-face-lg is-release" + (rarity === "4" ? " rarity-four" : "")));
	header.appendChild(avatarWrap);

	let nameEl = document.createElement("h2");
	nameEl.className = "char-panel-name";
	nameEl.textContent = character;
	header.appendChild(nameEl);

	let tagsWrap = document.createElement("div");
	tagsWrap.className = "char-panel-tags";
	let rarityTag = document.createElement("span");
	rarityTag.className = "char-panel-rarity " + (rarity === "5" ? "is-five" : "is-four");
	rarityTag.textContent = rarity === "5" ? "5-Star" : "4-Star";
	tagsWrap.appendChild(rarityTag);
	if (notes.rateDown) {
		let poolTag = document.createElement("span");
		poolTag.className = "rate-down-tag";
		poolTag.textContent = "Rate-down";
		tagsWrap.appendChild(poolTag);
	}
	header.appendChild(tagsWrap);

	if (notes.preexisting) {
		let note = document.createElement("p");
		note.className = "char-panel-note";
		note.textContent = "Part of the original launch roster, before this timeline's tracked banners begin — the appearances below are reruns, not a debut.";
		content.appendChild(note);
	}

	let stats = document.createElement("div");
	stats.className = "char-panel-stats";
	stats.textContent = `${entries.length} banner appearance${entries.length === 1 ? "" : "s"}`;
	content.appendChild(stats);

	let list = document.createElement("div");
	list.className = "char-appear-list";
	entries.forEach(entry => list.appendChild(buildAppearanceRow(entry)));
	content.appendChild(list);

	document.getElementById("charPanel").classList.add("is-open");
	document.getElementById("charPanel").setAttribute("aria-hidden", "false");
	document.getElementById("charPanelBackdrop").classList.add("is-open");
	document.body.classList.add("panel-open");
}

function closeCharPanel() {
	document.getElementById("charPanel").classList.remove("is-open");
	document.getElementById("charPanel").setAttribute("aria-hidden", "true");
	document.getElementById("charPanelBackdrop").classList.remove("is-open");
	document.body.classList.remove("panel-open");
}

function initCharPanel() {
	document.getElementById("timelineRoot").addEventListener("click", e => {
		let trigger = e.target.closest(".char-trigger");
		if (trigger) openCharPanel(trigger.dataset.character);
	});
	document.getElementById("timelineRoot").addEventListener("keydown", e => {
		if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("char-trigger")) {
			e.preventDefault();
			openCharPanel(e.target.dataset.character);
		}
	});
	document.getElementById("charPanelClose").addEventListener("click", closeCharPanel);
	document.getElementById("charPanelBackdrop").addEventListener("click", closeCharPanel);
	document.addEventListener("keydown", e => {
		if (e.key === "Escape") closeCharPanel();
	});
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

function buildPatchRow(entry, charCount) {
	let version = entry.version;
	let row = document.createElement("div");
	row.className = "vt-row vt-patch-row container";

	let marker = document.createElement("div");
	marker.className = "vt-patch-marker";
	marker.textContent = version;
	row.appendChild(buildMarkerCol(marker));

	let content = document.createElement("div");
	content.className = "vt-content";

	let phasesWrap = document.createElement("div");
	phasesWrap.className = "vt-phases";
	let realPhaseCount = 0;
	let phaseCards = [];
	for (let p = 0; p < entry.banner.length; p++) {
		let phase = entry.banner[p];
		let notes = phaseNotes[`${version}-${p + 1}`] || {};
		let isFiller = !!notes.filler;
		let label = isFiller ? "Filler" : `Phase ${++realPhaseCount}`;
		let card = buildNode(version, label, phase, charCount, isFiller, false);
		phasesWrap.appendChild(card);
		phaseCards.push(card);
	}

	if (entry.chronicled) {
		let c = entry.chronicled;
		let label = `Chronicled Wish — ${c.theme}`;
		let chronicledCard = buildNode(version, label, c, charCount, false, true);
		let afterCard = phaseCards[c.phase - 1];
		if (afterCard) afterCard.insertAdjacentElement("afterend", chronicledCard);
		else phasesWrap.appendChild(chronicledCard);
	}

	content.appendChild(phasesWrap);

	row.appendChild(content);
	return row;
}

function buildVersionBlock(group, charCount) {
	let block = document.createElement("div");
	block.className = "vt-block";
	block.id = `v-section-${group.major}`;
	block.appendChild(buildMajorRow(group));
	for (let v = 0; v < group.versions.length; v++) {
		let entry = group.versions[v];
		block.appendChild(buildPatchRow(entry, charCount));
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
		let headerH = document.querySelector(".site-header").offsetHeight;
		let top = target.offsetTop - headerH - 12;
		window.scrollTo({ top, behavior: "smooth" });
		history.pushState(null, "", `#${a.dataset.target}`);
	});
}

function init(data) {
	let groups = groupByMajor(data);
	let charCount = {};
	let root = document.getElementById("timelineRoot");
	let majorBlocks = [];

	groups.forEach(group => {
		let block = buildVersionBlock(group, charCount);
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
			}
		});
	}, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
	majorBlocks.forEach(block => navObserver.observe(block));
}

function syncHeaderHeight() {
	let header = document.querySelector(".site-header");
	let sync = () => document.documentElement.style.setProperty("--header-h", `${header.offsetHeight}px`);
	sync();
	new ResizeObserver(sync).observe(header);
}

async function loadJSON(path) {
	let res = await fetch(path);
	if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
	return res.json();
}

async function bootstrap() {
	try {
		let [data, notes, phases, versions, elements] = await Promise.all([
			loadJSON("data/data.json"),
			loadJSON("data/character-notes.json"),
			loadJSON("data/phase-notes.json"),
			loadJSON("data/version-notes.json"),
			loadJSON("data/character-elements.json")
		]);
		characterNotes = notes;
		phaseNotes = phases;
		versionMeta = versions;
		characterElements = elements;

		init(data);
		initCharPanel();
		syncHeaderHeight();

		let t2v2 = new Date().getTime();
		document.getElementById("loadTime").innerHTML = `Loading Time - ${t2v2 - t1v2}ms`;
	} catch (err) {
		console.error(err);
		document.getElementById("timelineRoot").textContent = "Failed to load banner data — please refresh the page.";
	}
}

bootstrap();
