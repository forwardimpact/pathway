# Kata Agent Icons

24px grid, 2px stroke, no fill — matching the characters' line weight. Should
feel stamped into the same logbook as the trio.

For the Kata brand context — palette, typography, agent taxonomy — see
[index.md](index.md). For agent scenes that compose these icons with the three
characters, see [scenes.md](scenes.md).

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

A right-angle set-square (drafting triangle) resting on an implied bench. Two
clean perpendicular legs, one diagonal hypotenuse. The drafting tool that makes
plans buildable — the Staff Engineer's discipline of turning spec into design
into plan, without wishing the geometry away.

## Release Engineer — The Stamped Crate

```
   ┌──────────┐
   │  ╲╱      │
   │  ╱╲      │  ← hanko stamp on lid
   │          │
   │  ▔▔▔▔▔  │
   └──────────┘
```

A wooden shipping crate viewed three-quarters, with a small circular hanko stamp
mark on the lid. The stamp is the only filled element in the icon system —
`--ink-400` on white. The crate is sealed; the manifest is signed; the line
moves on time.

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
hollow circle (the eye). Two cuts on the bit. Evokes the night watchman's ring —
the Security Engineer's discipline of locking what should be locked and walking
past what shouldn't.

## Product Manager — The Merge Gate

```
   ──┯━━━━━━┯━━━━━━┯─── │ →   ✓
     ▢      ▢      ▢[●] │
     ▢             ▢    │
     ▢                  │  ← gate post
                        ─
```

A horizontal kanban wire with three cards pegged from it at varying depths,
terminating at the right in a small upright gate post. The rightmost card
carries a single circular hanko mark (`--ink-400`) — the "approved" stamp on the
card crossing the gate. The wire extends slightly past the gate, but only the
stamped card crosses. Triage, review, gate — the three motions the Product
Manager makes, ending in the only decision that touches main.

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

A capped fountain pen viewed in profile, nib pointing down-right. The cap crown
sits flush with the barrel. The nib has a single visible slit. The instrument of
accurate, deliberate writing — the Technical Writer's tool for turning a week of
work into a paragraph that will still be true a year later.

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
slightly irregular line, micro-gaps in the stroke). A horizontal floor line
beneath it grounds it on a surface. The circle is the coaching kata made
visible: stand here, watch the work, ask what changed.

A "completed coaching" state for storyboard rendering uses a second overlapping
circle stroke (a halo) — not a fill. The icon system's single-fill rule (the
Release Engineer's hanko) is preserved.

---

## Icon System Rules

| Rule        | Specification                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| Grid        | 24×24px with 2px padding (20px live area)                                                               |
| Stroke      | 2px, round caps, round joins                                                                            |
| Fill        | None, except the hanko stamp in `--ink-400` (Release Engineer's crate, Product Manager's approved card) |
| Color       | `--gray-900` default, `--gray-400` when inactive                                                        |
| Ground line | 1px stroke at bottom (Staff Engineer, Release Engineer, Coach)                                          |
| Style       | Hand-stamped feel — slightly irregular corners, micro-variation                                         |
| Sizes       | 24px (inline), 32px (nav), 48px (cards), 96px (marketing)                                               |

The hanko stamp is the only filled mark in the system — `--ink-400` on white,
appearing on the Release Engineer's crate (where the stamp is applied) and the
Product Manager's approved card (where the stamp has been earned). Same mark,
two placements — the two halves of the gate. This mirrors Forward Impact Engineering's single filled
element (the Guide compass north): one brand-specific warm-signal mark per icon
system, no other fills.

---

## Combined Icon: The Kata Suite Mark

```
   ╲          ┌────┐      ┌─┐     ──┯━━┯─[●]│   ╱│       ╱─╲
    ╲         │ ●  │     ┌┴─┴┐     ▢   ▢   │  ╱ │       │   │
   ┌─╲        │    │     │ ○ │              ── ┌┴┐      ╲─╱
   │  ╲       │    │     └┬─┬┘                 │ │      ───
   └───╲      └────┘      │                    └┬┘
                          ┝╾                    ╲
   Staff      Release     Security   Product    Writer    Coach
```

Six icons on a shared ground line, evenly spaced. Both the Release Engineer's
hanko stamp on the crate and the Product Manager's hanko on the approved card
use `--ink-400` — the same one mark, used twice (once where it's printed, once
where it's earned). The icon system retains its single-fill-color rule (only the
hanko ink) — though the hanko appears on two adjacent personas, signalling that
"stamped" and "shipped" are the two halves of the same gate.

---

## Suite Wordmark

The Kata wordmark sets the four letters **KATA** in Roboto Slab 700 with
generous letter-spacing (`0.18em`). Above the second `A` sits a small **PDSA
wheel** — the four-quadrant chalk circle defined in
[index.md § 3 The PDSA Wheel](index.md#the-pdsa-wheel) — sized at 0.5em. The
wheel acts as the brand's signature: a quiet visible reminder that every Kata
page is a turn of the cycle.

```
   K A T A
        ⊕     ← PDSA wheel (P · D · S · A clockwise)
```

When the wordmark sits beside the trio silhouette in headers and footers, the
silhouette is on the left, wordmark on the right, separated by 16px. The trio's
Stakeholder silhouette in this combined mark wears the flat cap — the only place
where a single element of the trio composition carries a brand-specific
accessory at signature scale.

At very small sizes (under 16px wordmark height), the PDSA wheel reduces to a
simple **stroke-only** circle in `--gray-700` — the quadrant marks are dropped,
but the no-fill icon rule is preserved. Below 8px wordmark height the wheel is
omitted entirely.
