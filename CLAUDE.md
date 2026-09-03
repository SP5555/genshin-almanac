# Genshin Almanac — project notes

Fan-made static site (vanilla HTML/CSS/JS, zero build step) tracking Genshin
Impact character banner history, growing into a multi-page companion site.
Built by the owner before they knew how to code — not a professional
codebase; keep additions zero-build/vanilla-JS unless asked to modernize.

Renamed from "GI Gacha Timeline" (repo `SP5555/GI-Gacha-Timeline`, domain
gigachatimeline.netlify.app) to "Genshin Almanac" (repo
`SP5555/genshin-almanac`, live at genshin-almanac.netlify.app — confirmed
2026-08-24) around 2026-08-23.

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
  documented below since JSON can't hold comments. `data/SOURCES.md` — art
  asset sourcing reference (APIs, file patterns, codenames), split out so
  it's only loaded when actually sourcing new art — see "Art provenance"
  below.
- `assets/faces/<name>.png`, `assets/namecards/<name>.jpg`,
  `assets/elements/<element>.svg`, `assets/regions/<region>.jpg`,
  `assets/backgrounds/server-clocks.webp`, `assets/fonts/zh-cn.ttf`.
- `scripts/validate-data.js` (`npm run validate`) — cross-checks the
  `data/*.json` files against each other; see "Data validation" below.

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

### Spotlight carousel
Physics-driven, drag/momentum/3D-tilt — deliberately heavier than every
other interactive bit on this page (see "Trivia ticker" below for the
opposite call). Fixed 3-slot ring buffer (prev/center/next) rather than one
DOM node per character — needed because a 2-character banner has the same
character visible on both sides at once, which breaks any "which side does
this go on" logic; content reassignment only happens inside
`resolveRotation()` the instant a slot is fully offscreen (`dist ≥ 1.5`).
Multi-step jumps (e.g. dot-clicking 2 characters over) run as **one**
continuous rAF sweep, not chained CSS transitions — chaining caused a
visible dead-stop at the midpoint character before re-accelerating.
`settle()`'s eased curve (drives auto-advance, dot-clicks, and drag-release
corrections alike) is a true ease-in-out cubic, not ease-out-only — the
original `1 - (1-t)^3` snapped to full speed instantly and only decelerated
into the stop, reading as an abrupt kick at the start of every
programmatic move; symmetric slow-start/fast-middle/slow-stop feels calmer
for a move nothing prompted.
3D tilt (`perspective` + `rotateY`) reaches full magnitude by `dist:0.4`,
not `dist:1` — ramping linearly to `dist:1` meant it only got visibly large
right as opacity had already faded the card to nothing, so it never read
as depth (same "front-load the effect" fix applied to the brightness dim).
Splash art: `object-fit` (cover or contain) always clips to its own box, no
matter what an ancestor's `overflow` says — to get cover's exact scale
*without* the crop, the `<img>` is absolutely positioned inside a
fixed-aspect-ratio wrapper, sized by height alone (width left to its
natural 2:1 ratio) so it bleeds past the wrapper's sides symmetrically,
clipped only by `.spotlight-banner` itself. Must be `position:absolute`,
not a flex child sized by `height:100%` — a flex child's percentage height
resolving against a purely `aspect-ratio`-derived container height is
circular (the container's content-size pass sees the image's raw 1024px
intrinsic height before `aspect-ratio` constrains it), inflating the
wrapper to the wrong size.

**4-star mini cards** (below the carousel) use the same splash art + the
same crop technique (now squared to `aspect-ratio:1/1` — the existing
"sized by height, centered, clipped by the card's own overflow:hidden"
approach already behaves exactly like `object-fit:cover` once the box gets
narrower than the source's 2:1 ratio, so squaring it up needed no new
technique, just the one ratio number) — real art instead of a circular
face icon, still clearly secondary by scale alone. Release-vs-rerun is the
tag text only (`Release`/`Rerun N`, same convention the 5-star figures
use), not a separate grayscale-filter/colored-ring distinction — one
convention for that fact, not two.

Cards are fluid width (`flex:1 1 45%` below 600px, `flex:1 1 0` at
≥600px), not fixed pixels — deliberately spans the same full width as the
carousel above it. The mobile "2 on top, 1 on bottom" fallback below 600px
falls out of plain flexbox for free: `flex-basis:45%` fits two per row
(grown to ~50% each), a third has no room and wraps alone. **The lone card
is capped, not stretched**: `max-width:calc(50% - 6px)` (50% of the row,
minus half the 12px gap — exactly what a card grows to when there ARE two
per row) plus `margin:0 auto` keeps it the same size as its siblings,
centered with empty space either side, instead of letting `flex-grow`
blow it up to a full 100%-width row. That stretch was tried first and
rejected: at 2x the width, the `aspect-ratio:1/1` image wrap scaled up
with it, making that one character's art visibly bigger than the other
two for no reason tied to the character itself. Checked the real
distribution before relying on "usually exactly 3": 104 of ~110 phases in
`data.json` (incl. `chronicled`) have exactly 3 four-stars; rarer counts
(up to 13, chronicled banners) still wrap via the same `flex-wrap`. The
element watermark's `background-size` is a percentage (`130% 130%`), not a
fixed pixel value, for the same fluid-width reason.

The name/tag label overlaps the art itself, reclaiming that height for the
splash art instead of pushing the card taller — but as an
`position:absolute; bottom:8px` overlay on `.spotlight-fourcard` itself,
**not** the `.spotlight-figure-label` carousel's `margin-top:-Npx` trick.
That negative-margin approach only overlaps correctly if the label is
always the same height, and it isn't: preexisting-roster characters (e.g.
Sucrose — see below) skip the tag entirely, so their label is just the
name, shorter than the two-line name+tag case the margin was tuned for. A
fixed negative margin sized for the tall case over-pulls the short case,
which — since the label still sits in normal flex flow — shrinks that
card's total height and clips the bottom of its own art (caught exactly
this way: Sucrose's card came out 22px shorter than Alyosha's/Lynette's,
with ~11px of her splash art cut off). Taking the label out of flow
entirely with `position:absolute` sizes the card off the image wrap alone,
so every card is identical regardless of that character's label height —
worth remembering as the general fix whenever an overlapping caption's
content length can vary (the carousel's `.spotlight-figure-label` has the
same latent risk, just not yet hit live, since no currently-preexisting
5-star lacks every tag). Text-shadow (not a background box) keeps the name
legible against whatever's directly behind it, mirroring the figure name.

Preexisting-roster characters (e.g. Sucrose) show no tag at all, same as
on the carousel — calling their first tracked appearance "Release" would
be wrong and a "Rerun N" count would be meaningless without knowing their
real 1.0 debut, so the tag is omitted rather than shown incorrectly.

### Trivia ticker
Deliberately the *lightweight* opposite of the spotlight carousel above —
plain text, no drag physics, auto-advance/dots/pause-on-hover only. Cards
come from two sources: real version-anniversary facts (computed) and a
hand-written pool in `data/trivia.json` (flat string array, 3 sampled per
load), shuffled together so an anniversary card doesn't always lead.
- **Anniversaries are nearest-match, not exact-date** — checked the real
  spread first: 52 versions land on only 51 of 365 possible month-days, so
  a strict "today" match would be empty ~86% of the time. Always shows the
  nearest past *and* nearest future launch anniversary instead, collapsing
  to a single "on this day" card on the rare exact hit (this does happen
  — 1.0 and 3.1 both launched on Sep 28, different years; ties break
  toward whichever occurrence is chronologically closest to today). No
  emoji — tried one (🎉) but it wasn't rendering for the user, so trivia
  text is plain throughout.
- **The past/future cards state years elapsed, not just the date** —
  `"2 days ago — version 3.0 (Sumeru) marked 4 years since its Aug 24, 2022
  launch."` The raw date alone made the reader do the math; stating the
  age is the actually-interesting fact. This meant a version that launched
  earlier in the *current* calendar year could win the "nearest past"
  search (e.g. it released 3 days ago for real) and get worded as "marked
  0 years since" — nonsense, since it hasn't had an anniversary yet. Fixed
  at the search step, not the sentence: entries whose `launch.getFullYear()
  === year` are skipped from the day-count buckets entirely (unless
  `diffDays===0`, the genuine "launched today" case the exact-match branch
  above already handles correctly), so the nearest-past/future search falls
  through to the next real ≥1-year anniversary instead of ever selecting a
  same-year entry to word awkwardly.
- **Past/future cards append which characters debuted that version, when
  any did** — `getDebuts()` checks every character (both rarities) via the
  existing `countAppearancesThrough()` (===1 through that version's last
  phase) and excludes `preexisting` characters, same distinction the
  Release/Rerun tags already make. Originally 5-star-only (reasoning: 4-star
  debuts happen almost every version, so including them would make nearly
  every card verbose) — reverted to include both after the 5-star-only
  version felt too sparse; 5-stars still lead the list (collected in a
  separate pass, concatenated after) since they're still the more
  headline-worthy fact, just no longer the only one mentioned. **The clause
  is appended only when the list is non-empty** (`joinNames()`,
  Oxford-comma "A", "A and B", "A, B, and C") — even counting both
  rarities, some versions are still pure reruns of existing characters
  (checked: 3.8 is the only one left with zero debuts of either rarity), so
  forcing an "introducing" clause into every card would mean either an
  empty one or a misleading one; omitting it for those versions is correct,
  not a gap. Chronicled banners aren't scanned for debuts — by definition
  they only ever bring back characters from an already-released region, so
  a chronicled entry can never contain a genuine first appearance.
- **The progress bar's own CSS animation *is* the auto-advance timer** —
  its `animationend` event triggers `goTo()`, rather than tracking
  elapsed/remaining time by hand in JS (`animation-duration` set inline
  from `TRIVIA_INTERVAL_MS`, matched to a `resetProgress()` helper that
  restarts it — remove `.is-animating`, force a reflow, re-add it). An
  earlier hand-rolled `setTimeout`+`remainingMs` version tried to replicate
  what the browser already does for free when you pause/resume a CSS
  animation, and was strictly more bug-prone for it (a real bug: the fired
  timeout not rescheduling itself broke repeat entirely) — worth remembering
  before reaching for manual timer math again for anything already backed
  by a pausable CSS animation.
- **Pausing is a single `setPaused(bool)` that toggles one class**
  (`animation-play-state:paused`), driven by whichever signal means "the
  user is engaged with this card" for the current input method — real
  `mouseenter`/`mouseleave` on hover-capable devices (`matchMedia
  "(hover:hover)"`), or, on touch, whether the most recent click *anywhere
  on the page* landed inside `.landing-trivia` (a document-level click
  listener checking `.contains()`). Touch has no real hover to leave, so a
  mouseenter/mouseleave pair there pauses on tap and never un-pauses;
  "last click was inside this card" is the mobile-appropriate substitute,
  and it naturally covers the whole card (including the label and the
  dots) for free, not just one sub-element.
- Skips auto-advance entirely (dots still work) under
  `prefers-reduced-motion`, and the progress bar isn't even built in that
  case — showing a filling bar for a state that never advances would be
  misleading.

### Sidebar layout (desktop)
Below 900px, everything is single-column exactly as it always was — no
behavior differs. At ≥900px, `.landing-columns` becomes a flex row: the
spotlight carousel (`flex:1`) on the left, a 320px sidebar (trivia ticker +
link cards, stacked) on the right. The spotlight's own label/heading/sub
text was pulled *out* of that column entirely into a full-width
`.landing-spotlight-intro` above the split — only the carousel itself is
the "left column" content.

Link cards get a distinct hover language from the other three glass cards
here (spotlight banner / 4-star cards / trivia) since they're the only
ones that are actually clickable navigation: gold border + glow on hover,
plus a **permanently visible** gold chevron (not hover-only) — hover
doesn't exist on mobile at all, so the always-on chevron is what actually
signals "this navigates" there; the chevron additionally "breathes" on
hover, gated behind `@media (hover:hover) and (prefers-reduced-motion:
no-preference)` since a touch device's post-tap "sticky hover" state could
otherwise leave a looping animation visibly stuck on.

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
name before comparing, map matches back onto the original string). Mouse
and keyboard navigation drive the same `activeIndex`/`.is-active` state, so
there's exactly one visual "selected" row.

**Alternate names** (`data/character-aliases.json`, keyed by canonical
name → array of aliases, e.g. `"Tartaglia": ["Childe"]`): matches rank in
four tiers — name-starts-with, name-contains, alias-starts-with,
alias-contains — so a real name match always outranks an alias match
rather than the two competing on equal footing. The result row's alias
subtitle only shows whichever alias *actually matched the query*, not the
character's full alias list — a character with several aliases (there are
a few) would otherwise dump all of them under every result regardless of
relevance.

### Timeline intro
`.timeline-intro` (title + one-line subtitle, mirrors Server Clocks'
`.clocks-intro`) was added purely for cross-page consistency once the site
had enough pages that Timeline being the only one without any framing text
started to stand out.

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
nav entry for itself. Active is a glass pill + soft gold glow (not an
underline) — the pill's padding lives on the base `.page-nav-link` rule,
not just `.is-active`, so every link occupies the same box regardless of
which one is active and the nav's total width never shifts. Per-page
framing lives in each page's own body content, not the shared header.

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
7. **Multiple `backdrop-filter:blur()` elements on one page can visibly
   "bleed"/ghost onto each other** in Chrome — reported as a faint white
   gradient flashing across the unrelated 4-star cards whenever hovering a
   landing link card, only at desktop widths where both sit in the same
   flex-row layout. Not reproducible in headless/software-rendered
   Chromium (this needs real GPU compositing), so treat it as a real class
   of bug even without being able to see it locally. Fix: `isolation:
   isolate` on the blurred elements so each composites independently
   instead of sharing a backdrop bitmap with layout siblings; also make
   sure any property that changes on `:hover` (e.g. `box-shadow`) is in
   the element's `transition` list rather than popping in instantly, since
   an abrupt style change is what seems to trigger the shared-bitmap
   recompute in the first place.

## Art provenance
Moved to `data/SOURCES.md` — API endpoints, file-naming patterns,
codenames, and rejected asset sources (with why), kept out of this file so
sourcing new art doesn't require loading all of CLAUDE.md. Read it before
sourcing any new character/region art.

## Data validation
`npm run validate` (`scripts/validate-data.js`) derives the canonical
character/phase set from `data.json` (including `chronicled` entries, not
just `banner[]` — an earlier ad-hoc check that forgot `chronicled` produced
false positives) and cross-checks it against `character-notes.json`,
`character-elements.json`, `character-aliases.json`, and `phase-notes.json`:
orphaned keys, characters missing an element (or an element with no
matching `assets/elements/*.svg`), alias strings reused across two
characters, stale `phase-notes` keys, and missing face/namecard art (which
fail *silently* in the UI — neither has an `onerror` fallback). Not wired
into CI yet, so it only catches things when someone remembers to run it.

## Data accuracy note
Moved to `data/SOURCES.md` (same file as art provenance — both are only
needed when actually adding new version/character data or art, not on
every session) — how `data.json`'s dates/rosters were verified, confidence
levels, and the 1.0 launch roster. Read it before adding a new version.

## Ideas discussed for future work (not started)
- Weapon banners aren't tracked (character banners only).
- No personal pull-tracking or stats view (longest drought, most-reran
  character, release-cadence chart) — **deliberately deprioritized**, not
  just unbuilt: plenty of other Genshin sites already do plain stats
  dashboards, and the data being there doesn't matter if the presentation
  reads as generic. Only worth revisiting with a genuinely distinctive
  presentation angle, not just "the numbers are interesting."
- The manual per-patch update process (hand-editing `data.json` +
  hand-sourcing art) is why the site fell 17 versions behind once — worth a
  scripted/automated data pipeline if picking this up as a project.
- Multi-page candidates: **Region/lore explorer** (browse by nation,
  reusing the region-background/glow visual language already built for the
  Timeline/landing pages) is the likely next page — real gap: no
  character→region mapping exists yet (`character-elements.json` is
  element, not nation; needs a new `character-regions.json` with an
  explicit `"Unaffiliated"` sentinel for characters like Skirk, not
  omission). **Character profile pages** (dedicated shareable URLs) are
  the next-cheapest candidate after that.
- "On this day" — the *concept* is now partly built as the landing trivia
  ticker's anniversary cards (see "Trivia ticker" above), not a standalone
  page. A dedicated page would need the same nearest-match handling (only
  51/365 days have an exact hit).
- Server Clocks (built) and the trivia ticker were the differentiators so
  far; Region/lore explorer is the likely next page.

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
