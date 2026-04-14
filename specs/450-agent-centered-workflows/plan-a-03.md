# Part 03 -- SHA Inventory Update

Depends on Part 01 (finalized workflow filenames).

## Scope

Update the SHA inventory to reflect the new workflow filenames.

## Step 1: Update sha-inventory.md

File: `.claude/skills/kata-security-update/references/sha-inventory.md`

### 1a: Update `actions/checkout` row

Current:

```
check-quality.yml, check-test.yml, check-security.yml, publish-npm.yml, publish-macos.yml, publish-skills.yml (x2), website.yaml, guide-setup.yml, improvement-coach.yml, product-manager.yml, release-readiness.yml, release-review.yml, security-audit.yml, security-update.yml
```

Replace with:

```
check-quality.yml, check-test.yml, check-security.yml, publish-npm.yml, publish-macos.yml, publish-skills.yml (x2), website.yaml, guide-setup.yml, improvement-coach.yml, product-manager.yml, release-engineer.yml, security-engineer.yml, staff-engineer.yml, technical-writer.yml
```

Changes: removed `release-readiness.yml`, `release-review.yml`,
`security-audit.yml`, `security-update.yml`. Added `release-engineer.yml`,
`security-engineer.yml`, `staff-engineer.yml`, `technical-writer.yml`.

Note: `plan-specs.yml`, `implement-plans.yml`, `doc-review.yml`, and
`wiki-curate.yml` were not in the original inventory (they used
`actions/checkout` but were missing from the row -- this is a pre-existing
omission). The new consolidated files are listed. `landmark-setup.yml`,
`map-setup.yml`, and `summit-setup.yml` also use `actions/checkout` but are not
in the current inventory -- not adding them here to avoid scope creep.

### 1b: Update `actions/create-github-app-token` row

Current:

```
guide-setup.yml (x2), improvement-coach.yml, product-manager.yml, publish-skills.yml, release-readiness.yml, release-review.yml, security-audit.yml, security-update.yml
```

Replace with:

```
guide-setup.yml (x2), improvement-coach.yml, product-manager.yml, publish-skills.yml, release-engineer.yml, security-engineer.yml, staff-engineer.yml, technical-writer.yml
```

Changes: removed `release-readiness.yml`, `release-review.yml`,
`security-audit.yml`, `security-update.yml`. Added `release-engineer.yml`,
`security-engineer.yml`, `staff-engineer.yml`, `technical-writer.yml`.

Note: `plan-specs.yml` and `implement-plans.yml` used this action but were
missing from the current inventory. The new `staff-engineer.yml` is listed.
`landmark-setup.yml`, `map-setup.yml`, and `summit-setup.yml` also use this
action but are not in the current inventory.

## Blast Radius

### Modified

- `.claude/skills/kata-security-update/references/sha-inventory.md`

### Created / Deleted

None.

## Verification

- `grep` the SHA inventory for any deleted workflow filename
  (`security-audit.yml`, `security-update.yml`, `release-readiness.yml`,
  `release-review.yml`, `plan-specs.yml`, `implement-plans.yml`,
  `doc-review.yml`, `wiki-curate.yml`) -- should return 0 matches.
- `grep` for each new filename (`security-engineer.yml`, `release-engineer.yml`,
  `staff-engineer.yml`, `technical-writer.yml`) -- should return matches.
- `bun run check` passes.
- `bun run test` passes.
