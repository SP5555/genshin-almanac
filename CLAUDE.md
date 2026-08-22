# GI Gacha Timeline — project notes

Fan-made static site (vanilla HTML/CSS/JS, zero build step) tracking Genshin
Impact character banner history. Deployed at https://gigachatimeline.netlify.app/.
Built by the repo owner before they knew how to code — still a passion project,
not a professional codebase. Keep additions in the same zero-build, vanilla-JS
spirit unless the owner asks to modernize the stack. `npm run dev` (via
`live-server`) is available for local live-reload only — it does not affect
the deployed site, which is still just static files served as-is.

## Directory layout

Reorganized on 2026-08-21 from a flat root into:
- `index.html` — entry point.
- `css/` — `reset.css` (generic YUI reset) + `style.css` (everything else:
  palette, layout, components).
- `js/app.js` — all site logic (data loading, rendering, interactions).
- `data/data.js` — the banner history itself (see below).
- `data/character-notes.js` — exceptional per-character/per-phase facts (see
  below). Loaded after `data.js`, before `app.js`.
- `assets/faces/<name>.png` — one face icon per character (was `GIfaces/`).
- `assets/fonts/zh-cn.ttf` — the `GIFont` custom font.

## How it works

The site renders as a single continuous **vertical timeline**: one line down
the left with a big gradient "chapter" bubble per major version (1, 2, 3...)
and a smaller bubble per patch (1.0, 1.1...), each patch's phases rendered as
horizontal glassmorphic cards to the right. This replaced an earlier
two-table (5★/4★) layout on 2026-08-21 — if you see references to tables,
`sortByT`/`sortByMR`, or a `script.js` (not `js/app.js`) in git history or
old conversation context, that's the pre-redesign version.

- `data/data.js` — one entry per game version, each with a `banner` array of
  phases (2 phases per version normally, occasionally 3 — see "filler phases"
  below), each phase has `"5"` (5-star chars) and `"4"` (4-star chars) arrays
  of display-name strings. Keep entries as plain strings here; exceptional
  facts belong in `character-notes.js`, not inline (see below — this was a
  deliberate refactor away from inline annotation objects because they made
  the file hard to scan and easy to mis-place).
- `data/character-notes.js` — two lookup tables consulted at render time:
  - `characterNotes[name]` — `{ rateDown: true }` marks a 5-star that isn't
    truly exclusive/limited (already obtainable via the standard rate-down
    pool — e.g. Tighnari, Dehya, Mizuki, Keqing). `{ preexisting: true }`
    marks a character who already existed before their first *tracked*
    banner appearance, so that appearance isn't a real "Release" (mainly the
    11 characters who were part of the 1.0 launch roster but didn't get a
    featured banner slot until later — see the 2026-08-21 research below).
  - `phaseNotes["<version>-<phase#>"]` — `{ filler: true }` marks a phase as
    a minor/padding banner rather than a major content drop (currently just
    `"1.3-2"`, Keqing's phase — a short banner inserted before Hu Tao's,
    reportedly because Hu Tao's funeral-parlor theme landing near Chinese New
    Year was considered poor timing).
  - Both tables are keyed once per fact (not per occurrence), so `js/app.js`
    applies them automatically to the right place (e.g. a character's first
    chronological appearance) regardless of how `data.js` changes later.
- `js/app.js` — groups `data.js` by major version, renders the timeline DOM,
  tracks each character's appearance count to compute Release/Rerun N
  badges, consults `character-notes.js` for the exceptions above, and adds
  a rotating-ray glow + full color to genuine releases (reruns/preexisting
  characters are desaturated/dimmed by contrast).
- `assets/faces/<name>.png` — filename convention: lowercase, spaces
  stripped (e.g. "Hu Tao" → `hutao.png`, "Yun Jin" → `yunjin.png`).
  `js/app.js` builds this path as `character.replace(/\s/g,"").toLowerCase()`.
  Keep new characters' filenames lowercase to match.
- Character display names use short/common form for multi-title characters,
  matching existing convention: "Shogun" (Raiden Shogun), "Ayaka"/"Ayato"
  (Kamisato), "Kokomi" (Sangonomiya), "Yae" (Yae Miko), "Itto" (Arataki),
  "Kazuha" (Kaedehara), "Sara" (Kujou), "Heizou" (Shikanoin), "Wanderer"
  (Scaramouche).

## Face icon provenance

All icons are sourced from enka.network's official `UI_AvatarIcon_*` datamine
assets (256×256, plain white background around the bust, uniform across every
character as of 2026-08-21). The correct `UI_AvatarIcon_*` codename per
character (which often doesn't match the display name, e.g. Raiden Shogun →
`Shougun`, Yanfei → `Feiyan`, Noelle → `Noel`) was resolved via EnkaNetwork's
public API-docs data (`store/characters.json` + `store/loc.json` on GitHub),
not guessed — each character's `SideIconName` with `Side_` stripped gives the
front-icon codename, and `NameTextMapHash` resolved against the English loc
table gives the display name to match against. Useful if new characters need
icons sourced the same way in the future.

## Data accuracy note

`data.js` was caught up from version 5.3 to 7.0 on 2026-08-21 by cross-
referencing game8.co, gamewith.net, and several other outlets against each
other (a naive single-source AI fetch of game8's aggregate history page
produced garbled/mismatched version numbers — don't trust a single
AI-summarized fetch of an aggregator page for this kind of data; cross-check
at least two independent outlets per phase). One phase has moderate rather
than high confidence: **6.2 Phase 2's 4-star trio (Iansan, Chevreuse,
Gaming)** — confirmed twice via game8.co but not independently verified via a
third outlet.

Separately, on 2026-08-21 the 1.X-version 4-star roster was researched to
determine genuine debuts vs. characters already in the 1.0 launch roster
(needed for the `preexisting` flags above) — cross-checked via joytify.com,
gamerant.com, thegamer.com, and inverse.com. Confirmed 1.0 launch roster:
Barbara, Fischl, Xiangling, Noelle, Sucrose, Xingqiu, Beidou, Ningguang,
Chongyun, Razor, Bennett. Confirmed genuine within-1.X debuts: Diona (1.1),
Xinyan (1.1), Rosaria (1.4), Yanfei (1.5) — notably, Diona was *not* part of
the 1.0 launch roster despite easily being assumed to be one.

## Ideas discussed for future work (not started)

- Weapon banners aren't tracked at all currently — only character banners.
- No search/filter for jumping to a specific character.
- No personal pull-tracking (mark banners you actually pulled on) or stats
  view (longest drought, most-reran character, etc.).
- The manual per-patch update process (hand-editing `data.js` + hand-sourcing
  each new character's face crop) is *why* the site fell 17 versions behind
  once before — if picking a next project, consider fixing that pipeline
  (e.g. scripted/automated pull from a maintained data source) rather than
  relying on repeating the manual catch-up.
