import { Migration } from '@mikro-orm/migrations';

export class PreloadReusableFunctions20260320091148 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`CREATE OR REPLACE FUNCTION uuid_to_compact(input UUID)
        RETURNS TEXT
        LANGUAGE sql
        IMMUTABLE
        AS $$
          SELECT replace($1::text, '-', '');
        $$;`);
    this.addSql(`CREATE OR REPLACE FUNCTION uuid_to_compact(input TEXT)
        RETURNS TEXT
        LANGUAGE sql
        IMMUTABLE
        AS $$
          SELECT replace($1::uuid::text, '-', '');
        $$;`);
    this.addSql(`CREATE OR REPLACE FUNCTION uuid_from_compact(input TEXT)
        RETURNS UUID
        LANGUAGE sql
        IMMUTABLE
        AS $$
          SELECT $1::uuid;
        $$;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`DROP FUNCTION IF EXISTS uuid_to_compact(uuid);`);
    this.addSql(`DROP FUNCTION IF EXISTS uuid_to_compact(text);`);
    this.addSql(`DROP FUNCTION IF EXISTS uuid_from_compact(text);`);
  }
}
