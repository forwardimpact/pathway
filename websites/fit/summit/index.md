---
title: Summit
description: See team capability as a system — coverage, structural risks, what-if staffing scenarios, growth alignment, and quarterly trajectory from your engineering framework.
layout: product
toc: false
hero:
  image: /assets/scene-summit.svg
  alt: An engineer, an AI robot, and a business professional gather around a map on a flat rock, planning an ascent to the peak
  subtitle: Summit treats a team as a system, not a collection of individuals. It aggregates skill matrices into capability coverage, structural risks, and what-if staffing scenarios so leaders can build teams that succeed.
  cta:
    - label: View on GitHub
      href: https://github.com/forwardimpact/monorepo/tree/main/products/summit
    - label: View on npm
      href: https://www.npmjs.com/package/@forwardimpact/summit
      secondary: true
---

> Map defines skills. Pathway charts individual routes. Basecamp handles daily
> ops. But none of them answer the question engineering leaders ask most often:
> "Does this team have the capability to deliver what we need?" Summit makes
> that visible — not by ranking individuals, but by modelling the team as a
> system with structural properties.

### What you get

- **Capability coverage** — per-skill headcount at working+ across the team.
- **Structural risks** — single points of failure, critical gaps, concentration
  risks.
- **What-if scenarios** — simulate add / remove / move / promote before acting.
- **Growth alignment** — connect team gaps to individual development
  opportunities.
- **Compare** — diff two teams' coverage and risks side by side.
- **Trajectory** — quarterly capability evolution from git history of your
  roster file. Requires the roster file to be tracked in a git repository with
  commits spanning the period you want to analyze.
- **Roster / validate** — show the team layout Summit sees and check it against
  your Map framework.

Optional enhancements (require Map's activity layer):

- `--evidenced` — compares derived coverage against practiced capability from
  Map's evidence data.
- `--outcomes` — weights growth recommendations by GetDX driver scores.

Without these flags, Summit is fully local and instant — Map data plus a roster.

---

### Who it's for

**Engineering leaders** staffing teams and planning hires. Summit shows whether
a team has the capability to deliver — and what composition changes would close
gaps.

**Tech leads** managing risk. Know which skills depend on a single person and
where cross-training would have the most impact.

**Engineers in 1:1s** aligning personal growth with team needs. See which skills
the team needs most and where your development can make the biggest difference.

---

## Three Views

### Capability Coverage

For each skill in the framework, Summit computes the team's collective
proficiency by aggregating individual skill matrices derived through Pathway.

```
$ npx fit-summit coverage platform

  platform team — 3 members

  Capability: Delivery
    Planning              ░░░░░░░░░░  gap — no engineers at working+
    Task Completion       ██████████  depth: 1 engineer at working+

  Capability: Reliability
    Incident Response     ░░░░░░░░░░  gap — no engineers at working+
```

For project teams with allocation, coverage reports allocation-weighted
effective depth:

```
$ npx fit-summit coverage --project migration-q2

  migration-q2 project — 3 members (2.0 FTE)

  Capability: Delivery
    Task Completion       ██████████  effective depth: 1.6 at working+
```

### Structural Risks

Summit identifies single points of failure, critical gaps, and concentration
risks — structural facts about team composition, not judgments about
individuals.

```
$ npx fit-summit risks platform

  platform team — structural risks

  Single points of failure:
    task_completion — only Bob holds working level [low]

  Critical gaps:
    planning — no engineer at working level
      supporting skill for software_engineering discipline.
    incident_response — no engineer at working level
      broad skill for software_engineering discipline.
```

The severity tag on single points of failure reflects the engineer's allocation
to the team: **high** when allocation is below 0.5 (less than half-time),
**medium** between 0.5 and 1.0 (part-time), and **low** at 1.0 (full-time). In
reporting teams where members default to full allocation, every SPOF shows
`[low]`. The tag differentiates in project teams where partial allocation makes
a single point of failure more acute.

### What-If Scenarios

Simulate roster changes and see their impact before anyone makes a decision.

Adding an engineer may resolve existing risks, but can also introduce new ones
(for example, two engineers at the same level creates a concentration risk in
skills neither covers at working+). Summit shows both directions:

```
$ npx fit-summit what-if platform --add "{ discipline: software_engineering, level: J060 }"

  Adding software_engineering J060 to platform:

  Capability changes:
    + task_completion  depth: 1 → 2

  Risk changes:
    - task_completion no longer single point of failure
    + incident_response concentration risk: 2 engineers, none at working+
```

`-` lines are risks resolved by the change. `+` lines are risks the change
introduces. A hire that looks straightforwardly positive can still surface
second-order gaps — Summit shows both so you can make the decision with the full
picture.

---

## Design Principles

**Teams are systems, not collections.** A team's capability depends on coverage,
depth distribution, redundancy, and complementarity — not the sum of individual
scores.

**Plan forward, don't measure backward.** Landmark looks at past evidence.
Summit looks ahead: what can this team do today, and what could it do with
different composition?

**No external dependencies required.** Core Summit uses only Map data and a team
roster. The `--evidenced` and `--outcomes` flags are opt-in enhancements that
read Map's activity layer; without them Summit runs fully locally, instantly,
deterministically.

**Capability, not performance.** Summit describes what a team _can_ do based on
its skill profile — not how well it's doing it. A planning tool, not a
monitoring tool.

**Privacy through aggregation.** The team view shows collective coverage, not
individual shortcomings. When Summit identifies a gap, it's a team gap — a
structural fact about composition. The `--audience director` flag strips
individual names entirely from cross-team planning views.

---

## Getting Started

```sh
npm install @forwardimpact/summit
npx fit-summit coverage platform --roster ./summit.yaml
npx fit-summit risks platform --roster ./summit.yaml
```

<div class="grid">

<a href="/docs/getting-started/leadership/summit/">

### Leadership

Create a roster, model team capability, run what-if staffing scenarios, and
track trajectory over time.

</a>

</div>
