import { validator } from 'hono/validator';
import type z from 'zod';

import { HttpStatus } from '@/constants/http-status';
import { CustomZodError } from '@/lib/error';
import type { HonoValidatorTarget } from '@/types/utils';

const parse = async <Schema extends z.ZodType>(
  target: HonoValidatorTarget,
  schema: Schema,
  data: unknown,
) => {
  const { data: d, error } = await schema.safeParseAsync(data);

  if (error) {
    throw new CustomZodError(HttpStatus.BadRequest, '', {
      issues: error.issues,
      target,
    });
  }

  return d;
};

export const requestValidate = <Schema extends z.ZodType>(
  target: HonoValidatorTarget,
  schema: Schema,
) => {
  return validator(target, async (value, _c) => {
    const result = await parse(target, schema, value);
    return result;
  });
};
