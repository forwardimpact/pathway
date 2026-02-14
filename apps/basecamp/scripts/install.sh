#!/bin/bash
set -e

# Basecamp Installer (development / repo context)
#
# Sets up scheduler config, default knowledge base, and LaunchAgent for local
# development. The compiled binary is installed via the .pkg installer instead.
#
# This script is for engineers running from the repo with deno or node.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="fit-basecamp"
BASECAMP_HOME="$HOME/.fit/basecamp"
DEFAULT_KB="$HOME/Documents/Personal"

echo ""
echo "Basecamp Installer (dev)"
echo "========================"
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
# 5. Install LaunchAgent
# ---------------------------------------------------------------------------

echo ""
echo "Installing background scheduler (LaunchAgent)..."
SCHEDULER="$SCRIPT_DIR/../basecamp.js"
if command -v deno &>/dev/null && [ -f "$SCHEDULER" ]; then
  deno run --allow-all "$SCHEDULER" --install-launchd
elif command -v node &>/dev/null && [ -f "$SCHEDULER" ]; then
  node "$SCHEDULER" --install-launchd
else
  echo "  Neither deno nor node found, skipping LaunchAgent install."
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
echo "Done! Basecamp is installed."
echo ""
echo "  Config:       $BASECAMP_HOME/scheduler.json"
echo "  Knowledge:    $DEFAULT_KB/"
echo "  Logs:         $BASECAMP_HOME/logs/"
echo ""
echo "Next steps:"
echo "  1. Edit $DEFAULT_KB/USER.md with your name, email, and domain"
echo "  2. Edit $BASECAMP_HOME/scheduler.json to configure tasks"
echo "  3. Run the scheduler:    deno run --allow-all basecamp.js --status"
echo "  4. Start the daemon:     deno run --allow-all basecamp.js --install-launchd"
echo "  5. Open your KB:         cd $DEFAULT_KB && claude"
echo ""
