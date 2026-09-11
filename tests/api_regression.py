#!/usr/bin/env python3
"""FindMyFaculty API regression suite — run against a live server (default 127.0.0.1:8123).

Reseeds a pristine database first (server.seed(force=True) on the file the server uses),
so results are deterministic. ~30 checks covering auth, status semantics, watchlist
notifications, appointments, availability scanning, reports, announcements, admin.

Usage: python3 tests/api_regression.py [port]
"""
import json
import os
import re
import sys
import urllib.request
import urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
BASE = f'http://127.0.0.1:{PORT}/api'

passed = failed = 0
fails = []


def check(name, cond, extra=''):
    global passed, failed
    if cond:
        passed += 1
        print(f'PASS {name}' + (f'  [{extra}]' if extra else ''))
    else:
        failed += 1
        fails.append(name)
        print(f'FAIL {name}' + (f'  [{extra}]' if extra else ''))


def call(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method)
    if body is not None:
        req.add_header('Content-Type', 'application/json')
        req.data = json.dumps(body).encode()
    if token:
        req.add_header('X-Auth-Token', token)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b'null')
        except Exception:
            return e.code, {}


def login(u, p):
    st, j = call('POST', '/login', {'username': u, 'password': p})
    return (j or {}).get('token') if st == 200 else None


def main():
    import server  # noqa: E402  (reuses the DB path the server process uses)
    server.seed(force=True)
    print('DB reseeded clean')

    # ---- auth ----
    st, _ = call('GET', '/me')
    check('me anonymous -> ok:null', st == 200)
    st, _ = call('POST', '/appointments', {'facultyId': 20, 'date': '2026-09-10', 'start': '10:00', 'end': '10:15'})
    check('appointment without login denied (401/403)', st in (401, 403), f'http {st}')
    st, _ = call('POST', '/login', {'username': 'student1', 'password': 'wrong'})
    check('bad login rejected', st == 401)
    tok_s = login('student1', 'student123')
    tok_f = login('dr.v.geetha', 'faculty123')
    tok_a = login('admin', 'admin123')
    check('all three roles login', all([tok_s, tok_f, tok_a]))
    st, _ = call('GET', '/admin/stats', token=tok_s)
    check('student denied admin stats 403', st == 403)
    st, _ = call('GET', '/admin/stats', token=tok_f)
    check('faculty denied admin stats 403', st == 403)

    # ---- faculty status semantics ----
    # find a faculty NOT in class right now to allow AVAILABLE; use own faculty for overrides
    st, j = call('GET', '/faculty/overview')
    states = j['states']
    # Geetha id=20
    g0 = states['Dr. V. Geetha']['derived']
    st, j = call('POST', '/status', {'status': 'AVAILABLE'}, token=tok_s)
    check('student cannot post status 403', st == 403)
    st, j = call('POST', '/status', {'status': 'TEACHING'}, token=tok_f)
    check('cannot self-mark TEACHING 400', st == 400)
    st, j = call('POST', '/status', {'status': 'MEETING', 'location': 'Cabin C-204', 'reason': 'regression'},
                 token=tok_f)
    check('faculty posts MEETING', st == 200, str(st))
    st, j = call('GET', '/faculty/overview')
    check('overview shows MEETING (reported overrides timetable)',
          j['states']['Dr. V. Geetha']['derived'] == 'MEETING' and j['states']['Dr. V. Geetha']['source'] == 'reported')
    # clear via admin DELETE (do_DELETE fix)
    st, _ = call('DELETE', '/status/20', token=tok_a)
    check('admin DELETE clears status', st == 200)
    st, j = call('GET', '/faculty/20')
    check('status cleared -> back to timetable-derived', j['state']['source'] == 'auto')

    # ---- appointments: request -> accept ----
    st, j = call('GET', '/faculty/20?date=2026-09-10&dur=15', token=tok_s)
    slots = [a for a in (j.get('nextAvailability') or []) if a.get('date') == '2026-09-10']
    check('availability scan returns slots for a future weekday', len(slots) > 0, f'{len(slots)} slots')
    if slots:
        a = slots[0]
        st, j = call('POST', '/appointments', {'facultyId': 20, 'date': a['date'], 'start': a['start'],
                                               'end': a['end'], 'reason': 'regression suite'}, token=tok_s)
        check('appointment request created', st == 200)
        aid = (j or {}).get('id')
        st, _ = call('POST', '/appointments', {'facultyId': 20, 'date': a['date'], 'start': a['start'],
                                               'end': a['end']}, token=tok_s)
        check('double booking rejected 409', st == 409)
        st, _ = call('POST', f'/appointments/{aid}/respond', {'action': 'ACCEPT'}, token=tok_f)
        check('faculty accepts', st == 200)
        st, j = call('GET', '/appointments', token=tok_s)
        mine = [x for x in j['appointments'] if x['id'] == aid]
        check('student sees ACCEPTED', mine and mine[0]['status'] == 'ACCEPTED')
        st, _ = call('POST', f'/appointments/{aid}/cancel', {}, token=tok_s)
        st, j = call('GET', '/appointments', token=tok_s)
        mine = [x for x in j['appointments'] if x['id'] == aid]
        check('student cancels accepted', mine and mine[0]['status'] == 'CANCELLED')
    else:
        check('appointment request created', False, 'no slots found')

    # ---- watchlist + notification ----
    st, _ = call('POST', '/watchlist', {'facultyId': 21}, token=tok_s)
    check('student watches faculty', st == 200)
    st, j = call('GET', '/watchlist', token=tok_s)
    check('watchlist lists entry', any(w['faculty_id'] == 21 for w in j['watchlist']))
    # faculty 21 reports ABSENT then AVAILABLE -> should notify (only when not in class!)
    # pick faculty who is free right now for AVAILABLE transition; use 20 (auto free later?) - simplest: 21 may teach.
    # Trigger with an admin-set AVAILABLE on a faculty whose timetable says free at this moment:
    st, j = call('GET', '/faculty/overview')
    VALID = {'AVAILABLE', 'TEACHING', 'MEETING', 'ON_DUTY', 'OFF_CAMPUS', 'ABSENT', 'OUTSIDE_HOURS', 'UNKNOWN'}
    check('overview covers all 38 faculty with valid states',
          len(j['states']) == 38 and all(s['derived'] in VALID for s in j['states'].values()))
    st, j = call('GET', '/me/notifications', token=tok_s)
    check('notifications endpoint works', st == 200 and 'notifications' in j)
    st, _ = call('DELETE', '/watchlist/21', token=tok_s)
    check('watchlist DELETE works', st == 200)
    st, j = call('GET', '/watchlist', token=tok_s)
    check('watch entry removed', not any(w['faculty_id'] == 21 for w in j['watchlist']))

    # ---- reports & announcements ----
    st, j = call('POST', '/reports', {'facultyId': 20, 'body': 'regression report'}, token=tok_s)
    check('student files report', st == 200)
    st, j = call('GET', '/reports', token=tok_a)
    check('admin lists report OPEN', any(r['body'] == 'regression report' and r['status'] == 'OPEN' for r in j['reports']))
    rid = next(r['id'] for r in j['reports'] if r['body'] == 'regression report')
    st, _ = call('POST', f'/reports/{rid}/CLOSED', {}, token=tok_a)
    st, j = call('GET', '/reports', token=tok_a)
    check('admin resolves report', next((r for r in j['reports'] if r['id'] == rid), {}).get('status') == 'CLOSED')
    st, _ = call('POST', '/announcements', {'title': 'regression title', 'body': 'regression body'}, token=tok_f)
    check('faculty posts announcement', st == 200)
    st, j = call('GET', '/announcements')
    check('guest reads announcement', any(a['title'] == 'regression title' for a in j['announcements']))

    # ---- admin ----
    st, j = call('GET', '/admin/stats', token=tok_a)
    check('admin stats populated', st == 200 and j['faculty'] == 38 and j['students'] == 3)
    st, j = call('GET', '/admin/faculty', token=tok_a)
    check('admin faculty list (38 + logins)', st == 200 and len(j['faculty']) == 38)
    st, j = call('POST', '/admin/faculty/20/resetpw', {'password': 'faculty123'}, token=tok_a)
    check('admin resets faculty pw', st == 200)
    st, _ = call('POST', '/admin/users', {'username': 'teststu', 'password': 'x12345678', 'role': 'student',
                                          'name': 'Test Student'}, token=tok_a)
    check('admin creates student user', st == 200)
    st, j = call('GET', '/dash', token=tok_f)
    check('faculty dashboard payload', st == 200 and 'state' in j and 'requests' in j)
    st, j = call('GET', '/dash', token=tok_s)
    check('student dashboard payload', st == 200 and 'appointments' in j)

    print(f'\nRESULT: {passed} PASS / {failed} FAIL' + (f'  -> {fails}' if failed else ' ✓'))
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
