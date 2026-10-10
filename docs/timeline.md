# Timeline page (`timeline.html` / `src/pages/timeline/`)

Cross-cutting notes live in `AGENTS.md`. `--line` (lavender) ties into
`--four`.

## Data schemas

JSON can't hold comments; this is the semantics.

**`data/versions.json`** — one entry per patch. `title` is the official
English name. Optional `label` when the public name is not the numeric
id (6.x is Luna I–VIII). `banner[]` phases (usually 2, sometimes 3), each with `"5"`
/ `"4"` arrays of **display-name strings**. `"4": []` is unconfirmed
4-stars; `"4": "*"` is the full roster of that rarity released so far
(not a name list). Exceptional facts stay off the row. Verified `date`
(`YYYY-MM-DD`, see `data/SOURCES.md`). Optional `chronicled` /
`lightrace` objects.

**`data/characters.json`** (keyed by display name): required `element` and
`birthday` (`MM-DD`). Optional `aliases`, `rateDown` (standard-banner
rate-down, not truly limited), `preexisting` (1.0 launch roster without a
featured slot until later — panel copy: appearances are technically
reruns).

**`data/phase-overrides.json`** (keyed `"<version>-<phase#>"`):
- `{"filler": true}` — padding phase. Lifetime case: `"1.3-2"` (Keqing),
  inserted so Hu Tao's funeral-parlor banner wouldn't land near Chinese
  New Year.
- `{"date": "YYYY-MM-DD"}` — overrides `entry.date + 21×phaseIndex` where
  that formula is wrong: 1.3's 3-phase structure and 3.0–3.2's compressed
  cadence. Phase 1 never needs an override.

Keyed once per fact, not per occurrence.

**`data/majors.json`** (keyed by major version number): `region`,
`tagline`, `label` (overrides the numeral — Nod-Krai majors are "Luna"),
`bgImage`.

The patch `title` is not the Archon tagline. Timeline patch rows show it
next to the version bubble, above the date. Calendar launch-day headers
use it as the headline. Not on character panels — a person isn't a patch.

**Filenames:** `slug()` in `src/shared/dom.js` (`"Hu Tao"` → `hutao`). **Display names**
are the short form: Shogun, Ayaka/Ayato, Kokomi, Yae, Itto, Kazuha, Sara,
Heizou, Wanderer.

## Detail panel

`#detailPanel` is shared with Calendar (not `charPanel`). One header
element, two layouts: default centered column vs
`.detail-panel-header.is-character` (namecard title card: art layer +
left-weighted scrim, type overlaid). The next view has to leave it in
the right state because the header isn't torn down. `buildCharacterHeader()`
always shows a release-style hero shot — halo + bloom, not tied to
whether *this* appearance was a debut.

Appearance rows `jumpToCard()` without closing the panel. Desktop used
to nudge `.timeline-root` with `transform`; the panel is a centered
popup now. Scroll jumps use `src/shared/scroll.js` (rAF / vsync), not
native `behavior: "smooth"`.

**Shareable URLs:** `?char=` (display name or alias) and `?v=` (patch or
major). All updates are `replaceState`, so Close keeps the current
scroll (a `pushState` overlay made Close = `history.back()`, which
restored the pre-open position and undid `jumpToCard()`). Browser Back
leaves the page, not the previous character. Other params (`fakeDate`)
stay (and in-site header links copy `fakeDate` on localhost). Do not
wire this onto Calendar's panel stack.

A qualifying mobile swipe always fully closes, matching a backdrop tap —
never "pop one stack level." Calendar's in-panel Back button does that
job. `.detail-panel-mobile-bar` is `1fr auto 1fr` because the desktop
topbar (where Back lives) is hidden on mobile.

## Banner variants

Chronicled: extra card after the named phase. 4-stars are pre-split into
two `.phase-four-col` columns (a wrapped list of a dozen names didn't
read as a grid). Those columns overflow between ~480–768px — a single
column against a near-zero-width parent still sizes to min-content — so
Chronicled stacks at 768px, same as the general `<480px` rule.

Lightrace: same layout, `--lightrace` accent. Its `"4"` is `"*"` (see
schema above), so the card shows a live-derived count rather than one
icon per name.

## Region background

`#regionBg` fades the current photo out to the starfield, then fades in
whichever region matches scroll position *at that black frame*. Extra
blur while fading is a second `::after` layer (static `filter`, animated
`opacity`) — not `transition: filter`. Mid fade-in, a newly wanted
region only starts another fade-out — it never crossfades two photos
(flying the full timeline used to flash every region). Starfield/dark
fill stays on `<body>` (`AGENTS.md` gotcha #2). The photo lives in
`--region-url` so the element itself doesn't paint an unblurred copy.

## Search

Sticky pill expands via `width`, not `clip-path`. Whitespace-insensitive.
Matching lives in `src/shared/search.js` because Timeline and Calendar
each build their own name→entries index. `characters.json` `aliases` is
canonical name → aliases. Four match tiers (name starts / contains, then
alias starts / contains) so a real name always outranks an alias. The
subtitle only shows aliases that matched the query.

## Release-glow

A CSS corona (`::before` on `.avatar-wrap.is-release`), not per-blade
divs. Mask is in portrait-radius space: 95–100 anti-alias ramp, 100–140
glow fade. Pulse is `opacity` only. Bloom ring on the face stays.

Rejected: a blade per angle (hundreds of blurred, infinitely-animated
divs on an un-virtualized timeline); a single `repeating-conic-gradient`
(slower, no flicker); two orbiting dots (same cost, worse look).

## Live marker

Ripple on the most recently launched entry, only if that instant is
within 42 days — a stale dataset must not claim an old patch is live.
Same `liveBannerState()` as the header live-dot and landing spotlight.
A version can be pre-staged in `versions.json` ahead of 06:00 CST.
