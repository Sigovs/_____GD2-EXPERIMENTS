# index5 — the concept gate

System resolved from `/Users/alex/Desktop/WORK/GD2/design_dna` — a symlink to the
canonical Mac copy at `ca4b864`. `TASTE.md`, `.claude/rules/design-dna.md`
(`DNA1`–`DNA89`) and the vault all read from there.

---

## Design Read

```
Reading this as a product page for a visitor-identification instrument, sold to
  car dealers, leaning nocturne-editorial.
Mandate: REDESIGN — index4 is content, not art direction. Carried through:
  the wordmark and its cyan numeral, the ground #0B0F1E, orange #FF9300,
  cyan #00ECFF, Inter Tight, Plex Mono, the mountain-and-water imagery,
  and every line of copy.
Dialect: brief-derived. auction-editorial was considered and not selected —
  its chromatic restraint collides with two saturated identity colours that
  already carry meaning.
Dimensionality: SUPPORT, and deliberately no WebGL. index3 and index4 are the
  3D trials; repeating their grammar here would ship the same page three times
  (DNA36). The imagery is flat, art-directed and already good.
```

**A note the brief needs.** The request is framed for a premium automotive
dealership — inventory, vehicle cards, VDP. GD2 has no inventory: it is a data
instrument whose *audience* is dealers. So the automotive register applies to
tone, not to subject. No vehicle cards are invented to satisfy a layout
(`CP7`, `DNA9`).

## The concept, in one sentence

**One anonymous visit, resolved** — the page follows a single trace from the
surface down to a matched profile, and the deeper it goes the more it knows.

## The peak

*"There's a bit where the blanked-out fields just… fill in as you scroll."*
One peak, at the floor of the descent, over the water. It gets the asset budget
and the most scroll room (`DNA28`).

## The feeling curve

| Act | Feeling first | Then what causes it |
|---|---|---|
| 1 · Arrival | unease | a black field, one live marker, `UNIDENTIFIED` |
| 2 · Evidence | recognition | the figure 600,000,000 set larger than any headline |
| 3 · Descent | revelation | the summit gives way to water; redacted fields resolve |
| 4 · The turn | urgency | a hard cut to daylight — what you do, and when |
| 5 · Resolution | decision | one phone number, set large, and nothing else |

## Page grammar

**Chaptered editorial with one cinematic act.** Explicitly different from index3
and index4, which are continuous pinned worlds (`DNA36`). One pinned section on
the page, not two (`DNA47`).

## The signature move

**The redaction lifts.** A visitor record sits in the frame with its fields
struck out as solid bars; scrolling the descent resolves them one at a time into
`MATCHED`. It is the product's own claim performed rather than described, and it
is not a parameter change to a device already on the page (`DNA37`).

They resolve to a *state*, never to invented names, numbers or addresses. Showing
fabricated personal data would be both false and repellent (`CP7`, `GI3`).

## Shot list

| Act | Shot | Device |
|---|---|---|
| 1 | **reveal** | the field exists before the subject; the marker is discovered |
| 2 | **macro** | one figure at a scale the page has not used before |
| 3 | **push-in** | pinned descent, summit → water, scrubbed |
| 4 | **interruption** | ground inverts to light; colour steps out entirely |
| 5 | **release** | motion stops on a composed frame |

**Mobile shot list, authored separately** (`DNA67`): act 1 keeps the marker and
loses the horizon bleed; act 2 becomes a vertical spec plate; act 3 is **not
pinned** — it becomes two full-bleed stills with the record resolving on entry;
act 4 is unchanged in kind, tighter in measure; act 5 identical.

## Grid

12 columns, gutter `--gut`, measure `--col` (max 1560). Bleed is a chapter
device and only act 3 uses it (`DNA12`).

## Budget

`mountain-cut.webp` 93 KB (act 1, cut-out, replaces `peak2.webp` 285 KB) ·
`peak2.webp` 285 KB (act 3) · `ocean-back-final.webm` 650 KB · poster 55 KB ·
`fg.webp` 8 KB. **Under 1.1 MB of media**, no canvas, LCP is the act-1 headline
as real HTML text (`DNA74`).

## Asset origin

All imagery is pre-existing project material, already in the repository and
already used in production. Nothing generated for this build. The mountain and
water are landscape, not a real product, place or person (`GI3`).

`mountain-cut.webp` is the one file added since: not generated, but
`assets20/img/mountain.png` — the production hero's own hand-cut mountain layer,
the same photograph with its sky removed — re-encoded to WebP with alpha at
2000px. Nothing was invented and nothing was upscaled; the file exists because a
1.85 MB PNG is not a hero asset (`GI6`, and the budget above).

## Claims ledger

| Claim | Source |
|---|---|
| 600M+ consumer profiles, updated daily | index4 hero readout |
| 300+ data points from a single page view | index4 hero copy |
| Field list: name, phone, email, address, income, home value, credit, existing loans, social links | index4 hero copy |
| 600+ visitor signals | index4 act copy |
| (866) 591-7555 | index4 masthead |
| Without forms or sign-ups | index4 act copy |

No figure appears on the page that is not in this table.

**Second pass, 2026-09-01.** Alex supplied `image 1.png` in the repository root — kept here as
[`source-comp.webp`](source-comp.webp), 226 KB against the original 3.6 MB —
the client's own Visitor Nexus comp — as the content source for everything the
page was still missing. Three chapters and a real footer came from it, and every
line below traces to that file. The brand is GD2 throughout; only the name is
substituted.

| Claim | Where in the comp |
|---|---|
| 100,000,000 records updated daily | "100 Million + Daily Consumer Records Updated" |
| 30+ years of data | "30 + Years Of Data" |
| Free 14-day trial · Cancel anytime · No obligation consultations | hero, right column |
| Startup · Small Business · Growth · Enterprise | the FREE TRIAL panel |
| CDPR · CCPA · FCRA · GLBA · DPPA | the compliance list |
| The privacy paragraph | the compliance right column, verbatim but for the name |
| The eleven customer names | "Brands we Work With" |
| The four footer columns and the legal line | the footer |

**What the source does not contain, and what the page therefore does not say.**
No prices: the comp names four tiers and gives no figures, so the tiers are set
as a sequence and no price-shaped hole is opened for one to be invented into
(`CP7`). No expansions of the five compliance acronyms: the comp carries the note
*"need longer name for visual balance"* beside each one, which means the long
names have never been written — so the acronym is the whole row. No logo files:
the customers are set as type, because a drawn approximation of somebody else's
wordmark is worse than their name set properly (`GI2`).

The first build of these chapters carried visible placeholder notes — *"Prices
not supplied"*, *"Set as text — wordmark files not supplied"*. Alex removed them:
he holds the outstanding items himself, and build notes printed on a client page
are not the same thing as a placeholder. The gaps are recorded here instead,
which is where they belong.

---

## What the build changed, and why

The gate above was written before the markup. Five things moved during the
visual loop; each is recorded here rather than left as an undocumented drift.

| Changed | Why |
|---|---|
| Act 3's summit is graded to `brightness(.42)`; the water is opened to `1.32` | Measured on the composited render at the top of the pin, the lit snow held the record's keys at **2.60:1** against a 4.5 floor. Fixed by lighting the act — silhouette on the way in, light from underneath — not by a plate under the text, which is a device Alex has ruled out. |
| The record's bars are **erased**, not filled | A bar that fills with colour reads as a progress meter, which is a different claim. The bar *is* the redaction, so resolving means it goes away. |
| Act 4's three steps descend from one rule instead of stacking as three bands | Three sequential steps stacked full-width left 60% of the measure empty at every step. As three columns dropping progressively below a shared horizon, the sequence is spatial and the act gains the density the dark acts do not have. |
| Act 3's running head spans the measure | Two columns each with their own short rule read as two panels. One rule reads as one page, and both columns hang from it. |
| Act 5 lost its boxed button | A bordered control beside a phone number set at 3rem is two controls competing to be the action. Log in is demoted to a text link at the far edge; the number is the act. |
| **Act 1 gained an aurora behind the ridge** | The act had one live thing in it — the marker — and a horizon that never moved, so the field read as a plate. It is behind the mountain *for real*: act 1's plate is now `mountain-cut.webp`, the same photograph with its sky removed, which the production hero already ships as `mountain.png`. Above the ridge the plate is transparent, the light sits under it, and the summit occludes it. Nothing is faked with a blend mode, and there is no derived silhouette mask to drift out of register. |
| The light is multicoloured, and the hues are chosen against the colour law | Violet `rgba(138,116,232)`, aurora green `rgba(92,214,168)` and the hero's own cold sky blue, at 0.30–0.52 before an opacity cycle and a 44px blur. Green sits at ~158° and never approaches `--cyan` at 186°; nothing warm appears anywhere in the layer. **Orange is the promise and cyan is the instrument (§4), and weather is neither** — so weather may not borrow either one's hue. The vault case is `organimo-com`: a soft haze on a near-black ground reads as discipline exactly as long as the accent stays the only sharp colour in the frame. `lapz-io` is the counter-case, where atmosphere took objects to the edge of invisibility, which is what the measurements below are for. |
| The rates were wrong on the first pass and were rebuilt | Drift at 68s against a 34s breath moved the light 3px and 0.05 of opacity in three seconds — running, correct, invisible. `main.css` records the identical mistake on the hero's cloud banks and the identical verdict: a movement too slow to be seen is a decision not taken. The periods are now 27s / 19s / 33s of travel against 17s / 11s / 23s of swell, each band crossing a tenth of the frame, and each opacity cycle runs four uneven stops rather than two on a sine — three bands summing to a light that arrives and leaves, not a beat that can be counted. |
| The plate box grew, and the scrim over it had to learn an edge | The cut-out carries transparent margins the flattened photograph did not, so at 100% it read as a small hill in the corner: it is 124% wide and cropped lower, in a box 58% of the act instead of 46%. That taller box made `.horizon::after` draw a straight tonal step across the whole frame at its own top edge, so the scrim is masked out at its top — the same failure as the plate's foot, one layer up. |
| The horizon plate dissolves at its foot | At `100svh` the ridge runs off the bottom of the *screen*, which is the intended crop; but the page continues, and on the way into act 2 the same edge was a straight tonal step across the full width. A mass may break an edge; it may not be cut by one. |
| The mobile plate was widened for real | `width: 150%` in the ≤62rem block had never taken effect — `ds.css` sets `img { max-width: 100% }`, which capped it back to the box and left the right quarter of a phone screen with no mountain in it and a vertical edge where the photograph stopped. `max-width: none` makes the rule do what it always said. |

## Measured, on the composited render

Worst pixel behind each run, text hidden, at four points across the pinned act
and at two on mobile. Every run clears AA.

| | rh | h2 | body | record key | record value |
|---|---|---|---|---|---|
| pin 0.01 | 9.82 | 13.24 | 14.81 | 9.89 | — |
| pin 0.34 | 8.00 | 8.96 | 8.61 | 11.67 | 13.20 |
| pin 0.92 | 6.68 | 8.14 | 7.34 | 18.97 | 13.41 |
| 390px | 15.43 | 15.99 | 16.69 | 15.72 | 13.13 |

Floors: 4.5 for body and mono, 3 for the 42px headline.

**Act 1, re-measured after the aurora, the cut-out plate and the new scrim.**
Worst pixel behind each run, text hidden, with the bands frozen at two points of
their travel and the opacity cycle held at its own peak — the brightest state
the loop can reach.

| 1440 × 900 | statement, over its glyph band | statement, whole box | body | signal label |
|---|---|---|---|---|
| bands at 0.00 | **14.62** | 5.51 | 11.60 | 8.08 |
| bands at 0.36 | **13.55** | **4.37** | 11.60 | 8.08 |

| 390 × 844 | statement | body | signal label |
|---|---|---|---|
| light at its peak | 19.07 | **5.98** | 8.08 |

Two numbers are given for the statement because they answer different
questions. The whole box runs 832px wide and the longest line of type ends at
660 — the worst pixel in the box sits at x+762, in air. Over the band the
glyphs actually occupy it is 13.55 at worst. Floors: 4.5 for body and mono, 3
for the display line. Every run clears both figures, and the mobile body figure
moved from 16.69 because the plate is now the size the stylesheet always asked
for, not because of the light: measured again with the whole layer set to
`display: none`, the worst pixel was identical to the last digit.

## Degraded paths

| Path | Result |
|---|---|
| `prefers-reduced-motion` | no pin, water in, record resolved, nothing hidden; document 4432px instead of 7126px. The light behind the ridge keeps its composition and loses its clock — the banks are placed at a frame taken from the loop rather than snapped to a keyframe boundary, verified by rendering the block with its own media condition forced on |
| scripting off | every word present, no hidden blocks, no overflow |
| `index5.js` fails to load | `onerror` clears the `data-js` flag, so the reveals un-hide rather than stranding nine blocks |

## Mobile, art-directed separately

The bar carries the **phone number** and folds Log in into the menu, because
the phone number is this page's one action. Act 3 is not pinned and is not a
fixed stage — the content sizes it, after a `100svh` version clipped the act's
headline behind the masthead. The wash gives the water one band above where the
type starts, because measured on the render the shaft of light crossed the
headline at 2.93:1. Act 4's stair flattens to a list, since a stair needs three
columns to be a stair. Every control reaches 44px.

Act 1's light is re-authored on a phone rather than scaled down. There is no
left half to mask it out of — the copy runs the full measure — so the band moves
*below* the paragraph and the rule and lights only the ridge, the third bank is
dropped (three banks in a 390px frame is one bank), and the blur comes down from
58px to 38px, which on that frame is the difference between weather and a wash.
The plate itself is finally the size the stylesheet always asked for; before the
`max-width` fix a quarter of the screen had no mountain in it.

No horizontal overflow at 320, 360, 390, 430, 768, 834, 1024, 1280, 1440, 1920.
