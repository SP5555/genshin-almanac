// Year-view calendar — the same banner history as a spreadsheet-shaped grid
// instead of a line. Version launch dates and character debuts are plotted
// on it; birthdays are a deliberate later follow-up, not yet built.
const CALENDAR_MIN_YEAR = 2020; // 1.0's real launch year
// Sunday-first, matching Date.getDay()'s own native order directly (0-6,
// Sun-Sat) — no rotation needed below. Deliberately not the Monday-first
// convention clocks.js's WEEKDAY_STRIP uses; that was specific to Genshin's
// domain-reset schedule (every domain open Sunday, so it reads best as the
// week's finale), which doesn't apply to a plain date calendar.
const CALENDAR_WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

// +1 year out, and driven by previewNow() (not a bare `new Date()`) so the
// dev-only ?fakeDate= override (shared.js) can exercise the upper bound too
// — always relative to "now," never hardcoded, so this doesn't quietly go
// stale the way a literal year would.
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

// "YYYY-MM-DD" -> version string (e.g. "7.0") — data.json's own entry.date
// is already exactly that format, so no parsing/reformatting needed, just
// a direct lookup per rendered day. Populated once at bootstrap, before
// anything renders (same "await the fetch, then build" pattern landing.js/
// clocks.js already use).
let versionLaunches = new Map();
// Keyed by major version ("6", "7", ...) -> {region, bgImage, ...}, same
// file Timeline/landing already read, for the day panel's region-art header.
let versionMeta = {};
// "YYYY-MM-DD" -> {five: [names], four: [names]} — every character's true
// first appearance, keyed by the exact day their phase started. Built once
// at bootstrap (see buildDebutsByDate below) since it requires a full,
// in-order scan of every phase in the game, same cost class as app.js's
// characterIndex.
let debutsByDate = new Map();

// Same 21-day cadence as landing.js's PHASE_LENGTH_DAYS (cross-checked, see
// CLAUDE.md) — duplicated as a literal rather than imported since it's a
// single well-established number, not worth a cross-file shared constant
// for. Unlike landing.js (which only ever needs to be right for whichever
// version is currently live), the calendar walks every historical phase, so
// it leans on phase-notes.json's "date" overrides for the handful of phases
// where this formula is wrong (1.3's 3-phase structure, 3.0-3.2's
// compressed cadence — see CLAUDE.md).
function getPhaseStartDate(entry, phaseIndex, phaseNotes) {
	let override = (phaseNotes[`${entry.version}-${phaseIndex + 1}`] || {}).date;
	if (override) return override;
	let d = new Date(entry.date + "T00:00:00Z");
	d.setUTCDate(d.getUTCDate() + phaseIndex * 21);
	return d.toISOString().slice(0, 10);
}

// Mirrors app.js's own realPhaseCount logic (filler phases, e.g. 1.3-2, are
// labeled "Filler" and don't consume a phase number) so a debut card's
// caption reads identically to what the Timeline/character panel would call
// the same phase.
function getPhaseLabel(entry, phaseIndex, phaseNotes) {
	let isFiller = i => !!(phaseNotes[`${entry.version}-${i + 1}`] || {}).filler;
	if (isFiller(phaseIndex)) return "Filler";
	let realCount = 0;
	for (let i = 0; i <= phaseIndex; i++) {
		if (!isFiller(i)) realCount++;
	}
	return `Phase ${realCount}`;
}

// Same "first appearance = true debut" rule as landing.js's getDebuts()
// (preexisting characters excluded, chronicled/lightrace never scanned
// since they're reruns by definition) but per-phase rather than
// per-version, since a version's phases can land on different calendar
// days. Returns a map so the day cell (a small dot per rarity) and the day
// panel (full name list) can both read from the same computed source.
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
			// Everyone in a given date's list debuted in the same phase, so
			// version/phaseLabel are stored once per date rather than per
			// character — the day panel shows it once in the heading instead
			// of repeating it on every card.
			map.set(date, { version: entry.version, phaseLabel: getPhaseLabel(entry, pi, phaseNotes), five, four });
		}
	}
	return map;
}

// Keyed by character name -> element ("Pyro", "Cryo", ...), for the day-
// panel card's element icon — not otherwise loaded on this page.
let characterElements = {};
// Keyed by character name -> "5"/"4" — a character's rarity never changes
// across appearances, so first sighting in any regular banner phase is
// authoritative. Needed for the birthday card's avatar ring color (debuts
// already know their own rarity from which bucket they're in; birthdays
// don't have that context for free).
let characterRarity = {};
// "MM-DD" -> "YYYY-MM-DD" per character, i.e. characterBirthdays inverted so
// a rendered day can do a direct lookup instead of scanning all 117 names.
// Deliberately keyed by month-day, not a full date — a birthday recurs every
// year, unlike a debut which is one specific historical instant. Bennett's
// real Feb 29 birthday needs no special-casing here: buildMonthCard only
// ever creates a Feb 29 cell in years that actually have one, so a
// non-leap year simply never looks this entry up.
let birthdaysByMonthDay = new Map();
// Keyed by character name -> "YYYY-MM-DD" (see buildCharacterDebutDate below).
let characterDebutDate = {};

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

// Keyed by character name -> "YYYY-MM-DD", the exact date their birthday
// should first start showing up on the calendar — a character shouldn't
// celebrate a birthday before they existed. Full dates, not just years: a
// year-only cutoff let a character's birthday show anywhere in their debut
// year, including before their actual debut date within that same year
// (caught via the 11 "preexisting" 1.0-launch characters specifically —
// character-notes.json — whose birthdays could land earlier in 2020 than
// the real Sep 28 launch date, but the same flaw applies to anyone whose
// birthday falls earlier in the calendar year than their real debut).
// Preexisting characters use the real 1.0 launch date itself (they were
// already in the game since day one, even though their first *tracked*
// banner comes later) rather than their eventual banner date.
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

// Filters a "MM-DD" birthday match down to whoever had actually debuted by
// the given calendar date — see buildCharacterDebutDate above. ISO date
// strings compare correctly with plain string comparison (zero-padded,
// YYYY-MM-DD), no Date parsing needed. Returns null (not an empty array)
// when nothing survives, matching birthdaysByMonthDay's own "no entry"
// convention so callers can keep using a plain truthiness check.
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
		let phaseNotes = phaseNotesRes.ok ? await phaseNotesRes.json() : {};
		if (data) {
			debutsByDate = buildDebutsByDate(data, notes, phaseNotes);
			characterDebutDate = buildCharacterDebutDate(data, phaseNotes, notes);
		}
	} catch (err) {
		console.error(err);
	}
}

function buildMonthCard(year, month, today) {
	let card = document.createElement("div");
	card.className = "calendar-month-card";

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
	// getDay() is already Sunday-first (0-6), matching CALENDAR_WEEKDAY_LETTERS
	// above directly — no rotation needed.
	let firstWeekday = new Date(year, month, 1).getDay();
	let daysInMonth = new Date(year, month + 1, 0).getDate(); // day 0 of next month = last day of this one, leap years included for free

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
		// Number + debut dots share one row, glued together, rather than the
		// dots floating in the opposite corner — at this cell width (~44px)
		// a corner-positioned dot ends up visually closer to the *next*
		// day's number than to its own (checked: ~12px from the neighbor's
		// "11" vs. ~19px from its own "10"), reading as if it belonged to
		// the wrong day. Direct adjacency removes the ambiguity without
		// needing a grid line/divider, which would undercut the "border
		// only where something's actually happening" calm-grid rule below.
		let top = document.createElement("span");
		top.className = "calendar-day-top";
		let num = document.createElement("span");
		num.className = "calendar-day-number";
		num.textContent = String(day);
		top.appendChild(num);

		// "YYYY-MM-DD", matching data.json's own date-string format exactly.
		let isoDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
		cell.dataset.date = isoDate;
		let launchVersion = versionLaunches.get(isoDate);
		if (launchVersion) {
			cell.classList.add("has-event");
			let label = document.createElement("span");
			label.className = "calendar-day-event";
			label.textContent = launchVersion;
			cell.appendChild(label);
		}

		// Full names are left to the day panel (see openDayPanel) — a
		// handful of tiny circles is the only realistic amount of event
		// info this cell size can carry.
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

// Two stepper instances exist (top of the page, and again below the month
// grid — so a mobile reader who's scrolled through all 12 months isn't
// forced back to the top just to change year), kept in sync by operating
// on every matching element via class rather than a single getElementById
// — duplicate IDs would be invalid HTML anyway.
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
	// Scroll the current year into view within the popover's own scroll
	// area rather than the page — relevant once the range spans enough
	// years that the list scrolls (2020 to current+2 is already 8-10).
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
// Reuses the exact detail-panel component from timeline.html/app.js (styling
// lives in style.css, shared across pages already) rather than building a
// second slide-in/bottom-sheet from scratch.

// One card layout for both event types (debut and birthday) — namecard art
// on its own layer so the hover zoom (calendar.css) can transform just the
// art, a static scrim on top so text stays legible through the zoom, and a
// rarity-colored avatar ring matching the same is-release language used
// everywhere else on the site. `variant` ("five"/"four"/"birthday") picks
// the card's own border/glow color — a birthday card gets the birthday
// accent regardless of the character's rarity, so it doesn't get confused
// for a debut card at a glance; the rarity is still shown as a badge either
// way. `badges` is an ordered list of {className, text, title?} rendered
// before the (optional) element icon.
function buildCharacterCard(name, variant, badges) {
	let card = document.createElement("div");
	card.className = "calendar-day-card is-" + variant;

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

function openDayPanel(isoDate) {
	let header = document.getElementById("detailPanelHeader");
	let content = document.getElementById("detailPanelContent");
	header.innerHTML = "";
	content.innerHTML = "";
	header.style.backgroundImage = "";
	content.style.backgroundImage = "";
	header.classList.remove("is-compact");

	let dateObj = new Date(isoDate + "T00:00:00");
	let dateText = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

	// The date is always the small corner label now, for consistency across
	// every day rather than just launch days — .detail-panel-name/-tags are
	// shared with Timeline's character panel (app.js), where the character
	// name IS the thing that should stay big, so none of this touches those
	// shared classes' own styling, only calendar-only ones (calendar.css).
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

		// Same per-version region-art recipe as Timeline's ambient background
		// and the landing spotlight (see setRegionBackground() in app.js) —
		// reuses the 7 region images already sourced rather than needing any
		// per-day art, which isn't realistic at 365 days/year.
		let meta = versionMeta[launchVersion.split(".")[0]];
		if (meta && meta.bgImage) {
			header.style.backgroundImage =
				`linear-gradient(to bottom, rgba(13,13,20,0.45), rgba(13,13,20,0.94)), url(assets/regions/${meta.bgImage}.jpg)`;
		}
	} else {
		// Nothing to promote to the big centered spot, and no region art
		// either — a persistently-tall empty header would just read as
		// wasted space on the ~345 days a year this applies to, so the
		// header shrinks to fit just the corner date instead.
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

		let list = document.createElement("div");
		list.className = "calendar-day-card-list";
		birthdayNames.forEach(name => {
			let badges = [rarityBadge(characterRarity[name]), { className: "detail-panel-badge is-birthday", text: "Birthday" }];
			list.appendChild(buildCharacterCard(name, "birthday", badges));
		});
		content.appendChild(list);
	}

	if (!debuts && !birthdayNames) {
		let stub = document.createElement("p");
		stub.className = "detail-panel-note";
		stub.textContent = "Nothing else tracked for this day yet.";
		content.appendChild(stub);
	}

	document.getElementById("detailPanel").classList.add("is-open");
	document.getElementById("detailPanel").setAttribute("aria-hidden", "false");
	document.getElementById("detailPanelBackdrop").classList.add("is-open");
	document.body.classList.add("panel-open");
	document.documentElement.classList.add("panel-open");
}

function closeDayPanel() {
	document.getElementById("detailPanel").classList.remove("is-open");
	document.getElementById("detailPanel").setAttribute("aria-hidden", "true");
	document.getElementById("detailPanelBackdrop").classList.remove("is-open");
	document.body.classList.remove("panel-open");
	document.documentElement.classList.remove("panel-open");
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
	document.addEventListener("keydown", e => {
		if (e.key === "Escape") closeDayPanel();
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
		if (shouldDismiss) closeDayPanel();
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

async function bootstrapCalendar() {
	await loadCalendarData();
	buildYearPopovers();
	setYear(getYearFromUrl());
}
bootstrapCalendar();
