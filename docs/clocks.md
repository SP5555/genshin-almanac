# Server Clocks page (`clocks.html` / `js/clocks.js` / `css/clocks.css`)

Implementation notes for this page only — cross-cutting stuff (CSS
gotchas, design decisions, data schemas) lives in the root `CLAUDE.md`.

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
  deliberately rejected, since it would recreate the manual-upkeep burden
  that made the site fall 17 versions behind once (see `CLAUDE.md`'s
  "Ideas discussed for future work"). Badge reads "Estimated" → "Overdue"
  (counts up instead of freezing at zero) once the 42-day window passes
  with no new version.
- Weekday strip (7 letters, Mon-first) marks the current in-game day, which
  flips at the 4am reset, not midnight. Colors avoid `--four`/`--five` (the
  site's star-rarity colors) since no weekday actually outranks another —
  only Sunday (every domain open) gets its own accent (`--five`).
- Detected viewer timezone shown near the top (`Intl.DateTimeFormat` with
  `timeZoneName`), since every clock says "your time."
- Ring/bar fill-in animates only once each card's entrance animation
  finishes (`animationend`) — setting the real value synchronously never
  triggers a transition, since there's no intervening paint of the empty
  state. `prefers-reduced-motion` skips the wait.
- Cross-document View Transitions (`@view-transition{navigation:auto}` in
  `style.css`) animate page navigations with zero JS/router — why the site
  didn't need to merge into an SPA for smooth page transitions.
- Same stacking-context bug as `CLAUDE.md` CSS gotcha #2 bit
  `.clocks-intro`/section headings here too (fixed the same way) — can hit
  any plain text on a page with a fixed full-viewport background.

Not yet built: weekly reset (Monday 4am, per-server like daily reset) and
Spiral Abyss reset (16th of each month, 4am server time).
