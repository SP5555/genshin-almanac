# Server Clocks page (`clocks.html` / `src/pages/clocks/`)

Cross-cutting notes live in `AGENTS.md`. Independent of the other pages'
JS. One static background, same blur/tint as region art, no crossfade.

**Server facts** (game8 / Sportskeeda, cross-checked): four distinct
servers — America (UTC−5), Europe (UTC+1), Asia (UTC+8), TW/HK/MO
(UTC+8, same offset as Asia, different server). Daily reset: 04:00 each
server's own time, independently. Version maintenance: **one shared
instant** for all servers, 06:00 China Standard Time — one clock, not
four.

Reset/maintenance math is fixed-offset (`nextServerReset()`,
`cstDateToUtcInstant()`), not `Intl` time zones — no IANA zone stays at a
fixed offset (DST), unlike these synthetic server offsets. Landing,
Timeline, and the header live-dot use the same 06:00 CST launch instant
so they don't disagree with this page about whether a version is live.

Next-update: if the newest `data.json` row has not launched yet, the
badge is "Confirmed" and the target is that row's 06:00 CST instant.
Otherwise last launch + 42 days ("Estimated"), then "Overdue" (counts
up). There is no separate confirmed-date field — pre-staging the next
version in `data.json` is the confirmation. Anchored to 06:00 CST, not
midnight UTC (that drifted the day-count by up to 8 hours).

Weekday strip is Monday-first and flips at the 4am reset, not midnight.
Colors avoid `--four` / `--five` except Sunday (every domain open), which
gets `--five`. Viewer timezone is shown near the top because every clock
says "your time."

Ring fill waits for the card's entrance `animationend` — setting the
value synchronously never transitions (no paint of the empty state).

The same stacking-context trap as `AGENTS.md` gotcha #2 hit
`.clocks-intro` / headings here too (plain text over a fixed full-
viewport background).
