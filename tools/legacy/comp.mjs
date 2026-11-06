import vm from 'node:vm';
const SKIP = Symbol('skip');
function run(src, vars) {
  const ctx = vm.createContext({...vars, skip: () => { throw SKIP; }, Math});
  try { return vm.runInContext(`{${src}\n}`, ctx, {timeout: 50}); }
  catch (e) { if (e === SKIP) return 'SKIPPED'; throw e; }
}
const tests = [
  ['(W * H) / 7200', {W: 36, H: 48}],
  ['if (Z != 6) skip(); 1', {Z: 4}],
  ['if (Z != 6) skip(); 1', {Z: 6}],
  [`if (L === 11) 12; else if (L === 15 || L === 20) 16; else throw new Error('Invalid boom length')`, {L: 15}],
  [`const Q = {1:5,2:5,3:5,4:10,5:10,6:10,7:15,8:15,9:15,10:20,11:25,12:25}[M]; Q ?? skip()`, {M: 7}],
  [`let D; if (L<=1) D=3; else if (L<=2) D=4; else D=5; D*2`, {L: 2}],
];
for (const [s, v] of tests) console.log(JSON.stringify(v), '|', s.replace(/\n/g,' '), '=>', run(s, v));
