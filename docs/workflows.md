# GitHub Actions Workflows

## Branch strategy

Single long-lived branch: `main`. All PRs are raised directly to `main`.

## Workflows

### Integration (`integration.yml`)

**Triggers:** `pull_request`, `workflow_dispatch`

Runs on every PR. Three parallel jobs:

- **validate** — commitlint, format check, lint, typecheck, build, unused export check
- **test** — runs migrations, seeders, and test suite with coverage against real Postgres and Redis services
- **health** — builds and starts the server (native + Docker), verifies `/api/v1/health` endpoint responds

### Audit (`audit.yml`)

**Triggers:** daily cron (`0 0 * * *`), `workflow_dispatch`

Runs dependency security audit via Socket Security scanner on the `main` branch.

## Setup requirements

### Third-party actions

All actions are pinned to exact commit SHAs with version comments inline. Refer to the workflow files in `.github/workflows/` for current versions.
