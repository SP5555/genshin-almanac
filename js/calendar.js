// Year-view calendar — the same banner history as a spreadsheet-shaped grid
// instead of a line. Three event layers are plotted: version launches,
// character debuts, and birthdays.
const CALENDAR_MIN_YEAR = 2020; // 1.0's real launch year
// Sunday-first (matches Date.getDay()'s native order) — not the Monday-first
// convention clocks.js uses, which is specific to Genshin's reset schedule.
const CALENDAR_WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

// Relative to previewNow(), not hardcoded, so the ?fakeDate= dev override
// can exercise the upper bound too.
function calendarMaxYear() {
	return previewNow().getFullYear() + 1;
}

function clampYear(year) {
	return Math.min(calendarMaxYear(), Math.max(CALENDAR_MIN_YEAR, year));
}

function getYearFromUrl() {
	let parsed = parseInt(new URLSearchParams(location.search).get("year"), 10);
	return isNaN(parsed) ? previewNow().getFullYear() : clampYear(parsed);
}

// "YYYY-MM-DD" -> version string. Built once at bootstrap.
let versionLaunches = new Map();
// Major version ("6", "7", ...) -> {region, bgImage, ...}, for the day
// panel's region-art header.
let versionMeta = {};
// "YYYY-MM-DD" -> {five: [names], four: [names]}, every character's true
// first appearance. Built once at bootstrap (buildDebutsByDate).
let debutsByDate = new Map();

// Mirrors app.js's realPhaseCount logic (filler phases don't consume a
// phase number) so labels match what the Timeline would call the same phase.
function getPhaseLabel(entry, phaseIndex, phaseNotes) {
	let isFiller = i => !!(phaseNotes[`${entry.version}-${i + 1}`] || {}).filler;
	if (isFiller(phaseIndex)) return "Filler";
	let realCount = 0;
	for (let i = 0; i <= phaseIndex; i++) {
		if (!isFiller(i)) realCount++;
	}
	return `Phase ${realCount}`;
}

// Same "first appearance = debut" rule as landing.js's getDebuts(), but
// per-phase since a version's phases can land on different calendar days.
function buildDebutsByDate(data, notes, phaseNotes) {
	let map = new Map();
	for (let vi = 0; vi < data.length; vi++) {
		let entry = data[vi];
		for (let pi = 0; pi < entry.banner.length; pi++) {
			let phase = entry.banner[pi];
			let five = [];
			let four = [];
			for (let rarity of ["5", "4"]) {
				let bucket = rarity === "5" ? five : four;
				for (let name of phase[rarity]) {
					let charNotes = notes[name] || {};
					if (charNotes.preexisting) continue;
					if (countAppearancesThrough(data, vi, pi, name) === 1) {
						bucket.push({ name, rateDown: !!charNotes.rateDown });
					}
				}
			}
			if (five.length === 0 && four.length === 0) continue;
			let date = getPhaseStartDate(entry, pi, phaseNotes);
			map.set(date, { version: entry.version, phaseLabel: getPhaseLabel(entry, pi, phaseNotes), five, four });
		}
	}
	return map;
}

// Character name -> element, for the day-panel card's element icon.
let characterElements = {};
// Character name -> "5"/"4" (first sighting is authoritative).
let characterRarity = {};
// "MM-DD" -> "YYYY-MM-DD" per character, characterBirthdays inverted for
// direct lookup. Feb 29 needs no special-casing — buildMonthCard only ever
// creates that cell in real leap years.
let birthdaysByMonthDay = new Map();
// Character name -> "YYYY-MM-DD" (see buildCharacterDebutDate below).
let characterDebutDate = {};
// character-notes.json's raw contents — kept at module scope since
// renderCharacterPanel() needs it too, not just the build functions below.
let characterNotes = {};
// Character name -> array of alternate names, for the shared char-search
// (see initCharSearch() in shared.js — same data Timeline's search uses).
let characterAliases = {};
// Character name -> ordered list of every appearance, a pure-data mirror
// of app.js's characterIndex (see buildCharacterAppearances below).
let characterAppearances = {};
// "YYYY-MM-DD" -> {version, phaseLabel, variant, five: [...], four: [...]}
// — every character featured on that date's phase, not just those debuting
// (unlike debutsByDate above). Grouped from characterAppearances rather
// than its own scan, so a jump/click landing on a pure-rerun, Chronicled,
// or Lightrace phase date still shows real content instead of an empty
// panel. Doesn't drive the day-cell dots — those stay debut-only
// (debutsByDate), a deliberate call to keep the mini-grid calm rather than
// mark every rerun.
let bannersByDate = new Map();

// Scans chronicled (and lightrace's "5" array) too, not just banner[] — a
// character can be preexisting and only ever reran via Chronicled (e.g.
// Diluc, Jean: real 5-stars with no regular featured phase in data.json).
function buildCharacterRarity(data) {
	let map = {};
	function record(name, rarity) {
		if (!(name in map)) map[name] = rarity;
	}
	for (let entry of data) {
		for (let phase of entry.banner) {
			for (let rarity of ["5", "4"]) {
				for (let name of phase[rarity]) record(name, rarity);
			}
		}
		if (entry.chronicled) {
			for (let rarity of ["5", "4"]) {
				for (let name of (entry.chronicled[rarity] || [])) record(name, rarity);
			}
		}
		if (entry.lightrace) {
			for (let name of (entry.lightrace["5"] || [])) record(name, "5");
		}
	}
	return map;
}

function buildBirthdaysByMonthDay(birthdays) {
	let map = new Map();
	for (let name of Object.keys(birthdays)) {
		let monthDay = birthdays[name];
		if (!map.has(monthDay)) map.set(monthDay, []);
		map.get(monthDay).push(name);
	}
	return map;
}

// A character's own birthday shouldn't show before they existed. Full
// dates, not just years — a year-only cutoff let a birthday land before the
// actual debut within that same year (caught via the 11 "preexisting"
// 1.0-launch characters, whose birthdays could precede the real Sep 28
// launch). Preexisting characters use that real 1.0 launch date instead of
// their eventual banner date.
function buildCharacterDebutDate(data, phaseNotes, notes) {
	let map = {};
	for (let entry of data) {
		for (let pi = 0; pi < entry.banner.length; pi++) {
			let phase = entry.banner[pi];
			let date = getPhaseStartDate(entry, pi, phaseNotes);
			for (let rarity of ["5", "4"]) {
				for (let name of phase[rarity]) {
					if (!(name in map)) map[name] = date;
				}
			}
		}
	}
	let launchDate = data[0].date;
	for (let name of Object.keys(notes)) {
		if (notes[name].preexisting) map[name] = launchDate;
	}
	return map;
}

// Pure-data mirror of app.js's characterIndex — built here instead of
// reusing app.js's, since that only exists as a side effect of rendering
// the entire Timeline DOM (see CLAUDE.md's Multi-page architecture note).
// Processes phases/chronicled/lightrace in the same per-version order as
// app.js's buildPatchRow, so rerun counts line up identically.
function buildCharacterAppearances(data, notes, phaseNotes) {
	let index = {};
	let counts = {};
	function record(character, rarity, version, phaseLabel, isFiller, variant, date) {
		let charNotes = notes[character] || {};
		counts[character] = (counts[character] || 0) + 1;
		let count = counts[character];
		let isRelease = !charNotes.preexisting && count === 1;
		(index[character] = index[character] || []).push({
			version, phaseLabel, rarity, isRelease, rerun: count - 1,
			rateDown: !!charNotes.rateDown, preexisting: !!charNotes.preexisting, isFiller, variant, date
		});
	}
	for (let entry of data) {
		for (let pi = 0; pi < entry.banner.length; pi++) {
			let phase = entry.banner[pi];
			let phaseLabel = getPhaseLabel(entry, pi, phaseNotes);
			let date = getPhaseStartDate(entry, pi, phaseNotes);
			for (let rarity of ["5", "4"]) {
				for (let name of phase[rarity]) record(name, rarity, entry.version, phaseLabel, phaseLabel === "Filler", null, date);
			}
		}
		if (entry.chronicled) {
			let c = entry.chronicled;
			// No exact chronicled-banner date is tracked anywhere on this site —
			// reusing the parent phase's own start date is the closest real anchor.
			let date = getPhaseStartDate(entry, c.phase - 1, phaseNotes);
			let label = `Chronicled Wish — ${c.theme}`;
			for (let rarity of ["5", "4"]) {
				for (let name of (c[rarity] || [])) record(name, rarity, entry.version, label, false, "chronicled", date);
			}
		}
		if (entry.lightrace) {
			let l = entry.lightrace;
			let date = getPhaseStartDate(entry, l.phase - 1, phaseNotes);
			// No "4" array by design (see app.js) — every 4-star is eligible.
			for (let name of (l["5"] || [])) record(name, "5", entry.version, "Lightrace Wish", false, "lightrace", date);
		}
	}
	return index;
}

// One date can host more than one distinct banner — Chronicled/Lightrace
// share their parent phase's exact date by design (see
// buildCharacterAppearances), and app.js's own insertAfterPhase already
// anticipates a version with both attached to the same phase. Grouping by
// date alone would merge unrelated banners together, so each date maps to
// an array of groups, keyed by (version, phaseLabel) within that date.
function buildBannersByDate(appearances) {
	let byDate = new Map();
	for (let name of Object.keys(appearances)) {
		for (let entry of appearances[name]) {
			if (!byDate.has(entry.date)) byDate.set(entry.date, new Map());
			let groups = byDate.get(entry.date);
			let key = `${entry.version}|${entry.phaseLabel}`;
			if (!groups.has(key)) {
				groups.set(key, { version: entry.version, phaseLabel: entry.phaseLabel, variant: entry.variant, date: entry.date, five: [], four: [] });
			}
			let group = groups.get(key);
			(entry.rarity === "5" ? group.five : group.four).push({
				name, isRelease: entry.isRelease, rerun: entry.rerun, rateDown: entry.rateDown, preexisting: entry.preexisting
			});
		}
	}
	let map = new Map();
	for (let [date, groups] of byDate) map.set(date, [...groups.values()]);
	return map;
}

// Filters a birthday match down to whoever had actually debuted by this
// date (see buildCharacterDebutDate). Returns null, not [], matching
// birthdaysByMonthDay's own "no entry" convention.
function getBirthdaysForDate(isoDate) {
	let names = birthdaysByMonthDay.get(isoDate.slice(5));
	if (!names) return null;
	let filtered = names.filter(name => isoDate >= (characterDebutDate[name] ?? "9999-99-99"));
	return filtered.length > 0 ? filtered : null;
}

async function loadCalendarData() {
	try {
		let [dataRes, metaRes, notesRes, phaseNotesRes, elementsRes, birthdaysRes, aliasesRes] = await Promise.all([
			fetch("data/data.json"),
			fetch("data/version-notes.json"),
			fetch("data/character-notes.json"),
			fetch("data/phase-notes.json"),
			fetch("data/character-elements.json"),
			fetch("data/character-birthdays.json"),
			fetch("data/character-aliases.json"),
		]);
		let data = dataRes.ok ? await dataRes.json() : null;
		if (data) data.forEach(entry => { versionLaunches.set(entry.date, entry.version); });
		if (metaRes.ok) versionMeta = await metaRes.json();
		if (elementsRes.ok) characterElements = await elementsRes.json();
		if (aliasesRes.ok) characterAliases = await aliasesRes.json();
		if (data) characterRarity = buildCharacterRarity(data);
		if (birthdaysRes.ok) birthdaysByMonthDay = buildBirthdaysByMonthDay(await birthdaysRes.json());
		let notes = notesRes.ok ? await notesRes.json() : {};
		characterNotes = notes;
		let phaseNotes = phaseNotesRes.ok ? await phaseNotesRes.json() : {};
		if (data) {
			debutsByDate = buildDebutsByDate(data, notes, phaseNotes);
			characterDebutDate = buildCharacterDebutDate(data, phaseNotes, notes);
			characterAppearances = buildCharacterAppearances(data, notes, phaseNotes);
			bannersByDate = buildBannersByDate(characterAppearances);
		}
	} catch (err) {
		console.error(err);
	}
}

function buildMonthCard(year, month, today) {
	let card = document.createElement("div");
	card.className = "calendar-month-card";
	// Lets jumpToDate()/jumpToToday() find this month's card by month index.
	card.dataset.month = month;

	let title = document.createElement("div");
	title.className = "calendar-month-title";
	title.textContent = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long" });
	card.appendChild(title);

	let weekdayRow = document.createElement("div");
	weekdayRow.className = "calendar-weekday-row";
	CALENDAR_WEEKDAY_LETTERS.forEach(letter => {
		let el = document.createElement("span");
		el.className = "calendar-weekday-letter";
		el.textContent = letter;
		weekdayRow.appendChild(el);
	});
	card.appendChild(weekdayRow);

	let dayGrid = document.createElement("div");
	dayGrid.className = "calendar-day-grid";
	// getDay() is already Sunday-first — matches CALENDAR_WEEKDAY_LETTERS directly.
	let firstWeekday = new Date(year, month, 1).getDay();
	let daysInMonth = new Date(year, month + 1, 0).getDate(); // day 0 of next month = last day of this one

	for (let i = 0; i < firstWeekday; i++) {
		let blank = document.createElement("div");
		blank.className = "calendar-day-cell is-empty";
		dayGrid.appendChild(blank);
	}
	for (let day = 1; day <= daysInMonth; day++) {
		let cell = document.createElement("div");
		cell.className = "calendar-day-cell is-clickable";
		cell.tabIndex = 0;
		cell.setAttribute("role", "button");
		if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day) {
			cell.classList.add("is-today");
		}
		// Number + dots share one row (glued together) rather than the dots
		// floating in the opposite corner — a corner-positioned dot read as
		// belonging to the wrong day at this cell width.
		let top = document.createElement("span");
		top.className = "calendar-day-top";
		let num = document.createElement("span");
		num.className = "calendar-day-number";
		num.textContent = String(day);
		top.appendChild(num);

		let isoDate = toIsoDate(new Date(year, month, day));
		cell.dataset.date = isoDate;
		let launchVersion = versionLaunches.get(isoDate);
		if (launchVersion) {
			cell.classList.add("has-event");
			let label = document.createElement("span");
			label.className = "calendar-day-event";
			label.textContent = launchVersion;
			cell.appendChild(label);
		}

		// Full names are left to the day panel — a handful of tiny circles is
		// all this cell size can carry.
		let debuts = debutsByDate.get(isoDate);
		let banners = bannersByDate.get(isoDate);
		let birthdayNames = getBirthdaysForDate(isoDate);
		if (debuts || banners || birthdayNames) {
			let dots = document.createElement("span");
			dots.className = "calendar-day-markers";
			if (debuts && debuts.five.length > 0) {
				let dot = document.createElement("span");
				dot.className = "calendar-day-marker-dot is-five";
				dots.appendChild(dot);
			}
			if (debuts && debuts.four.length > 0) {
				let dot = document.createElement("span");
				dot.className = "calendar-day-marker-dot is-four";
				dots.appendChild(dot);
			}
			// A plain "something's running here" dot for banners with zero
			// real debuts (reruns, Chronicled, Lightrace, all sharing this one
			// neutral marker rather than three more dot types) — only ever
			// needed when neither debut dot above already fired, so it never
			// stacks a 4th dot onto an already-multi-dot day; the mini-grid's
			// max dot count per cell stays exactly what it was.
			if (!debuts && banners) {
				let dot = document.createElement("span");
				dot.className = "calendar-day-marker-dot is-banner";
				dots.appendChild(dot);
			}
			if (birthdayNames) {
				let dot = document.createElement("span");
				dot.className = "calendar-day-marker-dot is-birthday";
				dots.appendChild(dot);
			}
			top.appendChild(dots);
		}

		cell.appendChild(top);
		dayGrid.appendChild(cell);
	}

	card.appendChild(dayGrid);
	return card;
}

function renderCalendarYear(year) {
	let grid = document.getElementById("calendarMonthGrid");
	grid.replaceChildren();
	let today = previewNow();
	for (let month = 0; month < 12; month++) {
		grid.appendChild(buildMonthCard(year, month, today));
	}
}

let currentYear;

// Two stepper instances (top and below the grid) kept in sync by operating
// on every matching element via class rather than a single getElementById.
function updateYearLabel() {
	document.querySelectorAll(".calendar-year-label").forEach(el => { el.textContent = String(currentYear); });
	document.querySelectorAll(".calendar-year-arrow.is-prev").forEach(el => { el.disabled = currentYear <= CALENDAR_MIN_YEAR; });
	document.querySelectorAll(".calendar-year-arrow.is-next").forEach(el => { el.disabled = currentYear >= calendarMaxYear(); });
}

function closeAllYearPopovers() {
	document.querySelectorAll(".calendar-year-popover").forEach(p => { p.hidden = true; });
	document.querySelectorAll(".calendar-year-label").forEach(l => { l.setAttribute("aria-expanded", "false"); });
}

function openYearPopover(popover, label) {
	popover.querySelectorAll(".calendar-year-option").forEach(btn => {
		btn.classList.toggle("is-active", btn.textContent === String(currentYear));
	});
	popover.hidden = false;
	label.setAttribute("aria-expanded", "true");
	popover.querySelector(".calendar-year-option.is-active")?.scrollIntoView({ block: "nearest" });
}

function setYear(year) {
	currentYear = clampYear(year);
	updateYearLabel();
	renderCalendarYear(currentYear);
	let url = new URL(location.href);
	url.searchParams.set("year", String(currentYear));
	history.replaceState(null, "", url);
	closeAllYearPopovers();
}

function buildYearPopovers() {
	document.querySelectorAll(".calendar-year-popover").forEach(popover => {
		popover.replaceChildren();
		for (let year = CALENDAR_MIN_YEAR; year <= calendarMaxYear(); year++) {
			let btn = document.createElement("button");
			btn.type = "button";
			btn.className = "calendar-year-option";
			btn.textContent = String(year);
			btn.addEventListener("click", () => setYear(year));
			popover.appendChild(btn);
		}
	});
}

// ---------- day detail panel ----------
// Reuses the shared detail-panel component from timeline.html/app.js
// (style.css) rather than building a second popup/bottom-sheet from scratch.

// Debut card: namecard art on its own layer (so hover-zoom transforms just
// the art), rarity-colored avatar ring, variant ("five"/"four") picks the
// card's accent. Birthdays don't use this — see buildBirthdayChip below;
// they're light/recurring, not a one-time historical fact like a debut.
function buildCharacterCard(name, variant, badges) {
	let card = document.createElement("div");
	card.className = "calendar-day-card is-" + variant;
	card.dataset.character = name;
	card.tabIndex = 0;
	card.setAttribute("role", "button");
	card.setAttribute("aria-label", `View ${name}'s appearance history`);

	let art = document.createElement("div");
	art.className = "calendar-day-card-art";
	let namecardPath = `assets/namecards/${name.replace(/\s/g, "").toLowerCase()}.jpg`;
	art.style.backgroundImage = `url(${namecardPath})`;
	card.appendChild(art);

	let scrim = document.createElement("div");
	scrim.className = "calendar-day-card-scrim";
	card.appendChild(scrim);

	let rarity = characterRarity[name];
	let avatarWrap = document.createElement("div");
	avatarWrap.className = "avatar-wrap avatar-wrap-lg";
	avatarWrap.appendChild(faceImg(name, "phase-face-lg is-release" + (rarity === "4" ? " rarity-four" : "")));
	card.appendChild(avatarWrap);

	let info = document.createElement("div");
	info.className = "calendar-day-card-info";
	let nameEl = document.createElement("span");
	nameEl.className = "calendar-day-card-name";
	nameEl.textContent = name;
	info.appendChild(nameEl);

	let badgesWrap = document.createElement("div");
	badgesWrap.className = "calendar-day-card-badges";
	badges.forEach(b => {
		let el = document.createElement("span");
		el.className = b.className;
		el.textContent = b.text;
		if (b.title) el.title = b.title;
		badgesWrap.appendChild(el);
	});
	let element = characterElements[name];
	if (element) {
		let elIcon = document.createElement("img");
		elIcon.className = "calendar-day-card-element";
		elIcon.src = `assets/elements/${element.toLowerCase()}.svg`;
		elIcon.alt = element;
		elIcon.title = element;
		badgesWrap.appendChild(elIcon);
	}
	info.appendChild(badgesWrap);
	card.appendChild(info);

	return card;
}

// Same DOM/CSS as app.js's own version (.char-appear-*, shared in
// style.css) — the only real difference is the version text jumps to that
// phase's calendar date (jumpToDate) instead of a Timeline phase card.
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
	ver.setAttribute("aria-label", `Jump to ${entry.version} ${entry.phaseLabel} on the calendar`);
	onActivate(ver, () => jumpToDate(entry.date));
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

// A character's own appearance history, pushed onto the panel stack from a
// debut/birthday card click — mirrors app.js's openCharPanel (same shared
// .detail-panel-* classes). Render-only; opening/showing the panel is
// handled once, by whichever function actually opens it fresh.
function renderCharacterPanel(name) {
	let entries = characterAppearances[name] || [];
	let notes = characterNotes[name] || {};
	let header = document.getElementById("detailPanelHeader");
	let content = document.getElementById("detailPanelContent");
	header.innerHTML = "";
	content.innerHTML = "";
	header.classList.remove("is-compact");
	content.scrollTop = 0;

	let element = characterElements[name];
	if (element) {
		content.style.backgroundImage =
			`linear-gradient(rgba(13,13,20,0.94), rgba(13,13,20,0.94)), url(assets/elements/${element.toLowerCase()}.svg)`;
	} else {
		content.style.backgroundImage = "";
	}

	let rarity = characterRarity[name];
	buildCharacterHeader(header, name, rarity, notes);

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
}

// Just a ringed avatar + name, no card/art — birthdays sit in a wrapped row
// rather than the debut cards' stacked list (see buildCharacterCard). Ring
// is always the birthday accent regardless of the character's own rarity.
function buildBirthdayChip(name) {
	let chip = document.createElement("div");
	chip.className = "calendar-birthday-chip";
	chip.dataset.character = name;
	chip.tabIndex = 0;
	chip.setAttribute("role", "button");
	chip.setAttribute("aria-label", `View ${name}'s appearance history`);
	chip.appendChild(faceImg(name, "calendar-birthday-face"));
	let nameEl = document.createElement("span");
	nameEl.className = "calendar-birthday-name";
	nameEl.textContent = name;
	chip.appendChild(nameEl);
	return chip;
}

// Compact summary of a full banner — same DOM/CSS as Timeline's own
// .trail-node.phase-card (app.js's buildNode), so a banner reads
// identically wherever it's shown. Unlike buildCharacterCard above (which
// is used for debuts only, one big art card per character), this shows
// every character on the banner at once, release or rerun — the reason it
// exists: an 18-character Chronicled Wish as individual art cards would be
// a lot of scrolling for one day. No release-glow rays (buildRays()/
// GLOW_CONFIG are Timeline-only, gated behind glow-config.js which this
// page doesn't load) — release characters get the plain ring glow instead.
function buildPhaseCard(banner) {
	let card = document.createElement("div");
	card.className = "trail-node phase-card calendar-phase-card" + (banner.variant ? ` is-${banner.variant}` : "");

	let badge = document.createElement("div");
	badge.className = "phase-tag";
	badge.textContent = `${banner.version} — ${banner.phaseLabel}`;
	card.appendChild(badge);

	let body = document.createElement("div");
	body.className = "phase-card-body";

	let fiveGroup = document.createElement("div");
	fiveGroup.className = "phase-five-group";
	banner.five.forEach(entry => fiveGroup.appendChild(buildPhaseUnit(entry, "five")));
	body.appendChild(fiveGroup);

	if (banner.four.length > 0) {
		let divider = document.createElement("div");
		divider.className = "phase-divider";
		body.appendChild(divider);

		// No column-split here (unlike Timeline's own chronicled/lightrace
		// layout) — just a flat, left-aligned row that wraps on its own via
		// .calendar-phase-card's flex-wrap (calendar.css).
		let fourGroup = document.createElement("div");
		fourGroup.className = "phase-four-group";
		banner.four.forEach(entry => fourGroup.appendChild(buildPhaseUnit(entry, "four")));
		body.appendChild(fourGroup);
	} else if (banner.variant === "lightrace") {
		let divider = document.createElement("div");
		divider.className = "phase-divider";
		body.appendChild(divider);

		// characterAppearances (not characterRarity, which skips chronicled
		// entries entirely and isn't date-scoped) so this matches app.js's
		// characterIndex-derived count exactly, including chronicled-only
		// 4-stars (e.g. Amber, Kaeya, Lisa) and excluding anyone who only
		// debuted after this particular Lightrace instance's own date.
		let fourStarCount = Object.keys(characterAppearances).filter(n => {
			let entries = characterAppearances[n];
			return entries[0].rarity === "4" && entries.some(e => e.date <= banner.date);
		}).length;
		let summary = document.createElement("div");
		summary.className = "phase-four-summary";
		summary.append("Every 4-star character", document.createElement("br"), `released so far (${fourStarCount})`);
		body.appendChild(summary);
	}

	card.appendChild(body);
	return card;
}

// Each unit is clickable (dataset.character), same as the debut cards and
// birthday chips — delegated on #detailPanelContent in initDayPanel below.
function buildPhaseUnit(entry, size) {
	let isFive = size === "five";
	let unit = document.createElement("div");
	unit.className = (isFive ? "phase-five-unit" : "phase-four-unit") + " char-trigger";
	unit.dataset.character = entry.name;
	unit.tabIndex = 0;
	unit.setAttribute("role", "button");
	unit.setAttribute("aria-label", `View ${entry.name}'s appearance history`);

	let avatarWrap = document.createElement("div");
	avatarWrap.className = "avatar-wrap " + (isFive ? "avatar-wrap-lg" : "avatar-wrap-sm") + (entry.isRelease ? " is-release" : "");
	avatarWrap.appendChild(faceImg(entry.name, (isFive ? "phase-face-lg" : "char-face-sm") + (entry.isRelease ? " is-release" : "")));
	unit.appendChild(avatarWrap);

	if (isFive) {
		let text = document.createElement("div");
		text.className = "phase-five-text";
		let name = document.createElement("span");
		name.className = "char-name" + (entry.isRelease ? " is-release" : "");
		name.textContent = entry.name;
		text.appendChild(name);
		if (!entry.preexisting) text.appendChild(appearanceTag(entry));
		if (entry.rateDown) {
			let poolTag = document.createElement("span");
			poolTag.className = "rate-down-tag";
			poolTag.textContent = "Rate-down";
			poolTag.title = "Not a truly exclusive/limited character — already available via the standard rate-down pool";
			text.appendChild(poolTag);
		}
		unit.appendChild(text);
	} else {
		let name = document.createElement("span");
		name.className = "char-name" + (entry.isRelease ? " is-release" : "");
		name.textContent = entry.name;
		unit.appendChild(name);
	}

	return unit;
}

function appearanceTag(entry) {
	let tag = document.createElement("span");
	tag.className = "rerun-tag" + (entry.rerun === 0 ? " is-first" : "");
	tag.textContent = entry.rerun === 0 ? "Release" : `Rerun ${entry.rerun}`;
	return tag;
}

// UI stack for the shared detail panel — a debut/birthday card click pushes
// a character view without opening a second overlapping popup.
// openDayPanel() is the only thing that resets the stack.
let panelStack = [];

function renderPanelTop() {
	let top = panelStack[panelStack.length - 1];
	if (!top) return;
	document.querySelectorAll(".detail-panel-back").forEach(btn => { btn.hidden = panelStack.length <= 1; });
	if (top.type === "day") renderDayPanel(top.isoDate);
	else if (top.type === "character") renderCharacterPanel(top.name);
}

// Animates a stack navigation (push/pop) via the shared swapWithFade()
// (shared.js) rather than snapping straight to the new content — header
// and content fade out/in together while the panel itself resizes to the
// new view's natural height.
function swapPanelView() {
	let panel = document.getElementById("detailPanel");
	let header = document.getElementById("detailPanelHeader");
	let content = document.getElementById("detailPanelContent");
	swapWithFade(panel, [header, content], renderPanelTop);
}

function pushPanelView(view) {
	panelStack.push(view);
	swapPanelView();
}

function popPanelView() {
	if (panelStack.length > 1) panelStack.pop();
	swapPanelView();
}

function renderDayPanel(isoDate) {
	let header = document.getElementById("detailPanelHeader");
	let content = document.getElementById("detailPanelContent");
	header.innerHTML = "";
	content.innerHTML = "";
	header.style.backgroundImage = "";
	content.style.backgroundImage = "";
	header.classList.remove("is-compact");
	header.classList.remove("is-character");
	content.scrollTop = 0;

	let dateObj = new Date(isoDate + "T00:00:00");
	let dateText = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

	// Always a small corner label, not the headline — .detail-panel-name is
	// shared with Timeline's character panel, where the character name is
	// the thing that should stay big.
	let dateLabel = document.createElement("span");
	dateLabel.className = "calendar-panel-date-corner";
	dateLabel.textContent = dateText;
	header.appendChild(dateLabel);

	let launchVersion = versionLaunches.get(isoDate);
	if (launchVersion) {
		let versionEl = document.createElement("h2");
		versionEl.className = "detail-panel-name";
		versionEl.textContent = `Version ${launchVersion} launch`;
		header.appendChild(versionEl);

		// Same per-version region-art recipe as Timeline/landing's ambient
		// background — reuses the 7 already-sourced region images.
		let meta = versionMeta[launchVersion.split(".")[0]];
		if (meta && meta.bgImage) {
			header.style.backgroundImage =
				`linear-gradient(to bottom, rgba(13,13,20,0.45), rgba(13,13,20,0.94)), url(assets/regions/${meta.bgImage}.jpg)`;
		}
	} else {
		// No region art either — a persistently-tall empty header would waste
		// space on the ~345 days a year this applies to.
		header.classList.add("is-compact");
	}

	// Shows every character featured on this date's phase, not just those
	// debuting — so jumping here from a rerun/Chronicled/Lightrace row in a
	// character's own appear-list (jumpToDate) never lands on an empty panel.
	// Debuts stay their own thing — a true first appearance, called out with
	// its own big art card (buildCharacterCard), never mixed in with
	// everyone else on the same banner (that's the phase card below).
	let debuts = debutsByDate.get(isoDate);
	if (debuts) {
		let heading = document.createElement("div");
		heading.className = "detail-panel-stats";
		let total = debuts.five.length + debuts.four.length;
		heading.textContent =
			`${total} character debut${total === 1 ? "" : "s"} — Version ${debuts.version}, ${debuts.phaseLabel}`;
		content.appendChild(heading);

		let list = document.createElement("div");
		list.className = "calendar-day-card-list";
		[...debuts.five.map(d => ({ ...d, rarity: "5" })), ...debuts.four.map(d => ({ ...d, rarity: "4" }))]
			.forEach(({ name, rarity, rateDown }) => {
				let badges = [rarityBadge(rarity)];
				if (rateDown) {
					badges.push({
						className: "rate-down-tag", text: "Rate-down",
						title: "Not a truly exclusive/limited character — already available via the standard rate-down pool",
					});
				}
				list.appendChild(buildCharacterCard(name, rarity === "5" ? "five" : "four", badges));
			});
		content.appendChild(list);
	}

	// The full banner(s) running this date — everyone featured, release or
	// rerun, as a compact card rather than individual art cards (see
	// buildPhaseCard). A date can host more than one distinct banner (e.g. a
	// regular phase AND a Chronicled Wish attached to it, sharing that
	// phase's start date) — see buildBannersByDate.
	let banners = bannersByDate.get(isoDate) || [];
	if (banners.length > 0) {
		let heading = document.createElement("div");
		heading.className = "detail-panel-stats";
		heading.textContent = `Banner${banners.length === 1 ? "" : "s"} running this day`;
		content.appendChild(heading);

		let list = document.createElement("div");
		list.className = "calendar-day-card-list";
		banners.forEach(banner => list.appendChild(buildPhaseCard(banner)));
		content.appendChild(list);
	}

	let birthdayNames = getBirthdaysForDate(isoDate);
	if (birthdayNames) {
		let heading = document.createElement("div");
		heading.className = "detail-panel-stats";
		heading.textContent = `${birthdayNames.length} birthday${birthdayNames.length === 1 ? "" : "s"} today`;
		content.appendChild(heading);

		let row = document.createElement("div");
		row.className = "calendar-birthday-row";
		birthdayNames.forEach(name => row.appendChild(buildBirthdayChip(name)));
		content.appendChild(row);
	}

	if (banners.length === 0 && !birthdayNames) {
		let stub = document.createElement("p");
		stub.className = "detail-panel-note";
		stub.textContent = "Nothing else tracked for this day yet.";
		content.appendChild(stub);
	}
}

// Entry point for opening the panel fresh — resets the stack to just one
// view. Pushing/popping only re-renders content; this is the one place
// that toggles is-open/the backdrop/scroll-lock.
function openPanelFresh(view) {
	panelStack = [view];
	renderPanelTop();
	document.getElementById("detailPanel").classList.add("is-open");
	document.getElementById("detailPanel").setAttribute("aria-hidden", "false");
	document.getElementById("detailPanelBackdrop").classList.add("is-open");
	document.body.classList.add("panel-open");
	document.documentElement.classList.add("panel-open");
}

function openDayPanel(isoDate) {
	openPanelFresh({ type: "day", isoDate });
}

// Search-result entry point (see initCharSearch() in shared.js) — same
// fresh-open behavior as a day cell, just landing directly on a character.
function openCharacterPanel(name) {
	openPanelFresh({ type: "character", name });
}

function closeDayPanel() {
	let panel = document.getElementById("detailPanel");
	panel.classList.remove("is-open");
	panel.setAttribute("aria-hidden", "true");
	panel.style.height = "";
	// Defensive: a close mid-swap could otherwise leave header/content stuck
	// invisible for whatever's left of swapWithFade()'s pending timeout.
	document.getElementById("detailPanelHeader").classList.remove("is-fading");
	document.getElementById("detailPanelContent").classList.remove("is-fading");
	document.getElementById("detailPanelBackdrop").classList.remove("is-open");
	document.body.classList.remove("panel-open");
	document.documentElement.classList.remove("panel-open");
	panelStack = [];
}

function initDayPanel() {
	let grid = document.getElementById("calendarMonthGrid");
	onDelegatedActivate(grid, ".calendar-day-cell.is-clickable", cell => openDayPanel(cell.dataset.date));
	document.getElementById("detailPanelClose").addEventListener("click", closeDayPanel);
	document.getElementById("detailPanelBackdrop").addEventListener("click", closeDayPanel);
	document.querySelectorAll(".detail-panel-back").forEach(btn => btn.addEventListener("click", popPanelView));
	document.addEventListener("keydown", e => {
		if (e.key === "Escape") closeDayPanel();
	});

	// Delegated on the stable #detailPanelContent ancestor rather than
	// re-attached per card, since its innerHTML gets fully replaced on
	// every render.
	let content = document.getElementById("detailPanelContent");
	onDelegatedActivate(content, ".calendar-day-card, .calendar-birthday-chip, .char-trigger",
		trigger => pushPanelView({ type: "character", name: trigger.dataset.character }));

	// A qualifying swipe is always a full close, same as tapping the
	// backdrop — never a stack pop. The mobile-bar's own Back button is the
	// explicit "go back one level" affordance instead.
	initPanelGrabberDrag(closeDayPanel);
}
initDayPanel();

document.querySelectorAll(".calendar-year-arrow.is-prev").forEach(btn => btn.addEventListener("click", () => setYear(currentYear - 1)));
document.querySelectorAll(".calendar-year-arrow.is-next").forEach(btn => btn.addEventListener("click", () => setYear(currentYear + 1)));
document.querySelectorAll(".calendar-year-label-wrap").forEach(wrap => {
	let label = wrap.querySelector(".calendar-year-label");
	let popover = wrap.querySelector(".calendar-year-popover");
	label.addEventListener("click", () => {
		let willOpen = popover.hidden;
		closeAllYearPopovers();
		if (willOpen) openYearPopover(popover, label);
	});
});
document.addEventListener("click", e => {
	if (!e.target.closest(".calendar-year-label-wrap")) closeAllYearPopovers();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeAllYearPopovers(); });

function toIsoDate(date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Generic "jump to a specific day" — switches year if needed, scrolls the
// cell into view, and gives it a temporary highlight ring (same language as
// Timeline's jumpToCard()/.is-highlighted). Not hardcoded to "today" —
// meant to be reused by any future jump feature (search, etc.).
function jumpToDate(isoDate) {
	let year = parseInt(isoDate.slice(0, 4), 10);
	if (currentYear !== year) setYear(year);
	let cell = document.querySelector(`.calendar-day-cell[data-date="${isoDate}"]`);
	if (!cell) return;
	let reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
	cell.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
	cell.classList.add("is-highlighted");
	setTimeout(() => cell.classList.remove("is-highlighted"), 1800);
}

// Explicit button, not an auto-scroll on load — that was tried and
// reconsidered (it fought a reader browsing from the top, or reloading a
// bookmarked link).
function jumpToToday() {
	jumpToDate(toIsoDate(previewNow()));
}
document.querySelectorAll(".calendar-today-btn").forEach(btn => btn.addEventListener("click", jumpToToday));

async function bootstrapCalendar() {
	await loadCalendarData();
	buildYearPopovers();
	setYear(getYearFromUrl());
	initCharSearch(() => Object.keys(characterAppearances), characterAliases, openCharacterPanel);
}
bootstrapCalendar();
