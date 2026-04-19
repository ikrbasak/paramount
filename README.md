# Paramount

Backend API built with [Hono](https://hono.dev) + [Bun](https://bun.sh), backed by PostgreSQL, Redis, and BullMQ.

## Prerequisites

- [Bun](https://bun.sh) — version pinned in [`.bun-version`](.bun-version)
- [PostgreSQL](https://www.postgresql.org)
- [Redis](https://redis.io)

## Getting Started

```sh
# install dependencies
bun install

# run migrations & seeders
make migration:run
make seeder:run

# start dev server (watch mode)
bun run dev
```

## Documentation

- [CI/CD Workflows](docs/workflows.md) — branch strategy, GitHub Actions, triggers, labels, and setup
- [Claude Code Guide](CLAUDE.md) — commands, architecture, conventions, and development rules
