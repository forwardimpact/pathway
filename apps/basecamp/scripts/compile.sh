#!/bin/bash
set -e

# Compile Basecamp into a standalone Deno binary.
#
# Usage: compile.sh <dist_dir> <app_name> <target>
#   e.g.  compile.sh dist basecamp aarch64-apple-darwin

DIST_DIR="${1:?Usage: compile.sh <dist_dir> <app_name> <target>}"
APP_NAME="${2:?Usage: compile.sh <dist_dir> <app_name> <target>}"
TARGET="${3:?Usage: compile.sh <dist_dir> <app_name> <target>}"

OUTPUT="$DIST_DIR/$APP_NAME-$TARGET"

echo ""
echo "Compiling $APP_NAME for $TARGET..."
mkdir -p "$DIST_DIR"

deno compile \
  --allow-all \
  --target "$TARGET" \
  --output "$OUTPUT" \
  --include template/ \
  scheduler.js

echo "  -> $OUTPUT"
