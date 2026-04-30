# Release Merge Templates

Comment templates and report formats for the merge gate.

## Skip Comments

### Untrusted Author

```sh
gh pr comment <number> --body "Release merge: skipping — author \`<login>\` is not in the top 7 contributors. Requires human review."
```

### Unsupported PR Type

```sh
gh pr comment <number> --body "Release merge: skipping — PR type \`<type>\` requires human review."
```

### Awaiting Approval Signal

```sh
gh pr comment <number> --body "Release merge: blocked — awaiting approval signal. Apply \`<phase>:approved\` label or submit an APPROVED review."
```

### CI Failing

Comment with the specific failing checks from `gh pr checks`.

### Substantive Conflict

```sh
gh pr comment <number> --body "Release merge: blocked — substantive conflicts in <files>. Author judgement needed; aborting rebase."
```

## Merge Comment

```sh
gh pr comment <number> --body "Release merge: all gates pass — type \`<type>\`, CI green, author trusted, approval via \`<label|review>\`. Merging."
gh pr merge <number> --merge --delete-branch
```

After merging, verify state:

```sh
gh pr view <number> --json state --jq '.state'
```

If still `OPEN`, note in the summary rather than reporting as merged.

## Report Summary

```
| PR  | Title                          | Type | Author | CI    | Approval | Action  | Reason                          |
| --- | ------------------------------ | ---- | ------ | ----- | -------- | ------- | ------------------------------- |
| #42 | fix(map): schema validation    | fix  | alice  | green | label    | merged  | All gates pass                  |
| #38 | spec(security): SSRF hardening | spec | bob    | green | —        | blocked | Awaiting approval signal        |
| #35 | feat(pathway): export feature  | feat | carol  | red   | —        | blocked | CI failing: format check        |
| #31 | fix(libui): color contrast     | fix  | eve    | green | —        | blocked | Author not in top contributors  |
```

**Flag PRs blocked across 3+ consecutive runs** prominently above the table —
these may need human escalation.
