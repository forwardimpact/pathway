# Self-Maintenance Writes Under `.claude/**`

Claude Code's permission guard blocks `Write`, `Edit`, and sandboxed `Bash`
calls targeting `.claude/**`. Until upstream regression
[claude-code#38806](https://github.com/anthropics/claude-code/issues/38806) is
resolved, agents use the path-gated wrapper described below.

## Rule

Every agent edit under `.claude/**` goes through `scripts/claude-write.sh`. No
other mechanism is supported. Do not use `Edit`, `Write`, or sandboxed `Bash` on
`.claude/**` paths — they will be denied.

## Invocation

Use the `Bash` tool with `dangerouslyDisableSandbox: true`. Deliver file content
on stdin via heredoc:

    bash scripts/claude-write.sh .claude/path/to/file <<'CLAUDE_WRITE_EOF'
    file content here
    CLAUDE_WRITE_EOF

- **Target path** — relative to repo root or absolute. The wrapper resolves `..`
  and symlinks before the gate check.
- **Content** — stdin (heredoc). Written verbatim to the target.
- **Sandbox** — must be disabled (`dangerouslyDisableSandbox: true`). The
  wrapper is unreachable from inside the sandbox.

## Refusal surface

The wrapper refuses writes to any path that resolves outside `.claude/`:

| Exit | Meaning                                            |
| ---- | -------------------------------------------------- |
| 0    | Written successfully                               |
| 1    | Refused — target resolves outside `.claude/`       |
| 2    | Error — parent directory or symlink target missing |

If you see exit 1, the target path is wrong — check for `..` segments or
symlinks that escape `.claude/`. If you see exit 2, the parent directory does
not exist — create it with `mkdir -p` before calling the wrapper.

## Trace invariant

`kata-trace` enforces that every `dangerouslyDisableSandbox: true` Bash call
invokes `scripts/claude-write.sh`. Any sandbox-disabled call not routed through
the wrapper is a **high-severity** trace finding. See
`.claude/skills/kata-trace/references/invariants.md` § Cross-cutting invariants.

## Retirement

When [claude-code#38806](https://github.com/anthropics/claude-code/issues/38806)
lands and `Edit`/`Write` calls on `.claude/**` succeed under
`bypassPermissions`, this wrapper and reference retire by deletion.
`.claude/settings.json` is already at target state — no change needed at
retirement.
