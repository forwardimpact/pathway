# Monorepo command runner — run `just --list` to list recipes.

set dotenv-load
set quiet

ARGS := ""

# ── Core ──────────────────────────────────────────────────────────

# Pull latest agent memory from wiki
wiki-pull:
    bash scripts/wiki-sync.sh pull

# Commit and push agent memory to wiki
wiki-push:
    bash scripts/wiki-sync.sh push

# Install dependencies and tooling
install: wiki-pull install-bun install-gh

# Install bun dependencies and generate code
install-bun:
    bun install --frozen-lockfile
    bunx --workspace=@forwardimpact/libcodegen fit-codegen --all

# Install the GitHub CLI (gh)
install-gh:
    bash scripts/install-gh.sh

# Bootstrap from scratch
quickstart: env-setup synthetic data-init codegen process-fast _quickstart-seed
    echo ""
    echo "=== Quickstart complete ==="
    printf "  Knowledge files: %s\n" "$(find data/knowledge -name '*.html' 2>/dev/null | wc -l | tr -d ' ')"
    printf "  Resources:       %s\n" "$(find data/resources -type f 2>/dev/null | wc -l | tr -d ' ')"
    printf "  Graph indices:   %s\n" "$(find data/graphs -type f 2>/dev/null | wc -l | tr -d ' ')"
    echo ""
    echo "Next: just rc-start && just cli-chat"

# Conditionally seed if Docker is running
_quickstart-seed:
    #!/usr/bin/env bash
    if timeout 3 docker info --format '{{"{{"}}.ID{{"}}"}}' >/dev/null 2>&1; then
      echo "Docker detected — seeding activity database..."
      just supabase-up && just supabase-migrate && just seed
    else
      echo "Docker not running — skipping activity seed (run 'just seed-full' later)"
    fi

# ── Synthetic ─────────────────────────────────────────────────────

# Generate synthetic data (cached prose)
synthetic:
    bunx fit-terrain
    bunx fit-map generate-index

# Generate synthetic data with LLM and update prose cache
synthetic-update:
    bunx fit-terrain --generate
    bunx fit-map generate-index

# Generate synthetic data (structural only, no prose)
synthetic-no-prose:
    bunx fit-terrain --no-prose
    bunx fit-map generate-index

# Generate all (types, services, clients)
codegen:
    bunx --workspace=@forwardimpact/libcodegen fit-codegen --all

# Generate types only
codegen-type:
    bunx --workspace=@forwardimpact/libcodegen fit-codegen --type

# Generate clients only
codegen-client:
    bunx --workspace=@forwardimpact/libcodegen fit-codegen --client

# Generate service bases only
codegen-service:
    bunx --workspace=@forwardimpact/libcodegen fit-codegen --service

# Generate definitions only
codegen-definition:
    bunx --workspace=@forwardimpact/libcodegen fit-codegen --definition

# ── Process ───────────────────────────────────────────────────────

# Process all resources
process: export-framework process-resources process-graphs process-vectors

# Process without vectors
process-fast: export-framework process-resources process-graphs

# Export framework entities to HTML/microdata
export-framework:
    bunx --workspace=@forwardimpact/map fit-map export

# Process knowledge resources
process-resources:
    bunx --workspace=@forwardimpact/libresource fit-process-resources

# Process vector indices
process-vectors:
    bunx --workspace=@forwardimpact/libvector fit-process-vectors

# Process graph indices
process-graphs:
    bunx --workspace=@forwardimpact/libgraph fit-process-graphs

# ── Data ──────────────────────────────────────────────────────────

# Initialize data directories
data-init:
    mkdir -p generated data/cli data/eval data/graphs data/ingest/in data/ingest/pipeline data/ingest/done data/knowledge data/logs data/memories data/policies data/resources data/traces data/vectors data/teams-tenant-configs data/teams-resource-ids data/tenants data/activity data/pathway data/personal

# Remove generated data
data-clean:
    rm -rf generated data/cli data/eval data/logs data/graphs data/knowledge data/memories data/policies data/resources data/traces data/vectors data/teams-tenant-configs data/teams-resource-ids data/tenants

# Clean, init, and regenerate code
data-reset: data-clean data-init codegen

# ── Services ──────────────────────────────────────────────────────

# Start services via rc
rc-start:
    bunx fit-rc start

# Stop services via rc
rc-stop:
    bunx fit-rc stop

# Restart services via rc
rc-restart:
    bunx fit-rc restart

# Show service status
rc-status:
    bunx fit-rc status

# ── CLI ───────────────────────────────────────────────────────────

# Agent conversations
cli-chat:
    bunx fit-guide {{ARGS}}

# Vector similarity search
cli-search:
    bunx --workspace=@forwardimpact/libvector fit-search {{ARGS}}

# Graph triple pattern queries
cli-query:
    bunx --workspace=@forwardimpact/libgraph fit-query {{ARGS}}

# List graph subjects by type
cli-subjects:
    bunx --workspace=@forwardimpact/libgraph fit-subjects {{ARGS}}

# Trace visualization
cli-visualize:
    bunx --workspace=@forwardimpact/libtelemetry fit-visualize {{ARGS}}

# Token counting
cli-tiktoken:
    bunx --workspace=@forwardimpact/libutil fit-tiktoken {{ARGS}}

# Unary gRPC calls
cli-unary:
    bunx --workspace=@forwardimpact/librpc fit-unary {{ARGS}}

# XmR control chart analysis
cli-xmr:
    bunx --workspace=@forwardimpact/libxmr fit-xmr {{ARGS}}

# ── Docs ──────────────────────────────────────────────────────────

# Build documentation
docs-build:
    bunx --workspace=@forwardimpact/libdoc docs-build

# Serve documentation
docs-serve:
    bunx --workspace=@forwardimpact/libdoc docs-serve

# Serve with live reload
docs-watch:
    bunx --workspace=@forwardimpact/libdoc docs-serve --watch

# ── Quality ───────────────────────────────────────────────────────

# Enforce instruction layer limits (KATA.md § Instruction length)
check-instructions:
    node scripts/check-instructions.mjs

# Run security audit (vulnerability + secret scanning)
audit: audit-vulnerabilities audit-secrets

# Check dependencies for known vulnerabilities
audit-vulnerabilities:
    #!/usr/bin/env bash
    set -euo pipefail
    # Replace bun workspace protocol with plain wildcard for npm compatibility
    find . -name package.json -not -path '*/node_modules/*' -exec \
      sed -i 's/"workspace:\*"/"*"/g' {} +
    npm install --package-lock-only --ignore-scripts 2>/dev/null
    npm audit --audit-level=high --omit=dev --workspaces
    rm -f package-lock.json
    git checkout -- '*/package.json' package.json 2>/dev/null || true

# Scan repository for leaked secrets
audit-secrets:
    #!/usr/bin/env bash
    if command -v gitleaks >/dev/null 2>&1; then
        gitleaks detect --source . --verbose
    else
        echo "Error: gitleaks not installed — install it (brew install gitleaks) or skip with: just audit-vulnerabilities" >&2
        exit 1
    fi

# ── Environment ───────────────────────────────────────────────────

# Set up all environment secrets and storage config
env-setup: env-reset env-secrets env-storage

# Reset environment config from examples
env-reset PROFILE="local": config-reset
    cp -f .env.{{PROFILE}}.example .env

# Generate service and JWT secrets
env-secrets:
    bun scripts/env-secrets.js

# Generate storage backend credentials
env-storage:
    bun scripts/env-storage.js

# GitHub token utility
env-github:
    bun scripts/env-github.js

# Reset config files from examples
# config/config.example.json was removed in spec 580 (commit a353a4ab); cp removed accordingly.
# Agent example loop is guarded and safe if config/agents/ is absent.
config-reset:
    #!/usr/bin/env bash
    for file in config/agents/*.agent.example.md; do [ -f "$file" ] && cp -f "$file" "${file%.example.md}.md" || true; done

# Download generated code bundle from S3
download-bundle:
    bunx --workspace=@forwardimpact/libutil fit-download-bundle

# ── Docker ────────────────────────────────────────────────────────

# Build Docker images
docker-build:
    . ./.env.build && docker --log-level debug compose build --no-cache

# Start Docker Compose (core services only)
docker-up:
    docker compose up

# Start Docker Compose with MinIO storage
docker-up-minio:
    docker compose --profile minio up

# Start Docker Compose with Supabase
docker-up-supabase:
    docker compose --profile supabase up

# Stop Docker Compose
docker-down:
    docker compose --profile minio --profile supabase down

# ── Storage ───────────────────────────────────────────────────────

# Full setup (start, wait, init, upload)
storage-setup: storage-start storage-wait storage-init storage-upload

# Start storage backend containers
storage-start PROFILE="minio":
    docker compose --profile {{PROFILE}} up -d storage-{{PROFILE}}

# Stop storage backend containers
storage-stop:
    docker compose --profile minio --profile supabase down

# Wait for storage to be ready
storage-wait:
    bunx --workspace=@forwardimpact/libstorage fit-storage wait

# Create bucket in storage backend
storage-init:
    bunx --workspace=@forwardimpact/libstorage fit-storage create-bucket

# Upload data to storage backend
storage-upload:
    bunx --workspace=@forwardimpact/libstorage fit-storage upload

# Download data from storage backend
storage-download:
    bunx --workspace=@forwardimpact/libstorage fit-storage download

# List storage contents
storage-list:
    bunx --workspace=@forwardimpact/libstorage fit-storage list

# ── Activity Seed ─────────────────────────────────────────────────

# Seed the activity database from synthetic data (requires Supabase running)
seed:
    bunx fit-map activity seed

# Full synthetic-to-database workflow
seed-full: supabase-up supabase-migrate synthetic seed

# ── Supabase ──────────────────────────────────────────────────────

# Install Supabase CLI (brew)
supabase-install:
    #!/usr/bin/env bash
    which supabase >/dev/null 2>&1 || brew install supabase/tap/supabase

# Start local Supabase instance
supabase-up:
    cd products/map && supabase start --workdir .

# Stop local Supabase instance
supabase-down:
    cd products/map && supabase stop --workdir .

# Start Supabase via fit-rc (oneshot)
supabase-start:
    bunx fit-rc start supabase

# Stop Supabase via fit-rc (oneshot)
supabase-stop:
    bunx fit-rc stop supabase

# Run Map database migrations
supabase-migrate:
    cd products/map && supabase db reset --workdir .

# Supabase health check
supabase-status:
    #!/usr/bin/env bash
    curl -sf http://127.0.0.1:54321/rest/v1/ >/dev/null && echo "supabase: ok" || echo "supabase: not running"

# Start Supabase and run migrations
supabase-setup: supabase-up

# ── TEI ───────────────────────────────────────────────────────────

# Install TEI binary via cargo
tei-install:
    cargo install --git https://github.com/huggingface/text-embeddings-inference --features candle text-embeddings-router

# Start TEI embedding service (foreground, Ctrl-C to stop)
tei-start:
    text-embeddings-router --model-id BAAI/bge-small-en-v1.5 --port 8090 --json-output
