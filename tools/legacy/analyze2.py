import sys,collections as C, datetime as dt
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pgcopy import rows
D=sys.argv[1]+'/'
base={b['base']:b for b in rows(D+'prd_base.d')}
for pre in ['i','h','o','u','z','K','c']:
    ex=[(k,v['descr']) for k,v in base.items() if k.startswith(pre+':')][:3]; print(pre, ex)
tt=C.Counter(); ts=C.Counter(); yr=C.Counter(); pn=C.Counter(); n=0; neg=0; frac=0
for r in rows(D+'mtr_reg.d'):
    n+=1; tt[r['ttype']]+=1; ts[(r['ttype'],r['status'])]+=1; yr[(r['mtr_date'] or '????')[:4]]+=1; pn[r['pnum']]+=1
    q=r['tquant'] or r['rquant'] or '0'
    if '.' in q and not q.endswith('.0') and float(q)!=int(float(q)): frac+=1
print('mtr_reg',n); print(' ttype',tt.most_common()); print(' ttype/status',sorted(ts.items()))
print(' by year',sorted(yr.items())); print(' distinct pnums',len(pn),' fractional qty rows',frac)
vp=list(rows(D+'vend_price.d')); print('vend_price',len(vp),' prodtype',C.Counter(v['prodtype'] for v in vp).most_common(),' activ',C.Counter(v['activ'] for v in vp).most_common())
act=[v for v in vp if v['activ'] in ('t','true')]
for pt in ('P','A'):
    ys=C.Counter((v['mod_date'] or v['crt_date'] or '????')[:4] for v in act if v['prodtype']==pt); print(' active',pt,'last-mod year',sorted(ys.items()))
print(' active w/ expire',sum(1 for v in act if v['expire']),' vendors',len({v['org_id'] for v in act}),' parts',len({v['pnum'] for v in act}))
bidsper=C.Counter(v['pnum'] for v in act); print(' active bids per part dist',sorted(C.Counter(min(x,6) for x in bidsper.values()).items()))
print(' lot>1',sum(1 for v in act if v['lot'] and float(v['lot'])>1),' pkg values',C.Counter(v['pkg'] for v in act).most_common(8))
vh=next(rows(D+'vend_price_hist.d')); print('vend_price_hist cols',list(vh))
