---
title: "Getting Started: Landmark for Engineers"
description: "Check your evidence record, promotion readiness, growth timeline, and skill coverage against your agent-aligned engineering standard markers."
---

Landmark gives you visibility into your own practice evidence and growth data —
showing what your engineering record looks like against your agent-aligned
engineering standard's markers.

Landmark requires Map's activity layer (Supabase). If your organization has
already set this up, Landmark works immediately. If not, see the
[Landmark quickstart](/docs/products/engineering-outcomes/) or ask your
engineering leader to follow the
[Map setup guide](/docs/getting-started/leadership/map/). One command works
without Supabase: `marker` reads directly from your agent-aligned engineering
standard YAML.

## Prerequisites

- Node.js 18+
- npm
- Map's activity layer running and populated (for most commands)

## Install

```sh
npm install @forwardimpact/landmark
```

## Browse marker definitions

Look up the observable indicators defined for any skill — useful for
understanding what evidence is expected at each proficiency level:

```sh
npx fit-landmark marker task_completion
npx fit-landmark marker task_completion --level working
```

## Check your evidence

See which markers have evidence linked to your work:

```sh
npx fit-landmark evidence --email you@example.com
npx fit-landmark evidence --skill system_design --email you@example.com
```

Each row shows the artifact, the marker it matched, and Guide's rationale.
Filter by `--skill` to focus on a specific area.

## View your skill coverage

See how complete your evidence record is across all expected skills:

```sh
npx fit-landmark coverage --email you@example.com
```

Coverage shows evidenced artifacts versus total expected markers — a quick gauge
of where your record is strong and where it has gaps.

## Check promotion readiness

See which next-level markers you have already evidenced and which are still
outstanding:

```sh
npx fit-landmark readiness --email you@example.com
npx fit-landmark readiness --email you@example.com --target J060
```

Without `--target`, readiness checks against the next level above your current
level. With `--target`, you can check against any specific level — useful for
planning a multi-level trajectory.

## Track your growth timeline

See how your evidence has accumulated over time, aggregated by quarter:

```sh
npx fit-landmark timeline --email you@example.com
npx fit-landmark timeline --email you@example.com --skill system_design
```

Timelines help you see whether growth is accelerating, stalling, or concentrated
in one area. Add `--skill` to focus on a specific capability.

## Read your voice comments

See your own GetDX snapshot comments in a timeline view alongside evidence
context:

```sh
npx fit-landmark voice --email you@example.com
```

All Landmark commands support `--format text|json|markdown`.

---

## Next steps

- [Landmark product page](/landmark/) — audience model and architecture overview
- [Landmark quickstart](/docs/products/engineering-outcomes/) — step-by-step
  guide from install to a working health view
- Run `npx fit-landmark --help` for the full command surface
