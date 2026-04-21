import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { stringBooleanField, stringEnumField } from '@/validators/common/field';

describe('custom zod field validators', () => {
  describe('stringBooleanField', () => {
    const schema = stringBooleanField('TestFlag');

    it.each(['true', 'True', 'TRUE', 't', 'T', 'yes', 'Yes', 'YES', 'y', 'Y', '1'])(
      'should return true for truthy value "%s"',
      (value) => {
        expect(schema.parse(value)).toBeTruthy();
      },
    );

    it.each(['false', 'False', '0', 'no', 'n', 'random', ''])(
      'should return false for non-truthy value "%s"',
      (value) => {
        expect(schema.parse(value)).toBeFalsy();
      },
    );

    it('should trim whitespace before evaluating', () => {
      expect(schema.parse('  true  ')).toBeTruthy();
      expect(schema.parse('  false  ')).toBeFalsy();
    });

    it('should coerce numeric input to a string before evaluating', () => {
      expect(schema.parse(1)).toBeTruthy();
      expect(schema.parse(0)).toBeFalsy();
    });
  });

  describe('stringEnumField', () => {
    const schema = stringEnumField('Color', ['red', 'green', 'blue']);

    it('should accept a value that is in the allowed list', () => {
      expect(schema.parse('red')).toBe('red');
    });

    it('should trim whitespace from the input', () => {
      expect(schema.parse('  green  ')).toBe('green');
    });

    it('should reject a value that is not in the allowed list', () => {
      expect(() => schema.parse('yellow')).toThrow(ZodError);
    });

    it('should reject an empty string', () => {
      expect(() => schema.parse('')).toThrow(ZodError);
    });
  });
});
