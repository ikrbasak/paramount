# GitHub Actions Workflows

## Branch strategy

Four long-lived branches with a promotion flow:

```
develop -> testing -> staging -> main
```

### Branch validation rules

| Destination | Allowed sources                                       |
| ----------- | ----------------------------------------------------- |
| `main`      | `staging`, `hotfix/*`                                 |
| `staging`   | `testing`, `hotfix/*`                                 |
| `testing`   | `develop`, `bugfix/*`                                 |
| `develop`   | `feat/*`, `bugfix/*`, `chore/*`, `testing` (backport) |

Branch name pattern for ticket branches: `<type>/<ticket-number>-<slug>` (e.g. `feat/42-add-auth`, `hotfix/99-fix-crash`). The ticket portion must match `[0-9]+(-[a-z0-9]+)+`.

## Workflows

### Integration (`integration.yml`)

**Triggers:** `pull_request`, `workflow_dispatch`

Runs on every PR. Three parallel jobs:

- **validate** — branch name validation (inline bun script), commitlint, format check, lint, typecheck, build, unused export check
- **test** — runs migrations, seeders, and test suite with coverage against real Postgres and Redis services
- **health** — builds and starts the server (native + Docker), verifies `/api/v1/health` endpoint responds

### Audit (`audit.yml`)

**Triggers:** daily cron (`0 0 * * *`), `workflow_dispatch`

Runs dependency security audit via Socket Security scanner. Uses a matrix strategy to audit both `main` and `develop` branches in parallel.

### PR Label (`pr-label.yml`)

**Triggers:** `pull_request` opened to `main`, `staging`, or `testing`

Automatically labels PRs and adds comments:

| PR type                           | Labels applied            | Comment         |
| --------------------------------- | ------------------------- | --------------- |
| `hotfix/*` to `main` or `staging` | `hotfix`                  | Backport notice |
| `develop` to `testing`            | `promotion`               | —               |
| `testing` to `staging`            | `promotion`, `staged`     | —               |
| `staging` to `main`               | `promotion`, `production` | —               |

Creates labels automatically if they don't exist.

**Labels managed:**

| Label        | Color              | Description                      |
| ------------ | ------------------ | -------------------------------- |
| `hotfix`     | `#D93F0B` (red)    | Hotfix targeting main or staging |
| `promotion`  | `#1D76DB` (blue)   | Promotion between environments   |
| `staged`     | `#5319E7` (purple) | Promoted to staging              |
| `production` | `#0E8A16` (green)  | Promoted to production           |

### Backport (`backport.yml`)

**Triggers:** `pull_request` closed (merged) to `main`, `staging`, or `testing`

Creates cascading backport PRs through the waterfall:

| Merged into | Source type | Backport chain                     |
| ----------- | ----------- | ---------------------------------- |
| `main`      | `hotfix/*`  | main → staging → testing → develop |
| `staging`   | `hotfix/*`  | staging → testing → develop        |
| `testing`   | `bugfix/*`  | testing → develop                  |

Each backport PR is labeled `backport` and includes the original PR title and description.

**Label managed:**

| Label      | Color             | Description        |
| ---------- | ----------------- | ------------------ |
| `backport` | `#0E8A16` (green) | Backported changes |

### Tag (`tag.yml`)

**Triggers:** `pull_request` closed (merged) to `main`, `staging`, `testing`, or `develop`

Creates two GPG-signed tags on every merge to a long-lived branch and pushes them. Tag messages follow conventional commits: `release(<branch>): <pr_title>`. Uses 8-char short SHA for reduced collision risk.

**Tag formats:**

| Format                             | Example                  | Purpose              |
| ---------------------------------- | ------------------------ | -------------------- |
| `<prefix>.<DDMMYYYY>.<short_sha>`  | `prod.18042026.a1b2c3de` | When was it deployed |
| `<prefix>.<pr_number>.<short_sha>` | `prod.42.a1b2c3de`       | PR traceability      |

**Branch prefixes:**

| Branch    | Prefix  |
| --------- | ------- |
| `develop` | `dev`   |
| `testing` | `test`  |
| `staging` | `stage` |
| `main`    | `prod`  |

## Setup requirements

### Allow GitHub Actions to create PRs

Required by: `backport.yml`, `pr-label.yml`

Go to **Settings > Actions > General > Workflow permissions** and enable:

- **"Allow GitHub Actions to create and approve pull requests"**

### GPG signing for tags

Required by: `tag.yml`

1. Generate a GPG key (or use an existing one):

   ```sh
   gpg --full-generate-key
   ```

2. Export the private key:

   ```sh
   gpg --armor --export-secret-keys YOUR_KEY_ID | base64
   ```

3. Add two repository secrets in **Settings > Secrets and variables > Actions**:

   | Secret            | Value                                         |
   | ----------------- | --------------------------------------------- |
   | `GPG_PRIVATE_KEY` | Base64-encoded GPG private key from step 2    |
   | `GPG_PASSPHRASE`  | Passphrase for the key (empty string if none) |

### Third-party actions

All actions are pinned to exact commit SHAs:

| Action                          | Version | SHA                                        |
| ------------------------------- | ------- | ------------------------------------------ |
| `actions/checkout`              | v6.0.2  | `de0fac2e4500dabe0009e67214ff5f5447ce83dd` |
| `actions/upload-artifact`       | v7.0.1  | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |
| `oven-sh/setup-bun`             | v2.2.0  | `0c5077e51419868618aeaa5fe8019c62421857d6` |
| `nick-fields/retry`             | v4.0.0  | `ad984534de44a9489a53aefd81eb77f87c70dc60` |
| `crazy-max/ghaction-import-gpg` | v7.0.0  | `2dc316deee8e90f13e1a351ab510b4d5bc0c82cd` |
