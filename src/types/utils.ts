import type { ValidationTargets } from 'hono';

export type KeyedRecord<T> = Record<string, T>;
export type MayBeArray<T> = T | T[];
/** @internal */
export type NonEmptyArray<T> = [T, ...T[]];

export type HonoValidatorTarget = keyof ValidationTargets;
