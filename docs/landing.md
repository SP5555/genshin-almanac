# Landing page (`index.html` / `src/pages/landing/`)

Cross-cutting notes live in `AGENTS.md`. No `.page-nav` entry for this
page — the brand link already goes here.

**Spotlight** is whichever phase of the latest `data.json` entry is
running, not a hand-maintained card. Phase length is **21 days** from
`versionLaunchInstant()`. Only the *live* version has to be correct;
historical irregular cycles stay on the Timeline as written. A future
irregular live version is a one-off then, same as the 42-day estimate.

Release/rerun badges use `countAppearancesThrough()` (scan up to this
phase) rather than Timeline's full index. Region background comes from
`version-notes.json` for the current major, not a hardcoded image.
Preexisting 1.0-roster characters get no Release/Rerun tag — their real
debut isn't a tracked banner.

## Spotlight carousel

Physics-driven; heavier than the trivia ticker on purpose. Fixed 3-slot
ring (prev/center/next), not one node per character — a 2-character
banner shows the same person on both sides at once, which breaks
side-assignment. `resolveRotation()` only reassigns content once a slot
is fully offscreen (`dist ≥ 1.5`). Multi-step jumps are one rAF sweep, not
chained CSS transitions (those dead-stop at the midpoint). `settle()` is
ease-in-out cubic; ease-out alone reads as an unprompted kick. No 3D
tilt — tried, dropped.

**Label parallax:** extra `CAROUSEL_LABEL_PARALLAX` (`-0.15`) on
`.spotlight-fivecard-label` so the name lags the art.

**Vertical bounce:** one shared `bounceY` across all three slots (not
per-card — `resolveRotation()` recycles which slot is center). Own rAF,
separate from horizontal momentum. Same spring constants as
`springSettle()`, slowed by `CAROUSEL_SLOWDOWN`.

**Splash crop:** `object-fit` always clips to its own box. Cover-without-
crop is an absolutely-positioned `<img>` inside a height-sized
`aspect-ratio` wrapper, bleeding past the sides. A flex child at
`height: 100%` is circular against a purely `aspect-ratio` container and
inflates it. 4-star cards use the same trick at `1/1`. Missing Wish art
keeps the empty slot with a short note (`aria-labelledby` the name) —
don't swap in the face icon.

**4-star cards:** fluid width (`flex: 1 1 45%` below 600px, `flex: 1 1 0`
above) so "2 on top, 1 on bottom" is plain flexbox. The lone third card
is `max-width: calc(50% - 6px)` + centered — stretching it made that one
character look bigger. Label is `position: absolute` on the art, not the
carousel's `margin-top` trick: preexisting characters have a one-line
label, and a two-line-sized negative margin clips the art.

**`attachSpringDrag`:** one continuous damped spring, never snaps to the
cursor. Mouse only (touch would fight page scroll). Reuse traps: (1)
`targetEl` must have **no CSS transition on `transform`** — give
hover-zoom its own nested element; (2) only read `baseTransform` while
`simRAF === null`, or the in-flight offset doubles.

**Physics:** `stepSpring` is the closed-form damped oscillator over any
`dt` (frame-rate independent). `damping` is velocity-*retention* — higher
loosens it. `deriveSpringConstants()` is only valid while underdamped.
`springSettle()` tracks `target` and `offset` separately because a throw
can cross a character while bouncing (`resolveRotation()` renumbers
`baseIndex`).

## Trivia ticker

Plain text, no drag. Mix of computed launch-anniversaries and 3 samples
from `data/trivia.json`. Fade/resize via `swapWithFade()`.

Anniversaries are **nearest-match, not exact-date** — most calendar days
have no launch. Nearest past *and* nearest future, collapsing to one card
on an exact hit. Word as years elapsed, not the raw date. A launch
earlier in the *current* calendar year is excluded from "nearest past"
(unless it's today), or it would read "0 years since." Debut lists skip
`preexisting` characters and never scan Chronicled banners. Pure-rerun
versions just omit the clause.

The progress bar's CSS `animationend` *is* the auto-advance timer. Pause
is `animation-play-state` via one `setPaused(bool)`. Skip auto-advance
(and the bar) under `prefers-reduced-motion`.

## Sidebar

Single column below 900px; at ≥900px carousel `flex: 1` + 320px sidebar.
Link cards use a permanently-visible gold chevron (no hover on mobile).
Three cards at 600–899px would orphan the third — same `max-width:
calc(50% - 7px)` + center as the 4-star lone card, **reset in the
sidebar at ≥900px** or the third card stays capped there too.
