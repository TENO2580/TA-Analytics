"""
Fix all industry modal bugs:
1. Remove the first duplicate modal (lines 2309-2393) keeping only the second one
2. Remove the first duplicate script block (const industryData)
3. The second block uses var so it's fine
4. Also clean up tech-card-hint CSS so it only shows on hover
"""

with open('tenoweb.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ── Remove the FIRST (broken) modal HTML block (between <!-- ══ INDUSTRY DETAIL MODAL ══ --> and </style> + </script>)
# It's the one starting with  <!-- ══ INDUSTRY DETAIL MODAL ══ --> and ends just before <!-- INDUSTRY DETAIL MODAL -->

FIRST_MODAL_START = '  <!-- ══ INDUSTRY DETAIL MODAL ══ -->'
SECOND_MODAL_START = '\n\n  <!-- INDUSTRY DETAIL MODAL -->'

if FIRST_MODAL_START in html and SECOND_MODAL_START in html:
    start = html.find(FIRST_MODAL_START)
    end = html.find(SECOND_MODAL_START)
    if start != -1 and end != -1 and start < end:
        html = html[:start] + html[end:]
        print('Removed first duplicate modal block')
    else:
        print(f'start={start} end={end}')
else:
    print('Markers not found:')
    print('First:', FIRST_MODAL_START in html)
    print('Second:', SECOND_MODAL_START in html)

# ── Verify only one indModal now
count = html.count('id="indModal"')
print(f'indModal count after fix: {count}')

# ── Fix: the remaining modal uses duplicate IDs for imIcon, imName etc if first block is gone ──
# Check the remaining script - it uses var industryData which is fine

# ── Fix tech-card-hint: force opacity:0 always, only show on hover ──
# The issue is from multiple CSS injections. Add !important to opacity:0 for safety
old_hint_css = '.tech-card-hint {\n    font-size: 0.68rem;\n    color: var(--accent);\n    opacity: 0;\n    margin-top: 0.3rem;\n    transition: opacity 0.2s;\n    font-weight: 600;\n  }'
# Try the minified version too
html = html.replace(
    '.tech-card-hint{font-size:0.68rem;color:var(--accent);opacity:0;margin-top:0.3rem;transition:opacity 0.2s;font-weight:600}',
    '.tech-card-hint{font-size:0.68rem;color:var(--accent);opacity:0!important;margin-top:0.3rem;transition:opacity 0.2s;font-weight:600}'
)

# Also replace any block-style version
html = html.replace(
    '  .tech-card-hint {\n    font-size: 0.68rem;\n    color: var(--accent);\n    opacity: 0;\n    margin-top: 0.3rem;\n    transition: opacity 0.2s;\n    font-weight: 600;\n  }',
    '  .tech-card-hint {\n    font-size: 0.68rem;\n    color: var(--accent);\n    opacity: 0 !important;\n    margin-top: 0.3rem;\n    transition: opacity 0.2s;\n    font-weight: 600;\n  }'
)

with open('tenoweb.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Done. Final length:', len(html))
