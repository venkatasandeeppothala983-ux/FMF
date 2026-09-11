#!/usr/bin/env python3
"""
FindMyFaculty — data assembly (timetable-only v1).

Reads tt_raw.json (from extract_timetable.py) and emits timetable.js consumed by
index.html.  All subject/faculty curations for the SCSVMV CSE Odd Semester
(Aug–Dec 2026) timetable live here so regeneration is deterministic.

Usage: python3 build_data.py tt_raw.json timetable.js
"""
import json, re, sys

DAYS = ['MON', 'TUE', 'WED', 'THUR', 'FRI']
PERIODS = [
    {'p': 1, 'start': '08:10', 'end': '09:10'},
    {'p': 2, 'start': '09:10', 'end': '10:10'},
    {'p': 3, 'start': '10:20', 'end': '11:20'},
    {'p': 4, 'start': '11:20', 'end': '12:20'},
    {'p': 5, 'start': '12:20', 'end': '13:20'},
    {'p': 6, 'start': '14:10', 'end': '15:10'},
    {'p': 7, 'start': '15:10', 'end': '16:10'},
]

CANON = {
    'III': {
        'automata theory': 'Automata Theory',
        'computer networks': 'Computer Networks',
        'programming in java': 'Programming in Java',
        'professional elective i': 'Professional Elective-I',
        'professional elective 1': 'Professional Elective-I',
        'database management system': 'DBMS',
        'database management system dbms': 'DBMS',
        'dbms': 'DBMS',
        'computer networks lab': 'Computer Networks Lab',
        'cn lab': 'Computer Networks Lab',
        'programming in java lab': 'Programming in Java Lab',
        'java lab': 'Programming in Java Lab',
        'dbms lab': 'DBMS Lab',
        'natural language processing': 'Natural Language Processing',
        'nlp': 'Natural Language Processing',
        'nlp lab': 'NLP Lab',
        'natural language processing lab': 'NLP Lab',
        'data visualization lab': 'Data Visualization Lab',
        'dv lab': 'Data Visualization Lab',
        'nlp dv lab': 'NLP / Data Visualization Lab',
        'soft skill': 'Soft Skill',
        'yoga': 'Yoga',
        'database network security lab': 'Database & Network Security Lab',
        'database and network security lab': 'Database & Network Security Lab',
        'it workshop sci lab': 'IT Workshop',
        'it workshop': 'IT Workshop',
        'principle of communication': 'Principle of Communication',
        'honors': 'Honours',
        'ci': 'CI',
        'data communication and networks': 'Computer Networks',
    },
    'II': {
        'probability and statistics': 'Probability & Statistics',
        'digital logic design': 'Digital Logic Design',
        'dld': 'Digital Logic Design',
        'computer organization and architecture': 'Computer Organization & Architecture',
        'computer organization and architecture architecture': 'Computer Organization & Architecture',
        'data structures and algorithms': 'Data Structures & Algorithms',
        'dsa': 'Data Structures & Algorithms',
        'fundamentals of machine learning': 'Fundamentals of Machine Learning',
        'fml': 'Fundamentals of Machine Learning',
        'fundamentals of ml': 'Fundamentals of Machine Learning',
        'dld coa lab': 'DLD / COA Lab',
        'dld coa': 'DLD / COA Lab',
        'dsa lab': 'DSA Lab',
        'fml lab': 'FML Lab',
        'intelligent systems': 'Intelligent Systems',
        'ai and machine learning': 'AI & Machine Learning',
        'ai and ml': 'AI & Machine Learning',
        'cyber space operations': 'Cyber Space Operations',
        'introduction to internet of things': 'Introduction to IoT',
        'soft skills ii': 'Soft Skills-II',
        'soft skills': 'Soft Skills-II',
        'honors': 'Honours',
        'yoga': 'Yoga',
        'ci': 'CI',
    },
    'IV': {
        'digital marketing disaster': 'Open Elective-I',
        'digital marketing disaster mgmt': 'Open Elective-I',
        'digital': 'Open Elective-I',
        'mooc course': 'MOOC Course',
        'project work p i': 'Project Work Phase-I',
        'project work': 'Project Work Phase-I',
        'project work pi': 'Project Work Phase-I',
        'itp': 'Industrial Training & Practice (ITP)',
        'ca vul': 'CA / VUL',
        'cb': 'CB',
        'cb mc': 'CB / MC',
        'ca vul iot': 'CA / VUL / IoT',
        'iot project': 'IoT / Project',
        'robotic lab': 'Robotics Lab',
        'iot robotic lab': 'IoT / Robotics Lab',
        'ci': 'CI',
    },
}

# subjects that exist but the PDF assigns no faculty (activities / not listed)
ACTIVITY = {'CI', 'Yoga', 'Soft Skill', 'Soft Skills-II', 'Honours', 'MOOC Course',
            'CB', 'CB / MC', 'CA / VUL', 'CA / VUL / IoT', 'IoT / Project',
            'Robotics Lab', 'IoT / Robotics Lab', 'NLP / Data Visualization Lab',
            'IT Workshop', 'DLD / COA Lab', 'DSA Lab', 'FML Lab', 'COA Lab', 'DLD Lab'}

# per-section subject -> faculty (exactly as printed in the PDF legend)
FACULTY = {
    'IV-VII-S1': {
        'Open Elective-I': ['Mr. Sreesha (Civil Dept.)'],
        'Project Work Phase-I': ['Dr. K. Balachandran'],
        'Industrial Training & Practice (ITP)': ['Dr. K. Balachandran'],
    },
    'IV-VII-S2': {
        'Open Elective-I': ['Mr. Sreesha (Civil Dept.)'],
        'Project Work Phase-I': ['Dr. K. Balachandran'],
        'Industrial Training & Practice (ITP)': ['Dr. K. Balachandran'],
    },
    'III-V-S1': {'Computer Networks': ['Dr. T. Sundar'], 'Programming in Java': ['Dr. P. Shanmugapriya'],
                 'DBMS': ['Mr. V. Balu'], 'Professional Elective-I': ['Ms. Hema Poorani'],
                 'Computer Networks Lab': ['Dr. T. Sundar'], 'Programming in Java Lab': ['Dr. P. Shanmugapriya'],
                 'DBMS Lab': ['Mr. V. Balu'], 'Natural Language Processing': ['Dr. M. Gayathri'],
                 'NLP Lab': ['Dr. M. Gayathri']},
    'III-V-S2': {'Computer Networks': ['Dr. T. Dineshkumar'], 'Programming in Java': ['Mr. E. Sankar'],
                 'DBMS': ['Mr. V. Balu'], 'Professional Elective-I': ['Ms. Hema Poorani'],
                 'Computer Networks Lab': ['Dr. T. Dineshkumar'], 'Programming in Java Lab': ['Dr. P. Shanmugapriya'],
                 'DBMS Lab': ['Mr. V. Balu'], 'Natural Language Processing': ['Dr. R. Prema'],
                 'NLP Lab': ['Dr. R. Prema']},
    'III-V-S3': {'Computer Networks': ['Dr. R. Sivaramakrishnan'], 'Programming in Java': ['Dr. M. Saraswathi'],
                 'DBMS': ['Dr. D. Thamaraiselvi'], 'Professional Elective-I': ['Ms. Hema Poorani'],
                 'Computer Networks Lab': ['Dr. M. Senthilkumaran'], 'Programming in Java Lab': ['Dr. M. Saraswathi'],
                 'DBMS Lab': ['Mr. T. Prakash'], 'Natural Language Processing': ['Dr. R. Prema'],
                 'NLP Lab': ['Dr. R. Prema']},
    'III-V-S4': {'Computer Networks': ['Dr. M. Senthilkumaran'], 'Programming in Java': ['Dr. V. Geetha'],
                 'DBMS': ['Dr. D. Thamaraiselvi'], 'Professional Elective-I': ['Ms. Hema Poorani'],
                 'Computer Networks Lab': ['Dr. M. Senthilkumaran'], 'Programming in Java Lab': ['Dr. V. Geetha'],
                 'DBMS Lab': ['Dr. D. Thamaraiselvi'], 'Natural Language Processing': ['Dr. M. Gayathri'],
                 'NLP Lab': ['Dr. M. Gayathri']},
    'III-V-S5': {'Computer Networks': ['Mr. B. Karthikeyan'], 'Programming in Java': ['Dr. V. Geetha'],
                 'DBMS': ['Ms. Hema Poorani'], 'Professional Elective-I': ['Ms. Hema Poorani'],
                 'Computer Networks Lab': ['Mr. B. Karthikeyan'], 'Programming in Java Lab': ['Dr. V. Geetha'],
                 'DBMS Lab': ['Ms. Hema Poorani'], 'Natural Language Processing': ['Ms. R. Radhika'],
                 'Data Visualization Lab': ['Dr. C. K. Gomathy']},
    'III-V-S6': {'Computer Networks': ['Mr. B. Karthikeyan'], 'Programming in Java': ['Mr. E. Sankar'],
                 'DBMS': ['Mr. D. Jeevan Kumar'], 'Professional Elective-I': ['Ms. Hema Poorani'],
                 'Computer Networks Lab': ['Mr. B. Karthikeyan'], 'Programming in Java Lab': ['Mr. E. Sankar'],
                 'DBMS Lab': ['Mr. D. Jeevan Kumar'], 'Natural Language Processing': ['Mr. P. Ramesh Chandra'],
                 'NLP Lab': ['Mr. P. Ramesh Chandra'], 'Data Visualization Lab': ['Mr. P. Ramesh Chandra']},
    'III-V-S7-CSE': {'Computer Networks': ['Dr. N.C.A. Boovarahan'], 'Programming in Java': ['Dr. M. Saraswathi'],
                     'DBMS': ['Mr. D. Jeevan Kumar'], 'Professional Elective-I': ['Ms. Hema Poorani'],
                     'Computer Networks Lab': ['Dr. N.C.A. Boovarahan'], 'Programming in Java Lab': ['Dr. M. Saraswathi'],
                     'DBMS Lab': ['Mr. D. Jeevan Kumar'],
                     'Database & Network Security Lab': ['Mr. E. Sankar'],
                     'Database Security (Hons-CySec)': ['Mr. V. Balu'],
                     'Architecting Smart IoT Devices (Hons-IoT)': ['Dr. R. Govindarajan']},
    'III-V-S7-IT': {'Computer Networks': ['Dr. N.C.A. Boovarahan'], 'Programming in Java': ['Dr. M. Saraswathi'],
                    'DBMS': ['Mr. D. Jeevan Kumar'], 'Principle of Communication': [],
                    'IT Workshop': ['Mr. P. Ramesh Chandra'], 'Programming in Java Lab': ['Dr. M. Saraswathi'],
                    'DBMS Lab': ['Mr. D. Jeevan Kumar'], 'Natural Language Processing': ['Mr. P. Ramesh Chandra'],
                    'Data Visualization Lab': ['Mr. P. Ramesh Chandra'],
                    'Database & Network Security Lab': ['Mr. E. Sankar'],
                    'Database Security (Hons-CySec)': ['Mr. V. Balu'],
                    'Architecting Smart IoT Devices (Hons-IoT)': ['Dr. R. Govindarajan']},
    'II-III-S1': {'Digital Logic Design': ['Dr. S. Vijayaraghavan'],
                  'Computer Organization & Architecture': ['Dr. N.C.A. Boovarahan', 'Dr. T. Lakshmibai'],
                  'Data Structures & Algorithms': ['Mr. Sureshkumar Bhadram'],
                  'Fundamentals of Machine Learning': ['Mr. D. Harshawardhan'],
                  'Intelligent Systems': ['Mr. D. Jeevan Kumar']},
    'II-III-S2': {'Digital Logic Design': ['Dr. J. Vinothkumar'],
                  'Computer Organization & Architecture': ['Mr. R. Manikkavasagam', 'Mrs. T. Bhuvaneswari'],
                  'Data Structures & Algorithms': ['Mr. Sureshkumar Bhadram'],
                  'Fundamentals of Machine Learning': ['Dr. R. Sivaramakrishnan'],
                  'Intelligent Systems': ['Dr. M. Gayathri']},
    'II-III-S3': {'Digital Logic Design': ['Dr. S. Selvakumar'],
                  'Computer Organization & Architecture': ['Dr. T. Sundar', 'Mrs. T. Bhuvaneswari'],
                  'Data Structures & Algorithms': ['Dr. D. Thamaraiselvi'],
                  'Fundamentals of Machine Learning': ['Ms. R. Radhika'],
                  'AI & Machine Learning': ['Ms. R. Rajalakshmi']},
    'II-III-S4': {'Digital Logic Design': ['Dr. K. Anitha'],
                  'Computer Organization & Architecture': ['Dr. T. Lakshmibai', 'Mrs. T. Bhuvaneswari'],
                  'Data Structures & Algorithms': ['Ms. R. Preethi'],
                  'Fundamentals of Machine Learning': ['Dr. R. Sivaramakrishnan']},
    'II-III-S5': {'Digital Logic Design': ['Dr. P. Rajalakshmi'],
                  'Computer Organization & Architecture': ['Dr. T. Dineshkumar', 'Mrs. T. Bhuvaneswari'],
                  'Data Structures & Algorithms': ['Ms. R. Preethi'],
                  'Fundamentals of Machine Learning': ['Mr. T. Prakash'],
                  'Cyber Space Operations': ['Mr. B. Karthikeyan']},
    'II-III-S6': {'Digital Logic Design': ['Dr. V. Malathi'],
                  'Computer Organization & Architecture': ['Dr. T. Lakshmibai'],
                  'Data Structures & Algorithms': ['Mr. R. Manikkavasagam'],
                  'Fundamentals of Machine Learning': ['Mr. K. Harshawardhan'],
                  'Intelligent Systems': ['Mr. P. Ramesh Chandra']},
    'II-III-S7': {'Digital Logic Design': ['Dr. P. Rajalakshmi'],
                  'Computer Organization & Architecture': ['Dr. N.C.A. Boovarahan', 'Mrs. T. Bhuvaneswari'],
                  'Data Structures & Algorithms': ['Mr. R. Manikkavasagam'],
                  'Fundamentals of Machine Learning': ['Ms. R. Rajalakshmi'],
                  'Intelligent Systems': ['Mr. P. Ramesh Chandra']},
    'II-III-S8': {'Digital Logic Design': ['Dr. S. Bharathi'],
                  'Computer Organization & Architecture': ['Dr. T. Dineshkumar', 'Mrs. T. Bhuvaneswari'],
                  'Data Structures & Algorithms': ['Ms. S.E. Viswapriya'],
                  'Fundamentals of Machine Learning': ['Ms. R. Radhika'],
                  'AI & Machine Learning': ['Ms. R. Rajalakshmi']},
    'II-III-S9': {'Digital Logic Design': ['Dr. V. Malathi'],
                  'Computer Organization & Architecture': ['Dr. T. Sundar', 'Mr. R. Manikkavasagam'],
                  'Data Structures & Algorithms': ['Ms. S.E. Viswapriya'],
                  'Fundamentals of Machine Learning': ['Ms. R. Rajalakshmi'],
                  'AI & Machine Learning': ['Mr. K. Harshawardhan']},
}

# subjects listed in the PDF legend but with the faculty left blank there
BLANK_IN_SOURCE = {
    'Automata Theory', 'Principle of Communication', 'Professional Elective-I',
    'Natural Language Processing', 'NLP Lab', 'Data Visualization Lab',
    'Probability & Statistics', 'Intelligent Systems', 'AI & Machine Learning',
}

VENUE_SUB_RE = [
    re.compile(r'\bcomputer\s*lab\s*-?\s*\d*\b', re.I),
    re.compile(r'\b(dell|mad|sci|de)\s*lab\b', re.I),
]


def norm(s):
    s = s.replace('&', ' and ').replace('/', ' ').replace('\\', ' ')
    s = re.sub(r'[^a-z0-9 ]+', ' ', s.lower())
    return re.sub(r'\s+', ' ', s).strip()


def year_of(sid):
    return sid.split('-')[0]


def venues_of(line):
    """venue strings contained in a line (e.g. 'Computer Lab-4')."""
    out = []
    for rx in VENUE_SUB_RE:
        for m in rx.finditer(line):
            v = m.group(0)
            # 'nlp lab' inside 'NLP Lab' as a subject name must NOT be treated as venue
            out.append(v)
    return out


def resolve_cell(lines, year):
    """Return (subject, venues, clean_lines)."""
    clean, venues = [], []
    for l in lines:
        if not l.strip():
            continue
        for rx in VENUE_SUB_RE:
            l2 = rx.sub('', l)
            if l2 != l:
                for m in rx.finditer(l):
                    venues.append(m.group(0))
                l = l2
        t = re.sub(r'\s+', ' ', l).strip()
        if t and not (len(t) <= 1 and t in 'LUNCHBREAK'):
            clean.append(t)
    n = norm(' '.join(clean))
    if not n:
        return None, venues, clean, []
    aliases = CANON.get(year, {})
    matched = {}
    for key, canon in aliases.items():
        if key in n:
            matched[key] = canon
    # drop keys that are substrings of longer matched keys
    keys = sorted(matched, key=len)
    keep = {}
    for i, k in enumerate(keys):
        if any(k != k2 and k in k2 for k2 in keys[i + 1:]):
            continue
        keep[k] = matched[k]
    if len(keep) >= 2:
        # cell carries two subjects side by side (split/batch cells) -> show raw text
        return None, venues, clean, []
    if keep:
        return list(keep.values())[0], venues, clean, list(keep.keys())
    return None, venues, clean, []


def build():
    raw = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'tt_raw.json'))
    out = sys.argv[2] if len(sys.argv) > 2 else 'timetable.js'
    sections, warns = [], []
    for s in raw['sections']:
        h = s['header']
        sid = f"{h['year']}-{h['sem']}-{h['section']}"
        year = h['year']
        days = {}
        for day in DAYS:
            entries = []
            for c in s['grid'].get(day, []):
                ps = [p for p in c['periods'] if p != 'LUNCH']
                if not ps:
                    continue
                pnums = sorted(int(p[1:]) for p in ps)
                subject, venues, lines, _ = resolve_cell(c['lines'], year)
                fac, facnote = [], ''
                if subject:
                    fac = FACULTY.get(sid, {}).get(subject, [])
                    if subject not in FACULTY.get(sid, {}) and subject not in ACTIVITY \
                            and subject not in BLANK_IN_SOURCE:
                        warns.append(f'{sid} {day} P{pnums}: "{subject}" not in faculty map')
                    if not fac and subject in BLANK_IN_SOURCE:
                        facnote = 'not listed in the timetable legend'
                entries.append({
                    'p': pnums,
                    'start': PERIODS[pnums[0] - 1]['start'],
                    'end': PERIODS[pnums[-1] - 1]['end'],
                    'lines': lines,
                    'venues': sorted(set(venues)),
                    'subject': subject,
                    'faculty': fac,
                    'facnote': facnote,
                })
            days[day] = entries
        sections.append({'id': sid, 'year': h['year'], 'sem': h['sem'], 'section': h['section'],
                         'label': f"{h['year']} / {h['sem']} / {h['section']}",
                         'incharge': h['incharge'], 'days': days})
    data = {
        'meta': {
            'institution': 'SCSVMV (Deemed University), Enathur, Kanchipuram',
            'department': 'Department of Computer Science and Engineering',
            'term': 'Odd Semester · Aug 2026 – Dec 2026',
            'source': 'Class Time Table Jul 2026.pdf — 19 sections (CSE)',
            'generated': 'Sep 2026',
        },
        'periods': PERIODS,
        'sections': sections,
    }
    n_entries = sum(len(e) for sec in sections for e in sec['days'].values())
    n_fac = len({f for sec in sections for day in sec['days'].values() for e in day for f in e['faculty']})
    with open(out, 'w') as f:
        f.write('/* Auto-generated by tools/build_data.py — do not edit by hand. */\n')
        f.write('const FMF = ' + json.dumps(data, ensure_ascii=False, indent=0) + ';\n')
    print(f'wrote {out}: {len(sections)} sections, {n_entries} timetable entries, {n_fac} faculty names')
    if warns:
        print(f'{len(warns)} warnings:')
        for w in warns:
            print('  ', w)


if __name__ == '__main__':
    build()
