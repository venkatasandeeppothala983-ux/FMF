// FindMyFaculty UI e2e (v2 — clean login-first app).
// Composes the real served index.html + app.js into jsdom; stubs window.fetch
// with Node fetch (resolving relative /api URLs against the live server).
// Flow: login-only boot → faculty status update → student "where is now" browse
// + watch toggle → admin live wall. Asserts zero uncaught runtime errors.
// Usage: node tests/e2e_ui.js   (server must be on 8123; npm i once for jsdom)
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(__dirname, '..', 'node_modules', 'jsdom'));
const BASE = process.env.FMF_BASE || 'http://127.0.0.1:8123';
const lines = [];
const out = l => { lines.push(l); };
const fails = [];
const pass = (t, c, extra) => { out((c ? 'PASS ' : 'FAIL ') + t + (extra ? '  [' + extra + ']' : '')); if (!c) fails.push(t); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch (e) {} await sleep(100); }
  return null;
}

(async () => {
  const indexHtml = await (await fetch(BASE + '/')).text();
  const appJs = await (await fetch(BASE + '/app.js')).text();
  const html = indexHtml.replace(/<script src="app\.js"><\/script>/, () => '<script>' + appJs + '</script>');
  if (/<script src="app\.js">/.test(html)) throw new Error('inlining failed');

  const vc = new VirtualConsole();
  vc.on('jsdomError', e => out('JSDOMERR: ' + String(e.message || e).slice(0, 200)));
  const dom = new JSDOM(html, {
    url: BASE + '/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) {
      window.fetch = (u, o) => globalThis.fetch(typeof u === 'string' && u.startsWith('/') ? BASE + u : u, o);
      window.scrollTo = () => {};
      window.__errs = [];
      window.addEventListener('error', e => window.__errs.push('err:' + (e.message || e.error)));
      window.addEventListener('unhandledrejection', e =>
        window.__errs.push('rej:' + ((e.reason && (e.reason.message || e.reason)) || e.reason)));
    }
  });
  const w = dom.window, d = w.document;
  const $ = s => d.querySelector(s);
  const api = (p, o) => w.fetch(BASE + '/api' + p, o);

  /* ============ 1. boot shows ONLY login ============ */
  out('== BOOT / LOGIN ==');
  await waitFor(() => $('#liGo'), 8000);
  pass('login card visible on open', !!$('#screen-login') && !$('#screen-login').classList.contains('hide'));
  pass('app content hidden before login', $('#screen-app').classList.contains('hide'));
  pass('three role tabs', d.querySelectorAll('#roleTabs button').length === 3);
  pass('no timetable/section dump on login screen', !($('#content') && $('#content').children.length));

  // wrong password -> clear error, stays on login
  $('#liUser').value = 'student1'; $('#liPass').value = 'wrongpass';
  w.doLogin();
  const errShown = await waitFor(() => $('#liErr') && $('#liErr').textContent.length > 0);
  pass('bad login shows error', !!errShown, $('#liErr')?.textContent);
  pass('still on login after error', $('#screen-app').classList.contains('hide'));

  /* ============ 2. FACULTY ============ */
  out('== FACULTY ==');
  $('#liUser').value = 'dr.v.geetha'; $('#liPass').value = 'faculty123';
  w.doLogin();
  await waitFor(() => $('#whoAmI') && $('#whoAmI').textContent.includes('Geetha'));
  pass('faculty lands in app', !!($('#whoAmI') && $('#whoAmI').textContent));
  await waitFor(() => $('#pageTitle') && $('#pageTitle').textContent.includes('My day'));
  pass('faculty dashboard titled', $('#pageTitle').textContent.includes('My day'));
  await waitFor(() => $('#stSave'));
  pass('status card + chips present', d.querySelectorAll('.stgrid button').length === 5);
  pass('“classes today (auto)” stat tile', $('#content').textContent.includes('classes today (auto)'));

  const meetBtn = [...d.querySelectorAll('.stgrid button')].find(b => b.dataset.st === 'MEETING');
  pass('MEETING chip available', !!meetBtn);
  if (meetBtn) {
    meetBtn.click();
    const loc = $('#stLoc'); if (loc) loc.value = 'Cabin C-204';
    $('#stSave').click();
    const ovOk = await waitFor(async () => {
      try { const ov = await (await api('/faculty/overview')).json();
        const s = ov.states && ov.states['Dr. V. Geetha'];
        return s && s.derived === 'MEETING' && s.source === 'reported'; }
      catch (e) { return false; }
    }, 8000);
    if (!ovOk) { try { const ov = await (await api('/faculty/overview')).json(); const s = ov.states['Dr. V. Geetha'];
      out('DIAG after timeout: derived=' + s.derived + ' source=' + s.source + ' stMsg=' + ($('#stMsg') ? $('#stMsg').textContent : '-') + ' chosen=' + (w.FAC_CHOSEN !== undefined ? w.FAC_CHOSEN : '?') + ' saveDisabled=' + ($('#stSave') ? $('#stSave').disabled : '?')); } catch (e) { out('DIAG err ' + e.message); } }
    pass('status saved → overview MEETING/reported', !!ovOk);
    // restore clean (AVAILABLE) for the demo DB
    const avBtn = [...d.querySelectorAll('.stgrid button')].find(b => b.dataset.st === 'AVAILABLE');
    if (avBtn) { avBtn.click(); const l2 = $('#stLoc'); if (l2) l2.value = ''; $('#stSave').click(); }
    await sleep(600);
  }
  $('#outBtn').click();
  await waitFor(() => $('#liGo') && !$('#screen-login').classList.contains('hide'));
  pass('faculty signs out to login screen', $('#screen-app').classList.contains('hide'));

  /* ============ 3. STUDENT — where is now ============ */
  out('== STUDENT ==');
  $('#liUser').value = 'student1'; $('#liPass').value = 'student123';
  w.doLogin();
  const stTitle = await waitFor(() => $('#pageTitle') && $('#pageTitle').textContent.includes('Where is your faculty'));
  pass('student title “Where is your faculty?”', !!stTitle);
  const rows = await waitFor(() => $('#facList') && d.querySelectorAll('#facList .frow').length >= 38, 10000);
  pass('faculty list shows all 38', !!rows, 'rows=' + d.querySelectorAll('#facList .frow').length);
  pass('every row has a status pill', d.querySelectorAll('#facList .pill').length >= 38);
  pass('search box + filter chips', !!$('#q') && d.querySelectorAll('#fchips button').length === 4);
  // search
  const q = $('#q'); q.value = 'geetha';
  q.dispatchEvent(new w.Event('input', { bubbles: true }));
  await sleep(500);
  const geoRows = d.querySelectorAll('#facList .frow');
  pass('search “geetha” narrows list', geoRows.length >= 1 && geoRows.length <= 2, 'rows=' + geoRows.length);
  // open profile modal
  geoRows[0].click();
  const modalUp = await waitFor(() => $('#modal').classList.contains('on') && $('#mBox') && $('#mBox').textContent.includes('Geetha'), 8000);
  pass('profile modal opens with faculty name', !!modalUp);
  pass('modal offers “Request a slot”', !!$('#bkGo'));
  const wBtn = await waitFor(() => $('#wGo'), 5000);
  pass('watch button present', !!wBtn);
  if (wBtn) {
    // normalize: unwatch first if a previous run left it on
    try {
      const wl = await w.api('/watchlist');
      const hit = (wl.watchlist || []).find(x => x.fac_name && x.fac_name.includes('Geetha'));
      if (hit) await w.api('/watchlist/' + hit.faculty_id, { method: 'DELETE' });
    } catch (e) {}
    await sleep(300);
    wBtn.click();
    const on = await waitFor(() => $('#wGo') && $('#wGo').textContent.includes('Watching'), 6000);
    pass('watch toggled ON', !!on, $('#wGo')?.textContent.trim());
    $('#wGo').click();
    const off = await waitFor(() => $('#wGo') && !$('#wGo').textContent.includes('Watching'), 6000);
    pass('watch toggled OFF (cleanup)', !!off, $('#wGo')?.textContent.trim());
  }
  // close modal
  const cx = $('#mBox .x'); if (cx) cx.click();
  await sleep(300);
  pass('modal closes', !$('#modal').classList.contains('on'));
  // booking step renders + resolves (do not actually send)
  // NB: wait for the NEW modal's button (isConnected) — the old one lingers in #mBox
  // until the fresh openFaculty render lands, and clicking it races that render.
  const prevBk = $('#bkGo');                       // old (hidden) modal's button, if any
  const g2 = await waitFor(() => [...d.querySelectorAll('#facList .frow')].find(r => (r.dataset.nm || '').includes('Geetha')));
  if (g2) g2.click();
  const bkBtn = await waitFor(() => { const b = $('#bkGo'); return b && b.isConnected && b !== prevBk ? b : null; }, 8000);
  pass('profile modal reopens (fresh render)', !!bkBtn);
  if (bkBtn) {
    bkBtn.click();
    const days = await waitFor(() => $('#bkDays') && d.querySelectorAll('#bkDays .chip').length === 5, 6000);
    pass('booking step: 5 weekday chips', !!days, 'chips=' + d.querySelectorAll('#bkDays .chip').length);
    pass('duration options 15/30/45', d.querySelectorAll('#bkDur .chip').length === 3);
    const resolved = await waitFor(() => $('#bkSlots') && !$('#bkSlots').textContent.includes('checking'), 9000);
    pass('booking step: slot list resolves', !!resolved, $('#bkSlots')?.textContent.slice(0, 40).replace(/\s+/g, ' '));
    const firstSlot = $('#bkSlots .slotrow');
    if (firstSlot) {
      firstSlot.click();
      const en = await waitFor(() => $('#bkSend') && !$('#bkSend').disabled, 3000);
      pass('slot select enables send (not pressed)', !!en);
    }
    const mcl = $('#mClose') || $('#mBox .x');
    if (mcl) mcl.click();
    await sleep(300);
    if ($('#modal').classList.contains('on')) { $('#modal').click(); await sleep(200); }
    pass('booking modal closes', !$('#modal').classList.contains('on'));
  }
  pass('“My appointments” section renders', $('#stuExtra') && $('#stuExtra').textContent.includes('My appointments'));
  $('#outBtn').click();
  await waitFor(() => !$('#screen-login').classList.contains('hide'));

  /* ============ 4. ADMIN ============ */
  out('== ADMIN ==');
  $('#liUser').value = 'admin'; $('#liPass').value = 'admin123';
  w.doLogin();
  await waitFor(() => $('#pageTitle') && $('#pageTitle').textContent.includes('Live — all faculty'));
  const wall = await waitFor(() => $('#admWall') && $('#admWall').querySelectorAll('.frow').length >= 38, 10000);
  pass('admin live wall lists all faculty', !!wall, 'rows=' + $('#admWall')?.querySelectorAll('.frow').length);
  pass('admin stat tiles present', ($('#content').textContent || '').includes('pending appts'));
  pass('reports + announcements cards', !!$('#admReports') && !!$('#anSend'));

  /* ============ health ============ */
  await sleep(1200);
  pass('no uncaught runtime errors', (w.__errs || []).length === 0, (w.__errs || []).slice(0, 5).join(' | '));
  pass('no jsdom page errors logged', !lines.some(l => l.startsWith('JSDOMERR')), lines.find(l => l.startsWith('JSDOMERR')) || '');

  console.log(lines.join('\n'));
  console.log('\nRESULT: ' + (fails.length === 0 ? 'ALL PASS ✓' : fails.length + ' FAILURES: ' + fails.join(' ; ')));
  dom.window.close();
  process.exit(fails.length === 0 ? 0 : 1);
})().catch(e => {
  out('FATAL ' + (e && e.stack || e));
  console.log(lines.join('\n'));
  process.exit(2);
});
setTimeout(() => { console.error('HARD-KILL TIMEOUT\n' + lines.join('\n')); process.exit(3); }, 90000);
