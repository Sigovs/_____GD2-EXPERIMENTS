# GD2 — the experiment, and how to pick it back up

One hero was built. Everything since has been an argument about what the rest of
the page should be, run as **seven parallel versions of the same content** rather
than as one page edited six times. Nothing is deleted, so any two can be opened
side by side and judged against each other.

The content never changes. `index4` is the reference for copy, figures, links
and phone number; every version below says the same things and only disagrees
about how.

---

## The seven pages

| | What it is | What it was built to settle | Live |
|---|---|---|---|
| **index** | The production page. PNG hero, scrolled route, scene 2 in water. | The baseline. The design system was extracted from *this*. | [↗](https://sigovs.github.io/GD2/index.html) |
| **index2** | index with the v2 footage cut. | Which ocean grade to ship. | [↗](https://sigovs.github.io/GD2/index2.html) |
| **index3** | 3D mountain, full WebGL, route drawn on the terrain. | Can the PNG hero become real geometry without losing the scroll? | [↗](https://sigovs.github.io/GD2/index3.html) |
| **index4** | Same as index3 with the second mountain (`92-mountain`). | Which of the two models carries the shot. | [↗](https://sigovs.github.io/GD2/index4.html) |
| **index5** | No canvas at all. Chaptered editorial, five acts, one pinned act. | Whether the page needs 3D to be good, or whether composition is enough. | [↗](https://sigovs.github.io/GD2/index5.html) |
| **index6** | Scene 2 as a **2.5D** ocean: flat plates over the real footage, depth from differing parallax rates. | Whether the WebGL diver is worth 900KB of three + a 3.3MB rig. | [↗](https://sigovs.github.io/GD2/index6.html) |
| **index7** | The vault reading. Navy alternating with a warm neutral, one governing event on the first screen, the record published as a plate. No canvas, no video, no scroll-driven anything. | Whether the direction holds when every structural decision has to name the vault entry it comes from — and whether the page still has to be dark. | [↗](https://sigovs.github.io/GD2/index7.html) |

**The open question the whole experiment is circling:** how much dimensionality
this page actually needs. index3/index4 say "real 3D", index6 says "fake it for
a fraction of the cost", index5 says "you don't need it at all". They are three
answers to one question and they are meant to be compared, not merged.

---

## History

| Date | | |
|---|---|---|
| 2026-08-07 | `711057e` | Design system extracted from the hero |
| 2026-08-07 | `92610de` | design_dna vendored as a live submodule + project CLAUDE.md |
| 2026-08-07 | `681e595` | DS page refined, rebrand to GD2, hero retimed |
| 2026-08-07 | `2e08cfc` | Published to GitHub Pages |
| 2026-08-10 | `a7bc384` | Scene 2: the water, one continuous descent into it |
| 2026-08-10 | `a40c20c` | Scene 2: the route draws; index2 to compare footage |
| 2026-08-10 | `ca018dc` | Scene 2: copy hung on the descent; final1 footage |
| 2026-08-15 | `9c69224` | Scene 2: a diver in the water, and a second direction to judge it against |
| 2026-08-31 | `b394d7e` | The mountain in 3D, route on the terrain (index3, index4) |
| 2026-08-31 | `b4c20e0` | **index5** — a fifth concept, with its gate written first |
| 2026-09-01 | `5f07b41` | **index6** — the 2.5D ocean cut |
| 2026-09-01 | — | **index7** — built to the vault, on Alex’s instruction |

---

## index5, in full — because it is the outlier

Its gate is [`BRIEF-index5.md`](BRIEF-index5.md), written **before** the markup:
concept, peak, feeling curve, shot list, separate mobile shot list, budget, and
a claims ledger that no figure on the page escapes.

- **Concept:** *one anonymous visit, resolved.* Five acts — arrival, evidence,
  descent, the turn, resolution.
- **Signature move:** the redaction lifts. Six fields sit struck out; scrolling
  the pinned act erases the bars one at a time into `MATCHED`. They resolve to a
  **state**, never to invented names or numbers.
- **The one structural event:** act 4 cuts to paper. Four dark acts, then
  daylight. Colour steps out entirely there — neither accent clears AA on paper,
  so rank is carried by scale, weight and rules.
- **No canvas, deliberately.** index3 and index4 are the 3D trials; a third
  continuous pinned world would ship the same page three times.
- **Act 1 has an aurora behind the ridge**, added 2026-09-01. It is behind the
  mountain for real: the act's plate is now the cut-out the production hero
  ships, transparent above the ridge, so the light sits under it and the summit
  occludes it. Three bands — violet, aurora green and the hero's cold sky blue —
  travel at 27s / 19s / 33s against swells of 17s / 11s / 23s, each opacity cycle
  four uneven stops so the sum wanders instead of pulsing. Masked off the half of
  the frame the statement is read in (DM9). Neither accent is touched: orange is
  the promise, cyan is the instrument, and weather is neither. Measured on the
  composited render at the brightest state the loop reaches — statement 13.55:1
  over the band its glyphs occupy, body 11.60:1, signal label 8.08:1; at 390px,
  statement 19.07:1 and body 5.98:1.

Everything measured on the composited render is in the brief's tables — contrast
at four points across the pin and at 390px, the degraded paths, and the eight
decisions that changed during the build and why.

---

## The reusable concept prompt

This is the brief that produced index5. It works because it separates **content**
(fixed) from **art direction** (open), and because it refuses to accept a
technically-correct page. Point it at a new `indexN` to run the experiment again.

> Build `indexN.html`. It is **not** an iteration of `index4` and **not** a
> pixel-copy of it.
>
> **`index4` is the source of truth for content only** — sections, copy, figures,
> business information, and every link and CTA that must keep working. It is
> **not** art direction. Composition, section order, hierarchy, spacing,
> typography, grid, cards, hero, backgrounds, crops, transitions, nav
> presentation, CTA treatment, motion, interaction and responsive behaviour are
> all open.
>
> **Use the Design DNA actively** — the result must visibly reflect it, not
> merely cite it. **Search the vault first** and reuse what is already proven;
> do not repeat documented mistakes.
>
> **Make it feel designed.** No endless rounded cards, no everything-in-a-
> container, no pill soup, no generic gradients, no arbitrary glassmorphism, no
> vast empty space with no composition, no repeating section template, no
> generic SaaS, no animation that means nothing. Strong hierarchy, deliberate
> asymmetry, editorial composition, controlled negative space, premium image
> treatment, confident typography, varied pacing. **A few bold decisions beat
> thirty safe ones.**
>
> Re-evaluate the whole type hierarchy from scratch — do not inherit index4's
> sizes, and do not make every headline enormous for drama. The hero sets the
> standard and must answer visually: who is this, what is the experience, what is
> the primary action. Navigation integrated, obvious, desktop and mobile both.
> For each section ask: *what is the strongest visual form for THIS content?*
>
> Motion only where it materially improves things. Desktop first, then **actively
> art-direct mobile** — crops, order, targets, overflow, blank space.
>
> Keep it self-contained: `indexN`-specific CSS and JS. **Do not modify index4.
> Do not break any other version. Do not delete old assets or versions.**
>
> **Work autonomously in a loop: build → render → inspect → critique → improve →
> render again. Technical success is not acceptance.** Look at the actual page.
> If anything is generic, weak, repetitive, awkward or unfinished, fix it before
> presenting it.
>
> Deliver: the page open in a browser, a preview URL, one desktop and one mobile
> screenshot, a **short** report (concept, what came from Design DNA, what was
> reused, the 3–5 biggest decisions, what is still weak) and the file list. The
> PAGE is the deliverable, not the report.

**What actually made the difference**, on the evidence of index5: writing the
concept gate before any markup, and measuring contrast on the *composited*
render rather than on tokens. The measurement caught two failures the eye passed
— the record's keys at 2.60:1 over lit snow, and the mobile headline at 2.93:1
under a shaft of light in the water. Both were fixed by changing the lighting of
the scene rather than by sliding a plate under the text.

---

## Things that will trip you up

1. **`design_dna` is a symlink here, and a `git pull` replaces it with an empty
   directory.** It happened again on 2026-09-01. Restore it:
   ```sh
   rmdir design_dna && ln -s /Users/alex/Desktop/WORK/design_dna design_dna
   ```
   The permanent `T design_dna` in `git status` is expected and must **never** be
   committed. Test it with `git -C design_dna rev-parse HEAD`, never with
   `[ -d design_dna/.git ]`.

2. **Stylesheet order is fixed** — `tokens` → `ds` → the scene files. One scene,
   one file, and the test is always: delete it and the section is still there.
   A scene owns its own script too.

3. **Orange is the promise; cyan is the instrument.** Neither does the other's
   job. Full law in [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) §4.

4. **The `index3.html only` headers on `deep-gsap.js` and `deep-gsap.css` were
   corrected to `index6.html` on 2026-09-01.** The trap they set is the general
   one: after a rename, believe the markup and not the header.

5. **Three invariant breaches are open debt** in `DESIGN-SYSTEM.md` §8, plus the
   3D readout contrast on index3/index4, which stays open because the fix Alex
   ruled out (a wash under the readouts) was the only cheap one. Each needs a
   composition decision. Do not close them silently.

---

## Where to pick it up

The experiment is at a decision point, not a to-do list. What is missing is not
more versions — it is a **judgement**: which of index3/4, index5 and index6 the
real page is built from. That call wants the pages open side by side, not more
code.
