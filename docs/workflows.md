# GitHub Actions Workflows

Branch strategy: single long-lived branch `main`. All PRs target `main`.

## Integration (`integration.yml`)

Triggers: `pull_request` (to `main`), `workflow_dispatch`. Timeout: 5min/job. Permissions: `contents: read`.

Three parallel jobs with Postgres + Redis service containers:

- **quality**: checkout, setup bun, install, commitlint (PRs only), check formatting, lint, typecheck (source + build), build, fallow (outputs markdown to job summary), start server, verify health (retries 5x at 2s), stop server
- **test**: checkout, setup bun, install, migrate, seed, check migration integrity, run tests with coverage, collect reports, upload coverage. `NODE_ENV=test`, `LOG_LEVEL=silent`. Report steps run on failure too (`!cancelled()`)
- **docker**: checkout, hadolint dockerfile, build image, start container, trivy scan (`exit-code: 1` on findings), verify health. Container connects to host services via `host.docker.internal`

## Audit (`audit.yml`)

Triggers: `pull_request` (to `main`), `workflow_dispatch`. Timeout: 5min/job. Permissions: `contents: read`.

Five parallel security scanning jobs:

- **dependency**: `bun audit --audit-level=moderate`
- **bearer**: SAST, diff-only on PRs. Requires `pull-requests: read`, `security-events: write`
- **gitleaks**: secret scan via Docker, `fetch-depth: 0`. Requires `security-events: write`
- **zizmor**: workflow audit via Docker, SARIF output. Requires `security-events: write`
- **semgrep**: SAST via Docker (Semgrep CE). Requires `security-events: write`

## CodeQL (`codeql.yml`)

Triggers: `pull_request` (to `main`), `workflow_dispatch`. Timeout: 5min. Permissions: `contents: read`, `security-events: write`.

Single job: JavaScript/TypeScript analysis, uploads SARIF to GitHub Security tab.

## Service containers (integration)

- Postgres 18 Alpine: port `5444`, health via `pg_isready`
- Redis 8 Alpine: port `6380`, health via `redis-cli ping`

## Actions

All pinned to exact commit SHAs with version comments. See `.github/workflows/` for current versions.
