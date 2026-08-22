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
- `js/app.js` — all site logic: `bootstrap()` fetches the four `data/*.json`
  files in parallel, then renders.
- `js/glow-config.js` — tunable knobs for the release-glow effect (see
  below); kept as a `.js` file (not JSON) since it's config-with-logic, not
  pure data — it applies its own values as CSS custom properties.
- `data/data.json` — the banner history itself (see below).
- `data/character-notes.json` / `data/phase-notes.json` — exceptional
  per-character / per-phase facts (see below).
- `data/version-notes.json` — per-major-version region + lore tagline (see
  below).
- `assets/faces/<name>.png` — one face icon per character (was `GIfaces/`).
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
old conversation context, that's the pre-redesign version.

- `data/data.json` — one entry per game version, each with a `banner` array
  of phases (2 phases per version normally, occasionally 3 — see "filler
  phases" below), each phase has `"5"` (5-star chars) and `"4"` (4-star
  chars) arrays of display-name strings. Keep entries as plain strings here;
  exceptional facts belong in `character-notes.json`, not inline (this was a
  deliberate refactor away from inline annotation objects because they made
  the file hard to scan and easy to mis-place).
- `data/character-notes.json` — lookup table consulted at render time,
  keyed by character name:
  - `{ "rateDown": true }` marks a 5-star that isn't truly exclusive/limited
    (already obtainable via the standard rate-down pool — e.g. Tighnari,
    Dehya, Mizuki, Keqing).
  - `{ "preexisting": true }` marks a character who already existed before
    their first *tracked* banner appearance, so that appearance isn't a
    real "Release" (mainly the 11 characters who were part of the 1.0
    launch roster but didn't get a featured banner slot until later — see
    the 2026-08-21 research below).
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
  "Luna" I/II/III rather than "6.0"/"6.1"/"6.2"). Cross-checked against
  Genshin Wiki / Wikipedia / Sportskeeda / Game8 on 2026-08-21.
- `js/app.js` — `bootstrap()` fetches all four `data/*.json` files, groups
  the banner history by major version, renders the timeline DOM, tracks
  each character's appearance count to compute Release/Rerun N badges,
  consults `character-notes.json`/`phase-notes.json` for the exceptions
  above, and adds a flickering-ray glow (randomized angle/timing per ray,
  tuned via `js/glow-config.js`) + full color to genuine releases
  (reruns/preexisting characters are desaturated/dimmed by contrast).
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

## Ideas discussed for future work (not started)

- Weapon banners aren't tracked at all currently — only character banners.
- No search/filter for jumping to a specific character.
- No personal pull-tracking (mark banners you actually pulled on) or stats
  view (longest drought, most-reran character, etc.).
- The manual per-patch update process (hand-editing `data.json` + hand-sourcing
  each new character's face crop) is *why* the site fell 17 versions behind
  once before — if picking a next project, consider fixing that pipeline
  (e.g. scripted/automated pull from a maintained data source) rather than
  relying on repeating the manual catch-up.
