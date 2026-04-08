import { describe, expect, it } from 'vitest';

import { ErrorMessage } from '@/constants/error-message';

describe('error message factory functions', () => {
  it('should format LabelMustBeValidType with label and type', () => {
    expect(ErrorMessage.Field.LabelMustBeValidType('Email', 'string')).toBe(
      'Email must be valid string',
    );
  });

  it('should format LabelMustBeInList with label and comma-separated values', () => {
    expect(ErrorMessage.Field.LabelMustBeInList('Status', ['active', 'inactive'])).toBe(
      'Status must be one of active, inactive',
    );
  });

  it('should format LabelMustBeInList with numeric values', () => {
    expect(ErrorMessage.Field.LabelMustBeInList('Priority', [1, 2, 3])).toBe(
      'Priority must be one of 1, 2, 3',
    );
  });

  it('should format LabelMustBeInList with a single value', () => {
    expect(ErrorMessage.Field.LabelMustBeInList('Role', ['admin'])).toBe(
      'Role must be one of admin',
    );
  });

  it('should format LabelNotFound with label', () => {
    expect(ErrorMessage.Field.LabelNotFound('User')).toBe('User could not be found');
  });

  it('should format LabelMustHaveMinValue with label and value', () => {
    expect(ErrorMessage.Field.LabelMustHaveMinValue('Age', 18)).toBe(
      'Age must be greater or equal to 18',
    );
  });

  it('should format LabelMustHaveMaxValue with label and value', () => {
    expect(ErrorMessage.Field.LabelMustHaveMaxValue('Quantity', 100)).toBe(
      'Quantity must be lesser or equal to 100',
    );
  });

  it('should format LabelMustHaveMinLen with label and length', () => {
    expect(ErrorMessage.Field.LabelMustHaveMinLen('Password', 8)).toBe(
      'Password must be at least 8 character(s)',
    );
  });

  it('should format LabelMustHaveMaxLen with label and length', () => {
    expect(ErrorMessage.Field.LabelMustHaveMaxLen('Username', 32)).toBe(
      'Username must be at most 32 character(s)',
    );
  });

  it('should format LabelMustHaveExactLen with label and length', () => {
    expect(ErrorMessage.Field.LabelMustHaveExactLen('OTP', 6)).toBe(
      'OTP must have only 6 character(s)',
    );
  });

  it('should format LabelMustBeUnique with label', () => {
    expect(ErrorMessage.Field.LabelMustBeUnique('Email')).toBe('Email must be unique');
  });
});
