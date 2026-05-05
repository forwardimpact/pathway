Conduct a JTBD switching interview using the `kata-interview` skill.

The skill defines the protocol: pick a product, pick one of its jobs from
`JTBD.md`, stage the right subset of synthetic data into `$AGENT_CWD`, craft
the persona in `$AGENT_CWD/CLAUDE.md` from that JTBD entry alone, then run
the session asking the persona to get the job done starting from
https://www.forwardimpact.team.

If a `Product:` or `Job:` line is appended below, honour it; otherwise
choose. Any other appended text is steering for the session — pass it
through to the agent as additional instruction.
