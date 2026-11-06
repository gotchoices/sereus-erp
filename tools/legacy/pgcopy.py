import re
ESC={'n':'\n','t':'\t','r':'\r','\\':'\\','b':'\b','f':'\f','v':'\v'}
def unesc(s):
    if s=='\\N': return None
    if '\\' not in s: return s
    return re.sub(r'\\(.)', lambda m: ESC.get(m.group(1), m.group(1)), s)
def rows(path):
    with open(path, encoding='latin-1') as f:
        cols=None
        for line in f:
            if cols is None:
                if line.startswith('COPY '):
                    cols=[c.strip() for c in line[line.index('(')+1:line.index(')')].split(',')]
                continue
            if line.startswith('\\.'): return
            yield dict(zip(cols,[unesc(x) for x in line.rstrip('\n').split('\t')]))
