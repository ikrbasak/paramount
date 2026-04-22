# GitHub Actions Workflows

## Branch strategy

Single long-lived branch: `main`. All PRs are raised directly to `main`.

## Workflows

### Integration (`integration.yml`)

**Triggers:** `pull_request` (to `main`), `workflow_dispatch`

Runs on every PR to main. Three parallel jobs:

- **validate** — commitlint, format check, lint, typecheck, build, unused export check
- **test** — runs migrations, seeders, and test suite with coverage against real Postgres and Redis services
- **health** — builds and starts the server (native + Docker), verifies `/api/v1/health` endpoint responds

### Audit (`audit.yml`)

**Triggers:** `pull_request` (to `main`), weekly cron (Sunday `0 0 * * 0`), `workflow_dispatch`

Five parallel jobs for security scanning:

- **dependency audit** — Socket Security scanner via `bun audit`
- **bearer sast** — Bearer static analysis with inline PR review comments via reviewdog (diff-only on PRs)
- **gitleaks secret scan** — scans git history for leaked secrets
- **zizmor workflow audit** — static analysis of GitHub Actions workflows (inline annotations on PRs)
- **semgrep sast** — Semgrep CE static analysis with inline PR review comments via reviewdog

## Setup requirements

### Third-party actions

All actions are pinned to exact commit SHAs with version comments inline. Refer to the workflow files in `.github/workflows/` for current versions.
