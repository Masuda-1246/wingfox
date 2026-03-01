---
name: implementation-workflow
description: Implementation workflow for the wingfox monorepo. Use this skill when implementing bug fixes, features, or any code changes. Ensures changes are tested, committed, and a PR is created.
---

# Implementation Workflow

## When to Apply

Follow this workflow whenever you are **implementing code changes** — bug fixes, features, refactors, or any modifications to the codebase. This includes changes requested via GitHub Issues.

## Workflow

### 1. Implement

- Create or modify the necessary files.
- Follow existing code conventions (see `frontend-development` skill for `apps/web`, Hono patterns for `apps/api`).

### 2. Verify

Run the checks relevant to your change:

```bash
# TypeScript type check
cd apps/web && mise exec -- npx tsc --noEmit
cd apps/api && mise exec -- npx tsc --noEmit

# Lint (web only — API has no linter)
pnpm lint

# Build
pnpm build
```

If you modified UI, perform manual browser testing with the `computerUse` subagent.

### 3. Commit

- Stage only the files you changed.
- Write a clear commit message. If fixing a GitHub Issue, include `Fixes #<number>` in the message body.

```bash
git add <files>
git commit -m "<summary>

Fixes #<issue-number>"
```

### 4. Push & Create PR

After committing, **always push and create a Pull Request**.

```bash
git push
```

Create the PR targeting `develop`:

```bash
gh pr create \
  --title "<PR title>" \
  --base develop \
  --body "<description of changes and test results>"
```

If `gh pr create` fails due to permissions, provide the manual PR creation URL to the user:

```
https://github.com/Masuda-1246/wingfox/pull/new/<branch-name>
```

### PR description template

Include in the PR body:

1. **変更内容** — bullet list of what was changed and why
2. **テスト結果** — table or list of checks run (tsc, lint, build, manual testing) with pass/fail status
3. If fixing an issue, reference it with `Fixes #<number>`

## Key Rules

- **Every implementation must end with a PR.** Do not leave changes only committed locally.
- One PR per logical change. Do not batch unrelated changes.
- Target `develop` as the base branch (not `main`).
- If the user asks you to fix a GitHub Issue, reference it in both the commit message and the PR description.
