var t1v2 = new Date().getTime();

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
	let notes = (typeof characterNotes !== "undefined" && characterNotes[name]) || {};
	return { name, rateDown: !!notes.rateDown, preexisting: !!notes.preexisting };
}

function buildNode(version, phaseLabel, phase, charCount, isFiller) {
	let card = document.createElement("div");
	card.className = "trail-node phase-card" + (isFiller ? " is-filler" : "");

	let badge = document.createElement("div");
	badge.className = "phase-tag";
	badge.textContent = phaseLabel;
	card.appendChild(badge);

	let fiveGroup = document.createElement("div");
	fiveGroup.className = "phase-five-group";
	for (let i = 0; i < phase["5"].length; i++) {
		let { name: character, rateDown, preexisting } = normalizeChar(phase["5"][i]);
		charCount[character] = (charCount[character] || 0) + 1;
		let count = charCount[character];

		let isRelease = !preexisting && count === 1;

		let unit = document.createElement("div");
		unit.className = "phase-five-unit";
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
			poolTag.textContent = "Rate-down Pool";
			poolTag.title = "Not a truly exclusive/limited character — already available via the standard rate-down pool";
			text.appendChild(poolTag);
		}
		unit.appendChild(text);

		fiveGroup.appendChild(unit);
	}
	card.appendChild(fiveGroup);

	if (phase["4"].length > 0) {
		let divider = document.createElement("div");
		divider.className = "phase-divider";
		card.appendChild(divider);

		let fourGroup = document.createElement("div");
		fourGroup.className = "phase-four-group";
		for (let i = 0; i < phase["4"].length; i++) {
			let { name: character, preexisting: fourPreexisting } = normalizeChar(phase["4"][i]);
			charCount[character] = (charCount[character] || 0) + 1;
			let isFourRelease = !fourPreexisting && charCount[character] === 1;

			let row = document.createElement("div");
			row.className = "phase-four-unit";
			let avatarWrapSm = document.createElement("div");
			avatarWrapSm.className = "avatar-wrap avatar-wrap-sm" + (isFourRelease ? " is-release" : "");
			if (isFourRelease) avatarWrapSm.appendChild(buildRays(GLOW_CONFIG.rays.countSm, "var(--four-glow)"));
			avatarWrapSm.appendChild(faceImg(character, "char-face-sm" + (isFourRelease ? " is-release" : "")));
			row.appendChild(avatarWrapSm);
			let name = document.createElement("span");
			name.className = "char-name" + (isFourRelease ? " is-release" : "");
			name.textContent = character;
			row.appendChild(name);
			fourGroup.appendChild(row);
		}
		card.appendChild(fourGroup);
	}

	return card;
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
	row.id = `v-section-${group.major}`;

	let marker = document.createElement("div");
	marker.className = "vt-major-marker";
	marker.textContent = group.major;
	row.appendChild(buildMarkerCol(marker));

	let content = document.createElement("div");
	content.className = "vt-content";

	let meta = (typeof versionMeta !== "undefined" && versionMeta[group.major]) || {};

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

function buildPatchRow(version, phases, charCount) {
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
	for (let p = 0; p < phases.length; p++) {
		let phase = phases[p];
		let notes = (typeof phaseNotes !== "undefined" && phaseNotes[`${version}-${p + 1}`]) || {};
		let isFiller = !!notes.filler;
		let label = isFiller ? "Filler" : `Phase ${++realPhaseCount}`;
		phasesWrap.appendChild(buildNode(version, label, phase, charCount, isFiller));
	}
	content.appendChild(phasesWrap);

	row.appendChild(content);
	return row;
}

function buildVersionBlock(group, charCount) {
	let block = document.createElement("div");
	block.className = "vt-block";
	block.appendChild(buildMajorRow(group));
	for (let v = 0; v < group.versions.length; v++) {
		let entry = group.versions[v];
		block.appendChild(buildPatchRow(entry.version, entry.banner, charCount));
	}
	return block;
}

function buildVersionNav(groups) {
	let nav = document.getElementById("versionNav");
	groups.forEach(group => {
		let a = document.createElement("a");
		a.href = `#v-section-${group.major}`;
		a.dataset.label = `Version ${group.major}`;
		a.dataset.target = `v-section-${group.major}`;
		nav.appendChild(a);
	});
}

function init(data) {
	let groups = groupByMajor(data);
	let charCount = {};
	let root = document.getElementById("timelineRoot");
	let majorRows = [];

	groups.forEach(group => {
		let block = buildVersionBlock(group, charCount);
		root.appendChild(block);
		majorRows.push(document.getElementById(`v-section-${group.major}`));

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
	majorRows.forEach(row => navObserver.observe(row));
}

init(data);

var t2v2 = new Date().getTime();
document.getElementById("loadTime").innerHTML = `Loading Time - ${t2v2 - t1v2}ms`;
