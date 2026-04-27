# Forward Impact Team (FIT) — Brand Implementation

> The FIT realization of the [shared design language](../index.md): a
> monochrome design system for six open-source products — **Map**,
> **Pathway**, **Basecamp**, **Guide**, **Landmark**, and **Summit** — built
> around the metaphor of engineers deployed "in the field." Three characters
> — the Engineer, the AI Agent, and the Business Stakeholder — collaborate
> at the boundary between technology and the real world.
>
> The design embodies Deming's principle: improve the performance of
> developers and agents, improve quality, increase output, and bring pride of
> workmanship to engineering teams.

This file specifies what is FIT-specific: the field metaphor, the six
products, the concrete color palette, the typography choices, the type
scale, the product icons, the layout patterns, the product visual language,
and the CSS design tokens. The product scenes live alongside in
[scenes.md](scenes.md). For the abstract design language and the three
characters, see [../index.md](../index.md).

---

## 1. The Field Metaphor

"The field" draws from three simultaneous meanings:

1. **Expedition**: Forward deployed — operating with autonomy in unfamiliar
   terrain. Basecamp is where you prepare. The Guide keeps you oriented. The
   Pathway is how you advance. The Map shows the territory. The Summit is
   the peak the team aims to reach together.
2. **Scientific fieldwork**: Engineers embedded with business units and
   domain experts — working where the problems live.
3. **Topographic/landscape**: Contour maps, trail markers, compass roses,
   cairns, and mountain peaks — tools humans use to navigate unfamiliar
   ground.

The name **Forward Impact Team** (FIT) captures all three: "Forward" from
forward deployed, "Impact" from the mission to change outcomes where they
happen, and "Team" because this work is fundamentally collaborative —
engineer, AI, and business working together.

The metaphor surfaces in illustration and iconography. The UI itself is
clean and functional, not themed like an outdoor gear catalog.

---

## 2. The Six Products

| Product      | Question it answers                              |
| ------------ | ------------------------------------------------ |
| **Map**      | What does good engineering look like here?       |
| **Pathway**  | Where does my career path go from here?          |
| **Basecamp** | Am I prepared for what's ahead today?            |
| **Guide**    | How do I find my bearing?                        |
| **Landmark** | What milestones has my engineering reached?      |
| **Summit**   | Is this team supported to reach peak performance? |

Each product has its own visual motif — drawn from the field metaphor —
that surfaces in icons and scenes but never in structural UI.

| Product      | Motif                  |
| ------------ | ---------------------- |
| **Map**      | Charted territory      |
| **Pathway**  | Trails and switchbacks |
| **Basecamp** | Shelter and foundation |
| **Guide**    | Stars and bearing      |
| **Landmark** | Vantage points         |
| **Summit**   | The mountain peak      |

---

## 3. Color Palette

### Core Palette

| Token          | Hex       | Usage                                       |
| -------------- | --------- | ------------------------------------------- |
| `--white`      | `#ffffff` | Page canvas                                 |
| `--white-warm` | `#faf9f7` | Alternate section backgrounds, card fills   |
| `--gray-50`    | `#f5f4f2` | Elevated surfaces, code blocks              |
| `--gray-100`   | `#eae8e4` | Hover states, active tabs, tag backgrounds  |
| `--gray-200`   | `#d6d3cd` | Borders (strong), secondary button outlines |
| `--gray-300`   | `#b8b4ac` | Tertiary text, disabled states              |
| `--gray-400`   | `#8a8680` | Secondary text, descriptions                |
| `--gray-500`   | `#6b6763` | Body text                                   |
| `--gray-700`   | `#3d3a37` | Emphasis text, card headings                |
| `--gray-900`   | `#1c1a18` | Headlines, primary text, filled buttons     |
| `--black`      | `#0a0908` | Maximum contrast, hero headings             |

### The Warm Signal: Sandstone

| Token        | Hex       | Usage                                  |
| ------------ | --------- | -------------------------------------- |
| `--sand-50`  | `#faf8f5` | Warm section backgrounds               |
| `--sand-100` | `#f0ebe3` | Highlighted cards, selected states     |
| `--sand-200` | `#e0d7c9` | Warm borders, active indicators        |
| `--sand-400` | `#b8a88e` | Warm tertiary elements                 |
| `--sand-600` | `#8a7a62` | Warm accent text (used very sparingly) |

**Usage rule:** Sandstone appears in backgrounds and borders, never in text
or interactive elements. It's ambient — parchment showing through the ink.

All grays are warm-tinted (pulling toward brown/taupe, ~3–5% warm shift).
The difference accumulates across the page — warmer, more human, like paper.

---

## 4. Typography

### Font Selection

| Role               | Font                                | Fallback                                                    |
| ------------------ | ----------------------------------- | ----------------------------------------------------------- |
| **Display / Hero** | `"Instrument Serif"` (Google Fonts) | `Georgia, "Times New Roman", serif`                         |
| **Headings**       | `"DM Sans"` (Google Fonts)          | `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |
| **Body**           | `"DM Sans"`                         | Same                                                        |
| **Mono / Code**    | `"DM Mono"` (Google Fonts)          | `"SF Mono", Consolas, "Liberation Mono", monospace`         |

### Type Scale

| Token                  | Size              | Weight | Line Height | Font             | Color        |
| ---------------------- | ----------------- | ------ | ----------- | ---------------- | ------------ |
| `--text-hero`          | `4rem` (64px)     | 400    | 1.05        | Instrument Serif | `--black`    |
| `--text-display`       | `2.75rem` (44px)  | 400    | 1.1         | Instrument Serif | `--gray-900` |
| `--text-h1`            | `2rem` (32px)     | 700    | 1.2         | DM Sans          | `--gray-900` |
| `--text-h2`            | `1.5rem` (24px)   | 600    | 1.25        | DM Sans          | `--gray-900` |
| `--text-h3`            | `1.25rem` (20px)  | 600    | 1.3         | DM Sans          | `--gray-700` |
| `--text-body`          | `1rem` (16px)     | 400    | 1.65        | DM Sans          | `--gray-500` |
| `--text-body-emphasis` | `1rem` (16px)     | 500    | 1.65        | DM Sans          | `--gray-700` |
| `--text-small`         | `0.875rem` (14px) | 400    | 1.5         | DM Sans          | `--gray-400` |
| `--text-badge`         | `0.75rem` (12px)  | 600    | 1           | DM Sans          | `--gray-700` |
| `--text-mono`          | `0.875rem` (14px) | 400    | 1.6         | DM Mono          | `--gray-500` |

### Hero Pattern

```
Instrument Serif, 64px, weight 400:

  Empowered engineers
  deliver lasting impact.

DM Sans, 18px, weight 400, gray-400:

  Map, Pathway, Guide, Landmark, Basecamp, and Summit — an open-source
  suite that helps organizations define great engineering, support career
  growth, and give every engineer the clarity to do their best work
  in the field.
```

---

## 5. Product Scenes

The FIT product scenes — Map, Pathway, Basecamp, Guide, Landmark, Summit —
and the scene usage matrix live in a sibling file:
[scenes.md](scenes.md). They extend the
[reusable base scenes](../index.md#4-reusable-base-scenes) with FIT product
symbols.

---

## 6. Product Icons

24px grid, 2px stroke, no fill — matching the characters' line weight.
Should feel drawn in the same notebook.

### Map — The Unfolded Map

```
  ┌─────┬─────┐
  │  ·  │     │
  │ / \ │  ×  │   ← route line with marker
  │/   \│     │
  └─────┴─────┘
```

Folded paper map, partially unfolded, with route line and position marker.
The territory mapped out before you move through it — Map is the central
data store, the single source of truth. Everything else references Map.

### Pathway — The Switchback Trail

```
         ╱ ─ ╲
    ╱ ─ ╱     ╲
   ╱   ╱       ╲
  ~~~~~~~~~~~~     ← winding trail with switchbacks
```

A winding trail with switchbacks and elevation markers — no mountain peaks.
Trail line slightly thinner (1.5px). The career journey through challenging
terrain — shows the route others have taken and helps you plot your own
path. Peaks belong to Summit; Pathway owns the trail.

### Guide — The Compass

```
        N
        │
   W ───┼─── E
        │
        S
```

Circle housing with compass needle. North half filled `--gray-900` — the
only filled element in the icon system. Orientation and direction — the
Guide doesn't carry you, it shows you which way to go. The filled north
arrow subtly implies AI (a "smart" element within an analog tool).

### Landmark — The Cairn

```
      ┃╲
     ┌┸─┐
    ┌────┐
   ┌──────┐
  ┌────────┐
  ──────────
```

Four or five stacked flat stones, tapered tower, with pennant flag at apex.
Sits on a ground line. Slightly irregular edges for hand-drawn feel.
Observation, measurement, and reference points — the cairn is human-made
(not natural), just as Landmark's analysis derives meaning from collected
data.

### Summit — The Peak

```
      ⛳
      /\
     /  \   /\
    /    \ /  \
   /      \/    \
```

Two overlapping mountain peaks, the taller one in front with a small
pennant flag at the apex. Clean triangular shapes. No fill (consistent
with other icons). The peak is a collective goal — not individual
achievement, but the capability the team is trying to reach together.

**Flat variant:** Single peak with flag. Simplified for favicons and tab
bars.

### Basecamp — The Tent

```
      △
     / \
    /   \
   /  ┃  \
  /___┃___\
```

Equilateral triangle with vertical rectangle entrance at center-bottom.
Sits on a ground line. Shelter, preparation, shared space — the tent is
temporary and portable, reflecting that knowledge management should travel
with you.

### Icon System Rules

| Rule        | Specification                                                 |
| ----------- | ------------------------------------------------------------- |
| Grid        | 24×24px with 2px padding (20px live area)                     |
| Stroke      | 2px, round caps, round joins                                  |
| Fill        | None, except Guide's compass needle (north half)              |
| Color       | `--gray-900` default, `--gray-400` when inactive              |
| Ground line | 1px stroke at bottom (Pathway, Landmark, Summit, Basecamp)    |
| Style       | Hand-drawn feel — slightly imperfect corners, micro-variation |
| Sizes       | 24px (inline), 32px (nav), 48px (cards), 96px (marketing)     |

### Combined Icon: The Suite Mark

```
 ┌──┬──┐      ╱─╲             N         ┃╲         ⛳/\        △
 │ /│× │     ╱   ╲            │        ┌┸─┐       /  \      / \
 │/ │  │    ~~~~~~~~~~~~  ───┼───    ┌────┐     /    \    /___\
 └──┴──┘                      │      ──────    /      \
   Map       Pathway       Guide   Landmark   Summit   Basecamp
```

Six icons on a shared ground line, evenly spaced.

---

## 7. Layout Patterns

### Suite Landing Page

```
┌──────────────────────────────────────────────┐
│  [Trio logo]  FIT            [Nav]     [☰]  │
│                                              │
│       ┌──────────────────────────┐           │
│       │  Trio at Work scene      │           │
│       └──────────────────────────┘           │
│                                              │
│     Empowered engineers                      │  ← Instrument Serif
│     deliver lasting impact.                  │
│                                              │
│     Define great engineering. Support         │  ← DM Sans, gray-400
│     career growth. Give every engineer       │
│     the clarity to do their best work        │
│     in the field.                            │
│                                              │
│           [ Explore the suite → ]            │
│                                              │
├──────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│ │ Map  │ │Pathwy│ │Guide │ │Landmk│ │Basecm│ │Summit││
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘│
├──────────────────────────────────────────────┤
│  Background: contour line texture            │
│     "The aim of leadership should be to      │  ← Instrument Serif
│      improve the performance of              │
│      developers and agents."                 │
├──────────────────────────────────────────────┤
│     [ Get started → ]                        │
│  © Forward Impact Team  ·  Apache-2.0 code  │
│     CC BY 4.0 docs                           │
└──────────────────────────────────────────────┘
```

### Navigation Pattern

```
[Trio icon]  FIT   |   Map  ·  Pathway  ·  Guide  ·  Landmark  ·  Basecamp       [Docs]  [Sign in]
```

Current product is bold (`700`). Others are regular (`400`) in `--gray-400`.
Summit is accessible from its product page but not shown in the primary nav
until launch. On mobile, product switcher moves into hamburger menu.

### Warm/Cool Section Rhythm

```
Section 1: white (#ffffff)          — Hero
Section 2: warm (#faf9f7)           — Product cards
Section 3: white (#ffffff)          — Feature deep-dive
Section 4: warm (#faf9f7) + contours — Quote / philosophy
Section 5: white (#ffffff)          — CTA / get started
Footer:    gray-900 (#1c1a18)       — Dark footer (inverted), licenses
```

### Concrete Components

The component patterns in
[../index.md § 9](../index.md#9-components) instantiate with FIT colors:

- **Buttons (Primary):** `background: --gray-900`, text `#ffffff`.
- **Buttons (Secondary / Product):** `border: 1.5px solid --gray-200`, text
  `--gray-900`.
- **Cards:** `background: --white` (on warm bg) or `--white-warm` (on white
  bg), `border: 1.5px solid --gray-200`. On hover, border warms to
  `--sand-200`.
- **Terminal / Code Blocks:** `background: --gray-900` (`#1c1a18`), text
  `#e8e5e0`, prompt `❯` in `--sand-400`, comments in `--gray-400`.
- **Contour Line Texture:** Repeating thin wavy lines in `--gray-100` on
  `--white-warm` or `--sand-50` sections. 1px stroke, spaced 40px apart,
  opacity 0.3. Never on pure white backgrounds.
- **Footer (Dark):** `background: --gray-900`, primary text `#e8e5e0`,
  secondary text `--gray-400`, dividers `--gray-700`. Trio silhouette + "FIT"
  in white. Licenses (Apache-2.0 code, CC BY 4.0 docs) in `--gray-400`.

---

## 8. Product Visual Language

Each product shares the core design system with subtle differentiators:

| Product      | Accent Metaphor                       | Empty State                                      | Tone                                              |
| ------------ | ------------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| **Map**      | Cartography — grids, pins, layers     | AI Agent holding blank map toward viewer         | "Chart the territory before you move through it." |
| **Pathway**  | Trail — switchbacks, elevation marks  | Engineer at trailhead, reading a trail sign      | "Navigate the trail."                             |
| **Guide**    | Navigation — compass, stars           | AI Agent holding compass toward viewer           | "Find your bearing."                              |
| **Landmark** | Observation — cairns, survey markers  | AI Agent beside cairn, holding telescope outward | "Check the cairn."                                |
| **Basecamp** | Shelter — tents, campfire, logbooks   | Completed tent with flag, door flap open         | "Set up camp."                                    |
| **Summit**   | Ascent — peaks, routes, team planning | Trio looking up at peak with flag                | "Reach the peak."                                 |

### Product-Specific UI Treatments

- **Map**: Data visualizations use map-like layouts — nodes on a terrain
  grid for skill taxonomies and org structure.
- **Pathway**: Progress uses vertical elevation bars (filling upward)
  rather than horizontal progress bars. Trail-like switchback patterns for
  navigation steps.
- **Guide**: AI responses indented with a faint left-border in `--sand-200`
  — like a margin note in a field journal.
- **Landmark**: Dashboard trend lines and comparison bars overlaid on a
  subtle terrain grid.
- **Summit**: Team heatmaps use terrain-grid overlays. Capability bars fill
  upward like ascent meters. What-if scenarios use side-by-side peak
  outlines showing before/after team composition.
- **Basecamp**: Document cards use warm-tinted backgrounds (`--sand-50`)
  suggesting pages in a notebook.

---

## 9. Design Tokens

```css
:root {
  /* ── Surfaces ── */
  --bg-page: #ffffff;
  --bg-warm: #faf9f7;
  --bg-elevated: #f5f4f2;
  --bg-hover: #eae8e4;
  --bg-inverted: #1c1a18;

  /* ── Sand (warm signal) ── */
  --sand-50: #faf8f5;
  --sand-100: #f0ebe3;
  --sand-200: #e0d7c9;
  --sand-400: #b8a88e;
  --sand-600: #8a7a62;

  /* ── Text ── */
  --text-primary: #0a0908;
  --text-heading: #1c1a18;
  --text-body: #6b6763;
  --text-secondary: #8a8680;
  --text-tertiary: #b8b4ac;
  --text-on-dark: #e8e5e0;

  /* ── Borders ── */
  --border-default: #eae8e4;
  --border-strong: #d6d3cd;

  /* ── Radii ── */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-pill: 999px;

  /* ── Spacing ── */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
  --space-32: 128px;

  /* ── Typography ── */
  --font-display: "Instrument Serif", Georgia, "Times New Roman", serif;
  --font-sans: "DM Sans", -apple-system, BlinkMacSystemFont,
               "Segoe UI", Roboto, sans-serif;
  --font-mono: "DM Mono", "SF Mono", Consolas,
               "Liberation Mono", monospace;

  --text-hero-size: 4rem;
  --text-display-size: 2.75rem;
  --text-h1-size: 2rem;
  --text-h2-size: 1.5rem;
  --text-h3-size: 1.25rem;
  --text-body-size: 1rem;
  --text-small-size: 0.875rem;
  --text-badge-size: 0.75rem;

  /* ── Transitions ── */
  --ease-default: cubic-bezier(0.25, 0.1, 0.25, 1);
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 400ms;
}
```

---

_FIT brand implementation of the [shared design language](../index.md).
Updated April 2026._
