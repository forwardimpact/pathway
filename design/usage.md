# Using the Design Language

> How to apply the [shared design language](index.md): the layered checklist for
> producing illustrations, and the contract for deriving a brand that stays
> recognizable as a sibling.

This document is about _use_. The language itself — philosophy, characters,
scene grammar, base scenes, color, typography, spacing, components, motion, and
accessibility — lives in [index.md](index.md). Read that first.

---

## 1. Illustration Checklist

Illustrations are generated with [Grok](https://grok.com), a multi-modal LLM,
from three layers. Each layer adds to the previous without restating it.

### Layer Assembly

| #   | Layer           | Source                                                               | Provides                                              |
| --- | --------------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | Character sheet | [index.md § 2](index.md#2-character-specification)                   | The three characters as standalone figures            |
| 2   | Scene rules     | [index.md § 3](index.md#3-scene-grammar)                             | Composition, rendering, and constraints for any scene |
| 3   | Scene prompt    | [index.md § 4](index.md#4-reusable-base-scenes) or brand `scenes.md` | Specific poses, objects, and interactions             |

A scene prompt should describe what the characters are _doing_ — posture, gaze,
position, objects in hand — without re-specifying what they _look like_ or how
scenes are _rendered_. Those belong to layers 1 and 2.

---

## 2. Deriving a Brand

A brand inherits the shared language and adds its own interpretation. The split
below preserves family resemblance: someone who has seen one brand should
immediately recognize a sibling, even when the metaphor and palette differ.

### Inherited (do not override)

These elements are the family's shared DNA. A brand that diverges on any of them
stops being part of the family.

- **The three characters and their identifying traits.** Engineer's animal-eared
  hoodie, the AI Agent's geometric round head with headphones, the Stakeholder's
  business attire and absent backpack. Posture, scale, and group dynamics also
  stay constant.
- **2px monochrome line-art** for characters, scenes, and icons.
- **Pure white scene backgrounds.** No frames, panels, or fills.
- **Character constraints** ([index.md § 2](index.md#2-character-specification))
  **and scene constraints** ([index.md § 3](index.md#3-scene-grammar)). The
  illustration checklist in [§ 1](#1-illustration-checklist) consolidates
  verification criteria.
- **Scene grammar** — composition rules, scale conventions, emotional tone
  ([index.md § 3](index.md#3-scene-grammar)).
- **Reusable base scenes** — Trio at Work, Welcome Wave, Documentation Dig
  ([index.md § 4](index.md#4-reusable-base-scenes)).
- **Monochrome with one warm signal**
  ([index.md § 5](index.md#5-color-philosophy)). The hue varies; the pattern
  doesn't.
- **Typography pairing** — display serif + sans body + monospace code
  ([index.md § 6](index.md#6-typography-pattern)).
- **8px spacing rhythm** and the spacing token names
  ([index.md § 7](index.md#7-spacing-system)).
- **Component vocabulary** — buttons (primary/secondary/ghost/product), cards,
  terminal/code blocks, dark footer ([index.md § 8](index.md#8-components)).
- **Motion defaults** and `prefers-reduced-motion` compliance
  ([index.md § 9](index.md#9-motion--interaction)).
- **Accessibility rules** ([index.md § 10](index.md#10-accessibility)).

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
- **Radii values** — concrete `--radius-sm/md/lg` numbers may differ per brand
  to match the brand's material vocabulary (e.g. journal cards vs stamped
  paper). Brands diverging on radii must restate the affected component specs in
  their own `index.md`, since the family's component vocabulary in
  [index.md § 8](index.md#8-components) names sizes only by token.
- **CSS design tokens** — the concrete `:root` realization of the above.

### Cross-brand component contract

Components inherited from [index.md § 8](index.md#8-components) must reference
the family **semantic tokens** (`--bg-page`, `--bg-warm`, `--text-primary`,
`--border-strong`, `--accent-warm-200`, `--accent-warm-400`, etc.), never the
brand-specific palette tokens (`--sand-200`, `--ink-400`, …). Each brand exposes
its warm-signal ramp both under a brand-specific name (for use inside that
brand's docs and worked examples) **and** under the family alias
`--accent-warm-{50,100,200,400,600}`. Shared component code that targets
`--accent-warm-*` then renders correctly under any brand's `:root`.

### File structure

A brand lives in `design/<brand>/`:

- `index.md` — premise, products, palette, typography, layout patterns, product
  visual language, CSS tokens. Links back to the shared language with
  `../index.md`.
- `scenes.md` — product scenes and the scene usage matrix.
- `icons.md` — product icons, icon system rules, and any combined suite mark.

Visual artifact files (`scenes.md`, `icons.md`) sit alongside `index.md` to keep
the brand entry point short and the artifact catalogues easy to scan
side-by-side.

Add the brand to the "Brand implementations" list at the top of
[index.md](index.md). See [`fit/`](fit/index.md) as a worked example.

---

_How-to companion to the [shared design language](index.md). For concrete
palettes, fonts, products, scenes, icons, and CSS tokens, see the brand
implementation files listed at the top of that page._
