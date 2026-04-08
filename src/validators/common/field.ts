import * as z from 'zod';

import { ErrorMessage } from '@/constants/error-message';

export const stringBooleanField = (label: string) =>
  z.coerce
    .string(ErrorMessage.Field.LabelMustBeValidType(label, 'string'))
    .trim()
    .toLowerCase()
    .transform((v) => ['true', 't', 'yes', 'y', '1'].includes(v));

export const stringEnumField = <T extends string>(label: string, values: [T, ...T[]]) =>
  z.coerce
    .string()
    .trim()
    // @ts-expect-error `v` is expected to be `T`
    .refine((v) => values.includes(v), ErrorMessage.Field.LabelMustBeInList(label, values))
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion - `v` is asserted to be one of `T`
    .transform((v) => v as T);
