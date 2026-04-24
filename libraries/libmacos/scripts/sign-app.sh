#!/bin/bash
set -euo pipefail

# Ad-hoc codesign a macOS .app bundle with Hardened Runtime and entitlements.
#
# Usage: sign-app.sh <app-path> <entitlements-path>
#
# Requires codesign (Xcode command-line tools). Exits non-zero on failure
# unless CODESIGN_ALLOW_FAIL=1 is set (for Linux CI where codesign is absent).

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
  --options runtime \
  --entitlements "$ENTITLEMENTS" \
  --deep \
  "$APP_PATH" 2>/dev/null || {
    if [ "${CODESIGN_ALLOW_FAIL:-0}" = "1" ]; then
      echo "  Warning: codesign unavailable (CODESIGN_ALLOW_FAIL=1)" >&2
    else
      echo "  Error: ad-hoc code signing failed" >&2
      exit 1
    fi
  }
