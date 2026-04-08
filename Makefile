migration\:generate:
	bunx --bun mikro-orm migration:create -n $(name)

migration\:create:
	bunx --bun mikro-orm migration:create -n $(name) -b

migration\:run:
	bunx --bun mikro-orm migration:up

migration\:revert:
	bunx --bun mikro-orm migration:down

migration\:list:
	bunx --bun mikro-orm migration:list

migration\:check:
	bunx --bun mikro-orm migration:check

migration\:pending:
	bunx --bun mikro-orm migration:pending

seeder\:create:
	bunx --bun mikro-orm migration:create --context seeder -n $(name) -b

seeder\:run:
	bunx --bun mikro-orm migration:up --context seeder

seeder\:revert:
	bunx --bun mikro-orm migration:down --context seeder

seeder\:list:
	bunx --bun mikro-orm migration:list --context seeder

seeder\:check:
	bunx --bun mikro-orm migration:check --context seeder

seeder\:pending:
	bunx --bun mikro-orm migration:pending --context seeder
