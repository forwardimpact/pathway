#!/bin/bash
set -e

# Ad-hoc codesign a macOS .app bundle with entitlements.
#
# Usage: sign-app.sh <app-path> <entitlements-path>

APP_PATH="${1:?Usage: sign-app.sh <app-path> <entitlements-path>}"
ENTITLEMENTS="${2:?Usage: sign-app.sh <app-path> <entitlements-path>}"

if [ ! -d "$APP_PATH" ]; then
  echo "Error: bundle not found at $APP_PATH" >&2
  exit 1
fi

if [ ! -f "$ENTITLEMENTS" ]; then
  echo "Error: entitlements not found at $ENTITLEMENTS" >&2
  exit 1
fi

codesign --force --sign - \
  --entitlements "$ENTITLEMENTS" \
  --deep \
  "$APP_PATH" 2>/dev/null || {
    echo "  Warning: ad-hoc code signing failed (continuing without)" >&2
  }
