import { HTTPException } from 'hono/http-exception';
import { describe, expect, it } from 'vitest';

import { ErrorMessage } from '@/constants/error-message';
import { HttpStatus } from '@/constants/http-status';
import { CustomError, CustomZodError, ErrorFormat, NotFoundError } from '@/lib/error';

describe('custom error hierarchy and formatting', () => {
  describe('customError', () => {
    it('should store status, message, and cause', () => {
      const error = new CustomError(HttpStatus.BadRequest, 'invalid input', { field: 'email' });

      expect(error.status).toBe(HttpStatus.BadRequest);
      expect(error.message).toBe('invalid input');
      expect(error.cause).toEqual({ field: 'email' });
    });

    it('should default cause to an empty object when omitted', () => {
      const error = new CustomError(HttpStatus.InternalServerError, 'fail');

      expect(error.cause).toEqual({});
    });

    it('should be an instance of Error', () => {
      const error = new CustomError(HttpStatus.BadRequest, 'test');

      expect(error).toBeInstanceOf(Error);
    });

    it('should serialize to json with status, message, cause, and stack', () => {
      const error = new CustomError(HttpStatus.Conflict, 'duplicate', { id: '123' });
      const json = error.toJSON();

      expect(json).toMatchObject({
        status: HttpStatus.Conflict,
        message: 'duplicate',
        cause: { id: '123' },
      });
      expect(json.stack).toBeDefined();
    });
  });

  describe('notFoundError', () => {
    it('should set status to 404', () => {
      const error = new NotFoundError('user not found');

      expect(error.status).toBe(HttpStatus.NotFound);
      expect(error.message).toBe('user not found');
    });

    it('should be an instance of CustomError', () => {
      const error = new NotFoundError('missing');

      expect(error).toBeInstanceOf(CustomError);
    });

    it('should accept an optional cause', () => {
      const error = new NotFoundError('missing', { userId: '42' });

      expect(error.cause).toEqual({ userId: '42' });
    });
  });

  describe('customZodError', () => {
    it('should store status, message, and zod cause context', () => {
      const issues = [{ code: 'invalid_type', message: 'Expected string', path: ['name'] }];
      const error = new CustomZodError(HttpStatus.BadRequest, 'validation failed', {
        issues: issues as CustomZodError['cause']['issues'],
        target: 'json',
      });

      expect(error.status).toBe(HttpStatus.BadRequest);
      expect(error.cause.target).toBe('json');
      expect(error.cause.issues).toHaveLength(1);
    });

    it('should serialize to json with status, message, cause, and stack', () => {
      const error = new CustomZodError(HttpStatus.UnprocessableEntity, 'bad data', {
        issues: [],
        target: 'query',
      });
      const json = error.toJSON();

      expect(json).toMatchObject({
        status: HttpStatus.UnprocessableEntity,
        message: 'bad data',
        cause: { issues: [], target: 'query' },
      });
      expect(json.stack).toBeDefined();
    });
  });

  describe('errorFormat', () => {
    it('should format a CustomError using its toJSON method', () => {
      const error = new CustomError(HttpStatus.BadRequest, 'bad', { key: 'val' });
      const result = ErrorFormat.format(error);

      expect(result).toMatchObject({
        status: HttpStatus.BadRequest,
        message: 'bad',
        cause: { key: 'val' },
      });
    });

    it('should format a CustomZodError using its toJSON method', () => {
      const error = new CustomZodError(HttpStatus.BadRequest, 'validation', {
        issues: [],
        target: 'json',
      });
      const result = ErrorFormat.format(error);

      expect(result).toMatchObject({
        status: HttpStatus.BadRequest,
        message: 'validation',
        cause: { issues: [], target: 'json' },
      });
    });

    it('should format an HTTPException with its status and message', () => {
      const error = new HTTPException(403, { message: 'forbidden' });
      const result = ErrorFormat.format(error);

      expect(result.status).toBe(403);
      expect(result.message).toBe('forbidden');
    });

    it('should format a generic Error with 500 status and generic message', () => {
      const error = new Error('unexpected failure');
      const result = ErrorFormat.format(error);

      expect(result.status).toBe(HttpStatus.InternalServerError);
      expect(result.message).toBe(ErrorMessage.Generic.SomethingWentWrong);
      expect(result.stack).toBeDefined();
    });

    it('should format a non-Error value with 500 status and no stack', () => {
      const result = ErrorFormat.format('string error');

      expect(result.status).toBe(HttpStatus.InternalServerError);
      expect(result.message).toBe(ErrorMessage.Generic.SomethingWentWrong);
      expect(result.stack).toBeUndefined();
    });

    it('should format null with 500 status and no stack', () => {
      const result = ErrorFormat.format(null);

      expect(result.status).toBe(HttpStatus.InternalServerError);
      expect(result.message).toBe(ErrorMessage.Generic.SomethingWentWrong);
      expect(result.stack).toBeUndefined();
    });
  });
});
