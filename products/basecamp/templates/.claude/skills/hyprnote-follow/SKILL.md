---
name: hyprnote-follow
description: >
  Follow a live Hyprnote session in real-time, coaching the user through a
  meeting or interview. Understands context from the session title, knowledge
  base, and candidate pipeline. Provides talking points, flags gaps in
  coverage, and suggests follow-up questions as the conversation unfolds.
  Use when the user asks to follow, shadow, or coach them through a live meeting.
---

# Hyprnote Follow

Follow a live Hyprnote recording session, read the transcript as it grows, and
coach the user through the meeting in real-time. The skill gathers context from
the knowledge base before the session starts, then polls the transcript
periodically, analyzing new content and providing actionable coaching.

## Trigger

Run this skill:

- When the user asks to follow, shadow, or coach them through a live meeting
- When the user says "follow my meeting", "coach me", or "shadow this call"
- When the user starts a Hyprnote recording and wants real-time support

## Prerequisites

- Hyprnote installed with session data at
  `~/Library/Application Support/hyprnote/sessions/`
- An active or about-to-start Hyprnote recording session
- Knowledge base populated (for attendee/candidate context)

## Inputs

- Live Hyprnote session transcript (growing `transcript.json`)
- `knowledge/People/*.md` — attendee context
- `knowledge/Candidates/*/brief.md` — candidate context (for interviews)
- `knowledge/Candidates/*/screening.md` — screening assessment
- `knowledge/Candidates/*/panel.md` — panel brief (if exists)
- `knowledge/Roles/*.md` — role/requisition context (for interviews)
- `knowledge/Organizations/*.md` — company context
- `knowledge/Projects/*.md` — project context
- `~/.cache/fit/basecamp/apple_calendar/*.json` — calendar events for context

## Outputs

- Real-time coaching messages printed to the user during the session
- No files are written — this skill is purely advisory

---

## Phase 1: Detect & Connect

### Step 1 — Find the active session

```bash
node .claude/skills/hyprnote-follow/scripts/follow.mjs --detect
```

This returns the most recently modified session, whether it's live, and its
title. If no session has been modified in the last 5 minutes, warn the user that
no live session was detected and ask if they want to follow a specific session.

If multiple sessions could be active, confirm with the user.

### Step 2 — Read session metadata

```bash
node .claude/skills/hyprnote-follow/scripts/follow.mjs <session-id> --meta
```

Extract: **title**, **created_at**, **participants**.

### Step 3 — Classify the meeting type

Determine the meeting type from the title. This drives coaching strategy:

| Title Pattern                               | Type                        | Coaching Focus                                                             |
| ------------------------------------------- | --------------------------- | -------------------------------------------------------------------------- |
| "Interview with {Name}", "Screening {Name}" | **Screening interview**     | Agent-Aligned Engineering Standard skills, behaviour probes, level signals |
| "Decomposition interview with {Name}"       | **Decomposition interview** | Problem-solving approach, system thinking, trade-offs                      |
| "Technical assessment of {Name}"            | **Technical interview**     | Hands-on skill, architecture reasoning, code quality                       |
| "Panel with {Name}", "Second interview"     | **Panel interview**         | Business acumen, cultural fit, leadership signals                          |
| "Meeting with {Name}", "{Topic} meeting"    | **General meeting**         | Agenda coverage, action items, decision capture                            |
| "Recruitment call", "Recruitment strategy"  | **Recruitment planning**    | Pipeline status, role requirements, next steps                             |
| Other                                       | **General**                 | Active listening, follow-up questions, key takeaways                       |

## Phase 2: Gather Context

Before the follow loop starts, gather all relevant context. This happens once.

### Step 4 — Resolve attendees

Extract names from the session title and participant list. For each name:

```bash
rg -l "{name}" knowledge/People/
rg -l "{name}" knowledge/Candidates/
```

Read matching notes to understand: role, organization, history, open items,
previous interactions.

### Step 5 — Load meeting-type-specific context

**For interview sessions:**

1. Read the candidate brief: `knowledge/Candidates/{Name}/brief.md`
2. Read the screening assessment: `knowledge/Candidates/{Name}/screening.md`
3. Read the panel brief if it exists: `knowledge/Candidates/{Name}/panel.md`
4. Look up the target role: find the `Req` field and read the corresponding
   `knowledge/Roles/*.md` file
5. Load agent-aligned engineering standard expectations:
   ```bash
   bunx fit-pathway job {discipline} {level} --track={track}
   ```

**For general meetings:**

1. Read attendee People notes
2. Read relevant Project and Organization notes referenced in those notes
3. Check for open tasks involving these people: `rg "{name}" knowledge/Tasks/`

### Step 6 — Build the coaching brief

Synthesize gathered context into an internal coaching brief. Print a concise
**pre-meeting summary** to the user:

**For interviews:**

```
Following: {Title}
Type: {Interview type}
Candidate: {Name} — {current role} at {employer}
Role: {target role} ({level}, {track})
Screening: {recommendation from screening.md}

Key areas to probe:
- {Focus area 1 from screening/panel brief}
- {Focus area 2}
- {Focus area 3}

Strengths to confirm:
- {Strength 1}
- {Strength 2}

Watching for: {specific signals at this interview stage}
```

**For general meetings:**

```
Following: {Title}
Attendees: {names with roles}

Open items with {name}:
- {item 1}
- {item 2}

Suggested topics:
- {based on recent activity/projects}
```

---

## Phase 3: Follow Loop

The follow loop reads new transcript content and provides coaching. Each
iteration:

### Step 7 — Read new transcript content

First read (no `--after` flag):

```bash
node .claude/skills/hyprnote-follow/scripts/follow.mjs <session-id>
```

Subsequent reads (pass the last word ID):

```bash
node .claude/skills/hyprnote-follow/scripts/follow.mjs <session-id> --after <last-word-id>
```

The script returns JSON with grouped text segments, channel labels, and the last
word ID for the next poll.

### Step 8 — Analyze new content

For each batch of new transcript content, analyze against the coaching brief:

**For interviews — track these dimensions:**

| Dimension               | What to watch for                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------- |
| **Skills demonstrated** | Candidate shows (not just claims) agent-aligned engineering standard skills        |
| **Behaviour signals**   | Own the Outcome, Think in Systems, Communicate with Precision, Polymath, Curiosity |
| **Level signals**       | Autonomy, scope, complexity handling, mentoring                                    |
| **Coverage gaps**       | Focus areas from screening that haven't been touched yet                           |
| **Red flags**           | Contradictions with CV, vague answers, deflection                                  |
| **Time awareness**      | Are you running out of time with uncovered areas?                                  |

**For general meetings — track these dimensions:**

| Dimension             | What to watch for                                    |
| --------------------- | ---------------------------------------------------- |
| **Open items**        | Were pending items raised and addressed?             |
| **Decisions**         | What was decided? Who owns next steps?               |
| **New commitments**   | Track who committed to what                          |
| **Unasked questions** | Topics the user should raise before the meeting ends |
| **Tone/dynamics**     | Shifts in energy, resistance, enthusiasm             |

### Step 9 — Provide coaching

After analyzing each batch, print coaching output **only when there's something
actionable**. Do not print noise. Coaching should be:

- **Short** — 1-3 lines maximum per coaching nudge
- **Actionable** — tell the user what to do, not what happened
- **Timely** — relevant to what's happening NOW

**Coaching output formats:**

```
Probe deeper: {Name} mentioned {topic} — ask for a specific example
```

```
Gap: screening flagged {skill} as uncertain — hasn't come up yet.
   Try: "{suggested question}"
```

```
Confirmed: {Name} demonstrated {skill} at {level} — "{brief quote}"
```

```
Follow up: {Name} committed to {action} — pin this down with a deadline
```

```
Time check: ~{N} minutes in. Still uncovered: {topic 1}, {topic 2}
```

```
Capture: decision made on {topic} — {who} will {what}
```

### Step 10 — Detect meeting end

Watch for ending signals (same as trim-transcript):

- Farewells: "bye", "take care", "have a good day"
- Wrap-up: "that's all", "let's wrap", "I'll let you go"
- Final thank-yous with no substantive follow-up

When detected, print a wrap-up summary (see Phase 4).

### Step 11 — Loop cadence

**Do NOT use `sleep` or timed loops.** Instead, after each coaching output,
immediately read the next batch of transcript. The natural pace of reading,
analyzing, and outputting coaching creates sufficient cadence.

If no new words are returned:

- On first empty read: wait briefly, try once more
- On second consecutive empty read: tell the user the transcript appears paused
  and ask if the meeting has ended

---

## Phase 4: Wrap-Up

When the meeting ends (detected automatically or user confirms), provide a
structured debrief.

### Step 12 — Interview debrief

```markdown
## Session Debrief: {Title}
**Duration:** ~{N} minutes

### Coverage
| Focus Area | Status | Evidence |
|---|---|---|
| {area from screening} | Covered / Partial / Missed | {brief note} |

### Signals Observed
**Strengths:**
- {skill/behaviour}: {what was demonstrated}

**Concerns:**
- {skill/behaviour}: {what was lacking or contradictory}

**Level read:** {level assessment based on what was observed}

### Suggested Next Steps
- {e.g., "Schedule decomposition interview to probe {skill}"}
- {e.g., "Flag {concern} for panel brief"}
```

### Step 13 — General meeting debrief

```markdown
## Session Debrief: {Title}
**Duration:** ~{N} minutes

### Decisions Made
- {decision 1}
- {decision 2}

### Action Items
| Owner | Action | Deadline |
|---|---|---|
| {name} | {what} | {when, if mentioned} |

### Open Items (still unresolved)
- {item that wasn't addressed}

### Key Takeaways
- {1-2 sentence summary of what matters most}
```

### Step 14 — Offer next steps

After the debrief, offer (don't ask) logical follow-ups:

- **For interviews:** "I can run assess-interview on this transcript when
  Hyprnote finishes processing."
- **For meetings:** "I can extract entities from this session into the knowledge
  graph when ready."

---

## Coaching Principles

### For interviews

1. **Agent-Aligned Engineering Standard-grounded.** Every coaching nudge ties
   back to the career agent-aligned engineering standard skills and behaviours.
   Don't coach based on vibes.
2. **Evidence over claims.** Flag when a candidate _claims_ something vs
   _demonstrates_ it. Push the user to ask for specific examples.
3. **Coverage-aware.** Track which screening focus areas have been explored and
   which haven't. Nudge before time runs out.
4. **Level-calibrated.** Know what the target level expects. If the candidate is
   answering below or above level, flag it.
5. **Don't lead.** Never suggest the user ask loaded or leading questions.
   Suggest open-ended probes that let the candidate reveal their level
   naturally.

### For general meetings

1. **Agenda-aware.** If there were known topics or open items, track coverage.
2. **Decision-focused.** Flag when a decision is made or deferred. Capture
   owners.
3. **Commitment-tracking.** Note who said they'd do what. Surface unresolved
   commitments from previous meetings.
4. **Time-conscious.** If the meeting is running long and key topics haven't
   been raised, nudge.

### Universal

- **Be quiet when things are going well.** Only speak up when you have something
  actionable. Silence means "you're doing fine."
- **Channel awareness.** Channel 0 is the user, channel 1+ is the guest(s).
  Coaching should reference what the _guest_ said, since the user already knows
  what they said.
- **Never interrupt flow.** If the conversation is in a productive groove, hold
  your coaching until the next natural pause.
- **Respect the user's expertise.** The user is an experienced interviewer/
  meeting participant. Don't patronize. Coach at the margin — surface things
  they might miss because they're focused on the conversation.

## Constraints

- **Read-only.** Never modify Hyprnote files, knowledge notes, or state files.
  This skill observes and advises only.
- **No post-processing.** Don't run extract-entities, assess-interview, or
  process-hyprnote during the follow. Offer them after.
- **Channel 0 = user.** Always. Don't confuse who said what.
- **Transcription noise.** Live transcripts are messy — expect typos, missing
  words, and misattributed speech. Don't coach based on a single ambiguous word.
  Wait for enough context.
- **Privacy.** Don't repeat sensitive candidate information in coaching output
  that could be seen on a shared screen. Keep nudges generic enough that they
  don't reveal confidential assessment details.

## Quality Checklist

- [ ] Active session detected and confirmed with user
- [ ] Meeting type correctly classified from title
- [ ] Knowledge base context gathered for all attendees
- [ ] Interview sessions loaded agent-aligned engineering standard expectations
      and screening focus areas
- [ ] Coaching nudges are actionable and concise (1-3 lines max)
- [ ] Coverage gaps tracked and surfaced before meeting ends
- [ ] End-of-meeting detected and debrief provided
- [ ] Next steps offered (assess-interview / process-hyprnote)
- [ ] No files were modified during the session
