# Landing page (`index.html` / `js/landing.js` / `css/landing.css`)

Implementation notes for this page only — cross-cutting stuff (CSS
gotchas, design decisions, data schemas) lives in the root `CLAUDE.md`.

Built once the site had enough real pages (Timeline + Server Clocks) that a
directory made sense — see `CLAUDE.md`'s "Multi-page architecture". `index.html`
is its own lightweight page, not the Timeline; the header brand link now
points here from every page. Deliberately no `.page-nav` entry for itself.

**Spotlight card**: shows whichever phase of the latest `data.json` entry
is currently running, computed rather than hand-maintained.
- Phase length is **21 days**, cross-checked against an independent source
  giving 7.0's exact dates. `getCurrentPhaseIndex()` uses `version.date +
  21×N days`. Deliberately only needs to be correct for the *live*
  version — historical phases render as-is on the Timeline regardless, so
  irregular historical cycles (2.7's delay, 3.0–3.2's shortened cadence)
  never need retroactive handling. A future irregular version is a one-off
  fix at that time, same philosophy as the update-card estimate and the
  live-ripple heuristic below.
- Release-vs-rerun badges need a real per-character appearance count, but
  building the full `characterIndex` would mean rendering all of Timeline
  just for that (flagged as unbuilt in `CLAUDE.md`'s "Multi-page
  architecture" for this reason). `countAppearancesThrough()` scans
  `data.json` only up to the current phase for the handful of characters
  shown here instead.
- Background region comes from `version-notes.json`'s *current* version,
  not hardcoded — otherwise it goes stale the moment a new region drops.

## Spotlight carousel
Physics-driven drag/momentum, deliberately heavier than the rest of the
page (contrast the lightweight trivia ticker below). Fixed 3-slot ring
buffer (prev/center/next), not one DOM node per character — needed because
a 2-character banner shows the same character on both sides at once, which
breaks simple side-assignment logic; `resolveRotation()` only reassigns
content once a slot is fully offscreen (`dist ≥ 1.5`). Multi-step jumps
(e.g. dot-clicking 2 characters over) run as one continuous rAF sweep, not
chained CSS transitions, to avoid a dead-stop at the midpoint. `settle()`'s
curve is a true ease-in-out cubic, not ease-out-only — ease-out alone reads
as an abrupt kick at the start of a move nothing prompted. No 3D tilt
(cards only translate/fade/dim — a tilt effect was tried and dropped per
feedback).

**Label parallax**: `.spotlight-fivecard-label` moves by an extra
`CAROUSEL_LABEL_PARALLAX` (`-0.15`) fraction of the card's own
`translateX`, layered on top of it — negative makes the label lag behind,
reading as a layer farther from the viewer than the art.

**Vertical bounce**: dragging the carousel vertically triggers a
spring-back wobble across all 3 slots at once (one shared `bounceY`,
broadcast rather than per-card — `resolveRotation()` recycles which slot
is "center" mid-drag, so isolating just one card would need
identity-tracking through that). Runs on its own rAF loop, separate from
horizontal momentum, since it needs to keep animating after a horizontal
release settles. Shares spring constants with `springSettle()` below, both
derived from the 4-star toy's constants slowed by `CAROUSEL_SLOWDOWN`.

**Splash art crop**: `object-fit` always clips to its own box regardless of
an ancestor's `overflow`, so to get cover's scale *without* the crop, the
`<img>` is `position:absolute` inside a fixed-aspect-ratio wrapper sized by
height alone, bleeding past the wrapper's sides. Must be absolute, not a
flex child sized by `height:100%` — that's circular against a purely
`aspect-ratio`-derived container (the content-size pass sees the image's
raw intrinsic height before `aspect-ratio` constrains it), inflating the
wrapper. The same technique squares up to `aspect-ratio:1/1` for the
4-star mini cards below.

**4-star mini cards** use real splash art (not a face icon), fluid width
(`flex:1 1 45%` below 600px, `flex:1 1 0` above), so the mobile "2 on top,
1 on bottom" layout falls out of plain flexbox. The lone third card is
capped at `max-width:calc(50% - 6px)` + `margin:0 auto`, not stretched
full-width — stretching scaled up the square art with it, making that one
character look bigger for no reason tied to the character. Its name/tag
label is `position:absolute`, overlapping the art directly, not the
carousel label's `margin-top` trick — preexisting-roster characters (e.g.
Sucrose) have a shorter one-line label with no tag, and a fixed negative
margin sized for the two-line case over-pulled the short one, clipping
~11px off the bottom of the art (a real bug, caught on Sucrose's card).
Preexisting characters show no Release/Rerun tag at all, on both the
carousel and these cards, since their real 1.0 debut isn't tracked.

Splash art is draggable-but-decorative via `attachSpringDrag(handleEl,
targetEl, options)`, written generically for reuse elsewhere. One
continuous spring simulation drives the whole gesture (never snaps to
cursor) — dragging only moves a rubber-banded `target` that a damped
spring continuously chases, both during the drag and after release. Mouse
only (skipped on touch, since a touch drag would fight page scroll).

**Physics**: `stepSpring(e, v, dt, decay, omegaD)` is the exact closed-form
solution to a damped harmonic oscillator over any `dt`, not a discretized
approximation — this is what makes it frame-rate independent (a naive
per-frame Euler step runs faster on a higher-refresh display). `decay`/
`omegaD` come from tuned discrete `stiffness`/`damping` via
`deriveSpringConstants()` (eigenvalue analysis of the discrete recurrence;
only valid while underdamped — a critically-damped/overdamped retune needs
a different closed form). `damping` is a per-step velocity-*retention*
multiplier, not a friction coefficient — a *higher* value loosens it, easy
to get backwards. Scaling `decay`/`omegaD` by the same factor speeds up or
slows down the motion while preserving its shape (damping ratio ζ) — the
carousel's constants are the 4-star toy's own `SPRING_STIFFNESS`/
`SPRING_DAMPING`, just slowed by `CAROUSEL_SLOWDOWN`.

The carousel's own `springSettle()` (in `buildSpotlightBanner()`) is the
"letting go" moment — a drag release, or a momentum coast pulling back to
the nearest character — distinct from `settle()`'s calm ease-in-out
(auto-advance/dot-clicks, deliberately non-bouncy since the user's hand
didn't make those moves). It tracks `target`+`offset` separately rather
than springing straight at a fixed target, since a strong throw can cross
into the next character mid-bounce (`resolveRotation()` renumbering
`baseIndex`) — keeping them separate lets `target` shift with the
renumbering without a jump in `offset`'s continuity.

Two traps when reusing `attachSpringDrag()` elsewhere: (1) `targetEl` must
have **no CSS transition on `transform`** — it's driven every frame, and a
transition reads as input lag. Give any hover-zoom its own separate,
nested element instead. (2) `baseTransform` auto-detects via
`getComputedStyle` only when the spring is fully settled (guarded by
`simRAF === null`) — reading it mid-bounce would bake the in-flight offset
in as a new "base," doubling it.

## Trivia ticker
Deliberately the lightweight opposite of the carousel — plain text,
auto-advance/dots/pause-on-hover only, no drag physics. Cards mix computed
version-anniversary facts with a hand-written pool in `data/trivia.json`
(3 sampled per load), shuffled together. Swaps fade/resize via the shared
`swapWithFade()` (`js/shared.js`) — first built here, later reused by
Calendar's detail-panel stack.

- **Anniversaries are nearest-match, not exact-date**: only 51 of 365
  possible month-days actually have a version launch, so a strict "today"
  match would almost always be empty. Shows nearest past *and* nearest
  future launch anniversary, collapsing to one "on this day" card on the
  rare exact hit. States years elapsed, not just the date ("marked 4 years
  since...") — the raw date alone makes the reader do the math. A version
  that launched earlier in the *current* calendar year is excluded from
  the day-count search entirely (unless it's an exact "launched today"
  hit), since otherwise it could win "nearest past" and get worded as
  "marked 0 years since," which is nonsense before its first anniversary.
- **Past/future cards append which characters debuted that version** (both
  rarities, 5-stars leading the list; `preexisting` characters excluded)
  via `getDebuts()`/`countAppearancesThrough()`, only when the list is
  non-empty — some versions (e.g. 3.8) are pure reruns and get no clause.
  Chronicled banners are never scanned (can't contain a real debut by
  definition).
- **The progress bar's own CSS animation *is* the auto-advance timer** —
  `animationend` triggers `goTo()`, rather than tracking elapsed time by
  hand in JS. Simpler and less bug-prone than a hand-rolled timer, worth
  remembering before reaching for manual timer math anywhere already
  backed by a pausable CSS animation.
- Pausing is one `setPaused(bool)` toggling `animation-play-state`, driven
  by real hover on hover-capable devices, or on touch (no real hover to
  leave) by whether the last click anywhere on the page landed inside
  `.landing-trivia`.
- Skips auto-advance (dots still work) under `prefers-reduced-motion`, and
  doesn't build the progress bar at all in that case.

## Sidebar layout (desktop)
Single-column below 900px. At ≥900px, `.landing-columns` becomes a flex
row: the carousel (`flex:1`) left, a 320px sidebar (trivia + link cards)
right.

Link cards get their own hover language (gold border/glow, a permanently
visible gold chevron rather than hover-only, since hover doesn't exist on
mobile) since they're the only actually-clickable cards on the page.

Three link cards (Timeline/Calendar/Server Clocks) means the 2-column grid
at 600–899px would orphan the 3rd card alone in a row — capped to
`max-width:calc(50% - 7px)` + centered, same fix as the 4-star lone-card
case. That fix only applies at that width range: at ≥900px the sidebar
forces a single column and needs its own reset
(`.landing-sidebar .landing-link-card:nth-child(3)`), or the 3rd card
stays capped there too (a real bug, caught when Server Clocks rendered
narrower than its siblings in that slot).
