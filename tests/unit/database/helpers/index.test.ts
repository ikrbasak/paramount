import { ChangeSetType } from '@mikro-orm/postgresql';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { orm, withOrmContext } from '@/database/connection';
import { User } from '@/database/entities/user';
import { SoftDeleteSubscriber } from '@/database/helpers';

describe('database helper utilities', () => {
  describe('softDeleteSubscriber', () => {
    const subscriber = new SoftDeleteSubscriber();

    const createFlushArgs = (
      changeSets: Array<{
        type: ChangeSetType;
        meta: { properties: Record<string, unknown> };
        entity: Record<string, unknown>;
      }>,
    ) => {
      const computeChangeSet = vi.fn();
      return {
        args: {
          uow: { getChangeSets: () => changeSets, computeChangeSet },
        },
        computeChangeSet,
      };
    };

    it('should set deletedAt and recompute as UPDATE for DELETE changesets with deletedAt property', () => {
      const entity = { deletedAt: null } as Record<string, unknown>;
      const changeSets = [
        {
          type: ChangeSetType.DELETE,
          meta: { properties: { deletedAt: { name: 'deletedAt' } } },
          entity,
        },
      ];
      const { args, computeChangeSet } = createFlushArgs(changeSets);

      subscriber.onFlush(args as never);

      expect(entity.deletedAt).toBeInstanceOf(Date);
      expect(computeChangeSet).toHaveBeenCalledWith(entity, ChangeSetType.UPDATE);
    });

    it('should skip changesets that are not DELETE type', () => {
      const entity = { deletedAt: null } as Record<string, unknown>;
      const changeSets = [
        {
          type: ChangeSetType.UPDATE,
          meta: { properties: { deletedAt: { name: 'deletedAt' } } },
          entity,
        },
      ];
      const { args, computeChangeSet } = createFlushArgs(changeSets);

      subscriber.onFlush(args as never);

      expect(entity.deletedAt).toBeNull();
      expect(computeChangeSet).not.toHaveBeenCalled();
    });

    it('should skip DELETE changesets on entities without a deletedAt property', () => {
      const entity = {} as Record<string, unknown>;
      const changeSets = [
        {
          type: ChangeSetType.DELETE,
          meta: { properties: {} },
          entity,
        },
      ];
      const { args, computeChangeSet } = createFlushArgs(changeSets);

      subscriber.onFlush(args as never);

      expect(entity.deletedAt).toBeUndefined();
      expect(computeChangeSet).not.toHaveBeenCalled();
    });

    it('should process multiple changesets and only soft-delete eligible ones', () => {
      const eligibleEntity = { deletedAt: null } as Record<string, unknown>;
      const updateEntity = { deletedAt: null } as Record<string, unknown>;
      const noSoftDeleteEntity = {} as Record<string, unknown>;

      const changeSets = [
        {
          type: ChangeSetType.DELETE,
          meta: { properties: { deletedAt: { name: 'deletedAt' } } },
          entity: eligibleEntity,
        },
        {
          type: ChangeSetType.UPDATE,
          meta: { properties: { deletedAt: { name: 'deletedAt' } } },
          entity: updateEntity,
        },
        {
          type: ChangeSetType.DELETE,
          meta: { properties: {} },
          entity: noSoftDeleteEntity,
        },
      ];
      const { args, computeChangeSet } = createFlushArgs(changeSets);

      subscriber.onFlush(args as never);

      expect(eligibleEntity.deletedAt).toBeInstanceOf(Date);
      expect(updateEntity.deletedAt).toBeNull();
      expect(noSoftDeleteEntity.deletedAt).toBeUndefined();
      expect(computeChangeSet).toHaveBeenCalledOnce();
    });
  });

  describe('baseRepository pagination', () => {
    const insertedIds: string[] = [];

    beforeAll(async () => {
      await withOrmContext(async () => {
        const em = orm.em.fork();
        for (let i = 0; i < 5; i++) {
          const user = em.create(User, {
            firstName: `PaginationTest${i}`,
            lastName: 'User',
            email: `pagination-test-${i}@test.local`,
            phone: `+1000000000${i}`,
            passwordHash: 'test-hash',
          });
          em.persist(user);
        }
        await em.flush();

        const users = await em.find(
          User,
          { firstName: { $like: 'PaginationTest%' } },
          { orderBy: { firstName: 'ASC' } },
        );
        insertedIds.push(...users.map((u) => u.id));
      });
    });

    afterAll(async () => {
      await withOrmContext(async () => {
        const em = orm.em.fork();
        await em.nativeDelete(User, { id: { $in: insertedIds } });
      });
    });

    describe('offsetPaginate', () => {
      it('should return correct records for page 1', async () => {
        await withOrmContext(async () => {
          const repo = orm.em.fork().getRepository(User);

          const [records, meta] = await repo.offsetPaginate({
            page: 1,
            limit: 2,
            where: { firstName: { $like: 'PaginationTest%' } },
            orderBy: { firstName: 'ASC' },
          });

          expect(records).toHaveLength(2);
          expect(meta.page).toBe(1);
          expect(meta.limit).toBe(2);
          expect(meta.total).toBe(5);
          expect(meta.pages).toBe(3);
        });
      });

      it('should not have a previous page on page 1 and should have a next page', async () => {
        await withOrmContext(async () => {
          const repo = orm.em.fork().getRepository(User);

          const [, meta] = await repo.offsetPaginate({
            page: 1,
            limit: 2,
            where: { firstName: { $like: 'PaginationTest%' } },
            orderBy: { firstName: 'ASC' },
          });

          expect(meta.hasPrevPage).toBeFalsy();
          expect(meta.hasNextPage).toBeTruthy();
        });
      });

      it('should return correct metadata for a middle page', async () => {
        await withOrmContext(async () => {
          const repo = orm.em.fork().getRepository(User);

          const [records, meta] = await repo.offsetPaginate({
            page: 2,
            limit: 2,
            where: { firstName: { $like: 'PaginationTest%' } },
            orderBy: { firstName: 'ASC' },
          });

          expect(records).toHaveLength(2);
          expect(meta.page).toBe(2);
          expect(meta.hasPrevPage).toBeTruthy();
          expect(meta.hasNextPage).toBeTruthy();
        });
      });

      it('should return correct metadata for the last page', async () => {
        await withOrmContext(async () => {
          const repo = orm.em.fork().getRepository(User);

          const [records, meta] = await repo.offsetPaginate({
            page: 3,
            limit: 2,
            where: { firstName: { $like: 'PaginationTest%' } },
            orderBy: { firstName: 'ASC' },
          });

          expect(records).toHaveLength(1);
          expect(meta.page).toBe(3);
          expect(meta.hasPrevPage).toBeTruthy();
          expect(meta.hasNextPage).toBeFalsy();
        });
      });

      it('should return empty results and zero pages when no records match', async () => {
        await withOrmContext(async () => {
          const repo = orm.em.fork().getRepository(User);

          const [records, meta] = await repo.offsetPaginate({
            where: { firstName: 'NonExistent-ZZZ-12345' },
          });

          expect(records).toHaveLength(0);
          expect(meta.total).toBe(0);
          expect(meta.pages).toBe(0);
          expect(meta.hasPrevPage).toBeFalsy();
          expect(meta.hasNextPage).toBeFalsy();
        });
      });
    });

    describe('cursorPaginate', () => {
      it('should return records with cursor metadata when paginating forward', async () => {
        await withOrmContext(async () => {
          const repo = orm.em.fork().getRepository(User);

          const [records, meta] = await repo.cursorPaginate({
            dir: 'after',
            limit: 2,
            where: { firstName: { $like: 'PaginationTest%' } },
            orderBy: { firstName: 'ASC' },
          });

          expect(records).toHaveLength(2);
          expect(meta.total).toBe(5);
          expect(meta.limit).toBe(2);
          expect(meta.endCursor).toBeDefined();
          expect(meta.hasNextPage).toBeTruthy();
        });
      });

      it('should return the next page of results using the end cursor', async () => {
        await withOrmContext(async () => {
          const repo = orm.em.fork().getRepository(User);

          const [, firstMeta] = await repo.cursorPaginate({
            dir: 'after',
            limit: 2,
            where: { firstName: { $like: 'PaginationTest%' } },
            orderBy: { firstName: 'ASC' },
          });

          const [records, meta] = await repo.cursorPaginate({
            dir: 'after',
            cursor: firstMeta.endCursor,
            limit: 2,
            where: { firstName: { $like: 'PaginationTest%' } },
            orderBy: { firstName: 'ASC' },
          });

          expect(records).toHaveLength(2);
          expect(meta.hasPrevPage).toBeTruthy();
        });
      });

      it('should paginate backward using the before direction', async () => {
        await withOrmContext(async () => {
          const repo = orm.em.fork().getRepository(User);

          // Get end cursor from first page.
          const [, firstMeta] = await repo.cursorPaginate({
            dir: 'after',
            limit: 3,
            where: { firstName: { $like: 'PaginationTest%' } },
            orderBy: { firstName: 'ASC' },
          });

          // Get second page.
          const [, secondMeta] = await repo.cursorPaginate({
            dir: 'after',
            cursor: firstMeta.endCursor,
            limit: 2,
            where: { firstName: { $like: 'PaginationTest%' } },
            orderBy: { firstName: 'ASC' },
          });

          // Paginate backward from second page start.
          const [records] = await repo.cursorPaginate({
            dir: 'before',
            cursor: secondMeta.startCursor,
            limit: 2,
            where: { firstName: { $like: 'PaginationTest%' } },
            orderBy: { firstName: 'ASC' },
          });

          expect(records.length).toBeGreaterThan(0);
        });
      });
    });
  });
});
