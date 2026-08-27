# Asset sourcing

Where every `assets/*` file comes from, and the gotchas hit finding each
one. Split out of `CLAUDE.md` so a session only needs to load this when
actually sourcing new art — not on every single session.

**Quick reference** (details/gotchas for each below):
| Asset | Source | Endpoint / file pattern |
|---|---|---|
| `assets/faces/*.png` | enka.network | `UI_AvatarIcon_*`, codenames via `store/characters.json` |
| `assets/namecards/*.jpg` | enka.network | `UI_NameCardPic_<code>_P.jpg` via `store/gi/namecards.json` — **separate codename system from faces** |
| `assets/elements/*.svg` | Fandom MediaWiki API | `File:Element_<Name>.svg` |
| `assets/regions/*.jpg` | Fandom MediaWiki API | `pageimages` on the region's wiki page |
| `assets/backgrounds/server-clocks.webp` | Fandom (direct file) | one-off, not a per-character pattern |
| `assets/splash/*.webp` | Fandom MediaWiki API | `File:<Name>_Wish.png` — **not** `Card.png`/`Game.png`/`Full Wish.png`, see below |

Face icons: enka.network `UI_AvatarIcon_*` datamine assets, codenames
resolved via enka's public `store/characters.json`/`store/loc.json` (often
don't match display names — e.g. Raiden Shogun → `Shougun`, Yanfei →
`Feiyan`). Namecards use a **separate** codename system (Kirara's avatar
codename is `Momoka`, namecard codename is `Kirara`) via
`store/gi/namecards.json`. Element watermarks: Fandom's MediaWiki API (enka
was missing Cryo). Region backgrounds: same Fandom API family
(`pageimages`), bypasses the HTTP 402 block on direct fandom.com page
fetches.

**Landing page splash art** (`assets/splash/<name>.webp`): also Fandom, but
a *different* file per character than any of the above — `File:<Name>_Wish.png`
(not `Character <Name> Full Wish.png` — similar name, different asset, see
below). This is the actual in-game wish-reveal art (dynamic pose,
transparent alpha background — confirmed via `ffprobe` showing `yuva420p`)
and, unlike everything else tried, is **genuinely pixel-uniform**: every
character checked so far (5-stars and 4-stars alike — spot-checked
Sucrose/Alyosha/Lynette in addition to the earlier batch) is exactly
2048x1024, since it's HoYoverse's own fixed-size UI template rather than
independently-composed promotional art. `object-fit: contain` is still
used rather than `cover` — a uniform canvas doesn't guarantee a uniform
*pose* within it, so contain remains the safe choice — but with the box
ratio matching the source exactly there's effectively no letterboxing in
practice.

Confirmed query for checking a character's splash art before downloading
it (returns dimensions without fetching the full image):
```
https://genshin-impact.fandom.com/api.php?action=query&titles=File:<Name>_Wish.png&prop=imageinfo&iiprop=url%7Csize&format=json
```

Took four tries to land on, kept here so they aren't re-attempted:
`File:<Name> Card.png` bakes the gacha-pull card frame and "GENSHIN IMPACT"
logo into the image itself (not croppable away with CSS); `File:Character
<Name> Game.png` is a plain standing in-game render on a flat backdrop, not
real splash art; `File:Character <Name> Full Wish.png` *is* real splash art
(same dynamic-pose style as the one that stuck) but not uniformly sized
across characters (checked: ~1.3:1, not pixel-identical) — easy to confuse
with `<Name>_Wish.png` since both are "Wish"-named and visually similar,
but only the latter is on the fixed template. Honey Hunter World
(`honeyhunterworld.com`) hosts a fourth style — a tight cropped close-up
used for the actual in-game pull reveal animation — but blocks
hotlinking/scraping (403), so it was never a usable source regardless of
how it looked.

Don't re-derive codenames by guessing for future characters/regions — they
often don't match the display name.
