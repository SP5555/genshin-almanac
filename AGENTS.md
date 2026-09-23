# Genshin Almanac — project notes

Fan-made static site (vanilla HTML/CSS/JS, zero build step) tracking
Genshin Impact character banner history. Keep additions zero-build /
vanilla JS unless asked to modernize.

`npm run dev` (`live-server`) is required locally — `data/*.json` loads
via `fetch()`, which is CORS-blocked on `file://`. The deployed site
(Netlify, https, no `netlify.toml`) does not have this problem.

**This file holds what the code cannot.** Decisions, rejected approaches,
and facts that would be expensive to re-derive. Not a directory listing,
not a changelog, not a walkthrough of how a function works. Docs stay
version-agnostic unless the version *is* the fact: 1.3's filler phase,
2.7's delay, 3.0–3.2's shortened cadence, the 1.0 launch roster.

Per-page notes: [`docs/landing.md`](docs/landing.md),
[`docs/timeline.md`](docs/timeline.md), [`docs/clocks.md`](docs/clocks.md),
[`docs/calendar.md`](docs/calendar.md). Art sources and roster/date
research: [`data/SOURCES.md`](data/SOURCES.md) — read it before sourcing
art or adding a version.

## Layout (the parts that aren't obvious from filenames)

Root `*.html` files are thin entry points. Page code lives in
`src/pages/<page>/` as ES modules with explicit imports. `src/shared/` is
split by concern so an import states the dependency. `src/styles/base.css`
holds only what two or more pages actually use.

`timeline.js` is still the only thing that builds a full per-character
appearance index. Landing uses `countAppearancesThrough()` instead of
importing that. Split the index out when a page actually needs it, not
before.

Header HTML is duplicated per page — fine at a handful of pages, not worth
templating without a build step. `data.json` is small; don't split it
per-version until it's an order of magnitude larger.

## Design decisions

- Header is `position: relative`, not `sticky` — it should not occupy
  permanent viewport space.
- `--line` is lavender, chosen to tie into `--four`.
- Breakpoints are shared on purpose (`480` / `600` / `768` / `900` only).
- Separate physical HTML pages, not a JS router. Cross-document View
  Transitions (`@view-transition { navigation: auto }`) are why that still
  feels like one site.
- Character banners only. No separate confirmed-next-version date field —
  a stale override would rot the same way skipped patch updates do. If
  the newest `data.json` row is still in the future, Server Clocks counts
  down to that date ("Confirmed"). Otherwise next-update is last launch
  + 42 days, then "Overdue".

## CSS/animation gotchas

1. **Animate only `transform` / `opacity`.** Anything else (`width`,
   `margin`, `background-attachment: fixed`) forces main-thread layout
   every frame. An element with no prior `will-change` can also drop one
   frame on its first transition.
2. **`position: fixed` vs. a plain element's background — paint order
   isn't DOM order until a `transform` changes that.** A non-transformed
   element's background paints *below* a `position: fixed` sibling
   regardless of DOM order. **Rule:** a background that must stay under
   the region layer goes on `<body>`, never on an element that might
   receive a `transform`.
3. **`position: sticky`** for "docks below X, then sticks." Give the
   wrapper `height: 0; overflow: visible` so it doesn't also push content
   down.
4. **`overflow: hidden` on `<body>` doesn't stop touch-scroll chaining if
   `<html>` is the real scroll owner.** `html { overflow-x: hidden }` with
   no `overflow-y` computes `overflow-y: auto`, making `<html>` the
   scrolling box. Lock `panel-open` on both `documentElement` and `body`.
   Verify touch via real CDP `Input.dispatchTouchEvent`, not a synthetic
   `TouchEvent`.
5. **`background-clip: text` gradients size to the element's box**, not
   the rendered text — short strings need `display: inline-block`.
6. **`<svg>` defaults to `overflow: hidden`**, clipping `filter:
   drop-shadow()` glow on a child near the edge. Set `overflow: visible`
   on the `<svg>`.
7. **Multiple `backdrop-filter: blur()` elements can ghost onto each
   other in Chrome** (real GPU compositing; not reproducible headless).
   `isolation: isolate` on each blurred element; include any `:hover`
   property (e.g. `box-shadow`) in `transition` so it doesn't pop and
   trigger a shared-bitmap recompute.

8. **Never `scroll-behavior: smooth` or `behavior: "smooth"`.** Chromium
   runs that animation on its own clock, well below a high-Hz display.
   Window jumps go through `src/shared/scroll.js` (rAF / vsync, wall-clock
   duration). CSS transitions and the landing springs already follow
   vsync; `SPRING_STEP_MS` is only a tuning conversion, not a tick rate.

A CSS `transition` shorthand on a breakpoint **replaces** the base list
rather than merging — if a later rule restates `transition`, every
property the base was animating has to be repeated or it becomes instant.

## Data & art

The agent runs `npm run fetch-art -- <Name>` (the user does not). It
downloads face / namecard / splash from the sources in `data/SOURCES.md`
and does not edit JSON. Empty `"4": []` on a phase is valid (5-stars
confirmed first); omitting the key is not — most readers assume the key
exists. Face lookup can lag on `characters.json`/`loc.json`; details and
the no-guessing rule live in `SOURCES.md` and the add-version skill.

`npm run validate` (`scripts/validate-data.js`) is an explicit list of
checks in `scripts/checks/` — not a directory scan. Face and namecard
`<img>`s have no `onerror` fallback, so missing files fail silently in
the UI; the checker is what catches them. Splash is allowed to be
missing (landing shows a note). Not wired into CI.

## Testing date/time-sensitive UI

`previewNow()` is the stand-in for `Date.now()` / `new Date()` wherever
"now" is read for UI. `?fakeDate=2026-09-30T14:30:00` (date-only works)
on localhost applies a fixed offset so intervals still tick. Off
`localhost` / `127.0.0.1` the offset is hardcoded to 0, not merely hidden.
Not localStorage — `chrome.js` copies the param onto in-site links so a
click from landing to Timeline stays in the same preview.

`npm run when -- 2026-09-23T06:00:00+08:00` prints live-dot / spotlight
phase / next-update from the same functions the pages import (`dates.js`).
Date-only is 06:00 CST. Check the UI against it; the script has no
separate copy of the formulas.

"Has this version launched" and the 42-day live window use
`versionLaunchInstant()` — 06:00 CST of `data.json`'s date, the real
maintenance start — not local midnight. Displayed calendar dates stay
YYYY-MM-DD.

## Deliberately not doing

- **Weapon banners, personal pull-tracking, stats dashboards.** Other
  Genshin sites already do those; only revisit with a presentation that
  isn't generic.
- **Region / lore explorer** still needs `character-regions.json` with an
  explicit `"Unaffiliated"` sentinel (omission is not unaffiliated).
- **Dedicated character profile pages.** Timeline already has shareable
  `?char=` URLs; a standalone page has to add something the drawer
  doesn't.
- **A dedicated "on this day" page.** Landing trivia and Calendar already
  cover nearest-match / year-grid; a single-date page would still need
  the same nearest-match handling.
