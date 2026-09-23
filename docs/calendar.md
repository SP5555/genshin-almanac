# Calendar page (`calendar.html` / `src/pages/calendar/`)

Cross-cutting notes live in `AGENTS.md`. Year-view grid of the same
banner history: version launches, character debuts, birthdays. Not a
stats dashboard.

**Year range:** 2020 (1.0's launch year) to `previewNow().getFullYear()
+ 1`. Custom popover, not a native `<select>`. Two stepper instances
(above/below the grid) kept in sync by class; the bottom popover opens
upward.

**Today** is a button (`jumpToToday()` → `jumpToDate(isoDate)`), not an
auto-scroll on load — that fights browsing from the top and bookmarked
scroll. Highlight uses `--four`, never `--five`, so it isn't confused
with `.is-today`. Any future jump-across-the-grid feature should call
`jumpToDate()`.

**Shareable `?date=`:** one param, precision is the view. `2021` year,
`2021-02` month (desktop ≥900px; below that the page shows year but
keeps the month in the URL so widening restores it), `2021-02-03` jumps
and opens that day. Old `?year=` bookmarks still read, then rewrite.
Close drops back to year or month. Character drill-in stays off the
URL (panel stack). `fakeDate` is a separate param — "what time it is",
not "where you're looking."

Reuse traps for the stepper:
1. A popover's author `display: flex` overrides `[hidden] { display:
   none }` (origin beats specificity). Needs an explicit
   `[hidden] { display: none }`.
2. `animation-fill-mode: both` leaves a non-`none` transform after the
   entrance animation, which traps a child popover's `z-index`. Give the
   animated element its own `position: relative; z-index`. Hits any
   reveal-animated element that also houses a popover.

**Day cells** are Sunday-first (Clocks' Monday-first strip is Genshin's
reset week, not a calendar). Fixed height, not `aspect-ratio: 1/1` —
almost every cell is empty and should stay calm. Border only on cells
that have something, so the border *is* the signal.

**Debuts** are derived: phase start date, same formula + `phase-notes`
overrides as Timeline, same filler-skipping labels. Chronicled /
Lightrace are never scanned.

**Birthdays:** `character-birthdays.json` (name → `"MM-DD"`). Game8 table,
cross-check 2+ sources for new characters (those tables lag). Gated by
full `YYYY-MM-DD`, not year alone — a year-only cutoff showed 1.0-roster
birthdays before Sep 28, 2020; preexisting characters use that launch
date as the cutoff, not their first tracked banner. Bennett's Feb 29
needs no leap special case: `buildMonthCard` only emits Feb 29 in years
that have one.

**Markers:** up to three small dots (5★ / 4★ debut, birthday) glued beside
the day number, not a corner (at ~44px a corner reads as the *next*
day). A 4th neutral `.is-banner` dot marks a banner day with zero debuts,
and only then.

**Day panel:** debuts are namecard "trading cards"; birthdays are lighter
chips. A launch day promotes "Version X.Y launch" to the headline; other
days get a compact header. A reported seam on the header gradient (real
hardware only) was **not** fixed by `isolation: isolate` — don't retry
that.

Grid dots read `debutsByDate` (true debuts, keep the grid calm). Panel
content reads `bannersByDate` (everyone featured that date). Without the
split, jumping to a rerun/Chronicled/Lightrace day opened an empty panel.
**One date can host more than one banner** — Chronicled/Lightrace share
the parent phase's date — so `bannersByDate` groups by `(date, version,
phaseLabel)`, not date alone.

The compact `.calendar-phase-card` reuses Timeline's phase-card DOM but
**not** its viewport-width stacking breakpoints: the popup is ~560px
even on a wide screen, so those queries never fire. Force the stacked
layout via the marker class. Left-aligned flat wrap, no column-split —
Timeline's centered/column layout is over-designed at this scale.

Character drill-in is a **UI stack** on the shared panel (`panelStack`),
not browser history. `openDayPanel()` is the only stack reset. Back
appears at depth > 1; on mobile a qualifying swipe pops one level except
from the root. `buildCharacterAppearances()` mirrors Timeline's scan
order (phases, then chronicled, then lightrace) so rerun counts match.

## Month view (desktop, ≥900px)

`?date=YYYY-MM` is the month view. Reload on a <900px window shows year
and keeps the month in the URL. An explicit Year toggle rewrites to
`YYYY`. A `resize` listener drops the *display* back to year below 900px
without stripping the param. `renderCalendar()` is the single dispatcher.

Month and year are independent steppers so May N → May N+1 is one click.
Labels use a **fixed** width (not `min-width`) so changing text doesn't
shove the arrows. Stepper arrows share `.calendar-year-arrow` for
styling; year-view click handlers must stay scoped to
`.calendar-year-stepper .calendar-year-arrow`, or "next month" also
fires `setYear(+1)`.

`bannersByDate.get(isoDate)` is an **array**. Rendering only
`debuts || banners[0]` hides a Chronicled/Lightrace group that shares
the date with a real debut. Render those variant badges
*unconditionally*, alongside the debut / plain-banner branch.

`jumpToDate()` must `setMonth()` first when in month view looking at a
different month — otherwise the cell isn't in the DOM and the jump
no-ops.

Weekday row: one border around the whole row, not per letter. Month view
uses full weekday names (`CALENDAR_WEEKDAY_NAMES`).
