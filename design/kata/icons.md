# Kata Agent Icons

24px grid, 2px stroke, no fill — matching the characters' line weight.
Should feel stamped into the same logbook as the trio.

For the Kata brand context — palette, typography, agent taxonomy — see
[index.md](index.md). For agent scenes that compose these icons with the
three characters, see [scenes.md](scenes.md).

---

## Staff Engineer — The Set-Square

```
       ╲
        ╲
   ┌─────╲
   │      ╲
   │       ╲
   │        ╲
   └─────────╲
```

A right-angle set-square (drafting triangle) resting on an implied bench.
Two clean perpendicular legs, one diagonal hypotenuse. The drafting tool
that makes plans buildable — the Staff Engineer's discipline of turning
spec into design into plan, without wishing the geometry away.

## Release Engineer — The Stamped Crate

```
   ┌──────────┐
   │  ╲╱      │
   │  ╱╲      │  ← hanko stamp on lid
   │          │
   │  ▔▔▔▔▔  │
   └──────────┘
```

A wooden shipping crate viewed three-quarters, with a small circular hanko
stamp mark on the lid. The stamp is the only filled element in the icon
system — `--ink-400` on white. The crate is sealed; the manifest is
signed; the line moves on time.

## Security Engineer — The Brass Key

```
       ┌─┐
      ┌┴─┴┐
      │ ○ │   ← key bow with eye
      └┬─┬┘
       │
       │
       ┝╾   ← key bit (teeth)
       ┝╾
       └
```

A vertical brass key, head up, teeth at the bottom. Round bow with a single
hollow circle (the eye). Two cuts on the bit. Evokes the night watchman's
ring — the Security Engineer's discipline of locking what should be locked
and walking past what shouldn't.

## Product Manager — The Kanban Rail

```
   ──┯━━━━━━┯━━━━━━┯──   ← horizontal wire
     ▢      ▢      ▢
     ▢             ▢
     ▢
```

A horizontal wire with three kanban cards pegged from it at varying
depths. Cards are square, pegs implied by a small mark at each top edge.
The wire extends slightly past the cards on either side — the line
continues. Triage, review, intake — the three motions the Product Manager
makes against the same rail.

## Technical Writer — The Fountain Pen

```
       ╱│
      ╱ │
     ╱  │   ← cap
    ──  │
       ┌┴┐
       │ │
       │ │  ← barrel
       │ │
       └┬┘
        ╲   ← nib
         ╲
```

A capped fountain pen viewed in profile, nib pointing down-right. The cap
crown sits flush with the barrel. The nib has a single visible slit. The
instrument of accurate, deliberate writing — the Technical Writer's tool
for turning a week of work into a paragraph that will still be true a year
later.

## Improvement Coach — The Ohno Circle

```
        ╱ ─ ─ ╲
      ╱         ╲
     │           │   ← chalk circle
      ╲         ╱
        ╲ ─ ─ ╱
       ━━━━━━━━━     ← floor line
```

A simple chalk circle drawn on the floor, intentionally hand-drawn (very
slightly irregular line, micro-gaps in the stroke). A horizontal floor
line beneath it grounds it on a surface. The circle is the coaching kata
made visible: stand here, watch the work, ask what changed.

**Filled variant:** A chalk-dust filled circle (`--gray-100`) for the
moment after the coach has stepped out — used for completed coaching
sessions in the storyboard.

---

## Icon System Rules

| Rule        | Specification                                                   |
| ----------- | --------------------------------------------------------------- |
| Grid        | 24×24px with 2px padding (20px live area)                       |
| Stroke      | 2px, round caps, round joins                                    |
| Fill        | None, except Release Engineer's hanko stamp (`--ink-400`)       |
| Color       | `--gray-900` default, `--gray-400` when inactive                |
| Ground line | 1px stroke at bottom (Staff Engineer, Release Engineer, Coach)  |
| Style       | Hand-stamped feel — slightly irregular corners, micro-variation |
| Sizes       | 24px (inline), 32px (nav), 48px (cards), 96px (marketing)       |

The single filled element in the system — the Release Engineer's hanko —
mirrors FIT's only filled element (the Guide compass north). One brand
mark per family per icon system: the warm signal showing through exactly
once.

---

## Combined Icon: The Kata Suite Mark

```
   ╲          ┌────┐      ┌─┐      ──┯━━┯──    ╱│       ╱─╲
    ╲         │ ●  │     ┌┴─┴┐      ▢   ▢    ╱ │       │   │
   ┌─╲        │    │     │ ○ │                 ┌┴┐      ╲─╱
   │  ╲       │    │     └┬─┬┘                 │ │      ───
   └───╲      └────┘      │                    └┬┘
                          ┝╾                    ╲
   Staff      Release     Security    Product   Writer    Coach
```

Six icons on a shared ground line, evenly spaced. The Release Engineer's
hanko stamp is the only filled mark in the row — the visual punctuation
mark that distinguishes Kata's suite mark from FIT's six-icon suite.

---

## Suite Wordmark

The Kata wordmark sets the four letters **KATA** in Roboto Slab 700 with
generous letter-spacing (`0.18em`). Optional: a small chalk-circle dot
above the second `A`, sized at 0.4em — the Improvement Coach motif acting
as a quiet brand signature on print materials and the dark footer.

```
   K A T A
        ·     ← optional chalk-circle accent
```

When the wordmark sits beside the trio silhouette in headers and footers,
the silhouette is on the left, wordmark on the right, separated by 16px.
The trio's Stakeholder silhouette in this combined mark wears the flat cap
— the only place where a single element of the trio composition carries a
brand-specific accessory at signature scale.
