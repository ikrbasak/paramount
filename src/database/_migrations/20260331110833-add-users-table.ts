import { Migration } from '@mikro-orm/migrations';

export class AddUsersTable20260331110833 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`CREATE TABLE "users" (
          "_id" bigserial PRIMARY KEY,
          "id" UUID NOT NULL DEFAULT uuidv7(),
          "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
          "deleted_at" TIMESTAMPTZ(3) NULL,
          "v" BIGINT NOT NULL DEFAULT 1,
          "first_name" VARCHAR(255) NOT NULL,
          "last_name" VARCHAR(255) NOT NULL,
          "email" citext NOT NULL,
          "phone" citext NOT NULL,
          "password_hash" VARCHAR(255) NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'inactive'
        );`);
    this.addSql(`CREATE UNIQUE INDEX "idx_unique_email_in_non_deleted_users" ON "users" ("email")
        WHERE
          deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX "idx_unique_phone_in_non_deleted_users" ON "users" ("phone")
        WHERE
          deleted_at IS NULL;`);
    this.addSql(`ALTER TABLE "users"
        ADD CONSTRAINT "users_status_check" CHECK ("status" IN ('active', 'inactive'));`);
  }

  override down(): void | Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "users" cascade;`);
  }
}
