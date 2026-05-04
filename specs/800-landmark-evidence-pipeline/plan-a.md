# Plan 800-A — Landmark Evidence Pipeline

Spec: [spec.md](spec.md) · Design: [design-a.md](design-a.md)

## Approach

Repair the data layer first (schema migrations, manager-scoping query rewrites
against `organization_people`, GetDX sync extension for `getdx_team_id`
population, `driver_name` capture, initiative removal, and synthetic marker
generation), then build the service layer (`GetMarkersForProfile` on
svcpathway, new `svcmap` gRPC service with four methods and a source-type
registry, wired through svcmcp), then add the evaluation skill to Guide's
system prompt. Each part is independently verifiable and sequentially ordered.

Libraries used: `libskill` (deriveJob), `librpc` (Server, createClient,
MapBase), `libmcp` (registerToolsFromConfig), `libconfig`
(createServiceConfig), `libtelemetry` (createLogger), `libtype` (generated
types), `libsyntheticprose` (capability prompt), `libsyntheticgen` (activity
entities), `libsyntheticrender` (raw payloads), `@supabase/supabase-js`
(activity DB).

## Parts

| Part | Summary | Files | Depends on |
|------|---------|-------|------------|
| [plan-a-01.md](plan-a-01.md) | Data layer + synthetic data | 13 modified, 4 created, 6 deleted | — |
| [plan-a-02.md](plan-a-02.md) | Service layer (svcpathway, svcmap, svcmcp) | 8 modified, 6 created | Part 01 |
| [plan-a-03.md](plan-a-03.md) | Evaluation skill | 1 modified | Part 02 |

## Risks

| Risk | Mitigation |
|------|------------|
| NOT NULL migration on `activity.evidence` fails if synthetic rows have null `rationale` or `level_id` | Migration backfills defaults before adding constraint |
| `getdx_team_id` population depends on teams-list containing contributor email arrays | Synthetic terrain extended to render contributor arrays; real path uses same transform |
| Marker-grounding validation in `WriteEvidence` depends on svcpathway availability | svcmap constructor requires pathwayClient; service topology starts pathway before map |
| `createClient("map")` requires `SERVICE_MAP_URL` to resolve | init.js updated in Part 02 Step 6; port 3006 assigned |

## Execution

Sequential: Part 01 → Part 02 → Part 03. All three route to `staff-engineer`.
