const SERVERS = [
	{ name: "America", offset: -5 },
	{ name: "Europe", offset: 1 },
	{ name: "Asia", offset: 8 },
	{ name: "TW, HK, MO", offset: 8 },
];
const RESET_LOCAL_HOUR = 4;
const DAY_MS = 86400000;
const PREDICTED_CADENCE_DAYS = 42;
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

// Version-update maintenance always starts at 06:00 China Standard Time (UTC+8) —
// the same real-world instant for all four servers at once, confirmed via
// HoYoverse's own patch-day announcements. data.json's "date" field records the
// CST calendar date a version went live, so anchor to that exact hour rather than
// midnight UTC — otherwise the "N days" estimate below drifts by up to 8 hours.
const MAINTENANCE_START_HOUR_CST = 6;
const CST_OFFSET_HOURS = 8;

function cstDateToUtcInstant(isoDate, hourCst) {
	let [y, m, d] = isoDate.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d, hourCst - CST_OFFSET_HOURS, 0, 0, 0));
}

function nextServerReset(offsetHours, now) {
	let serverNowMs = now.getTime() + offsetHours * 3600000;
	let serverNow = new Date(serverNowMs);
	let resetLocal = new Date(Date.UTC(
		serverNow.getUTCFullYear(), serverNow.getUTCMonth(), serverNow.getUTCDate(),
		RESET_LOCAL_HOUR, 0, 0, 0
	));
	if (resetLocal.getTime() <= serverNowMs) resetLocal.setUTCDate(resetLocal.getUTCDate() + 1);
	return new Date(resetLocal.getTime() - offsetHours * 3600000);
}

// Monday-first. Deliberately *not* using --four/--five here — those are the
// site's star-rarity colors elsewhere, and no weekday actually outranks
// another (Mon/Thu, Tue/Fri, and Wed/Sat are just three equal rotations).
// Only Sunday is genuinely different in kind (every domain open at once), so
// it's the only day that gets its own color; the other six share one neutral.
const WEEKDAY_STRIP = [
	{ name: "Monday", letter: "M", color: "var(--line)" },
	{ name: "Tuesday", letter: "T", color: "var(--line)" },
	{ name: "Wednesday", letter: "W", color: "var(--line)" },
	{ name: "Thursday", letter: "T", color: "var(--line)" },
	{ name: "Friday", letter: "F", color: "var(--line)" },
	{ name: "Saturday", letter: "S", color: "var(--line)" },
	{ name: "Sunday", letter: "S", color: "var(--five)" },
];

// In-game "today" (talent/weapon material domain rotations, etc.) flips at the
// 4am reset, not at midnight — so someone playing at 2am Monday server time is
// still on "Sunday" until reset hits. Shift the server-local clock back by the
// reset hour before reading the weekday so it lines up with that rule. Returns
// a Monday-first index (0 = Monday .. 6 = Sunday) to match WEEKDAY_STRIP.
function serverWeekdayIndex(offsetHours, now) {
	let serverNowMs = now.getTime() + offsetHours * 3600000;
	let gameDay = new Date(serverNowMs - RESET_LOCAL_HOUR * 3600000);
	return (gameDay.getUTCDay() + 6) % 7;
}

function formatDuration(ms) {
	let totalSec = Math.max(0, Math.floor(ms / 1000));
	let h = Math.floor(totalSec / 3600);
	let m = Math.floor((totalSec % 3600) / 60);
	let s = totalSec % 60;
	return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
}

function formatDurationWithDays(ms) {
	let totalSec = Math.max(0, Math.floor(ms / 1000));
	let days = Math.floor(totalSec / 86400);
	let h = Math.floor((totalSec % 86400) / 3600);
	let m = Math.floor((totalSec % 3600) / 60);
	let s = totalSec % 60;
	let hms = [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
	return days > 0 ? `${days}d ${hms}` : hms;
}

function buildClockCard(server) {
	let card = document.createElement("div");
	card.className = "clock-card";
	card.innerHTML = `
		<div class="clock-ring-wrap">
			<svg class="clock-ring" viewBox="0 0 120 120">
				<circle class="clock-ring-track" cx="60" cy="60" r="52"></circle>
				<circle class="clock-ring-progress" cx="60" cy="60" r="52"
					stroke-dasharray="${RING_CIRCUMFERENCE}" stroke-dashoffset="${RING_CIRCUMFERENCE}"></circle>
			</svg>
			<div class="clock-ring-center">
				<span class="clock-countdown" data-role="countdown">00:00:00</span>
			</div>
		</div>
		<div class="clock-weekstrip" data-role="weekstrip">
			${WEEKDAY_STRIP.map(d => `
				<span class="clock-weekday-letter" style="--letter-color: ${d.color}" title="${d.name}">${d.letter}</span>
			`).join("")}
		</div>
		<div class="clock-server-name">${server.name}</div>
		<div class="clock-local-time" data-role="local-time"></div>
	`;
	return card;
}

function updateClockCard(server, el, now, { animateRing = true } = {}) {
	let reset = nextServerReset(server.offset, now);
	let remaining = reset.getTime() - now.getTime();
	if (animateRing) {
		let fraction = remaining / DAY_MS;
		el.querySelector(".clock-ring-progress").style.strokeDashoffset =
			String(RING_CIRCUMFERENCE * (1 - fraction));
	}
	el.querySelector('[data-role="countdown"]').textContent = formatDuration(remaining);
	let todayIdx = serverWeekdayIndex(server.offset, now);
	el.querySelectorAll('[data-role="weekstrip"] .clock-weekday-letter').forEach((letterEl, i) => {
		letterEl.classList.toggle("is-today", i === todayIdx);
	});
	el.querySelector('[data-role="local-time"]').textContent =
		`Resets ${reset.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} your time`;
}

function tickDailyClocks(cards) {
	let now = new Date();
	cards.forEach(({ server, el }) => updateClockCard(server, el, now));
}

// "PDT (UTC-7)" style label for the viewer's own detected time zone. The
// `timeZoneName: "short"` abbreviation isn't available for every IANA zone
// (some just resolve to a "GMT+X" offset already, e.g. India) — in that case
// skip the redundant offset suffix rather than showing "GMT+5:30 (UTC+5:30)".
function detectTimezoneLabel() {
	let now = new Date();
	let short = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
		.formatToParts(now).find(p => p.type === "timeZoneName")?.value || "";
	let offsetMin = -now.getTimezoneOffset();
	let sign = offsetMin >= 0 ? "+" : "-";
	let abs = Math.abs(offsetMin);
	let hh = Math.floor(abs / 60);
	let mm = abs % 60;
	let offsetLabel = `UTC${sign}${hh}${mm ? ":" + String(mm).padStart(2, "0") : ""}`;
	return !short || /GMT|UTC/.test(short) ? offsetLabel : `${short} (${offsetLabel})`;
}

function showTimezoneNote() {
	let now = new Date();
	let long = new Intl.DateTimeFormat("en-US", { timeZoneName: "long" })
		.formatToParts(now).find(p => p.type === "timeZoneName")?.value || "";
	let note = document.getElementById("clocksTzNote");
	note.innerHTML = `Detected your time zone as <strong title="${long}">${detectTimezoneLabel()}</strong>.`;
}

function buildDailyClocks() {
	let grid = document.getElementById("dailyClockGrid");
	let now = new Date();
	let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	let cards = SERVERS.map(server => {
		let el = buildClockCard(server);
		grid.appendChild(el);
		// Rings start empty (see stroke-dashoffset above) and fill in to their real
		// progress once the card has finished fading into view, rather than jumping
		// straight to the correct value before the browser ever paints the empty
		// state — reduced motion skips the wait since the fade-in animation (whose
		// end normally triggers this) doesn't run in that case either.
		updateClockCard(server, el, now, { animateRing: reduceMotion });
		if (!reduceMotion) {
			el.addEventListener("animationend", () => updateClockCard(server, el, new Date()), { once: true });
		}
		return { server, el };
	});
	setInterval(() => tickDailyClocks(cards), 1000);
}

function buildUpdateCard(lastEntry, prevEntry) {
	let lastEntryAnchor = cstDateToUtcInstant(lastEntry.date, MAINTENANCE_START_HOUR_CST);
	// data.json normally only gets a version added once it's actually live — but
	// if it's been pre-staged ahead of its official date (announced via
	// livestream, added early), the newest entry's own date is still in the
	// future. Treat that as a *known* upcoming launch instead of a past one:
	// count down to its real date rather than guessing +42 days from it, and
	// fall back to the entry before it as "the current live version" for display.
	let isUpcoming = Date.now() < lastEntryAnchor.getTime();
	let liveEntry = isUpcoming && prevEntry ? prevEntry : lastEntry;
	let liveAnchor = isUpcoming && prevEntry
		? cstDateToUtcInstant(prevEntry.date, MAINTENANCE_START_HOUR_CST)
		: lastEntryAnchor;
	let target = isUpcoming ? lastEntryAnchor : new Date(liveAnchor.getTime() + PREDICTED_CADENCE_DAYS * DAY_MS);

	let [liveY, liveM, liveD] = liveEntry.date.split("-").map(Number);
	let liveLabel = new Date(Date.UTC(liveY, liveM - 1, liveD))
		.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
	let targetLabel = target.toLocaleString(undefined, {
		year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
	});

	let confirmedDesc = `
		<strong>${liveEntry.version}</strong> (launched <strong>${liveLabel}</strong>) is the newest live
		version. <strong>${lastEntry.version}</strong> is confirmed for <strong>${targetLabel}</strong> your
		time — maintenance always starts at the same real-world moment for all four servers at once (06:00
		China Standard Time), which is why there's one clock here, not four.
	`;
	let estimateDesc = `
		Version <strong>${liveEntry.version}</strong> launched <strong>${liveLabel}</strong>, and updates land
		roughly every <strong>${PREDICTED_CADENCE_DAYS} days</strong> — so the next one is expected around
		<strong>${targetLabel}</strong> your time. Maintenance always starts at the same real-world moment
		for all four servers at once (06:00 China Standard Time), which is why there's one clock here, not
		four. The cadence occasionally shifts by a week or two, so treat this as a solid guide rather than
		an exact date.
	`;
	let overdueDesc = `
		This estimate has passed — <strong>${liveEntry.version}</strong> (launched <strong>${liveLabel}</strong>) is
		still the newest version showing here. The next one is either running a little later than usual, or
		it's already out and this page just hasn't caught up yet — check back soon.
	`;

	let card = document.getElementById("updateCard");
	card.classList.toggle("is-confirmed", isUpcoming);
	card.innerHTML = `
		<div class="update-main">
			<span class="update-badge" data-role="badge">${isUpcoming ? "Confirmed" : "Estimated"}</span>
			<div class="update-countdown" data-role="countdown"></div>
			<p class="update-desc" data-role="desc">${isUpcoming ? confirmedDesc : ""}</p>
		</div>
		<div class="update-bar-wrap">
			<div class="update-bar-track"><div class="update-bar-fill" data-role="bar"></div></div>
			<div class="update-bar-label">
				<span>${liveEntry.version}</span><span>${isUpcoming ? lastEntry.version : "next update (est.)"}</span>
			</div>
		</div>
	`;
	let badgeEl = card.querySelector('[data-role="badge"]');
	let descEl = card.querySelector('[data-role="desc"]');
	let wasOverdue = null;
	function tick({ animateBar = true } = {}) {
		let now = new Date();
		// A confirmed upcoming launch can't be "overdue" — its target is by
		// definition still in the future the whole time isUpcoming holds.
		let isOverdue = !isUpcoming && now.getTime() > target.getTime();
		if (!isUpcoming && isOverdue !== wasOverdue) {
			card.classList.toggle("is-overdue", isOverdue);
			badgeEl.textContent = isOverdue ? "Overdue" : "Estimated";
			descEl.innerHTML = isOverdue ? overdueDesc : estimateDesc;
			wasOverdue = isOverdue;
		}
		card.querySelector('[data-role="countdown"]').textContent = isOverdue
			? `Overdue by ${formatDurationWithDays(now.getTime() - target.getTime())}`
			: formatDurationWithDays(target.getTime() - now.getTime());
		if (animateBar) {
			let fraction = Math.min(1, Math.max(0, (now.getTime() - liveAnchor.getTime()) / (target.getTime() - liveAnchor.getTime())));
			card.querySelector('[data-role="bar"]').style.width = `${fraction * 100}%`;
		}
	}
	// Same reasoning as the daily-reset rings: start the bar at 0% (see CSS) and
	// only fill it in once the card has actually faded into view, so there's a
	// real "before" state for the transition to animate from.
	let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	tick({ animateBar: reduceMotion });
	if (!reduceMotion) card.addEventListener("animationend", () => tick(), { once: true });
	setInterval(() => tick(), 1000);
}

async function bootstrapClocks() {
	showTimezoneNote();
	buildDailyClocks();
	try {
		let res = await fetch("data/data.json");
		if (!res.ok) throw new Error(`Failed to load data.json: ${res.status}`);
		let data = await res.json();
		let last = data[data.length - 1];
		let prev = data.length > 1 ? data[data.length - 2] : null;
		buildUpdateCard(last, prev);
	} catch (err) {
		console.error(err);
		document.getElementById("updateCard").textContent =
			"Couldn't load version data for the update estimate.";
	}
}

bootstrapClocks();
