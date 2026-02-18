---
title: Basecamp
description: Set up camp — a personal knowledge system with scheduled AI tasks that keeps you briefed, organized, and field-ready.
toc: false
---

<div class="hero">
  <div class="page-container">
    <div class="hero-illustration">
      <img src="/assets/heros/basecamp.svg" alt="An engineer, an AI robot, and a business professional setting up an A-frame tent together" />
    </div>
    <h1 class="text-hero">Basecamp</h1>
    <p class="text-subtitle">
      Set up camp. Basecamp is your personal operations center — it syncs
      your email and calendar, builds a knowledge graph, drafts responses,
      prepares meeting briefs, and organizes your files. All running as
      scheduled AI tasks in the background.
    </p>
    <div class="hero-cta">
      <a href="/docs/basecamp/" class="btn btn-primary">Documentation</a>
      <a href="https://www.npmjs.com/package/@forwardimpact/basecamp" class="btn btn-secondary">View on npm</a>
    </div>
  </div>
</div>

<div class="section section-warm">
  <div class="page-container content-product">

<div class="value-box">
<p>
Everything you and your team know, in one place. Basecamp is a scheduler that
runs Claude Code tasks on a timer — syncing data, extracting entities, drafting
emails, preparing for meetings. No server, no database — just plain files,
markdown, and Claude. Your knowledge base is Obsidian-compatible, your config
is JSON, and everything is transparent.
</p>
</div>

### What you get

<ul class="benefits">
<li>Automatic email and calendar sync from Apple Mail and Calendar</li>
<li>A knowledge graph of people, organizations, projects, and topics</li>
<li>AI-drafted email responses that use your full context</li>
<li>Meeting preparation briefings before every call</li>
<li>Presentation generation from markdown to PDF</li>
<li>File organization and cleanup on autopilot</li>
<li>A macOS status menu showing what's running</li>
</ul>

  </div>
</div>

<div class="section">
  <div class="page-container content-product">

### Who it's for

**Busy engineers and managers** who want an AI assistant that actually knows
their context — who they work with, what projects are active, and what's coming
up next.

**Anyone on macOS** who wants a set-and-forget knowledge system that runs
quietly in the background and keeps getting smarter about your work.

---

## Built-in Skills

| Skill                    | What it does                                   |
| ------------------------ | ---------------------------------------------- |
| **Sync Apple Mail**      | Reads email threads from Mail.app via SQLite   |
| **Sync Apple Calendar**  | Reads upcoming events from Calendar.app        |
| **Extract Entities**     | Processes synced data into a knowledge graph   |
| **Draft Emails**         | Writes response drafts using your full context |
| **Meeting Prep**         | Creates briefings before upcoming meetings     |
| **Create Presentations** | Generates PDF slide decks from markdown        |
| **Document Collab**      | Assists with document creation and editing     |
| **Organize Files**       | Cleans up and organizes your files             |

---

## Quick Start

```sh
npx fit-basecamp --init ~/Documents/Team   # Initialize knowledge base
npx fit-basecamp --daemon                   # Start the scheduler
npx fit-basecamp --status                   # Check what's happening
npx fit-basecamp --run sync-mail            # Run a task now
```

  </div>
</div>
