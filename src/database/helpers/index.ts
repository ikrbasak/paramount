import { Type } from '@mikro-orm/core';
import {
  ChangeSetType,
  defineEntity,
  EntityRepository,
  p,
  raw,
  type EventSubscriber,
  type FilterQuery,
  type FindByCursorOptions,
  type FindOptions,
  type FlushEventArgs,
} from '@mikro-orm/postgresql';

import { UuidUtil } from '@/utils/uuid';

export class BaseRepository<Entity extends object> extends EntityRepository<Entity> {
  async offsetPaginate<
    Hint extends string = never,
    Fields extends string = never,
    Excludes extends string = never,
  >({
    page = 1,
    limit = 20,
    where = {},
    ...options
  }: Omit<FindOptions<Entity, Hint, Fields, Excludes>, 'limit' | 'offset'> & {
    page?: number;
    limit?: number;
    where?: FilterQuery<Entity>;
  } = {}) {
    const offset = (page - 1) * limit;
    const [records, total] = await this.findAndCount(where, { ...options, limit, offset });
    const pages = total === 0 ? 0 : Math.ceil(total / limit);
    const hasPrevPage = page > 1;
    const hasNextPage = page < pages;

    return [records, { page, pages, total, limit, hasPrevPage, hasNextPage }] as const;
  }

  async cursorPaginate<
    Hint extends string = never,
    Fields extends string = never,
    Excludes extends string = never,
  >({
    limit,
    dir,
    cursor = null,
    ...options
  }: Omit<
    FindByCursorOptions<Entity, Hint, Fields, Excludes>,
    'first' | 'last' | 'before' | 'after'
  > & { limit?: number; dir: 'before' | 'after'; cursor?: string | null }) {
    let query: FindByCursorOptions<Entity, Hint, Fields, Excludes> = {};

    if (dir === 'after') {
      query = { ...options, after: { endCursor: cursor }, first: limit };
    } else {
      query = {
        ...options,
        before: { startCursor: cursor },
        last: limit,
      };
    }

    const {
      items: records,
      totalCount: total,
      startCursor,
      endCursor,
      hasPrevPage,
      hasNextPage,
    } = await this.findByCursor(query);
    return [records, { total, limit, startCursor, endCursor, hasNextPage, hasPrevPage }] as const;
  }
}

class StringBigIntType extends Type<string | null, string | null> {
  convertToDatabaseValue(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    return value;
  }

  convertToJSValue(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    return value;
  }

  getColumnType() {
    return `bigint`;
  }
}

export const BaseUuidEntity = defineEntity({
  abstract: true,
  name: 'BaseEntity',
  repository: () => BaseRepository,
  properties: {
    _id: p // NOTE never expose this to public - should be used as foreign key
      .bigint()
      .type(StringBigIntType)
      .autoincrement()
      .primary()
      .unique()
      .hidden()
      .serializer((v) => v.toString()),
    id: p // NOTE safe to be exposed to public
      .uuid()
      .default(raw('uuidv7()')) // NOTE postgres supports uuid with and without hyphens
      .onCreate(() => UuidUtil.generate())
      .serializer((v) => UuidUtil.serialize(v)),
    createdAt: p
      .datetime(3) // NOTE javascript only supports milliseconds (3) precision
      .onCreate(() => new Date())
      .default(raw('now()')),
    updatedAt: p
      .datetime(3)
      .onCreate(() => new Date())
      .onUpdate(() => new Date())
      .default(raw('now()')),
    deletedAt: p.datetime(3).nullable(),
    v: p.bigint().version(), // NOTE keep track of the data version
  },
  filters: {
    softDelete: {
      // NOTE removes soft deleted records from the result set by default
      name: 'remove-soft-deleted-items',
      cond: { deletedAt: null },
      default: true,
    },
  },
});

export class SoftDeleteSubscriber implements EventSubscriber {
  onFlush(args: FlushEventArgs) {
    const changeSets = args.uow.getChangeSets();

    for (const cs of changeSets) {
      if (cs.type !== ChangeSetType.DELETE) {
        continue;
      }

      if (!cs.meta.properties.deletedAt) {
        continue;
      }

      // NOTE changes a delete to soft delete
      cs.entity.deletedAt = new Date();
      args.uow.computeChangeSet(cs.entity, ChangeSetType.UPDATE);
    }
  }
}
