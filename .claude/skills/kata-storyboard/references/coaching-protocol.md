# The Five Coaching Kata Questions

These questions structure every coaching interaction — team meetings and 1-on-1
sessions. The coach asks, the learner(s) reflect.

In facilitated mode, the coach communicates through orchestration tools. In solo
mode, the coach reads data directly. The mechanism differs; the questions and
their intent are identical.

## Question 1: What is the target condition?

- Read the target condition from the storyboard.
- Ground the conversation in where the team is headed.
- If the target condition is unclear or expired, update it (planning mode).

### Facilitation

The coach broadcasts the target condition to all participants via **Share** —
this is context-setting, not a question that requires individual responses.
Agents hear the same direction and can orient before the coach asks Q2.

## Question 2: What is the actual condition now?

- Each agent reports measured data from their domain's metrics CSVs.
- Run [`xmr.mjs`](../../kata-metrics/scripts/xmr.mjs) against each CSV to get
  process limits and signals — see
  [`kata-metrics/references/xmr.md`](../../kata-metrics/references/xmr.md).
- The coach updates the Current Condition section with fresh numbers.
- Use counts and durations — not narratives like "improving" or "stable."
- Reference specific CSV files: `wiki/metrics/{agent}/{domain}/{YYYY}.csv`.

### Facilitation

The coach poses Q2 to each agent individually via **Tell**. Each agent responds
by broadcasting their domain metrics via **Share** — all participants see every
response, enabling cross-domain awareness. The coach collects all responses
before moving to Q3.

## Question 3: What obstacles are preventing us from reaching the target condition?

- Agents identify obstacles from their domain based on the gap between current
  and target condition.
- Obstacles are discovered through data and experiments, not hypothesized
  upfront.
- The coach updates the Obstacles list and marks which obstacle the team is
  currently addressing.

### Facilitation

The coach poses Q3 to each agent individually via **Tell**. Each agent
broadcasts identified obstacles via **Share**. The coach collects all responses,
updates the storyboard's Obstacles section, and selects which obstacle the team
addresses next.

## Question 4: What is the next step? What do you expect?

- For the obstacle currently being addressed, agents propose their next
  experiment.
- The expected outcome is recorded _before_ the experiment runs.
- Experiments should be small and testable within one or two daily cycles.

### Facilitation

The coach addresses Q4 via **Tell** to the agent(s) owning the current obstacle.
The agent broadcasts their proposed experiment and expected outcome via
**Share**. The coach records the experiment in the storyboard before moving on.

## Question 5: When can we see what we learned from that step?

- Establish when the experiment's results will be visible.
- Typically: next meeting, end of week, or after a specific workflow run.
- This creates the feedback loop — the next meeting opens by reviewing what was
  learned.

### Facilitation

The coach addresses Q5 via **Tell** to the experiment owner(s). The agent
broadcasts the timeline via **Share**. The coach records the timeline in the
storyboard.

## Redirect

Redirect is available but unmapped to a specific question. The coach may use
**Redirect** at any point to interrupt an agent that is off-track or
misunderstanding the question — it is corrective, not part of the standard
questioning sequence.

## 1-on-1 Coaching Adaptation

The same five questions apply but scoped to the individual agent's trace:

- Q1: What were you trying to achieve in this run?
- Q2: What actually happened? (agent runs `kata-trace` on its own trace)
- Q3: What obstacles prevented better outcomes?
- Q4: What will you do differently next run?
- Q5: When will you see the effect? (next scheduled run)

In facilitated mode, the same tool pattern applies — Tell to pose, Share to
respond — with a single participant instead of five.
