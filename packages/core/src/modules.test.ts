import { expect, it } from 'vitest';
import { MODULES, moduleInfo } from './index.js';

it('lists each module once, with the starting configuration of architecture.md §2', () => {
  expect(new Set(MODULES.map((m) => m.key)).size).toBe(MODULES.length);
  expect(MODULES.filter((m) => m.initial).map((m) => m.key)).toEqual(['catalog', 'parties', 'ops', 'books']);
  expect(moduleInfo('books').sApp).toBe('bonum');
});
