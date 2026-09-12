# Timeline page (`timeline.html` / `js/app.js`)

Implementation notes for this page only — cross-cutting stuff (CSS
gotchas, design decisions, data schemas) lives in the root `CLAUDE.md`.

Vertical timeline: a line down the left, a gradient bubble per major
version, a smaller bubble per patch, phases as glassmorphic cards. `--line`
(lavender `#6e5a94`) deliberately ties into the `--four` purple accent.

**`data/data.json`** — one entry per version, `banner` array of phases
(usually 2, occasionally 3), each phase has `"5"`/`"4"` arrays of
display-name strings. Keep entries as plain strings — exceptional facts go
in the notes files below, not inline. Each entry has a verified `date`
(`YYYY-MM-DD` — see `data/SOURCES.md`) and, for 6 versions, a `chronicled`
object.

**`data/character-notes.json`** (keyed by character name):
- `{"rateDown": true}` — 5-star obtainable via the standard rate-down pool,
  not truly limited (e.g. Tighnari, Dehya, Mizuki, Keqing).
- `{"preexisting": true}` — existed before their first *tracked* banner
  (the 11 characters in the 1.0 launch roster without a featured slot
  until later). Panel note: *"Already in the game at launch — these
  appearances are technically reruns, not a debut."*

**`data/phase-notes.json`** (keyed `"<version>-<phase#>"`): `{"filler":
true}` marks a padding phase (currently only `"1.3-2"`, Keqing's —
inserted before Hu Tao's funeral-parlor-themed banner to avoid landing near
Chinese New Year). `{"date": "YYYY-MM-DD"}` overrides a phase's computed
start date (`entry.date + 21×phaseIndex`) for the handful of phases where
that formula is wrong: 1.3's unusual 3-phase structure and 3.0–3.2's
compressed 16-day cadence, both verified against 2+ independent sources.
Phase 1 never needs an override — it's always exactly `entry.date`.

Both notes files are keyed once per fact, not per occurrence — `app.js`
applies them wherever relevant regardless of how `data.json` changes.

**`data/version-notes.json`** (keyed by major version `"1"`–`"7"`): `region`
(subtitle), `tagline` (Archon + ideal), `label` (overrides the numeral — v6
is "Luna" I/II/III), `bgImage` (region background filename).

**Asset filenames**: lowercase, spaces stripped
(`character.replace(/\s/g,"").toLowerCase()`) for faces/namecards.
**Display names**: short form for multi-title characters — Shogun,
Ayaka/Ayato, Kokomi, Yae, Itto, Kazuha, Sara, Heizou, Wanderer.

## Character detail panel
Click any avatar → side drawer (desktop) / bottom sheet (mobile). Shared
with Calendar's day panel (`#detailPanel` + `.detail-panel-*`, all in
style.css) — named `detailPanel`, not `charPanel`, for that reason. The
header has two layouts on one element: the default centered column
(Calendar's day/date headline, no avatar) and
`.detail-panel-header.is-character` (avatar + name/tags) — since the
header persists across a stack navigation rather than getting torn down,
whichever view renders next has to leave it in the right state.
`buildCharacterHeader()` (shared.js) is what Timeline's `openCharPanel` and
Calendar's `renderCharacterPanel` both call for the header specifically.
Its avatar always shows the release-style ring + sunburst rays
(GLOW_CONFIG-driven) regardless of whether *this* appearance was really a
release — the header is a hero shot for whoever's being viewed, not tied
to one appearance's release status. Appearance rows jump to their timeline
card via `jumpToCard()` without closing the panel; desktop nudges
`.timeline-root` via `transform: translateX(300px)` (not `margin` — see
`CLAUDE.md` CSS gotcha #1) so a jumped-to card isn't hidden behind the
drawer.

`.char-appear-list` reuses Timeline's `.vt-marker-col` rail-with-line
technique at list scale, so a character's own appearance history reads as
a personal thread through the site's own timeline.

Mobile drag-to-dismiss uses Pointer Events for 1:1 finger tracking via
inline `transform`. A qualifying swipe always fully closes (same as
tapping the backdrop), never pops one level of Calendar's panel stack —
overloading the gesture to sometimes mean two different things read as
inconsistent once the mobile-bar's own Back button existed to do that job
explicitly. `.detail-panel-mobile-bar` (a `1fr auto 1fr` grid) puts Back
and the drag grabber in one row for mobile, since the desktop topbar that
normally houses Back is hidden there entirely.

**Real gotcha**: the mobile breakpoint's `.detail-panel{transition:...}`
rewrite silently dropped `height` from the transition list — CSS
`transition` doesn't merge across rules, a later rule fully replaces an
earlier one's. Result was a silently-instant resize instead of animated,
mobile only. Worth remembering any time a breakpoint overrides a shorthand
property like `transition` rather than adding to it.

## Chronicled Wish banners
6 versions have a `chronicled` field → an extra `--chronicled`-accented
card after the relevant phase. The 5-star row uses plain flex-wrap; the
4-star group is pre-split into exactly two `.phase-four-col` columns (a
flat wrapped list of a dozen icons+names didn't read as a grid).

**Real bug, fixed via a reused breakpoint**: between ~480–768px those two
fixed-width columns had no room to shrink and overflowed the card — a
plain `flex-wrap` fix alone didn't fully close it, since a single column
collapsed against a near-zero-width parent still renders at its own
min-content size. Chronicled cards specifically now get the same
row→column stacking as the general `<480px` breakpoint, just starting from
the wider, already-established 768px one.

## Lightrace Wish banners
Permanent rotating banner type (debuted 6.7, `lightrace` field on that
entry) — inherits Chronicled's layout wholesale (`buildNode`'s `variant`
param takes `"chronicled"`/`"lightrace"`), only the accent color
(`--lightrace`, periwinkle) differs. Its real mechanic designates from the
*entire* 4-star roster, not a curated few, so `data.json` has no `"4"`
array for it — the card shows a live-derived count instead of a name list,
staying correct automatically as future versions add more 4-stars.

## Ambient region background
`#regionBgA`/`#regionBgB` (crossfade 1.6s) driven by the same
`IntersectionObserver` that tracks the side-nav dots. **Load-bearing**: the
starfield/dark background lives on `<body>`, not `.timeline-root` —
required for correct paint order (`CLAUDE.md` CSS gotcha #2).

## Character search
Sticky pill icon, expands via `width` transition, not `clip-path`
(`CLAUDE.md` CSS gotcha #1). Filters whitespace-insensitively (strip
spaces from both query and name before comparing).

Ported verbatim onto Calendar (`#charSearch`) — the matching/ranking/DOM
logic (`initCharSearch()`, `matchInfo()`, `highlightMatches()`) lives in
shared.js, since Timeline's `characterIndex` and Calendar's
`characterAppearances` are two independently-built but identically-shaped
name→entries indexes.

**Alternate names** (`data/character-aliases.json`, keyed by canonical
name → array of aliases, e.g. `"Tartaglia": ["Childe"]`): matches rank in
four tiers — name-starts-with, name-contains, alias-starts-with,
alias-contains — so a real name match always outranks an alias match. A
result's alias subtitle only shows the alias that actually matched the
query, not the character's full alias list.

## Timeline intro
`.timeline-intro` mirrors Server Clocks' `.clocks-intro`, added for
cross-page consistency once Timeline was the only page without any framing
text.

## Release-glow rays
`buildRays()` renders `count` absolutely-positioned ray divs per release
character — 540 total across the un-virtualized 52-version timeline.
**Fix**: `content-visibility: auto` on `.rays-wrap` specifically (not any
layout-height-contributing ancestor — `.rays-wrap` is `position:absolute`
so this never affects the `offsetTop` chains `jumpToCard()` depends on).
Cut frame time from ~36ms to ~22-28ms.

Rejected (don't re-attempt): a single `repeating-conic-gradient` per
character measured *slower* despite fewer DOM nodes and couldn't preserve
independent per-ray flicker; two orbiting dots were performance-neutral but
looked worse.

Ray angles use stratified sampling (one random angle per 360°/count arc)
to avoid clustering; the gradient has a solid plateau before fading, since
`filter: blur()` was softening the intended peak.

`buildRays()` and `buildCharacterHeader()` (the shared detail-panel
character header) live in `shared.js`, since Calendar's own character
header needs them too — Calendar loads `glow-config.js` for this reason
alone. The header's avatar uses its own denser `GLOW_CONFIG.rays.countHeader`
(16 vs. `countLg`'s 8) since it's bigger (76px vs. 48px) and, unlike the
540 phase-card instances, only ever one on screen at once.

## Header & page nav
`.site-brand` is a plain gradient-text `<a>` (not `<h1>`), always links to
`index.html` regardless of which page it's on. `#brandLiveDot` ripples next
to it when the tracked data is live (same rule as the Timeline's `.is-live`
ripple, computed independently in `shared.js` since it needs to work on
every page). `.page-nav` links to Timeline, Calendar, then Server Clocks,
identically on all four pages — the landing page has no entry for itself.
Active state is a glass pill + glow, with the pill's padding on the base
`.page-nav-link` rule (not just `.is-active`) so the nav's total width
never shifts.

## Live "current version" indicator
Pulsing ripple on the most recently *launched* `data.json` entry's patch
marker, but only if its `date` is within 42 days of today — so a
stale/behind dataset stops confidently claiming an old version is live
forever. "Most recently launched" is deliberately not just
`data[data.length-1]` — `init()` walks backward from the end for the last
entry whose `date` isn't in the future, since a version can be pre-staged
in `data.json` ahead of its official date. Same edge case, same fix
pattern, as the Server Clocks update-card (`docs/clocks.md`).
