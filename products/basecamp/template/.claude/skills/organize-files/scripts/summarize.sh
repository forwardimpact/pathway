#!/bin/bash
# Summarize the contents of ~/Desktop/ and ~/Downloads/.
#
# Usage: bash scripts/summarize.sh
#
# Counts files by type in both directories (top-level only).

set -euo pipefail

for dir in "$HOME/Desktop" "$HOME/Downloads"; do
  [ -d "$dir" ] || continue
  echo "=== $(basename "$dir") ==="
  echo "Screenshots: $(find "$dir" -maxdepth 1 \( -name 'Screenshot*' -o -name 'Screen Shot*' \) 2>/dev/null | wc -l | tr -d ' ')"
  echo "PDFs:        $(find "$dir" -maxdepth 1 -name '*.pdf' 2>/dev/null | wc -l | tr -d ' ')"
  echo "Images:      $(find "$dir" -maxdepth 1 \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.gif' -o -name '*.webp' \) 2>/dev/null | wc -l | tr -d ' ')"
  echo "Documents:   $(find "$dir" -maxdepth 1 \( -name '*.doc*' -o -name '*.txt' -o -name '*.md' -o -name '*.rtf' \) 2>/dev/null | wc -l | tr -d ' ')"
  echo "Archives:    $(find "$dir" -maxdepth 1 \( -name '*.zip' -o -name '*.tar.gz' -o -name '*.rar' \) 2>/dev/null | wc -l | tr -d ' ')"
  echo "Installers:  $(find "$dir" -maxdepth 1 -name '*.dmg' 2>/dev/null | wc -l | tr -d ' ')"
  echo "Other:       $(find "$dir" -maxdepth 1 -type f ! \( -name 'Screenshot*' -o -name 'Screen Shot*' -o -name '*.pdf' -o -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.gif' -o -name '*.webp' -o -name '*.doc*' -o -name '*.txt' -o -name '*.md' -o -name '*.rtf' -o -name '*.zip' -o -name '*.tar.gz' -o -name '*.rar' -o -name '*.dmg' -o -name '.DS_Store' -o -name '.localized' \) 2>/dev/null | wc -l | tr -d ' ')"
  echo ""
done
