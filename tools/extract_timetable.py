#!/usr/bin/env python3
"""
FindMyFaculty — raw extractor for the SCSVMV CSE "Class Time Table Jul 2026.pdf".

Reads the 19-section timetable PDF and dumps a machine-readable JSON:
  sections[], each with year/sem/section/class incharge, a MON..FRI grid
  of cells (x0,x1, text lines) mapped onto the global 7-period + lunch
  column layout, plus per-cell "spill" warnings where words extend past
  their drawn cell (possible text overflow to fix manually).

Usage: python3 extract_timetable.py <pdf> <out.json> [--pages 1-19]
"""
import json, re, sys
import pymupdf

GRID_X = [144.0, 225.4, 306.8, 387.7, 468.9, 550.5, 587.9, 669.1, 750.0]
PNAMES = ['P1', 'P2', 'P3', 'P4', 'P5', 'LUNCH', 'P6', 'P7']
PERIODS = [
    {'p': 1, 'label': 'Period 1', 'start': '08:10', 'end': '09:10'},
    {'p': 2, 'label': 'Period 2', 'start': '09:10', 'end': '10:10'},
    {'p': 3, 'label': 'Period 3', 'start': '10:20', 'end': '11:20'},
    {'p': 4, 'label': 'Period 4', 'start': '11:20', 'end': '12:20'},
    {'p': 5, 'label': 'Period 5', 'start': '12:20', 'end': '13:20'},
    {'p': 0, 'label': 'Lunch', 'start': '13:20', 'end': '14:10'},
    {'p': 6, 'label': 'Period 6', 'start': '14:10', 'end': '15:10'},
    {'p': 7, 'label': 'Period 7', 'start': '15:10', 'end': '16:10'},
]
DAYS = ['MON', 'TUE', 'WED', 'THUR', 'FRI']

CODE_RE = re.compile(r'^(BCSF|BITF|BETF|CBSM|ML\d|DS\d|CS\d|IT\d|BHSF|HONS|MOOC)')


def cluster(vals, tol=1.2):
    out = []
    for v in sorted(vals):
        if out and v - out[-1] <= tol:
            continue
        out.append(v)
    return out


def load_pdf(path):
    doc = pymupdf.open(path)
    if doc.page_count != 19:
        print(f'!! expected 19 pages, found {doc.page_count}', file=sys.stderr)
    return doc


def read_header(words):
    """year/sem/section/class-incharge tokens on the line(s) under the header."""
    toks = [w for w in words if 84 < w[1] < 118 and 180 < w[0] < 745]
    toks.sort(key=lambda w: w[0])
    txt = [w[4] for w in toks]
    # strip the header words themselves if present
    for h in ('Year', 'Semester', 'Section', 'Class', 'Incharge'):
        while h in txt:
            txt.remove(h)
    year = sem = section = None
    incharge = []
    for t in txt:
        if re.match(r'^\d', t):
            continue  # stray lunch-time numbers floating in the header band
        if re.match(r'^[IVX]{1,4}$', t) and year is None:
            year = t
        elif re.match(r'^[IVX]{1,4}$', t):
            sem = t
        elif re.match(r'^S\d+$', t):
            section = t
        elif re.match(r'^S\d+-$', t):
            section = t  # "S7-" -> continues with CSE / IT
        else:
            incharge.append(t)
    if section and section.endswith('-') and incharge and incharge[0] in ('CSE', 'IT'):
        section = section + incharge.pop(0)
    return {'year': year, 'sem': sem, 'section': section, 'incharge': ' '.join(incharge)}


def cell_lines(words, x0, x1, y0, y1, margin=3.0):
    """words inside rect -> list of visual lines; flag words sticking out horizontally."""
    # cells touching the right page edge may have venue text drawn past x=750
    extra_x = 60.0 if x1 > 745 else 6.0
    ws = [w for w in words if w[0] >= x0 - 3 and w[2] <= x1 + extra_x
          and w[1] >= y0 - 3.5 and w[3] <= y1 + 3.5]
    ws.sort(key=lambda w: (round(w[1], 1), w[0]))
    spill = [w[4] for w in ws if w[0] < x0 - 1 or w[2] > x1 + 1 or w[1] < y0 - 1 or w[3] > y1 + 1]
    lines, cur, py = [], [], None
    for w in ws:
        if py is not None and w[1] - py > 2.6:
            lines.append(' '.join(x[4] for x in sorted(cur, key=lambda x: x[0])))
            cur = []
        cur.append(w)
        py = w[1]
    if cur:
        lines.append(' '.join(x[4] for x in sorted(cur, key=lambda x: x[0])))
    return lines, spill


def extract_grid(page):
    words = page.get_text('words')
    # ---- day-label cells -> row bands ----
    lrects = []
    for d in page.get_drawings():
        for it in d['items']:
            if it[0] == 're':
                r = it[1]
                if 25 < r.width < 65 and 25 < r.height < 65 and 135 < r.x1 < 175 and 140 < r.y0 < 420:
                    lrects.append((r.x0, r.y0, r.x1, r.y1))
    lrects = sorted(set((round(a, 1), round(b, 1), round(c, 1), round(dd, 1)) for a, b, c, dd in lrects))
    bands = []
    for x0, y0, x1, y1 in lrects:
        ws = [w for w in words if w[0] >= x0 - 1 and w[2] <= x1 + 1 and w[1] >= y0 - 2 and w[3] <= y1 + 2]
        ws.sort(key=lambda w: (w[1], w[0]))
        day = ''.join(w[4] for w in ws)
        if day in DAYS:
            bands.append((y0, y1, day))
    bands.sort()
    # ---- vertical strokes ----
    verts = []
    for d in page.get_drawings():
        for it in d['items']:
            if it[0] == 'l':
                a, b = it[1], it[2]
                if abs(a.x - b.x) < 0.05 and b.y - a.y > 8:
                    verts.append((a.x, a.y, b.y))
            elif it[0] == 're':
                r = it[1]
                if r.height > 8 and r.width < 170:
                    verts.append((r.x0, r.y0, r.y1))
                    verts.append((r.x1, r.y0, r.y1))
    # canonical per-page column boundaries: take the row with the most cells
    row_edges = {}
    for top, bot, day in bands:
        xs = cluster([x for (x, y0, y1) in verts if y0 >= top - 4 and y1 <= bot + 4 and x > 88])
        row_edges[day] = cluster([90.0, 144.0] + [x for x in xs if 145 < x < 749] + [750.0], tol=2.5)
    canon = max(row_edges.values(), key=len)
    while len(canon) < 9:
        for r in row_edges.values():
            merged = cluster(canon + r, tol=2.5)
            if len(merged) > len(canon):
                canon = merged
                break
        else:
            break
    rows = {}
    canon_seq = [b for b in canon if 143.5 < b < 750.5]
    if len(canon_seq) == 9:
        canon_labels = ['P1', 'P2', 'P3', 'P4', 'P5', 'LUNCH', 'P6', 'P7']
    else:
        canon_labels = None
    for top, bot, day in bands:
        edges = row_edges[day]
        cells = []
        for a, b in zip(edges, edges[1:]):
            if a < 143.5:
                continue
            if canon_labels is None:
                # fall back to fixed geometry
                cover = []
                for i in range(8):
                    ov = min(b, GRID_X[i + 1]) - max(a, GRID_X[i])
                    if ov > 8:
                        cover.append(PNAMES[i])
                if 'LUNCH' in cover and len(cover) == 1:
                    cover = ['LUNCH']
            else:
                def near(v):
                    d = [abs(v - c) for c in canon_seq]
                    return d.index(min(d))
                i0, i1 = near(a), near(b)
                if i0 >= i1:
                    continue
                cover = canon_labels[i0:i1]
            lines, spill = cell_lines(words, a, b, top, bot)
            cells.append({'x0': round(a, 1), 'x1': round(b, 1), 'periods': cover, 'lines': lines, 'spill': spill})
        rows[day] = cells
    return rows


def parse_legend(page):
    """bottom legend: reconstruct rows as columns-of-tokens -> records.
    Columns (x-start groups): code1 ~67, name1 ~132, fac1 ~315, code2 ~442, name2 ~510, fac2 ~687."""
    words = [w for w in page.get_text('words') if 55 < w[0] < 800 and 385 < w[1] < 545]
    words.sort(key=lambda w: (round(w[1] / 2.4) * 2.4, w[0]))
    # visual rows
    rows = []
    cur, py = [], None
    for w in words:
        if py is not None and w[1] - py > 2.6:
            rows.append(cur)
            cur = []
        cur.append(w)
        py = w[1]
    if cur:
        rows.append(cur)
    # split each row into columns at big x gaps
    colrows = []  # list of list of (col_id, text)
    for ws in rows:
        ws.sort(key=lambda w: w[0])
        cols = []
        for w in ws:
            if cols and w[0] - cols[-1][2] > 22:
                cols.append([w[0], [w[4]], w[2]])
            elif cols:
                cols[-1][1].append(w[4])
                cols[-1][2] = max(cols[-1][2], w[2])
            else:
                cols.append([w[0], [w[4]], w[2]])
        colrows.append([(c[0], ' '.join(c[1])) for c in cols])
    # cluster column x-starts across rows
    starts = []
    for cr in colrows:
        for x, t in cr:
            if re.search(r'(Subject|Faculty|Name|Code)', t):
                continue
            starts.append(x)
    clusters = cluster(starts, tol=22.0)
    def col_id(x):
        return min(range(len(clusters)), key=lambda i: abs(clusters[i] - x))
    # build per-column line streams
    streams = {i: [] for i in range(len(clusters))}
    for cr in colrows:
        for x, t in cr:
            if re.search(r'^(Subject|Faculty|Name|Code|Subject Code|Subject Name|Faculty Name)', t) and len(t) < 24:
                continue
            streams[col_id(x)].append((round(x, 1), t))
    return streams, clusters


def main():
    if len(sys.argv) < 3:
        print('usage: extract_timetable.py <pdf> <out.json>')
        sys.exit(1)
    pdf, out = sys.argv[1], sys.argv[2]
    doc = load_pdf(pdf)
    sections = []
    for pno in range(len(doc)):
        page = doc[pno]
        words = page.get_text('words')
        hdr = read_header(words)
        grid = extract_grid(page)
        legend_streams, legend_cols = parse_legend(page)
        sections.append({
            'page': pno + 1,
            'header': hdr,
            'grid': grid,
            'legend_streams': legend_streams,
            'legend_cols': legend_cols,
        })
    payload = {'periods': PERIODS, 'days': DAYS, 'sections': sections}
    with open(out, 'w') as f:
        json.dump(payload, f, indent=1, default=str)
    print(f'wrote {out}: {len(sections)} pages')


if __name__ == '__main__':
    main()
