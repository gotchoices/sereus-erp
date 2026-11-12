import { describe, expect, it } from 'vitest';
import { canonicalNumber, formatPartname, isBase, parsePartname } from './partname.js';

describe('partnames', () => {
  it('canonicalizes numbers', () => {
    expect(canonicalNumber('0.3750')).toBe('0.375');
    expect(canonicalNumber('.375')).toBe('0.375');
    expect(canonicalNumber('+12.0')).toBe('12');
    expect(canonicalNumber('0012')).toBe('12');
    expect(canonicalNumber('-0.0')).toBe('0');
    expect(canonicalNumber('-1.50')).toBe('-1.5');
    expect(canonicalNumber('1e3')).toBeNull();
    expect(canonicalNumber('.')).toBeNull();
    expect(canonicalNumber('')).toBeNull();
  });

  it('checks bases', () => {
    expect(isBase('a:chan')).toBe(true);
    expect(isBase('@:kit_3')).toBe(true);
    expect(isBase('chan')).toBe(false);
    expect(isBase('a:ch-an')).toBe(false);
  });

  it('parses and formats', () => {
    expect(parsePartname('a:chan(2400, 4,w).3')).toEqual({ kind: 'config', base: 'a:chan', params: ['2400', '4', 'w'], ver: 3 });
    expect(parsePartname('b:glue')).toEqual({ kind: 'config', base: 'b:glue', params: [], ver: null });
    expect(parsePartname('1234')).toEqual({ kind: 'pnum', pnum: 1234, ver: null });
    expect(parsePartname('1234.0')).toEqual({ kind: 'pnum', pnum: 1234, ver: 0 });
    expect(() => parsePartname('chan(1)')).toThrow(SyntaxError);
    expect(formatPartname('a:chan', ['2400', '4', 'w'], 3)).toBe('a:chan(2400,4,w).3');
    expect(formatPartname('b:glue', [])).toBe('b:glue');
  });
});
