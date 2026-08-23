# GI Gacha Timeline — project notes

Fan-made static site (vanilla HTML/CSS/JS, zero build step) tracking Genshin
Impact character banner history. Deployed at https://gigachatimeline.netlify.app/.
Built by the repo owner before they knew how to code — still a passion project,
not a professional codebase. Keep additions in the same zero-build, vanilla-JS
spirit unless the owner asks to modernize the stack.

`npm run dev` (via `live-server`) is now **required** for local testing, not
just a convenience — since 2026-08-21 the `data/*.json` files are loaded via
`fetch()` (see below), and `fetch()` on `file://` URLs is blocked by CORS in
every major browser. Double-clicking `index.html` will show a "Failed to load
banner data" message instead of the timeline. This has no effect on the
deployed site, which Netlify serves over `https://` where `fetch()` of a
same-origin static JSON file needs no special config (no `netlify.toml`
required — it's genuinely just another static asset, same as the images).

## Directory layout

Reorganized on 2026-08-21 from a flat root into:
- `index.html` — entry point.
- `css/` — `reset.css` (generic YUI reset) + `style.css` (everything else:
  palette, layout, components).
- `js/app.js` — all site logic: `bootstrap()` fetches five `data/*.json`
  files in parallel, then renders.
- `js/glow-config.js` — tunable knobs for the release-glow effect (see
  below); kept as a `.js` file (not JSON) since it's config-with-logic, not
  pure data — it applies its own values as CSS custom properties.
- `data/data.json` — the banner history itself (see below).
- `data/character-notes.json` / `data/phase-notes.json` — exceptional
  per-character / per-phase facts (see below).
- `data/version-notes.json` — per-major-version region + lore tagline (see
  below).
- `data/character-elements.json` — character → element (Pyro/Hydro/Anemo/
  Electro/Dendro/Geo/Cryo) lookup, used for the character panel's element
  watermark.
- `assets/faces/<name>.png` — one face icon per character (was `GIfaces/`).
- `assets/namecards/<name>.jpg` — namecard art, used as the character panel
  header background.
- `assets/elements/<element>.svg` — one watermark SVG per element, used as
  the character panel content background.
- `assets/regions/<region>.jpg` — one ambient background photo per major
  version's region, used for the crossfading region background (see below).
- `assets/fonts/zh-cn.ttf` — the `GIFont` custom font.

Everything under `data/` is plain JSON (no comments, no trailing commas, no
executable code) — it used to be `.js` files defining global `var`s so a
`<script src>` tag could load them without needing a server (`fetch()` on
`file://` is CORS-blocked, `<script>` isn't). Converted to real `.json` +
`fetch()` on 2026-08-21 once local dev had already moved to `npm run dev`,
which made that constraint moot. The semantics documented below (what
`rateDown`/`preexisting`/`filler`/`label` mean) live only in this file now,
not in code comments, since JSON can't hold comments.

## How it works

The site renders as a single continuous **vertical timeline**: one line down
the left with a big gradient "chapter" bubble per major version (1, 2, 3...)
and a smaller bubble per patch (1.0, 1.1...), each patch's phases rendered as
horizontal glassmorphic cards to the right. This replaced an earlier
two-table (5★/4★) layout on 2026-08-21 — if you see references to tables,
`sortByT`/`sortByMR`, or a `script.js` (not `js/app.js`) in git history or
old conversation context, that's the pre-redesign version. The vertical
line's color (`--line` custom property, currently a lavender `#6e5a94`) is a
deliberate style choice tying into the existing `--four` (purple, 4-star)
accent color already used everywhere else (glows, badges, gradients) — see
"Design decisions" below if changing it again.

- `data/data.json` — one entry per game version, each with a `banner` array
  of phases (2 phases per version normally, occasionally 3 — see "filler
  phases" below), each phase has `"5"` (5-star chars) and `"4"` (4-star
  chars) arrays of display-name strings. Keep entries as plain strings here;
  exceptional facts belong in `character-notes.json`, not inline (this was a
  deliberate refactor away from inline annotation objects because they made
  the file hard to scan and easy to mis-place). Each entry also has a `date`
  (real-world launch date, `"YYYY-MM-DD"`, all 52 versions verified — see
  "Data accuracy note" below) and, for the 6 versions with one, a
  `chronicled` object (see "Chronicled Wish banners" below).
- `data/character-notes.json` — lookup table consulted at render time,
  keyed by character name:
  - `{ "rateDown": true }` marks a 5-star that isn't truly exclusive/limited
    (already obtainable via the standard rate-down pool — e.g. Tighnari,
    Dehya, Mizuki, Keqing).
  - `{ "preexisting": true }` marks a character who already existed before
    their first *tracked* banner appearance, so that appearance isn't a
    real "Release" (mainly the 11 characters who were part of the 1.0
    launch roster but didn't get a featured banner slot until later — see
    the 2026-08-21 research below). The character panel shows a note for
    these — currently: *"Already in the game at launch — these appearances
    are technically reruns, not a debut."* ("technically" is deliberate —
    the owner felt "rerun" was slightly imprecise for a character that
    never had a tracked debut to rerun, but preferred keeping the familiar
    term over inventing a new one.)
- `data/phase-notes.json` — lookup table keyed as `"<version>-<phase#>"`:
  `{ "filler": true }` marks a phase as a minor/padding banner rather than
  a major content drop (currently just `"1.3-2"`, Keqing's phase — a short
  banner inserted before Hu Tao's, reportedly because Hu Tao's
  funeral-parlor theme landing near Chinese New Year was considered poor
  timing).
  - Both this and `character-notes.json` are keyed once per fact (not per
    occurrence), so `js/app.js` applies them automatically to the right
    place (e.g. a character's first chronological appearance) regardless
    of how `data.json` changes later.
- `data/version-notes.json` — keyed by major version number (`"1"`–`"7"`):
  `region` is shown as a subtitle under the big version title, `tagline`
  names the Archon + their ideal, `label` overrides the numeral itself when
  official branding diverges (used for version 6, which mihoyo calls
  "Luna" I/II/III rather than "6.0"/"6.1"/"6.2"), and `bgImage` names the
  file (without extension) in `assets/regions/` used for that version's
  ambient background. Cross-checked against Genshin Wiki / Wikipedia /
  Sportskeeda / Game8 on 2026-08-21.
- `js/app.js` — `bootstrap()` fetches all five `data/*.json` files, groups
  the banner history by major version, renders the timeline DOM, tracks
  each character's appearance count to compute Release/Rerun N badges,
  consults `character-notes.json`/`phase-notes.json` for the exceptions
  above, and adds a flickering-ray glow (randomized angle/timing per ray,
  tuned via `js/glow-config.js`) + full color to genuine releases
  (reruns/preexisting characters are desaturated/dimmed by contrast).
- `assets/faces/<name>.png` — filename convention: lowercase, spaces
  stripped (e.g. "Hu Tao" → `hutao.png`, "Yun Jin" → `yunjin.png`).
  `js/app.js` builds this path as `character.replace(/\s/g,"").toLowerCase()`.
  Keep new characters' filenames lowercase to match. Same convention for
  `assets/namecards/<name>.jpg`.
- Character display names use short/common form for multi-title characters,
  matching existing convention: "Shogun" (Raiden Shogun), "Ayaka"/"Ayato"
  (Kamisato), "Kokomi" (Sangonomiya), "Yae" (Yae Miko), "Itto" (Arataki),
  "Kazuha" (Kaedehara), "Sara" (Kujou), "Heizou" (Shikanoin), "Wanderer"
  (Scaramouche).

### Character detail panel

Clicking any character avatar (in a timeline card, or a search result — see
below) opens a side drawer on desktop / bottom sheet on mobile
(`#charPanel` + `#charPanelBackdrop`) showing that character's full
appearance history, rate-down/preexisting notes, a namecard-based header
background, and an element-watermark content background. Each appearance
row's version label (e.g. "2.6 — Phase 1") is clickable — it scrolls the
timeline to and briefly highlights that exact card via `jumpToCard()`,
*without* closing the panel. On desktop, opening the panel also nudges the
whole timeline sideways (`body.panel-open .timeline-root{transform:
translateX(300px)}`) so a jumped-to card isn't hidden behind the still-open
380px-wide drawer; mobile doesn't need this since the panel is a bottom
sheet there. The dimmed backdrop behind the panel is a real, intentional UX
element (not a bug) — see "CSS/animation gotchas" below for an incident where
it was briefly (and wrongly) suspected of being the cause of an unrelated
rendering bug.

### Chronicled Wish banners

6 major versions include a `chronicled` field in their `data.json` entry —
real historical re-releases of an older limited banner as a single combined
"Chronicled Wish" pool, rendered as an extra, distinctly-styled card
(`--chronicled` accent color) inserted after the relevant phase. Researched
and dated on 2026-08-21/22; the 5-star row for these uses plain CSS
flex-wrap (`max-width` cap + `flex-wrap: wrap`) rather than a manual
JS-computed row split — flexbox already centers each wrapped line
independently, which turned out to give the desired "3-3, break to 3-3-2 if
tight" behavior for free without needing precise row-math.

### Ambient region background

Added 2026-08-22. A fixed, full-viewport background
(`#regionBgA`/`#regionBgB`, two layers for crossfading) shows a photo of the
current major version's region, tinted dark for legibility, and crossfades
(1.6s opacity transition) as you scroll between major-version sections —
driven by the same `IntersectionObserver` (`navObserver` in `js/app.js`)
that already tracked the active section for the side nav dots. Region art
sourced from Fandom's MediaWiki API
(`api.php?action=query&titles=<Region>&prop=pageimages&piprop=original`),
which returns clean official promotional screenshots and — usefully —
bypasses the HTTP 402 block that direct page-render fetches of
`genshin-impact.fandom.com` otherwise hit. `bgImage` in `version-notes.json`
names the file per major version.

**Load-bearing detail**: the starfield-dot + dark base background that used
to live on `.timeline-root` now lives on `<body>` instead
(`css/style.css`), *not* on `.timeline-root`. This isn't a style
preference — it's required for the region background to render correctly at
all. See "CSS/animation gotchas" below.

### Character search

Added 2026-08-22. A small pill icon (pure CSS-drawn magnifying glass, no
emoji/font glyph — those didn't reliably render) sits `position: sticky;
top: 12px` right below the header, so it starts at rest just under the
header and "catches up" to pin at the screen's top-right corner once you've
scrolled far enough that the header (which is *not* sticky — see below)
scrolls out of view. Hovering or focusing it expands it (plain `width`
transition, not `clip-path` — see "CSS/animation gotchas") into a text
input that live-filters `characterIndex` (the same lookup the character
panel uses) as you type:
- Matching is **whitespace-insensitive on both sides** (query and name) —
  typing "lanyan" matches "Lan Yan" — implemented by stripping spaces
  before comparing, then mapping matched indices back onto the original
  (spaced) string for correct highlighting.
- Results are sorted "starts with query" before "contains query elsewhere",
  alphabetical within each tier.
- Every occurrence of the matched substring in each name is highlighted
  (gold, `--five`), not just the first — e.g. both "ra"s in "Kirara" light
  up for a query of "ra".
- Each result shows a small face-icon thumbnail (`.char-search-avatar`,
  reusing the same `faceImg()` helper and asset path as everywhere else —
  deliberately *not* the existing `.char-face-sm` class, since that one
  carries rarity-ring/desaturation styling tied to release/rerun semantics
  that doesn't apply to a plain search result).
- Navigable via mouse (click/hover) or keyboard (↑/↓ + Enter) — both drive
  the *same* `activeIndex` state and the *same* `.is-active` CSS class, so
  there's exactly one visual "selected" row regardless of input method
  (there used to be two independent mechanisms — CSS `:hover` plus a
  separate keyboard-driven class — which could both light up different rows
  at once; fixed by routing mouse `mouseenter`/`mouseleave` through the same
  `activeIndex`/`applyActiveClass()` functions the keyboard uses, and
  deleting the CSS `:hover` rule entirely).
- Selecting a result (click, or Enter) opens that character's panel via the
  existing `openCharPanel()` and "flushes" the search: clears the input,
  clears/hides the results list, and blurs the input so the bar collapses.
  The results dropdown's own visibility is gated on `.char-search:hover` /
  `.char-search:focus-within` (not just "are there matches") specifically
  so it can't get stranded open after the bar itself has collapsed.

## Design decisions

- **Header is not sticky.** `.site-header` is `position: relative`, not
  `position: sticky` — it scrolls away normally with the rest of the page.
  This was a deliberate reversal after the header was *made* sticky earlier
  in the project's history; the owner wanted the header to only occupy
  space near the top of the page, not take up a fixed slice of the viewport
  forever. If you see old context (or your own instincts) assuming the
  header stays pinned, that assumption is stale.
- **`--line` (vertical timeline connector) is lavender (`#6e5a94`).**
  Chosen 2026-08-22 over a muted slate-grey to tie into the existing
  `--four` purple accent, after mocking up ~5 options (bronze/gold,
  icy-blue, brighter-neutral, lavender) and letting the owner pick from
  side-by-side screenshots.

## CSS/animation gotchas (read before touching layout or transitions)

Two recurring classes of bug came up repeatedly enough this project that
they're worth calling out explicitly, since both are easy to reintroduce
without noticing until something looks visually wrong.

**1. Animate only `transform` and `opacity`.** Any other animated CSS
property (`width`, `margin`, `top`/`left`, `background-attachment: fixed`,
etc.) forces the browser through layout/paint on the main thread every
frame, instead of letting the compositor handle it — which is what causes
an animation to look "capped at 60fps" or janky on a high-refresh-rate
display even though nothing is explicitly limiting it. This bit the project
multiple times: the character-panel "nudge" (originally `margin-left`,
fixed to `transform: translateX`), the region-background reveal (an
accidentally-added `background-attachment: fixed` on `body` reintroduced
scroll jank and had to be removed), and the search bar's expand animation
(tried converting `width` to `clip-path` for exactly this reason — it *did*
measure as smoothly interpolating, but was reverted anyway per the owner's
call after running into a separate, harder-to-diagnose intermittent-snap
issue; the original `width`-based version was restored). Default to
`transform`/`opacity` for new animations from the start rather than fixing
it after the fact. Relatedly: an element that's *about to* animate but
doesn't have `will-change` set can pay a one-time "cold start" layer-
promotion cost on its first transition after being idle, which can look
like a dropped/instant frame even for an otherwise-correct `transform`/
`opacity` transition — this is a real, separate cause worth checking before
assuming the transition mechanism itself is broken.

**2. `position: fixed` background layers vs. a plain (non-positioned)
element's own background — painting order is not what you'd guess.** A
non-positioned, non-transformed element's own `background` paints *below* a
`position: fixed` sibling with `z-index: auto`, regardless of DOM order —
but the moment that same element gets an actual `transform` applied (even
conditionally, e.g. only while some class is toggled on), it gets promoted
into its own stacking context and its background can suddenly paint *above*
that fixed sibling instead, because now DOM order (not paint-tier) breaks
the tie. This caused three separate, real bugs while building the region
background feature: the background was invisible at first (a leftover
`z-index: -1` was pulling it below `<body>`'s own opaque canvas paint —
fixed by removing the `z-index`), the site footer disappeared behind it
(the footer had no `position`/`transform` of its own — fixed by giving it
`position: relative; z-index: 1`), and — the subtlest one — opening the
character panel made the entire region background flash to solid black,
because the panel-open "nudge" transform on `.timeline-root` promoted
*that* element (which at the time carried the dark starfield background)
into a stacking context that suddenly out-ranked the region background.
**Fix, and the rule going forward**: don't put a background that needs to
stay visually "under" the region-background layer on any element that might
ever receive a `transform` for unrelated reasons — put it on `<body>`
instead, whose background is always the page's root canvas paint and is
unaffected by transforms happening elsewhere in the tree.

**3. `position: sticky` is the right tool for "docks below X, then sticks to
the viewport edge once X scrolls away"** — no scroll-listener JS needed. The
search icon uses exactly this: it's a normal-flow sibling immediately after
the header with `position: sticky; top: 12px`, so its resting position is
naturally "right after the header" and it automatically locks to `top: 12px`
once scrolling would carry it above that line. The one trick needed to keep
it from also pushing page content down: the sticky wrapper itself has
`height: 0; overflow: visible`, so the actually-visible child can render at
its natural size without the (zero-height) sticky wrapper occupying real
layout space.

## Face icon / namecard / element art provenance

All face icons are sourced from enka.network's official `UI_AvatarIcon_*`
datamine assets (256×256, plain white background around the bust, uniform
across every character as of 2026-08-21). The correct `UI_AvatarIcon_*`
codename per character (which often doesn't match the display name, e.g.
Raiden Shogun → `Shougun`, Yanfei → `Feiyan`, Noelle → `Noel`) was resolved
via EnkaNetwork's public API-docs data (`store/characters.json` +
`store/loc.json` on GitHub), not guessed — each character's `SideIconName`
with `Side_` stripped gives the front-icon codename, and `NameTextMapHash`
resolved against the English loc table gives the display name to match
against.

**Namecards use a *separate* codename system from avatar icons** — e.g.
Kirara's avatar codename is `Momoka` but her namecard codename is `Kirara`;
Yae Miko's namecard codename is `Yae1`, not `Yae`. Resolved via enka's
`store/gi/namecards.json` (`UI_NameCardPic_<code>_P.jpg` entries),
cross-referenced against the roster by substring/prefix matching; one
character (Sandrone → `MarionetteNew`) needed a manual lookup via her
narrative alias appearing in the namecards.json `Icon` strings.

**Element watermark SVGs** came from Fandom's MediaWiki API
(`titles=File:Element_<Name>.svg&prop=imageinfo&iiprop=url`) rather than
enka, which only had 6 of the 7 elements as small raster PNGs (missing
Cryo) — switching to Fandom's vector SVGs for all 7 also improved quality
(crisp at any size vs. blurry 64×64 raster).

**Region backgrounds** — see "Ambient region background" above for the
Fandom `pageimages` sourcing method; same API family, different endpoint.

This is all useful precedent if new characters/regions need art sourced the
same way in the future — don't re-derive codenames by guessing, they often
don't match the display name.

## Data accuracy note

`data.json` (then `data.js`, before the JSON conversion — see above) was
caught up from version 5.3 to 7.0 on 2026-08-21 by cross-
referencing game8.co, gamewith.net, and several other outlets against each
other (a naive single-source AI fetch of game8's aggregate history page
produced garbled/mismatched version numbers — don't trust a single
AI-summarized fetch of an aggregator page for this kind of data; cross-check
at least two independent outlets per phase). One phase has moderate rather
than high confidence: **6.2 Phase 2's 4-star trio (Iansan, Chevreuse,
Gaming)** — confirmed twice via game8.co but not independently verified via a
third outlet.

**7.0 Phase 2's 4-star trio is intentionally empty** (`"4": []`) as of
2026-08-21 — the 5-star lineup (Flins/Ineffa reruns) is confirmed via
game8.co and allthings.how, but the 4-stars hadn't been officially revealed
yet at time of writing (even game8's dedicated banner page still showed
"???" placeholders). Fill this in once announced; `js/app.js` already
renders an empty `"4"` array gracefully (no divider/group shown). 7.1
(Vesna, Vodyanitsa) was deliberately *not* added — as of 2026-08-21 it's
still beta-leak territory rather than an official announcement, and neither
character has datamined icon assets on enka.network yet, so there's no way
to source icons the same verified way as the rest of this file.

Separately, on 2026-08-21 the 1.X-version 4-star roster was researched to
determine genuine debuts vs. characters already in the 1.0 launch roster
(needed for the `preexisting` flags above) — cross-checked via joytify.com,
gamerant.com, thegamer.com, and inverse.com. Confirmed 1.0 launch roster:
Barbara, Fischl, Xiangling, Noelle, Sucrose, Xingqiu, Beidou, Ningguang,
Chongyun, Razor, Bennett. Confirmed genuine within-1.X debuts: Diona (1.1),
Xinyan (1.1), Rosaria (1.4), Yanfei (1.5) — notably, Diona was *not* part of
the 1.0 launch roster despite easily being assumed to be one.

**All 52 versions (1.0–7.0) now have a verified real-world launch `date`**
(added 2026-08-21/22). Not a naive "every version is exactly 42 days"
formula — there's one genuine historical exception: **2.7 was delayed ~20
days** (originally scheduled May 10 2022, launched May 31 2022) due to the
Shanghai COVID lockdown, the first-ever schedule delay in the game's
history. **3.0, 3.1, and 3.2 each ran 35 days instead of 42** (7 days
short × 3 = 21 days) to recover that delay by the time of 3.3. Both facts
came from the owner's own memory and were verified against a full
Fandom-sourced 52-row date table, cross-checking version-to-version gaps
for anomalies — none found beyond the two above plus one unrelated 44-day
gap between 1.0 and 1.1.

## Ideas discussed for future work (not started)

- Weapon banners aren't tracked at all currently — only character banners.
- No personal pull-tracking (mark banners you actually pulled on) or stats
  view (longest drought, most-reran character, genuine-release vs.
  rate-down/filler ratio over time, release-cadence chart).
- The manual per-patch update process (hand-editing `data.json` + hand-sourcing
  each new character's face crop, namecard, and element) is *why* the site
  fell 17 versions behind once before — if picking a next project, consider
  fixing that pipeline (e.g. scripted/automated pull from a maintained data
  source) rather than relying on repeating the manual catch-up. See "Face
  icon / namecard / element art provenance" above for what a script would
  need to replicate.
- 2026-08-22 brainstorm, in response to "we have all this data, what else
  could we build with it" — restructuring into a multi-page site (this
  timeline becoming just one page/view among several) was the direction
  that resonated most, with these as candidate additional pages, roughly in
  order of "reuses existing data with least new work":
  - **Stats/analytics page** — most-reran character, longest drought
    between two specific reruns, release-cadence charts. Pure computation
    over the now-complete `data.json` + dates, no new data needed.
  - **Character profile pages** — each character gets a real, dedicated,
    shareable URL (not just a side panel), reusing the same namecard/
    element/appearance-history data the panel already has.
  - **Region/lore explorer** — browse by nation instead of by time, using
    the region art + taglines already sourced for the ambient background
    feature, cross-referenced against `character-elements.json`.
  - **"On this day" page** — "N years ago today, version X launched with
    Y" — essentially free now that every version has a verified real date.
  - Search (character name, live filter/highlight, keyboard nav) was also
    on this list as of the last update but has since been built — see
    "Character search" above.
