# Calendar page (`calendar.html` / `js/calendar.js` / `css/calendar.css`)

Implementation notes for this page only — cross-cutting stuff (CSS
gotchas, design decisions, data schemas) lives in the root `CLAUDE.md`.

The banner history as a year-view grid instead of a line — leaning into
the site's time/history angle rather than theorycrafting/stats features
other Genshin sites already cover better. Three event layers are plotted:
version launches, character debuts, and birthdays.

**Year stepper**: range is `2020` (1.0's real launch year) to
`previewNow().getFullYear() + 1`, computed live. The year label opens a
popover (not a native `<select>`) for jumping the full range in one click.
Two stepper instances exist (above/below the grid, since scrolling through
12 months on mobile just to change year is real friction), kept in sync
via class rather than unique IDs. The bottom instance's popover opens
*upward* since it sits right above the footer.

A **"Today" button** (`jumpToToday()`), not an auto-scroll on load —
auto-scrolling was built and reconsidered before shipping, since it'd
fight a reader browsing from the top or reloading a bookmarked scroll
position. It wraps **`jumpToDate(isoDate)`**, the generic "jump to a
specific day" primitive: switches year/month if needed, scrolls, and gives
a temporary `.is-highlighted` ring — the same glow language as Timeline's
`jumpToCard()`, `--four` rather than `--five` so it's never confused with
`.is-today`'s permanent gold wash. Meant to be the one thing any future
jump-across-the-grid feature calls.

Two real bugs from this pattern, worth remembering if it's reused
elsewhere:
1. A popover's own `display:flex` (author CSS) silently overrides the
   browser's default `[hidden]{display:none}` — origin is checked before
   specificity in the cascade, so author styles win regardless. Needs an
   explicit `[hidden]{display:none;}` rule.
2. `animation-fill-mode:both` leaves a lingering non-`none` transform after
   the page's entrance animation finishes, which promotes the element into
   its own stacking context and traps a child popover's `z-index` below
   later-painted siblings. Fixed by giving the animated element its own
   `position:relative;z-index:N`. This exact trap recurred with the Month
   view's own stepper (below) — check for it on any element that both gets
   this page's reveal animation *and* houses its own popover.

**Day cells**: Sunday-first (Server Clocks' weekday strip is Monday-first,
specific to Genshin's own reset schedule — doesn't apply here). Fixed
height, not `aspect-ratio:1/1` — with ~8-9 launches a year against 365
days, almost every cell is empty and needs to stay calm rather than
compete for space. A border only appears on cells with something on them,
so the border itself is the "something is here" signal.

**Character debuts**: derived, not stored — a debut's date is just its
phase's start date (same `entry.date + 21×phaseIndex` + `phase-notes.json`
override as Timeline). `buildDebutsByDate()`/`getPhaseLabel()` mirror
app.js's own filler-skipping phase-count logic so captions match what
Timeline would call the same phase. Chronicled/Lightrace are never scanned
(reruns by definition, can't contain a real debut).

**Birthdays**: `data/character-birthdays.json` (name → `"MM-DD"`, no
year). Sourced from Game8's consolidated birthday table, cross-checked —
verify freshly against 2+ sources for any newly-added character, since
that kind of table lags new releases. Gated by full `YYYY-MM-DD` string
comparison, not just year, so a birthday never shows before the
character's real debut date within that debut year — a year-only cutoff
let this happen for the 11 "preexisting" characters (caught this way), who
now use their real Sep 28, 2020 launch date as the cutoff instead of their
later first-tracked-banner date. Bennett's Feb 29 needs no leap-year
special case — `buildMonthCard` only ever generates a Feb 29 cell in years
that actually have one.

**Day-cell markers**: up to 3 small dots (5★/4★ debut, birthday) sit in
the same row as the day number, glued directly beside it, not a separate
corner — a corner position read as ambiguous at this cell width (~44px),
closer to the *next* day's number than its own. A 4th neutral dot
(`.is-banner`, no glow, unlike the other three) marks any banner — rerun,
Chronicled, Lightrace — that has zero real debuts, so those days aren't
indistinguishable from actually empty ones. It only ever renders when no
debut dot already did, so it never increases the max dots-per-cell.

**Day panel**: debuts render as namecard-background "trading cards"
(`buildCharacterCard()`); birthdays get a lighter ringed-avatar-row
(`buildBirthdayChip()`) instead, since a debut is a one-time historical
fact and a birthday is light and recurring. A launch day promotes "Version
X.Y launch" into the panel's big centered headline; any other day gets a
compact 64px header rather than a mostly-empty 200px box. A reported
rendering seam along the header's own gradient edges (real hardware only,
not reproducible headless) was **not** fixed by `isolation:isolate` —
don't re-attempt that fix if this resurfaces.

The panel content and the grid's dots deliberately read from two different
maps: `debutsByDate` (dots — narrow on purpose, true debuts only, to keep
the grid calm) vs. `bannersByDate` (panel content — every character
featured that date, debut or not). This split exists because jumping to a
character's own rerun/Chronicled/Lightrace row used to land on a panel
with nothing in it, since those dates have real banners but no debut.
**One date can host more than one distinct banner** — Chronicled/Lightrace
share their parent phase's exact date by design, so `buildBannersByDate`
groups by `(date, version, phaseLabel)`, not date alone (grouping by date
alone was a real bug: it merged an unrelated regular phase with its
same-day Chronicled Wish into one list).

`bannersByDate` also drives `buildPhaseCard()`/`buildPhaseUnit()` — a
compact summary of the *entire* banner, reusing Timeline's own
`.trail-node.phase-card` DOM/CSS (`buildNode()` in app.js), duplicated
rather than shared since app.js's version is tightly coupled to
Timeline-only state (`characterIndex` population, `buildRays()`). Its
layout deliberately diverges from Timeline's, though: `.calendar-phase-card`
forces both five/four groups into left-aligned flat flex-wrap rows, no
column-split at all, since Timeline's centered/column-split layout read as
over-designed at this card's smaller scale.

**Real gotcha**: Timeline's phase-card CSS gates its stacking fix behind
viewport-width media queries — correct for Timeline, where the card
tracks the viewport. The day panel's popup stays narrow (~560px)
*regardless* of viewport width, so those queries never fire even on a wide
desktop screen where the card's actual rendered width sits well inside the
danger zone that caused the original chronicled-overflow bug. Fixed by
forcing the stacked layout unconditionally via a `.calendar-phase-card`
marker class rather than gating on a media query — worth checking any time
a Timeline component with viewport-width breakpoints gets reused inside a
container whose own width doesn't track the viewport.

Clicking a debut card or birthday chip drills into that character's own
`.char-appear-list` via a **UI stack** on the shared detail panel
(`panelStack`/`pushPanelView()`/`popPanelView()`/`renderPanelTop()`).
`openDayPanel()` is the only thing that resets the stack; push/pop only
re-renders content, animated via the shared `swapWithFade()`. A **Back**
button appears whenever stack depth > 1; on mobile (topbar hidden
entirely) a qualifying swipe pops one stack level instead of always
closing, except from the stack's root.

`buildCharacterAppearances()` is a pure-data mirror of app.js's
`characterIndex` (same per-version scan order — phases, then chronicled,
then lightrace — so rerun counts line up identically), built once at
bootstrap rather than duplicating Timeline's full render path.

## Month view (desktop-only zoom mode)
A Year/Month toggle (hidden below 900px) swaps the 12-small-card grid for
one large `.calendar-month-card.is-big` — the same glass-card language as
the compact grid's 12 small ones, just one instead of twelve.

**State**: `viewMode`/`currentMonth` are session-only, not persisted in the
URL like `currentYear` is — reloading always starts back in year mode
(deliberate: a persisted month view landing on a <900px viewport would
need its own fallback for no real benefit, since the toggle wouldn't even
be reachable there). A `resize` listener forces back to year mode if the
window narrows below 900px mid-session. `renderCalendar()` is the single
dispatcher every state setter goes through.

Two independent stepper groups (month, year), not one combined stepper —
lets a reader jump May 2025 → May 2026 in one click instead of stepping
through 12 months. The year group is a verbatim reuse of the year-view's
own popover markup/wiring, since that code already operates on "every
matching element" rather than a specific instance. Both labels share one
CSS rule except `width` — a *fixed* width (not `min-width`) is what stops
the label resizing (and shoving its own arrows sideways) as the text
changes.

**Real bug**: the month-nav arrows share `.calendar-year-arrow` with the
year-view's own arrows purely for pill styling, but the year-view's click
listeners originally selected on the bare `.is-prev`/`.is-next` classes,
which the month arrows also carry — every "next month" click was silently
also firing `setYear(currentYear + 1)`. Fixed by scoping those selectors
to `.calendar-year-stepper .calendar-year-arrow...` specifically. Worth
remembering any time a new element reuses an existing class purely for
shared styling — an unscoped selector elsewhere that happens to match the
same class combination will fire too.

**`buildBigDayCell()`** mirrors `buildMonthCard()`'s per-day data lookups
but renders real text where the compact grid only had room for a dot: a
debut gets its version+phase badge and character names spelled out; a
banner with no real debut gets the badge alone, keeping the same "quiet,
not the headline" restraint as the `.is-banner` dot.

**`jumpToDate()` needed a real fix, not just a wrapper**: it only ever
checked/set `currentYear`, so in month mode looking at a different month
than the target date, the cell genuinely isn't in the DOM and the jump
silently no-op'd. Now derives the target month from the ISO date and calls
`setMonth()` first when in month mode — fixes every caller for free.

Weekday row is a bordered chip per letter, not a plain label under one
rule beneath the whole row — a real box per letter is what reads as a
distinct header. Month view spells out full weekday names
(`CALENDAR_WEEKDAY_NAMES`) instead of the compact grid's single letters,
since there's real room for it.
