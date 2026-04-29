# Issue Lifecycle

The improvement coach manages experiment and obstacle issues during storyboard
sessions. No other agent creates or comments on these issues.

## New obstacle

```sh
gh issue create --label obstacle \
  --title "Obstacle name" \
  --body "Description.

Blocking dimension: [which gap this blocks]"
```

Add to storyboard Active list: `- Obstacle name (#NNN)`

## New experiment

Each experiment references its parent obstacle issue in the body. GitHub renders
`#NNN` as a bidirectional cross-reference, giving the obstacle a visible list of
its related experiments.

```sh
gh issue create --label experiment --label "agent:[agent-name]" \
  --title "Exp N — short name" \
  --body "Obstacle: #NNN
Owner: [agent name]

**What:** description
**Expected outcome:** prediction"
```

Add to storyboard Active list: `- Exp N (#NNN) — short name`

## Progress update

```sh
gh issue comment #NNN --body "**Actual outcome:** what happened
**Learning:** what we learned
**Next step:** continue / pivot / new"
```

## Conclusion

```sh
gh issue comment #NNN --body "**Verdict:** one-sentence learning"
gh issue close #NNN
```

Move storyboard entry from Active to Concluded.

## Migration (one-time)

At the first session after implementation, create labeled issues for every
active experiment and obstacle that lacks a `(#NNN)` suffix. Add the suffix
after creation. Apply the `agent:{owner}` label to each experiment issue. Skip
entries that already have an issue link. Concluded items need no action.
