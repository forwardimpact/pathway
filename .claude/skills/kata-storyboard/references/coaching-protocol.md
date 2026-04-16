# The Five Coaching Kata Questions

These questions structure every coaching interaction — team meetings and 1-on-1
sessions. The coach asks, the learner(s) reflect.

In facilitated mode: Q1 is broadcast via Share. Q2–Q5 are posed to individual
agents via Tell; agents respond via Share. Collect all responses before
advancing to the next question. The coach may use Redirect at any point to
interrupt an agent that is off-track. In solo mode, the coach reads data
directly.

## Question 1: What is the target condition?

- Read the target condition from the storyboard.
- Ground the conversation in where the team is headed.
- If the target condition is unclear or expired, update it (planning mode).

## Question 2: What is the actual condition now?

- Each agent follows the Participant Protocol: measure with live data, record to
  CSV, then report via Share.
<<<<<<< Updated upstream
- Run `bunx fit-xmr analyze --format json` against each CSV to get process
  limits and signals — see
=======
- Run [`xmr.mjs`](../../kata-metrics/scripts/xmr.mjs) against each CSV to get
  process limits and signals — see
>>>>>>> Stashed changes
  [`kata-metrics/references/xmr.md`](../../kata-metrics/references/xmr.md).
  Include each metric's `status`, `x_bar`, and any `signals` in the Q2 Tell
  message. Agents should flag any metric whose status changed since the last
  meeting.
- The coach updates the Current Condition section with fresh numbers.
- Use counts and durations — not narratives like "improving" or "stable."
- Reference specific CSV files: `wiki/metrics/{agent}/{domain}/{YYYY}.csv`.

## Question 3: What obstacles are preventing us from reaching the target condition?

- Agents identify obstacles from their domain based on the gap between current
  and target condition.
- Obstacles are discovered through data and experiments, not hypothesized
  upfront.
- The most reliable source for obstacles is trace analysis. Agents with a recent
  `kata-trace` run should ground obstacle reports in trace findings. Agents
  without a recent trace should measure from live run data (`gh run list`,
  `bun audit`, `specs/STATUS`) rather than accumulated log narratives. Log
  frequency != current impact.
- The coach updates the Obstacles list and marks which obstacle the team is
  currently addressing.

## Question 4: What is the next step? What do you expect?

- For the obstacle currently being addressed, agents propose their next
  experiment.
- The expected outcome is recorded _before_ the experiment runs.
- Experiments should be small and testable within one or two daily cycles.

## Question 5: When can we see what we learned from that step?

- Establish when the experiment's results will be visible.
- Typically: next meeting, end of week, or after a specific workflow run.
- This creates the feedback loop — the next meeting opens by reviewing what was
  learned.

## 1-on-1 Coaching Adaptation

The same five questions apply but scoped to the individual agent's trace:

- Q1: What were you trying to achieve in this run?
- Q2: What actually happened? (agent runs `kata-trace` on its own trace)
- Q3: What obstacles prevented better outcomes?
- Q4: What will you do differently next run?
- Q5: When will you see the effect? (next scheduled run)

In facilitated mode, the same tool pattern applies — Tell to pose, Share to
respond — with a single participant instead of five.
