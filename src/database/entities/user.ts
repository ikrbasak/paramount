import { defineEntity, p, type InferEntity } from '@mikro-orm/postgresql';

import { BaseRepository, BaseUuidEntity } from '@/database/helpers';

enum UserStatus {
  Active = 'active',
  Inactive = 'inactive',
}

class UserRepository extends BaseRepository<User> {}

export const User = defineEntity({
  name: 'User',
  tableName: 'users',
  extends: BaseUuidEntity,
  repository: () => UserRepository,
  properties: {
    firstName: p.string(),
    lastName: p.string(),
    fullName: p.string().formula(`CONCAT_WS(' ', "first_name", "last_name")`),
    email: p.string().type('citext'),
    phone: p.string().type('citext'),
    passwordHash: p.string().lazy(),
    status: p.enum(() => UserStatus).default(UserStatus.Inactive),
  },
  indexes: [
    {
      name: 'idx_unique_email_in_non_deleted_users',
      expression: `CREATE UNIQUE INDEX "idx_unique_email_in_non_deleted_users"
        ON "users" ("email")
        WHERE deleted_at IS NULL`,
    },
    {
      name: 'idx_unique_phone_in_non_deleted_users',
      expression: `CREATE UNIQUE INDEX "idx_unique_phone_in_non_deleted_users"
        ON "users" ("phone")
        WHERE deleted_at IS NULL`,
    },
  ],
});

type User = InferEntity<typeof User>;
