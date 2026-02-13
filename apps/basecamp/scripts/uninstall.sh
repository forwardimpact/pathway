#!/bin/bash
set -e

# Basecamp Uninstaller
#
# Removes the binary, LaunchAgent, and shared data installed by the .pkg.
# User data at ~/Documents/Personal/ and config at ~/.fit/basecamp/ are preserved.

APP_NAME="${1:-fit-basecamp}"
PLIST_NAME="${2:-com.fit-basecamp.scheduler}"

echo ""
echo "Basecamp Uninstaller"
echo "====================="
echo ""

# Remove LaunchAgent
PLIST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
if [ -f "$PLIST" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "  Removed LaunchAgent"
else
  echo "  LaunchAgent not found, skipping."
fi

# Remove binary
if [ -f "/usr/local/bin/$APP_NAME" ]; then
  sudo rm -f "/usr/local/bin/$APP_NAME"
  echo "  Removed /usr/local/bin/$APP_NAME"
else
  echo "  Binary not found at /usr/local/bin/$APP_NAME, skipping."
fi

# Remove shared data (default config template, this uninstall script's installed copy)
if [ -d "/usr/local/share/fit-basecamp" ]; then
  sudo rm -rf "/usr/local/share/fit-basecamp"
  echo "  Removed /usr/local/share/fit-basecamp/"
else
  echo "  Shared data not found, skipping."
fi

# Forget pkg receipt
pkgutil --pkgs 2>/dev/null | grep -q "com.fit-basecamp.scheduler" && {
  sudo pkgutil --forget "com.fit-basecamp.scheduler" >/dev/null 2>&1
  echo "  Removed installer receipt"
} || true

echo ""
echo "Basecamp uninstalled."
echo "Your data at ~/Documents/Personal/ has been preserved."
echo "Your config at ~/.fit/basecamp/ has been preserved."
echo ""
echo "To remove all data:   rm -rf ~/Documents/Personal/"
echo "To remove all config: rm -rf ~/.fit/basecamp/"
echo ""
