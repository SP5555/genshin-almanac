# Genshin Almanac — project notes

Fan-made static site (vanilla HTML/CSS/JS, zero build step) tracking Genshin
Impact character banner history, growing into a multi-page companion site.
Built by the owner before they knew how to code — not a professional
codebase; keep additions zero-build/vanilla-JS unless asked to modernize.

Renamed from "GI Gacha Timeline" (repo `SP5555/GI-Gacha-Timeline`, domain
gigachatimeline.netlify.app) to "Genshin Almanac" (repo
`SP5555/genshin-almanac`) around 2026-08-23 — confirm the live Netlify
domain rather than assuming genshin-almanac.netlify.app, since the
site-name change itself was left as "maybe later."

`npm run dev` (`live-server`) is **required** for local testing — `data/*.json`
loads via `fetch()`, which is CORS-blocked on `file://`. No effect on the
deployed site (Netlify serves over https, no `netlify.toml` needed).

**Keep this file lean.** Record decisions, non-obvious reasoning, and facts
that would be expensive to re-derive (research, gotchas, rejected
approaches) — not a narrated history of routine implementation. The code
and git log already show what changed; this file should only hold what
they can't tell you.

## Directory layout

- `index.html` — landing page (the site's actual root/entry point).
  `timeline.html` — the full banner Timeline (this used to be `index.html`,
  renamed when the landing page was built — see "Landing page" below).
  `clocks.html` — Server Clocks page.
- `css/reset.css` + `css/style.css` — shared base (palette, header, footer,
  char panel, timeline, back-to-top button, brand live-dot). `css/clocks.css`
  / `css/landing.css` — page-specific styles for those two pages.
- `js/shared.js` — cross-page utilities, loaded by all three pages: the
  back-to-top button, the header brand's live-status dot, and
  `faceImg()`/`facePath()`/`formatDate()` (moved out of `app.js` once the
  landing page also needed them). `js/app.js` — Timeline page logic, still
  the only thing that knows how to render the full 52-version DOM.
  `js/glow-config.js` — release-glow ray tuning knobs, kept as `.js` not
  JSON since it applies its own values as CSS custom properties.
  `js/clocks.js` — Server Clocks logic. `js/landing.js` — landing page
  logic. Neither depends on `app.js` or on each other.
- `data/*.json` — plain JSON, no comments/trailing commas — semantics
  documented below since JSON can't hold comments.
- `assets/faces/<name>.png`, `assets/namecards/<name>.jpg`,
  `assets/elements/<element>.svg`, `assets/regions/<region>.jpg`,
  `assets/backgrounds/server-clocks.webp`, `assets/fonts/zh-cn.ttf`.

## Landing page (`index.html` / `js/landing.js` / `css/landing.css`)

Built 2026-08-24, once the site had enough real pages (Timeline + Server
Clocks) that a directory made sense — see "Multi-page architecture" below
for why that timing mattered. `index.html` no longer *is* the Timeline; it's
a lightweight page of its own, and the header brand link now points here
from every page instead of self-linking. Deliberately has no `.page-nav`
entry for itself — there's nothing to navigate *to* from the page you're
already on, and clicking the wordmark already goes here from anywhere.

**Spotlight card**: shows whichever phase of the latest `data.json` entry is
currently running, computed rather than hand-maintained:
- Phase length confirmed at **21 days** (cross-checked, not the 20 I'd
  half-remembered) via a source giving exact dates for 7.0 that matched our
  own verified data exactly (Aug 12 → Sep 1 Phase 1, Sep 2 → Sep 22 Phase 2).
  `getCurrentPhaseIndex()` in `landing.js` uses `version.date + 21×N days`
  to pick the phase.
- **Deliberately only needs to be right for the live version**, not all 52
  historical ones — historical phases don't have a "current phase" concept
  at all, they just render on the Timeline as-is. That's what makes this
  cheap: the formula only has to hold for whichever version is live *right
  now*, and the irregular historical versions (2.7's delay, 3.0–3.2's
  shortened cycles, any 3-phase version) don't need to be retroactively
  researched. If a *future* version turns out irregular, that's a one-off
  fix at that time, not a blocker now — same philosophy as the update-card
  estimate and the live-ripple heuristic.
- Release-vs-rerun status (the same "Release"/"Rerun N" badges the Timeline
  shows) needed a real per-character appearance count, but pulling in
  `app.js`'s `characterIndex` would mean rendering the entire timeline just
  to get it (see "Multi-page architecture" below — that's flagged as
  unbuilt for exactly this reason). Fix: `countAppearancesThrough()` scans
  `data.json` only up to the current version/phase for just the handful of
  characters actually shown here — same *correctness*, without needing the
  full historical index or `app.js` at all.
- Background reuses the Timeline's per-version region-art recipe, but reads
  the *current* version's region from `version-notes.json` dynamically
  rather than hardcoding today's region (Snezhnaya) — otherwise it'd go
  stale the moment a new region drops, same mistake the update-card
  override file already got rejected for.

## Timeline page (`timeline.html` / `js/app.js`)

Vertical timeline: a line down the left, a gradient bubble per major
version, a smaller bubble per patch, phases as glassmorphic cards. `--line`
(lavender `#6e5a94`) deliberately ties into the `--four` purple accent.

**`data/data.json`** — one entry per version, `banner` array of phases
(usually 2, occasionally 3), each phase has `"5"`/`"4"` arrays of
display-name strings. Keep entries as plain strings — exceptional facts go
in the notes files below, not inline. Each entry has a verified real-world
`date` (`YYYY-MM-DD` — see "Data accuracy note") and, for 6 versions, a
`chronicled` object.

**`data/character-notes.json`** (keyed by character name):
- `{"rateDown": true}` — 5-star obtainable via the standard rate-down pool,
  not truly limited (e.g. Tighnari, Dehya, Mizuki, Keqing).
- `{"preexisting": true}` — character existed before their first *tracked*
  banner (the 11 characters in the 1.0 launch roster without a featured
  slot until later). Panel note: *"Already in the game at launch — these
  appearances are technically reruns, not a debut."*

**`data/phase-notes.json`** (keyed `"<version>-<phase#>"`): `{"filler":
true}` marks a minor/padding phase (currently only `"1.3-2"`, Keqing's —
inserted before Hu Tao's funeral-parlor-themed banner to avoid landing near
Chinese New Year).

Both notes files are keyed once per fact, not per occurrence — `app.js`
applies them wherever relevant regardless of how `data.json` changes.

**`data/version-notes.json`** (keyed by major version `"1"`–`"7"`): `region`
(subtitle), `tagline` (Archon + ideal), `label` (overrides the numeral — v6
is "Luna" I/II/III), `bgImage` (region background filename).

**Asset filenames**: lowercase, spaces stripped
(`character.replace(/\s/g,"").toLowerCase()`) for faces/namecards.
**Display names**: short form for multi-title characters — Shogun,
Ayaka/Ayato, Kokomi, Yae, Itto, Kazuha, Sara, Heizou, Wanderer.

### Character detail panel
Click any avatar → side drawer (desktop) / bottom sheet (mobile). Appearance
rows jump to their timeline card via `jumpToCard()` without closing the
panel. Desktop nudges `.timeline-root` via `transform: translateX(300px)`
(not margin — see gotcha #1) so a jumped-to card isn't hidden behind the
drawer.

Mobile drag-to-dismiss: Pointer Events (not separate touch/mouse handlers)
drive 1:1 finger tracking via inline `transform`; on release the existing
open/close CSS transition finishes the motion. Hit area is much bigger
(28px tall, full width) than the visible pill (36×4px) since a 4px target
isn't realistically grabbable on touch.

### Chronicled Wish banners
6 versions have a `chronicled` field → an extra `--chronicled`-accented card
after the relevant phase. The 5-star row uses plain CSS flex-wrap rather
than manual row-splitting — gives the desired "3-3, break to 3-3-2" for
free.

### Ambient region background
`#regionBgA`/`#regionBgB` (two layers, crossfade 1.6s) driven by the same
`IntersectionObserver` that tracks the side-nav dots. **Load-bearing**: the
starfield/dark background lives on `<body>`, not `.timeline-root` —
required for correct paint order (see gotcha #2).

### Character search
Sticky pill icon, expands to a text input on hover/focus (`width`
transition — see gotcha #1 for why not `clip-path`). Filters
`characterIndex` whitespace-insensitively (strip spaces from both query and
name before comparing, map matches back onto the original string). Sorted
"starts with" before "contains." Mouse and keyboard navigation drive the
same `activeIndex`/`.is-active` state, so there's exactly one visual
"selected" row.

### Release-glow rays
`buildRays()` renders `count` absolutely-positioned ray divs per release
character (4/5★, 8/4★) — 540 total across the un-virtualized 52-version
timeline. **Fix**: `content-visibility: auto` on `.rays-wrap` specifically
(not `.vt-block` or any layout-height-contributing ancestor — `.rays-wrap`
is `position:absolute` so it never affects the `offsetTop` chains
`jumpToCard()` depends on). Cut frame time from ~36ms to ~22-28ms.

Rejected (don't re-attempt): a single `repeating-conic-gradient` per
character measured *slower* despite fewer DOM nodes, and couldn't preserve
independent per-ray flicker. Two orbiting dots were performance-neutral but
looked worse.

Two cosmetic fixes: ray angles use stratified sampling (one random angle
per 360°/count arc) to avoid clustering; the gradient has a solid plateau
(0–18%) before fading, since `filter: blur()` was softening the intended
peak at the base edge.

### Header & page nav
`.site-brand` is a plain gradient-text `<a>` (not `<h1>`), no tagline
(dropped — content speaks for itself), and always links to `index.html`
(the landing page) regardless of which page it's on — not self-referential.
A small `#brandLiveDot` ripples next to it when the tracked data is live
(same rule as the Timeline's `.is-live` ripple, computed independently in
`shared.js` since the dot needs to work on every page). `.page-nav` links
to Timeline and Server Clocks only — the landing page deliberately has no
nav entry for itself. Active gets a gold underline. Per-page framing lives
in each page's own body content, not the shared header.

### Live "current version" indicator
Pulsing ripple on the most recently *launched* `data.json` entry's patch
marker, but only if its `date` is within 42 days of today — so a
stale/behind dataset stops confidently claiming an old version is live
rather than showing it forever. Real patch lengths vary (see "Data accuracy
note"), so this can be off by a few days around historical-exception
patches — accepted, not worth a per-version override for a cosmetic
indicator.

"Most recently launched" is deliberately not just `data[data.length-1]` —
`init()` walks backward from the end for the last entry whose `date` isn't
in the future, since a version can be pre-staged in `data.json` ahead of
its official date (announced but not live yet). Same edge case, same fix
pattern, as the Server Clocks update-card below — both independently need
to distinguish "the last entry" from "the last *launched* entry."

## Server Clocks page (`clocks.html` / `js/clocks.js` / `css/clocks.css`)

Fully independent of `app.js`. Background: single static image
(`assets/backgrounds/server-clocks.webp` — Fandom served WebP despite the
`.png` source URL), same blur/dark-tint recipe as the region background, no
crossfade since there's only one image.

**Server facts** (researched via game8.co/Sportskeeda, cross-checked): 4
genuinely separate servers — America (UTC-5), Europe (UTC+1), Asia (UTC+8),
TW/HK/MO (UTC+8, shares Asia's offset but is a distinct server). Daily
reset: 4:00 AM each server's own time, independently (4 clocks).
Version-update maintenance: **one shared real-world instant** for all
servers at once, 06:00 China Standard Time — one clock, not four.

- Reset/maintenance math uses fixed-offset arithmetic (`nextServerReset()`,
  `cstDateToUtcInstant()`), deliberately not `Intl` timezone lookups — no
  real IANA zone stays pinned at a fixed offset forever (DST), unlike these
  synthetic server offsets.
- Next-update estimate = last known version's launch instant + 42 days,
  anchored to 06:00 CST (not midnight UTC — that drifted the day-count by
  up to 8 hours). No manually-maintained "confirmed date" override field —
  prototyped and deliberately rejected same-day, since it would recreate
  the manual-upkeep burden that made the site fall 17 versions behind once
  (see "Ideas discussed for future work"). Badge reads "Estimated" →
  "Overdue" (counts up instead of freezing at zero) once the 42-day window
  passes with no new version in `data.json`.
- Weekday strip (7 letters, Mon-first) marks the current in-game day, which
  flips at the 4am reset, not midnight. Colors deliberately avoid
  `--four`/`--five` (the site's star-rarity colors) since no weekday
  actually outranks another — the six regular days share one neutral
  (`--line`), only Sunday (every domain open) gets its own (`--five`).
- Detected viewer timezone shown once near the top (`Intl.DateTimeFormat`
  with `timeZoneName`), e.g. "PDT (UTC-7)", since every clock says "your
  time."
- Ring/bar fill-in: both start at their "empty" CSS value and only animate
  to the real value once each card's entrance animation finishes
  (`animationend`) — setting the real value synchronously on build (the
  original approach) never triggers a CSS transition, since there's no
  intervening paint of the empty state. `prefers-reduced-motion` skips the
  wait and sets values immediately.
- Cross-document View Transitions (`@view-transition{navigation:auto}` in
  `style.css`) animate between `index.html`↔`clocks.html` navigations with
  zero JS/router — why the site didn't need to merge into an SPA for
  smooth page transitions.
- Same stacking-context bug as gotcha #2 bit `.clocks-intro`/section
  headings here too (fixed via `position:relative;z-index:1` on
  `.clocks-root`) — can hit *any* plain text on a page with a fixed
  full-viewport background, not just the spots already patched.

Not yet built: weekly reset (Monday 4am, per-server like daily reset — 4
more clocks; likely worth combining into the existing daily card per server
rather than a separate 8-card section) and Spiral Abyss reset (16th of each
month, 4am server time).

## Design decisions
- Header is `position: relative`, not `sticky` — deliberate, so it doesn't
  occupy permanent viewport space.
- `--line` is lavender, chosen over slate-grey/bronze/icy-blue options to
  tie into `--four`.

## CSS/animation gotchas
1. **Animate only `transform`/`opacity`.** Anything else (`width`,
   `margin`, `background-attachment:fixed`) forces main-thread layout every
   frame. Bit the panel nudge (`margin-left`→`transform`), the
   region-background reveal (stray `background-attachment:fixed`), and the
   search bar (tried `clip-path`, reverted for an unrelated
   intermittent-snap issue). An element with no prior `will-change` can
   also show a one-off "cold start" dropped frame on its first transition.
2. **`position:fixed` vs. a plain element's background — paint order isn't
   DOM order, until a `transform` changes that.** A non-transformed
   element's background paints *below* a `position:fixed` sibling
   regardless of DOM order; the moment it gets a `transform` (even
   conditionally), it's promoted into its own stacking context and can
   paint *above* instead. Bit the region-bg (invisible from a stray
   `z-index:-1`), the footer disappearing behind it (fixed via
   `position:relative;z-index:1`), and the panel-open nudge transform
   promoting `.timeline-root` above the region-bg. **Rule**: never put a
   background that must stay under the region layer on an element that
   might ever receive a `transform` — put it on `<body>`.
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

## Art provenance

**Quick reference** (details/gotchas for each below):
| Asset | Source | Endpoint / file pattern |
|---|---|---|
| `assets/faces/*.png` | enka.network | `UI_AvatarIcon_*`, codenames via `store/characters.json` |
| `assets/namecards/*.jpg` | enka.network | `UI_NameCardPic_<code>_P.jpg` via `store/gi/namecards.json` — **separate codename system from faces** |
| `assets/elements/*.svg` | Fandom MediaWiki API | `File:Element_<Name>.svg` |
| `assets/regions/*.jpg` | Fandom MediaWiki API | `pageimages` on the region's wiki page |
| `assets/backgrounds/server-clocks.webp` | Fandom (direct file) | one-off, not a per-character pattern |
| `assets/splash/*.webp` | Fandom MediaWiki API | `File:<Name>_Wish.png` — **not** `Card.png`/`Game.png`/`Full Wish.png`, see below |

Face icons: enka.network `UI_AvatarIcon_*` datamine assets, codenames
resolved via enka's public `store/characters.json`/`store/loc.json` (often
don't match display names — e.g. Raiden Shogun → `Shougun`, Yanfei →
`Feiyan`). Namecards use a **separate** codename system (Kirara's avatar
codename is `Momoka`, namecard codename is `Kirara`) via
`store/gi/namecards.json`. Element watermarks: Fandom's MediaWiki API (enka
was missing Cryo). Region backgrounds: same Fandom API family
(`pageimages`), bypasses the HTTP 402 block on direct fandom.com page
fetches.

**Landing page splash art** (`assets/splash/<name>.webp`): also Fandom, but
a *different* file per character than any of the above — `File:<Name>_Wish.png`
(not `Character <Name> Full Wish.png` — similar name, different asset, see
below). This is the actual in-game wish-reveal art (dynamic pose,
transparent alpha background — confirmed via `ffprobe` showing `yuva420p`)
and, unlike everything else tried, is **genuinely pixel-uniform**: every
character checked (7+, including 4-stars) is exactly 2048x1024, since it's
HoYoverse's own fixed-size UI template rather than independently-composed
promotional art. `object-fit: contain` is still used rather than `cover` —
a uniform canvas doesn't guarantee a uniform *pose* within it, so contain
remains the safe choice — but with the box ratio matching the source
exactly there's effectively no letterboxing in practice.

Took four tries to land on, kept here so they aren't re-attempted:
`File:<Name> Card.png` bakes the gacha-pull card frame and "GENSHIN IMPACT"
logo into the image itself (not croppable away with CSS); `File:Character
<Name> Game.png` is a plain standing in-game render on a flat backdrop, not
real splash art; `File:Character <Name> Full Wish.png` *is* real splash art
(same dynamic-pose style as the one that stuck) but not uniformly sized
across characters (checked: ~1.3:1, not pixel-identical) — easy to confuse
with `<Name>_Wish.png` since both are "Wish"-named and visually similar,
but only the latter is on the fixed template. Honey Hunter World
(`honeyhunterworld.com`) hosts a fourth style — a tight cropped close-up
used for the actual in-game pull reveal animation — but blocks
hotlinking/scraping (403), so it was never a usable source regardless of
how it looked.

Don't re-derive codenames by guessing for future characters/regions — they
often don't match the display name.

## Data accuracy note
Verified 5.3–7.0 by cross-referencing game8.co/gamewith.net/etc. against
each other (a single AI-summarized fetch of an aggregator page produced
garbled version numbers — don't trust that alone). One moderate-confidence
item: 6.2 Phase 2's 4-star trio (Iansan, Chevreuse, Gaming), confirmed
twice via game8.co but not a third source. 7.0 Phase 2's 4-star trio is
intentionally empty (not yet officially revealed as of last update). 7.1
deliberately not added — was still beta-leak territory with no datamined
icons.

1.0 launch roster (confirmed): Barbara, Fischl, Xiangling, Noelle, Sucrose,
Xingqiu, Beidou, Ningguang, Chongyun, Razor, Bennett. Genuine within-1.X
debuts: Diona (1.1, despite being easy to assume launch roster), Xinyan
(1.1), Rosaria (1.4), Yanfei (1.5).

All 52 versions have a verified real launch `date` — not a naive "every 42
days" formula. Two real exceptions: **2.7 delayed ~20 days** (Shanghai
COVID lockdown, May 10→31 2022), **3.0–3.2 each ran 35 days** (7 short × 3)
to recover that delay by 3.3.

## Ideas discussed for future work (not started)
- Weapon banners aren't tracked (character banners only).
- No personal pull-tracking or stats view (longest drought, most-reran
  character, release-cadence chart).
- The manual per-patch update process (hand-editing `data.json` +
  hand-sourcing art) is why the site fell 17 versions behind once — worth a
  scripted/automated data pipeline if picking this up as a project.
- Multi-page candidates, roughly by "reuses existing data with least new
  work": **Stats/analytics** (pure computation over existing data) →
  **Character profile pages** (dedicated shareable URLs) → **Region/lore
  explorer** (browse by nation; real gap: no character→region mapping
  exists yet — `character-elements.json` is element, not nation; needs a
  new `character-regions.json` with an explicit `"Unaffiliated"` sentinel
  for characters like Skirk, not omission) → **"On this day"** page (free
  now that every version has a real date).
- Server Clocks (built) was the differentiator second page; Region/lore
  explorer is the likely third.

## Multi-page architecture
Separate physical HTML pages (not a JS router/SPA) — zero-build, Netlify
serves multi-page static sites with no config. Smooth transitions between
pages come from the native cross-document View Transitions API, not from
merging into an SPA (see Server Clocks section).

`css/clocks.css` + `js/clocks.js` are the first realization of the "shared
base + page-specific stylesheet/script" split — `app.js` itself hasn't been
split into shared-utilities-vs-timeline-specific yet, since no page has
needed to reuse its helpers (`faceImg()`, `characterIndex` building, etc.)
so far. Do that split when a page actually needs it (e.g. Character profile
pages).

Header is duplicated per page (not templated) — fine at 2-4 pages, not
worth the machinery. `data.json` (12.3KB total) isn't worth splitting
per-version for lazy-loading at current size — revisit only at a 10-20x
size increase.
