Introduce yourself to the agent and give them the following task:

Try the Forward Impact Guide product for the first time. Start at
www.forwardimpact.team, find the Guide product page, and follow the instructions
to install and run fit-guide.

1. Install the @forwardimpact/guide package from npm
2. Follow any setup instructions from the documentation
3. Run at least three different fit-guide prompts — try asking it about skills,
   career progression, or engineering practices
4. Summarize their experience in their final output, including:
   - How clear the installation instructions were
   - Whether the commands worked as documented
   - How useful the responses were
   - Any errors or confusing moments

The agent should not write findings to files — all findings should be in their
output. They should work independently and install from npm as a user would, not
clone the monorepo.

Use the `product-evaluation` skill to supervise the session and capture
feedback.
