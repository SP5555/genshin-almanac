---
name: add-version
description: Adds a Genshin Almanac version or character art using the documented sources and fetch-art script. Use when adding a new patch/version to data.json, sourcing faces/namecards/splash, or when the user mentions fetch-art, Wish.png, enka, or a new banner roster.
---

# Add a version / character art

Zero-build site. Do not invent asset codenames. Do not substitute rejected splash sources.

## Art

The agent runs `fetch-art`, not the user.

```bash
npm run fetch-art -- "Display Name" [Name...]
```

`--force` overwrites; `--dry-run` prints without writing. Faces/namecards come from enka; splash from Fandom `File:<Name>_Wish.png`. Missing splash is a warning (landing already shows a note) — wait, don't use Card.png / Game.png / Full Wish.png / yatta palettes.

Read `data/SOURCES.md` before touching any other CDN. Limits that are easy to re-hit:

- Face lookup prefers `characters.json`/`loc.json` `SideIconName`. Those can lag `namecards.json`; then the script uses a published namecard Icon stem only if `UI_AvatarIcon_<code>.png` is actually on enka. It still will not invent a stem.
- Kirara is the reminder the two codename systems differ (`Momoka` face / `Kirara` namecard). A namecard-stem fallback that 404s on the face URL is a hard fail, not a guess.
- Loc names can be family-given or given-family; matching is any token, plus aliases. Do not assume last-word-only.
- Empty `"4": []` is valid. Splash missing is valid. Face/namecard missing is not — `validate` catches those because the UI has no `onerror` fallback.

## Data (human)

`scripts/fetch-art.js` does not edit JSON. After art:

1. `data/data.json` — version `date` (YYYY-MM-DD, two independent sources), `banner` phases with `"5"`/`"4"` (empty `"4": []` is valid).
2. Sidecars the script lists: `character-elements.json`, `character-birthdays.json`, aliases only when they have one.
3. `npm run validate`
4. Smoke with `?fakeDate=` around 06:00 CST of the version date on landing, timeline, and clocks. `npm run when -- <that instant>` prints the same math. Launch math is `versionLaunchInstant()`, not local midnight.

## URLs

Timeline share links: `timeline.html?char=<Name>`, `timeline.html?v=<version>`.
Always `replaceState` (never `pushState`) so Close does not restore
scroll. Calendar `?date=` (`YYYY` / `YYYY-MM` / `YYYY-MM-DD`) and its
panel stack are separate. `?fakeDate=` is copied onto in-site links on
localhost.
