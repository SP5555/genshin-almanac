# Genshin Almanac

**Everything dated, everything tracked — because nobody else kept score.**

A fan-made, zero-build companion site for Genshin Impact. The complete
character banner history from version 1.0 to today, live daily reset
clocks for all four servers, and a countdown to whatever's coming next —
the stuff that's usually scattered across a dozen wiki pages and three
different countdown sites, put in one place instead.

🔗 **[Live site](https://genshin-almanac.netlify.app)**

## What's here

- **Timeline** — every character banner ever run, all the way from 1.0,
  one continuous scroll. Real verified launch dates, genuine releases vs.
  reruns, rate-down exceptions, Chronicled Wish re-releases, the filler
  phase nobody remembers — tracked properly instead of hand-waved.
- **Server Clocks** — live daily reset countdowns for America, Europe,
  Asia, and TW/HK/MO, converted to your own time zone, plus an estimate
  for when the next version drops and a live countdown ring for each.
- Character search, full per-character appearance history, and a handful
  of small details most trackers don't bother tracking at all.

## Running it locally

```bash
npm install
npm run dev
```

`live-server` serves the site at `http://localhost:8200`. Data loads via
`fetch()`, so double-clicking `index.html` won't work — browsers block
`fetch()` on `file://` URLs. The deployed site doesn't have this problem
since it's served over `https://`.

---

*Genshin Impact content and materials are trademarks and copyrights of
HoYoverse. This is an unofficial fan project, not affiliated with or
endorsed by HoYoverse.*
