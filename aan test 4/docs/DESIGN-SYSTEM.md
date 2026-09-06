# GD2 — Design System v1

Extracted from the hero. Not invented for it.

The hero is the only screen this brand has built, so it is the only evidence the
system has. Every token is either a value the hero already proved, or is marked
`AUTHORED` in `tokens.css` with the job it does. Nothing here is a preference
with no source.

**Open [`/ds.html`](../ds.html) to see it.** The contrast figures on that page are
computed in the browser from the live token values at load — they cannot drift
from the CSS. If a token changes and a pair drops below its threshold, the figure
turns orange there before it reaches a visitor.

---

## 1 · The files

| File | What it owns | Rule |
|---|---|---|
| `assets20/css/tokens.css` | Every value in the system: voices, ground, ink, accents, lines, type, space, controls, time, layers | Nothing below it introduces a raw number |
| `assets20/css/ds.css` | The base, the seven type ranks, the layout shells, the primitives and components, the masthead | Site-wide. Loaded on every page |
| `assets20/css/main.css` | **The hero scene, and nothing else** — plates, scrim, weather, route, readouts, near ground | One composition. Delete it and the site still works |
| `assets20/css/deep.css` | **Scene 2, the water** — the full-bleed media, the sticky stage, the overlap and the dissolve mask that make it one environment with the hero, the layer contract for the wings and the character | One composition. Delete it and the section still works |
| `assets20/css/guide.css` | Scaffolding for `ds.html` only | Not part of the system |

Load order is fixed: `tokens → ds → main → deep`. A scene file may only ever be
added at the end, because each one is a composition and nothing below it may
depend on it. Scripts follow the same split: `main.js` is the hero's
choreography, `deep.js` is the water plate's, and neither knows about the other.

Before the split there was one 729-line file where the masthead, the type scale,
the reset and the mountain's parallax geometry all lived together, and `:root`
sat inside the scene that consumed it. The split is what makes a second page
possible without copying the first one.

---

## 2 · Design Read

```
Reading this as a design system for a data-identification product,
  built for buyers who arrive to evaluate rather than to browse,
  leaning instrument-editorial.
Mandate: REDESIGN everywhere except the name. Carried through untouched:
  the ground #0B0F1E, the orange #FF9300, the cyan #00ECFF, Inter Tight as
  the display voice, Plex Mono as the readout voice, the glass masthead,
  and the mountain-as-depth art direction.
  WIDENED 2026-08-07 — the wordmark was replaced on instruction
  ("Visitor Nexus" → "GD2"). Name-level expression is REBRAND scope; every
  other carrier above still holds. See §12.
Dialect: brief-derived / no stored dialect. auction-editorial was considered
  and not selected: this brand is colour-led at the accent layer and its
  register is instrumentation, not catalogue restraint.
Dimensionality: SUPPORT — the hero's three planes reinforce a composition
  that stands without them; the system layer itself is ABSENT of depth,
  and carries rank by tone, scale and space.
```

**Why not auction-editorial.** It is the house dialect and it is the *preferred*
fallback in exactly two situations: the brief is compatible with it, or a
taste-led direction is asked for. Neither holds. The dialect's chromatic
restraint (desaturated accents, chroma ≤0.08, accent as a setting) collides with
a brand whose two identity colours are a saturated orange and a saturated cyan,
both already measured off the prototype and both already carrying meaning. Its
three-voice system with a didone display would replace a working two-voice
system. Naming the dialect `brief-derived` is the correct answer, not a
concession — an absent brief is not a compatible brief.

---

## 3 · Composition read — the hero, short form

The read was run on the artefact the system was extracted from, because a system
pulled from a composition nobody read is a list of values.

| | |
|---|---|
| **Artistic image** | A descent. The claim is *the deeper you go, the more you know*, and the page performs it: a route leaves the summit and runs down the flank toward what the reader gets |
| **Major masses** | Four — the reading column left, the lit summit right of centre, the near ground across the foot, the glass bar across the top |
| **Centres** | Semantic centre is the headline; centre-of-action is the summit marker where the route begins. The headline governs. The two are deliberately not the same point, which is what creates the diagonal |
| **Dominance** | Type dominates, imagery subordinates. The mountain is the setting, not the subject — this is the invariant the scrim exists to protect |
| **Direction** | Down-left to down-right: headline → paragraph → orange rule, then across to the route and down it |
| **Negative space** | Active. The sky between the headline and the summit is the interval that makes both read as placed rather than filled |
| **Responsive** | Below 62rem the route is not shrunk to fit — it goes, and the composition re-forms as one column. See §8: the recomposition is incomplete and it is recorded as debt, not as a decision |
| **Diagnosis** | The composition is resolved. Its dependency is declared: it rests on one class of asset — a high-contrast landscape plate with a quiet region left of the lit mass. With an ordinary photograph the scrim carries a load it should not have to |

---

## 4 · The colour law

**Two accents, two jobs, never swapped.** This is the single most transferable
thing the hero establishes, and it is what stops the next page becoming a
different design.

| | Owns | In the hero |
|---|---|---|
| **Orange** `#FF9300` | The promise: what the visitor gets, and the control that reaches it | the word *know.*, the rule under the paragraph, the plus that opens the offer, the primary button |
| **Cyan** `#00ECFF` | The instrument: signal, data, annotation, focus, active state, system chrome | the numeral in the wordmark, every leader and anchor, the readouts, the log-in edge, the focus ring |

Neither carries meaning alone — each is also carried by position and by a label.
Orange never annotates. Cyan never promises.

**Measured, over `--bg`:**

| Pair | Ratio | Needs |
|---|---|---|
| `--ink` | 19.07:1 | 4.5 |
| `--ink-78` body copy | 11.64:1 | 4.5 |
| `--ink-64` captions | 8.11:1 | 4.5 |
| `--ink-56` quiet labels | 6.39:1 | 4.5 |
| `--ink-48` **the readable floor** | 4.97:1 | 4.5 |
| `--ink-40` ≥24px, icons, control edges | 3.81:1 | 3 |
| `--ink-24` decoration only | 2.13:1 | — |
| `--orange` | 8.56:1 | 4.5 |
| `--cyan` | 13.11:1 | 4.5 |
| `--bg` on solid `--orange` | 8.56:1 | 4.5 |
| `--cyan-line` control edge | 4.59:1 | 3 |
| `--orange-line` control edge | 3.27:1 | 3 |
| `--rule` hairline | 1.47:1 | — **decorative only** |

`--rule` at 1.47:1 is the trap: it is beautiful as a separator and illegal as a
control boundary. Anything a pointer can act on takes `--rule-ui` (3.81:1). The
burger's border was `rgba(255,255,255,.14)` — 1.47:1 — and was raised for exactly
this reason.

---

## 5 · The rules, in nine lines

1. Hierarchy is legible before a word is read. Two ranks are never near-identical.
2. Every text/background pair is measured and the ratio stated. Text over an image
   is fixed at the **background** layer, solved against the worst pixel the run
   actually overlaps — never by weighting the type, never with a text shadow.
3. **Functional text is never below 14px**, at any width. Below the floor, type is
   decoration and decoration carries nothing.
4. Every value resolves to a token. Exceptions: `1px` hairlines, `0`,
   `100%`/`100vh`-class values, **drawn-mark geometry** (the 12-unit icon grid,
   the burger's bars, stroke widths, the plus), and **measured scrim stops** —
   the literal alpha values there *are* the measurement.
5. Internal gaps are smaller than external. Space scales down, never to zero.
   Gutters never fall below 24px.
6. Orange is the promise; cyan is the instrument. Neither does the other's job.
7. Air, then a hairline, then a surface shift, then a box. The box is the fourth
   answer.
8. A shadow is a claim about elevation and it must be true. Only genuinely
   floating layers cast one — the masthead, dropdowns, modals. Nothing else.
9. Every animation has an authored still. One primary temporal idea per viewport.
   No route is discoverable by hover alone.

---

## 6 · Primitives, components, and the budget

Two levels, and the difference is whether the thing can be taken apart. A
**primitive** is a mark with no smaller parts. A **component** is built from
primitives and type, and owns a job on the page.

Adding to either level is a decision, not a reflex: **name the job the existing
set cannot do, in writing, before it enters a page.** That is a bar to clear, not
a door that is closed. Two things doing one job is the common failure, and the fix
is to strengthen one and delete the other — never to keep both at half strength.

**Primitives**

| | Job | Never |
|---|---|---|
| `.ico` | The 12-unit cartographic glyph set | A second icon set; meaning without a word |
| `.rule-o` | The orange mark that closes a claim | As a separator — that is `.divider` |
| `.divider` | The neutral hairline that separates | As a control edge — that is `--rule-ui` |
| `.marker` | A signal point | Anywhere the label alone would do |

**Components**

| | Job | Never |
|---|---|---|
| `.annot` | Binds a claim to the point it is about | In a box — that makes it a card |
| `.plate` | A set of facts read as a record | A bordered table, or zebra banding |
| `.stat` | One figure that outranks its own label | Proportional figures |
| `.media` | An image and the type that survives it | Fixed by weighting the type or a text shadow |
| `.btn` / `.field` | Action and input as one instrument | More than one primary per view |
| `.mh` | One glass instrument, permanently on screen | A second persistent overlay beside it |

### 6.1 · The app mark — `favicon.svg`

The masthead wordmark is three characters and cannot survive a 16px tile, so the
mark reduces to **the numeral alone**. That is not a shortening, it is the part
that already carries the identity: §4 gives the cyan numeral the job the cyan dot
over the I did in the longer wordmark, so the numeral *is* the signature and "GD"
is the part a tab strip can afford to lose.

Drawn, not typeset. The outline is Inter Tight 800's `2` lifted out of
`assets20/fonts/inter-tight-800.woff2`, so the mark cannot drift from the
wordmark and needs no font at render time.

Geometry, in 64ths of the tile — a fixed budget, so the lockup scales as one thing:

| | Value | Why that value |
|---|---|---|
| plate | 64 × 64, `rx` 13, `--bg` | 20.3% ≈ the bar's own `--r-2` / `--bar-h` = 22.9% |
| top margin | 5 | |
| numeral | height 41 (64% of the tile), `--cyan` | the tile has to read at 16px, so the glyph is set by height |
| clearance | 6 | **load-bearing** — see the ratio table below |
| rule | height 8, width 1.7 × the numeral's width, `--orange` | takes the width a numeral leaves spare, so the tile fills |
| bottom margin | 4 | under the top margin, so the group sits grounded rather than floating |

**Both accents, each still doing its own job** (§4): the numeral is the instrument,
the rule is `.rule-o` — the orange mark that closes a claim — and a wordmark is a
claim. Neither borrows the other's role.

**Measured on the rendered pixels, not on the tokens:**

| Pair | Ratio |
|---|---|
| numeral on plate | 13.11:1 |
| rule on plate | 8.56:1 |
| **numeral against rule** | **1.53:1** |

That last row is why the clearance is 6 and not 2. Cyan and orange are both bright
and nearly equiluminant, so an edge between them is mud at any size — the 6 units
of `--bg` between the numeral's baseline and the rule are the reason the mark holds
together at 16px, and nothing may be added into that gap.

The rule is re-proportioned against `.rule-o` on the page (3px tall, ~30% of the
measure): at tile scale the page ratio is sub-pixel and therefore invisible, so it
is corrected optically for the size the mark is actually read at. Same device,
same job, different size — the correction is the point.

Shipped: `favicon.svg` (vector, all sizes), `favicon.ico` (16/32/48 PNG entries,
same geometry), `apple-touch-icon.png` (180, **square bleed and no radius** — iOS
applies its own mask, and a rounded plate under it shows transparent corners).

### The section-language ledger

Fill one row per section before building it, then read **down the columns**. Every
change in a column is either carried by the concept — and you can say which part —
or it is drift. The hero's row is the baseline every later section is read against:

| Section | Ground | Type voice | Containers | Image treatment | Depth | Motion | Signature device |
|---|---|---|---|---|---|---|---|
| **Hero** | `--bg` + plate | Inter 800 display / Plex mono readouts | none — open air + leaders | full-bleed plate, directional scrim | three planes, parallax | route draws on scrub | the drawn route |
| *next section* | | | | | | | |

A new answer in every column in every section is several designs sharing a URL.
Two or three deliberate changes across a long page is authorship.

---

## 7 · Motion

One primary temporal idea per viewport. In the hero:

| Band | What | Rank |
|---|---|---|
| 1 · **Primary** | The route draws as the reader scrolls | The only motion carrying meaning |
| 2 · Transport | The copy leaves | Ranked below the route; it starts only after the route's story ends at 55% |
| 3 · Depth | The near ground rises, the mountain withdraws | One camera, one space |
| 4 · Atmosphere | Three cloud banks drift | Slowest, faintest, and masked away from the reading column |

Durations come from `--d-1` … `--d-4`, easing from `--ease` (settling) and
`--ease-in` (leaving). A duration not on that list is a duration nobody chose.

**Nothing loops perpetually inside a reading zone.** The clouds are masked down to
22% opacity over the paragraph for this reason, and "quiet enough" is not an
exemption. Reduced motion gets an *authored still*, not a disabled animation: the
route is simply drawn, the readings are simply present, the clouds stop and are
distributed across the sky rather than stacked offscreen.

---

## 8 · Known compromises — open invariant debt

These are real and they are named rather than quietly carried. None was
introduced by this work; all three were found while extracting the system, and
all three need a decision from you because the fix is a composition change to the
hero, not a token change.

### 8.1 · Content parity at one column · **U7**

Below 62rem, `.hero__marks` is `display: none`. Its children include the two
callouts and the summit readout, so **“600M+ Consumer Profiles / Updated Daily”,
“Every visit begins with a trace” and “Anonymous activity becomes actionable
insight” disappear entirely on mobile** — which is most real traffic. The CSS
comment claims the runs "return to the flow"; they cannot, because their
container is hidden.

The rule that binds: content-bearing elements are **re-composed** at small widths,
never dropped. Only decoration may be dropped — and if it can be dropped, it
should not exist.

**The fix, and why I did not ship it:** the readouts have to move out of the scene
and into the reading column at one column, which means changing the markup that
GSAP positions and animates by selector. That is a re-composition of the mobile
hero, not a system extraction, and doing it half-way would leave the readouts
invisible on first paint until the scrub timeline reaches them. It is a
20-minute job with the hero open, and it should be done deliberately.

### 8.2 · The phone number is hidden below 78rem · **U7**

`.mh__tel { display: none }` below 1248px. The file's own comment says the phone
number and the log-in are the means of the visitor's task and nothing may move
them — then the number is removed for most viewports. It should fold into the
compact menu, not vanish.

### 8.3 · `aria-hidden` over informational copy

`.hero__marks` carries `aria-hidden="true"`. That is correct for the drawn route
and wrong for the three runs of copy inside it, which are hidden from assistive
technology at every width. Moving the attribute onto `<svg class="route">` alone
would expose the readings and leave the drawing hidden.

### 8.4 · Dead selectors

`.pin` and `@keyframes ring` had no markup and no script reference; removed.
`.offer` and `.plus` have no markup either but `main.js` still queries them
(guarded), so they were kept — the pit-stop is an unfinished device, not a
deleted one. `.h-sub` had no markup; it is now a live type role.

---

## 9 · What changed in the hero, and why

Nothing visual moved except these. Computed styles for 46 elements were captured
before and after the refactor and diffed; every other difference was sub-pixel
float noise or cloud-animation phase.

| Change | Was | Now | Rule |
|---|---|---|---|
| Nav links | 13.5px | 14px | 14px floor — navigation carries information |
| Phone number | 13px | 14px | same |
| Log-in label | 13px / 400 | 14px / 500 | same, plus a control label reads as a control |
| Burger border | `#FFF` @14% · 1.47:1 | `--rule-ui` · 3.81:1 | UI boundaries need 3:1 |
| Nav pill padding | `.58rem .85rem` | `--s2 --s3` | no magic numbers |
| Bar offset | 22px | `--s5` (24px) | on the scale |
| Bar radius | 18px | `--r-2` (16px) | two near-identical radii collapsed to one |
| Compact bar offset | 14px | `--s3` (12px) | on the scale |
| Unfold surface cyan | `rgb(0,235,255)` | `rgb(0,236,255)` | one cyan, not two |
| Callout leading | 1.2 | `--lh-tight` (1.25) | one tight-leading token |
| The orange word | `.h-display em` | `.promise` | a semantic mark, not a tag |

**The accent is no longer bound to a tag.** `.h-display em { color: orange }` made
every emphasis in a headline orange, which spends the accent on grammar. The
orange word is now `.promise`, and `<em>` is ordinary emphasis — italic, ink
coloured — everywhere. The hero's headline carries `<em class="promise">know.</em>`,
because that word is genuinely both; a word that is only a signal takes a `<span>`.
Rendered output is unchanged.

**One bug was introduced and caught:** the new `.lead` type role collided with the
hero's `.lead` SVG leader groups and restyled the drawn route's inherited font
size. Renamed to `.h-lead`. It is exactly the collision a token layer exists to
prevent, and it is why the before/after diff was run rather than eyeballed.

---

## 10 · Judgment calls

- **Bar radius 18 → 16.** Two radii two pixels apart are not two decisions. I
  collapsed to `--r-2` rather than adding a token for the difference. If 18 was
  deliberate, add `--r-3: 18px` and say what it distinguishes.
- **Primary button is orange, not cyan.** The hero's only action is cyan-outlined,
  which looks like counter-evidence — but the hero's `.plus`, the control that
  opens the offer, is orange. So the split is already there: cyan is system
  chrome (log in, focus, nav), orange is the action that reaches the promise. A
  page CTA is the second kind.
- **Section padding is bottom-heavy at ≈1:1.3.** `AUTHORED` — the hero is a
  full-bleed scene and gives no evidence about interior section rhythm. Reading
  runs downward, so a block leans into the space below it and equal padding reads
  as bottom-tight.
- **`--t-h1` … `--t-h3` were interpolated, not invented.** The hero jumps 32→88px
  with nothing between because it has one headline. The interior steps use the
  hero's own ratio (≈1.45 at the top, easing to ≈1.35).
- **Mono 500 was declared.** `plex-mono-500.woff2` was already on disk and
  unreferenced; it is now the emphasis cut for a figure that must outrank its
  label. Inter Tight 600 was declared and unused; it is now the heading weight.
- **Scrim stops left as literal `rgba()`.** Converting them to hex-with-alpha of
  the ground would be tidier and would buy nothing: those numbers are a
  measurement of a specific photograph, and the literal is the documentation.

---

## 11 · Vault entries cited

- `vault/ciridae-com` (3, in) — enterprise clarity through hierarchy control:
  major statements get spatial authority, supporting explanations stay compact.
  The principle taken is that a technically complex product is made credible by
  *restraint in the supporting layer*, not by decorating the primary one — which
  here means the `.plate` and `.stat` devices stay mono, dimmed and unboxed so the
  headline keeps its rank. Its recorded weakness (low-contrast secondary text) is
  the direct source of the `--ink-48` floor.
- `vault/augen-pro` (2, in) — a controlled product world where cursor, navigation,
  typography and imagery belong to one fictional system. The principle taken is
  that the interface should be *of* the world rather than laid on it — which here
  means the annotation, the readout and the focus ring all use the same cyan
  instrument register rather than a separate UI palette. Its recorded weaknesses
  (microtype that disappears, floating capsule navigation as a recognisable
  pattern) are why the 14px floor is absolute here and why the masthead is
  counted as a mass rather than added as chrome.
- `vault/electrafilmworks-com` (2, in) — imagery as the primary interface with
  navigation and metadata visually subordinate to it, held together by a compact
  warm identity mark. The principle taken is that a system survives radically
  different source material when the *supporting layer* is fixed and the media
  varies — which here means `.media` fixes legibility at the background layer per
  instance, so a new photograph changes the scrim numbers and nothing else.

Vault: 3 relevant references, 0 unusable for missing notes.

---

## 12 · Would a regular visitor recognise this as the same brand?

**Not by name — and that was asked for, so it is recorded rather than smoothed
over.** The wordmark went from "Visitor Nexus" to "GD2" on 2026-08-07. A visitor
who knew the old name will not recognise this as the same company, because it
is not presenting itself as one. That is a name-level change, which is REBRAND
scope, and the mandate in §2 was widened to say so rather than letting the
REDESIGN label quietly cover it.

**By everything else, yes**, and the carried elements are specific: the ground
`#0B0F1E` unchanged; both accents at their measured prototype values, now with
their jobs written down; Inter Tight 800 as the display voice at the same scale;
Plex Mono as the readout voice; the glass bar with the same blur, edge and
shadow; the mountain scene untouched.

**The lockup's own logic also carried.** The old mark put one small cyan element
inside the name — the dot over the I. The new one does the same job with the
numeral: `GD` in ink, `2` in cyan. It is the same idea at a different scale, not
a new one, which is why the marker primitive still describes both.

What else changed: three pieces of functional text got 0.5–1px larger, one border
became visible, the wordmark rose from 17px to 22px because a three-character mark
at a thirteen-character size loses the left anchor of the bar, and the values
moved into a file where a second page can reach them.
