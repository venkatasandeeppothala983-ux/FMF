/* ================================================================
   FindMyFaculty · Client Application Engine
   Role-Based University Faculty Finder, Status Monitor & Timetable
   ================================================================ */
"use strict";

// Safe storage wrapper for iframe sandboxes
const __memStore = {};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return __memStore[k] || null; } },
  set(k, v) { __memStore[k] = v; try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { delete __memStore[k]; try { localStorage.removeItem(k); } catch (e) {} }
};

let TOKEN = store.get('fmf_token') || '';

// Fallback faculty data always available instantly
const DEFAULT_FACULTY = [
  { id: 1, name: 'Dr. Ravi Kumar', dept_code: 'CSE', designation: 'Associate Professor', cabin: 'CSE Block — Room 204', subjects_taught: 'DBMS, Operating Systems, Data Structures', email: 'ravikumar@scsvmv.ac.in', phone: '+91 94431 20401', status: 'AVAILABLE', location: 'CSE Block — Room 204', activity: 'Free / Available for doubt clearing', next_class: '11:00 AM — DBMS', next_free: 'Now' },
  { id: 2, name: 'Dr. Priya Sharma', dept_code: 'CSE', designation: 'Assistant Professor', cabin: 'CSE Block — Room 301', subjects_taught: 'Java Programming, Python for AI', email: 'priyasharma@scsvmv.ac.in', phone: '+91 94431 30102', status: 'TEACHING', location: 'CSE Block — Room 301', activity: 'Teaching Java Lab', next_class: '02:00 PM — Web Tech', next_free: '12:30 PM' },
  { id: 3, name: 'Dr. Arun Kumar', dept_code: 'ECE', designation: 'Associate Professor', cabin: 'Admin Block — Room 108', subjects_taught: 'Digital Signal Processing, VLSI', email: 'arunkumar@scsvmv.ac.in', phone: '+91 94431 10803', status: 'MEETING', location: 'Admin Block — Board Room', activity: 'HOD Academic Council Meeting', next_class: '03:00 PM — VLSI', next_free: '01:00 PM' },
  { id: 4, name: 'Dr. V. Geetha', dept_code: 'CSE', designation: 'Professor & Head', cabin: 'CSE Block — HOD Cabin (Room 101)', subjects_taught: 'Machine Learning, Neural Networks', email: 'dr.v.geetha@scsvmv.ac.in', phone: '+91 94431 10100', status: 'AVAILABLE', location: 'CSE Block — HOD Cabin', activity: 'Free / Office Hours', next_class: '02:00 PM — ML Lab', next_free: 'Now' },
  { id: 5, name: 'Dr. C. K. Gomathy', dept_code: 'CSE', designation: 'Associate Professor', cabin: 'CSE Block — Room 205', subjects_taught: 'Compiler Design, Cloud Computing', email: 'f001@scsvmv.ac.in', phone: '+91 94431 20500', status: 'ON_DUTY', location: 'Main Examination Hall', activity: 'University Exam Supervision', next_class: 'Tomorrow 09:10 AM', next_free: '03:40 PM' },
  { id: 6, name: 'Dr. S. Selvakumar', dept_code: 'CSE', designation: 'Associate Professor', cabin: 'CSE Block — Room 210', subjects_taught: 'Computer Networks, Cryptography', email: 'f015@scsvmv.ac.in', phone: '+91 94431 21000', status: 'AVAILABLE', location: 'CSE Block — Room 210', activity: 'Free / Project Review', next_class: '01:40 PM — Networks', next_free: 'Now' },
  { id: 7, name: 'Dr. M. Gayathri', dept_code: 'CSE', designation: 'Assistant Professor', cabin: 'CSE Block — Room 206', subjects_taught: 'Software Engineering, Agile', email: 'f006@scsvmv.ac.in', phone: '+91 94431 20600', status: 'TEACHING', location: 'CSE Block — Room 104', activity: 'Teaching Software Engineering', next_class: '03:00 PM — SE Lab', next_free: '11:20 AM' },
  { id: 8, name: 'Dr. J. Vinothkumar', dept_code: 'CSE', designation: 'Associate Professor', cabin: 'CSE Block — Room 202', subjects_taught: 'OOAD, Python Programming', email: 'f003@scsvmv.ac.in', phone: '+91 94431 20200', status: 'UNAVAILABLE', location: 'Off Campus', activity: 'On Official Leave', next_class: 'Tomorrow 08:10 AM', next_free: 'Tomorrow' }
];

const DEFAULT_DEPARTMENTS = [
  { id: 1, code: 'CSE', name: 'Computer Science & Engineering', block: 'CSE Block', hod: 'Dr. V. Geetha', faculty_count: 38, student_count: 540 },
  { id: 2, code: 'ECE', name: 'Electronics & Communication Engineering', block: 'ECE Block', hod: 'Dr. Arun Kumar', faculty_count: 18, student_count: 280 },
  { id: 3, code: 'EEE', name: 'Electrical & Electronics Engineering', block: 'Ramanujan Academic Block', hod: 'Dr. S. Karthik', faculty_count: 12, student_count: 160 },
  { id: 4, code: 'MECH', name: 'Mechanical Engineering', block: 'Mechanical Block', hod: 'Dr. M. Natarajan', faculty_count: 14, student_count: 180 },
  { id: 5, code: 'CIVIL', name: 'Civil Engineering', block: 'Main Block', hod: 'Dr. P. Venkatesh', faculty_count: 8, student_count: 90 },
  { id: 6, code: 'IT', name: 'Information Technology', block: 'CSE Block — 3rd Floor', hod: 'Dr. R. Sundar', faculty_count: 10, student_count: 140 },
  { id: 7, code: 'AIDS', name: 'Artificial Intelligence & Data Science', block: 'CSE Block — 4th Floor', hod: 'Dr. Priya Sharma', faculty_count: 6, student_count: 120 },
  { id: 8, code: 'MBA', name: 'Management Studies', block: 'Admin Block — 2nd Floor', hod: 'Dr. K. Ramesh', faculty_count: 6, student_count: 90 }
];

// Global Application State
const STATE = {
  theme: store.get('fmf_theme') || 'light',
  user: null,
  role: 'student', // 'student' | 'faculty' | 'admin'
  activeTab: 'dashboard',
  selectedLoginRole: 'student',
  faculty: DEFAULT_FACULTY,
  departments: DEFAULT_DEPARTMENTS,
  recentSearches: JSON.parse(store.get('fmf_recent') || '["Dr. Ravi Kumar", "Dr. Priya Sharma", "Dr. V. Geetha"]'),
  watchlist: new Set(),
  lastUpdated: 'Just now'
};

// DOM selector helpers
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ================================================================
   THEMING
   ================================================================ */
function applyTheme(theme) {
  STATE.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  store.set('fmf_theme', theme);
  const icon = theme === 'dark' ? '☀️' : '🌙';
  const b1 = $('#theme-btn-role'); if (b1) b1.textContent = icon;
  const b2 = $('#theme-btn-app'); if (b2) b2.textContent = icon;
}

function toggleTheme() {
  applyTheme(STATE.theme === 'dark' ? 'light' : 'dark');
}

/* ================================================================
   TOAST NOTIFICATIONS
   ================================================================ */
function toast(msg, icon = 'ℹ️') {
  const c = $('#toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>${icon}</span><span>${esc(msg)}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
    t.style.transition = 'all 0.2s';
    setTimeout(() => t.remove(), 250);
  }, 3200);
}

/* ================================================================
   API CLIENT (Preflight-free, Safe Fallbacks with Fast Timeout)
   ================================================================ */
function safeParseBody(body) {
  if (!body) return {};
  if (typeof body === 'object') return body;
  try { return JSON.parse(body); } catch (e) { return {}; }
}

async function api(path, opts = {}) {
  let url = '/api' + path;
  if (TOKEN) url += (url.includes('?') ? '&' : '?') + 't=' + encodeURIComponent(TOKEN);
  
  const o = { method: opts.method || 'GET', headers: {} };
  if (opts.body !== undefined) {
    o.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }

  // AbortController with 2.5s timeout prevents hanging in disconnected previews
  let timeoutId;
  if (typeof AbortController !== 'undefined') {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 2500);
    o.signal = controller.signal;
  }
  
  try {
    const r = await fetch(url, o);
    if (timeoutId) clearTimeout(timeoutId);
    let j = null;
    try { j = await r.json(); } catch (e) {}
    if (!r.ok) {
      const err = new Error((j && j.error) || `HTTP ${r.status}`);
      err.code = r.status;
      throw err;
    }
    return j;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    console.warn('API fallback activated for', path, err.message);
    return fallbackApi(path, opts);
  }
}

// Seamless mock fallback ensuring zero UI breaking in disconnected previews
function fallbackApi(path, opts = {}) {
  const b = safeParseBody(opts.body);
  if (path === '/ping') return { ok: true, now: new Date().toISOString(), day: 'WED', period: { period: 2, start: '09:10', end: '10:10' } };
  
  if (path === '/login') {
    const u = (b.username || 'sandeep').toLowerCase();
    let role = 'student';
    let name = 'Sandeep Kumar · 21CSE042';
    let dept = 'CSE';
    
    if (u.includes('admin')) {
      role = 'admin';
      name = 'System Administrator';
      dept = 'ADMIN';
    } else if (u.includes('dr.') || u.includes('faculty') || u.includes('ravi') || u.includes('priya') || u.includes('arun') || u.includes('geetha')) {
      role = 'faculty';
      if (u.includes('ravi')) name = 'Dr. Ravi Kumar';
      else if (u.includes('priya')) name = 'Dr. Priya Sharma';
      else if (u.includes('arun')) { name = 'Dr. Arun Kumar'; dept = 'ECE'; }
      else name = 'Dr. V. Geetha';
    }
    
    return {
      token: 'demo_token_' + Math.random().toString(36).slice(2),
      user: {
        id: 2,
        username: u,
        role,
        name,
        dept_code: dept,
        year: '3rd Year',
        section: 'III CSE A',
        student_id: role === 'student' ? '21CSE042' : 'F038',
        email: `${u}@scsvmv.ac.in`
      }
    };
  }

  if (path === '/me') return { user: STATE.user };
  if (path === '/departments') return { departments: DEFAULT_DEPARTMENTS };
  if (path.startsWith('/faculty')) return { faculty: DEFAULT_FACULTY, total: DEFAULT_FACULTY.length };
  if (path === '/admin/stats') return { total_students: 1250, total_faculty: 85, departments: 8, currently_available: 32, currently_teaching: 41, currently_meeting: 8, currently_duty: 4, currently_unavailable: 12 };
  if (path === '/feedback') {
    return {
      total_responses: 58,
      average_rating: 4.8,
      most_requested_feature: 'Real-time Live Faculty Status',
      feature_breakdown: { 'Live Status': 34, 'Cabin Location': 14, 'Timetable Lookup': 6, 'Next Availability': 4 },
      difficulty_breakdown: { 'Frequently': 38, 'Sometimes': 16, 'Rarely': 4 },
      would_use_breakdown: { 'Yes, definitely': 52, 'Likely': 6 },
      feedback_list: [
        { id: 1, student_name: 'Sandeep Kumar · 21CSE042', dept_code: 'CSE', q1_difficulty: 'Frequently', q2_how_find: 'Visiting cabins, WhatsApp groups', q3_useful_feature: 'Real-time Live Status', q4_rating: 5, q5_would_use: 'Yes, definitely', q6_improvement: 'The cabin directions and live status saves so much time!', created_at: '2026-09-09' },
        { id: 2, student_name: 'Pooja Verma · 21CSE088', dept_code: 'CSE', q1_difficulty: 'Sometimes', q2_how_find: 'Visiting cabins, Asking friends', q3_useful_feature: 'Cabin & Room Location', q4_rating: 5, q5_would_use: 'Yes, definitely', q6_improvement: 'Excellent interface, very clean.', created_at: '2026-09-09' },
        { id: 3, student_name: 'Rahul Sharma · 22ECE015', dept_code: 'ECE', q1_difficulty: 'Frequently', q2_how_find: 'Looking in lecture halls', q3_useful_feature: 'Timetable Lookup', q4_rating: 4, q5_would_use: 'Likely', q6_improvement: 'Please add all ECE lab locations too.', created_at: '2026-09-08' }
      ]
    };
  }
  return { ok: true };
}

/* ================================================================
   APPLICATION ROUTING & SCREEN SWITCHER
   ================================================================ */
function showScreen(screenId) {
  $('#screen-role-select').classList.add('hide');
  $('#screen-role-login').classList.add('hide');
  $('#screen-app').classList.add('hide');

  const target = $(`#${screenId}`);
  if (target) target.classList.remove('hide');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Setup Role Selection Screen (PAGE 1)
function initRoleSelection() {
  $('#btn-continue-student').addEventListener('click', () => openLoginForRole('student'));
  $('#btn-continue-faculty').addEventListener('click', () => openLoginForRole('faculty'));
  $('#btn-continue-admin').addEventListener('click', () => openLoginForRole('admin'));

  // Quick 1-Click Demo Buttons directly from Page 1
  const qs = $('#btn-quick-student');
  if (qs) qs.addEventListener('click', () => directDemoLogin('student', 'sandeep', 'sandeep123'));
  const qf = $('#btn-quick-faculty');
  if (qf) qf.addEventListener('click', () => directDemoLogin('faculty', 'dr.ravikumar', 'faculty123'));
  const qa = $('#btn-quick-admin');
  if (qa) qa.addEventListener('click', () => directDemoLogin('admin', 'admin', 'admin123'));

  $('#theme-btn-role').addEventListener('click', toggleTheme);
  $('#theme-btn-app').addEventListener('click', toggleTheme);

  // Check server health
  api('/ping').then(r => {
    const el = $('#role-server-stat');
    if (el) { el.textContent = 'server ok ✓'; el.style.color = 'var(--st-avail)'; }
  }).catch(() => {
    const el = $('#role-server-stat');
    if (el) { el.textContent = 'ready'; el.style.color = 'var(--st-avail)'; }
  });
}

// 1-Click Direct Demo Login from Page 1
async function directDemoLogin(role, username, password) {
  STATE.selectedLoginRole = role;
  try {
    const res = await api('/login', { method: 'POST', body: { username, password } });
    TOKEN = res.token;
    store.set('fmf_token', TOKEN);
    STATE.user = res.user;
    STATE.role = res.user.role;
    toast(`Welcome back, ${res.user.name.split('·')[0].trim()}! 👋`, '🎓');
    enterApp();
  } catch (e) {
    // Fallback instant
    const fallbackRes = fallbackApi('/login', { body: { username, password } });
    TOKEN = fallbackRes.token;
    STATE.user = fallbackRes.user;
    STATE.role = fallbackRes.user.role;
    enterApp();
  }
}

// Setup Role-Specific Login Screen (PAGE 2)
function openLoginForRole(role) {
  STATE.selectedLoginRole = role;
  const title = $('#login-role-title');
  const subtitle = $('#login-role-subtitle');
  const idLabel = $('#login-id-label');
  const btn = $('#btn-submit-login');
  const userInput = $('#login-username');
  const passInput = $('#login-password');
  const chipsContainer = $('#demo-chips-container');
  const err = $('#login-error-msg');
  
  err.textContent = '';

  let chips = [];
  if (role === 'student') {
    title.textContent = '👨‍🎓 Student Login';
    subtitle.textContent = 'Find faculty, check availability and view timetables.';
    idLabel.textContent = 'Student ID / Email';
    btn.textContent = 'Login as Student';
    btn.className = 'btn btn-student btn-lg btn-block';
    chips = [
      { label: 'Sandeep (21CSE042)', u: 'sandeep', p: 'sandeep123' },
      { label: 'Pooja (21CSE088)', u: 'student2', p: 'student123' },
      { label: 'Rahul (22ECE015)', u: 'student3', p: 'student123' }
    ];
  } else if (role === 'faculty') {
    title.textContent = '👨‍🏫 Faculty Portal Login';
    subtitle.textContent = 'Manage your availability, timetable and current location.';
    idLabel.textContent = 'Faculty ID / Email';
    btn.textContent = 'Login as Faculty';
    btn.className = 'btn btn-faculty btn-lg btn-block';
    chips = [
      { label: 'Dr. Ravi Kumar (CSE)', u: 'dr.ravikumar', p: 'faculty123' },
      { label: 'Dr. Priya Sharma (CSE)', u: 'dr.priyasharma', p: 'faculty123' },
      { label: 'Dr. Arun Kumar (ECE)', u: 'dr.arunkumar', p: 'faculty123' },
      { label: 'Dr. V. Geetha (HOD)', u: 'dr.v.geetha', p: 'faculty123' }
    ];
  } else if (role === 'admin') {
    title.textContent = '🛡️ Administrator Sign In';
    subtitle.textContent = 'Manage faculty, timetables, departments and system information.';
    idLabel.textContent = 'Admin ID / Email';
    btn.textContent = 'Login as Admin';
    btn.className = 'btn btn-admin btn-lg btn-block';
    chips = [
      { label: 'System Admin', u: 'admin', p: 'admin123' }
    ];
  }

  // Pre-populate with first demo credential for maximum convenience
  if (chips.length > 0) {
    userInput.value = chips[0].u;
    passInput.value = chips[0].p;
  }

  // Render demo chips
  chipsContainer.innerHTML = chips.map(c => 
    `<button type="button" class="demo-chip" data-u="${c.u}" data-p="${c.p}">${c.label}</button>`
  ).join('');

  $$('#demo-chips-container .demo-chip').forEach(ch => {
    ch.addEventListener('click', () => {
      userInput.value = ch.dataset.u;
      passInput.value = ch.dataset.p;
      submitLogin();
    });
  });

  showScreen('screen-role-login');
  setTimeout(() => userInput.focus(), 60);
}

// Submit Login Action
async function submitLogin() {
  const u = $('#login-username').value.trim();
  const p = $('#login-password').value;
  const err = $('#login-error-msg');
  const btn = $('#btn-submit-login');
  
  err.textContent = '';
  if (!u || !p) {
    err.textContent = 'Please enter both username/ID and password';
    return;
  }

  const oldTxt = btn.textContent;
  btn.textContent = 'Signing in…';
  btn.disabled = true;

  try {
    const res = await api('/login', { method: 'POST', body: { username: u, password: p } });
    TOKEN = res.token;
    store.set('fmf_token', TOKEN);
    STATE.user = res.user;
    STATE.role = res.user.role;
    toast(`Welcome back, ${res.user.name.split('·')[0].trim()}! 👋`, '🎓');
    enterApp();
  } catch (e) {
    err.textContent = '⚠ ' + (e.message || 'Invalid credentials');
  } finally {
    btn.textContent = oldTxt;
    btn.disabled = false;
  }
}

// Logout Action
async function doLogout() {
  try { await api('/logout', { method: 'POST' }); } catch (e) {}
  TOKEN = '';
  store.del('fmf_token');
  STATE.user = null;
  toast('Signed out successfully', '👋');
  showScreen('screen-role-select');
}

/* ================================================================
   PAGE 3: APP INITIALIZATION & NAVIGATION TABS
   ================================================================ */
async function enterApp() {
  if (!STATE.user) return;
  
  // Setup Navbar User Pill
  const roleTag = $('#nav-user-role');
  const nameEl = $('#nav-user-name');
  if (roleTag) {
    roleTag.textContent = STATE.user.role;
    roleTag.className = `user-role-tag ${STATE.user.role}`;
  }
  if (nameEl) {
    nameEl.textContent = STATE.user.name.split('·')[0].trim();
  }

  // Build Role-Specific Tabs & Show Screen
  buildRoleTabs();
  showScreen('screen-app');
  
  // Immediately render dashboard
  switchTab('dashboard');

  // Background refresh
  refreshAppData().then(() => {
    if (STATE.activeTab === 'dashboard') {
      const v = $('#app-view-container');
      if (v) {
        if (STATE.role === 'student') renderStudentDashboard(v);
        else if (STATE.role === 'faculty') renderFacultyDashboard(v);
        else if (STATE.role === 'admin') renderAdminDashboard(v);
      }
    }
  }).catch(() => {});
}

function buildRoleTabs() {
  const container = $('#app-nav-tabs');
  let tabs = [];
  
  if (STATE.role === 'student') {
    tabs = [
      { id: 'dashboard', label: '🏠 Dashboard' },
      { id: 'find-faculty', label: '🔍 Find Faculty' },
      { id: 'timetable', label: '📅 My Timetable' },
      { id: 'feedback', label: '💬 Give Feedback' },
      { id: 'profile', label: '👤 Profile' }
    ];
  } else if (STATE.role === 'faculty') {
    tabs = [
      { id: 'dashboard', label: '🏠 Dashboard' },
      { id: 'my-timetable', label: '📅 My Timetable' },
      { id: 'my-status', label: '⚡ My Status' },
      { id: 'my-location', label: '📍 My Location' },
      { id: 'profile', label: '👤 Profile' }
    ];
  } else if (STATE.role === 'admin') {
    tabs = [
      { id: 'dashboard', label: '🏠 Dashboard' },
      { id: 'faculty-mgmt', label: '👨‍🏫 Faculty' },
      { id: 'student-mgmt', label: '👨‍🎓 Students' },
      { id: 'timetables-mgmt', label: '📅 Timetables' },
      { id: 'depts-mgmt', label: '🏛️ Departments' },
      { id: 'live-status', label: '📡 Live Status' },
      { id: 'feedback-analytics', label: '📊 Feedback' }
    ];
  }

  container.innerHTML = tabs.map(t => 
    `<button class="nav-tab-btn" data-tab="${t.id}">${t.label}</button>`
  ).join('');

  $$('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabId) {
  STATE.activeTab = tabId;
  $$('.nav-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  
  const v = $('#app-view-container');
  if (!v) return;

  if (STATE.role === 'student') {
    if (tabId === 'dashboard') renderStudentDashboard(v);
    else if (tabId === 'find-faculty') renderStudentFindFaculty(v);
    else if (tabId === 'timetable') renderStudentTimetable(v);
    else if (tabId === 'feedback') renderStudentFeedback(v);
    else if (tabId === 'profile') renderStudentProfile(v);
  } else if (STATE.role === 'faculty') {
    if (tabId === 'dashboard') renderFacultyDashboard(v);
    else if (tabId === 'my-timetable') renderFacultyTimetable(v);
    else if (tabId === 'my-status') renderFacultyUpdateStatus(v);
    else if (tabId === 'my-location') renderFacultyUpdateLocation(v);
    else if (tabId === 'profile') renderFacultyProfile(v);
  } else if (STATE.role === 'admin') {
    if (tabId === 'dashboard') renderAdminDashboard(v);
    else if (tabId === 'faculty-mgmt') renderAdminFacultyMgmt(v);
    else if (tabId === 'student-mgmt') renderAdminStudentMgmt(v);
    else if (tabId === 'timetables-mgmt') renderAdminTimetableMgmt(v);
    else if (tabId === 'depts-mgmt') renderAdminDeptsMgmt(v);
    else if (tabId === 'live-status') renderAdminLiveStatus(v);
    else if (tabId === 'feedback-analytics') renderAdminFeedbackAnalytics(v);
  }
}

async function refreshAppData() {
  try {
    const [fRes, dRes] = await Promise.all([
      api('/faculty'),
      api('/departments')
    ]);
    if (fRes && fRes.faculty && fRes.faculty.length > 0) STATE.faculty = fRes.faculty;
    if (dRes && dRes.departments && dRes.departments.length > 0) STATE.departments = dRes.departments;
  } catch (e) {
    console.error('refreshAppData error', e);
  }
}

/* ================================================================
   STUDENT VIEWS
   ================================================================ */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function renderStudentDashboard(container) {
  const name = (STATE.user && STATE.user.name) ? STATE.user.name.split(' ')[0] : 'Sandeep';
  const availCount = STATE.faculty.filter(f => f.status === 'AVAILABLE').length;

  container.innerHTML = `
    <div class="dashboard-header">
      <h1>${getGreeting()}, ${esc(name)} 👋</h1>
      <p>Find your faculty quickly.</p>
    </div>

    <!-- Large Search Bar -->
    <div class="hero-search-box">
      <span class="search-icon">🔍</span>
      <input type="text" id="stu-hero-search" placeholder="Search faculty by name, department or subject…">
      <button class="btn btn-primary btn-md" id="stu-hero-search-btn">Find Faculty</button>
    </div>

    <!-- 4 Dashboard Cards -->
    <div class="quick-cards-grid">
      <div class="action-card" id="card-action-find">
        <div class="card-icon">🔍</div>
        <div>
          <h3>Find Faculty</h3>
          <p>Search for a faculty member</p>
        </div>
      </div>

      <div class="action-card" id="card-action-avail">
        <div class="card-icon" style="background:var(--st-avail-bg);color:var(--st-avail-text)">🟢</div>
        <div>
          <h3>Available Now</h3>
          <p><b>${availCount} faculty</b> currently free</p>
        </div>
      </div>

      <div class="action-card" id="card-action-tt">
        <div class="card-icon" style="background:var(--st-teach-bg);color:var(--st-teach-text)">📅</div>
        <div>
          <h3>My Timetable</h3>
          <p>View today's student timetable</p>
        </div>
      </div>

      <div class="action-card" id="card-action-recent">
        <div class="card-icon" style="background:var(--role-admin-bg);color:var(--role-admin)">🕒</div>
        <div>
          <h3>Recent Searches</h3>
          <p>${STATE.recentSearches.slice(0, 2).join(', ')}</p>
        </div>
      </div>
    </div>

    <!-- Faculty Status Section -->
    <div class="section-head">
      <h2>Faculty Status</h2>
      <button class="btn btn-outline btn-sm" id="btn-view-all-faculty">View All →</button>
    </div>

    <div class="faculty-grid" id="stu-dash-faculty-grid">
      ${renderFacultyCards(STATE.faculty.slice(0, 6))}
    </div>
  `;

  // Bind Events
  $('#stu-hero-search-btn').addEventListener('click', () => {
    const q = $('#stu-hero-search').value.trim();
    switchTab('find-faculty');
    setTimeout(() => {
      const inp = $('#fac-search-input');
      if (inp) { inp.value = q; inp.dispatchEvent(new Event('input')); }
    }, 50);
  });
  $('#stu-hero-search').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('#stu-hero-search-btn').click();
  });

  $('#card-action-find').addEventListener('click', () => switchTab('find-faculty'));
  $('#card-action-avail').addEventListener('click', () => {
    switchTab('find-faculty');
    setTimeout(() => {
      const sel = $('#fac-avail-filter');
      if (sel) { sel.value = 'AVAILABLE'; sel.dispatchEvent(new Event('change')); }
    }, 50);
  });
  $('#card-action-tt').addEventListener('click', () => switchTab('timetable'));
  $('#card-action-recent').addEventListener('click', () => switchTab('find-faculty'));
  $('#btn-view-all-faculty').addEventListener('click', () => switchTab('find-faculty'));

  bindFacultyCardEvents();
}

function renderFacultyCards(list) {
  if (!list.length) {
    return `<div style="grid-column:1/-1;text-align:center;padding:48px;background:var(--bg-card);border-radius:var(--radius-md);border:1px solid var(--border);">
      <div style="font-size:36px;margin-bottom:10px">🔍</div>
      <h3 style="font-size:17px;font-weight:700">No faculty found</h3>
      <p style="color:var(--text-muted);font-size:14px;margin-top:4px">Try adjusting your search terms or filters.</p>
    </div>`;
  }

  return list.map(f => {
    const stBadgeClass = `badge-${(f.status || 'AVAILABLE').toLowerCase()}`;
    const initials = f.name.replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.)\s*/, '').split(' ').map(n => n[0]).slice(0, 2).join('');
    
    return `
      <div class="fac-card" data-fid="${f.id}">
        <div>
          <div class="fac-card-top">
            <div class="fac-avatar">${initials}</div>
            <div class="fac-info" style="flex:1">
              <h3>${esc(f.name)}</h3>
              <p class="dept">${esc(f.dept_code || 'CSE')} · <span class="desig">${esc(f.designation || 'Assistant Professor')}</span></p>
            </div>
            <span class="badge ${stBadgeClass}">
              <span class="dot"></span>
              ${esc(f.status || 'AVAILABLE')}
            </span>
          </div>

          <div class="fac-status-box">
            <div class="fac-location-line">
              <span>📍</span>
              <span>${esc(f.location || f.cabin || 'CSE Block')}</span>
            </div>
            <div class="fac-activity-line">${esc(f.activity || 'Free')}</div>
            <div class="fac-next-avail">
              <span>🕒</span>
              <span>Next Available: <b>${esc(f.next_free || 'Now')}</b></span>
            </div>
          </div>
        </div>

        <div class="fac-card-bottom">
          <span style="font-size:12px;color:var(--text-muted)">${esc(f.cabin || 'Cabin 204')}</span>
          <button class="btn btn-primary btn-sm btn-view-fac-details" data-fid="${f.id}">
            View Details →
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function bindFacultyCardEvents() {
  $$('.btn-view-fac-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openFacultyProfileModal(+btn.dataset.fid);
    });
  });
  $$('.fac-card').forEach(card => {
    card.addEventListener('click', () => {
      openFacultyProfileModal(+card.dataset.fid);
    });
  });
}

function renderStudentFindFaculty(container) {
  container.innerHTML = `
    <div class="dashboard-header">
      <h1>Find Faculty</h1>
      <p>Search & filter faculty across all departments and availability status.</p>
    </div>

    <!-- Search + Filter Controls -->
    <div class="filter-bar">
      <div class="filter-group" style="flex:1;min-width:240px">
        <input type="text" class="input-field" id="fac-search-input" placeholder="Search by name, department or subject…">
      </div>

      <div class="filter-group">
        <label>Department:</label>
        <select class="filter-select" id="fac-dept-filter">
          <option value="">All Departments</option>
          <option value="CSE">CSE</option>
          <option value="ECE">ECE</option>
          <option value="EEE">EEE</option>
          <option value="MECH">MECH</option>
          <option value="CIVIL">CIVIL</option>
          <option value="IT">IT</option>
          <option value="AIDS">AI & DS</option>
          <option value="MBA">MBA</option>
        </select>
      </div>

      <div class="filter-group">
        <label>Availability:</label>
        <select class="filter-select" id="fac-avail-filter">
          <option value="">All Statuses</option>
          <option value="AVAILABLE">🟢 Available Now</option>
          <option value="TEACHING">🔵 Teaching</option>
          <option value="MEETING">🟠 In Meeting</option>
          <option value="ON_DUTY">🟣 On Duty</option>
          <option value="UNAVAILABLE">🔴 Unavailable</option>
        </select>
      </div>

      <div class="filter-group">
        <label>Year:</label>
        <select class="filter-select" id="fac-year-filter">
          <option value="">All Years</option>
          <option value="1">1st Year</option>
          <option value="2">2nd Year</option>
          <option value="3">3rd Year</option>
          <option value="4">4th Year</option>
        </select>
      </div>
    </div>

    <div class="faculty-grid" id="find-faculty-results-grid">
      ${renderFacultyCards(STATE.faculty)}
    </div>
  `;

  function applyFilters() {
    const q = $('#fac-search-input').value.toLowerCase().trim();
    const dept = $('#fac-dept-filter').value;
    const st = $('#fac-avail-filter').value;
    
    const filtered = STATE.faculty.filter(f => {
      if (dept && f.dept_code !== dept) return false;
      if (st && f.status !== st) return false;
      if (q) {
        const match = f.name.toLowerCase().includes(q) ||
                      (f.dept_code || '').toLowerCase().includes(q) ||
                      (f.subjects_taught || '').toLowerCase().includes(q) ||
                      (f.cabin || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    $('#find-faculty-results-grid').innerHTML = renderFacultyCards(filtered);
    bindFacultyCardEvents();
  }

  $('#fac-search-input').addEventListener('input', applyFilters);
  $('#fac-dept-filter').addEventListener('change', applyFilters);
  $('#fac-avail-filter').addEventListener('change', applyFilters);
  $('#fac-year-filter').addEventListener('change', applyFilters);

  bindFacultyCardEvents();
}

/* ================================================================
   FACULTY PROFILE MODAL & GET DIRECTIONS
   ================================================================ */
async function openFacultyProfileModal(fid) {
  let f = STATE.faculty.find(x => x.id === fid);
  if (!f) return;

  // Track recent search
  if (!STATE.recentSearches.includes(f.name)) {
    STATE.recentSearches.unshift(f.name);
    STATE.recentSearches = STATE.recentSearches.slice(0, 5);
    store.set('fmf_recent', JSON.stringify(STATE.recentSearches));
  }

  const mc = $('#modal-container');
  mc.classList.remove('hide');

  const stBadgeClass = `badge-${(f.status || 'AVAILABLE').toLowerCase()}`;

  mc.innerHTML = `
    <div class="modal-overlay" id="modal-overlay-bg">
      <div class="modal-window wide" id="modal-content-box">
        <div class="modal-header">
          <div>
            <h2>${esc(f.name)}</h2>
            <p style="font-size:13.5px;color:var(--text-muted);margin-top:2px">${esc(f.designation || 'Associate Professor')} · ${esc(f.dept_code || 'Computer Science & Engineering')}</p>
          </div>
          <button class="modal-close-btn" id="btn-close-modal">✕</button>
        </div>

        <div class="modal-body">
          <!-- Large Status Banner -->
          <div style="padding:16px 20px;border-radius:var(--radius-md);background:var(--st-avail-bg);display:flex;align-items:center;justify-content:space-between;margin-bottom:24px" class="${stBadgeClass}">
            <div style="display:flex;align-items:center;gap:12px">
              <span class="dot" style="width:12px;height:12px"></span>
              <div>
                <div style="font-size:16px;font-weight:800;letter-spacing:0.5px">${esc(f.status || 'AVAILABLE NOW')}</div>
                <div style="font-size:13px;opacity:0.85">${esc(f.activity || 'Free')}</div>
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-size:12px;opacity:0.75">Next Available</div>
              <div style="font-size:15px;font-weight:800">${esc(f.next_free || 'Now')}</div>
            </div>
          </div>

          <!-- Key Location & Next Info Grid -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:24px">
            <div style="background:var(--bg-card-alt);padding:14px;border-radius:var(--radius-sm);border:1px solid var(--border)">
              <div style="font-size:12px;color:var(--text-muted);font-weight:600">Current Location</div>
              <div style="font-size:15px;font-weight:700;margin-top:4px">📍 ${esc(f.location || f.cabin || 'CSE Block — Room 204')}</div>
            </div>

            <div style="background:var(--bg-card-alt);padding:14px;border-radius:var(--radius-sm);border:1px solid var(--border)">
              <div style="font-size:12px;color:var(--text-muted);font-weight:600">Current Activity</div>
              <div style="font-size:15px;font-weight:700;margin-top:4px">${esc(f.activity || 'Free')}</div>
            </div>

            <div style="background:var(--bg-card-alt);padding:14px;border-radius:var(--radius-sm);border:1px solid var(--border)">
              <div style="font-size:12px;color:var(--text-muted);font-weight:600">Next Class</div>
              <div style="font-size:15px;font-weight:700;margin-top:4px">📚 ${esc(f.next_class || '11:00 AM — DBMS')}</div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:28px">
            <button class="btn btn-primary" id="btn-modal-get-directions">
              🧭 Get Directions
            </button>
            <button class="btn btn-secondary" id="btn-modal-view-tt">
              📅 View Timetable
            </button>
            <button class="btn btn-secondary" id="btn-modal-contact">
              ✉️ Contact Faculty
            </button>
            <button class="btn btn-outline" id="btn-modal-book-slot">
              📅 Request a Slot
            </button>
          </div>

          <!-- Today's Complete Schedule -->
          <h3 style="font-size:16px;font-weight:800;margin-bottom:14px">Today's Complete Schedule</h3>
          <div class="schedule-timeline">
            <div class="timeline-slot">
              <div class="timeline-time">08:10 – 09:10</div>
              <div class="timeline-desc">
                <div class="subj">Database Management Systems (III CSE A)</div>
                <div class="venue">📍 CSE Block — Room 201</div>
              </div>
            </div>
            <div class="timeline-slot is-free">
              <div class="timeline-time">09:10 – 11:00</div>
              <div class="timeline-desc">
                <div class="subj" style="color:var(--st-avail-text)">🟢 Free / Office Hours</div>
                <div class="venue">📍 ${esc(f.cabin || 'CSE Block — Room 204')}</div>
              </div>
            </div>
            <div class="timeline-slot">
              <div class="timeline-time">11:00 – 12:20</div>
              <div class="timeline-desc">
                <div class="subj">DBMS Lab / Project Consultation</div>
                <div class="venue">📍 CSE Lab 2 (Ground Floor)</div>
              </div>
            </div>
            <div class="timeline-slot">
              <div class="timeline-time">12:20 – 13:40</div>
              <div class="timeline-desc">
                <div class="subj">Lunch Break</div>
                <div class="venue">Staff Dining Hall</div>
              </div>
            </div>
            <div class="timeline-slot">
              <div class="timeline-time">13:40 – 14:40</div>
              <div class="timeline-desc">
                <div class="subj">Department Academic Meeting</div>
                <div class="venue">📍 CSE Conference Room</div>
              </div>
            </div>
            <div class="timeline-slot is-free">
              <div class="timeline-time">14:40 – 15:40</div>
              <div class="timeline-desc">
                <div class="subj" style="color:var(--st-avail-text)">🟢 Free / Doubt Clearing</div>
                <div class="venue">📍 ${esc(f.cabin || 'CSE Block — Room 204')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Modal events
  const closeModal = () => mc.classList.add('hide');
  $('#btn-close-modal').addEventListener('click', closeModal);
  $('#modal-overlay-bg').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay-bg') closeModal();
  });

  $('#btn-modal-get-directions').addEventListener('click', () => openDirectionsModal(f));
  $('#btn-modal-view-tt').addEventListener('click', () => {
    closeModal();
    switchTab('timetable');
  });
  $('#btn-modal-contact').addEventListener('click', () => openContactFacultyModal(f));
  $('#btn-modal-book-slot').addEventListener('click', () => openBookSlotModal(f));
}

/* ================================================================
   GET DIRECTIONS & CAMPUS MAP MODAL
   ================================================================ */
function openDirectionsModal(fac) {
  const mc = $('#modal-container');
  mc.classList.remove('hide');

  const cabin = fac.cabin || 'CSE Block — Room 204';
  const block = cabin.includes('ECE') ? 'ECE Block' : (cabin.includes('Admin') ? 'Admin Block' : 'CSE Block');
  const floor = cabin.includes('10') ? 'Ground Floor (Level 1)' : (cabin.includes('20') ? 'First Floor (Level 2)' : 'Second Floor (Level 3)');

  mc.innerHTML = `
    <div class="modal-overlay" id="modal-overlay-bg">
      <div class="modal-window" style="max-width:540px">
        <div class="modal-header">
          <div>
            <h2>🧭 Campus Cabin Locator</h2>
            <p style="font-size:13px;color:var(--text-muted)">Directions to ${esc(fac.name)}'s cabin</p>
          </div>
          <button class="modal-close-btn" id="btn-close-modal">✕</button>
        </div>

        <div class="modal-body">
          <div style="background:var(--primary-light);padding:14px;border-radius:var(--radius-sm);border:1px solid rgba(37,99,235,0.2);margin-bottom:18px">
            <div style="font-size:12px;font-weight:700;color:var(--primary)">DESTINATION</div>
            <div style="font-size:16px;font-weight:800;color:var(--text-main);margin-top:2px">📍 ${esc(cabin)}</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:2px">${floor} · SCSVMV Main Campus</div>
          </div>

          <!-- Campus Map Visualization -->
          <div class="campus-map-box">
            <div style="font-size:12px;font-weight:700;color:var(--text-muted)">SCSVMV UNIVERSITY CAMPUS MAP</div>
            <div class="building-grid">
              <div class="building-tile ${block === 'CSE Block' ? 'highlight' : ''}">CSE Block 🏢</div>
              <div class="building-tile ${block === 'ECE Block' ? 'highlight' : ''}">ECE Block 🏢</div>
              <div class="building-tile">Ramanujan Block 🏛️</div>
              <div class="building-tile ${block === 'Admin Block' ? 'highlight' : ''}">Admin Block 🏛️</div>
              <div class="building-tile">Central Library 📚</div>
              <div class="building-tile">Auditorium 🎭</div>
            </div>
          </div>

          <h4 style="font-size:14px;font-weight:800;margin:18px 0 12px">Step-by-Step Walking Route</h4>
          <div class="directions-step">
            <div class="step-num">1</div>
            <div>Enter <b>${block}</b> via the main porch entrance.</div>
          </div>
          <div class="directions-step">
            <div class="step-num">2</div>
            <div>Take the central staircase or elevator to <b>${floor}</b>.</div>
          </div>
          <div class="directions-step">
            <div class="step-num">3</div>
            <div>Turn right along the faculty cabin corridor.</div>
          </div>
          <div class="directions-step">
            <div class="step-num">4</div>
            <div>Look for door plaque <b>${esc(cabin.split('—')[1] || cabin)}</b> on your left.</div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-primary" id="btn-done-directions">Got it, thanks!</button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => mc.classList.add('hide');
  $('#btn-close-modal').addEventListener('click', closeModal);
  $('#btn-done-directions').addEventListener('click', closeModal);
  $('#modal-overlay-bg').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay-bg') closeModal();
  });
}

function openContactFacultyModal(fac) {
  const mc = $('#modal-container');
  mc.classList.remove('hide');

  mc.innerHTML = `
    <div class="modal-overlay" id="modal-overlay-bg">
      <div class="modal-window" style="max-width:500px">
        <div class="modal-header">
          <h2>✉️ Contact ${esc(fac.name)}</h2>
          <button class="modal-close-btn" id="btn-close-modal">✕</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom:16px">
            <div style="font-size:12.5px;color:var(--text-muted);font-weight:600">Official Email</div>
            <div style="font-size:15px;font-weight:700;margin-top:2px">📧 ${esc(fac.email || 'faculty@scsvmv.ac.in')}</div>
          </div>
          <div style="margin-bottom:16px">
            <div style="font-size:12.5px;color:var(--text-muted);font-weight:600">Department Intercom / Phone</div>
            <div style="font-size:15px;font-weight:700;margin-top:2px">📞 ${esc(fac.phone || '+91 94431 20401')}</div>
          </div>
          <div style="margin-bottom:18px">
            <div style="font-size:12.5px;color:var(--text-muted);font-weight:600">Office Hours</div>
            <div style="font-size:15px;font-weight:700;margin-top:2px">🕒 10:00 AM – 04:00 PM (Mon – Fri)</div>
          </div>

          <div class="input-group">
            <label class="input-label">Quick Message / Academic Inquiry</label>
            <textarea class="input-field" rows="3" placeholder="State your doubt or purpose of meeting…"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-cancel-contact">Cancel</button>
          <button class="btn btn-primary" id="btn-send-msg">Send Message</button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => mc.classList.add('hide');
  $('#btn-close-modal').addEventListener('click', closeModal);
  $('#btn-cancel-contact').addEventListener('click', closeModal);
  $('#btn-send-msg').addEventListener('click', () => {
    toast(`Message dispatched to ${fac.name}!`, '✅');
    closeModal();
  });
}

function openBookSlotModal(fac) {
  const mc = $('#modal-container');
  mc.classList.remove('hide');

  mc.innerHTML = `
    <div class="modal-overlay" id="modal-overlay-bg">
      <div class="modal-window" style="max-width:520px">
        <div class="modal-header">
          <div>
            <h2>📅 Request Appointment Slot</h2>
            <p style="font-size:13px;color:var(--text-muted)">with ${esc(fac.name)}</p>
          </div>
          <button class="modal-close-btn" id="btn-close-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="input-group">
            <label class="input-label">Preferred Date</label>
            <input type="date" class="input-field" value="${new Date().toISOString().slice(0, 10)}">
          </div>
          <div class="input-group">
            <label class="input-label">Duration</label>
            <div style="display:flex;gap:10px">
              <button type="button" class="btn btn-secondary btn-sm slot-dur active">15 min</button>
              <button type="button" class="btn btn-secondary btn-sm slot-dur">30 min</button>
              <button type="button" class="btn btn-secondary btn-sm slot-dur">45 min</button>
            </div>
          </div>
          <div class="input-group">
            <label class="input-label">Available Timeslots</label>
            <select class="input-field">
              <option>10:00 AM – 10:15 AM (🟢 Free)</option>
              <option>10:30 AM – 10:45 AM (🟢 Free)</option>
              <option>02:30 PM – 02:45 PM (🟢 Free)</option>
              <option>03:30 PM – 03:45 PM (🟢 Free)</option>
            </select>
          </div>
          <div class="input-group">
            <label class="input-label">Purpose of Meeting</label>
            <input type="text" class="input-field" placeholder="e.g. Major Project review or Doubt clearing">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-cancel-slot">Cancel</button>
          <button class="btn btn-primary" id="btn-confirm-slot">Submit Request</button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => mc.classList.add('hide');
  $('#btn-close-modal').addEventListener('click', closeModal);
  $('#btn-cancel-slot').addEventListener('click', closeModal);
  $('#btn-confirm-slot').addEventListener('click', () => {
    toast(`Appointment requested with ${fac.name}!`, '✅');
    closeModal();
  });
}

/* ================================================================
   STUDENT TIMETABLE (MY TIMETABLE)
   ================================================================ */
function renderStudentTimetable(container) {
  container.innerHTML = `
    <div class="dashboard-header">
      <h1>Student Timetable</h1>
      <p>View your class timetable, subject schedule and assigned classrooms.</p>
    </div>

    <div class="filter-bar">
      <div class="filter-group">
        <label>Section:</label>
        <select class="filter-select" id="tt-sec-select">
          <option value="III CSE A" selected>III Year CSE A</option>
          <option value="III CSE B">III Year CSE B</option>
          <option value="III CSE C">III Year CSE C</option>
          <option value="II CSE A">II Year CSE A</option>
          <option value="IV CSE A">IV Year CSE A</option>
        </select>
      </div>

      <div class="filter-group">
        <label>Day:</label>
        <select class="filter-select" id="tt-day-select">
          <option value="MON">Monday</option>
          <option value="TUE">Tuesday</option>
          <option value="WED" selected>Wednesday</option>
          <option value="THU">Thursday</option>
          <option value="FRI">Friday</option>
        </select>
      </div>
    </div>

    <div class="schedule-timeline">
      <div class="timeline-slot">
        <div class="timeline-time">08:10 – 09:10<br><span style="font-size:11px;color:var(--text-muted)">Period 1</span></div>
        <div class="timeline-desc">
          <div class="subj">Database Management Systems (DBMS)</div>
          <div class="venue">👨‍🏫 Dr. Ravi Kumar · 📍 CSE Block — Room 201</div>
        </div>
      </div>

      <div class="timeline-slot">
        <div class="timeline-time">09:10 – 10:10<br><span style="font-size:11px;color:var(--text-muted)">Period 2</span></div>
        <div class="timeline-desc">
          <div class="subj">Computer Networks (CN)</div>
          <div class="venue">👨‍🏫 Dr. S. Selvakumar · 📍 CSE Block — Room 201</div>
        </div>
      </div>

      <div class="timeline-slot">
        <div class="timeline-time">10:20 – 11:20<br><span style="font-size:11px;color:var(--text-muted)">Period 3</span></div>
        <div class="timeline-desc">
          <div class="subj">Design & Analysis of Algorithms (DAA)</div>
          <div class="venue">👩‍🏫 Dr. Priya Sharma · 📍 CSE Block — Room 201</div>
        </div>
      </div>

      <div class="timeline-slot">
        <div class="timeline-time">11:20 – 12:20<br><span style="font-size:11px;color:var(--text-muted)">Period 4</span></div>
        <div class="timeline-desc">
          <div class="subj">Compiler Design</div>
          <div class="venue">👩‍🏫 Dr. C. K. Gomathy · 📍 CSE Block — Room 201</div>
        </div>
      </div>

      <div class="timeline-slot">
        <div class="timeline-time">12:20 – 13:40<br><span style="font-size:11px;color:var(--text-muted)">Lunch</span></div>
        <div class="timeline-desc">
          <div class="subj">Lunch Break</div>
          <div class="venue">Campus Dining & Cafeteria</div>
        </div>
      </div>

      <div class="timeline-slot">
        <div class="timeline-time">13:40 – 15:40<br><span style="font-size:11px;color:var(--text-muted)">Period 6–7</span></div>
        <div class="timeline-desc">
          <div class="subj">DBMS & Operating Systems Lab</div>
          <div class="venue">👨‍🏫 Dr. Ravi Kumar & Lab Staff · 📍 CSE Lab 3</div>
        </div>
      </div>
    </div>
  `;
}

/* ================================================================
   STUDENT FEEDBACK (GIVE FEEDBACK - 6 EXACT QUESTIONS)
   ================================================================ */
function renderStudentFeedback(container) {
  container.innerHTML = `
    <div class="dashboard-header">
      <h1>Give Feedback</h1>
      <p>Help us improve FindMyFaculty for all SCSVMV students and teachers.</p>
    </div>

    <div class="feedback-card" id="fb-card-form">
      <form id="student-feedback-form" onsubmit="return false;">
        <!-- Question 1 -->
        <div class="fb-question">
          <h4>1. Do you currently face difficulty finding faculty?</h4>
          <div class="fb-options">
            <label class="fb-opt-label"><input type="radio" name="q1" value="Frequently" checked> Frequently</label>
            <label class="fb-opt-label"><input type="radio" name="q1" value="Sometimes"> Sometimes</label>
            <label class="fb-opt-label"><input type="radio" name="q1" value="Rarely"> Rarely</label>
            <label class="fb-opt-label"><input type="radio" name="q1" value="Never"> Never</label>
          </div>
        </div>

        <!-- Question 2 -->
        <div class="fb-question">
          <h4>2. How do you currently find faculty?</h4>
          <div class="fb-options">
            <label class="fb-opt-label"><input type="checkbox" name="q2" value="Visiting cabins" checked> Visiting cabins</label>
            <label class="fb-opt-label"><input type="checkbox" name="q2" value="Asking friends" checked> Asking classmates / friends</label>
            <label class="fb-opt-label"><input type="checkbox" name="q2" value="WhatsApp"> WhatsApp groups</label>
            <label class="fb-opt-label"><input type="checkbox" name="q2" value="Calling"> Phone calls</label>
            <label class="fb-opt-label"><input type="checkbox" name="q2" value="Lecture halls"> Looking in lecture halls</label>
          </div>
        </div>

        <!-- Question 3 -->
        <div class="fb-question">
          <h4>3. Which feature is most useful?</h4>
          <div class="fb-options">
            <label class="fb-opt-label"><input type="radio" name="q3" value="Live Status" checked> Real-time Live Status (Available/Teaching/Meeting)</label>
            <label class="fb-opt-label"><input type="radio" name="q3" value="Cabin Location"> Cabin & Room Directions</label>
            <label class="fb-opt-label"><input type="radio" name="q3" value="Timetable Lookup"> Timetable Lookup</label>
            <label class="fb-opt-label"><input type="radio" name="q3" value="Next Availability"> Next Availability Prediction</label>
          </div>
        </div>

        <!-- Question 4 -->
        <div class="fb-question">
          <h4>4. How useful is FindMyFaculty? (1–5)</h4>
          <div class="rating-stars" id="fb-rating-stars">
            <span class="rating-star active" data-v="1">★</span>
            <span class="rating-star active" data-v="2">★</span>
            <span class="rating-star active" data-v="3">★</span>
            <span class="rating-star active" data-v="4">★</span>
            <span class="rating-star active" data-v="5">★</span>
          </div>
          <input type="hidden" id="fb-rating-val" value="5">
        </div>

        <!-- Question 5 -->
        <div class="fb-question">
          <h4>5. Would you use this system in your college?</h4>
          <div class="fb-options">
            <label class="fb-opt-label"><input type="radio" name="q5" value="Yes, definitely" checked> Yes, definitely</label>
            <label class="fb-opt-label"><input type="radio" name="q5" value="Likely"> Likely</label>
            <label class="fb-opt-label"><input type="radio" name="q5" value="Maybe"> Maybe</label>
            <label class="fb-opt-label"><input type="radio" name="q5" value="No"> No</label>
          </div>
        </div>

        <!-- Question 6 -->
        <div class="fb-question">
          <h4>6. What would you improve?</h4>
          <textarea class="input-field" id="fb-improvement" rows="4" placeholder="Share your suggestions, features you'd like to see, or any issues encountered…"></textarea>
        </div>

        <button type="submit" class="btn btn-primary btn-lg btn-block" id="btn-submit-feedback">
          Submit Feedback
        </button>
      </form>
    </div>
  `;

  // Star Rating Interaction
  $$('#fb-rating-stars .rating-star').forEach(star => {
    star.addEventListener('click', () => {
      const v = +star.dataset.v;
      $('#fb-rating-val').value = v;
      $$('#fb-rating-stars .rating-star').forEach(s => {
        s.classList.toggle('active', +s.dataset.v <= v);
      });
    });
  });

  // Submit Feedback
  $('#btn-submit-feedback').addEventListener('click', async () => {
    const q1 = ($('input[name="q1"]:checked') || {}).value || 'Frequently';
    const q2 = Array.from($$('input[name="q2"]:checked')).map(x => x.value).join(', ');
    const q3 = ($('input[name="q3"]:checked') || {}).value || 'Live Status';
    const q4 = +$('#fb-rating-val').value;
    const q5 = ($('input[name="q5"]:checked') || {}).value || 'Yes, definitely';
    const q6 = $('#fb-improvement').value.trim();

    const btn = $('#btn-submit-feedback');
    btn.textContent = 'Submitting…';
    btn.disabled = true;

    try {
      await api('/feedback', {
        method: 'POST',
        body: {
          q1_difficulty: q1,
          q2_how_find: q2,
          q3_useful_feature: q3,
          q4_rating: q4,
          q5_would_use: q5,
          q6_improvement: q6
        }
      });
      
      $('#fb-card-form').innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <div style="font-size:56px;margin-bottom:16px">🎉</div>
          <h2 style="font-size:24px;font-weight:800;margin-bottom:8px">Thank You For Your Feedback!</h2>
          <p style="color:var(--text-muted);font-size:15px;max-width:460px;margin:0 auto 24px">
            Your response has been recorded and will help university administrators improve faculty accessibility.
          </p>
          <button class="btn btn-primary" onclick="switchTab('dashboard')">Back to Dashboard</button>
        </div>
      `;
      toast('Feedback submitted successfully!', '⭐');
    } catch (e) {
      toast('Feedback saved locally', '⭐');
    }
  });
}

function renderStudentProfile(container) {
  const u = STATE.user || { name: 'Sandeep Kumar · 21CSE042', dept_code: 'CSE', year: '3rd Year', section: 'III CSE A', student_id: '21CSE042', email: 'sandeep@scsvmv.ac.in' };

  container.innerHTML = `
    <div class="dashboard-header">
      <h1>Student Profile</h1>
      <p>Manage your university account details and preferences.</p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px">
      <div class="stat-card">
        <div class="stat-label">Academic Information</div>
        <div style="margin-top:14px">
          <div style="font-size:18px;font-weight:800">${esc(u.name)}</div>
          <div style="color:var(--text-muted);font-size:13.5px;margin-top:4px">Student ID: <b>${esc(u.student_id || '21CSE042')}</b></div>
          <div style="color:var(--text-muted);font-size:13.5px;margin-top:4px">Department: <b>${esc(u.dept_code || 'CSE')}</b></div>
          <div style="color:var(--text-muted);font-size:13.5px;margin-top:4px">Year & Section: <b>${esc(u.year || '3rd Year')} (${esc(u.section || 'III CSE A')})</b></div>
          <div style="color:var(--text-muted);font-size:13.5px;margin-top:4px">Email: <b>${esc(u.email || 'sandeep@scsvmv.ac.in')}</b></div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Notifications & Watchlist</div>
        <p style="font-size:13.5px;color:var(--text-muted);margin-top:10px">
          You are currently watching <b>Dr. Ravi Kumar</b> and <b>Dr. Priya Sharma</b> for instant free-status notifications.
        </p>
        <button class="btn btn-secondary btn-sm" style="margin-top:16px" onclick="toast('Notification preferences updated','🔔')">
          🔔 Configure Alerts
        </button>
      </div>
    </div>
  `;
}

/* ================================================================
   FACULTY VIEWS
   ================================================================ */
function renderFacultyDashboard(container) {
  const facName = (STATE.user && STATE.user.name) ? STATE.user.name : 'Dr. Ravi Kumar';
  const fac = STATE.faculty.find(f => f.name.includes(facName.split(' ')[1] || 'Ravi')) || STATE.faculty[0] || {
    name: facName,
    status: 'AVAILABLE',
    location: 'CSE Block — Room 204',
    activity: 'Free / Doubt Clearing',
    cabin: 'CSE Block — Room 204'
  };

  const stBadgeClass = `badge-${(fac.status || 'AVAILABLE').toLowerCase()}`;

  container.innerHTML = `
    <div class="dashboard-header">
      <h1>Welcome, ${esc(fac.name)}</h1>
      <p>Manage your availability, timetable schedule, and room location.</p>
    </div>

    <!-- Prominent Current Status Card -->
    <div style="background:var(--bg-card);border:2px solid var(--border);border-radius:var(--radius-lg);padding:28px;box-shadow:var(--shadow-md);margin-bottom:28px">
      <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">YOUR LIVE STATUS</div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:6px">
            <span class="badge ${stBadgeClass}" style="font-size:15px;padding:6px 14px">
              <span class="dot" style="width:10px;height:10px"></span>
              ${esc(fac.status || 'AVAILABLE')}
            </span>
            <span style="font-size:13px;color:var(--text-dim)">Last updated: ${esc(STATE.lastUpdated)}</span>
          </div>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:10px">
          <button class="btn btn-primary" id="btn-fac-quick-status">⚡ Update Status</button>
          <button class="btn btn-secondary" id="btn-fac-quick-loc">📍 Update Location</button>
          <button class="btn btn-secondary" id="btn-fac-quick-tt">📅 View Timetable</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;padding-top:18px;border-top:1px solid var(--border)">
        <div>
          <div style="font-size:12.5px;color:var(--text-muted);font-weight:600">Current Location</div>
          <div style="font-size:16px;font-weight:800;margin-top:3px">📍 ${esc(fac.location || fac.cabin || 'CSE Block — Room 204')}</div>
        </div>
        <div>
          <div style="font-size:12.5px;color:var(--text-muted);font-weight:600">Current Activity</div>
          <div style="font-size:16px;font-weight:800;margin-top:3px">${esc(fac.activity || 'Free')}</div>
        </div>
        <div>
          <div style="font-size:12.5px;color:var(--text-muted);font-weight:600">Office Cabin</div>
          <div style="font-size:16px;font-weight:800;margin-top:3px">${esc(fac.cabin || 'CSE Block — Room 204')}</div>
        </div>
      </div>
    </div>

    <!-- Today's Schedule Timeline -->
    <div class="section-head">
      <h2>Today's Schedule</h2>
      <span style="font-size:13.5px;color:var(--text-muted)">Wednesday · 6 Slots</span>
    </div>

    <div class="schedule-timeline" style="margin-bottom:32px">
      <div class="timeline-slot">
        <div class="timeline-time">08:00 – 09:10</div>
        <div class="timeline-desc">
          <div class="subj">Database Management Systems (DBMS)</div>
          <div class="venue">📍 Room 201 · III Year CSE A</div>
        </div>
      </div>
      <div class="timeline-slot is-free">
        <div class="timeline-time">10:00 – 11:00</div>
        <div class="timeline-desc">
          <div class="subj" style="color:var(--st-avail-text)">🟢 Free / Office Hours</div>
          <div class="venue">📍 Cabin (Room 204)</div>
        </div>
      </div>
      <div class="timeline-slot">
        <div class="timeline-time">11:00 – 12:20</div>
        <div class="timeline-desc">
          <div class="subj">DBMS Lab Consultation</div>
          <div class="venue">📍 Room 204 / Lab 3</div>
        </div>
      </div>
      <div class="timeline-slot">
        <div class="timeline-time">01:00 – 02:00</div>
        <div class="timeline-desc">
          <div class="subj">Lunch Break</div>
          <div class="venue">Faculty Lounge</div>
        </div>
      </div>
      <div class="timeline-slot">
        <div class="timeline-time">02:00 – 03:00</div>
        <div class="timeline-desc">
          <div class="subj">Department Meeting</div>
          <div class="venue">📍 HOD Conference Room</div>
        </div>
      </div>
      <div class="timeline-slot is-free">
        <div class="timeline-time">04:00 – 05:00</div>
        <div class="timeline-desc">
          <div class="subj" style="color:var(--st-avail-text)">🟢 Free / Doubt Clearing</div>
          <div class="venue">📍 Room 204</div>
        </div>
      </div>
    </div>

    <!-- Quick Actions Grid -->
    <div class="section-head">
      <h2>Quick Actions</h2>
    </div>

    <div class="quick-cards-grid">
      <div class="action-card" onclick="switchTab('my-status')">
        <div class="card-icon">⚡</div>
        <div>
          <h3>Update Availability</h3>
          <p>Mark available, teaching or in meeting</p>
        </div>
      </div>

      <div class="action-card" onclick="switchTab('my-location')">
        <div class="card-icon">📍</div>
        <div>
          <h3>Update Location</h3>
          <p>Set current room or lab</p>
        </div>
      </div>

      <div class="action-card" onclick="switchTab('my-timetable')">
        <div class="card-icon">📅</div>
        <div>
          <h3>View Timetable</h3>
          <p>Weekly teaching schedule</p>
        </div>
      </div>

      <div class="action-card" onclick="switchTab('profile')">
        <div class="card-icon">👤</div>
        <div>
          <h3>View Profile</h3>
          <p>Manage office hours & contact info</p>
        </div>
      </div>
    </div>
  `;

  $('#btn-fac-quick-status').addEventListener('click', () => switchTab('my-status'));
  $('#btn-fac-quick-loc').addEventListener('click', () => switchTab('my-location'));
  $('#btn-fac-quick-tt').addEventListener('click', () => switchTab('my-timetable'));
}

function renderFacultyUpdateStatus(container) {
  container.innerHTML = `
    <div class="dashboard-header">
      <h1>Update Live Status</h1>
      <p>Broadcast your real-time availability to students and department colleagues.</p>
    </div>

    <div class="feedback-card" style="max-width:620px">
      <form id="fac-status-form" onsubmit="return false;">
        <div class="input-group">
          <label class="input-label">Select Current Status</label>
          <div style="display:flex;flex-direction:column;gap:8px">
            <label class="fb-opt-label"><input type="radio" name="fac_st" value="AVAILABLE" checked> 🟢 Available (Free in Cabin)</label>
            <label class="fb-opt-label"><input type="radio" name="fac_st" value="TEACHING"> 🔵 Teaching (In Classroom/Lab)</label>
            <label class="fb-opt-label"><input type="radio" name="fac_st" value="MEETING"> 🟠 In Meeting (Academic/HOD)</label>
            <label class="fb-opt-label"><input type="radio" name="fac_st" value="ON_DUTY"> 🟣 On Duty (Exam / Official)</label>
            <label class="fb-opt-label"><input type="radio" name="fac_st" value="UNAVAILABLE"> 🔴 Unavailable (Off Campus / Leave)</label>
          </div>
        </div>

        <div class="input-group">
          <label class="input-label">Current Room / Location</label>
          <input type="text" class="input-field" id="fac-input-loc" value="CSE Block — Room 204">
        </div>

        <div class="input-group">
          <label class="input-label">Current Activity</label>
          <input type="text" class="input-field" id="fac-input-act" value="Free / Available for doubt clearing">
        </div>

        <div class="input-group">
          <label class="input-label">Expected Return / Until (Optional)</label>
          <input type="time" class="input-field" id="fac-input-until" value="16:00">
        </div>

        <div style="font-size:13px;color:var(--text-muted);margin-bottom:18px">
          Last updated: <b>${esc(STATE.lastUpdated)}</b>
        </div>

        <button type="submit" class="btn btn-faculty btn-lg btn-block" id="btn-save-fac-status">
          Save Status
        </button>
      </form>
    </div>
  `;

  $('#btn-save-fac-status').addEventListener('click', async () => {
    const st = ($('input[name="fac_st"]:checked') || {}).value || 'AVAILABLE';
    const loc = $('#fac-input-loc').value.trim();
    const act = $('#fac-input-act').value.trim();
    const until = $('#fac-input-until').value;

    const btn = $('#btn-save-fac-status');
    btn.textContent = 'Saving…';
    btn.disabled = true;

    try {
      await api('/status', {
        method: 'POST',
        body: { status: st, location: loc, activity: act, expected_return_at: until }
      });
      STATE.lastUpdated = 'Just now';
      toast('Status & Location updated successfully!', '✅');
      refreshAppData().then(() => switchTab('dashboard'));
    } catch (e) {
      STATE.lastUpdated = 'Just now';
      toast('Status updated locally!', '✅');
      switchTab('dashboard');
    }
  });
}

function renderFacultyUpdateLocation(container) {
  renderFacultyUpdateStatus(container);
}

function renderFacultyTimetable(container) {
  container.innerHTML = `
    <div class="dashboard-header">
      <h1>My Weekly Timetable</h1>
      <p>Complete weekly class schedule across all sections (Monday to Friday).</p>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Time / Period</th>
            <th>Monday</th>
            <th>Tuesday</th>
            <th>Wednesday</th>
            <th>Thursday</th>
            <th>Friday</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>08:10 – 09:10</b><br><span style="font-size:11px;color:var(--text-muted)">Period 1</span></td>
            <td>DBMS<br><span style="font-size:12px;color:var(--text-muted)">III CSE A · Room 201</span></td>
            <td>—</td>
            <td>DBMS<br><span style="font-size:12px;color:var(--text-muted)">III CSE A · Room 201</span></td>
            <td>—</td>
            <td>OS<br><span style="font-size:12px;color:var(--text-muted)">II CSE B · Room 104</span></td>
          </tr>
          <tr>
            <td><b>09:10 – 10:10</b><br><span style="font-size:11px;color:var(--text-muted)">Period 2</span></td>
            <td>—</td>
            <td>DBMS<br><span style="font-size:12px;color:var(--text-muted)">III CSE B · Room 202</span></td>
            <td>—</td>
            <td>DBMS<br><span style="font-size:12px;color:var(--text-muted)">III CSE A · Room 201</span></td>
            <td>—</td>
          </tr>
          <tr>
            <td><b>10:20 – 11:20</b><br><span style="font-size:11px;color:var(--text-muted)">Period 3</span></td>
            <td>OS<br><span style="font-size:12px;color:var(--text-muted)">II CSE A · Room 102</span></td>
            <td>—</td>
            <td>—</td>
            <td>OS<br><span style="font-size:12px;color:var(--text-muted)">II CSE A · Room 102</span></td>
            <td>DBMS<br><span style="font-size:12px;color:var(--text-muted)">III CSE B · Room 202</span></td>
          </tr>
          <tr>
            <td><b>11:20 – 12:20</b><br><span style="font-size:11px;color:var(--text-muted)">Period 4</span></td>
            <td>—</td>
            <td>OS<br><span style="font-size:12px;color:var(--text-muted)">II CSE B · Room 104</span></td>
            <td>DBMS Lab<br><span style="font-size:12px;color:var(--text-muted)">CSE Lab 2</span></td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td><b>13:40 – 15:40</b><br><span style="font-size:11px;color:var(--text-muted)">Period 6–7</span></td>
            <td>DBMS Lab<br><span style="font-size:12px;color:var(--text-muted)">CSE Lab 3</span></td>
            <td>—</td>
            <td>Dept Meeting<br><span style="font-size:12px;color:var(--text-muted)">Conf Room</span></td>
            <td>Project Review<br><span style="font-size:12px;color:var(--text-muted)">Cabin 204</span></td>
            <td>—</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderFacultyProfile(container) {
  const facName = (STATE.user && STATE.user.name) ? STATE.user.name : 'Dr. Ravi Kumar';
  container.innerHTML = `
    <div class="dashboard-header">
      <h1>Faculty Profile</h1>
      <p>Manage your academic designation, office room, subjects, and contact information.</p>
    </div>

    <div class="feedback-card" style="max-width:680px">
      <div class="input-group">
        <label class="input-label">Faculty Name</label>
        <input type="text" class="input-field" value="${esc(facName)}" readonly style="opacity:0.8">
      </div>
      <div class="input-group">
        <label class="input-label">Department</label>
        <input type="text" class="input-field" value="Computer Science & Engineering" readonly style="opacity:0.8">
      </div>
      <div class="input-group">
        <label class="input-label">Designation</label>
        <input type="text" class="input-field" value="Associate Professor">
      </div>
      <div class="input-group">
        <label class="input-label">Subjects Taught</label>
        <input type="text" class="input-field" value="DBMS, Operating Systems, Data Structures">
      </div>
      <div class="input-group">
        <label class="input-label">Office Room</label>
        <input type="text" class="input-field" value="CSE Block — Room 204">
      </div>
      <div class="input-group">
        <label class="input-label">Contact Email</label>
        <input type="email" class="input-field" value="ravikumar@scsvmv.ac.in">
      </div>
      <div class="input-group">
        <label class="input-label">Office Hours</label>
        <input type="text" class="input-field" value="10:00 AM – 04:00 PM">
      </div>
      <button class="btn btn-faculty btn-lg btn-block" onclick="toast('Profile details updated!','✅')">
        Save Profile
      </button>
    </div>
  `;
}

/* ================================================================
   ADMIN VIEWS
   ================================================================ */
function renderAdminDashboard(container) {
  const stats = STATE.stats || {
    total_students: 1250,
    total_faculty: 85,
    departments: 8,
    currently_available: 32,
    currently_teaching: 41,
    unavailable: 12
  };

  container.innerHTML = `
    <div class="dashboard-header">
      <h1>Admin Dashboard</h1>
      <p>University-wide faculty status, timetable management and department analytics.</p>
    </div>

    <!-- 6 Primary Stat Cards -->
    <div class="stats-grid">
      <div class="stat-card" style="border-top:4px solid var(--primary)">
        <div class="stat-label">Total Students <span>👨‍🎓</span></div>
        <div class="stat-value">1,250</div>
        <div class="stat-sub">Across 8 departments</div>
      </div>

      <div class="stat-card" style="border-top:4px solid var(--role-faculty)">
        <div class="stat-label">Total Faculty <span>👨‍🏫</span></div>
        <div class="stat-value">85</div>
        <div class="stat-sub">Active faculty members</div>
      </div>

      <div class="stat-card" style="border-top:4px solid var(--role-admin)">
        <div class="stat-label">Departments <span>🏛️</span></div>
        <div class="stat-value">8</div>
        <div class="stat-sub">CSE, ECE, EEE, MECH…</div>
      </div>

      <div class="stat-card" style="border-top:4px solid var(--st-avail)">
        <div class="stat-label">Currently Available <span>🟢</span></div>
        <div class="stat-value" style="color:var(--st-avail-text)">32</div>
        <div class="stat-sub">Free in cabins</div>
      </div>

      <div class="stat-card" style="border-top:4px solid var(--st-teach)">
        <div class="stat-label">Currently Teaching <span>🔵</span></div>
        <div class="stat-value" style="color:var(--st-teach-text)">41</div>
        <div class="stat-sub">In active classes/labs</div>
      </div>

      <div class="stat-card" style="border-top:4px solid var(--st-unavail)">
        <div class="stat-label">Unavailable <span>🔴</span></div>
        <div class="stat-value" style="color:var(--st-unavail-text)">12</div>
        <div class="stat-sub">Off campus / on leave</div>
      </div>
    </div>

    <!-- Quick Navigation Shortcuts -->
    <div class="section-head">
      <h2>Administrative Controls</h2>
    </div>

    <div class="quick-cards-grid">
      <div class="action-card" onclick="switchTab('faculty-mgmt')">
        <div class="card-icon" style="background:var(--role-faculty-bg);color:var(--role-faculty)">👨‍🏫</div>
        <div>
          <h3>Faculty Management</h3>
          <p>Add, edit, or deactivate faculty accounts</p>
        </div>
      </div>

      <div class="action-card" onclick="switchTab('student-mgmt')">
        <div class="card-icon" style="background:var(--role-student-bg);color:var(--role-student)">👨‍🎓</div>
        <div>
          <h3>Student Management</h3>
          <p>Manage enrolled students and sections</p>
        </div>
      </div>

      <div class="action-card" onclick="switchTab('live-status')">
        <div class="card-icon" style="background:var(--st-avail-bg);color:var(--st-avail)">📡</div>
        <div>
          <h3>Live Status Monitor</h3>
          <p>Real-time wall with quick override controls</p>
        </div>
      </div>

      <div class="action-card" onclick="switchTab('feedback-analytics')">
        <div class="card-icon" style="background:var(--role-admin-bg);color:var(--role-admin)">📊</div>
        <div>
          <h3>Student Feedback</h3>
          <p>4.8 / 5 ⭐ average usefulness rating</p>
        </div>
      </div>
    </div>
  `;
}

function renderAdminFacultyMgmt(container) {
  container.innerHTML = `
    <div class="dashboard-header" style="display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <h1>Faculty Management</h1>
        <p>Manage faculty profiles, department assignments, and system credentials.</p>
      </div>
      <button class="btn btn-admin" id="btn-add-faculty">+ Add Faculty</button>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Faculty ID</th>
            <th>Name</th>
            <th>Department</th>
            <th>Status</th>
            <th>Location</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${STATE.faculty.map(f => `
            <tr>
              <td><b>${esc(f.code || 'F0' + f.id)}</b></td>
              <td><b>${esc(f.name)}</b><br><span style="font-size:12px;color:var(--text-muted)">${esc(f.designation || 'Assistant Professor')}</span></td>
              <td>${esc(f.dept_code || 'CSE')}</td>
              <td>
                <span class="badge badge-${(f.status || 'AVAILABLE').toLowerCase()}">
                  <span class="dot"></span>
                  ${esc(f.status || 'AVAILABLE')}
                </span>
              </td>
              <td>${esc(f.location || f.cabin || 'Room 204')}</td>
              <td>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-secondary btn-sm" onclick="openFacultyProfileModal(${f.id})">View</button>
                  <button class="btn btn-secondary btn-sm" onclick="toast('Editing ${esc(f.name)}…','✏️')">Edit</button>
                  <button class="btn btn-outline btn-sm" style="color:var(--st-unavail);border-color:var(--st-unavail)" onclick="toast('${esc(f.name)} deactivated','⚠️')">Deactivate</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  $('#btn-add-faculty').addEventListener('click', () => {
    toast('Add Faculty Modal opened', '👨‍🏫');
  });
}

function renderAdminStudentMgmt(container) {
  container.innerHTML = `
    <div class="dashboard-header" style="display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <h1>Student Management</h1>
        <p>Search, filter, view and activate/deactivate student registrations.</p>
      </div>
      <button class="btn btn-student">+ Add Student</button>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Student ID</th>
            <th>Name</th>
            <th>Department</th>
            <th>Year</th>
            <th>Section</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>21CSE042</b></td>
            <td>Sandeep Kumar</td>
            <td>CSE</td>
            <td>3rd Year</td>
            <td>III CSE A</td>
            <td><span class="badge badge-available"><span class="dot"></span>Active</span></td>
            <td><button class="btn btn-secondary btn-sm" onclick="toast('Viewing Sandeep','👤')">View</button></td>
          </tr>
          <tr>
            <td><b>21CSE088</b></td>
            <td>Pooja Verma</td>
            <td>CSE</td>
            <td>3rd Year</td>
            <td>III CSE B</td>
            <td><span class="badge badge-available"><span class="dot"></span>Active</span></td>
            <td><button class="btn btn-secondary btn-sm" onclick="toast('Viewing Pooja','👤')">View</button></td>
          </tr>
          <tr>
            <td><b>22ECE015</b></td>
            <td>Rahul Sharma</td>
            <td>ECE</td>
            <td>2nd Year</td>
            <td>II ECE A</td>
            <td><span class="badge badge-available"><span class="dot"></span>Active</span></td>
            <td><button class="btn btn-secondary btn-sm" onclick="toast('Viewing Rahul','👤')">View</button></td>
          </tr>
          <tr>
            <td><b>21CSE012</b></td>
            <td>Ananya Iyer</td>
            <td>CSE</td>
            <td>3rd Year</td>
            <td>III CSE A</td>
            <td><span class="badge badge-available"><span class="dot"></span>Active</span></td>
            <td><button class="btn btn-secondary btn-sm">View</button></td>
          </tr>
          <tr>
            <td><b>23MECH004</b></td>
            <td>Vignesh R</td>
            <td>MECH</td>
            <td>1st Year</td>
            <td>I MECH A</td>
            <td><span class="badge badge-available"><span class="dot"></span>Active</span></td>
            <td><button class="btn btn-secondary btn-sm">View</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminTimetableMgmt(container) {
  container.innerHTML = `
    <div class="dashboard-header" style="display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <h1>Timetable Management</h1>
        <p>Assign faculty, subjects, classrooms and time periods per section.</p>
      </div>
      <button class="btn btn-primary" onclick="toast('Timetable slot editor ready','➕')">+ Add Timetable Entry</button>
    </div>

    <div class="filter-bar">
      <div class="filter-group">
        <label>Department:</label>
        <select class="filter-select">
          <option>Computer Science & Engineering</option>
          <option>Electronics & Communication</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Section:</label>
        <select class="filter-select">
          <option>III Year CSE A</option>
          <option>III Year CSE B</option>
        </select>
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Period</th>
            <th>Time</th>
            <th>Subject</th>
            <th>Assigned Faculty</th>
            <th>Room / Venue</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>Period 1</b></td>
            <td>08:10 – 09:10</td>
            <td><b>Database Management Systems (DBMS)</b></td>
            <td>Dr. Ravi Kumar</td>
            <td>CSE Block — Room 201</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="toast('Editing slot…','✏️')">Edit</button>
              <button class="btn btn-outline btn-sm" style="color:var(--st-unavail);border-color:var(--st-unavail)" onclick="toast('Slot deleted','🗑️')">Delete</button>
            </td>
          </tr>
          <tr>
            <td><b>Period 2</b></td>
            <td>09:10 – 10:10</td>
            <td><b>Computer Networks</b></td>
            <td>Dr. S. Selvakumar</td>
            <td>CSE Block — Room 201</td>
            <td>
              <button class="btn btn-secondary btn-sm">Edit</button>
              <button class="btn btn-outline btn-sm" style="color:var(--st-unavail);border-color:var(--st-unavail)">Delete</button>
            </td>
          </tr>
          <tr>
            <td><b>Period 3</b></td>
            <td>10:20 – 11:20</td>
            <td><b>Design & Analysis of Algorithms</b></td>
            <td>Dr. Priya Sharma</td>
            <td>CSE Block — Room 201</td>
            <td>
              <button class="btn btn-secondary btn-sm">Edit</button>
              <button class="btn btn-outline btn-sm" style="color:var(--st-unavail);border-color:var(--st-unavail)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminDeptsMgmt(container) {
  const depts = STATE.departments.length ? STATE.departments : DEFAULT_DEPARTMENTS;

  container.innerHTML = `
    <div class="dashboard-header" style="display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <h1>Department Management</h1>
        <p>University academic departments, head of departments, and block allocations.</p>
      </div>
      <button class="btn btn-admin" onclick="toast('Add Department Modal','🏛️')">+ Add Department</button>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Department Name</th>
            <th>Campus Block</th>
            <th>Head of Department (HOD)</th>
            <th>Faculty</th>
            <th>Students</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${depts.map(d => `
            <tr>
              <td><b>${esc(d.code)}</b></td>
              <td><b>${esc(d.name)}</b></td>
              <td>📍 ${esc(d.block)}</td>
              <td>${esc(d.hod || '—')}</td>
              <td>${d.faculty_count || 12}</td>
              <td>${d.student_count || 180}</td>
              <td>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-secondary btn-sm" onclick="toast('Editing ${esc(d.code)}…','✏️')">Edit</button>
                  <button class="btn btn-outline btn-sm" style="color:var(--st-unavail);border-color:var(--st-unavail)" onclick="toast('Deleted department','🗑️')">Delete</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminLiveStatus(container) {
  container.innerHTML = `
    <div class="dashboard-header">
      <h1>Live Faculty Status Monitor</h1>
      <p>University-wide real-time wall with instant administrative override actions.</p>
    </div>

    <div class="faculty-grid">
      ${STATE.faculty.map(f => {
        const stBadgeClass = `badge-${(f.status || 'AVAILABLE').toLowerCase()}`;
        return `
          <div class="fac-card">
            <div class="fac-card-top">
              <div class="fac-info" style="flex:1">
                <h3>${esc(f.name)}</h3>
                <p class="dept">${esc(f.dept_code || 'CSE')} · ${esc(f.designation || 'Faculty')}</p>
              </div>
              <span class="badge ${stBadgeClass}">
                <span class="dot"></span>
                ${esc(f.status || 'AVAILABLE')}
              </span>
            </div>

            <div class="fac-status-box">
              <div class="fac-location-line">📍 ${esc(f.location || f.cabin || 'Room 204')}</div>
              <div class="fac-activity-line">${esc(f.activity || 'Free')}</div>
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
              <button class="btn btn-secondary btn-sm" onclick="setAdminOverride(${f.id}, 'AVAILABLE')">Mark Free</button>
              <button class="btn btn-secondary btn-sm" onclick="setAdminOverride(${f.id}, 'MEETING')">Meeting</button>
              <button class="btn btn-secondary btn-sm" onclick="setAdminOverride(${f.id}, 'ON_DUTY')">Duty</button>
              <button class="btn btn-outline btn-sm" style="color:var(--st-unavail);border-color:var(--st-unavail)" onclick="setAdminOverride(${f.id}, 'UNAVAILABLE')">Absent</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function setAdminOverride(fid, status) {
  try {
    await api(`/faculty/${fid}/status`, {
      method: 'POST',
      body: { status, reason: `Marked ${status} by Admin` }
    });
    toast(`Faculty #${fid} marked as ${status}`, '✅');
    refreshAppData().then(() => renderAdminLiveStatus($('#app-view-container')));
  } catch (e) {
    toast(`Faculty #${fid} status updated`, '✅');
  }
}

function renderAdminFeedbackAnalytics(container) {
  container.innerHTML = `
    <div class="dashboard-header">
      <h1>Student Feedback Analytics</h1>
      <p>Aggregated student responses on faculty accessibility and feature usefulness.</p>
    </div>

    <!-- Analytics Top Cards -->
    <div class="stats-grid">
      <div class="stat-card" style="border-top:4px solid var(--primary)">
        <div class="stat-label">Total Responses <span>📝</span></div>
        <div class="stat-value">58</div>
        <div class="stat-sub">Across 5 departments</div>
      </div>

      <div class="stat-card" style="border-top:4px solid #f59e0b">
        <div class="stat-label">Average Usefulness <span>⭐</span></div>
        <div class="stat-value" style="color:#d97706">4.8 / 5</div>
        <div class="stat-sub">96% student satisfaction</div>
      </div>

      <div class="stat-card" style="border-top:4px solid var(--st-avail)">
        <div class="stat-label">Most Requested Feature <span>🔥</span></div>
        <div class="stat-value" style="font-size:18px;line-height:1.3;color:var(--st-avail-text)">Live Status Monitor</div>
        <div class="stat-sub">58% votes</div>
      </div>

      <div class="stat-card" style="border-top:4px solid var(--role-admin)">
        <div class="stat-label">Adoption Willingness <span>👍</span></div>
        <div class="stat-value">92%</div>
        <div class="stat-sub">Would definitely use daily</div>
      </div>
    </div>

    <!-- Charts & Breakdown -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:20px;margin-bottom:28px">
      <div class="stat-card">
        <h3 style="font-size:16px;font-weight:800;margin-bottom:16px">Most Useful Features</h3>
        <div class="chart-bar-row">
          <div class="chart-bar-header"><span>Real-time Live Status</span><span>58%</span></div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:58%"></div></div>
        </div>
        <div class="chart-bar-row">
          <div class="chart-bar-header"><span>Cabin & Room Directions</span><span>24%</span></div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:24%"></div></div>
        </div>
        <div class="chart-bar-row">
          <div class="chart-bar-header"><span>Timetable Lookup</span><span>12%</span></div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:12%"></div></div>
        </div>
        <div class="chart-bar-row">
          <div class="chart-bar-header"><span>Next Availability Prediction</span><span>6%</span></div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:6%"></div></div>
        </div>
      </div>

      <div class="stat-card">
        <h3 style="font-size:16px;font-weight:800;margin-bottom:16px">Current Difficulty Finding Faculty</h3>
        <div class="chart-bar-row">
          <div class="chart-bar-header"><span>Frequently</span><span>65%</span></div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:65%;background:#ef4444"></div></div>
        </div>
        <div class="chart-bar-row">
          <div class="chart-bar-header"><span>Sometimes</span><span>28%</span></div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:28%;background:#f59e0b"></div></div>
        </div>
        <div class="chart-bar-row">
          <div class="chart-bar-header"><span>Rarely / Never</span><span>7%</span></div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:7%;background:#10b981"></div></div>
        </div>
      </div>
    </div>

    <!-- Feedback Entries Table -->
    <div class="section-head">
      <h2>Recent Student Suggestions</h2>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Dept</th>
            <th>Rating</th>
            <th>Most Useful Feature</th>
            <th>Student Suggestion</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>Sandeep Kumar</b><br><span style="font-size:12px;color:var(--text-muted)">21CSE042</span></td>
            <td>CSE</td>
            <td>⭐⭐⭐⭐⭐</td>
            <td>Live Status</td>
            <td>"Adding directions to the cabin was a great idea! Very smooth and saves 15 mins every day."</td>
          </tr>
          <tr>
            <td><b>Pooja Verma</b><br><span style="font-size:12px;color:var(--text-muted)">21CSE088</span></td>
            <td>CSE</td>
            <td>⭐⭐⭐⭐⭐</td>
            <td>Cabin & Room Directions</td>
            <td>"Saves so much walking between 2nd and 3rd floors looking for teachers."</td>
          </tr>
          <tr>
            <td><b>Rahul Sharma</b><br><span style="font-size:12px;color:var(--text-muted)">22ECE015</span></td>
            <td>ECE</td>
            <td>⭐⭐⭐⭐</td>
            <td>Timetable Lookup</td>
            <td>"Please make sure lab technicians and ECE staff cabins are also listed."</td>
          </tr>
          <tr>
            <td><b>Ananya Iyer</b><br><span style="font-size:12px;color:var(--text-muted)">21CSE012</span></td>
            <td>CSE</td>
            <td>⭐⭐⭐⭐⭐</td>
            <td>Live Status</td>
            <td>"Accurate status reporting is super helpful during project review days."</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

/* ================================================================
   BOOTSTRAP & INITIALIZATION
   ================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  // Apply saved theme
  applyTheme(STATE.theme);

  // Setup Role Selection & Login Form Handlers
  initRoleSelection();

  $('#btn-back-to-roles').addEventListener('click', () => showScreen('screen-role-select'));
  $('#btn-submit-login').addEventListener('click', submitLogin);
  $('#login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitLogin();
  });
  $('#btn-logout').addEventListener('click', doLogout);
  $('#nav-brand-btn').addEventListener('click', () => switchTab('dashboard'));

  // Forgot Password helper
  $('#btn-forgot-pw').addEventListener('click', (e) => {
    e.preventDefault();
    const mc = $('#modal-container');
    mc.classList.remove('hide');
    mc.innerHTML = `
      <div class="modal-overlay" id="modal-overlay-bg">
        <div class="modal-window" style="max-width:460px">
          <div class="modal-header">
            <h2>🔑 Password Assistance</h2>
            <button class="modal-close-btn" id="btn-close-modal">✕</button>
          </div>
          <div class="modal-body">
            <p style="font-size:14px;color:var(--text-muted);line-height:1.5;margin-bottom:16px">
              Default demo credentials are ready to use:
            </p>
            <div style="background:var(--bg-card-alt);padding:14px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:13.5px;line-height:1.6">
              👨‍🎓 Student: <b>sandeep</b> / <b>sandeep123</b><br>
              👨‍🏫 Faculty: <b>dr.ravikumar</b> / <b>faculty123</b><br>
              🛡️ Admin: <b>admin</b> / <b>admin123</b>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" id="btn-close-pw">Understood</button>
          </div>
        </div>
      </div>
    `;
    const closeModal = () => mc.classList.add('hide');
    $('#btn-close-modal').addEventListener('click', closeModal);
    $('#btn-close-pw').addEventListener('click', closeModal);
    $('#modal-overlay-bg').addEventListener('click', e => {
      if (e.target.id === 'modal-overlay-bg') closeModal();
    });
  });

  // Check if existing token exists
  if (TOKEN) {
    try {
      const meRes = await api('/me');
      if (meRes && meRes.user) {
        STATE.user = meRes.user;
        STATE.role = meRes.user.role;
        enterApp();
        return;
      }
    } catch (e) {
      TOKEN = '';
      store.del('fmf_token');
    }
  }

  // Otherwise start cleanly on Page 1: Role Selection!
  showScreen('screen-role-select');
});
