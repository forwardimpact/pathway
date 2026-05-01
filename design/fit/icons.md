# FIT Product Icons

24px grid, 2px stroke, no fill — matching the characters' line weight. Should
feel drawn in the same notebook.

For the FIT brand context — palette, typography, product taxonomy — see
[index.md](index.md). For product scenes that compose these icons with the three
characters, see [scenes.md](scenes.md).

---

## Map — The Unfolded Map

```
  ┌─────┬─────┐
  │  ·  │     │
  │ / \ │  ×  │   ← route line with marker
  │/   \│     │
  └─────┴─────┘
```

Folded paper map, partially unfolded, with route line and position marker. The
territory mapped out before you move through it — Map is the central data store,
the single source of truth. Everything else references Map.

## Pathway — The Switchback Trail

```
         ╱ ─ ╲
    ╱ ─ ╱     ╲
   ╱   ╱       ╲
  ~~~~~~~~~~~~     ← winding trail with switchbacks
```

A winding trail with switchbacks and elevation markers — no mountain peaks.
Trail line slightly thinner (1.5px). The career journey through challenging
terrain — shows the route others have taken and helps you plot your own path.
Peaks belong to Summit; Pathway owns the trail.

## Guide — The Compass

```
        N
        │
   W ───┼─── E
        │
        S
```

Circle housing with compass needle. North half filled `--gray-900` — the only
filled element in the icon system. Orientation and direction — the Guide doesn't
carry you, it shows you which way to go. The filled north arrow subtly implies
AI (a "smart" element within an analog tool).

## Landmark — The Cairn

```
      ┃╲
     ┌┸─┐
    ┌────┐
   ┌──────┐
  ┌────────┐
  ──────────
```

Four or five stacked flat stones, tapered tower, with pennant flag at apex. Sits
on a ground line. Slightly irregular edges for hand-drawn feel. Observation,
measurement, and reference points — the cairn is human-made (not natural), just
as Landmark's analysis derives meaning from collected data.

## Summit — The Peak

```
      ⛳
      /\
     /  \   /\
    /    \ /  \
   /      \/    \
```

Two overlapping mountain peaks, the taller one in front with a small pennant
flag at the apex. Clean triangular shapes. No fill (consistent with other
icons). The peak is a collective goal — not individual achievement, but the
capability the team is trying to reach together.

**Flat variant:** Single peak with flag. Simplified for favicons and tab bars.

## Outpost — The Tent

```
      △
     / \
    /   \
   /  ┃  \
  /___┃___\
```

Equilateral triangle with vertical rectangle entrance at center-bottom. Sits on
a ground line. Shelter, preparation, shared space — the tent is temporary and
portable, reflecting that knowledge management should travel with you.

## Gear — The Carabiner

```
   ╭───╮
  ╱     ╲
 │ ┃     │
 │ ┃     │   ← gate runs along the inside edge
 │       │
  ╲     ╱
   ╰───╯
```

Asymmetric oval (taller than wide), with a short vertical gate line set just
inside the long-axis edge — the spring-loaded opening. A tiny notch at the top
where the gate meets the body suggests the hinge. No fill, consistent with the
icon system. The carabiner is the metaphor for a modular field kit — clip on
what you need, drop what you don't. Each library in the Gear catalog is a
clip-on tool; the registry is the ring.

---

## Icon System Rules

| Rule        | Specification                                                 |
| ----------- | ------------------------------------------------------------- |
| Grid        | 24×24px with 2px padding (20px live area)                     |
| Stroke      | 2px, round caps, round joins                                  |
| Fill        | None, except Guide's compass needle (north half)              |
| Color       | `--gray-900` default, `--gray-400` when inactive              |
| Ground line | 1px stroke at bottom (Pathway, Landmark, Summit, Outpost)     |
| Style       | Hand-drawn feel — slightly imperfect corners, micro-variation |
| Sizes       | 24px (inline), 32px (nav), 48px (cards), 96px (marketing)     |

## Combined Icon: The Suite Mark

```
 ┌──┬──┐      ╱─╲             N         ┃╲         ⛳/\        △        ╭──╮
 │ /│× │     ╱   ╲            │        ┌┸─┐       /  \      / \       │╱  │
 │/ │  │    ~~~~~~~~~~~~  ───┼───    ┌────┐     /    \    /___\       │   │
 └──┴──┘                      │      ──────    /      \                ╰──╯
   Map       Pathway       Guide   Landmark   Summit   Outpost     Gear
```

Seven icons on a shared ground line, evenly spaced.
