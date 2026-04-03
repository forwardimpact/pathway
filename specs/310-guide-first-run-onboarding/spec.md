# Spec 310: Guide First-Run Onboarding

## Problem Statement

Engineers evaluating Guide encounter two barriers that prevent them from
experiencing the product's value:

1. **No self-service path to obtain SERVICE_SECRET** — The getting-started guide
   says `export SERVICE_SECRET=<your-secret>` and states "your organization will
   provide" the secret. Engineers evaluating Guide outside an existing
   organizational deployment have no way forward. There is no documentation for
   how an admin generates a secret, and no alternative path for solo evaluation.

2. **No value without a full service stack** — Guide requires 8 running services
   (agent, llm, memory, graph, vector, tool, trace, web) before it can answer a
   single question. Unlike Pathway, which delivers value instantly
   (`npx fit-pathway discipline --list`), Guide has no "instant gratification"
   moment.

### Prior Art

- **Spec 300** (npm user experience, done) — Fixed npm packaging issues
  (`--help`/`--version` before imports, codegen docs, smoke tests). Did not
  address the service stack barrier.
- **Spec 240** (guide-npm-package, done) — Published Guide to npm, added early
  `--help`/`--version` handling and SERVICE_SECRET gate with onboarding
  instructions.
- **Improvement coach** (2026-04-02) — Noted that "fit-guide requires a running
  service stack but the website doesn't make this clear upfront."

### Evidence

- Issue #194: Docs gap — no instructions for obtaining SERVICE_SECRET
- Issue #195: Feature request — demo/sandbox mode for first-run evaluation
- Both issues originated from user testing of the Guide first-run experience
  (2026-04-03)

## Users

- **Engineers** evaluating Guide for the first time, before committing to
  infrastructure setup
- **Leadership** assessing whether Guide fits their organization's needs

## Requirements

### R1: Document SECRET_SECRET generation for administrators

The getting-started documentation must explain how an organization administrator
generates and distributes SERVICE_SECRET. Currently, `scripts/env-secrets.js`
generates secrets using `libsecret.generateSecret()`, but this is only
documented in the internal operations reference (`just env-secrets`). External
administrators deploying the platform need equivalent guidance using npm/npx
tooling.

**Success criteria:**

- Getting-started guide includes a "Platform Administration" or "Self-Hosting"
  section explaining secret generation
- Instructions use `npx` (not `bun`/`just`) per the distribution model policy
- An administrator can follow the docs end-to-end to generate SERVICE_SECRET

### R2: Improve the no-SERVICE_SECRET CLI experience

The current `fit-guide` behaviour when SERVICE_SECRET is missing (lines 47-64 of
`bin/fit-guide.js`) tells users to "clone the monorepo and run `just rc-start`".
This is internal contributor guidance, not external user guidance. The message
should:

- Reference the getting-started documentation URL
- Explain the self-hosting path for administrators
- Mention the demo mode (R3) as an alternative
- Use `npx`/`npm` commands, not `bunx`/`just`

**Success criteria:**

- CLI prints actionable, external-user-appropriate instructions when
  SERVICE_SECRET is unset
- Instructions reference the correct documentation URL
- No internal tooling (`bun`, `just`, monorepo) mentioned in user-facing output

### R3: Guide demo mode for evaluation without services

Guide should offer a demo or local mode that lets engineers experience the
product's value without deploying services. The scope of this requirement is
intentionally open — the implementation plan should evaluate the options and
choose the simplest approach that delivers the core value proposition:

**Option A: Bundled demo responses** — Pre-computed responses for common
questions using the sample framework data. Zero external dependencies. Shows
what the experience looks like but responses are static.

**Option B: Local LLM mode** — Use a local LLM (e.g., Ollama) with the user's
framework data via `--data=<path>`. Full conversational experience without
remote services. Requires a local LLM but no service stack.

**Option C: Offline reasoning** — Use the framework data directly (like Pathway
does) to answer structural questions ("What skills are in the Platform
discipline?") without any LLM. Limited scope but zero dependencies.

Any option should activate automatically when SERVICE_SECRET is unset and the
user invokes `npx fit-guide` without `--help`/`--version`, or via an explicit
`--demo` flag.

**Success criteria:**

- `npx fit-guide` produces useful output without SERVICE_SECRET
- The demo experience demonstrates Guide's value proposition
- Clear messaging distinguishes demo mode from full mode
- Documentation explains how to move from demo to full mode

### R4: Getting-started documentation restructure

The getting-started guide for engineers should present Guide's onboarding as a
progressive path:

1. **Try it** — `npx fit-guide` works immediately (demo mode)
2. **Bring your data** — `npx fit-guide --data=./my-framework/` with local
   framework data
3. **Full deployment** — Self-host the service stack for the complete experience

**Success criteria:**

- Getting-started guide presents the three-step progressive path
- Each step has clear prerequisites and instructions
- The "Try it" step requires only `npm install` and `npx fit-codegen --all`

## Out of Scope

- Hosted sandbox endpoint (infrastructure cost, security, rate limiting —
  revisit if adoption warrants)
- Changes to Pathway, Basecamp, or other products
- Service stack deployment automation (separate concern)
- Changes to the service stack architecture

## Risks

- **Demo mode quality** — Static responses may underwhelm; need to choose
  representative questions that showcase the value proposition
- **Local LLM compatibility** — If Option B is chosen, LLM compatibility and
  quality may vary across providers
- **Maintenance burden** — Demo content must stay in sync with framework data
  schema changes

## References

- Issue #194: https://github.com/forwardimpact/monorepo/issues/194
- Issue #195: https://github.com/forwardimpact/monorepo/issues/195
- Spec 300: `specs/300-npm-user-experience/`
- Spec 240: `specs/240-guide-npm-package/`
- Guide CLI: `products/guide/bin/fit-guide.js`
- Getting started: `website/docs/getting-started/engineers/index.md`
- Secret generation: `scripts/env-secrets.js`
