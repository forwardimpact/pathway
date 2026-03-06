---
name: scan-open-candidates
description: >
  Scan publicly available sources for candidates who indicate they are open for
  hire. Uses WebFetch to read public APIs (HN Algolia, Mastodon, dev.to, Reddit
  JSON). Writes prospect notes to knowledge/Candidates/Prospects/. Maintains
  cursor/dedup state in ~/.cache/fit/basecamp/head-hunter/. Use when the
  head-hunter agent is woken or when the user asks to scan for open candidates.
---

# Scan Open Candidates

Fetch and filter publicly available candidate posts from platforms where people
explicitly indicate they are open for hire. This skill handles the web fetching,
filtering, and deduplication logic.

## Trigger

Run this skill:

- When the head-hunter agent is woken by the scheduler
- When the user asks to scan for open candidates or prospects

## Prerequisites

- `WebFetch` tool available (Claude Code built-in — no curl/wget needed)
- `fit-pathway` CLI available (`npx fit-pathway`)
- Memory directory at `~/.cache/fit/basecamp/head-hunter/`

## Inputs

- `~/.cache/fit/basecamp/head-hunter/cursor.tsv` — source rotation state
- `~/.cache/fit/basecamp/head-hunter/seen.tsv` — deduplication index
- Framework data via `npx fit-pathway skill --list` and `npx fit-pathway job`

## Outputs

- `knowledge/Candidates/Prospects/{Name}.md` — prospect notes
- `~/.cache/fit/basecamp/head-hunter/cursor.tsv` — updated cursors
- `~/.cache/fit/basecamp/head-hunter/seen.tsv` — updated seen index
- `~/.cache/fit/basecamp/head-hunter/prospects.tsv` — updated prospect index
- `~/.cache/fit/basecamp/head-hunter/log.md` — appended activity log
- `~/.cache/fit/basecamp/state/head_hunter_triage.md` — triage report

---

## Source Definitions

### 1. Hacker News "Who Wants to Be Hired?"

A monthly thread where candidates self-post their availability. Posted on the
1st of each month on Hacker News.

**Find the thread:**

```
WebFetch URL: https://hn.algolia.com/api/v1/search?query=%22Who+wants+to+be+hired%22&tags=ask_hn&hitsPerPage=5
```

Parse the JSON response. The first hit with a title matching "Who wants to be
hired?" and `created_at` in the current or previous month is the target thread.

**Fetch candidate posts:**

```
WebFetch URL: https://hn.algolia.com/api/v1/items/{objectID}
```

The `children` array contains top-level comments — each is one candidate. Parse
the `text` field (HTML) for:

- **Location** — often first line: "Location: New York" or "NYC / Remote"
- **Remote** — "Remote: Yes" or "Open to remote"
- **Skills** — tech stack listings, language/framework mentions
- **Experience** — years, role titles, past companies
- **Contact** — email (often obfuscated: "name [at] domain [dot] com")
- **Resume/CV** — links to personal sites, GitHub, LinkedIn

**Cursor:** Store the `objectID` of the thread and the ID of the last processed
child comment.

**Rate limit:** HN Algolia API has no strict rate limit but be respectful — one
fetch per source per wake cycle.

### 2. Mastodon (Hachyderm.io)

Public timeline filtered by job-seeking hashtags.

**Fetch posts:**

```
WebFetch URL: https://hachyderm.io/api/v1/timelines/tag/GetFediHired?limit=40
WebFetch URL: https://hachyderm.io/api/v1/timelines/tag/HachyJobs?limit=40
```

Response is a JSON array of status objects. For each status:

- `id` — unique status ID (use for dedup)
- `content` — HTML content of the post
- `account.display_name` — poster's display name
- `account.url` — profile URL
- `url` — permalink to the post
- `created_at` — ISO timestamp
- `tags` — array of hashtag objects

Parse `content` for skills, experience, location. The `account.note` field
(bio) may contain additional context.

**Cursor:** Store the `id` of the most recent status processed. On next fetch,
use `?min_id={cursor}` to get only newer posts.

**Rate limit:** Mastodon API allows 300 requests per 5 minutes for public
endpoints. One fetch per wake is well within limits.

### 3. dev.to

Developer articles and listings where people share availability.

**Fetch listings:**

```
WebFetch URL: https://dev.to/api/listings?category=collabs&per_page=25
```

**Fetch articles tagged with job-seeking:**

```
WebFetch URL: https://dev.to/api/articles?tag=lookingforwork&per_page=25&state=rising
```

For listings, parse `title`, `body_markdown`, `category`, `user.name`,
`user.username`. For articles, parse `title`, `description`, `user.name`,
`url`, `tag_list`.

**Cursor:** Store the `id` of the most recent listing/article processed.

**Rate limit:** dev.to API allows 30 requests per 30 seconds. One fetch per
wake is fine.

### 4. Reddit r/forhire

`[For Hire]` posts where freelancers and job-seekers advertise.

**Fetch posts:**

```
WebFetch URL: https://www.reddit.com/r/forhire/new.json?limit=25
```

Response has `data.children` array. Filter to posts with `link_flair_text`
containing "For Hire" or title starting with `[For Hire]`.

For each matching post:

- `data.id` — post ID (use for dedup)
- `data.title` — contains role/skills summary
- `data.selftext` — full post body with details
- `data.author` — Reddit username
- `data.permalink` — link to the post
- `data.created_utc` — Unix timestamp

**Cursor:** Store the `name` (fullname) of the most recent post processed. On
next fetch, use `?before={cursor}` for newer posts.

**Rate limit:** Reddit API allows ~60 requests per minute for unauthenticated
access. One fetch per wake is fine.

## Filtering Pipeline

Apply these filters to each candidate post, in order:

### Filter 1: Open-for-Hire Signal

- HN "Who Wants to Be Hired?" — **auto-pass** (thread is explicitly opt-in)
- Mastodon — must use `#GetFediHired`, `#HachyJobs`, `#OpenToWork`, or similar
- dev.to — must be in "collabs" category or tagged `lookingforwork`
- Reddit — must have `[For Hire]` flair or title prefix

### Filter 2: Deduplication

```bash
grep -q "^{source}\t{post_id}\t" ~/.cache/fit/basecamp/head-hunter/seen.tsv
```

If found, skip. Otherwise continue.

### Filter 3: Geographic Fit

Look for location mentions. Prefer candidates in or open to:

- **US East Coast** (NYC, Boston, DC, Philadelphia, etc.)
- **UK** (London, Manchester, Edinburgh, etc.)
- **EU** — especially Greece, Poland, Romania, Bulgaria
- **Remote / Anywhere / Global**

Skip candidates explicitly locked to incompatible locations (e.g., "San
Francisco only", "APAC only"). When location is ambiguous or unstated, include
the candidate — let the user decide.

### Filter 4: Skill Alignment

Run `npx fit-pathway skill --list` to get the framework skill inventory. Check
whether the candidate mentions skills that map to framework capabilities:

**Strong signals (forward-deployed track):**
- Multiple industries or domains in background
- Customer-facing project experience
- Data integration, analytics, visualization
- Full-stack development with business context
- Non-traditional path (law, policy, academia → tech)
- AI/ML tool proficiency (Claude, GPT, Cursor, "vibe coding")

**Strong signals (platform track):**
- Infrastructure, cloud platforms, DevOps
- Architecture and system design
- API design, shared services
- Performance, scalability, reliability

**Minimum bar:** At least 2 framework-relevant skills must be identifiable from
the post. Skip candidates with purely non-technical profiles.

### Filter 5: Experience Level

Estimate career level from signals:

| Signal                                      | Likely Level |
| ------------------------------------------- | ------------ |
| "junior", "entry-level", 0-2 years          | J040         |
| "mid-level", 3-5 years                      | J060         |
| "senior", 5-8 years, "lead"                 | J070         |
| "staff", "principal", 8+ years, "architect" | J090+        |

When uncertain, default to J060 with low confidence.

## Prospect Note Format

Write to `knowledge/Candidates/Prospects/{Name}.md`:

```markdown
# {Name}

## Info
**Source:** [{platform}]({permalink})
**Date found:** {YYYY-MM-DD}
**Location:** {location or "Not specified"}
**Estimated level:** {J040–J110} (confidence: {high/medium/low})
**Best track fit:** {forward_deployed / platform / either}
**Match strength:** {strong / moderate}

## Profile
{2-4 sentences: who they are, what they do, why they match. Reference specific
framework skill IDs in parentheses where possible.}

## Framework Alignment
**Matching skills:** {comma-separated skill IDs}
**Key strengths:** {what stands out relative to the framework}
**Gaps:** {notable missing skills for the estimated role}

## Source Post
> {Brief excerpt or summary of the original post — 2-3 lines max}

## Notes
{Additional observations: polymath signals, AI tool usage, unusual background
combinations, anything noteworthy for the user}
```

**Naming:** Use the candidate's display name as given. If only a username is
available, use the username. Never fabricate real names.

## Quality Checklist

- [ ] Selected the least-recently-checked source from cursor.tsv
- [ ] Fetched data using WebFetch (not curl/wget)
- [ ] Applied all 5 filters in order
- [ ] Checked seen.tsv before processing each post
- [ ] Used fit-pathway to benchmark each prospect against a real job
- [ ] Prospect notes follow the standard format
- [ ] Updated cursor.tsv with new position
- [ ] Appended all processed post IDs to seen.tsv
- [ ] Appended new prospects to prospects.tsv
- [ ] Appended wake summary to log.md
- [ ] Wrote triage report to state directory
