# CSV Schema

Long format, one row per data point. Six fields:

| Field  | Type          | Required | Example                          |
| ------ | ------------- | -------- | -------------------------------- |
| date   | ISO 8601 date | yes      | `2026-04-14`                     |
| metric | string        | yes      | `issues_triaged`                 |
| value  | number        | yes      | `3`                              |
| unit   | string        | yes      | `count`, `days`, `minutes`       |
| run    | string        | yes      | GitHub Actions run URL           |
| note   | string        | no       | Anomaly annotation (empty if ok) |

## Header Row

```
date,metric,value,unit,run,note
```

Written as the first line when creating a new file.

## Appending Rules

- Always append — never rewrite or sort existing rows.
- One row per metric per run. If recording three metrics, append three rows.
- Empty `note` field: leave empty (not null, not "none"), resulting in a
  trailing comma.
- Quote fields containing commas using double quotes.

## Example

```csv
date,metric,value,unit,run,note
2026-04-14,issues_triaged,4,count,https://github.com/forwardimpact/monorepo/actions/runs/12345,
2026-04-15,issues_triaged,3,count,https://github.com/forwardimpact/monorepo/actions/runs/12400,
2026-04-16,issues_triaged,11,count,https://github.com/forwardimpact/monorepo/actions/runs/12455,backlog flush after release
```
