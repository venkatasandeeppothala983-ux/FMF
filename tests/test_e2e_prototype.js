const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const BASE = 'http://127.0.0.1:8123';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('--- Starting FindMyFaculty Prototype E2E Suite ---');
  const indexHtml = await (await fetch(BASE + '/')).text();
  const appJs = await (await fetch(BASE + '/app.js')).text();
  const html = indexHtml.replace(/<script src="app\.js"><\/script>/, () => '<script>' + appJs + '</script>');

  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errs.push('JSDOMERR ' + String(e.message || e)));

  const dom = new JSDOM(html, {
    url: BASE + '/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.fetch = (u, o) => globalThis.fetch(typeof u === 'string' && u.startsWith('/') ? BASE + u : u, o);
      window.__errs = [];
      window.addEventListener('error', e => window.__errs.push('err:' + (e.message || e.error)));
      window.addEventListener('unhandledrejection', e => window.__errs.push('rej:' + String((e.reason && (e.reason.message || e.reason)) || e.reason)));
    }
  });

  const w = dom.window, d = w.document, $ = s => d.querySelector(s), $$ = s => d.querySelectorAll(s);
  const waitFor = async (fn, ms = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      try { const v = await fn(); if (v) return v; } catch (e) {}
      await sleep(60);
    }
    return null;
  };

  function assert(title, cond, detail = '') {
    if (cond) {
      console.log('PASS ✓ ' + title + (detail ? ` [${detail}]` : ''));
    } else {
      console.error('FAIL ✗ ' + title + (detail ? ` [${detail}]` : ''));
      process.exit(1);
    }
  }

  // 1. PAGE 1: Role Selection
  await waitFor(() => $('#screen-role-select'));
  assert('Role Selection Screen visible', !$('#screen-role-select').classList.contains('hide'));
  assert('Three Role Cards present', $$('.role-card').length === 3);
  assert('Student continue button present', !!$('#btn-continue-student'));
  assert('Faculty continue button present', !!$('#btn-continue-faculty'));
  assert('Admin continue button present', !!$('#btn-continue-admin'));

  // 2. Click Continue as Student -> Student Login Page
  $('#btn-continue-student').click();
  await waitFor(() => !$('#screen-role-login').classList.contains('hide'));
  assert('Student Login Screen active', $('#login-role-title').textContent.includes('Student'));
  assert('Student Demo Chips present', $$('.demo-chip').length >= 1);

  // 3. Student Login
  $('#login-username').value = 'sandeep';
  $('#login-password').value = 'sandeep123';
  $('#btn-submit-login').click();
  await waitFor(() => !$('#screen-app').classList.contains('hide') && $('.dashboard-header h1') && $('.dashboard-header h1').textContent.includes('Sandeep'));
  assert('Student logged in and entered App', $('#nav-user-name').textContent.includes('Sandeep'));
  assert('Greeting contains Sandeep', $('.dashboard-header h1').textContent.includes('Sandeep'));
  assert('Hero search box present', !!$('#stu-hero-search'));
  assert('Available Now action card present', !!$('#card-action-avail'));

  // 4. Find Faculty Tab
  const findTab = await waitFor(() => [...$$('.nav-tab-btn')].find(b => b.dataset.tab === 'find-faculty'));
  assert('Find Faculty Tab present', !!findTab);
  findTab.click();
  await waitFor(() => $('#fac-search-input') && $$('.fac-card').length >= 3);
  assert('Find Faculty search input ready', !!$('#fac-search-input'));
  assert('Faculty cards rendered', $$('.fac-card').length >= 3);

  // 5. Open Faculty Profile Modal for Dr. Ravi Kumar
  const raviCard = [...$$('.fac-card')].find(c => c.textContent.includes('Ravi Kumar'));
  assert('Dr. Ravi Kumar card found', !!raviCard);
  raviCard.querySelector('.btn-view-fac-details').click();
  await waitFor(() => !$('#modal-container').classList.contains('hide') && $('#modal-container h2'));
  assert('Faculty Profile Modal opened', $('#modal-container h2').textContent.includes('Dr. Ravi Kumar'));
  assert('Get Directions button present', !!$('#btn-modal-get-directions'));
  assert('View Timetable button present', !!$('#btn-modal-view-tt'));
  assert('Contact Faculty button present', !!$('#btn-modal-contact'));

  // 6. Test Get Directions Modal
  $('#btn-modal-get-directions').click();
  await waitFor(() => $('#modal-container').textContent.includes('Campus Cabin Locator'));
  assert('Directions Modal opened', $('#modal-container').textContent.includes('Campus Cabin Locator'));
  assert('Building grid visualizer present', !!$('.building-grid'));
  $('#btn-done-directions').click();
  assert('Directions Modal closed', $('#modal-container').classList.contains('hide'));

  // 7. Student Timetable Tab
  const ttTab = await waitFor(() => [...$$('.nav-tab-btn')].find(b => b.dataset.tab === 'timetable'));
  assert('Timetable Tab present', !!ttTab);
  ttTab.click();
  await waitFor(() => $('#tt-sec-select'));
  assert('Student Timetable timeline rendered', $$('.timeline-slot').length >= 4);

  // 8. Give Feedback Tab (6 questions)
  const fbTab = await waitFor(() => [...$$('.nav-tab-btn')].find(b => b.dataset.tab === 'feedback'));
  assert('Feedback Tab present', !!fbTab);
  fbTab.click();
  await waitFor(() => $('#student-feedback-form'));
  assert('Feedback form rendered with questions', $$('.fb-question').length >= 5);
  $('#btn-submit-feedback').click();
  await waitFor(() => $('#fb-card-form').textContent.includes('Thank You'));
  assert('Feedback submission success state rendered', $('#fb-card-form').textContent.includes('Thank You'));

  // 9. Sign Out -> Returns to Role Selection
  $('#btn-logout').click();
  await waitFor(() => !$('#screen-role-select').classList.contains('hide'));
  assert('Logged out to Role Selection Screen', !$('#screen-role-select').classList.contains('hide'));

  // 10. Faculty Login
  $('#btn-continue-faculty').click();
  await waitFor(() => !$('#screen-role-login').classList.contains('hide'));
  $('#login-username').value = 'dr.ravikumar';
  $('#login-password').value = 'faculty123';
  $('#btn-submit-login').click();
  await waitFor(() => !$('#screen-app').classList.contains('hide') && $('.dashboard-header h1') && $('.dashboard-header h1').textContent.includes('Dr. Ravi Kumar'));
  assert('Faculty Dashboard loaded', $('.dashboard-header h1').textContent.includes('Dr. Ravi Kumar'));
  assert('Faculty Update Status quick button present', !!$('#btn-fac-quick-status'));

  // 11. Faculty Update Status
  $('#btn-fac-quick-status').click();
  await waitFor(() => $('#fac-status-form'));
  assert('Faculty Status Update form rendered', !!$('#btn-save-fac-status'));
  $('#fac-input-loc').value = 'CSE Block — Room 204 (Updated)';
  $('#btn-save-fac-status').click();
  await sleep(200);

  // 12. Sign Out & Admin Login
  $('#btn-logout').click();
  await waitFor(() => !$('#screen-role-select').classList.contains('hide'));
  $('#btn-continue-admin').click();
  await waitFor(() => !$('#screen-role-login').classList.contains('hide'));
  $('#login-username').value = 'admin';
  $('#login-password').value = 'admin123';
  $('#btn-submit-login').click();
  await waitFor(() => !$('#screen-app').classList.contains('hide') && $('.dashboard-header h1') && $('.dashboard-header h1').textContent.includes('Admin Dashboard'));
  assert('Admin Dashboard loaded', $('.dashboard-header h1').textContent.includes('Admin Dashboard'));
  assert('Admin Stats Grid rendered with 6 cards', $$('.stat-card').length >= 6);

  // 13. Admin Navigation Tabs
  const admTabs = $$('.nav-tab-btn');
  assert('Admin has 7 navigation tabs', admTabs.length === 7);

  // 14. Admin Departments
  const deptTab = [...admTabs].find(b => b.dataset.tab === 'depts-mgmt');
  deptTab.click();
  await waitFor(() => $('.data-table'));
  assert('Admin Department Management table loaded', $$('.data-table tbody tr').length >= 5);

  // 15. Admin Live Status Monitor
  const liveTab = [...admTabs].find(b => b.dataset.tab === 'live-status');
  liveTab.click();
  await waitFor(() => $$('.fac-card').length >= 5);
  assert('Admin Live Faculty Status Wall loaded', $$('.fac-card').length >= 5);

  // 16. Admin Feedback Analytics
  const fbAnalTab = [...admTabs].find(b => b.dataset.tab === 'feedback-analytics');
  fbAnalTab.click();
  await waitFor(() => $('.chart-bar-track'));
  assert('Feedback Analytics Charts loaded', $$('.chart-bar-track').length >= 4);

  // Check errors
  assert('No unhandled JS errors occurred', (w.__errs || []).length === 0, (w.__errs || []).join('; '));
  console.log('\n⭐ ALL FINDMYFACULTY PROTOTYPE FLOWS PASSED PERFECTLY (17/17) ⭐');
  dom.window.close();
  process.exit(0);
})().catch(e => {
  console.error('FATAL TEST ERROR:', e);
  process.exit(1);
});
