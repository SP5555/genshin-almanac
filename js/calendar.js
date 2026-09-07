// Year-view calendar — the same banner history as a spreadsheet-shaped grid
// instead of a line. Version launch dates are the first event layer plotted
// on it; character debuts and birthdays are deliberate later follow-ups,
// not yet built.
const CALENDAR_MIN_YEAR = 2020; // 1.0's real launch year
// Sunday-first, matching Date.getDay()'s own native order directly (0-6,
// Sun-Sat) — no rotation needed below. Deliberately not the Monday-first
// convention clocks.js's WEEKDAY_STRIP uses; that was specific to Genshin's
// domain-reset schedule (every domain open Sunday, so it reads best as the
// week's finale), which doesn't apply to a plain date calendar.
const CALENDAR_WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

// +2 years out, and driven by previewNow() (not a bare `new Date()`) so the
// dev-only ?fakeDate= override (shared.js) can exercise the upper bound too
// — always relative to "now," never hardcoded, so this doesn't quietly go
// stale the way a literal 2028 would.
function calendarMaxYear() {
	return previewNow().getFullYear() + 2;
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

async function loadVersionLaunches() {
	try {
		let res = await fetch("data/data.json");
		if (!res.ok) return;
		let data = await res.json();
		data.forEach(entry => { versionLaunches.set(entry.date, entry.version); });
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
		cell.className = "calendar-day-cell";
		if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day) {
			cell.classList.add("is-today");
		}
		let num = document.createElement("span");
		num.className = "calendar-day-number";
		num.textContent = String(day);
		cell.appendChild(num);

		// "YYYY-MM-DD", matching data.json's own date-string format exactly.
		let isoDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
		let launchVersion = versionLaunches.get(isoDate);
		if (launchVersion) {
			cell.classList.add("has-event");
			let label = document.createElement("span");
			label.className = "calendar-day-event";
			label.textContent = launchVersion;
			cell.appendChild(label);
		}

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
	await loadVersionLaunches();
	buildYearPopovers();
	setYear(getYearFromUrl());
}
bootstrapCalendar();
