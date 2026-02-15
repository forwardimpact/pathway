#!/bin/bash
set -e

# Basecamp Init (development / repo context)
#
# Sets up scheduler config and default knowledge base for local development.
# The compiled binary and LaunchAgent are installed via the .pkg installer.
#
# This script is for engineers running from the repo with deno or node.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASECAMP_HOME="$HOME/.fit/basecamp"
DEFAULT_KB="$HOME/Documents/Personal"

echo ""
echo "Basecamp Init (dev)"
echo "==================="
echo ""

# ---------------------------------------------------------------------------
# 1. Set up scheduler home
# ---------------------------------------------------------------------------

echo "Setting up scheduler home at $BASECAMP_HOME ..."
mkdir -p "$BASECAMP_HOME/logs"

# ---------------------------------------------------------------------------
# 2. Copy scheduler config (single source of truth: config/scheduler.json)
# ---------------------------------------------------------------------------

CONFIG_SRC=""
if [ -f "$SCRIPT_DIR/../config/scheduler.json" ]; then
  CONFIG_SRC="$SCRIPT_DIR/../config/scheduler.json"
fi

if [ ! -f "$BASECAMP_HOME/scheduler.json" ]; then
  if [ -n "$CONFIG_SRC" ]; then
    cp "$CONFIG_SRC" "$BASECAMP_HOME/scheduler.json"
    echo "  Created $BASECAMP_HOME/scheduler.json"
  else
    echo "  Warning: config/scheduler.json not found, skipping config setup."
  fi
else
  echo "  Scheduler config already exists, skipping."
fi

# ---------------------------------------------------------------------------
# 3. Initialize state file
# ---------------------------------------------------------------------------

if [ ! -f "$BASECAMP_HOME/state.json" ]; then
  echo '{ "tasks": {} }' > "$BASECAMP_HOME/state.json"
  echo "  Created $BASECAMP_HOME/state.json"
fi

# ---------------------------------------------------------------------------
# 4. Initialize default knowledge base
# ---------------------------------------------------------------------------

echo ""
if [ ! -d "$DEFAULT_KB" ]; then
  echo "Initializing default knowledge base at $DEFAULT_KB ..."
  SCHEDULER="$SCRIPT_DIR/../basecamp.js"
  if command -v deno &>/dev/null && [ -f "$SCHEDULER" ]; then
    deno run --allow-all "$SCHEDULER" --init "$DEFAULT_KB"
  elif command -v node &>/dev/null && [ -f "$SCHEDULER" ]; then
    node "$SCHEDULER" --init "$DEFAULT_KB"
  else
    echo "  Neither deno nor node found, skipping KB initialization."
  fi
else
  echo "Basecamp already initialized at $DEFAULT_KB/"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
echo "Done! Basecamp is initialized."
echo ""
echo "  Config:       $BASECAMP_HOME/scheduler.json"
echo "  Knowledge:    $DEFAULT_KB/"
echo "  Logs:         $BASECAMP_HOME/logs/"
echo ""
echo "Next steps:"
echo "  1. Edit $DEFAULT_KB/USER.md with your name, email, and domain"
echo "  2. Edit $BASECAMP_HOME/scheduler.json to configure tasks"
echo "  3. Open your KB:         cd $DEFAULT_KB && claude"
echo ""
