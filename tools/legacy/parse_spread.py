import sys,re,collections
def unesc(s):
    if s=='\\N': return None
    return re.sub(r'\\(.)', lambda m: {'n':'\n','t':'\t','\\':'\\'}.get(m.group(1), m.group(1) if m.group(1)!='\n' else '\n'), s)
data=open(sys.argv[1],encoding='latin-1').read()
start=data.index('FROM stdin;\n')+len('FROM stdin;\n'); end=data.index('\n\\.\n',start)
body=data[start:end]
# rows end at newline not preceded by backslash
rows=re.split(r'(?<!\\)\n', body)
recs=[ [unesc(f) for f in r.split('\t')] for r in rows]
print('rows',len(recs),'ncols',collections.Counter(len(r) for r in recs))
mode=sys.argv[2] if len(sys.argv)>2 else 'stats'
scr=[r for r in recs if r[-1]]
print('with script',len(scr), 'families',len({r[0] for r in recs}))
kw=collections.Counter()
for r in scr:
    for k in ['skip','prompt','abort','switch','if','foreach','set','expr','proc','lindex','while','string']:
        if re.search(r'\b'+k+r'\b', r[-1]): kw[k]+=1
print(kw)
qexpr=[r for r in recs if not re.fullmatch(r'[0-9.]+', r[4] or '')]
print('nonconstant qty',len(qexpr), 'param exprs w/ $', sum(1 for r in recs if '$' in (r[3] or '')), 'param w/ [ ]', sum(1 for r in recs if '[' in (r[3] or '')))
if mode=='show':
    import random; random.seed(3)
    seen=set()
    for r in sorted(scr,key=lambda r:-len(r[-1]))[:6]+random.sample(scr,10):
        print('====',r[0],r[1],'->',r[2],'(',r[3],') qty:',r[4]); print(r[-1])
