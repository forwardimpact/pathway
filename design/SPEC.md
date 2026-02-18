# Design Spec: Forward Impact Team (FIT) — A Suite for Forward Deployed Engineers

> A monochrome design system for four products — **Map**, **Pathway**,
> **Guide**, and **Basecamp** — built around the metaphor of engineers deployed
> "in the field." The visual identity centers on three characters — the
> Engineer, the AI Agent, and the Business Stakeholder — who collaborate at the
> boundary between technology and the real world. Heavily inspired by the
> restraint of Ollama and Moondream, adapted for a professional product suite.

---

## Current Codebase

- **Map:** This is `products/map/`
- **Pathway:** This is `products/pathway/`
- **Guide:** To be done
- **Basecamp:** This is `products/basecamp/`

---

## 0. The Metaphor

"The field" is the organizing metaphor for the entire suite. It draws from three
simultaneous meanings:

1. **Military/expedition**: Forward deployed — you're sent ahead of the main
   force, operating with autonomy in unfamiliar terrain. Basecamp is where you
   prepare. The Guide keeps you oriented. The Pathway is how you advance. The
   Map shows you the whole territory.

2. **Scientific fieldwork**: Engineers embedded with business units, scientists,
   and domain experts — working where the problems actually live, not back in
   the lab.

3. **Topographic/landscape**: The visual language borrows from contour maps,
   trail markers, compass roses, and cairns — the tools humans have used for
   centuries to navigate unfamiliar ground.

The name **Forward Impact Team** (FIT) captures all three: "Forward" from
forward deployed, "Impact" from the mission to change outcomes where they
happen, and "Team" because this work is fundamentally collaborative — engineer,
AI, and business working together.

This metaphor should feel **earned, not forced.** It surfaces in illustration,
iconography, and occasional copy — but the UI itself should be clean and
functional, not themed like an outdoor gear catalog.

---

## 1. Design Philosophy

**Monochrome. Quiet. Purposeful. Warm at the edges.**

The aesthetic inherits directly from the Ollama/Moondream school: white canvas,
black type, generous whitespace, personality through illustration rather than
color. But where those sites serve individual developers experimenting with open
models, FIT serves **professional engineers in organizational contexts** —
people who are building capabilities, not just shipping code. The design needs
to carry more structural authority while retaining warmth and approachability.

### Core Principles

1. **Monochrome with one warm signal.** Pure black and white as the base, with a
   single warm neutral — a sandstone/khaki tone — used sparingly for ambient
   warmth. Think of it as campfire light on a black-and-white photograph.
2. **Topographic texture, not decoration.** Contour lines and terrain patterns
   appear as subtle background textures, never as foreground elements. They're
   felt more than seen.
3. **Three characters are the emotional core.** The Engineer, the AI Agent, and
   the Business Stakeholder — rendered as hand-drawn monochrome figures —
   represent the collaborative heart of the suite. They replace the solo hero
   with a team.
4. **Typography creates hierarchy.** No accent colors to lean on. Size, weight,
   and spacing do all the work.
5. **Each product has a distinct terrain.** Map = charted territory and routes.
   Pathway = trails and elevation. Guide = stars and bearing. Basecamp = shelter
   and foundation. These visual sub-themes appear in icons, illustrations, and
   empty states — never in structural UI.

---

## 2. Color Palette

### Core Palette

| Token          | Hex       | Usage                                                   |
| -------------- | --------- | ------------------------------------------------------- |
| `--white`      | `#ffffff` | Page canvas                                             |
| `--white-warm` | `#faf9f7` | Alternate section backgrounds, card fills — barely warm |
| `--gray-50`    | `#f5f4f2` | Elevated surfaces, code blocks, pill backgrounds        |
| `--gray-100`   | `#eae8e4` | Hover states, active tabs, tag backgrounds              |
| `--gray-200`   | `#d6d3cd` | Borders (strong), secondary button outlines             |
| `--gray-300`   | `#b8b4ac` | Tertiary text, disabled states                          |
| `--gray-400`   | `#8a8680` | Secondary text, descriptions                            |
| `--gray-500`   | `#6b6763` | Body text                                               |
| `--gray-700`   | `#3d3a37` | Emphasis text, card headings                            |
| `--gray-900`   | `#1c1a18` | Headlines, primary text, filled buttons                 |
| `--black`      | `#0a0908` | Maximum contrast, hero headings                         |

### The Warm Signal: Sandstone

| Token        | Hex       | Usage                                  |
| ------------ | --------- | -------------------------------------- |
| `--sand-50`  | `#faf8f5` | Warm section backgrounds               |
| `--sand-100` | `#f0ebe3` | Highlighted cards, selected states     |
| `--sand-200` | `#e0d7c9` | Warm borders, active indicators        |
| `--sand-400` | `#b8a88e` | Warm tertiary elements                 |
| `--sand-600` | `#8a7a62` | Warm accent text (used very sparingly) |

**Usage rule for sandstone**: It appears in backgrounds and borders, never in
text or interactive elements. It's ambient — a warmth you feel without pointing
to. Think of it as the parchment showing through the ink.

### Palette Philosophy

The grays are deliberately warm-tinted (pulling toward brown/taupe rather than
blue/cool). Compare:

| This system | Cool monochrome (Ollama) |
| ----------- | ------------------------ |
| `#6b6763`   | `#6b6b6b`                |
| `#3d3a37`   | `#3d3d3d`                |
| `#1c1a18`   | `#1a1a1a`                |

The difference is subtle — maybe 3–5% warm shift — but it accumulates across the
page to create a fundamentally different feel. Warmer. More human. Like paper
instead of screen.

---

## 3. Typography

### Font Selection

| Role               | Font                                | Fallback                                                    | Rationale                                                                                                                                                                  |
| ------------------ | ----------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Display / Hero** | `"Instrument Serif"` (Google Fonts) | `Georgia, "Times New Roman", serif`                         | An editorial serif with personality — slightly informal stroke variation that reads as hand-crafted without being decorative. Signals authority and warmth simultaneously. |
| **Headings**       | `"DM Sans"` (Google Fonts)          | `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | Clean geometric sans-serif with slightly rounded terminals. More characterful than Inter, less trendy than Satoshi. Good weight range (400–700).                           |
| **Body**           | `"DM Sans"`                         | Same                                                        | Consistent with headings at smaller sizes.                                                                                                                                 |
| **Mono / Code**    | `"DM Mono"` (Google Fonts)          | `"SF Mono", Consolas, "Liberation Mono", monospace`         | Pairs perfectly with DM Sans. Used in terminal blocks, CLI examples, and code references.                                                                                  |

### Why Serif for Display?

In a monochrome system, the serif/sans pairing creates a secondary axis of
hierarchy beyond size and weight. The serif display heading immediately signals
"this is the main statement" while sans-serif below it signals "this is the
working interface." It also reinforces the field/expedition metaphor — serifs
evoke field journals, cartographic labels, and expedition logs.

### Type Scale

| Token                  | Size              | Weight        | Line Height | Font             | Color        |
| ---------------------- | ----------------- | ------------- | ----------- | ---------------- | ------------ |
| `--text-hero`          | `4rem` (64px)     | 400 (regular) | 1.05        | Instrument Serif | `--black`    |
| `--text-display`       | `2.75rem` (44px)  | 400           | 1.1         | Instrument Serif | `--gray-900` |
| `--text-h1`            | `2rem` (32px)     | 700           | 1.2         | DM Sans          | `--gray-900` |
| `--text-h2`            | `1.5rem` (24px)   | 600           | 1.25        | DM Sans          | `--gray-900` |
| `--text-h3`            | `1.25rem` (20px)  | 600           | 1.3         | DM Sans          | `--gray-700` |
| `--text-body`          | `1rem` (16px)     | 400           | 1.65        | DM Sans          | `--gray-500` |
| `--text-body-emphasis` | `1rem` (16px)     | 500           | 1.65        | DM Sans          | `--gray-700` |
| `--text-small`         | `0.875rem` (14px) | 400           | 1.5         | DM Sans          | `--gray-400` |
| `--text-badge`         | `0.75rem` (12px)  | 600           | 1           | DM Sans          | `--gray-700` |
| `--text-mono`          | `0.875rem` (14px) | 400           | 1.6         | DM Mono          | `--gray-500` |

### Hero Pattern: Serif Statement

The hero heading uses Instrument Serif at regular weight (400). This is the
signature typographic move — the contrast between a lightweight serif at
enormous size and the geometric sans-serif everything else uses. It reads as
confident without being loud.

```
Instrument Serif, 64px, weight 400:

  Forward deployed engineers
  need better tools.

DM Sans, 18px, weight 400, gray-400:

  Map, Pathway, Guide, and Basecamp — a suite for
  charting skills, navigating careers, solving problems,
  and sharing what you learn.
```

---

## 4. The Characters: Engineer, AI Agent, and Business Stakeholder

### Concept

The visual identity of FIT is built around three characters who embody the
collaborative dynamic at the heart of forward deployed engineering. They are
always shown together — working side by side on laptops, consulting,
collaborating. They replace the solo hero with a team, reflecting the reality
that forward deployed work happens at the intersection of engineering, AI, and
business.

The three characters are:

1. **The Engineer** — A person in an animal-eared hoodie (bunny/fox), wearing a
   backpack. The hoodie signals the hacker/builder culture — someone who ships
   code, lives in terminals, and brings a creative irreverence to serious
   problems. The backpack is the constant from the field metaphor: they carry
   their tools wherever they're deployed.

2. **The AI Agent** — A friendly robot figure with a round head, dot eyes, a
   subtle smile, and headphones. It has a backpack like the others, signaling
   it's part of the team — deployed alongside humans, not hovering above them.
   The headphones suggest active listening. The robot form is simple and
   approachable, never threatening or overly futuristic.

3. **The Business Stakeholder** — A person in business attire (shirt, tie,
   blazer), neatly presented. No backpack — they're the domain expert who knows
   the territory, not the one carrying gear through it. They represent the
   scientists, product owners, and business leaders that FDEs are embedded with.

### Design Specifications

**Shared Traits:**

- Rendered in **2px black stroke** with minimal gray fills for clothing/hair —
  monochrome line art
- Round heads with simple dot eyes, minimal features — expressive through
  posture and gesture, not facial detail
- Proportions are roughly 2:3 (wide:tall), slightly cartoonish but not childish
- All three figures are roughly the same height — no hierarchy of size
- Style is hand-drawn, like a field notebook sketch — slightly imperfect, warm,
  human

**The Engineer:**

- Animal-eared hoodie (bunny or fox ears on the hood) — the signature element
- Visible backpack (side or three-quarter view)
- Hair visible under the hoodie
- Typically shown using a laptop with a round citrus fruit sticker on it
  (resembling the Apple logo)
- Posture: leaning in, engaged, slightly informal

**The AI Agent:**

- Round circle head with two large oval/dot eyes and a small curved smile
- Headphones wrapping around the head
- Small backpack visible from behind
- Simple body form — more geometric than the human characters
- Typically shown with a laptop (pixel-art skull/space invader sticker optional
  for personality)
- Posture: upright, attentive, slightly turned toward the others

**The Business Stakeholder:**

- Business attire: collared shirt, tie, blazer/jacket
- Neat hair, slightly more formal posture
- No backpack — they're the host, not the traveller
- Typically shown using a laptop with a Claude Code sticker on it
- Posture: engaged but composed, professional

**Personality of the Group:**

- They sit together, shoulder to shoulder, each on their own laptop — equals
  collaborating, not a hierarchy
- The emotional tone is: "We're figuring this out together"
- The image should feel like a candid sketch of a working session, not a posed
  team photo
- There's warmth in the proximity — they're close enough that their elbows might
  bump

**Scale:** The trio works from 48px (small inline) to 400px+ (hero
illustration). At small sizes, reduce to silhouettes preserving key identifiers:
hoodie ears, robot head, tie.

---

## 5. Scenes

Scenes are the primary illustration system for FIT. Each scene shows the three
characters interacting with each other and with the product symbols. All scenes
are rendered in the same monochrome line-art style as the characters, on a clean
white background with no panel borders or background fills. Objects in scenes
(maps, papers, tents, etc.) use the same 2px stroke as the characters.

### Scene Design Rules

| Rule           | Specification                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Background     | Pure white — no boxes, frames, or shading behind scenes                                                                                                   |
| Ground         | Implied by character positioning only — no explicit ground line in scenes (unlike product icons)                                                          |
| Object style   | Same 2px stroke, monochrome line art as characters — everything looks like it belongs in the same sketchbook                                              |
| Composition    | Characters grouped tightly, centered on the canvas — the scene reads as a single cluster, not spread across the page                                      |
| Proportions    | Objects (map, tent, compass) are sized relative to the characters — large enough to be clearly identifiable but not so large they dominate the characters |
| Whitespace     | Generous space around the scene cluster — the scene floats in white, never touching the edges of its container                                            |
| Scale          | Scenes work from 120px (card illustrations) to 480px+ (hero)                                                                                              |
| Emotional tone | Curious, collaborative, problem-solving. The trio is always engaged and active — never passive or decorative                                              |

---

### Reusable Base Scenes

These are the foundational scenes used across the suite in headers, cards, and
marketing. They are product-agnostic and show the team dynamic without reference
to a specific tool.

#### Scene: Trio at Work (Default)

**Context:** Hero illustrations, suite-level marketing, default state.

All three characters seated side by side on a simple bench or chairs, each with
a laptop open on their lap. The Engineer is on the left, slightly leaning
forward. The AI Agent is in the center, upright and attentive. The Business
Stakeholder is on the right, composed and engaged. Their shoulders are close —
almost touching. Each laptop has its distinguishing sticker (Apple logo,
pixel-art skull, blank/professional). Below the trio, the four product icons sit
in a neat row, evenly spaced.

```
     🐰💻   🤖💻   👔💻
      \      |      /
       (seated together)

    🗺    ⛰    🧭    ⛺
   Map  Pathway Guide Basecamp
```

**Key details:** Laptops are open and angled slightly toward the viewer.
Characters look at their own screens or glance sideways at each other. Posture
is relaxed but focused — a working session, not a meeting.

#### Scene: Welcome Wave

**Context:** Onboarding screens, first-time user experience, landing page hero
variant.

All three characters standing, facing the viewer, each raising one hand in a
friendly wave. The Engineer waves casually (loose wrist, slightly off-axis). The
AI Agent waves with a stiff, cheerful robot gesture (arm straight up, hand
open). The Business Stakeholder gives a more measured wave (hand at shoulder
height, slight nod). All three are smiling (the humans through posture — slight
head tilt, open shoulders; the Agent through its curved mouth line). The
Engineer's backpack and the Agent's backpack are visible. The Stakeholder stands
slightly forward of the other two, as if welcoming guests into their space.

```
    🐰🖐   🤖🖐   👔🖐
     hi!    hello!   welcome!
```

**Key details:** The wave is warm but not over-the-top. This scene should feel
like walking into a friendly office and three colleagues looking up to greet
you. Feet are visible — they're standing, not floating. Small action lines near
the waving hands suggest movement.

#### Scene: Documentation Dig

**Context:** Documentation pages, onboarding guides, knowledge base sections,
"getting started" flows.

All three characters standing around a waist-high surface (a simple table or
crate rendered as a flat rectangle). The surface is covered with stacked papers,
open binders, and loose sheets — a cheerful mess of documentation. The Engineer
is picking up a sheet and holding it close, squinting at it. The AI Agent has
one arm extended, organizing a stack into a neat pile (robot efficiency). The
Business Stakeholder is pointing at something on an open document on the table,
directing attention to it. A few loose pages have drifted to the ground near
their feet. One open binder shows tiny illegible lines suggesting text.

```
         📄 📄
    🐰   📋🤖📋   👔
     \   📄📄📄   /
      (table with papers)
         📄  📄
       (papers on floor)
```

**Key details:** The scene should feel like the moment you open a closet and
everything falls out — but the team is handling it with good humor. The AI
Agent's neat-stack gesture contrasts with the general chaos. The Stakeholder
knows where the important thing is. The Engineer is actually reading. Papers on
the floor add life and visual texture without cluttering the character
silhouettes.

---

### Product Scenes

Each product has a dedicated scene showing the trio engaging directly with that
product's symbol. These are used on product landing pages, feature cards, and
in-app empty states.

#### Scene: Map — Charting the Territory

**Context:** Map product pages, skills data model features, taxonomy
visualizations.

The trio is huddled around a large unfolded map spread on the ground. They're
crouched or kneeling in a circle around it. The map is large — roughly as wide
as the three of them combined — and shows visible route lines, grid marks, and
small pin markers (matching the Map product icon style, scaled up). The Engineer
is tracing a route on the map with one finger, leaning in close. The AI Agent is
holding one corner of the map flat (keeping it from folding back up) while
pointing at a cluster of markers with the other hand. The Business Stakeholder
is crouched opposite, tapping a specific location on the map with authority —
"this is where we need to go."

```
        🐰
       ╱    ╲
     🤖 ┌──────┐ 👔
        │ ·→·  │
        │/  \× │
        └──────┘
       (large map)
```

**Key details:** The map should be recognizably the Map product icon, but scaled
to scene-size: folded creases visible, route lines, pin markers. Characters are
arranged in a rough triangle around it, heads angled down. The scene reads from
above — a bird's-eye intimacy, like you're looking over their shoulders at a
strategy session on the ground.

#### Scene: Pathway — Plotting the Ascent

**Context:** Pathway product pages, skills catalogue, career advice features.

The trio stands at the base of a mountain range, looking up. Two or three
mountain peaks rise behind them (matching the Pathway icon style — overlapping
triangles of different heights, with a winding trail line visible on the
slopes). The Engineer has one foot forward on the trail, pointing up toward the
peak — eager to start climbing. The AI Agent stands slightly behind, tilting its
head to study the trail route, one hand raised with a finger pointing at a
switchback as if calculating the optimal path. The Business Stakeholder stands
to the side with arms crossed (confident, not closed off), surveying the whole
range — they've been here before and know the terrain.

```
           /\
          /  \   /\
    🐰   /    \ /  \   👔
     ↗  / ~~~~ \/    \  (arms crossed)
       🤖
      (studying trail)
```

**Key details:** The mountains are background elements — lighter stroke (1.5px)
or slightly smaller scale to create depth without competing with the characters.
The winding trail on the mountainside should be clearly visible, connecting the
base (where they stand) to the summit. The scene conveys "we can see the whole
journey ahead of us."

#### Scene: Guide — Finding North

**Context:** Guide product pages, AI onboarding features, career advice chatbot.

The trio stands together, slightly lost — they've paused to get their bearings.
The AI Agent is in the center, holding up a large compass (matching the Guide
product icon, scaled to be held in two hands — a disc about the size of a dinner
plate). The compass needle is clearly visible, pointing north, with the north
half filled in black. The Agent holds it steady and tilts it toward the other
two. The Engineer leans in from one side, peering at the compass face with
curiosity, one hand pushing back their hoodie slightly to see better. The
Business Stakeholder leans in from the other side, one hand on chin in a
thinking pose, nodding — they're interpreting the direction in the context of
what they know about the territory.

```
    🐰          👔
     \   🤖    /
      ╲ [🧭] ╱
       (compass held up)
```

**Key details:** The compass is the focal point — all three characters' eye
lines converge on it. The Agent is the one holding the instrument, reinforcing
its role as the navigation aid. But it's showing the compass to the others, not
dictating direction — collaborative orientation, not instruction. Small
radiating lines around the compass suggest it's active or glowing faintly.

#### Scene: Basecamp — Setting Up Camp

**Context:** Basecamp product pages, knowledge management, personal and team
workspace features.

The trio is in the process of setting up an A-frame tent (matching the Basecamp
product icon, scaled up to character-height). The tent is half-assembled — one
side of the frame is up, the other is being pulled into place. The Engineer is
on one side, pulling a tent pole into position with both hands, leaning back
with effort (action lines for exertion). The AI Agent is on the other side,
holding the opposite pole perfectly vertical with robotic precision — effortless
and steady. The Business Stakeholder is standing just behind the tent, holding
open the tent flap/entrance, peering inside as if checking that the interior is
set up properly — organizing the space. A small flag or pennant sits on the
ground nearby, ready to be placed on the apex once the tent is complete.

```
    🐰  ╱  △  ╲  🤖
    (pull) / \ (hold)
          / 👔\
         /  ┃  \
        (checking inside)
         🏁 (flag ready)
```

**Key details:** The tent should be recognizably the Basecamp icon, but at human
scale — big enough to stand inside. The half-assembled state adds dynamism:
they're building something together, not posing in front of a finished product.
The Engineer's effort and the Agent's effortlessness is a visual joke (human vs.
robot strength). The Stakeholder's focus on the interior signals that Basecamp
is about what's inside — the knowledge, the organization — not just the
structure.

---

### Scene Usage Matrix

| Context                        | Scene                                       | Size      |
| ------------------------------ | ------------------------------------------- | --------- |
| Suite landing page hero        | Trio at Work                                | 400–480px |
| Suite landing page (alternate) | Welcome Wave                                | 400–480px |
| Onboarding — first screen      | Welcome Wave                                | 320–400px |
| Onboarding — getting started   | Documentation Dig                           | 280–360px |
| Documentation / help center    | Documentation Dig                           | 240–320px |
| Map product hero               | Charting the Territory                      | 320–400px |
| Pathway product hero           | Plotting the Ascent                         | 320–400px |
| Guide product hero             | Finding North                               | 320–400px |
| Basecamp product hero          | Setting Up Camp                             | 320–400px |
| Product cards (suite landing)  | Product scenes (cropped/simplified)         | 120–160px |
| Error / empty states           | Any single character extracted from a scene | 80–120px  |
| Loading states                 | AI Agent with spinning compass              | 48–80px   |

---

## 6. Product Icons

Each product gets an icon derived from the field/terrain metaphor. Icons are
**24px grid, 2px stroke, no fill** — matching the characters' line weight. They
should feel like they were drawn in the same notebook.

### Map — The Unfolded Map

**Codebase:** This is the `app/schema/` application

**Concept:** A folded paper map, partially unfolded, with a route line and
position marker on it — the foundational artifact that charts the territory
before you travel through it.

```
  ┌─────┬─────┐
  │  ·  │     │
  │ / \ │  ×  │   ← route line with marker
  │/   \│     │
  └─────┴─────┘
```

**Specifications:**

- A rectangle divided by a vertical fold line (suggesting a folded map opened
  flat)
- A meandering line across the surface (the route / data model)
- A small position pin or crosshair marker on the route
- 2px black stroke, no fill
- Optional: tiny grid lines within the map suggesting cartographic detail

**What it communicates:** The territory mapped out before you move through it.
Map is the foundational data model — the engineering skills taxonomy that
everything else references. It's the survey before the expedition.

### Pathway — The Mountain Trail

**Codebase:** This is the `app/pathway/` application

**Concept:** A mountain range with a winding path leading through it — the
journey from where you are to where you want to be, through terrain that has
been charted by others.

```
      /\
     /  \    /\
    /    \  /  \
   /      \/    \
  ~~~~~~~~~~~~     ← winding trail at the base
```

**Specifications:**

- Two or three overlapping mountain peaks (triangular forms, varying heights)
- A winding path or trail line at the base, moving from left to right through
  the mountains
- The tallest peak is slightly left of center (asymmetric, natural)
- 2px black stroke, no fill
- The trail line is slightly thinner (1.5px) to differentiate from the mountain
  outlines

**What it communicates:** The career journey through challenging terrain.
Pathway provides the skills catalogue and career advice — it shows you the route
others have taken and helps you plot your own ascent.

### Guide — The Compass

**Codebase:** This application is yet to be implemented

**Concept:** A minimal compass — the tool that gives you bearing when you're
disoriented. Represents the AI agent that helps engineers find their way through
problems and onboarding.

```
        N
        │
   W ───┼─── E
        │
        S
```

**Specifications:**

- A circle (the compass housing)
- A prominent compass needle inside, pointing roughly north — rendered as a
  narrow diamond or elongated rhombus
- The north half of the needle is filled `--gray-900` (the only filled element
  in the icon system — a subtle emphasis)
- 2px black stroke
- Optional: small cardinal tick marks at N, E, S, W positions

**What it communicates:** Orientation and direction. The Guide doesn't carry you
— it shows you which way to go. The filled north arrow subtly implies AI (a
"smart" element within an analog tool). Guide is the AI onboarding assistant and
career advisor.

### Basecamp — The Tent

**Codebase:** This is the `app/basecamp/` application

**Concept:** A simple A-frame tent seen from the front — the place where you
prepare, debrief, store your gear, and share what you've learned.

```
      △
     / \
    /   \
   /  ┃  \
  /___┃___\
```

**Specifications:**

- Equilateral triangle (tent body)
- Small vertical rectangle at center-bottom (tent entrance/door)
- Sits on a ground line
- Optional: tiny flag or pennant on the apex (adds character)
- 2px black stroke, no fill

**What it communicates:** Shelter, preparation, shared space. Basecamp is where
knowledge lives — it's the team's and individual's home base. The tent is
temporary and portable, reflecting that knowledge management should travel with
you, not be locked in a system somewhere.

### Icon System Rules

| Rule        | Specification                                                                       |
| ----------- | ----------------------------------------------------------------------------------- |
| Grid        | 24×24px with 2px padding (20px live area)                                           |
| Stroke      | 2px, round caps, round joins                                                        |
| Fill        | None, except the Guide's compass needle (north half)                                |
| Color       | `--gray-900` default, `--gray-400` when inactive                                    |
| Ground line | 1px stroke, extends to icon edges, sits 2px from bottom (Pathway and Basecamp only) |
| Style       | Hand-drawn feel — corners are slightly imperfect, lines have micro-variation        |
| Sizes       | 24px (inline), 32px (nav), 48px (cards), 96px (marketing)                           |

### Combined Icon: The Suite Mark

When all four products need to appear together (marketing, suite overview):

```
 ┌──┬──┐       /\              N        △
 │ /│× │      /  \  /\         │       / \
 │/ │  │     /    \/  \    ───┼───   /___\
 └──┴──┘    ~~~~~~~~~~~~       │
   Map        Pathway        Guide   Basecamp
```

Four icons in a row on a shared ground line, evenly spaced. The ground line
connects them — they're part of the same landscape.

---

## 7. Spacing System

### Base Unit: `8px`

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

### Whitespace Philosophy

Inherit the Ollama/Moondream generosity. Specific guidelines:

- **Hero top padding**: `128px` from nav to first content element. Yes, really.
- **Between hero heading and subtitle**: `24px`
- **Between subtitle and CTAs**: `40px`
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
| Product page header   | `720px`   |

---

## 8. Layout Patterns

### Suite Landing Page (forwardimpact.team)

```
┌──────────────────────────────────────────────┐
│                                              │
│  [Trio logo]  FIT            [Nav]     [☰]  │
│                                              │
│                                              │
│                                              │
│       ┌──────────────────────────┐           │
│       │  Trio at Work scene      │           │
│       │  (all three with laptops │           │
│       │   + four icons below)    │           │
│       └──────────────────────────┘           │
│                                              │
│     Forward deployed engineers               │  ← Instrument Serif, centered
│     need better tools.                       │
│                                              │
│     Chart skills. Navigate careers.          │  ← DM Sans, gray-400, centered
│     Solve problems. Share what you learn.    │
│                                              │
│           [ Explore the suite → ]            │
│                                              │
│                                              │
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│
│  │ 🗺 map │ │ ⛰ mtn │ │ 🧭 cmp │ │ ⛺ tnt ││
│  │        │ │        │ │        │ │        ││
│  │  Map   │ │Pathway │ │ Guide  │ │Basecamp││
│  │        │ │        │ │        │ │        ││
│  │ Chart  │ │Navigate│ │ AI     │ │Personal││
│  │ skills │ │skills &│ │onboard-│ │& team  ││
│  │ data   │ │careers │ │ing &   │ │know-   ││
│  │ model  │ │        │ │advice  │ │ledge   ││
│  │        │ │        │ │        │ │        ││
│  │[Learn→]│ │[Learn→]│ │[Learn→]│ │[Learn→]││
│  └────────┘ └────────┘ └────────┘ └────────┘│
│                                              │
├──────────────────────────────────────────────┤
│                                              │
│  Background: contour line texture            │
│                                              │
│     "Forward deployed engineers              │  ← Instrument Serif
│      operate where technology                │
│      meets the real world."                  │
│                                              │
│     ┌────────────────────────────┐           │
│     │  Charting the Territory    │           │
│     │  scene (trio around map)   │           │
│     └────────────────────────────┘           │
│                                              │
│     Copy explaining the FDE concept          │
│     and how this suite supports it...        │
│                                              │
├──────────────────────────────────────────────┤
│                                              │
│     [ Create your free account ]             │
│                                              │
│  © Forward Impact Team                       │
└──────────────────────────────────────────────┘
```

### Product Page Pattern (e.g., Pathway)

```
┌──────────────────────────────────────────────┐
│  [Trio]  FIT  / Pathway          [Nav] [☰]  │
├──────────────────────────────────────────────┤
│                                              │
│     ┌────────────────────────────┐           │
│     │  Plotting the Ascent scene │           │
│     │  (trio at mountain base)   │           │
│     └────────────────────────────┘           │
│                                              │
│     Pathway                                  │  ← Instrument Serif
│                                              │
│     Navigate engineering skills              │  ← DM Sans, gray-400
│     and careers with clarity.                │
│                                              │
│     [ Get started ]  [ Documentation ]       │
│                                              │
├──────────────────────────────────────────────┤
│                                              │
│     Feature sections with character          │
│     illustrations in context...              │
│                                              │
└──────────────────────────────────────────────┘
```

### Navigation Pattern

The nav includes a **suite switcher** — a way to move between products:

```
[Trio icon]  FIT   |   Map  ·  Pathway  ·  Guide  ·  Basecamp       [Docs]  [Sign in]
```

The current product is bold weight (`700`). Others are regular weight (`400`) in
`--gray-400`. The `|` divider separates the suite name from the product names.
On mobile, the product switcher moves into the hamburger menu.

---

## 9. Components

### Buttons

| Variant       | Background   | Border                   | Text               | Radius  | Padding     |
| ------------- | ------------ | ------------------------ | ------------------ | ------- | ----------- |
| **Primary**   | `--gray-900` | none                     | `#ffffff`          | `999px` | `14px 28px` |
| **Secondary** | `--white`    | `1.5px solid --gray-200` | `--gray-900`       | `999px` | `14px 28px` |
| **Ghost**     | transparent  | none                     | `--gray-700` + `→` | —       | `0`         |
| **Product**   | `--white`    | `1.5px solid --gray-200` | `--gray-900`       | `12px`  | `14px 24px` |

- All buttons use DM Sans at `15px`, weight `500`
- Primary hover: lighten to `--gray-700`
- Secondary hover: background fills to `--gray-50`
- Pill radius (`999px`) for marketing/hero CTAs; `12px` radius for in-app
  actions
- Ghost buttons always include an arrow (`→`) and are used for tertiary actions

### Cards

| Property      | Value                                                          |
| ------------- | -------------------------------------------------------------- |
| Background    | `--white` (on warm section bg) or `--white-warm` (on white bg) |
| Border        | `1.5px solid --gray-200`                                       |
| Border radius | `16px`                                                         |
| Padding       | `32px`                                                         |
| Hover         | Border shifts to `--sand-200`, subtle `translateY(-2px)`       |
| Shadow        | None at rest; `0 4px 12px rgba(28, 26, 24, 0.04)` on hover     |

### Product Cards (Suite Landing)

Larger cards for the four products, arranged in a 4-column grid (2×2 on tablet,
stacked on mobile), each featuring:

- Product icon (48px) top-left
- Product name in DM Sans 600, 20px
- One-line description in `--gray-400`
- "Learn more →" ghost link at bottom
- On hover: the icon gets a subtle wiggle animation (tiny rotation ±3°, 300ms)

### Announcement Pill

Following the Moondream pattern but in warm monochrome:

```
[ New    Map data model is live   → ]
```

| Property           | Value                    |
| ------------------ | ------------------------ |
| Background         | `--sand-50`              |
| Border             | `1.5px solid --sand-200` |
| Border radius      | `999px`                  |
| "New" badge bg     | `--gray-900`             |
| "New" badge text   | `#ffffff`                |
| "New" badge radius | `999px`                  |
| Link text          | `--gray-700`             |
| Arrow              | `→` in `--gray-400`      |
| Padding            | `4px 20px 4px 4px`       |

### Terminal / Code Blocks

Dark blocks for CLI examples and code:

| Property      | Value                                |
| ------------- | ------------------------------------ |
| Background    | `--gray-900` (`#1c1a18`) — warm dark |
| Text          | `#e8e5e0` (warm light)               |
| Prompt        | `❯` in `--sand-400`                  |
| Comment text  | `--gray-400`                         |
| Border radius | `12px`                               |
| Padding       | `24px`                               |
| Border        | none                                 |

The warm dark background (`#1c1a18` instead of pure `#1a1a1a`) maintains the
warm-monochrome feel even in inverted blocks.

### Contour Line Texture

A subtle background pattern used on alternate sections:

```css
.contour-bg {
  background-image: url("data:image/svg+xml,...");
  /* Repeating thin wavy lines in --gray-100 (#eae8e4) on --white-warm (#faf9f7) */
  /* Lines are 1px stroke, spaced 40px apart */
  /* Opacity: 0.3 — barely visible, felt more than seen */
  background-size: 400px 400px;
}
```

The contour lines are never on white backgrounds — only on `--white-warm` or
`--sand-50` sections. They reinforce the terrain metaphor without becoming a
theme.

---

## 10. Motion & Interaction

| Element                       | Animation                                                                                                                                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Page load**                 | Hero elements fade up with stagger: scene illustration (0ms) → heading (100ms) → subtitle (200ms) → CTAs (300ms). Duration 500ms, ease-out.                                                                             |
| **Trio illustration**         | On hero: subtle idle animation — slight independent sway per character (CSS `translateY` ±2px, staggered timing: 3s / 3.4s / 2.8s, infinite). They move slightly out of sync, like real people shifting in their seats. |
| **Product card hover**        | Icon rotates ±3° (wiggle), card lifts 2px, border warms to `--sand-200`. 200ms ease.                                                                                                                                    |
| **Button hover**              | Background color transition, 150ms. Primary adds subtle warm shadow: `0 2px 8px rgba(28, 26, 24, 0.12)`.                                                                                                                |
| **Section enter**             | Elements fade up on scroll-enter. Subtle — `translateY(16px)` → `0`, opacity `0` → `1`, 400ms.                                                                                                                          |
| **Terminal blocks**           | Optional: simulated typing for CLI examples on the marketing site. Cursor blink at 700ms.                                                                                                                               |
| **Navigation product switch** | Underline slides to active product, 200ms ease-in-out.                                                                                                                                                                  |

Motion is restrained. The trio's idle sway is the most noticeable animation, and
even that is subtle — three people unconsciously shifting weight while working.
Everything else is functional transitions.

---

## 11. Page-Level Compositions

### Warm/Cool Section Rhythm

Alternate between white and warm-tinted sections to create visual rhythm without
color:

```
Section 1: white (#ffffff) bg          — Hero (scene illustration + headline)
Section 2: warm (#faf9f7) bg           — Product cards (4-up grid)
Section 3: white (#ffffff) bg           — Feature deep-dive
Section 4: warm (#faf9f7) + contours   — Quote / philosophy (with Charting scene)
Section 5: white (#ffffff) bg           — CTA / sign-up
Footer:    gray-900 (#1c1a18) bg       — Dark footer (inverted)
```

The alternation is subtle — a viewer might not consciously notice the warm/cool
shift, but they'll feel the sections as distinct. The dark footer creates a
strong "end" to the page.

### Footer (Dark)

The footer inverts the palette:

| Property         | Value                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| Background       | `--gray-900`                                                           |
| Text (primary)   | `#e8e5e0` (warm light)                                                 |
| Text (secondary) | `--gray-400`                                                           |
| Border           | `--gray-700` for dividers                                              |
| Logo             | Trio silhouette icon in white (inverted) + "FIT" in DM Sans 700, white |

This mirrors the terminal blocks and creates a satisfying bookend: the page
begins with white space and ends with warm dark.

---

## 12. Product-Specific Visual Language

While the four products share the core design system, each has subtle
differentiators:

### Map (Engineering Skills Data Model)

| Element                  | Treatment                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Accent metaphor          | Cartography and survey — grid lines, coordinates, territory markers                |
| Hero scene               | Charting the Territory — trio kneeling around the unfolded map                     |
| Empty state illustration | AI Agent holding a blank map, tilting it toward the viewer                         |
| Feature icons            | Grid overlays, pin markers, fold lines, legend keys                                |
| Data visualization       | Map-like layouts for skill taxonomies — nodes connected by paths on a terrain grid |
| Tone                     | "Chart the territory before you move through it."                                  |

### Pathway (Skills Catalogue & Career Advice)

| Element                  | Treatment                                                                    |
| ------------------------ | ---------------------------------------------------------------------------- |
| Accent metaphor          | Elevation and ascent — mountain trails, altitude markers, switchbacks        |
| Hero scene               | Plotting the Ascent — trio at the base of mountains, studying the trail      |
| Empty state illustration | Engineer standing alone at a trailhead, looking up at the peaks              |
| Feature icons            | Mountain peaks, winding trails, elevation markers, cairns                    |
| Progress indicators      | Elevation bar (vertical, filling upward) rather than horizontal progress bar |
| Tone                     | "Where are you going? Let's map the route."                                  |

### Guide (AI Onboarding & Career Advice)

| Element                  | Treatment                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Accent metaphor          | Navigation and bearing — compass, stars, sightlines                                                |
| Hero scene               | Finding North — trio gathered around the AI Agent's compass                                        |
| Empty state illustration | AI Agent holding the compass toward the viewer, as if offering it                                  |
| Feature icons            | Compass needle, signal beacon, waypoint pin                                                        |
| AI response styling      | Slightly indented with a faint left-border in `--sand-200` (like a margin note in a field journal) |
| Tone                     | "I can help you find your bearings."                                                               |

### Basecamp (Personal & Team Knowledge Management)

| Element                  | Treatment                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Accent metaphor          | Shelter and shared space — tents, campfire circles, logbooks                       |
| Hero scene               | Setting Up Camp — trio assembling the tent together                                |
| Empty state illustration | Completed tent with the flag on top, door flap open, inviting                      |
| Feature icons            | Tent, logbook, campfire (circle of dots), map pin                                  |
| Document styling         | Slightly warm-tinted card backgrounds (`--sand-50`) suggesting pages in a notebook |
| Tone                     | "Everything you and your team know, in one place."                                 |

---

## 13. Character & Scene Guidelines

### When to Use Scenes vs. Icons

| Context                     | Use                                                       | Rationale                             |
| --------------------------- | --------------------------------------------------------- | ------------------------------------- |
| Product landing page hero   | Full scene                                                | Maximum storytelling impact           |
| Suite landing page hero     | Trio at Work or Welcome Wave scene                        | Sets the collaborative tone           |
| Product cards on suite page | Product icon only                                         | Clean, scannable at small size        |
| In-app empty states         | Simplified scene or single character                      | Lightweight, not overwhelming         |
| Navigation / header         | Trio silhouette or product icon                           | Compact, functional                   |
| Documentation pages         | Documentation Dig scene (header) + product icons (inline) | Friendly entry point, clean reference |
| Error states                | Single character looking puzzled                          | Human, sympathetic                    |
| Loading states              | AI Agent with spinning compass                            | Signals processing                    |

### Character Don'ts

- **Never show the characters in conflict** — they're always collaborative, even
  when problem-solving
- **Never make the AI Agent dominant** — it's an equal partner, seated at the
  same table, not floating above
- **Never remove the Engineer's hoodie ears** — they're the key identifier at
  all sizes
- **Never put a backpack on the Stakeholder** — the absence of a backpack is
  their distinguishing trait
- **Never render in color** — the monochrome line-art style is the system. Add
  gray fills for clothing differentiation, never hues
- **Never show them without laptops in the Trio at Work pose** — the laptops are
  tools of the trade, always present in seated poses
- **Never add background scenery to scenes** — objects (maps, compass, tent,
  papers) exist in the scene; landscapes, trees, clouds, and horizon lines do
  not (except the Pathway mountains, which are part of the product symbol). The
  white background is the canvas.
- **Never outline or frame a scene** — no boxes, borders, or background panels.
  Scenes float freely in whitespace.

---

## 14. Accessibility Notes

Monochrome systems have specific accessibility considerations:

| Concern                   | Solution                                                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Color-only indicators** | Not a problem — the system is monochrome by design, so all indicators use shape, size, weight, or position                                                                                                                           |
| **Contrast ratios**       | `--black` on `--white` = 21:1. `--gray-500` on `--white` = 5.7:1 (passes AA). `--gray-400` on `--white` = 4.1:1 (passes AA for large text only — use for subtitles, not body)                                                        |
| **Focus states**          | 2px solid `--gray-900` outline with 2px offset. High contrast, unmissable.                                                                                                                                                           |
| **Motion sensitivity**    | All animations respect `prefers-reduced-motion`. Trio idle animation and scroll reveals are disabled; functional transitions remain.                                                                                                 |
| **Dark mode**             | Invert the system — `--gray-900` becomes the page background, `--white-warm` becomes the text. The sandstone tones shift accordingly. The character illustrations invert to white-on-dark line art.                                  |
| **Scene alt text**        | All scene illustrations include descriptive alt text identifying the three roles and the action: e.g. "An engineer in a hoodie, an AI robot, and a business professional kneel around a large unfolded map, tracing routes together" |

---

## 15. Design Tokens (Implementation Reference)

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

## 16. Summary: What Makes This System Distinct

| Trait               | FIT Suite                                              | Ollama / Moondream          | GoReleaser / Appwrite                      |
| ------------------- | ------------------------------------------------------ | --------------------------- | ------------------------------------------ |
| **Canvas**          | Warm white                                             | Pure white                  | Dark                                       |
| **Accent strategy** | Warm neutral (sandstone) as ambient tone               | None                        | Blue or Pink as active accent              |
| **Display type**    | Serif (Instrument Serif)                               | Sans-serif                  | Sans-serif                                 |
| **Body type**       | DM Sans                                                | System / Inter              | System / Inter                             |
| **Characters**      | Three-character team (Engineer, AI Agent, Stakeholder) | Solo animal / abstract face | Solo animal (GoReleaser) / None (Appwrite) |
| **Scene system**    | 7 narrative scenes with characters + product symbols   | N/A                         | N/A                                        |
| **Icon system**     | Hand-drawn terrain objects (4 products)                | N/A                         | Standard SVG                               |
| **Texture**         | Contour line patterns                                  | None                        | None                                       |
| **Motion**          | Restrained + trio idle sway                            | Minimal                     | Minimal to moderate                        |
| **Footer**          | Dark (inverted)                                        | Light                       | Dark                                       |
| **Section rhythm**  | White ↔ Warm alternation                               | White throughout            | Dark throughout                            |
| **Products**        | Map · Pathway · Guide · Basecamp                       | Single product              | Single product                             |

The serif display type and warm neutral tones are the primary differentiators.
They position FIT as professional and editorial — more "thoughtful journal" than
"developer tool homepage." The three-character scene system is the real
signature: where other developer tools use a solo mascot animal, FIT shows a
team solving problems together. Each scene tells a story about how engineering,
AI, and business domain expertise converge — and the product symbols (map,
mountains, compass, tent) give those stories a physical, tactile anchor on the
white canvas.

---

_Design spec for the Forward Impact Team (FIT) product suite. February 2026._
