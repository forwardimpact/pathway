# Map Supabase Infrastructure

Stand up the Supabase infrastructure that the Map data product needs to run its
ELT pipeline, store raw documents, and serve activity data from database tables.

## Why

Map's activity layer is designed around Supabase — the SQL schema, the ingestion
code, and the query functions all use the Supabase client. But the Supabase
instance itself has no defined infrastructure: there is no configuration for
local development, no edge function deployment, no storage bucket setup, and no
migration runner. Every developer must manually configure Supabase or skip the
activity layer entirely.

This blocks three workflows:

1. **Local development.** Without a local Supabase instance, developers cannot
   run or test the activity pipeline. The ingestion code, transforms, and
   queries all require a Supabase client connected to a real instance.

2. **Edge function deployment.** The ELT pipeline (spec 051) requires edge
   functions for the Extract step (GitHub webhook receiver, GetDX sync
   scheduler, people upload endpoint). There is no deployment configuration or
   development workflow for edge functions.

3. **Synthetic data loading.** The synthetic data pipeline (spec 060) needs to
   write raw documents to Supabase Storage and then run transforms. Without
   infrastructure in place, synthetic data can only be generated as local files
   with no way to exercise the full pipeline.

## What

### Supabase project configuration

A Supabase project configuration lives in `products/map/` and defines
everything needed to run Map's infrastructure locally and deploy to production.

### Database migrations

The existing SQL schema (`activity/migrations/001_activity_schema.sql`) is
executed by Supabase's migration runner. Additional migrations may be added for
indexes, RLS policies, or the `get_team` recursive CTE function.

### Storage bucket

A `raw` storage bucket for the ELT pipeline's Extract phase. Stores individual
raw documents (GitHub webhooks, GetDX API responses, people uploads) as JSON
files organized by source and identifier.

### Edge functions

Four edge functions handle the Extract and Transform phases of the ELT pipeline:

| Function            | Trigger                    | Purpose                                         |
| ------------------- | -------------------------- | ----------------------------------------------- |
| `github-webhook`    | HTTP POST (GitHub webhook) | Extract: store raw webhook, Transform: process  |
| `getdx-sync`        | Scheduled (cron)           | Extract: fetch + store GetDX APIs, Transform    |
| `people-upload`     | HTTP POST (manual)         | Extract: store raw file, Transform: process     |
| `transform`         | HTTP POST (manual/cron)    | Transform: reprocess all raw data               |

### Local development

Supabase CLI provides `supabase start` for local development with a full
Postgres instance, Storage, and Edge Functions runtime. Developers can run the
full ELT pipeline locally.

## Scope

### In scope

- Supabase project initialization in `products/map/`.
- Database migration configuration using the existing SQL schema.
- Storage bucket creation for raw documents.
- Edge function scaffolding for the four ELT entry points.
- Local development setup via `supabase start`.
- Environment configuration for Supabase URL and keys.

### Out of scope

- Modifying the activity database schema (same tables from spec 050).
- Modifying the ELT pipeline logic (see spec 051).
- Production Supabase project provisioning (hosting, billing, DNS).
- Authentication and RLS policies beyond basic service-role access.
- Modifying the query functions in `activity/queries/`.
