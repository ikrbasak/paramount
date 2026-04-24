# GitHub Actions Workflows

## Branch strategy

Single long-lived branch: `main`. All PRs are raised directly to `main`.

## Workflows

### Integration (`integration.yml`)

**Triggers:** `pull_request` (to `main`), `workflow_dispatch`

Three parallel jobs with Postgres and Redis service containers:

| Job         | Name                                 | Steps                                                                                                                                                          | Details                                                                                                                           |
| ----------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **quality** | code quality and health check        | checkout, setup bun, install, lint commits, check formatting, lint source, typecheck (source + build), build, fallow, start server, verify health, stop server | commitlint on PRs only; fallow outputs markdown to job summary; native health retries 5x at 2s intervals                          |
| **test**    | migration and test                   | checkout, setup bun, install, migrate, seed, check migration integrity, run tests with coverage, collect reports, upload coverage                              | `NODE_ENV=test`, `LOG_LEVEL=silent`; report steps run on failure too (`!cancelled()`)                                             |
| **docker**  | docker lint, health check, and audit | checkout, lint dockerfile, build docker image, start container, trivy scan, verify docker health                                                               | Hadolint for Dockerfile; Trivy fails on findings (`exit-code: 1`); container connects to host services via `host.docker.internal` |

**Timeout:** 5 minutes per job. **Permissions:** `contents: read`.

### Audit (`audit.yml`)

**Triggers:** `pull_request` (to `main`), `workflow_dispatch`

Five parallel jobs for security scanning:

| Job            | Name                  | Steps                                               | Details                                                            |
| -------------- | --------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| **dependency** | dependency audit      | checkout, setup bun, install, audit dependencies    | `bun audit --audit-level=moderate`                                 |
| **bearer**     | bearer sast           | checkout, scan code with bearer, upload sarif       | Diff-only on PRs; requires `pull-requests: read` for diff analysis |
| **gitleaks**   | gitleaks secret scan  | checkout, scan secrets with gitleaks, upload sarif  | Runs via Docker; `fetch-depth: 0` for full history scan            |
| **zizmor**     | zizmor workflow audit | checkout, audit workflows with zizmor, upload sarif | Runs via Docker; SARIF output piped to file                        |
| **semgrep**    | semgrep sast          | checkout, scan code with semgrep, upload sarif      | Runs via Docker; Semgrep CE static analysis                        |

**Timeout:** 5 minutes per job. **Permissions:** `contents: read` (bearer additionally requires `pull-requests: read`). Bearer, gitleaks, zizmor, and semgrep jobs additionally require `security-events: write` to upload SARIF results to GitHub's code scanning.

### CodeQL (`codeql.yml`)

**Triggers:** `pull_request` (to `main`), `workflow_dispatch`

Single job for GitHub code scanning:

| Job         | Name            | Steps                                     | Details                                                                   |
| ----------- | --------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| **analyze** | codeql analysis | checkout, initialize codeql, run analysis | Scans JavaScript/TypeScript; uploads SARIF results to GitHub Security tab |

**Timeout:** 5 minutes. **Permissions:** `contents: read`, `security-events: write` (required to upload SARIF results).

## Setup requirements

### Service containers

The integration workflow provisions per job:

- **Postgres 18 (Alpine)** — mapped to port `5444`, health-checked via `pg_isready`
- **Redis 8 (Alpine)** — mapped to port `6380`, health-checked via `redis-cli ping`

### Third-party actions

All actions are pinned to exact commit SHAs with version comments inline. Refer to the workflow files in `.github/workflows/` for current versions.
