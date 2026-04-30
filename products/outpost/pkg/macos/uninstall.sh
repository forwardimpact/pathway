#!/bin/bash
set -e

# Outpost Uninstaller
#
# Removes Outpost.app and any remaining old artifacts.
# User data at ~/Documents/Personal/ and config at ~/.fit/outpost/
# are preserved.

echo ""
echo "Outpost Uninstaller"
echo "====================="
echo ""

# --- Stop running processes --------------------------------------------------

# Try graceful shutdown first (stops running agents cleanly), then killall as fallback.
if [ -f "/Applications/Outpost.app/Contents/MacOS/fit-outpost" ]; then
  /Applications/Outpost.app/Contents/MacOS/fit-outpost stop 2>/dev/null || true
fi
killall Outpost 2>/dev/null || true
killall fit-outpost 2>/dev/null || true
killall OutpostStatus 2>/dev/null || true
# Legacy Basecamp processes (pre-rename) — kept for upgrade cleanup.
killall Basecamp 2>/dev/null || true
killall fit-basecamp 2>/dev/null || true
killall BasecampStatus 2>/dev/null || true

# --- Remove any leftover LaunchAgents (from older versions) ------------------

# Includes legacy basecamp labels so users upgrading from Basecamp get a clean state.
for LABEL in \
    "com.forwardimpact.outpost" "com.fit-outpost.scheduler" "com.fit-outpost.status-menu" \
    "com.forwardimpact.basecamp" "com.fit-basecamp.scheduler" "com.fit-basecamp.status-menu"; do
  PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
  if [ -f "$PLIST" ]; then
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "  Removed old LaunchAgent ($LABEL)"
  fi
done

# --- Remove stale socket file -----------------------------------------------

rm -f "$HOME/.fit/outpost/outpost.sock"

# --- Remove Outpost.app ----------------------------------------------------

if [ -d "/Applications/Outpost.app" ]; then
  sudo rm -rf "/Applications/Outpost.app"
  echo "  Removed /Applications/Outpost.app"
elif [ -d "$HOME/Applications/Outpost.app" ]; then
  rm -rf "$HOME/Applications/Outpost.app"
  echo "  Removed ~/Applications/Outpost.app"
else
  echo "  Outpost.app not found, skipping."
fi

# --- Remove CLI symlink and old loose binaries -------------------------------

for BIN in "/usr/local/bin/fit-outpost" "/usr/local/bin/OutpostStatus"; do
  if [ -f "$BIN" ] || [ -L "$BIN" ]; then
    sudo rm -f "$BIN"
    echo "  Removed $BIN"
  fi
done

# --- Remove old shared data -------------------------------------------------

if [ -d "/usr/local/share/fit-outpost" ]; then
  sudo rm -rf "/usr/local/share/fit-outpost"
  echo "  Removed /usr/local/share/fit-outpost/"
fi

# --- Forget pkg receipts ----------------------------------------------------

# Legacy basecamp receipts kept for upgrade cleanup.
for RECEIPT in \
    "team.forwardimpact.outpost" "com.forwardimpact.outpost" "com.fit-outpost.scheduler" \
    "team.forwardimpact.basecamp" "com.forwardimpact.basecamp" "com.fit-basecamp.scheduler"; do
  pkgutil --pkgs 2>/dev/null | grep -q "$RECEIPT" && {
    sudo pkgutil --forget "$RECEIPT" >/dev/null 2>&1
    echo "  Removed installer receipt ($RECEIPT)"
  } || true
done

echo ""
echo "Outpost uninstalled."
echo "Your data at ~/Documents/Personal/ has been preserved."
echo "Your config at ~/.fit/outpost/ has been preserved."
echo ""
echo "To remove all data:   rm -rf ~/Documents/Personal/"
echo "To remove all config: rm -rf ~/.fit/outpost/"
echo ""
