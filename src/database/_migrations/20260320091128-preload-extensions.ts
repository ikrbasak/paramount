import { Migration } from '@mikro-orm/migrations';

export class PreloadExtensions20260320091128 extends Migration {
  extensions = ['citext', 'pgcrypto', 'plpgsql'];

  override up(): void | Promise<void> {
    const query = this.extensions.map((ext) => `CREATE EXTENSION IF NOT EXISTS ${ext};`).join('\n');
    this.addSql(query);
  }

  override down(): void | Promise<void> {
    const query = this.extensions.map((ext) => `DROP EXTENSION IF EXISTS ${ext};`).join('\n');
    this.addSql(query);
  }
}
