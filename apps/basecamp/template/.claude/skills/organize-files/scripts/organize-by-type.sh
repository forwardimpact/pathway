#!/bin/bash
# Organize files in a directory by type into subdirectories.
#
# Usage: bash scripts/organize-by-type.sh <directory>
#
# Creates subdirectories (Documents, Images, Archives, Installers, Screenshots)
# and moves matching files. Only operates on top-level files (-maxdepth 1).
# Prints each move with -v flag. Does NOT delete any files.

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: bash scripts/organize-by-type.sh <directory>" >&2
  exit 1
fi

DIR="$1"

if [ ! -d "$DIR" ]; then
  echo "Error: Directory not found: $DIR" >&2
  exit 1
fi

# Create subdirectories
mkdir -p "$DIR"/{Documents,Images,Archives,Installers,Screenshots}

# Screenshots
find "$DIR" -maxdepth 1 -type f \( -name "Screenshot*" -o -name "Screen Shot*" \) -exec mv -v {} "$DIR/Screenshots/" \;

# Documents
find "$DIR" -maxdepth 1 -type f \( -name "*.pdf" -o -name "*.doc*" -o -name "*.txt" -o -name "*.md" -o -name "*.rtf" -o -name "*.csv" -o -name "*.xlsx" \) -exec mv -v {} "$DIR/Documents/" \;

# Images (excluding screenshots already moved)
find "$DIR" -maxdepth 1 -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.webp" \) -exec mv -v {} "$DIR/Images/" \;

# Archives
find "$DIR" -maxdepth 1 -type f \( -name "*.zip" -o -name "*.tar.gz" -o -name "*.rar" \) -exec mv -v {} "$DIR/Archives/" \;

# Installers
find "$DIR" -maxdepth 1 -type f -name "*.dmg" -exec mv -v {} "$DIR/Installers/" \;

echo "Organization complete: $DIR"
