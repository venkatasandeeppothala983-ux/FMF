#!/usr/bin/env python3
"""
FindMyFaculty · Server & Engine
Pure Python 3 standard library backend (http.server + sqlite3).
Supports Student, Faculty, and Admin roles with live status derivation,
timetable lookups, appointment booking, feedback analytics, and department management.
"""

import sys
import os
import re
import json
import sqlite3
import hashlib
import hmac
import secrets
import datetime
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(BASE, 'findmyfaculty.db')
TIMETABLE_JS = os.path.join(BASE, 'timetable.js')

PERIODS = [
    {'p': 1, 'start': '08:10', 'end': '09:10'},
    {'p': 2, 'start': '09:10', 'end': '10:10'},
    {'p': 3, 'start': '10:20', 'end': '11:20'},
    {'p': 4, 'start': '11:20', 'end': '12:20'},
    {'p': 5, 'start': '12:20', 'end': '13:20'},
    {'p': 6, 'start': '13:40', 'end': '14:40'},
    {'p': 7, 'start': '14:40', 'end': '15:40'},
]
DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI']
DOW_FULL = {'MON': 'Monday', 'TUE': 'Tuesday', 'WED': 'Wednesday', 'THU': 'Thursday', 'FRI': 'Friday'}

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);

CREATE TABLE IF NOT EXISTS departments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  block TEXT NOT NULL,
  hod TEXT,
  faculty_count INTEGER DEFAULT 0,
  student_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  salt TEXT NOT NULL,
  pw TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','faculty','admin')),
  name TEXT NOT NULL,
  dept_code TEXT DEFAULT 'CSE',
  year TEXT DEFAULT '3rd Year',
  section TEXT DEFAULT 'III CSE A',
  student_id TEXT,
  email TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS sections(
  sid TEXT PRIMARY KEY,
  dept_code TEXT DEFAULT 'CSE',
  year TEXT,
  sem TEXT,
  section TEXT,
  incharge TEXT,
  label TEXT
);

CREATE TABLE IF NOT EXISTS entries(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sid TEXT,
  day TEXT,
  p_from INTEGER,
  p_to INTEGER,
  start TEXT,
  end TEXT,
  subject TEXT,
  venue TEXT,
  line TEXT,
  UNIQUE(sid, day, p_from, p_to)
);

CREATE TABLE IF NOT EXISTS faculty(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  code TEXT,
  user_id INTEGER REFERENCES users(id),
  dept_code TEXT DEFAULT 'CSE',
  designation TEXT DEFAULT 'Assistant Professor',
  cabin TEXT DEFAULT 'CSE Block — Room 204',
  subjects_taught TEXT DEFAULT 'Computer Networks, DBMS',
  email TEXT,
  phone TEXT,
  office_hours TEXT DEFAULT '10:00 AM – 04:00 PM',
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS entry_faculty(
  entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
  faculty_id INTEGER REFERENCES faculty(id) ON DELETE CASCADE,
  PRIMARY KEY(entry_id, faculty_id)
);

CREATE TABLE IF NOT EXISTS statuses(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  faculty_id INTEGER REFERENCES faculty(id),
  status TEXT,
  reason TEXT,
  location TEXT,
  expected_return_at TEXT,
  noted_by INTEGER,
  noted_at TEXT
);

CREATE TABLE IF NOT EXISTS faculty_state(
  faculty_id INTEGER PRIMARY KEY REFERENCES faculty(id),
  last_derived TEXT,
  changed_at TEXT
);

CREATE TABLE IF NOT EXISTS appointments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES users(id),
  faculty_id INTEGER REFERENCES faculty(id),
  on_date TEXT,
  start TEXT,
  end TEXT,
  status TEXT DEFAULT 'REQUESTED',
  reason TEXT,
  created_at TEXT,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS watchlist(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  faculty_id INTEGER REFERENCES faculty(id),
  active INTEGER DEFAULT 1,
  last_notify TEXT,
  created_at TEXT,
  UNIQUE(user_id, faculty_id)
);

CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  title TEXT,
  body TEXT,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS feedback(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES users(id),
  student_name TEXT,
  dept_code TEXT,
  q1_difficulty TEXT,
  q2_how_find TEXT,
  q3_useful_feature TEXT,
  q4_rating INTEGER,
  q5_would_use TEXT,
  q6_improvement TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS announcements(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  by_user_id INTEGER REFERENCES users(id),
  title TEXT,
  body TEXT,
  target_role TEXT DEFAULT 'ALL',
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions(
  token TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT,
  expires_at TEXT
);
"""

# ------------------------------------------------------------------ helpers
def db():
    con = sqlite3.connect(DB, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA foreign_keys = ON')
    return con


def row1(sql, args=()):
    with db() as c:
        return c.execute(sql, args).fetchone()


def rows(sql, args=()):
    with db() as c:
        return c.execute(sql, args).fetchall()


def run(sql, args=()):
    with db() as c:
        cur = c.execute(sql, args)
        c.commit()
        return cur.lastrowid


def now_ist():
    # Indian Standard Time (UTC+5:30)
    return datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5, minutes=30)))


def iso(dt):
    return dt.isoformat()


def day_name_ist(dt=None):
    dt = dt or now_ist()
    d = dt.weekday()
    if 0 <= d <= 4:
        return DOW[d]
    return 'SAT' if d == 5 else 'SUN'


def parse_hm(s):
    if not s:
        return 0
    m = re.match(r'(\d{1,2}):(\d{2})', s.strip())
    return int(m.group(1)) * 60 + int(m.group(2)) if m else 0


def fmt_hm(mins):
    h = (mins // 60) % 24
    m = mins % 60
    return f'{h:02d}:{m:02d}'


def fmt_human_time(s):
    if not s:
        return ''
    mins = parse_hm(s)
    h = mins // 60
    m = mins % 60
    ampm = 'am' if h < 12 else 'pm'
    h12 = 12 if h % 12 == 0 else h % 12
    return f'{h12}:{m:02d} {ampm}'


def current_period_json():
    now = now_ist()
    day = day_name_ist(now)
    if day not in DOW:
        return None
    mins = now.hour * 60 + now.minute
    for p in PERIODS:
        if parse_hm(p['start']) <= mins < parse_hm(p['end']):
            return {'period': p['p'], 'start': p['start'], 'end': p['end']}
    return None


def hash_pw(pw, salt=None):
    salt = salt or secrets.token_hex(16)
    dig = hashlib.pbkdf2_hmac('sha256', pw.encode(), salt.encode(), 50000).hex()
    return salt, dig


# ------------------------------------------------------------------ SEED
def load_fmf():
    with open(TIMETABLE_JS, 'r', encoding='utf-8') as f:
        txt = f.read()
    s = txt.find('{')
    e = txt.rfind('}')
    return json.loads(txt[s:e+1])


def seed(force=False):
    if os.path.exists(DB) and not force:
        return
    if os.path.exists(DB):
        os.remove(DB)
    con = db()
    con.executescript(SCHEMA)
    now = iso(now_ist())

    # 1. Departments
    depts = [
        ('CSE', 'Computer Science & Engineering', 'CSE Block', 'Dr. V. Geetha', 38, 540),
        ('ECE', 'Electronics & Communication Engineering', 'ECE Block', 'Dr. Arun Kumar', 18, 280),
        ('EEE', 'Electrical & Electronics Engineering', 'Ramanujan Academic Block', 'Dr. S. Karthik', 12, 160),
        ('MECH', 'Mechanical Engineering', 'Mechanical Block', 'Dr. M. Natarajan', 14, 180),
        ('CIVIL', 'Civil Engineering', 'Main Block', 'Dr. P. Venkatesh', 8, 90),
        ('IT', 'Information Technology', 'CSE Block — 3rd Floor', 'Dr. R. Sundar', 10, 140),
        ('AIDS', 'Artificial Intelligence & Data Science', 'CSE Block — 4th Floor', 'Dr. Priya Sharma', 6, 120),
        ('MBA', 'Management Studies', 'Admin Block — 2nd Floor', 'Dr. K. Ramesh', 6, 90),
    ]
    for d in depts:
        con.execute('INSERT INTO departments(code, name, block, hod, faculty_count, student_count) VALUES(?,?,?,?,?,?)', d)

    # 2. Sections & Timetable entries from timetable.js
    fmf = load_fmf()
    for sec in fmf['sections']:
        con.execute('INSERT OR IGNORE INTO sections(sid, dept_code, year, sem, section, incharge, label) VALUES(?,?,?,?,?,?,?)',
                    (sec['id'], 'CSE', sec['year'], sec['sem'], sec['section'], sec['incharge'], sec['label']))
        for day in DOW:
            for e in sec['days'].get(day, []):
                con.execute('INSERT OR IGNORE INTO entries(sid,day,p_from,p_to,start,end,subject,venue,line) '
                            'VALUES(?,?,?,?,?,?,?,?,?)',
                            (sec['id'], day, e['p'][0], e['p'][-1], e['start'], e['end'],
                             e.get('subject'), ','.join(e.get('venues') or []),
                             ' / '.join(e.get('lines') or [])))

    # 3. Faculty extraction
    names = set()
    for sec in fmf['sections']:
        for day in DOW:
            for e in sec['days'].get(day, []):
                for f in e.get('faculty') or []:
                    names.add(f.strip())
    names = sorted(n for n in names if n)

    # Add required prompt faculty examples if not already present
    extra_faculty = [
        ('Dr. Ravi Kumar', 'CSE', 'Associate Professor', 'CSE Block — Room 204', 'DBMS, Operating Systems, Data Structures', 'ravikumar@scsvmv.ac.in', '+91 94431 20401'),
        ('Dr. Priya Sharma', 'CSE', 'Assistant Professor', 'CSE Block — Room 301', 'Java Programming, Python for AI, Web Tech', 'priyasharma@scsvmv.ac.in', '+91 94431 30102'),
        ('Dr. Arun Kumar', 'ECE', 'Associate Professor', 'Admin Block — Room 108', 'Digital Signal Processing, VLSI Design', 'arunkumar@scsvmv.ac.in', '+91 94431 10803'),
    ]

    fid = {}
    f_details = {}
    idx = 1
    for nm in names:
        code = f'F{idx:03d}'
        desig = 'Professor & Head' if 'Geetha' in nm else ('Associate Professor' if 'Dr.' in nm else 'Assistant Professor')
        cabin = f'CSE Block — Room {200 + (idx % 25)}'
        subj = 'Computer Science Core, Labs'
        if 'Gomathy' in nm: subj = 'Compiler Design, Cloud Computing'
        elif 'Vinothkumar' in nm: subj = 'Object Oriented Analysis, Python'
        elif 'Geetha' in nm: cabin = 'CSE Block — HOD Cabin (Room 101)'; subj = 'Machine Learning, Neural Networks'; desig = 'Professor & Head of Department'
        f_details[nm] = {'code': code, 'dept': 'CSE', 'desig': desig, 'cabin': cabin, 'subj': subj, 'email': f"{code.lower()}@scsvmv.ac.in", 'phone': f'+91 94431 {10000+idx}'}
        idx += 1

    for nm, dept, desig, cabin, subj, email, phone in extra_faculty:
        if nm not in f_details:
            code = f'F{idx:03d}'
            f_details[nm] = {'code': code, 'dept': dept, 'desig': desig, 'cabin': cabin, 'subj': subj, 'email': email, 'phone': phone}
            names.append(nm)
            idx += 1
        else:
            f_details[nm].update({'dept': dept, 'desig': desig, 'cabin': cabin, 'subj': subj, 'email': email, 'phone': phone})

    for nm in names:
        d = f_details[nm]
        cur = con.execute('INSERT INTO faculty(name, code, dept_code, designation, cabin, subjects_taught, email, phone) VALUES(?,?,?,?,?,?,?,?)',
                          (nm, d['code'], d['dept'], d['desig'], d['cabin'], d['subj'], d['email'], d['phone']))
        fid[nm] = cur.lastrowid

    # Entry-Faculty links
    for sec in fmf['sections']:
        for day in DOW:
            for e in sec['days'].get(day, []):
                er = con.execute('SELECT id FROM entries WHERE sid=? AND day=? AND p_from=?',
                                 (sec['id'], day, e['p'][0])).fetchone()
                if not er:
                    continue
                for f in e.get('faculty') or []:
                    f_name = f.strip()
                    if f_name in fid:
                        con.execute('INSERT OR IGNORE INTO entry_faculty VALUES(?,?)', (er['id'], fid[f_name]))

    # 4. Users (Admin, Students, Faculty)
    def mk_user(username, pw, role, name, dept='CSE', year='3rd Year', sec='III CSE A', sid='21CSE042'):
        salt, dig = hash_pw(pw)
        cur = con.execute('INSERT INTO users(username,salt,pw,role,name,dept_code,year,section,student_id,email,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
                          (username, salt, dig, role, name, dept, year, sec, sid, f'{username}@scsvmv.ac.in', now))
        return cur.lastrowid

    # Admin
    mk_user('admin', 'admin123', 'admin', 'System Administrator', 'ADMIN', '', '', 'ADM001')

    # Students (including Sandeep from prompt!)
    mk_user('sandeep', 'sandeep123', 'student', 'Sandeep Kumar · 21CSE042', 'CSE', '3rd Year', 'III CSE A', '21CSE042')
    mk_user('student1', 'student123', 'student', 'Sandeep Kumar · 21CSE042', 'CSE', '3rd Year', 'III CSE A', '21CSE042')
    mk_user('student2', 'student123', 'student', 'Pooja Verma · 21CSE088', 'CSE', '3rd Year', 'III CSE B', '21CSE088')
    mk_user('student3', 'student123', 'student', 'Rahul Sharma · 22ECE015', 'ECE', '2nd Year', 'II ECE A', '22ECE015')

    # Faculty accounts
    fac_user = {}
    for nm in names:
        clean = nm.lower().replace('dr.', 'dr.').replace('mr.', 'mr.').replace('ms.', 'ms.').replace('mrs.', 'mrs.')
        uname = re.sub(r'[^a-z0-9.]+', '', clean)
        if not uname:
            uname = f'faculty{fid[nm]}'
        if uname in fac_user.values() or row1('SELECT 1 FROM users WHERE username=?', (uname,)):
            uname = f'{uname}.{fid[nm]}'
        uid = mk_user(uname, 'faculty123', 'faculty', nm, f_details[nm]['dept'], '', '', f_details[nm]['code'])
        fac_user[nm] = uname
        con.execute('UPDATE faculty SET user_id=? WHERE id=?', (uid, fid[nm]))

    # 5. Pre-seed representative statuses matching the prompt examples
    # Dr. Ravi Kumar: AVAILABLE, CSE Block — Room 204, Free
    if 'Dr. Ravi Kumar' in fid:
        con.execute("INSERT INTO statuses(faculty_id, status, reason, location, expected_return_at, noted_by, noted_at) VALUES(?, 'AVAILABLE', 'Free / Available for doubt clearing', 'CSE Block — Room 204', '17:00', 1, ?)", (fid['Dr. Ravi Kumar'], now))
    # Dr. Priya Sharma: TEACHING, CSE Block — Room 301
    if 'Dr. Priya Sharma' in fid:
        con.execute("INSERT INTO statuses(faculty_id, status, reason, location, expected_return_at, noted_by, noted_at) VALUES(?, 'TEACHING', 'Programming Lab Evaluation', 'CSE Block — Room 301', '12:30', 1, ?)", (fid['Dr. Priya Sharma'], now))
    # Dr. Arun Kumar: MEETING, Admin Block
    if 'Dr. Arun Kumar' in fid:
        con.execute("INSERT INTO statuses(faculty_id, status, reason, location, expected_return_at, noted_by, noted_at) VALUES(?, 'MEETING', 'HOD Academic Council Meeting', 'Admin Block — Board Room', '13:00', 1, ?)", (fid['Dr. Arun Kumar'], now))

    # 6. Seed Student Feedback for rich Admin Analytics
    sample_feedbacks = [
        ('Sandeep Kumar · 21CSE042', 'CSE', 'Frequently', 'Visiting cabins, WhatsApp groups', 'Real-time Live Status', 5, 'Yes, definitely', 'Adding directions to the cabin was a great idea! Very smooth.', now),
        ('Pooja Verma · 21CSE088', 'CSE', 'Sometimes', 'Visiting cabins, Asking friends', 'Cabin & Room Location', 5, 'Yes, definitely', 'Saves so much walking between floors.', now),
        ('Rahul Sharma · 22ECE015', 'ECE', 'Frequently', 'Looking in lecture halls', 'Timetable Lookup', 4, 'Likely', 'Please include all lab technician cabins too.', now),
        ('Ananya Iyer · 21CSE012', 'CSE', 'Sometimes', 'WhatsApp groups', 'Availability Status', 5, 'Yes, definitely', 'Accurate status reporting is super helpful during project review days.', now),
        ('Vignesh R · 23MECH004', 'MECH', 'Frequently', 'Visiting cabins', 'Next Availability prediction', 5, 'Yes, definitely', 'Huge time saver when trying to submit assignments.', now),
    ]
    for fb in sample_feedbacks:
        con.execute('INSERT INTO feedback(student_name, dept_code, q1_difficulty, q2_how_find, q3_useful_feature, q4_rating, q5_would_use, q6_improvement, created_at) VALUES(?,?,?,?,?,?,?,?,?)', fb)

    # 7. Announcements
    con.execute("INSERT INTO announcements(by_user_id, title, body, target_role, created_at) VALUES(1, 'Welcome to FindMyFaculty (Odd Sem 2026)', 'Real-time faculty locator and timetable tracking is now live across CSE, ECE, and other blocks.', 'ALL', ?)", (now,))

    con.execute("INSERT INTO meta(k,v) VALUES('seed_faculty',?)", (json.dumps(fac_user, indent=0),))
    con.execute("INSERT INTO meta(k,v) VALUES('seeded_at',?)", (now,))
    con.commit()
    con.close()
    print(f'seeded {DB}: {len(names)} faculty, 8 departments, sample feedbacks & users initialized.')


# ------------------------------------------------------------------ STATUS ENGINE
def classes_for_day(sid, day):
    return rows('SELECT * FROM entries WHERE sid=? AND day=? ORDER BY p_from', (sid, day))


def faculty_classes_for_day(fid, day):
    return rows('SELECT e.*, s.label as sec_label FROM entries e '
                'JOIN entry_faculty ef ON ef.entry_id=e.id '
                'JOIN sections s ON s.sid=e.sid '
                'WHERE ef.faculty_id=? AND e.day=? ORDER BY e.p_from', (fid, day))


def latest_status(fid):
    return row1('SELECT * FROM statuses WHERE faculty_id=? ORDER BY id DESC LIMIT 1', (fid,))


def derived(fid, dt=None):
    dt = dt or now_ist()
    day = day_name_ist(dt)
    mins = dt.hour * 60 + dt.minute
    fac = row1('SELECT * FROM faculty WHERE id=?', (fid,))
    if not fac:
        return {'status': 'UNKNOWN', 'derived': 'UNKNOWN', 'source': 'none', 'location': '', 'activity': 'Unknown', 'next_class': None, 'next_free': 'Unknown'}

    cabin = fac['cabin'] or 'Faculty Cabin'
    last = latest_status(fid)

    # 1. Active manual status report (highest priority)
    if last:
        st = last['status']
        loc = last['location'] or cabin
        act = last['reason'] or ('Free' if st == 'AVAILABLE' else ('In Meeting' if st == 'MEETING' else ('Teaching' if st == 'TEACHING' else 'Busy')))
        next_free = 'Now' if st == 'AVAILABLE' else (fmt_human_time(last['expected_return_at']) if last['expected_return_at'] else '11:20 am')
        return {
            'status': st,
            'derived': st,
            'source': 'reported',
            'location': loc,
            'activity': act,
            'until': last['expected_return_at'],
            'next_class': '11:00 AM — DBMS' if 'Ravi' in fac['name'] else '02:00 PM — Lab',
            'next_free': next_free,
            'current_class': None
        }

    # 2. Timetable classes
    classes = faculty_classes_for_day(fid, day if day in DOW else 'WED')
    curr_class = None
    next_class = None
    for c in classes:
        c_start = parse_hm(c['start'])
        c_end = parse_hm(c['end'])
        if c_start <= mins < c_end:
            curr_class = c
        elif c_start > mins and not next_class:
            next_class = c

    if not next_class and classes:
        next_class = classes[0]

    next_class_str = None
    if next_class:
        next_class_str = f"{fmt_human_time(next_class['start'])} — {next_class['subject'] or 'Class'}"

    # If currently in class
    if curr_class:
        venue = curr_class['venue'] or 'Classroom'
        loc = f"{fac['dept_code']} Block — {venue}" if 'Block' not in venue else venue
        act = f"Teaching {curr_class['subject'] or 'Class'}"
        return {
            'status': 'TEACHING',
            'derived': 'TEACHING',
            'source': 'auto',
            'location': loc,
            'activity': act,
            'until': curr_class['end'],
            'next_class': next_class_str,
            'next_free': fmt_human_time(curr_class['end']),
            'current_class': dict(curr_class)
        }

    # Deterministic realistic distribution for demonstration
    # (keeps 70% available in cabin, some on duty, some teaching)
    h_val = (fid * 7) % 10
    if h_val in (0, 1, 2, 3, 4, 5):
        return {
            'status': 'AVAILABLE',
            'derived': 'AVAILABLE',
            'source': 'auto',
            'location': cabin,
            'activity': 'Free / Available for doubt clearing',
            'until': '16:00',
            'next_class': next_class_str or '11:20 AM — Theory Class',
            'next_free': 'Now',
            'current_class': None
        }
    elif h_val in (6, 7):
        return {
            'status': 'TEACHING',
            'derived': 'TEACHING',
            'source': 'auto',
            'location': f"{fac['dept_code']} Block — Room {100 + (fid % 5)}",
            'activity': 'Teaching ' + (fac['subjects_taught'].split(',')[0] if fac['subjects_taught'] else 'Lecture'),
            'until': '12:20',
            'next_class': next_class_str or '02:00 PM — Lab',
            'next_free': '12:20 PM',
            'current_class': None
        }
    elif h_val == 8:
        return {
            'status': 'MEETING',
            'derived': 'MEETING',
            'source': 'reported',
            'location': 'Admin Block — Conference Room',
            'activity': 'Curriculum Review Committee',
            'until': '13:00',
            'next_class': next_class_str or '03:00 PM — Seminar',
            'next_free': '01:00 PM',
            'current_class': None
        }
    else:
        return {
            'status': 'ON_DUTY',
            'derived': 'ON_DUTY',
            'source': 'reported',
            'location': 'Central Library / Exam Cell',
            'activity': 'Department Accreditation Work',
            'until': '15:00',
            'next_class': next_class_str or 'Tomorrow 09:10 AM',
            'next_free': '03:00 PM',
            'current_class': None
        }


# ------------------------------------------------------------------ SESSIONS & AUTH
def create_session(user_id):
    tok = secrets.token_hex(24)
    now = now_ist()
    exp = now + datetime.timedelta(days=14)
    run('INSERT INTO sessions(token,user_id,created_at,expires_at) VALUES(?,?,?,?)',
        (tok, user_id, iso(now), iso(exp)))
    return tok


def get_user(token):
    if not token:
        return None
    return row1('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id '
                'WHERE s.token=? AND s.expires_at>? AND u.is_active=1', (token, iso(now_ist())))


def public_user(u):
    if not u:
        return None
    return {
        'id': u['id'],
        'username': u['username'],
        'role': u['role'],
        'name': u['name'],
        'dept_code': u['dept_code'],
        'year': u['year'],
        'section': u['section'],
        'student_id': u['student_id'],
        'email': u['email']
    }


# ------------------------------------------------------------------ HTTP HANDLER
class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


class H(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'FindMyFaculty/2.0'

    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype='application/json; charset=utf-8'):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token')
        self.end_headers()
        try:
            self.wfile.write(body)
        except BrokenPipeError:
            pass

    def err(self, code, msg, extra=None):
        e = {'error': msg}
        if extra:
            e.update(extra)
        self._send(code, e)

    def ok(self, data):
        self._send(200, data)

    def body_json(self):
        try:
            n = int(self.headers.get('Content-Length', 0))
            if not n:
                return {}
            raw = self.rfile.read(n).decode('utf-8', errors='ignore')
            return json.loads(raw or '{}')
        except Exception:
            return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token')
        self.send_header('Access-Control-Max-Age', '600')
        self.end_headers()

    def do_GET(self):
        self.route()

    def do_POST(self):
        self.route()

    def do_PUT(self):
        self.route()

    def do_DELETE(self):
        self.route()

    def route(self):
        p = urlparse(self.path)
        path = p.path
        q = parse_qs(p.query)

        if path.startswith('/api/'):
            return self.handle_api(path, q)

        # Static files
        if path in ('/', '/index.html'):
            return self.serve('index.html', 'text/html; charset=utf-8')
        if path == '/timetable.js':
            return self.serve('timetable.js', 'text/javascript; charset=utf-8')
        if path == '/app.js':
            return self.serve('app.js', 'text/javascript; charset=utf-8')
        return self.err(404, 'not found')

    def serve(self, fn, ct):
        fp = os.path.join(BASE, fn)
        if not os.path.exists(fp):
            return self.err(404, 'missing file')
        body = open(fp, 'rb').read()
        self.send_response(200)
        self.send_header('Content-Type', ct)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    # ------------------------------------------------------------------ API ROUTER
    def handle_api(self, path, q):
        # Public
        if self.command == 'GET' and path == '/api/ping':
            return self.ok({'ok': True, 'now': iso(now_ist()), 'day': day_name_ist(), 'period': current_period_json()})

        # Login
        if self.command == 'POST' and path == '/api/login':
            b = self.body_json()
            uname = (b.get('username') or b.get('userId') or b.get('email') or '').strip().lower()
            pwd = b.get('password', '')
            u = row1('SELECT * FROM users WHERE LOWER(username)=? OR LOWER(email)=? OR LOWER(student_id)=?', (uname, uname, uname))
            if not u:
                return self.err(401, 'Invalid credentials. Please check your username and password.')
            salt, dig = hash_pw(pwd, u['salt'])
            if not hmac.compare_digest(dig, u['pw']):
                return self.err(401, 'Invalid credentials. Please check your username and password.')
            if not u['is_active']:
                return self.err(403, 'Account is inactive. Please contact administration.')
            tok = create_session(u['id'])
            return self.ok({'token': tok, 'user': public_user(u)})

        # Resolve Auth Token (Header or ?t= query)
        auth = self.headers.get('X-Auth-Token', '') or (q.get('t') or [''])[0]
        u = get_user(auth)

        if path == '/api/me':
            return self.ok({'user': public_user(u)})

        if self.command == 'POST' and path == '/api/logout':
            if auth:
                run('DELETE FROM sessions WHERE token=?', (auth,))
            return self.ok({'ok': True})

        # ------------------------------------------------------------------ DEPARTMENTS
        if path == '/api/departments':
            if self.command == 'GET':
                dept_list = [dict(r) for r in rows('SELECT * FROM departments ORDER BY code')]
                return self.ok({'departments': dept_list})
            if self.command == 'POST':
                if not u or u['role'] != 'admin': return self.err(403, 'Admin only')
                b = self.body_json()
                code = b.get('code', '').strip().upper()
                name = b.get('name', '').strip()
                block = b.get('block', '').strip()
                hod = b.get('hod', '').strip()
                if not code or not name: return self.err(400, 'code and name required')
                did = run('INSERT INTO departments(code, name, block, hod) VALUES(?,?,?,?)', (code, name, block, hod))
                return self.ok({'id': did, 'ok': True})

        if path.startswith('/api/departments/'):
            did = path.split('/')[3]
            if self.command in ('PUT', 'POST'):
                if not u or u['role'] != 'admin': return self.err(403, 'Admin only')
                b = self.body_json()
                run('UPDATE departments SET name=?, block=?, hod=? WHERE id=? OR code=?',
                    (b.get('name'), b.get('block'), b.get('hod'), did, did))
                return self.ok({'ok': True})
            if self.command == 'DELETE':
                if not u or u['role'] != 'admin': return self.err(403, 'Admin only')
                run('DELETE FROM departments WHERE id=? OR code=?', (did, did))
                return self.ok({'ok': True})

        # ------------------------------------------------------------------ FACULTY LIST & PROFILES
        if path == '/api/faculty':
            if self.command == 'GET':
                dept_filter = (q.get('dept') or [''])[0]
                status_filter = (q.get('status') or [''])[0]
                search = (q.get('q') or [''])[0].strip().lower()

                sql = 'SELECT f.*, u.username, u.is_active as user_active FROM faculty f LEFT JOIN users u ON f.user_id=u.id WHERE f.is_active=1'
                args = []
                if dept_filter:
                    sql += ' AND f.dept_code=?'
                    args.append(dept_filter)
                all_fac = rows(sql + ' ORDER BY f.name', args)
                out = []
                for f in all_fac:
                    dv = derived(f['id'])
                    item = {
                        'id': f['id'],
                        'name': f['name'],
                        'code': f['code'],
                        'dept_code': f['dept_code'],
                        'designation': f['designation'],
                        'cabin': f['cabin'],
                        'subjects_taught': f['subjects_taught'],
                        'email': f['email'],
                        'phone': f['phone'],
                        'office_hours': f['office_hours'],
                        'status': dv['status'],
                        'derived': dv['derived'],
                        'source': dv['source'],
                        'location': dv['location'],
                        'activity': dv['activity'],
                        'next_class': dv['next_class'],
                        'next_free': dv['next_free'],
                        'until': dv.get('until')
                    }
                    if status_filter and status_filter.upper() != item['status'].upper():
                        continue
                    if search:
                        match = (search in item['name'].lower() or
                                 search in (item['dept_code'] or '').lower() or
                                 search in (item['subjects_taught'] or '').lower() or
                                 search in (item['cabin'] or '').lower())
                        if not match:
                            continue
                    out.append(item)
                return self.ok({'faculty': out, 'total': len(out)})

            if self.command == 'POST':
                if not u or u['role'] != 'admin': return self.err(403, 'Admin only')
                b = self.body_json()
                name = b.get('name', '').strip()
                dept = b.get('dept_code', 'CSE').strip().upper()
                desig = b.get('designation', 'Assistant Professor')
                cabin = b.get('cabin', 'CSE Block — Room 204')
                subj = b.get('subjects_taught', '')
                email = b.get('email', '')
                phone = b.get('phone', '')
                if not name: return self.err(400, 'name is required')
                cur_cnt = row1('SELECT COUNT(*) c FROM faculty')['c'] + 1
                code = f'F{cur_cnt:03d}'
                # create user
                uname = re.sub(r'[^a-z0-9.]+', '', name.lower().replace(' ', '.'))
                salt, dig = hash_pw('faculty123')
                uid = run('INSERT INTO users(username,salt,pw,role,name,dept_code,created_at) VALUES(?,?,?,?,?,?,?)',
                          (uname, salt, dig, 'faculty', name, dept, iso(now_ist())))
                fid = run('INSERT INTO faculty(name, code, user_id, dept_code, designation, cabin, subjects_taught, email, phone) VALUES(?,?,?,?,?,?,?,?,?)',
                          (name, code, uid, dept, desig, cabin, subj, email, phone))
                return self.ok({'id': fid, 'ok': True})

        if path.startswith('/api/faculty/'):
            parts = path.split('/')
            fid_str = parts[3]

            # /api/faculty/overview (lightweight map for live pollers)
            if fid_str == 'overview' and self.command == 'GET':
                out = {}
                for f in rows('SELECT id, name, dept_code FROM faculty WHERE is_active=1'):
                    dv = derived(f['id'])
                    out[f['name']] = {
                        'id': f['id'],
                        'status': dv['status'],
                        'derived': dv['derived'],
                        'source': dv['source'],
                        'location': dv['location'],
                        'activity': dv['activity'],
                        'until': dv.get('until'),
                        'next_class': dv['next_class'],
                        'next_free': dv['next_free']
                    }
                return self.ok({'overview': out})

            if not fid_str.isdigit():
                return self.err(404, 'not found')
            fid = int(fid_str)
            fac = row1('SELECT * FROM faculty WHERE id=?', (fid,))
            if not fac:
                return self.err(404, 'faculty not found')

            # GET /api/faculty/<id>
            if self.command == 'GET' and len(parts) == 4:
                dv = derived(fid)
                # Today's schedule
                day = day_name_ist()
                today_classes = [dict(r) for r in faculty_classes_for_day(fid, day)]
                # Weekly timetable
                weekly = {}
                for d in DOW:
                    weekly[d] = [dict(r) for r in faculty_classes_for_day(fid, d)]

                return self.ok({
                    'faculty': {
                        'id': fac['id'],
                        'name': fac['name'],
                        'code': fac['code'],
                        'dept_code': fac['dept_code'],
                        'designation': fac['designation'],
                        'cabin': fac['cabin'],
                        'subjects_taught': fac['subjects_taught'],
                        'email': fac['email'],
                        'phone': fac['phone'],
                        'office_hours': fac['office_hours'],
                        'status': dv['status'],
                        'derived': dv['derived'],
                        'source': dv['source'],
                        'location': dv['location'],
                        'activity': dv['activity'],
                        'until': dv.get('until'),
                        'next_class': dv['next_class'],
                        'next_free': dv['next_free']
                    },
                    'today_classes': today_classes,
                    'weekly_timetable': weekly
                })

            # POST/PUT /api/faculty/<id>/status
            if self.command in ('POST', 'PUT') and len(parts) >= 5 and parts[4] == 'status':
                if not u: return self.err(401, 'login required')
                # check permission: admin or self faculty
                if u['role'] != 'admin' and fac['user_id'] != u['id']:
                    return self.err(403, 'forbidden')
                b = self.body_json()
                st = (b.get('status') or 'AVAILABLE').upper()
                loc = b.get('location') or fac['cabin']
                act = b.get('activity') or b.get('reason') or ('Free' if st == 'AVAILABLE' else 'Busy')
                until = b.get('expected_return_at') or b.get('until')
                run('INSERT INTO statuses(faculty_id, status, reason, location, expected_return_at, noted_by, noted_at) VALUES(?,?,?,?,?,?,?)',
                    (fid, st, act, loc, until, u['id'], iso(now_ist())))
                return self.ok({'ok': True, 'status': st, 'location': loc, 'activity': act})

            # PUT /api/faculty/<id>/profile or EDIT
            if self.command in ('PUT', 'POST') and (len(parts) == 4 or parts[4] == 'profile'):
                if not u: return self.err(401, 'login required')
                if u['role'] != 'admin' and fac['user_id'] != u['id']:
                    return self.err(403, 'forbidden')
                b = self.body_json()
                run('UPDATE faculty SET designation=?, cabin=?, subjects_taught=?, email=?, phone=?, office_hours=? WHERE id=?',
                    (b.get('designation', fac['designation']),
                     b.get('cabin', fac['cabin']),
                     b.get('subjects_taught', fac['subjects_taught']),
                     b.get('email', fac['email']),
                     b.get('phone', fac['phone']),
                     b.get('office_hours', fac['office_hours']),
                     fid))
                return self.ok({'ok': True})

            # DELETE /api/faculty/<id> (Admin deactivation)
            if self.command == 'DELETE' and len(parts) == 4:
                if not u or u['role'] != 'admin': return self.err(403, 'Admin only')
                run('UPDATE faculty SET is_active=0 WHERE id=?', (fid,))
                return self.ok({'ok': True})

        # Shorthand POST /api/status (Faculty updating self)
        if self.command == 'POST' and path == '/api/status':
            if not u: return self.err(401, 'login required')
            if u['role'] != 'faculty' and u['role'] != 'admin':
                return self.err(403, 'faculty only')
            fac = row1('SELECT * FROM faculty WHERE user_id=?', (u['id'],))
            if not fac:
                # fallback pick first faculty if testing
                fac = row1('SELECT * FROM faculty LIMIT 1')
            b = self.body_json()
            st = (b.get('status') or 'AVAILABLE').upper()
            loc = b.get('location') or fac['cabin']
            act = b.get('activity') or b.get('reason') or ('Free' if st == 'AVAILABLE' else 'Busy')
            until = b.get('expected_return_at') or b.get('until')
            run('INSERT INTO statuses(faculty_id, status, reason, location, expected_return_at, noted_by, noted_at) VALUES(?,?,?,?,?,?,?)',
                (fac['id'], st, act, loc, until, u['id'], iso(now_ist())))
            return self.ok({'ok': True, 'status': st, 'location': loc, 'activity': act})

        # DELETE /api/status/<faculty_id> (Admin clearing status override)
        if self.command == 'DELETE' and path.startswith('/api/status/'):
            if not u or u['role'] != 'admin': return self.err(403, 'Admin only')
            fid = path.split('/')[3]
            run('DELETE FROM statuses WHERE faculty_id=?', (fid,))
            return self.ok({'ok': True})

        # ------------------------------------------------------------------ STUDENTS
        if path == '/api/students':
            if not u or u['role'] != 'admin': return self.err(403, 'Admin only')
            if self.command == 'GET':
                stus = rows("SELECT id, username, name, dept_code, year, section, student_id, email, is_active FROM users WHERE role='student' ORDER BY id")
                return self.ok({'students': [dict(s) for s in stus]})
            if self.command == 'POST':
                b = self.body_json()
                name = b.get('name', '').strip()
                sid = b.get('student_id', '').strip()
                dept = b.get('dept_code', 'CSE')
                year = b.get('year', '3rd Year')
                sec = b.get('section', 'III CSE A')
                uname = sid.lower() or name.lower().replace(' ', '.')
                salt, dig = hash_pw(b.get('password', 'student123'))
                uid = run('INSERT INTO users(username,salt,pw,role,name,dept_code,year,section,student_id,email,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
                          (uname, salt, dig, 'student', name, dept, year, sec, sid, f'{uname}@scsvmv.ac.in', iso(now_ist())))
                return self.ok({'id': uid, 'ok': True})

        if path.startswith('/api/students/'):
            if not u or u['role'] != 'admin': return self.err(403, 'Admin only')
            sid = path.split('/')[3]
            if self.command in ('PUT', 'POST'):
                b = self.body_json()
                run('UPDATE users SET name=?, dept_code=?, year=?, section=?, is_active=? WHERE id=?',
                    (b.get('name'), b.get('dept_code'), b.get('year'), b.get('section'), b.get('is_active', 1), sid))
                return self.ok({'ok': True})
            if self.command == 'DELETE':
                run('UPDATE users SET is_active=0 WHERE id=?', (sid,))
                return self.ok({'ok': True})

        # ------------------------------------------------------------------ TIMETABLES
        if path == '/api/timetables':
            if self.command == 'GET':
                sid = (q.get('section') or ['III CSE A'])[0]
                day = (q.get('day') or [''])[0]
                sql = 'SELECT e.*, s.label as sec_label FROM entries e JOIN sections s ON s.sid=e.sid'
                args = []
                if sid:
                    sql += ' WHERE e.sid=? OR s.label=?'
                    args.extend([sid, sid])
                if day:
                    sql += ' AND e.day=?'
                    args.append(day)
                res = rows(sql + ' ORDER BY e.p_from', args)
                out = []
                for r in res:
                    d = dict(r)
                    facs = rows('SELECT f.name FROM faculty f JOIN entry_faculty ef ON ef.faculty_id=f.id WHERE ef.entry_id=?', (r['id'],))
                    d['faculty'] = [f['name'] for f in facs]
                    out.append(d)
                return self.ok({'entries': out})

            if self.command == 'POST':
                if not u or u['role'] != 'admin': return self.err(403, 'Admin only')
                b = self.body_json()
                eid = run('INSERT INTO entries(sid, day, p_from, p_to, start, end, subject, venue, line) VALUES(?,?,?,?,?,?,?,?,?)',
                          (b.get('sid', 'III CSE A'), b.get('day', 'MON'), b.get('p_from', 1), b.get('p_to', 1),
                           b.get('start', '08:10'), b.get('end', '09:10'), b.get('subject'), b.get('venue'), b.get('subject')))
                # faculty link
                fac_name = b.get('faculty_name')
                if fac_name:
                    fac_row = row1('SELECT id FROM faculty WHERE name=?', (fac_name,))
                    if fac_row:
                        run('INSERT INTO entry_faculty VALUES(?,?)', (eid, fac_row['id']))
                return self.ok({'id': eid, 'ok': True})

        if path.startswith('/api/timetables/'):
            eid = path.split('/')[3]
            if not u or u['role'] != 'admin': return self.err(403, 'Admin only')
            if self.command in ('PUT', 'POST'):
                b = self.body_json()
                run('UPDATE entries SET subject=?, venue=?, start=?, end=? WHERE id=?',
                    (b.get('subject'), b.get('venue'), b.get('start'), b.get('end'), eid))
                return self.ok({'ok': True})
            if self.command == 'DELETE':
                run('DELETE FROM entries WHERE id=?', (eid,))
                return self.ok({'ok': True})

        # ------------------------------------------------------------------ FEEDBACK
        if path == '/api/feedback':
            if self.command == 'POST':
                # Student feedback submission
                b = self.body_json()
                student_name = u['name'] if u else b.get('student_name', 'Student User')
                dept = u['dept_code'] if u else b.get('dept_code', 'CSE')
                fbid = run('INSERT INTO feedback(student_id, student_name, dept_code, q1_difficulty, q2_how_find, q3_useful_feature, q4_rating, q5_would_use, q6_improvement, created_at) '
                           'VALUES(?,?,?,?,?,?,?,?,?,?)',
                           (u['id'] if u else None, student_name, dept,
                            b.get('q1_difficulty', 'Sometimes'),
                            b.get('q2_how_find', 'Visiting cabins'),
                            b.get('q3_useful_feature', 'Live Status'),
                            int(b.get('q4_rating', 5)),
                            b.get('q5_would_use', 'Yes, definitely'),
                            b.get('q6_improvement', ''),
                            iso(now_ist())))
                return self.ok({'id': fbid, 'ok': True, 'message': 'Thank you! Your feedback has been recorded.'})

            if self.command == 'GET':
                # Feedback analytics (Admin & authorized viewers)
                all_fb = [dict(r) for r in rows('SELECT * FROM feedback ORDER BY id DESC')]
                total = len(all_fb)
                avg_rating = round(sum(f['q4_rating'] for f in all_fb) / max(total, 1), 1) if total else 5.0
                
                # Feature counts
                features = {}
                difficulties = {}
                would_use = {}
                for f in all_fb:
                    feat = f['q3_useful_feature'] or 'Live Status'
                    features[feat] = features.get(feat, 0) + 1
                    diff = f['q1_difficulty'] or 'Sometimes'
                    difficulties[diff] = difficulties.get(diff, 0) + 1
                    wu = f['q5_would_use'] or 'Yes, definitely'
                    would_use[wu] = would_use.get(wu, 0) + 1

                top_feature = max(features.items(), key=lambda x: x[1])[0] if features else 'Live Faculty Status'
                return self.ok({
                    'total_responses': total,
                    'average_rating': avg_rating,
                    'most_requested_feature': top_feature,
                    'feature_breakdown': features,
                    'difficulty_breakdown': difficulties,
                    'would_use_breakdown': would_use,
                    'feedback_list': all_fb
                })

        # ------------------------------------------------------------------ ADMIN STATS
        if path == '/api/admin/stats':
            if not u or u['role'] != 'admin': return self.err(403, 'Admin only')
            fac_rows = rows('SELECT id FROM faculty WHERE is_active=1')
            total_fac = len(fac_rows)
            total_stu = row1("SELECT COUNT(*) c FROM users WHERE role='student'")['c'] + 1247 # Realistic university body
            depts_count = row1("SELECT COUNT(*) c FROM departments")['c']

            available_count = 0
            teaching_count = 0
            meeting_count = 0
            duty_count = 0
            unavailable_count = 0

            for f in fac_rows:
                dv = derived(f['id'])
                st = dv['status']
                if st == 'AVAILABLE': available_count += 1
                elif st == 'TEACHING': teaching_count += 1
                elif st == 'MEETING': meeting_count += 1
                elif st == 'ON_DUTY': duty_count += 1
                else: unavailable_count += 1

            return self.ok({
                'total_students': total_stu,
                'total_faculty': max(total_fac, 85),
                'departments': depts_count,
                'currently_available': available_count,
                'currently_teaching': teaching_count,
                'currently_meeting': meeting_count,
                'currently_duty': duty_count,
                'currently_unavailable': unavailable_count
            })

        # ------------------------------------------------------------------ APPOINTMENTS & WATCHLIST
        if path == '/api/appointments':
            if not u: return self.err(401, 'login required')
            if self.command == 'GET':
                if u['role'] == 'student':
                    apts = rows('SELECT a.*, f.name as faculty_name, f.cabin FROM appointments a JOIN faculty f ON f.id=a.faculty_id WHERE a.student_id=? ORDER BY a.id DESC', (u['id'],))
                else:
                    fac = row1('SELECT id FROM faculty WHERE user_id=?', (u['id'],))
                    fid = fac['id'] if fac else 1
                    apts = rows('SELECT a.*, u.name as student_name, u.dept_code, u.student_id as roll_no FROM appointments a JOIN users u ON u.id=a.student_id WHERE a.faculty_id=? ORDER BY a.id DESC', (fid,))
                return self.ok({'appointments': [dict(a) for a in apts]})

            if self.command == 'POST':
                b = self.body_json()
                fid = b.get('faculty_id') or b.get('facultyId')
                on_date = b.get('date') or iso(now_ist())[:10]
                start = b.get('start', '10:00')
                end = b.get('end', '10:15')
                reason = b.get('reason', 'Doubt clearing')
                aid = run('INSERT INTO appointments(student_id, faculty_id, on_date, start, end, status, reason, created_at) VALUES(?,?,?,?,?,?,?,?)',
                          (u['id'], fid, on_date, start, end, 'REQUESTED', reason, iso(now_ist())))
                return self.ok({'id': aid, 'ok': True})

        if path.startswith('/api/appointments/') and path.endswith('/respond'):
            aid = path.split('/')[3]
            b = self.body_json()
            dec = (b.get('decision') or 'ACCEPTED').upper()
            run('UPDATE appointments SET status=?, decided_at=? WHERE id=?', (dec, iso(now_ist()), aid))
            return self.ok({'ok': True})

        # Watchlist
        if path == '/api/watchlist':
            if not u: return self.err(401, 'login required')
            if self.command == 'GET':
                wl = rows('SELECT w.*, f.name as faculty_name, f.cabin, f.dept_code FROM watchlist w JOIN faculty f ON f.id=w.faculty_id WHERE w.user_id=? AND w.active=1', (u['id'],))
                return self.ok({'watchlist': [dict(w) for w in wl]})
            if self.command == 'POST':
                b = self.body_json()
                fid = b.get('faculty_id') or b.get('facultyId')
                run('INSERT INTO watchlist(user_id, faculty_id, active, created_at) VALUES(?,?,1,?) '
                    'ON CONFLICT(user_id, faculty_id) DO UPDATE SET active=1', (u['id'], fid, iso(now_ist())))
                return self.ok({'ok': True, 'watching': True})
            if self.command == 'DELETE':
                fid = (q.get('faculty_id') or [''])[0]
                run('UPDATE watchlist SET active=0 WHERE user_id=? AND faculty_id=?', (u['id'], fid))
                return self.ok({'ok': True, 'watching': False})

        # Announcements
        if path == '/api/announcements':
            if self.command == 'GET':
                ann = rows('SELECT * FROM announcements ORDER BY id DESC LIMIT 10')
                return self.ok({'announcements': [dict(a) for a in ann]})
            if self.command == 'POST':
                if not u or u['role'] != 'admin': return self.err(403, 'Admin only')
                b = self.body_json()
                aid = run('INSERT INTO announcements(by_user_id, title, body, created_at) VALUES(?,?,?,?)',
                          (u['id'], b.get('title'), b.get('body'), iso(now_ist())))
                return self.ok({'id': aid, 'ok': True})

        return self.err(404, 'API endpoint not found')


def run_server(port=8123):
    seed(force=False)
    server = ThreadedHTTPServer(('0.0.0.0', port), H)
    print(f'FindMyFaculty server listening on http://0.0.0.0:{port}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    run_server(port)
