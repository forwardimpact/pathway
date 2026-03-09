# Plan: Map Supabase Infrastructure

How to build out the Supabase infrastructure described in `spec.md`.

## Directory Structure

Supabase project files live in `products/map/` alongside the existing code.
The Supabase CLI expects `supabase/` at the project root, so we initialize
there.

```
products/map/
  supabase/
    config.toml                     Supabase project configuration
    migrations/
      20250101000000_activity_schema.sql   Renamed from 001_activity_schema.sql
      20250101000001_get_team_function.sql  Recursive CTE function
      20250101000002_raw_bucket.sql         Storage bucket creation
    functions/
      github-webhook/
        index.ts                    GitHub webhook Extract + Transform
      getdx-sync/
        index.ts                    GetDX API Extract + Transform
      people-upload/
        index.ts                    People file Extract + Transform
      transform/
        index.ts                    Full Transform reprocessor
      _shared/
        supabase.ts                 Shared Supabase client initialization
        cors.ts                     CORS headers
  activity/                         Existing — unchanged
    migrations/                     Kept for reference, canonical copy moves to supabase/migrations/
    extract/                        ELT Extract functions (from spec 051)
    transform/                      ELT Transform functions (from spec 051)
    queries/                        Existing query functions
    storage.js                      Raw storage helpers (from spec 051)
  bin/fit-map.js                    Existing CLI
  src/                              Existing pure layer
```

## Supabase Configuration

### config.toml

```toml
[project]
id = "map"

[api]
enabled = true
port = 54321
schemas = ["public", "activity"]
extra_search_path = ["public", "activity"]

[db]
port = 54322
shadow_port = 54320
major_version = 15

[db.pooler]
enabled = false

[storage]
enabled = true
file_size_limit = "50MiB"

[auth]
enabled = false

[edge_runtime]
enabled = true
policy = "per_worker"
inspector_port = 8083

[analytics]
enabled = false
```

Auth is disabled — Map uses service-role keys. Analytics is disabled for
simplicity. Storage is enabled with a 50 MiB limit (raw webhook documents
are typically <100 KB each).

## Database Migrations

### Activity schema (existing)

The existing `001_activity_schema.sql` is renamed to follow Supabase's
timestamp-based migration convention:

```
supabase/migrations/20250101000000_activity_schema.sql
```

Content is identical to `activity/migrations/001_activity_schema.sql`.

### get_team recursive function

The `getTeam()` query function calls `supabase.rpc('get_team', ...)`. This
requires a PL/pgSQL function in the database:

```sql
-- supabase/migrations/20250101000001_get_team_function.sql

CREATE OR REPLACE FUNCTION activity.get_team(root_email TEXT)
RETURNS SETOF activity.organization_people
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE team AS (
    SELECT * FROM activity.organization_people WHERE email = root_email
    UNION ALL
    SELECT p.* FROM activity.organization_people p
    JOIN team t ON p.manager_email = t.email
  )
  SELECT * FROM team;
$$;
```

### Raw storage bucket

```sql
-- supabase/migrations/20250101000002_raw_bucket.sql

INSERT INTO storage.buckets (id, name, public)
VALUES ('raw', 'raw', false)
ON CONFLICT (id) DO NOTHING;
```

The bucket is private — only service-role access. No RLS policies needed
because edge functions use the service-role key.

## Edge Functions

Edge functions are Deno-based TypeScript files that Supabase deploys as
serverless functions. They import the Map activity modules (Extract and
Transform) and wire them to HTTP or cron triggers.

### Shared Supabase client

```typescript
// products/map/supabase/functions/_shared/supabase.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function createSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}
```

### GitHub webhook function

Receives GitHub webhook POST requests, runs Extract (store raw payload), then
Transform (process into events + artifacts).

```typescript
// products/map/supabase/functions/github-webhook/index.ts

import { createSupabaseClient } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const deliveryId = req.headers.get('X-GitHub-Delivery')
  const eventType = req.headers.get('X-GitHub-Event')
  const signature = req.headers.get('X-Hub-Signature-256')

  if (!deliveryId || !eventType) {
    return new Response('Missing required GitHub headers', { status: 400 })
  }

  const payload = await req.json()
  const supabase = createSupabaseClient()

  // Extract: store raw webhook
  const rawPath = `github/${deliveryId}.json`
  const document = JSON.stringify({
    delivery_id: deliveryId,
    event_type: eventType,
    received_at: new Date().toISOString(),
    payload
  })

  const { error: storeError } = await supabase.storage
    .from('raw')
    .upload(rawPath, document, {
      contentType: 'application/json',
      upsert: true
    })

  if (storeError) {
    return new Response(JSON.stringify({ error: storeError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Transform: process webhook into events + artifacts
  // Import transform logic at the edge
  const eventRow = {
    delivery_id: deliveryId,
    event_type: eventType,
    action: payload.action || null,
    repository: payload.repository?.full_name || 'unknown',
    sender_github_username: payload.sender?.login || null,
    occurred_at: payload.created_at || new Date().toISOString(),
    raw: payload
  }

  const { error: eventError } = await supabase
    .from('github_events')
    .upsert(eventRow, { onConflict: 'delivery_id' })

  // Extract artifacts and store them
  const artifacts = extractArtifacts(eventType, payload)
  let artifactCount = 0

  for (const artifact of artifacts) {
    const { data: person } = await supabase
      .from('organization_people')
      .select('email')
      .eq('github_username', artifact.github_username)
      .single()

    const { error } = await supabase
      .from('github_artifacts')
      .upsert({
        ...artifact,
        email: person?.email || null
      }, { onConflict: 'external_id' })

    if (!error) artifactCount++
  }

  return new Response(JSON.stringify({
    event: !eventError,
    artifacts: artifactCount,
    raw: rawPath
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
})

// Artifact extraction (same logic as activity/transform/github.js)
function extractArtifacts(eventType: string, payload: any) {
  switch (eventType) {
    case 'pull_request': return extractPR(payload)
    case 'pull_request_review': return extractReview(payload)
    case 'push': return extractCommits(payload)
    default: return []
  }
}

function extractPR(payload: any) {
  const pr = payload.pull_request
  if (!pr) return []
  return [{
    artifact_type: 'pull_request',
    external_id: `pr:${payload.repository.full_name}#${pr.number}`,
    repository: payload.repository.full_name,
    github_username: pr.user?.login || null,
    occurred_at: pr.created_at || pr.updated_at,
    metadata: {
      number: pr.number, title: pr.title, state: pr.state,
      additions: pr.additions, deletions: pr.deletions,
      changed_files: pr.changed_files, merged: pr.merged || false,
      base_branch: pr.base?.ref, head_branch: pr.head?.ref
    },
    raw: pr
  }]
}

function extractReview(payload: any) {
  const review = payload.review
  if (!review) return []
  return [{
    artifact_type: 'review',
    external_id: `review:${payload.repository.full_name}#${payload.pull_request?.number}:${review.id}`,
    repository: payload.repository.full_name,
    github_username: review.user?.login || null,
    occurred_at: review.submitted_at,
    metadata: {
      pr_number: payload.pull_request?.number,
      state: review.state,
      body_length: review.body?.length || 0
    },
    raw: review
  }]
}

function extractCommits(payload: any) {
  return (payload.commits || []).map((commit: any) => ({
    artifact_type: 'commit',
    external_id: `commit:${payload.repository.full_name}:${commit.id}`,
    repository: payload.repository.full_name,
    github_username: payload.sender?.login || null,
    occurred_at: commit.timestamp,
    metadata: {
      sha: commit.id, message: commit.message,
      added: commit.added?.length || 0,
      removed: commit.removed?.length || 0,
      modified: commit.modified?.length || 0
    },
    raw: commit
  }))
}
```

### GetDX sync function

Triggered on a schedule (or manually) to fetch GetDX data.

```typescript
// products/map/supabase/functions/getdx-sync/index.ts

import { createSupabaseClient } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const supabase = createSupabaseClient()
  const apiToken = Deno.env.get('GETDX_API_TOKEN')!
  const baseUrl = Deno.env.get('GETDX_BASE_URL') || 'https://api.getdx.com'
  const timestamp = new Date().toISOString()
  const results = { files: [] as string[], errors: [] as string[] }

  // Extract: fetch and store raw API responses
  try {
    // teams.list
    const teamsResponse = await fetchGetDX('/teams.list', apiToken, baseUrl)
    await storeRaw(supabase, `getdx/teams-list/${timestamp}.json`, teamsResponse)
    results.files.push(`getdx/teams-list/${timestamp}.json`)

    // snapshots.list
    const snapshotsResponse = await fetchGetDX('/snapshots.list', apiToken, baseUrl)
    await storeRaw(supabase, `getdx/snapshots-list/${timestamp}.json`, snapshotsResponse)
    results.files.push(`getdx/snapshots-list/${timestamp}.json`)

    // snapshots.info for each snapshot
    for (const snapshot of snapshotsResponse.snapshots || []) {
      if (snapshot.deleted_at) continue
      const infoResponse = await fetchGetDX(
        `/snapshots.info?snapshot_id=${encodeURIComponent(snapshot.id)}`,
        apiToken, baseUrl
      )
      await storeRaw(supabase, `getdx/snapshots-info/${snapshot.id}.json`, infoResponse)
      results.files.push(`getdx/snapshots-info/${snapshot.id}.json`)
    }
  } catch (err) {
    results.errors.push((err as Error).message)
  }

  // Transform: process stored responses into DB rows
  // (Transform logic reads from storage and writes to DB tables)
  // Implemented via the transform edge function or inline here

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  })
})

async function fetchGetDX(endpoint: string, token: string, baseUrl: string) {
  const url = new URL(endpoint, baseUrl)
  const response = await fetch(url.href, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!response.ok) {
    throw new Error(`GetDX ${endpoint}: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

async function storeRaw(supabase: any, path: string, data: any) {
  const { error } = await supabase.storage
    .from('raw')
    .upload(path, JSON.stringify(data), {
      contentType: 'application/json',
      upsert: true
    })
  if (error) throw new Error(`storeRaw(${path}): ${error.message}`)
}
```

### People upload function

```typescript
// products/map/supabase/functions/people-upload/index.ts

import { createSupabaseClient } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const contentType = req.headers.get('Content-Type') || ''
  const isCSV = contentType.includes('text/csv')
  const format = isCSV ? 'csv' : 'yaml'
  const ext = isCSV ? 'csv' : 'yaml'
  const body = await req.text()
  const timestamp = new Date().toISOString()

  const supabase = createSupabaseClient()

  // Extract: store raw file
  const path = `people/${timestamp}.${ext}`
  const { error: storeError } = await supabase.storage
    .from('raw')
    .upload(path, body, {
      contentType: isCSV ? 'text/csv' : 'application/x-yaml',
      upsert: true
    })

  if (storeError) {
    return new Response(JSON.stringify({ error: storeError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Transform: process into organization_people table
  // (Parse and upsert logic same as activity/transform/people.js)

  return new Response(JSON.stringify({ stored: true, path }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### Transform function

A standalone function that reprocesses all raw data through the Transform step.
Useful for replaying after transform logic changes.

```typescript
// products/map/supabase/functions/transform/index.ts

import { createSupabaseClient } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const supabase = createSupabaseClient()
  const results = {
    people: { imported: 0, errors: [] as string[] },
    getdx: { teams: 0, snapshots: 0, scores: 0, errors: [] as string[] },
    github: { events: 0, artifacts: 0, errors: [] as string[] }
  }

  // Transform in dependency order: people → getdx → github

  // 1. People (must be first for email resolution)
  // Read latest people file from storage, parse, upsert

  // 2. GetDX teams and snapshots
  // Read latest teams-list, transform into getdx_teams
  // Read latest snapshots-list, transform into getdx_snapshots
  // Read all snapshots-info, transform into getdx_snapshot_team_scores

  // 3. GitHub
  // Read all github/ webhook documents, transform into events + artifacts

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

## Local Development

### Setup

```sh
cd products/map

# Install Supabase CLI (if not already installed)
brew install supabase/tap/supabase

# Start local Supabase (runs Postgres, Storage, Edge Functions)
supabase start

# Run migrations
supabase db reset

# Seed with synthetic data (after spec 060 pipeline generates raw documents)
# The synthetic pipeline writes to Supabase Storage via the same storeRaw interface
```

### Environment variables

Local development uses the Supabase CLI's default credentials:

```sh
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<generated by supabase start>
SUPABASE_ANON_KEY=<generated by supabase start>
```

For GetDX sync (edge function):

```sh
GETDX_API_TOKEN=<your GetDX API token>
GETDX_BASE_URL=https://api.getdx.com
```

### npm scripts

Add to `products/map/package.json`:

```json
{
  "scripts": {
    "supabase:start": "supabase start",
    "supabase:stop": "supabase stop",
    "supabase:reset": "supabase db reset",
    "supabase:functions": "supabase functions serve"
  }
}
```

## Implementation Phases

### Phase 1 — Supabase project initialization

1. Install Supabase CLI as a dev dependency or document `brew install`.
2. Run `supabase init` in `products/map/`.
3. Configure `config.toml` with activity schema and storage.
4. Move `001_activity_schema.sql` to timestamped migration format.
5. Add `get_team` function migration.
6. Add `raw` bucket migration.
7. Verify `supabase start` + `supabase db reset` works locally.

### Phase 2 — Edge function scaffolding

1. Create `_shared/supabase.ts` with client initialization.
2. Create `github-webhook/index.ts` with Extract + Transform.
3. Create `getdx-sync/index.ts` with Extract + Transform.
4. Create `people-upload/index.ts` with Extract + Transform.
5. Create `transform/index.ts` as a full reprocessor.
6. Verify edge functions serve locally via `supabase functions serve`.

### Phase 3 — Integration with ELT (spec 051)

1. Edge functions call the Extract functions from `activity/extract/`.
2. Edge functions call the Transform functions from `activity/transform/`.
3. The `transform` function calls `transformAll()` from the orchestrator.
4. Verify full pipeline: webhook → raw storage → DB tables.

### Phase 4 — Integration with synthetic data (spec 060)

1. The synthetic pipeline writes raw documents directly to Supabase Storage
   using the same bucket paths.
2. Calling the `transform` edge function (or `transformAll()` directly)
   processes synthetic raw data into DB tables.
3. Verify synthetic data flows through the same Transform path as real data.
