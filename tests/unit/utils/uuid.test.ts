import { describe, expect, it } from 'vitest';

import { UuidUtil } from '@/utils/uuid';

describe('identifier generation and formatting utilities', () => {
  it('should create a new version 7 identifier', () => {
    const id = UuidUtil.generate();
    const v = id.at(14);

    expect(id).toHaveLength(36);
    expect(v).toBe('7');
  });

  it('should remove hyphens when converting an identifier to compact form', () => {
    const id = UuidUtil.generate();
    const s = UuidUtil.serialize(id);

    expect(s.includes('-')).toBeFalsy();
    expect(s).toHaveLength(32);
  });

  it('should rebuild the original identifier from its compact form', () => {
    const id = UuidUtil.generate();
    const s = UuidUtil.serialize(id);
    const d = UuidUtil.deserialize(s);

    expect(d).toBe(id);
  });
});
