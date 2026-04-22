#!/usr/bin/env bash
# Install the GitHub CLI (gh).
# Usage: install-gh.sh [version]
#
# Tries brew first, then falls back to the official tarball. The tarball
# method is preferred over apt-get because sandboxed environments often
# fail GPG key verification.

set -euo pipefail

VERSION="${1:-2.63.2}"

if command -v gh &>/dev/null; then
  echo "gh already installed: $(gh --version | head -1)"
  exit 0
fi

if command -v brew &>/dev/null; then
  brew install gh
  echo "Installed gh via brew: $(gh --version | head -1)"
  exit 0
fi

ARCH=$(dpkg --print-architecture 2>/dev/null || echo "amd64")
URL="https://github.com/cli/cli/releases/download/v${VERSION}/gh_${VERSION}_linux_${ARCH}.tar.gz"

wget -qO- "$URL" | tar -xz -C /tmp
cp "/tmp/gh_${VERSION}_linux_${ARCH}/bin/gh" /usr/local/bin/gh

echo "Installed gh $(gh --version | head -1)"
