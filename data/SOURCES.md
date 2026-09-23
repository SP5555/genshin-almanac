# Asset sourcing & data accuracy

Where every `assets/*` file comes from (and the gotchas hit finding each
one), plus how `data/data.json`'s facts were verified. Split out of
`AGENTS.md` so a session only needs to load this when actually sourcing
new art or adding new version/character data — not on every single
session.

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
`Feiyan`; sometimes they do match, which is not a reason to start
guessing). Namecards use a **separate** codename system (Kirara's avatar
codename is `Momoka`, namecard codename is `Kirara`) via
`store/gi/namecards.json`. Project Amber/yatta serves paletted interlaced
256px copies under the same `UI_AvatarIcon_*` names; they don't match
enka's RGBA files, so they aren't a substitute when enka 404s. Element
watermarks: Fandom's MediaWiki API (enka was missing Cryo). Region
backgrounds: same Fandom API family (`pageimages`), bypasses the HTTP 402
block on direct fandom.com page fetches.

**Landing page splash art** (`assets/splash/<name>.webp`): also Fandom, but
a *different* file per character than any of the above — `File:<Name>_Wish.png`
(not `Character <Name> Full Wish.png` — similar name, different asset, see
below). This is the actual in-game wish-reveal art (dynamic pose,
transparent alpha background — confirmed via `ffprobe` showing `yuva420p`)
and, unlike the rejected files below, is **pixel-uniform**: every
character is exactly 2048×1024, HoYoverse's own fixed-size UI template
rather than independently-composed promo art. `object-fit: contain` is
still used rather than `cover` — a uniform canvas doesn't guarantee a
uniform *pose* within it.

Confirmed query for checking a character's splash art before downloading
it (returns dimensions without fetching the full image):
```
https://genshin-impact.fandom.com/api.php?action=query&titles=File:<Name>_Wish.png&prop=imageinfo&iiprop=url%7Csize&format=json
```

Rejected (don't re-attempt):
`File:<Name> Card.png` bakes the gacha-pull card frame and "GENSHIN IMPACT"
logo into the image itself (not croppable away with CSS); `File:Character
<Name> Game.png` is a plain standing in-game render on a flat backdrop, not
real splash art; `File:Character <Name> Full Wish.png` *is* real splash art
(same dynamic-pose style as the one that stuck) but not uniformly sized
across characters (checked: ~1.3:1, not pixel-identical) — easy to confuse
with `<Name>_Wish.png` since both are "Wish"-named and visually similar,
but only the latter is on the fixed template. `File:<Name> Portrait.png`
(~1000×1200 character-menu bust) and `File:<Name> Profile.png` (~2154×1320)
are the same class of miss: real art, wrong template. Honey Hunter World
(`honeyhunterworld.com`) hosts another style — a tight cropped close-up
used for the actual in-game pull reveal animation — but blocks
hotlinking/scraping (403), so it was never a usable source regardless of
how it looked. Wish.png can also lag faces/namecards (Fandom uploads it
later than enka hosts `UI_AvatarIcon_*`); landing shows a short note in
the art slot when it's missing, so wait rather than substituting any of
the above.

Don't re-derive codenames by guessing for future characters/regions — they
often don't match the display name. `npm run fetch-art -- <Name>` is the
repeatable path (enka faces/namecards, Fandom Wish.png). Face lookup prefers
`characters.json`/`loc.json` `SideIconName`. Those two files can lag
`namecards.json` (new characters often land on the CDN and in the namecard
store first); then the script uses a published namecard Icon stem only if
`UI_AvatarIcon_<code>.png` is actually on enka (so Kirara's namecard
`Kirara` still cannot be mistaken for face `Momoka`). It still refuses to
invent a stem that isn't in an enka store.

## Data accuracy

Roster/date facts are verified by cross-referencing at least two
independent sources (game8.co, gamewith.net, etc.). A single
AI-summarized fetch of an aggregator page has produced garbled version
numbers — don't trust that alone. 4-star trios are sometimes only
two-source confirmed; that's an acceptable bar. Unrevealed phases stay out
of `data.json` until a first-party notice or equivalent exists — don't
pre-stage a phase whose 5-stars the sources still disagree on.

A phase's `"4"` array can legitimately be `[]` rather than filled — a
version's Special Program sometimes confirms 5-stars before 4-stars.
Leave it as an explicit empty array, not an omitted key: only
`timeline.js` guards a missing `"4"`, `landing.js`/`calendar.js`/the
`src/shared/` modules all assume every phase has one and will throw
otherwise (e.g. `calendar.js`'s bootstrap indexing, the landing spotlight
card). `npm run validate`
already surfaces missing face/namecard art on its own once a new
character's canonical name exists, so there's no separate note needed
here for "art not sourced yet" — don't source it until enka.network/Fandom
actually have consistent, correctly-sized assets up; pulling an
inconsistent early asset is worse than waiting.

1.0 launch roster (confirmed): Barbara, Fischl, Xiangling, Noelle, Sucrose,
Xingqiu, Beidou, Ningguang, Chongyun, Razor, Bennett. Genuine within-1.X
debuts: Diona (1.1, despite being easy to assume launch roster), Xinyan
(1.1), Rosaria (1.4), Yanfei (1.5).

Every version in `data.json` has a verified real launch `date` — not a
naive "every 42 days" formula. Two real exceptions: **2.7 delayed ~20
days** (Shanghai COVID lockdown, May 10→31 2022), **3.0–3.2 each ran 35
days** (7 short × 3) to recover that delay by 3.3.
