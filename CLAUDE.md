# Genshin Almanac — project notes

Fan-made static site (vanilla HTML/CSS/JS, zero build step) tracking Genshin
Impact character banner history, growing into a multi-page companion site.
Built by the owner before they knew how to code — not a professional
codebase; keep additions zero-build/vanilla-JS unless asked to modernize.

Renamed from "GI Gacha Timeline" (repo `SP5555/GI-Gacha-Timeline`, domain
gigachatimeline.netlify.app) to "Genshin Almanac" (repo
`SP5555/genshin-almanac`, live at genshin-almanac.netlify.app) around
2026-08-23.

`npm run dev` (`live-server`) is **required** for local testing — `data/*.json`
loads via `fetch()`, which is CORS-blocked on `file://`. No effect on the
deployed site (Netlify serves over https, no `netlify.toml` needed).

**Keep this file lean.** Record decisions, non-obvious reasoning, and facts
that would be expensive to re-derive (research, gotchas, rejected
approaches) — not a narrated history of routine implementation. The code
and git log already show what changed; this file should only hold what
they can't tell you. Same goes for inline code comments and the per-page
docs below: state the current fact, not the sequence of attempts that led
to it.

## Directory layout

- `index.html` — landing page (the site's actual root/entry point).
  `timeline.html` — the full banner Timeline (used to be `index.html`,
  renamed when the landing page was built). `clocks.html` — Server Clocks
  page. `calendar.html` — Calendar page.
- `css/reset.css` + `css/style.css` — shared base (palette, header, footer,
  detail panel, timeline, back-to-top button, brand live-dot). `css/clocks.css`
  / `css/landing.css` / `css/calendar.css` — page-specific styles for those
  three pages.
- `js/shared.js` — cross-page utilities, loaded by all four pages: the
  back-to-top button, the header brand's live-status dot,
  `faceImg()`/`facePath()`/`formatDate()`/`countAppearancesThrough()`,
  `swapWithFade()` (generic fade-out/swap-DOM/resize/fade-in animation),
  and `previewNow()` (see "Testing date/time-sensitive UI"). `js/app.js` —
  Timeline page logic, still the only thing that knows how to render the
  full 52-version DOM. `js/glow-config.js` — release-glow ray tuning knobs,
  kept as `.js` not JSON since it applies its own values as CSS custom
  properties. `js/clocks.js` — Server Clocks logic. `js/landing.js` —
  landing page logic. `js/calendar.js` — Calendar page logic. None of the
  four depend on each other.
- `data/*.json` — plain JSON, no comments/trailing commas. `data/SOURCES.md`
  — art asset sourcing reference (APIs, file patterns, codenames) and the
  data-accuracy research behind `data.json`'s dates/rosters, split out so
  it's only loaded when actually sourcing new art or adding a new version.
- `assets/faces/<name>.png`, `assets/namecards/<name>.jpg`,
  `assets/elements/<element>.svg`, `assets/regions/<region>.jpg`,
  `assets/backgrounds/server-clocks.webp`, `assets/fonts/zh-cn.ttf`.
- `scripts/validate-data.js` (`npm run validate`) — cross-checks the
  `data/*.json` files against each other; see "Data validation" below.
- `docs/` — one file per page, holding that page's implementation notes
  (data schemas it owns, physics/animation internals, real bugs caught and
  fixed, rejected approaches). Read the relevant one before working on that
  page; this file only holds what's true across all of them:
  - [`docs/landing.md`](docs/landing.md) — `index.html` / `js/landing.js` /
    `css/landing.css` (spotlight carousel physics, trivia ticker, sidebar).
  - [`docs/timeline.md`](docs/timeline.md) — `timeline.html` / `js/app.js`
    (data.json schema, detail panel, chronicled/lightrace banners, search,
    release-glow rays).
  - [`docs/clocks.md`](docs/clocks.md) — `clocks.html` / `js/clocks.js` /
    `css/clocks.css` (server/reset facts, timezone math).
  - [`docs/calendar.md`](docs/calendar.md) — `calendar.html` /
    `js/calendar.js` / `css/calendar.css` (year/month grid, debuts,
    birthdays, day panel, panel stack).

## Design decisions
- Header is `position: relative`, not `sticky` — deliberate, so it doesn't
  occupy permanent viewport space.
- `--line` is lavender, chosen to tie into `--four`.
- Breakpoints are shared across pages on purpose (`480`/`600`/`768`/`900`
  only) — fewer distinct widths means fewer places the layout visibly
  jumps as the window resizes.

## CSS/animation gotchas
1. **Animate only `transform`/`opacity`.** Anything else (`width`,
   `margin`, `background-attachment:fixed`) forces main-thread layout every
   frame. Bit the panel nudge (`margin-left`→`transform`) and the region-
   background reveal (stray `background-attachment:fixed`). An element
   with no prior `will-change` can also show a one-off "cold start" dropped
   frame on its first transition.
2. **`position:fixed` vs. a plain element's background — paint order isn't
   DOM order, until a `transform` changes that.** A non-transformed
   element's background paints *below* a `position:fixed` sibling
   regardless of DOM order; the moment it gets a `transform` (even
   conditionally), it's promoted into its own stacking context and can
   paint *above* instead. **Rule**: never put a background that must stay
   under the region layer on an element that might ever receive a
   `transform` — put it on `<body>`.
3. **`position:sticky`** is the right tool for "docks below X, then sticks
   to the viewport edge" — no scroll listener needed. Give the sticky
   wrapper `height:0;overflow:visible` so it doesn't also push content
   down.
4. **`overflow:hidden` on `<body>` doesn't stop touch-scroll chaining if
   `<html>` is the real scroll owner** — `html{overflow-x:hidden}` with no
   explicit `overflow-y` computes `overflow-y:auto` per spec, making
   `<html>` the scrolling box. Lock `panel-open` on both
   `documentElement` and `body`. Verify touch fixes via real CDP
   `Input.dispatchTouchEvent`, not synthetic `TouchEvent` (doesn't drive
   Chromium's real touch pipeline).
5. **`background-clip:text` gradients size to the element's box, not the
   rendered text** — short strings only reveal a sliver of the gradient
   unless the element is `display:inline-block` so its box shrinks to its
   content.
6. **`<svg>` has `overflow:hidden` by default**, clipping anything past its
   viewBox — including `filter:drop-shadow()` glow on a child near the
   edge. Set `overflow:visible` on the `<svg>` itself.
7. **Multiple `backdrop-filter:blur()` elements on one page can visibly
   "bleed"/ghost onto each other** in Chrome (real GPU compositing only,
   not reproducible headless — treat it as a real class of bug regardless).
   Fix: `isolation:isolate` on the blurred elements so each composites
   independently instead of sharing a backdrop bitmap with layout
   siblings; also make sure any property that changes on `:hover` (e.g.
   `box-shadow`) is in the element's `transition` list rather than popping
   in instantly, since an abrupt style change seems to trigger the
   shared-bitmap recompute in the first place.

## Art provenance & data accuracy
Moved to `data/SOURCES.md` — API endpoints, file-naming patterns,
codenames, rejected asset sources (with why), and how `data.json`'s
dates/rosters were verified (confidence levels, the 1.0 launch roster),
kept out of this file so routine sessions don't need to load it. Read it
before sourcing any new character/region art, or before adding a new
version to `data.json`.

## Data validation
`npm run validate` (`scripts/validate-data.js`) cross-checks `data.json`
against `character-notes.json`, `character-elements.json`,
`character-aliases.json`, and `phase-notes.json`. Split into one file per
concern under `scripts/checks/` (`character-notes.js`, `character-elements.js`,
`character-aliases.js`, `phase-notes.js`, `character-assets.js`), each
exporting a `(ctx) => problems[]` function; `validate-data.js` itself is
just the runner — loads the JSON once, builds `ctx`, calls every check,
reports. `scripts/checks/util.js` holds the shared bits every check needs:
`readJSON`/`assetPath`/`slug`, and `buildCanonicalData()` — deriving the
canonical character/phase set from `data.json` (including `chronicled`
*and* `lightrace` entries, not just `banner[]`) once in the runner rather
than per-check. Checks: orphaned keys, characters missing an element (or
an element with no matching `assets/elements/*.svg`), alias strings reused
across two characters, stale `phase-notes` keys, and missing face/namecard
art (which fail *silently* in the UI — neither has an `onerror`
fallback). Not wired into CI yet, so it only catches things when someone
remembers to run it.

Add a new check by dropping a file in `scripts/checks/` (same
`(ctx) => problems[]` shape) and requiring it in `validate-data.js`'s
`checks` array — deliberately an explicit list, not a directory scan, so
it's obvious from one place which checks actually run.

## Testing date/time-sensitive UI
`previewNow()` (`js/shared.js`) is a drop-in replacement for `Date.now()`/
`new Date()` everywhere "now" is read for UI purposes (phase math, daily
reset countdowns, live indicators) — used across `landing.js`, `clocks.js`,
and `app.js`. Add `?fakeDate=2026-09-30T14:30:00` (date-only also works) to
any page's URL while running `npm run dev` to preview it as of that instant
— time keeps flowing forward normally from there (a fixed offset applied
to the real clock, computed once at load) rather than freezing, so
`setInterval`-driven countdowns still tick realistically during testing.
Gated to `localhost`/`127.0.0.1` so it's structurally inert on the
deployed site regardless of what URL a visitor tries — the offset is
hardcoded to 0 off that hostname check, not just hidden. Parsing a
*stored* date from `data.json` should still use a plain `new Date(...)` —
only reads of the current moment go through this. Per-URL only, not
persisted across navigation.

## Ideas discussed for future work (not started)
- Weapon banners aren't tracked (character banners only).
- No personal pull-tracking or stats view (longest drought, most-reran
  character, release-cadence chart) — **deliberately deprioritized**, not
  just unbuilt: plenty of other Genshin sites already do plain stats
  dashboards, and the data being there doesn't matter if the presentation
  reads as generic. Only worth revisiting with a genuinely distinctive
  presentation angle.
- The manual per-patch update process (hand-editing `data.json` +
  hand-sourcing art) is why the site fell 17 versions behind once — worth a
  scripted/automated data pipeline if picking this up as a project.
- Multi-page candidates still on the table: **Region/lore explorer**
  (browse by nation, reusing the region-background/glow visual language
  already built for Timeline/landing) — real gap: no character→region
  mapping exists yet (`character-elements.json` is element, not nation;
  needs a new `character-regions.json` with an explicit "Unaffiliated"
  sentinel for characters like Skirk, not omission). **Character profile
  pages** (dedicated shareable URLs) are the next-cheapest candidate after
  that.
- "On this day" — partly built as the landing trivia ticker's anniversary
  cards and, more fully, as the Calendar page's year-view grid. A dedicated
  single-date page would still need the same nearest-match handling.

## Multi-page architecture
Separate physical HTML pages (not a JS router/SPA) — zero-build, Netlify
serves multi-page static sites with no config. Smooth transitions between
pages come from the native cross-document View Transitions API, not from
merging into an SPA (see `docs/clocks.md`).

`app.js` itself hasn't been split into shared-utilities-vs-timeline-specific
yet, since no page has needed to reuse its full `characterIndex` building.
Several standalone pieces did move to `shared.js` once a second page needed
the same non-render logic without the full index: `countAppearancesThrough()`,
`buildRays()`, the character-search stack (`initCharSearch()`/`matchInfo()`/
`highlightMatches()`), and `joinNames()` (Oxford-comma list join). Do the
bigger split when a page actually needs the full index (e.g. Character
profile pages).

Header is duplicated per page (not templated) — fine at 2-4 pages, not
worth the machinery. `data.json` (12.3KB total) isn't worth splitting
per-version for lazy-loading at current size — revisit only at a 10-20x
size increase.
