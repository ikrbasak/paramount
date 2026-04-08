import { HTTPException } from 'hono/http-exception';
import type { Primitive } from 'zod/v3';
import type { $ZodIssue } from 'zod/v4/core';

import { ErrorMessage } from '@/constants/error-message';
import { HttpStatus } from '@/constants/http-status';
import type { KeyedRecord, MayBeArray, HonoValidatorTarget } from '@/types/utils';

type ErrorContext = KeyedRecord<MayBeArray<Primitive>>;
type ErrorZodContext = { issues: $ZodIssue[]; target: HonoValidatorTarget };

type ErrorResponseJson = {
  status: HttpStatus;
  message: string;
  cause?: ErrorContext | ErrorZodContext;
  stack?: string;
};

export class CustomError extends Error {
  status: HttpStatus;
  cause: ErrorContext;

  constructor(status: HttpStatus, msg: string, cause: ErrorContext = {}) {
    super(msg);
    this.status = status;
    this.cause = cause;
  }

  toJSON() {
    const { status, message, cause, stack } = this;
    return { status, message, cause, stack };
  }
}

export class NotFoundError extends CustomError {
  constructor(msg: string, cause: ErrorContext = {}) {
    super(HttpStatus.NotFound, msg, cause);
  }
}

export class CustomZodError extends Error {
  status: HttpStatus;
  cause: ErrorZodContext;

  constructor(status: HttpStatus, msg: string, cause: ErrorZodContext) {
    super(msg);
    this.status = status;
    this.cause = cause;
  }

  toJSON() {
    const { status, message, cause, stack } = this;
    return { status, message, cause, stack };
  }
}

export class ErrorFormat {
  static format(error: unknown): ErrorResponseJson {
    if (Error.isError(error)) {
      if (error instanceof CustomError || error instanceof CustomZodError) {
        return error.toJSON();
      }

      if (error instanceof HTTPException) {
        const { message, status, stack } = error;
        // oxlint-disable-next-line no-unsafe-type-assertion
        return { message, status: status as HttpStatus, stack };
      }

      return {
        status: HttpStatus.InternalServerError,
        message: ErrorMessage.Generic.SomethingWentWrong,
        stack: error.stack,
      };
    }

    return {
      status: HttpStatus.InternalServerError,
      message: ErrorMessage.Generic.SomethingWentWrong,
    };
  }
}
