import { describe, expect, it } from 'vitest';
import { openMemoryDb, rows, run } from './sql.js';

const SCHEMA = 'table T (Id integer primary key, X real null, S text null);';

describe('cached statements', () => {
	it('rebinds one statement text with values of different types', async () => {
		const db = await openMemoryDb(SCHEMA);
		const insert = 'insert into App.T (Id, X, S) values (:id, :x, :s)';
		await run(db, insert, { id: 1, x: 1, s: 'a' }); // whole number first: INTEGER
		await run(db, insert, { id: 2, x: 0.5, s: null }); // then a REAL and a null
		await run(db, insert, { id: 3, x: null, s: 'c' });
		expect(await rows(db, 'select Id, X, S from App.T order by Id')).toEqual([
			{ Id: 1, X: 1, S: 'a' }, { Id: 2, X: 0.5, S: null }, { Id: 3, X: null, S: 'c' },
		]);
	});

	it('runs an interleaved read of the same text on its own statement', async () => {
		const db = await openMemoryDb(SCHEMA);
		for (const id of [1, 2, 3]) await run(db, 'insert into App.T (Id) values (?)', [id]);
		const q = 'select Id from App.T where Id >= ? order by Id';
		const [a, b] = await Promise.all([rows(db, q, [1]), rows(db, q, [2])]);
		expect(a.map((r) => r.Id)).toEqual([1, 2, 3]);
		expect(b.map((r) => r.Id)).toEqual([2, 3]);
	});

	it('does not keep a statement that failed', async () => {
		const db = await openMemoryDb(SCHEMA);
		const insert = 'insert into App.T (Id) values (?)';
		await run(db, insert, [1]);
		await expect(run(db, insert, [1])).rejects.toThrow();
		await run(db, insert, [2]);
		expect((await rows(db, 'select count(*) as N from App.T'))[0]!.N).toBe(2);
	});
});
