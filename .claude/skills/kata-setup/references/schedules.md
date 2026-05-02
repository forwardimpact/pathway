# Schedule Templates

Kata agents run on a **three-shift** (night, day, swing) producer-reviewer-
shipper chain:

1. **product-manager** -- triages a fresh backlog
2. **staff-engineer** -- implements from the backlog
3. **security-engineer** -- reviews code (night only)
4. **technical-writer** -- reviews docs (night only)
5. **release-engineer** -- ships what passed review
6. **improvement-coach** -- storyboard, daily after night

Security and technical-writer run only at night.

## Cron Expressions by Timezone

All crons are UTC. Local times use the tighter summer offset.

### Europe/Paris (CEST UTC+2 / CET UTC+1)

| Agent             | Night (by 07:00) | Day (by 15:00) | Swing (by 23:00) |
| ----------------- | ---------------- | -------------- | ---------------- |
| product-manager   | `23 1 * * *`     | `17 10 * * *`  | `17 18 * * *`    |
| staff-engineer    | `11 2 * * *`     | `11 11 * * *`  | `11 19 * * *`    |
| security-engineer | `53 2 * * *`     | --             | --               |
| technical-writer  | `37 3 * * *`     | --             | --               |
| release-engineer  | `23 4 * * *`     | `23 12 * * *`  | `23 20 * * *`    |
| storyboard        | `0 6 * * *`      | --             | --               |

### US East / New York (EDT UTC-4 / EST UTC-5)

| Agent             | Night (by 07:00) | Day (by 15:00) | Swing (by 23:00) |
| ----------------- | ---------------- | -------------- | ---------------- |
| product-manager   | `23 7 * * *`     | `17 16 * * *`  | `17 0 * * *`     |
| staff-engineer    | `11 8 * * *`     | `11 17 * * *`  | `11 1 * * *`     |
| security-engineer | `53 8 * * *`     | --             | --               |
| technical-writer  | `37 9 * * *`     | --             | --               |
| release-engineer  | `23 10 * * *`    | `23 18 * * *`  | `23 2 * * *`     |
| storyboard        | `0 12 * * *`     | --             | --               |

### US West / Los Angeles (PDT UTC-7 / PST UTC-8)

| Agent             | Night (by 07:00) | Day (by 15:00) | Swing (by 23:00) |
| ----------------- | ---------------- | -------------- | ---------------- |
| product-manager   | `23 10 * * *`    | `17 19 * * *`  | `17 3 * * *`     |
| staff-engineer    | `11 11 * * *`    | `11 20 * * *`  | `11 4 * * *`     |
| security-engineer | `53 11 * * *`    | --             | --               |
| technical-writer  | `37 12 * * *`    | --             | --               |
| release-engineer  | `23 13 * * *`    | `23 21 * * *`  | `23 5 * * *`     |
| storyboard        | `0 15 * * *`     | --             | --               |

### Asia Pacific / Tokyo (JST UTC+9)

| Agent             | Night (by 07:00) | Day (by 15:00) | Swing (by 23:00) |
| ----------------- | ---------------- | -------------- | ---------------- |
| product-manager   | `23 18 * * *`    | `17 3 * * *`   | `17 11 * * *`    |
| staff-engineer    | `11 19 * * *`    | `11 4 * * *`   | `11 12 * * *`    |
| security-engineer | `53 19 * * *`    | --             | --               |
| technical-writer  | `37 20 * * *`    | --             | --               |
| release-engineer  | `23 21 * * *`    | `23 5 * * *`   | `23 13 * * *`    |
| storyboard        | `0 23 * * *`     | --             | --               |

### Asia Pacific / Sydney (AEST UTC+10 / AEDT UTC+11)

| Agent             | Night (by 07:00) | Day (by 15:00) | Swing (by 23:00) |
| ----------------- | ---------------- | -------------- | ---------------- |
| product-manager   | `23 17 * * *`    | `17 2 * * *`   | `17 10 * * *`    |
| staff-engineer    | `11 18 * * *`    | `11 3 * * *`   | `11 11 * * *`    |
| security-engineer | `53 18 * * *`    | --             | --               |
| technical-writer  | `37 19 * * *`    | --             | --               |
| release-engineer  | `23 20 * * *`    | `23 4 * * *`   | `23 12 * * *`    |
| storyboard        | `0 22 * * *`     | --             | --               |
