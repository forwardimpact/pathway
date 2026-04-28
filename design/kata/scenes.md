# Kata Product Scenes

These scenes extend the
[reusable base scenes](../index.md#4-reusable-base-scenes) with Kata
production-floor symbols. All follow the [scene grammar](../index.md#3-scene-grammar):
2px monochrome line art on a clean white background.

For the Kata brand context — palette, typography, agent taxonomy — see
[index.md](index.md).

A note on the **Stakeholder's cap.** In Kata scenes the Stakeholder may wear
a soft flat cap (the Ohno cap) when on the shop floor — a brand-context
accessory layered over the family character's standard suit-and-tie. The
cap does not replace any inherited trait; it sits on top of "neat hair" the
way a real cap would. In scenes set off-floor (welcome, documentation), the
cap may be absent.

---

## Scene: Storyboard Stand-up — The Hero Scene

**Context:** Kata internals page hero
(`websites/fit/docs/internals/kata/`), daily storyboard documentation,
the default hero for any Kata-branded surface.

Trio standing in front of a tall storyboard panel mounted on the wall — a
horizontal wire runs across it with kanban cards clipped on by clothes-pegs.
The board has three lanes (To Do · Doing · Done) labelled in slab serif. AI
Agent center, holding a pointer to a card on the wire, head angled at the
board with mechanical attention. Engineer left, hoodie ears bouncing,
half-turned with one hand already reaching for a card to move it — eager,
moving the card before the question has finished being asked. Stakeholder
right in flat cap and tie, hands clasped behind their back, leaning slightly
forward, studying — the foreman who has run this meeting a thousand times.

```
    ┌────────────────────────┐
    │ TO DO │ DOING │ DONE   │  ← storyboard
    │  ▢ ▢  │  ▢    │  ▢ ▢   │
    │  ▢    │       │  ▢     │
    └────────────────────────┘
       🐰      🤖       👔
       (reach) (point)  (cap, hands clasped)
```

**Key details:** The three speeds again — Engineer already moving the card,
Agent still pointing at it, Stakeholder in no hurry to interrupt either.
The storyboard is the visual anchor: cards on a wire say "this is a working
board, not a slide deck." Stakeholder's cap is the brand mark — calm
authority of someone who has stood here every morning for years.

---

## Scene: Walking the Gemba

**Context:** "How a daily kata runs" page, agent profile pages, default
brand scene below the hero.

Trio walking the floor in single file along an implied line, AI Agent in
front holding a clipboard at chest height, Engineer in the middle craning
to read over Agent's shoulder, Stakeholder at the rear in cap and tie,
hands behind their back, gaze tracking outward toward the floor — not at
the clipboard. A few floor markings (taped lanes, station numbers) imply
the gemba beneath their feet.

```
    🤖 ────→ 🐰 ────→ 👔
    📋        ↗       (cap, hands behind back)
    └─── floor markings ───┘
```

**Key details:** The procession is the frame. Agent leads with the data,
Engineer chases the data, Stakeholder watches the work itself — the gemba
walk principle: the floor tells you more than the report. Three different
focal points (paper, screen, work) in one straight line.

---

## Scene: The Ohno Circle

**Context:** Improvement Coach product page, coaching session
documentation, kata-session skill page.

A chalk circle drawn on the floor — clearly hand-drawn, slightly irregular,
about character-width. Stakeholder stands inside it, cap pulled slightly
forward, arms folded, simply observing — feet planted, in no rush to leave
the circle. Engineer crouches just outside the circle, peering in with
exaggerated curiosity, hoodie ears tilted — "what are you looking at?" AI
Agent stands a respectful step further back, holding a notebook open,
recording.

```
       🐰 (crouching, peering in)
        ↘
       ╭─────╮
       │  👔  │  ← Stakeholder in chalk circle
       ╰─────╯
              🤖📓 (recording)
```

**Key details:** The circle is the icon and the scene. Stakeholder's
posture — relaxed, observing — is the entire coaching kata in one frame.
Engineer's curiosity is the audience surrogate ("why are they just
standing there?"). Agent's notebook captures everything Stakeholder is
choosing not to say.

---

## Scene: The Andon Cord

**Context:** Security Engineer product page, vulnerability response
documentation, "stop the line" coaching moments.

A vertical cord hangs from above with a pull-handle at character height.
Engineer has both hands wrapped around the cord, leaning into it with full
weight — clearly _has_ pulled it, not is _about to_. AI Agent stands beside
them, one hand half-raised — caught between approval and assessment.
Stakeholder steps in from the right, cap slightly tilted, one hand raised
in a calm "okay, talk me through it" gesture — not annoyed, not rushed.

```
           ┃
           ┃  ← andon cord
           ┃
       🐰 ━┛
       (pulling)   🤖   👔  (cap, palm up)
                  (paused) "what did you see?"
```

**Key details:** The frame is "stopping the line is a normal Tuesday." No
alarm; no panic. Engineer pulled because something looked wrong; Agent is
already cross-referencing; Stakeholder is treating it as a coaching
moment. The cord is the only vertical element — visually emphatic, like a
plumb line.

---

## Scene: The Merge Gate

**Context:** Product Manager product page, issue and PR triage
documentation, agent-conversation workflow.

A horizontal kanban wire runs left-to-right, ending in a wooden **gate**
at the right edge — a small swing-gate, hip-height, with a hanko stamp
hanging from a string beside it. Cards clothes-pegged along the wire.
Engineer stands at the wire's left end, already pinning a freshly written
card — leaning in too close, clearly wrote it five minutes ago and wants
it on the line _now_. AI Agent stands center, examining a card pinched
between thumb and forefinger, head tilted at the spec. Stakeholder stands
**at the gate**, cap on, holding a single card up to read it — the hanko
stamp in the other hand, inkpad ready. The card goes through the gate
only if it's stamped.

```
    🐰 ▢ ─── ▢ ─── 🤖[▢] ─── ▢ ─── 👔 │ →   ✓
    (pin new)    (examine)         (cap, stamp)│  past the gate
    ──────────────────────────────────────────┤
                                          gate post
```

**Key details:** This scene owns the **trust boundary** from
[KATA.md § Trust Boundary](../../KATA.md#trust-boundary). Three roles
around the wire — intake, review, gate — but only one of them stamps.
The hanko in Stakeholder's hand is the only `--ink-400` element in the
scene; the gate is unambiguous; the line moves only past the stamp. Cards
on a wire is unmistakably mid-century: kanban literally means "signal
card." The horizontal wire becomes the page's compositional spine —
orderly, left-to-right, unmistakably a line moving — but it terminates,
deliberately, in a decision.

---

## Scene: The Drafting Bench

**Context:** Staff Engineer product page, spec → design → plan
documentation, plan execution flow.

Trio gathered around a slanted drafting bench. A large sheet (the plan) is
weighted down with a set-square at one corner and a coffee cup at another.
AI Agent leans over the sheet on Agent's right, ruler in one hand, finger
tracing a line. Engineer stands at the foot of the bench, both hands
planted on the lower edge of the sheet, leaning forward — about to either
ship it or cross it out. Stakeholder, cap and tie, is half-seated on a
stool at the bench's right end, glasses pushed up onto the cap, reading
the spec annotations in the margin.

```
        📐
       ┌────────────┐
       │ ▱ plan     │  ← drafting bench
       │ ──────     │
       │ ──── 🤖    │
       │ 🐰         │ 👔📝 (cap, glasses up, reading)
       └────────────┘
```

**Key details:** The drafting bench is the unmistakable workshop centerpiece
— set-square, sheet, coffee, marginalia. Three relationships to the plan:
Agent measuring it, Engineer ready to commit it, Stakeholder reading the
why. The set-square corner is the scene's icon-level anchor.

---

## Scene: The Shipping Bay

**Context:** Release Engineer product page, release readiness
documentation, kata-ship and kata-release-review skill pages.

A wooden crate sits center-frame, lid leaning beside it. A clipboard with
a manifest hangs on a nail to the right. Engineer crouches at the crate,
both hands on the lid, mid-action — closing it with body weight. AI Agent
stands beside the manifest, pen poised over a checkbox, head turned toward
the crate to confirm it's actually closed before the box gets ticked.
Stakeholder, cap on, leans against the wall behind, holding a stamp and an
inkpad — waiting for the manifest to come back signed before stamping the
crate.

```
                 📋 (manifest)
                 │
        ┌───────┐│  🤖🖊
        │ CRATE │
        │       │       👔🔴  (cap, stamp + ink)
        │   🐰  │
        └───────┘
       (closing lid)
```

**Key details:** The frame is the relay — close, sign, stamp. Three
hand-off points, each one a checkpoint. The hanko stamp in Stakeholder's
hand is the only `--ink-400` element in the scene, the only red dot on a
black-and-white page. That's the brand motif, distilled.

---

## Scene: The Trace Tape

**Context:** Improvement Coach trace-analysis pages, `kata-trace`
documentation, grounded-theory coding flows, post-run review.

A long strip of tractor-feed printer paper unspools from a wall-mounted
spool at the upper-left of the scene and runs diagonally across the floor —
the trace. The tape is marked at intervals with small horizontal rules
(turns) and tiny stamped icons (tool calls). Stakeholder, cap on,
crouches beside the tape with a magnifying glass, eyes following one
specific line — coding the trace by hand. AI Agent stands further along
the tape, holding a clipboard with a tally sheet, marking codes as
Stakeholder reads them out. Engineer is up on the spool side, lifting a
fresh fold of tape from the floor — keeping the read-head clear, eager
to see what comes next.

```
    🐰 (lifting fresh tape)
       ╲
        ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  ← tractor-feed tape
        │  │  │  │  │  │  │  │  │
        ↓                  ↓
        👔🔍               🤖📋
        (coding)          (tallying)
```

**Key details:** The tape is the visual anchor — trace data made physical,
flowing across the floor like a 1960s mainframe printout. Three roles to
the same record: the eye that reads, the hand that codes, the helper that
keeps the paper moving. The diagonal sweep of the tape across the
composition is the scene's distinguishing geometry — every other Kata
scene is composed horizontally; the trace cuts across.

## Scene: The Archivist's Desk

**Context:** Technical Writer product page, wiki curation documentation,
kata-documentation and kata-wiki-curate skill pages.

A wooden desk with a manila folder open, a fountain pen lying across it,
and a stack of weekly logs. AI Agent sits at the desk, feet flat, posture
perfect, fountain pen in hand mid-stroke, copying entries into a ledger.
Engineer sits cross-legged on top of the desk's right corner — perched
where a chair should be — reading a log upside-down with sincere
concentration. Stakeholder stands behind the desk, cap on, one hand
resting on the desk edge, dictating a sentence — the others writing it
down.

```
       👔  (cap, dictating)
       ──────────────
       │  manila folder  │
       │  ✒  ledger ─────│  ← desk
       │     🤖   📜🐰   │
       │     (writing)  (perched, reading upside-down)
       └─────────────────┘
```

**Key details:** Three relationships to the written record: Agent
transcribes it precisely, Engineer reads it sideways (and somehow gets the
gist), Stakeholder dictates the canonical version. The fountain pen and
the manila folder anchor the era — pre-keyboard, but disciplined.

---

## Scene Usage Matrix

| Context                       | Scene                  | Size      |
| ----------------------------- | ---------------------- | --------- |
| Internals page hero           | Storyboard Stand-up    | 400–480px |
| "How a daily kata runs" intro | Walking the Gemba      | 320–400px |
| Onboarding — first screen     | Welcome Wave (base)    | 320–400px |
| Onboarding — getting started  | Documentation Dig (base)| 280–360px|
| Staff Engineer hero           | The Drafting Bench     | 320–400px |
| Release Engineer hero         | The Shipping Bay       | 320–400px |
| Security Engineer hero        | The Andon Cord         | 320–400px |
| Product Manager hero          | The Merge Gate         | 320–400px |
| Technical Writer hero         | The Archivist's Desk   | 320–400px |
| Improvement Coach hero        | The Ohno Circle        | 320–400px |
| `kata-trace` documentation    | The Trace Tape         | 320–400px |
| Persona cards (suite page)    | Agent scenes (cropped) | 120–160px |
| Error / empty states          | Single character       | 80–120px  |
| Loading states                | PDSA wheel + clipboard | 48–80px   |

**Asset status:** The Kata scene set is specified above but not yet
illustrated. They should follow the same 2px monochrome line-art style as
the FIT scenes, with the addition of the Stakeholder's flat cap when on the
shop floor.
