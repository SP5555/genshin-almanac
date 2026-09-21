# Asset sourcing & data accuracy

Where every `assets/*` file comes from (and the gotchas hit finding each
one), plus how `data/data.json`'s facts were verified. Split out of
`CLAUDE.md` so a session only needs to load this when actually sourcing
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

## Data accuracy

Verified 5.3–7.0 by cross-referencing game8.co/gamewith.net/etc. against
each other (a single AI-summarized fetch of an aggregator page produced
garbled version numbers — don't trust that alone). One moderate-confidence
item: 6.2 Phase 2's 4-star trio (Iansan, Chevreuse, Gaming), confirmed
twice via game8.co but not a third source. 7.0 Phase 2's 4-star trio
(Aino, Iansan, Lan Yan) was added once officially revealed — splash art
sourced ahead of the phase's actual Sep 2, 2026 start (21 days after the
Aug 12 launch, per `PHASE_LENGTH_DAYS`) so the landing page has real art
instead of the face-icon fallback the moment `getCurrentPhaseIndex()`
flips over, with no other code change needed. **7.1 Phase 1 added**
(Vesna/Vodyanitsa 5★, Chongyun/Diona/Faruzan 4★, Sep 23 2026) once the
livestream + pre-load datamine made it official — 4-star trio is the same
moderate-confidence bar as 6.2's (confirmed via two independent game8.co
pages, not a third source, but matches the requester's own firsthand
pre-load knowledge). Phase 2 deliberately *not* added — sources
disagree on its exact 5-stars (Skirk/Escoffier per most, but one otherwise-
reliable source names Linnea/Zibai reruns instead) and multiple outlets
explicitly flag no first-party HoYoverse notice exists for it yet as of
this write-up (Sep 21 2026, 2 days pre-launch) — add once it's actually
confirmed, same as every other still-unrevealed phase.

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

All 52 versions have a verified real launch `date` — not a naive "every 42
days" formula. Two real exceptions: **2.7 delayed ~20 days** (Shanghai
COVID lockdown, May 10→31 2022), **3.0–3.2 each ran 35 days** (7 short × 3)
to recover that delay by 3.3.
