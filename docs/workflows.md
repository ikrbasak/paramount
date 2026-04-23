# GitHub Actions Workflows

## Branch strategy

Single long-lived branch: `main`. All PRs are raised directly to `main`.

## Workflows

### Integration (`integration.yml`)

**Triggers:** `pull_request` (to `main`), `workflow_dispatch`

Single job (`integration`) with Postgres and Redis service containers. Steps run sequentially in phases:

| Phase                   | Steps                                                                                                                                  | Details                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Setup**               | checkout repository, setup bun, install dependencies                                                                                   | `fetch-depth: 0` for commitlint range; `persist-credentials: false`                                                                 |
| **Validation**          | lint commit messages, check formatting, lint source code, typecheck source, typecheck build config, build application, lint dockerfile | commitlint runs only on `pull_request` events; hadolint for Dockerfile                                                              |
| **Database**            | run database migrations, run database seeders, check migration integrity                                                               | Uses `make` targets; migration check ensures no pending schema drift                                                                |
| **Test**                | run tests with coverage, collect test reports, upload coverage report                                                                  | `NODE_ENV=test`, `LOG_LEVEL=silent`; report collection and upload run on failure too (`!cancelled()`)                               |
| **Native health check** | start native server, verify native health endpoint, stop native server                                                                 | Starts `build/index.js` in background; retries health check up to 5 times at 2s intervals                                           |
| **Docker health check** | build docker image, start docker container, scan docker image for vulnerabilities, verify docker health endpoint                       | Trivy vulnerability scan fails the job on findings (`exit-code: 1`); container connects to host services via `host.docker.internal` |

**Timeout:** 10 minutes. **Permissions:** `contents: read`.

### Audit (`audit.yml`)

**Triggers:** `pull_request` (to `main`), `workflow_dispatch`

Single job (`audit`) for security scanning and code health analysis.

| Phase                | Steps                                                | Details                                                                                                                  |
| -------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Setup**            | checkout repository, setup bun, install dependencies | `fetch-depth: 0` and `persist-credentials: true` for bearer diff analysis; Socket Security scanner added at install time |
| **Dependency audit** | audit dependencies                                   | `bun audit --audit-level=moderate` via Socket Security                                                                   |
| **Code health**      | scan code health with fallow                         | Outputs markdown report to GitHub job summary                                                                            |
| **SAST**             | scan code with bearer sast                           | Diff-only mode on pull requests                                                                                          |
| **Secret scanning**  | scan secrets with gitleaks                           | Runs gitleaks via Docker against the repository                                                                          |
| **Workflow audit**   | audit workflows with zizmor                          | Runs via Docker; static analysis of GitHub Actions workflow files                                                        |
| **SAST (Semgrep)**   | scan code with semgrep sast                          | Runs via Docker; Semgrep CE static analysis                                                                              |

**Timeout:** 5 minutes. **Permissions:** `contents: read`, `pull-requests: read`.

## Setup requirements

### Service containers

The integration workflow provisions:

- **Postgres 18 (Alpine)** — mapped to port `5444`, health-checked via `pg_isready`
- **Redis 8 (Alpine)** — mapped to port `6380`, health-checked via `redis-cli ping`

### Third-party actions

All actions are pinned to exact commit SHAs with version comments inline. Refer to the workflow files in `.github/workflows/` for current versions.
