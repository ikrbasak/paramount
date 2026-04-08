export const ErrorMessage = {
  Generic: {
    RequestTimeout: 'Request timed out. Please try again later.',
    SomethingWentWrong: 'Something went wrong. Please try again later.',
  },
  Field: {
    LabelMustBeValidType: (label: string, type: string) => `${label} must be valid ${type}`,
    LabelMustBeInList: <T extends string | number | boolean>(
      label: string,
      list: T[] | readonly T[],
    ) => `${label} must be one of ${list.map((v) => v.toString()).join(', ')}`,
    LabelNotFound: (label: string) => `${label} could not be found`,
    LabelMustHaveMinValue: (label: string, val: number) =>
      `${label} must be greater or equal to ${val}`,
    LabelMustHaveMaxValue: (label: string, val: number) =>
      `${label} must be lesser or equal to ${val}`,
    LabelMustHaveMinLen: (label: string, len: number) =>
      `${label} must be at least ${len} character(s)`,
    LabelMustHaveMaxLen: (label: string, len: number) =>
      `${label} must be at most ${len} character(s)`,
    LabelMustHaveExactLen: (label: string, len: number) =>
      `${label} must have only ${len} character(s)`,
    LabelMustBeUnique: (label: string) => `${label} must be unique`,
  },
} as const;
