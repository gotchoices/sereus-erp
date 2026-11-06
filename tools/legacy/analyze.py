import sys,re,collections as C
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pgcopy import rows
D=sys.argv[1]+'/'
def cnt(it): return C.Counter(it).most_common()
# products
base=list(rows(D+'prd_base.d'))
print('prd_base',len(base)); print(' by prefix',cnt(b['base'].split(':')[0] for b in base)[:20])
print(' by status',cnt(b['status'] for b in base))
print(' families w/ price formula', sum(1 for b in base if b['price']))
part=list(rows(D+'prd_part.d')); print('prd_part',len(part),' elevel',cnt(p['elevel'] for p in part))
print(' with recbuy',sum(1 for p in part if p['recbuy'] not in (None,'0')),'reclev',sum(1 for p in part if p['reclev'] not in (None,'0')))
parm=list(rows(D+'prd_parm.d')); pc=C.Counter(p['base'] for p in parm)
print('prd_parm',len(parm),' families w/ parms',len(pc),' parms/family dist',sorted(C.Counter(pc.values()).items()))
print(' ptyp',cnt(p['ptyp'] for p in parm))
sp=list(rows(D+'prd_spread.d')); fams={s['base'] for s in sp}
scr=[s for s in sp if s['script'] and s['script'].strip()]
print('prd_spread lines',len(sp),'families',len(fams),'with script',len(scr),'with oper',sum(1 for s in sp if s['oper']))
kw=C.Counter()
for s in scr:
    for k in ['skip','prompt','abort','error','switch','if','foreach','proc','set','expr','lindex','string','for','while']:
        if re.search(r'\b'+k+r'\b',s['script']): kw[k]+=1
print(' script keywords',kw.most_common())
print(' nonconst qty',sum(1 for s in sp if not re.fullmatch(r'\s*[0-9.]+\s*',s['quant'] or '')),' parm w/ $',sum(1 for s in sp if '$' in (s['cparm'] or '')),' parm w/ [',sum(1 for s in sp if '[' in (s['cparm'] or '')))
print(' lines per family dist (pctl)', sorted(C.Counter(s['base'] for s in sp).values())[len(fams)//2], max(C.Counter(s['base'] for s in sp).values()))
# depth of family graph
kids=C.defaultdict(set)
for s in sp: kids[s['base']].add(s['cbase'])
import functools,sys as S; S.setrecursionlimit(10000)
@functools.lru_cache(None)
def depth(b,stack=()):
    if b in stack: return 0
    return 1+max([depth(k,stack+(b,)) for k in kids.get(b,())]+[0])
dd=C.Counter(depth(b) for b in fams); print(' family BOM depth dist',sorted(dd.items()))
print(' prefixes of spread families',cnt(b.split(':')[0] for b in fams if b)[:12])
dup=C.Counter(s['script'] for s in scr if len(s['script'])>80); print(' long scripts repeated >1x:',sum(1 for k,v in dup.items() if v>1),'copies',sum(v for v in dup.values() if v>1))
yrs=C.Counter((s['mod_date'] or s['crt_date'] or '????')[:4] for s in sp); print(' spread last-mod year',sorted(yrs.items()))
bo=list(rows(D+'prd_base_oper.d')); print('prd_base_oper',len(bo),' families',len({b['base'] for b in bo}),' oper',cnt(b['oper'] for b in bo),' with setup/run times',sum(1 for b in bo if b['setuptme'] or b['runtme_unit']))
print(' crt year',cnt((b['crt_date'] or '')[:4] for b in bo))
