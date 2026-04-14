# Run Selection Algorithm

When no specific workflow name, run ID, or URL is provided, select a run using
memory-informed rotation:

1. **Discover available runs**:

   ```sh
   bash .claude/skills/kata-trace/scripts/find-runs.sh [lookback]
   ```

   Default lookback is `7d`. Use `14d` for broader window, `24h` for recent
   only. Returns JSON sorted newest-first with `workflow`, `run_id`, `status`,
   `conclusion`, `created_at`, `branch`, and `url` fields.

2. **Avoid duplicates** — Skip run IDs already analyzed (per memory).

3. **Rotate across agents** — Prefer the least-recently analyzed workflow.

4. **Prefer failures** — Among eligible runs, prefer non-success conclusions.
