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

// Same 21-day cadence as landing.js's PHASE_LENGTH_DAYS. Unlike landing.js
// (only needs to be right for the live version), this walks every
// historical phase, so it leans on phase-notes.json's date overrides for
// the known exceptions (1.3's 3-phase structure, 3.0-3.2's compressed
// cadence — see CLAUDE.md).
function getPhaseStartDate(entry, phaseIndex, phaseNotes) {
	let override = (phaseNotes[`${entry.version}-${phaseIndex + 1}`] || {}).date;
	if (override) return override;
	let d = new Date(entry.date + "T00:00:00Z");
	d.setUTCDate(d.getUTCDate() + phaseIndex * 21);
	return d.toISOString().slice(0, 10);
}

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
// Character name -> ordered list of every appearance, a pure-data mirror
// of app.js's characterIndex (see buildCharacterAppearances below).
let characterAppearances = {};

function buildCharacterRarity(data) {
	let map = {};
	for (let entry of data) {
		for (let phase of entry.banner) {
			for (let rarity of ["5", "4"]) {
				for (let name of phase[rarity]) {
					if (!(name in map)) map[name] = rarity;
				}
			}
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
		let [dataRes, metaRes, notesRes, phaseNotesRes, elementsRes, birthdaysRes] = await Promise.all([
			fetch("data/data.json"),
			fetch("data/version-notes.json"),
			fetch("data/character-notes.json"),
			fetch("data/phase-notes.json"),
			fetch("data/character-elements.json"),
			fetch("data/character-birthdays.json"),
		]);
		let data = dataRes.ok ? await dataRes.json() : null;
		if (data) data.forEach(entry => { versionLaunches.set(entry.date, entry.version); });
		if (metaRes.ok) versionMeta = await metaRes.json();
		if (elementsRes.ok) characterElements = await elementsRes.json();
		if (data) characterRarity = buildCharacterRarity(data);
		if (birthdaysRes.ok) birthdaysByMonthDay = buildBirthdaysByMonthDay(await birthdaysRes.json());
		let notes = notesRes.ok ? await notesRes.json() : {};
		characterNotes = notes;
		let phaseNotes = phaseNotesRes.ok ? await phaseNotesRes.json() : {};
		if (data) {
			debutsByDate = buildDebutsByDate(data, notes, phaseNotes);
			characterDebutDate = buildCharacterDebutDate(data, phaseNotes, notes);
			characterAppearances = buildCharacterAppearances(data, notes, phaseNotes);
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
		let birthdayNames = getBirthdaysForDate(isoDate);
		if (debuts || birthdayNames) {
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

function rarityBadge(rarity) {
	return { className: "detail-panel-badge " + (rarity === "5" ? "is-five" : "is-four"), text: rarity === "5" ? "5-Star" : "4-Star" };
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
	ver.addEventListener("click", () => jumpToDate(entry.date));
	ver.addEventListener("keydown", e => {
		if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jumpToDate(entry.date); }
	});
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

	let namecardPath = `assets/namecards/${name.replace(/\s/g, "").toLowerCase()}.jpg`;
	header.style.backgroundImage = `linear-gradient(to bottom, rgba(13,13,20,0.45), rgba(13,13,20,0.94)), url(${namecardPath})`;

	let element = characterElements[name];
	if (element) {
		content.style.backgroundImage =
			`linear-gradient(rgba(13,13,20,0.94), rgba(13,13,20,0.94)), url(assets/elements/${element.toLowerCase()}.svg)`;
	} else {
		content.style.backgroundImage = "";
	}

	let rarity = characterRarity[name];

	let avatarWrap = document.createElement("div");
	avatarWrap.className = "avatar-wrap avatar-wrap-lg";
	avatarWrap.appendChild(faceImg(name, "phase-face-lg is-release" + (rarity === "4" ? " rarity-four" : "")));
	header.appendChild(avatarWrap);

	let nameEl = document.createElement("h2");
	nameEl.className = "detail-panel-name";
	nameEl.textContent = name;
	header.appendChild(nameEl);

	let tagsWrap = document.createElement("div");
	tagsWrap.className = "detail-panel-tags";
	let rarityTag = document.createElement("span");
	rarityTag.className = "detail-panel-badge " + (rarity === "5" ? "is-five" : "is-four");
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

// UI stack for the shared detail panel — a debut/birthday card click pushes
// a character view without opening a second overlapping popup.
// openDayPanel() is the only thing that resets the stack.
let panelStack = [];

function renderPanelTop() {
	let top = panelStack[panelStack.length - 1];
	if (!top) return;
	document.getElementById("detailPanelBack").hidden = panelStack.length <= 1;
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

	if (!debuts && !birthdayNames) {
		let stub = document.createElement("p");
		stub.className = "detail-panel-note";
		stub.textContent = "Nothing else tracked for this day yet.";
		content.appendChild(stub);
	}
}

// Entry point for opening the panel fresh from a day-cell click — resets
// the stack to just this day. Pushing/popping only re-renders content;
// this is the one place that toggles is-open/the backdrop/scroll-lock.
function openDayPanel(isoDate) {
	panelStack = [{ type: "day", isoDate }];
	renderPanelTop();
	document.getElementById("detailPanel").classList.add("is-open");
	document.getElementById("detailPanel").setAttribute("aria-hidden", "false");
	document.getElementById("detailPanelBackdrop").classList.add("is-open");
	document.body.classList.add("panel-open");
	document.documentElement.classList.add("panel-open");
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
	grid.addEventListener("click", e => {
		let cell = e.target.closest(".calendar-day-cell.is-clickable");
		if (cell) openDayPanel(cell.dataset.date);
	});
	grid.addEventListener("keydown", e => {
		if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("calendar-day-cell")) {
			e.preventDefault();
			openDayPanel(e.target.dataset.date);
		}
	});
	document.getElementById("detailPanelClose").addEventListener("click", closeDayPanel);
	document.getElementById("detailPanelBackdrop").addEventListener("click", closeDayPanel);
	document.getElementById("detailPanelBack").addEventListener("click", popPanelView);
	document.addEventListener("keydown", e => {
		if (e.key === "Escape") closeDayPanel();
	});

	// Delegated on the stable #detailPanelContent ancestor rather than
	// re-attached per card, since its innerHTML gets fully replaced on
	// every render.
	let content = document.getElementById("detailPanelContent");
	content.addEventListener("click", e => {
		let trigger = e.target.closest(".calendar-day-card, .calendar-birthday-chip");
		if (trigger) pushPanelView({ type: "character", name: trigger.dataset.character });
	});
	content.addEventListener("keydown", e => {
		if (e.key !== "Enter" && e.key !== " ") return;
		let trigger = e.target.closest(".calendar-day-card, .calendar-birthday-chip");
		if (trigger) { e.preventDefault(); pushPanelView({ type: "character", name: trigger.dataset.character }); }
	});

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
		if (!shouldDismiss) return;
		// Mobile's topbar (and Back button) is hidden entirely — the drag
		// gesture is the only dismiss affordance there, so a swipe pops one
		// stack level instead of always closing; only the stack's root closes.
		if (panelStack.length > 1) popPanelView();
		else closeDayPanel();
	}
	grabber.addEventListener("pointerup", endGrabberDrag);
	grabber.addEventListener("pointercancel", endGrabberDrag);
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
}
bootstrapCalendar();
