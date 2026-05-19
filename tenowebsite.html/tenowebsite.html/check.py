import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('tenoweb.html','r',encoding='utf-8') as f:
    lines = f.readlines()
for i,line in enumerate(lines,1):
    if 'nav' in line.lower() and ('<' in line or 'class' in line):
        print(f'L{i}: {repr(line.rstrip()[:130])}')
    if i > 600:
        break
