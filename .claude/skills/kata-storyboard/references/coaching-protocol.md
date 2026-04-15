# The Five Coaching Kata Questions

These questions structure every coaching interaction — team meetings and 1-on-1
sessions. The coach asks, the learner(s) reflect.

## Question 1: What is the target condition?

- Facilitator reads the target condition from the storyboard.
- Grounds the conversation in where the team is headed.
- If the target condition is unclear or expired, update it (planning mode).

## Question 2: What is the actual condition now?

- Each agent (or the single agent in 1-on-1) reports measured data from their
  domain's metrics CSVs.
- The facilitator updates the Current Condition section with fresh numbers.
- Use counts and durations — not narratives like "improving" or "stable."
- Reference specific CSV files: `wiki/metrics/{agent}/{domain}/{YYYY}.csv`.

## Question 3: What obstacles are preventing us from reaching the target condition?

- Agents identify obstacles from their domain based on the gap between current
  and target condition.
- Obstacles are discovered through data and experiments, not hypothesized
  upfront.
- The facilitator updates the Obstacles list and marks which obstacle the team
  is currently addressing.

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
