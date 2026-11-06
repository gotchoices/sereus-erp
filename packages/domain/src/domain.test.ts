import { describe, expect, it } from 'vitest';
import { formatScaled, isId, newId, parseScaled } from './index.js';

describe('ids', () => {
  it('are 26-character ULIDs that sort by time', () => {
    const a = newId(1_700_000_000_000);
    const b = newId(1_700_000_000_001);
    expect(isId(a)).toBe(true);
    expect(a < b).toBe(true);
  });
});

describe('scaled', () => {
  it('round-trips decimal text', () => {
    expect(parseScaled('12.5', 3)).toBe(12500);
    expect(parseScaled('-0.001', 3)).toBe(-1);
    expect(formatScaled(12500, 3)).toBe('12.500');
    expect(formatScaled(-1, 3)).toBe('-0.001');
    expect(formatScaled(42, 0)).toBe('42');
  });
  it('rejects excess precision', () => {
    expect(() => parseScaled('1.2345', 3)).toThrow(RangeError);
  });
});
