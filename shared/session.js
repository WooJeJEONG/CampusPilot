/* Campuspilot — shared session helper (student / admin sign-in state).
   Persisted in localStorage so it survives a real page navigation or
   reload — there's no backend yet, so this *is* the sign-in system.
   Load this FIRST on every protected page, before shared/toast.js,
   and call requireSession() at the top of that page's inline script. */
var SESSION_KEY = 'campuspilot.session.v1';

function getSession(){
  try{
    var raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

/* setSession(role, profile) — for 'student', profile is the matched
   account record from the accounts store below (unid/name/major/
   joinedAt), so the signed-in identity is always a real, self-registered
   account rather than a hardcoded demo user. The admin side still has no
   accounts of its own (fixed departmental passcode), so its session stays
   fixed. */
function setSession(role, profile){
  var session = (role === 'admin')
    ? { role:'admin', name:'UAC Admin (Dept. Staff)', initial:'A' }
    : {
        role:'student',
        unid:((profile && profile.unid) || ''),
        name:((profile && profile.name) || 'Student'),
        major:((profile && profile.major) || ''),
        major2:((profile && profile.major2) || ''),
        joinedAt:((profile && profile.joinedAt) || null),
        initial:(((profile && profile.name) || 'S').trim().charAt(0) || 'S').toUpperCase()
      };
  try{ localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }catch(e){}
  return session;
}

function clearSession(){
  try{ localStorage.removeItem(SESSION_KEY); }catch(e){}
}

/* ---------------- shared: student accounts (sign-up / sign-in) ----------------
   There's no backend, so every registered student account lives in its
   own localStorage key, keyed by lowercased UNID. login.js uses these for
   sign-up + sign-in; myprofile.js uses them for the admin student roster
   and the student "Change Password" flow. Relies on cpLoadJSON/
   cpSaveJSON from shared/store.js, which every page that loads this file
   also loads. */
var ACCOUNTS_KEY = 'campuspilot.accounts.v1';

function getAccounts(){
  return cpLoadJSON(ACCOUNTS_KEY, {});
}
function saveAccounts(accounts){
  cpSaveJSON(ACCOUNTS_KEY, accounts);
}
function findAccount(unid){
  var accounts = getAccounts();
  return accounts[(unid || '').trim().toLowerCase()] || null;
}
/* major2 is an already-formatted optional label, e.g. "Double Major: Economics"
   or "Minor: Communication" -- built by login.js from the second-major/minor
   fields -- so this just stores it as-is alongside the primary major. */
function createAccount(unid, password, name, major, major2){
  unid = (unid || '').trim().toLowerCase();
  name = (name || '').trim();
  var accounts = getAccounts();
  if(!unid || !password || !name) return { ok:false, error:'Fill in your UNID, name, and password.' };
  if(accounts[unid]) return { ok:false, error:'That UNID is already registered — sign in instead.' };
  accounts[unid] = {
    unid: unid,
    password: password,
    name: name,
    major: (major || '').trim(),
    major2: (major2 || '').trim(),
    joinedAt: Date.now()
  };
  saveAccounts(accounts);
  return { ok:true, account:accounts[unid] };
}
function updateAccountPassword(unid, newPassword){
  var accounts = getAccounts();
  var key = (unid || '').trim().toLowerCase();
  if(!accounts[key]) return false;
  accounts[key].password = newPassword;
  saveAccounts(accounts);
  return true;
}
/* Lets a student set/update their major (and optional double-major/minor
   label) on an account that already exists -- e.g. an older account
   created before the major field existed, or someone who just wants to
   change it. Signing up again with the same UNID can't do this (it's
   blocked as "already registered"), so My Profile's "Edit Major" flow
   calls this directly instead. Returns the updated account, or null if
   the UNID isn't registered. */
function updateAccountMajor(unid, major, major2){
  var accounts = getAccounts();
  var key = (unid || '').trim().toLowerCase();
  if(!accounts[key]) return null;
  accounts[key].major = (major || '').trim();
  accounts[key].major2 = (major2 || '').trim();
  saveAccounts(accounts);
  return accounts[key];
}

/* ---------------- shared: UAC department list ----------------
   Used by both the signup form (login.js) and My Profile's "Edit Major"
   flow, so the two stay in sync and self-registered accounts keep a
   consistent set of department names instead of free-typed variants
   like "biz"/"Business "/"business admin". "Other" always stays last
   and reveals a free-text fallback for anything not listed. */
var UAC_DEPARTMENTS = ['Accounting (BS)', 'Computer Engineering (BS)', 'Communication (BA/BS)',
  'Electrical Engineering (BS)', 'Film & Media Arts (BA)', 'Games (BS)', 'Psychology (BS)',
  'Information Systems (BS)', 'Urban Ecology (BS)'];

function fillDeptSelect(sel, placeholder){
  if(!sel) return;
  var html = '<option value="">' + placeholder + '</option>';
  UAC_DEPARTMENTS.forEach(function(d){ html += '<option value="' + d + '">' + d + '</option>'; });
  html += '<option value="__other__">Other (not listed)</option>';
  sel.innerHTML = html;
}
function listAccounts(){
  var accounts = getAccounts();
  return Object.keys(accounts).map(function(k){ return accounts[k]; }).sort(function(a, b){
    return (a.joinedAt || 0) - (b.joinedAt || 0);
  });
}

/* Redirects to the login page if nobody is signed in; otherwise paints
   the topbar identity (avatar + name + admin badge) and shows/hides
   any [data-role="admin"] / [data-role="student"] elements on the
   page. Returns the session object, or null (and redirects) if there
   isn't one. */
function requireSession(loginHref){
  var session = getSession();
  if(!session){
    window.location.href = loginHref || '../login/index.html';
    return null;
  }
  applySessionUI(session);
  return session;
}

function applySessionUI(session){
  var avatarEl = document.querySelector('.topbar-avatar');
  var nameEl = document.querySelector('.topbar-username');
  if(avatarEl){
    avatarEl.textContent = session.initial;
    avatarEl.classList.toggle('is-admin', session.role === 'admin');
  }
  if(nameEl){
    nameEl.innerHTML = session.name + (session.role === 'admin' ? ' <span class="admin-badge">ADMIN</span>' : '');
  }
  document.body.classList.remove('role-student', 'role-admin');
  document.body.classList.add('role-' + session.role);
  document.querySelectorAll('[data-role="admin"]').forEach(function(el){
    el.classList.toggle('hidden', session.role !== 'admin');
  });
  document.querySelectorAll('[data-role="student"]').forEach(function(el){
    el.classList.toggle('hidden', session.role !== 'student');
  });
  mountFullscreenToggle();
}

/* ---------------- shared: full-screen toggle button (topbar) ----------------
   Injected into .topbar-right on every protected page so the whole app can
   be viewed edge-to-edge (e.g. inside a browser preview) with one click. */
var FS_ICON_EXPAND = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H5a1 1 0 0 0-1 1v4"/><path d="M15 4h4a1 1 0 0 1 1 1v4"/><path d="M9 20H5a1 1 0 0 1-1-1v-4"/><path d="M15 20h4a1 1 0 0 0 1-1v-4"/></svg>';
var FS_ICON_COLLAPSE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V5a1 1 0 0 1 1-1h4"/><path d="M20 9V5a1 1 0 0 0-1-1h-4"/><path d="M4 15v4a1 1 0 0 0 1 1h4"/><path d="M20 15v4a1 1 0 0 1-1 1h-4"/></svg>';

function isFullscreenNow(){
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function updateFullscreenBtn(btn){
  if(!btn) return;
  var on = isFullscreenNow();
  btn.innerHTML = on ? FS_ICON_COLLAPSE : FS_ICON_EXPAND;
  btn.title = on ? 'Exit full screen' : 'View full screen';
  btn.setAttribute('aria-label', btn.title);
}

function toggleFullscreen(){
  try{
    if(isFullscreenNow()){
      if(document.exitFullscreen) document.exitFullscreen().catch(function(){});
      else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else {
      var el = document.documentElement;
      var req = el.requestFullscreen || el.webkitRequestFullscreen;
      if(req) req.call(el).catch(function(){});
    }
  }catch(e){}
}

function mountFullscreenToggle(){
  var bar = document.querySelector('.topbar-right');
  if(!bar || bar.querySelector('.topbar-fullscreen')) return;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'topbar-fullscreen';
  btn.onclick = toggleFullscreen;
  updateFullscreenBtn(btn);
  var logoutEl = bar.querySelector('.topbar-logout');
  if(logoutEl) bar.insertBefore(btn, logoutEl);
  else bar.appendChild(btn);
  document.addEventListener('fullscreenchange', function(){ updateFullscreenBtn(btn); });
  document.addEventListener('webkitfullscreenchange', function(){ updateFullscreenBtn(btn); });
}

function logout(){
  clearSession();
  window.location.href = '../login/index.html';
}
