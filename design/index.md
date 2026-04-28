# Design Language

> A monochrome, character-driven design language for product suites where
> people, AI agents, and domain experts collaborate as equals. Inspired by the
> restraint of Ollama and the character-driven warmth of Go's Gopher, adapted
> for professional product suites.

This document describes the abstract design language: the philosophy, the three
characters, the scene grammar, and the cross-brand patterns for color,
typography, spacing, components, motion, and accessibility. Concrete
implementations — palette values, fonts, product taxonomies, icons, layouts, and
design tokens — live in per-brand files. Brands derive from this shared language
and stay recognizable as siblings while taking distinct stances on metaphor,
palette, and motif. The contract is in
[§ 12 Deriving a Brand](#12-deriving-a-brand).

**Brand implementations:**

- [Forward Impact Team (FIT)](fit/index.md) · [scenes](fit/scenes.md) ·
  [icons](fit/icons.md)
- [Kata](kata/index.md) · [scenes](kata/scenes.md) · [icons](kata/icons.md)

---

## 1. Design Philosophy

**Monochrome. Quiet. Purposeful. Warm at the edges.**

### Core Principles

1. **Monochrome with one warm signal.** Pure black and white base, with a single
   warm tone used sparingly for ambient warmth — campfire light on a
   black-and-white photograph. The specific warm tone is a brand decision.
2. **Texture, not decoration.** Brand-chosen textures (e.g. contour lines)
   appear as subtle background elements, never as foreground decoration.
3. **Three characters are the emotional core.** Hand-drawn monochrome figures
   replace the solo hero with a team.
4. **Typography creates hierarchy.** No accent colors. Size, weight, and spacing
   do all the work.
5. **Each product has its own visual motif.** Product-level differentiation
   happens in icons and illustrations, never in structural UI.

---

## 2. The Three Characters

The visual identity is built around three characters who embody a collaborative
dynamic between people, AI, and domain expertise — and who mirror three
audiences (Engineers, Agents, Leadership). They are always shown together —
working side by side, consulting, collaborating. They replace the solo hero with
a team, reflecting that this work happens at the intersection of engineering,
AI, and the business it serves.

### Design Specifications

**Shared Traits:**

- **2px black stroke** with minimal gray fills — monochrome line art
- Round heads, simple dot eyes — expressive through posture, not facial detail
- Roughly 2:3 proportions (wide:tall), slightly cartoonish but not childish
- Same height — no hierarchy of size
- Hand-drawn style, like a working notebook sketch

**The Engineer:**

- Animal-eared hoodie (bunny or fox ears on the hood) — the signature element.
  The hoodie signals hacker/builder culture — someone who ships code, lives in
  terminals, and brings creative irreverence to serious problems.
- Visible backpack — they carry their tools wherever they go. Hair visible under
  the hoodie.
- Laptop with a round citrus fruit sticker (resembling Apple logo without the
  apple fruit)
- Posture: leaning in, engaged, slightly informal

**The AI Agent:**

- Round circle head, two large dot eyes, small curved smile
- Headphones wrapping around the head — suggests active listening
- Small backpack like the others, signaling it's part of the team — deployed
  alongside humans, not hovering above them
- Simple geometric body form — more geometric than the human characters
- Laptop (pixel-art skull/space invader sticker optional)
- Posture: upright, attentive, slightly turned toward others

**The Business Stakeholder:**

- Business attire: collared shirt, tie, blazer. Neat hair, formal posture.
- **No backpack** — they're the domain expert who already knows the territory,
  not the one carrying gear into it. They represent leadership and domain
  experts who define what good looks like — product owners, engineering
  managers, and business stakeholders.
- Laptop with a Claude Code sticker
- Posture: engaged but composed, professional

**Group Personality:**

- Seated shoulder to shoulder, each on their own laptop — equals collaborating
- Emotional tone: "We're figuring this out together"
- Candid sketch of a working session, not a posed team photo
- Close enough that elbows might bump

**Scale:** 48px (small inline) to 400px+ (hero). At small sizes, reduce to
silhouettes preserving key identifiers: hoodie ears, robot head, tie.

---

## 3. Scene Grammar

Scenes show the three characters interacting with each other — and, in
brand-specific scenes, with product symbols. All rendered in monochrome line-art
on clean white background with no panel borders or background fills. Objects use
the same 2px stroke as characters.

### Scene Design Rules

| Rule           | Specification                                                    |
| -------------- | ---------------------------------------------------------------- |
| Background     | Pure white — no boxes, frames, or shading                        |
| Ground         | Implied by positioning — no explicit ground line                 |
| Object style   | Same 2px stroke monochrome line art                              |
| Composition    | Characters grouped tightly, centered — reads as a single cluster |
| Whitespace     | Generous space around the scene cluster                          |
| Scale          | 120px (cards) to 480px+ (hero)                                   |
| Emotional tone | Curious, conspiratorial, scrappy — three people who chose this   |

---

## 4. Reusable Base Scenes

These scenes show the trio without product-specific symbols and are reusable
across brands and contexts.

### Scene: Trio at Work (Default)

**Context:** Hero illustrations, suite-level marketing, default state.

All three seated side by side, each with a laptop. Engineer left, cross-legged
on the ground, laptop balanced on one knee, leaning sideways to peek at Agent's
screen. AI Agent center, seated upright on a chair, head tilted slightly — the
only one with correct posture. Stakeholder right, chair tipped back on two legs,
one arm draped over the backrest, typing one-handed. Shoulders overlapping.
Brand-specific product icons may appear in a row below.

```
     🐰💻   🤖💻   👔💻
      \      |      /
       (huddled together)
```

**Key details:** The trio sits at different heights — Engineer on the floor,
Agent on a chair, Stakeholder tipped back — creating a diagonal line that feels
informal and alive. Engineer is clearly nosing at someone else's screen.
Stakeholder's tipped chair says "I've done this before." Agent's perfect posture
is the deadpan counterpoint. The energy is a late-night hackathon that happens
to include someone in a blazer.

### Scene: Welcome Wave

**Context:** Onboarding screens, first-time user experience, landing page.

All three standing, facing the viewer. Engineer mid-stride toward the viewer,
both arms out wide — too enthusiastic, slightly off-balance, hoodie ears
bouncing. AI Agent stands still, one hand raised in a precise right-angle wave,
head tilted in greeting. Stakeholder one step behind, hand raised palm-out at
shoulder height — the composed anchor. Feet visible, small action lines around
Engineer's movement.

```
    🐰🖐   🤖🖐   👔🖐
     hey!!   hello.   welcome.
```

**Key details:** Engineer's over-eager stride forward creates the energy.
Agent's geometric wave is the visual punchline — friendly but mechanically
precise. Stakeholder's measured gesture grounds it: "Don't worry, we're
professional too." The three different levels of enthusiasm tell you everything
about the team dynamic in one frame.

### Scene: Documentation Dig

**Context:** Documentation pages, knowledge base, "getting started" flows.

All three around a waist-high surface with papers. Engineer holds a sheet at
arm's length, head tilted, rotating it — clearly reading it sideways or upside
down. AI Agent has already sorted its section into a perfect stack and is
reaching for Engineer's mess. Stakeholder leans across the table, index finger
on a specific line — they've found it, and they're waiting for the other two to
catch up.

```
         📄 📄
    🐰   📋🤖📋   👔
     \   📄📄📄   /
      (table with papers)
         📄  📄
       (papers on floor)
```

**Key details:** The comedy is in the three speeds: Engineer still figuring out
which way is up, Agent already done and reaching for more, Stakeholder patiently
waiting with the answer. Each character's relationship to documentation reveals
their personality. Engineer's rotated page is the visual gag — hackers and docs
have a complicated relationship.

---

## 5. Character & Scene Guidelines

### Don'ts

- **Never show characters in conflict** — always collaborative
- **Never make the AI Agent dominant** — equal partner, not floating above
- **Never remove the Engineer's hoodie ears** — key identifier at all sizes
- **Never put a backpack on the Stakeholder** — absence is their trait
- **Never render in color** — monochrome line-art only. Gray fills for
  differentiation, never hues
- **Never show them without laptops in seated poses**
- **Never add background scenery** — no landscapes, trees, clouds, except for
  product symbols defined by the brand
- **Never outline or frame a scene** — scenes float freely in whitespace

---

## 6. Color Philosophy

**Monochrome with one warm signal.**

The base palette is pure black through pure white via a ramp of warm-tinted
grays. All grays carry a slight warm shift (~3–5%, pulling toward brown or
taupe) so the difference accumulates across a page — warmer, more human, like
paper.

A single warm tone (e.g. sandstone, ochre, clay) is layered on top:

- **Used in backgrounds and borders, never in text or interactive elements.**
- **Ambient — parchment showing through the ink.**
- Provides a small ramp (50, 100, 200, 400, 600) for warm surfaces, selected
  cards, warm borders, and the rare warm accent.

Brands choose:

- The exact warm-tinted gray ramp (typically `--white`, `--white-warm`,
  `--gray-50` … `--gray-900`, `--black`).
- The warm-signal hue and its small ramp.
- Inverted treatments for dark surfaces (footers, terminals).

See [fit/index.md § Color Palette](fit/index.md#4-color-palette) for one
concrete realization.

---

## 7. Typography Pattern

**Display serif. Sans for everything else. Mono for code.**

| Role               | Family     |
| ------------------ | ---------- |
| **Display / Hero** | Serif      |
| **Headings**       | Sans-serif |
| **Body**           | Sans-serif |
| **Mono / Code**    | Monospace  |

The serif/sans pairing creates hierarchy beyond size and weight. The serif
anchors the brand's character — what it specifically evokes is a brand decision
(e.g. field journals, training manuals, archival records). Brands choose the
specific families and the type scale; the pairing pattern is fixed.

A typical scale spans hero (≈ 64px serif) → display (≈ 44px serif) → h1–h3
(sans, 32/24/20px) → body (16px) → small/badge/mono (14/12/14px). Colors follow
the brand's gray ramp.

---

## 8. Spacing System

Base unit: `8px`. The rhythm extends from micro gaps to hero-scale margins.

| Token        | Value | Usage                               |
| ------------ | ----- | ----------------------------------- |
| `--space-1`  | 4px   | Micro gaps, icon internal spacing   |
| `--space-2`  | 8px   | Tight element gaps, pill padding    |
| `--space-3`  | 12px  | Badge padding, small card gaps      |
| `--space-4`  | 16px  | Default gaps, paragraph spacing     |
| `--space-6`  | 24px  | Card padding, element group spacing |
| `--space-8`  | 32px  | Between content blocks              |
| `--space-10` | 40px  | Section subtitle to content         |
| `--space-12` | 48px  | Between related sections            |
| `--space-16` | 64px  | Major section breaks                |
| `--space-20` | 80px  | Hero internal padding               |
| `--space-24` | 96px  | Top-level section margins           |
| `--space-32` | 128px | Hero top breathing room             |

### Key Spacing Guidelines

- **Hero top padding**: `128px` from nav to first content
- **Between major page sections**: `96–128px`
- **Card internal padding**: `24–32px`
- **Minimum touch target**: `44px` (accessibility)

### Content Width

| Context               | Max Width |
| --------------------- | --------- |
| Page container        | `1120px`  |
| Hero text block       | `640px`   |
| Prose / documentation | `680px`   |
| Card grid             | `1120px`  |

---

## 9. Components

### Buttons

| Variant       | Background   | Border                    | Text            | Radius  | Padding     |
| ------------- | ------------ | ------------------------- | --------------- | ------- | ----------- |
| **Primary**   | darkest gray | none                      | white           | `999px` | `14px 28px` |
| **Secondary** | white        | `1.5px solid` strong gray | darkest gray    | `999px` | `14px 28px` |
| **Ghost**     | transparent  | none                      | dark gray + `→` | —       | `0`         |
| **Product**   | white        | `1.5px solid` strong gray | darkest gray    | `12px`  | `14px 24px` |

All buttons: sans-serif `15px`, weight `500`. Pill radius for marketing CTAs,
`12px` for in-app. Ghost buttons always include `→`.

### Cards

| Property      | Value                                               |
| ------------- | --------------------------------------------------- |
| Background    | white (on warm bg) or warm white (on white bg)      |
| Border        | `1.5px solid` strong gray                           |
| Border radius | `16px`                                              |
| Padding       | `32px`                                              |
| Hover         | Border → warm tone, `translateY(-2px)`, soft shadow |

### Terminal / Code Blocks

| Property      | Value                    |
| ------------- | ------------------------ |
| Background    | darkest gray (warm dark) |
| Text          | warm light               |
| Prompt        | `❯` in warm accent       |
| Comment text  | mid gray                 |
| Border radius | `12px`                   |
| Padding       | `24px`                   |

### Footer (Dark)

| Property         | Value                                     |
| ---------------- | ----------------------------------------- |
| Background       | darkest gray                              |
| Text (primary)   | warm light                                |
| Text (secondary) | mid gray                                  |
| Border           | dark gray for dividers                    |
| Logo             | Trio silhouette + brand wordmark in white |

---

## 10. Motion & Interaction

| Element                | Animation                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| **Page load**          | Hero stagger: scene (0ms) → heading (100ms) → subtitle (200ms) → CTAs (300ms). 500ms ease-out. |
| **Trio idle**          | Subtle sway per character (`translateY` ±2px, staggered 3s/3.4s/2.8s, infinite).               |
| **Product card hover** | Icon ±3° wiggle, card lifts 2px, border warms. 200ms.                                          |
| **Button hover**       | Background transition, 150ms. Primary adds warm shadow.                                        |
| **Section enter**      | Fade up on scroll (`translateY(16px)` → `0`, 400ms).                                           |
| **Nav product switch** | Underline slides, 200ms ease-in-out.                                                           |

All animations respect `prefers-reduced-motion`.

---

## 11. Accessibility

| Concern                   | Solution                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| **Color-only indicators** | Not applicable — monochrome uses shape, size, weight, position                                  |
| **Contrast ratios**       | Black-on-white = 21:1. Body gray-on-white must meet AA (≥ 4.5:1). Large text may meet AA-large. |
| **Focus states**          | 2px solid darkest-gray outline with 2px offset                                                  |
| **Motion sensitivity**    | All animations respect `prefers-reduced-motion`                                                 |
| **Dark mode**             | Invert system — darkest gray bg, warm-light text, white-on-dark line art                        |
| **Scene alt text**        | All scenes include descriptive alt text identifying roles and action                            |

---

## 12. Deriving a Brand

A brand inherits this language and adds its own interpretation. The split below
preserves family resemblance: someone who has seen one brand should immediately
recognize a sibling, even when the metaphor and palette differ.

### Inherited (do not override)

These elements are the family's shared DNA. A brand that diverges on any of them
stops being part of the family.

- **The three characters and their identifying traits.** Engineer's animal-eared
  hoodie, the AI Agent's geometric round head with headphones, the Stakeholder's
  business attire and absent backpack. Posture, scale, and group dynamics also
  stay constant.
- **2px monochrome line-art** for characters, scenes, and icons.
- **Pure white scene backgrounds.** No frames, panels, or fills.
- **The Don'ts in [§ 5](#5-character--scene-guidelines).**
- **Scene grammar** — composition rules, scale conventions, emotional tone
  ([§ 3](#3-scene-grammar)).
- **Reusable base scenes** — Trio at Work, Welcome Wave, Documentation Dig
  ([§ 4](#4-reusable-base-scenes)).
- **Monochrome with one warm signal** ([§ 6](#6-color-philosophy)). The hue
  varies; the pattern doesn't.
- **Typography pairing** — display serif + sans body + monospace code
  ([§ 7](#7-typography-pattern)).
- **8px spacing rhythm** and the spacing token names ([§ 8](#8-spacing-system)).
- **Component vocabulary** — buttons (primary/secondary/ghost/product), cards,
  terminal/code blocks, dark footer ([§ 9](#9-components)).
- **Motion defaults** and `prefers-reduced-motion` compliance
  ([§ 10](#10-motion--interaction)).
- **Accessibility rules** ([§ 11](#11-accessibility)).

### Specified per brand

These are the dimensions a brand uses to find its distinct voice while staying
inside the family.

- **Premise / metaphor** — what world the brand inhabits (e.g. expedition,
  practice, fieldwork). Surfaces in motifs and naming, never in structural UI.
- **Product taxonomy** — which products belong to the brand and what each one
  answers.
- **Color values** — the warm-tinted gray ramp and the warm-signal hue and ramp.
  The pattern is fixed; the values are not.
- **Typeface choices** — specific serif, sans, and mono families, plus
  type-scale numbers (sizes, weights, line heights).
- **Product motifs** — visual symbols (e.g. compass, cairn, dojo mat) used in
  product icons and scenes.
- **Product scenes** — extensions of the base scenes that include the brand's
  product symbols. Live in `<brand>/scenes.md`.
- **Product icons** — drawn on the family's icon grid (24px, 2px stroke, no fill
  except where the brand explicitly notes).
- **Layout patterns** — landing page, navigation, section rhythm specific to the
  brand's site.
- **Product visual language** — UI treatments per product (e.g. progress bar
  styles, dashboard overlays).
- **Radii values** — concrete `--radius-sm/md/lg` numbers may differ per brand to
  match the brand's material vocabulary (e.g. journal cards vs stamped paper).
  Brands diverging on radii must restate the affected component specs in their
  own `index.md`, since the family's component vocabulary in
  [§ 9](#9-components) names sizes only by token.
- **CSS design tokens** — the concrete `:root` realization of the above.

### Cross-brand component contract

Components inherited from [§ 9](#9-components) must reference the family
**semantic tokens** (`--bg-page`, `--bg-warm`, `--text-primary`, `--border-strong`,
`--accent-warm-200`, `--accent-warm-400`, etc.), never the brand-specific palette
tokens (`--sand-200`, `--ink-400`, …). Each brand exposes its warm-signal ramp
both under a brand-specific name (for use inside that brand's docs and worked
examples) **and** under the family alias `--accent-warm-{50,100,200,400,600}`.
Shared component code that targets `--accent-warm-*` then renders correctly
under any brand's `:root`.

### File structure

A brand lives in `design/<brand>/`:

- `index.md` — premise, products, palette, typography, layout patterns, product
  visual language, CSS tokens. Links back to this file with `../index.md`.
- `scenes.md` — product scenes and the scene usage matrix.
- `icons.md` — product icons, icon system rules, and any combined suite mark.

Visual artifact files (`scenes.md`, `icons.md`) sit alongside `index.md` to keep
the brand entry point short and the artifact catalogues easy to scan
side-by-side.

Add the brand to the "Brand implementations" list at the top of this file. See
[`fit/`](fit/index.md) as a worked example.

---

_The design language is brand-agnostic. For concrete palettes, fonts, products,
scenes, icons, and CSS tokens, see the brand implementation files listed at the
top of this page._
