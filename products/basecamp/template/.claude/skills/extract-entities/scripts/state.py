#!/usr/bin/env python3
"""Manage graph_processed state for entity extraction.

Commands:
  check   - Find unprocessed or changed source files
  update  - Mark a file as processed (updates its hash in state)

Usage:
  python3 scripts/state.py check                    # List new/changed files
  python3 scripts/state.py update <file-path>        # Mark file as processed
  python3 scripts/state.py update <file1> <file2> …  # Mark multiple files

State file: ~/.cache/fit/basecamp/state/graph_processed (TSV: path<TAB>hash)
"""

import hashlib
import os
import sys
from pathlib import Path

STATE_FILE = Path.home() / ".cache/fit/basecamp/state/graph_processed"
SOURCE_DIRS = [
    Path.home() / ".cache/fit/basecamp/apple_mail",
    Path.home() / ".cache/fit/basecamp/apple_calendar",
]


def file_hash(path):
    """Compute SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def load_state():
    """Load the state file into a dict of {path: hash}."""
    state = {}
    if STATE_FILE.exists():
        for line in STATE_FILE.read_text().splitlines():
            parts = line.split("\t", 1)
            if len(parts) == 2:
                state[parts[0]] = parts[1]
    return state


def save_state(state):
    """Write the full state dict back to the state file."""
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"{path}\t{h}" for path, h in sorted(state.items())]
    STATE_FILE.write_text("\n".join(lines) + "\n" if lines else "")


def check():
    """Find source files that are new or have changed since last processing."""
    state = load_state()
    new_files = []
    for source_dir in SOURCE_DIRS:
        if not source_dir.is_dir():
            continue
        for f in source_dir.iterdir():
            if not f.is_file():
                continue
            path_str = str(f)
            h = file_hash(f)
            if state.get(path_str) != h:
                new_files.append(path_str)
    for f in sorted(new_files):
        print(f)
    return len(new_files)


def update(file_paths):
    """Mark files as processed by updating their hashes in state."""
    state = load_state()
    for fp in file_paths:
        p = Path(fp)
        if not p.exists():
            print(f"Warning: File not found: {fp}", file=sys.stderr)
            continue
        state[str(p)] = file_hash(p)
    save_state(state)
    print(f"Updated {len(file_paths)} file(s) in graph state")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "check":
        count = check()
        print(f"\n{count} file(s) to process", file=sys.stderr)
    elif cmd == "update" and len(sys.argv) >= 3:
        update(sys.argv[2:])
    else:
        print(__doc__, file=sys.stderr)
        sys.exit(1)
