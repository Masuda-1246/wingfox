---
name: merge-with-ci
description: Runs the full flow to merge (push, create PR, wait for CI to pass, merge, then verify post-merge workflow). Merges only after CI is green; after merge, detects and reports CI/workflow status on the target branch. Use when the user asks to "merge まで" or "マージまで" or to complete through merge.
---

# Merge Until Complete (with CI)

## When to Apply

Apply when the user asks to complete through **merge** (e.g. 「マージまで」「merge まで」「PR 作ってマージまで」). If they only asked for implementation or PR creation, use the implementation-workflow skill instead and stop at PR creation.

## Prerequisites

- Changes are implemented and committed on a feature branch (or create a branch from current state).
- Base branch is `develop`. Use `gh` for PR and merge.

## Workflow

### 1. Verify Locally

Before pushing, run:

```bash
pnpm lint
pnpm build
```

If anything fails, fix and re-commit. Do not push until these pass.

### 2. Push & Create PR

```bash
git push -u origin <branch-name>
gh pr create --base develop --title "<title>" --body "<body>"
```

Record the created PR number (e.g. from `gh pr create` output or `gh pr view`).

### 3. Wait for CI Before Merging

**Do not merge until CI has passed.**

- Option A — Watch until checks pass (interactive):

```bash
gh pr checks <pr-number> --watch
```

When all checks are green, proceed to merge.

- Option B — Poll until ready (when `--watch` is not usable): see [reference.md](reference.md) for scriptable checks using `gh pr view --json statusCheckRollup`.

If the repo uses **branch protection** with "Require status checks to pass", merge will fail until CI is green; in that case retry merge after CI passes.

### 4. Merge

```bash
gh pr merge <pr-number> --merge --delete-branch
```

Use `--merge` for a merge commit. Use `--squash` only if the user or team prefers squash.

### 5. Post-Merge: Detect CI / Workflow on Target Branch

After merge, `develop` is updated. This repo runs workflows on **push to develop** (e.g. Deploy). Detect and report their status:

- List recent workflow runs on `develop`:

```bash
gh run list -b develop -L 5
```

- Show status of the latest run (e.g. after a moment for the merge push to trigger):

```bash
gh run list -b develop -L 1 --json databaseId,status,conclusion,name
gh run view <run-id>  # optional: details
```

- If the user wants to **wait** until the post-merge workflow completes:

```bash
# After merge, get the latest run that started after the merge (may need to poll)
gh run list -b develop -L 1 --json databaseId,status,conclusion
# Poll until status is "completed" and conclusion is "success" (or report "failure")
```

Report to the user:

- That the PR was merged.
- The result of the latest run(s) on `develop`: **success** or **failure** (and run URL if failed).

## Summary Rules

- **Never merge before CI passes** on the PR (wait for `gh pr checks` to show green, or for branch protection to allow merge).
- Always create the PR against `develop` and merge with `gh pr merge`.
- After merge, **always check and report** workflow status on `develop` (e.g. `gh run list -b develop`).
- If CI fails on the PR: do not merge; report the failure and suggest fixing the branch.
- If post-merge workflow fails: report the failure and the run URL so the user can investigate.

## Reference

- CI workflow: `.github/workflows/ci.yml` (runs on pull_request to main/develop).
- Deploy workflow: `.github/workflows/deploy.yml` (runs on push to develop).
- For more detail on `gh pr checks` / `gh run list`, see [reference.md](reference.md).
