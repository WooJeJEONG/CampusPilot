/* Campuspilot — MY PROFILE page logic: account card, notification
   toggles (persisted — see shared/store.js), and an admin-only
   platform-overview card whose counts read real data from the Lost &
   Found / Campus Jobs localStorage, plus an admin-only registered-
   student roster (reads the shared accounts store from shared/
   session.js). shared/toast.js, shared/nav.js and shared/session.js are
   already loaded before this file. */
var isAdmin = false;
var MP_SETTINGS_KEY = 'campuspilot.settings.v1';
var mpToggles = cpLoadJSON(MP_SETTINGS_KEY, { toggleEmail:true, toggleReminders:true, toggleLF:false, toggleJobs:true });
/* paint the persisted toggle state onto the switches on load */
Object.keys(mpToggles).forEach(function(id){
  var el = document.getElementById(id);
  if(el) el.className = 'switch' + (mpToggles[id] ? ' on' : '');
});

function mpToggle(id, label){
  mpToggles[id] = !mpToggles[id];
  document.getElementById(id).className = 'switch' + (mpToggles[id] ? ' on' : '');
  cpSaveJSON(MP_SETTINGS_KEY, mpToggles);
  showToast((mpToggles[id] ? 'Turned on: ' : 'Turned off: ') + label.replace(/&amp;/g,'&'));
}

function mpEsc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

function mpFormatJoined(ts){
  if(!ts) return '—';
  var d = new Date(ts);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

/* ---------------- My RSVPs card (student only) ----------------
   Reads the exact same shared, per-student RSVP store Calendar and Home
   both read/write (campuspilot.calendar.myrsvps.v1, keyed by SESSION.
   unid), cross-referenced against Calendar's shared campus-events store,
   so this card can never disagree with what Calendar or Home show. */
var MP_CAL_STORE_KEY = 'campuspilot.calendar.events.v2';
var MP_RSVP_KEY = 'campuspilot.calendar.myrsvps.v1';
var MP_CAT_LABELS = { official:'Campus Event', career:'Career Event', food:'Free Food Event', deadline:'Deadline' };
var MP_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function mpLoadRsvpIds(){
  if(!SESSION || !SESSION.unid) return [];
  try {
    var all = JSON.parse(localStorage.getItem(MP_RSVP_KEY)) || {};
    return all[SESSION.unid] || [];
  } catch(e){ return []; }
}
function mpLoadCampusEvents(){
  try { return JSON.parse(localStorage.getItem(MP_CAL_STORE_KEY)) || []; } catch(e){ return []; }
}
function mpRenderRsvps(){
  var host = document.getElementById('mpRsvpList');
  if(!host) return;
  var ids = mpLoadRsvpIds();
  var events = mpLoadCampusEvents();
  var matched = events.filter(function(e){ return ids.indexOf(e.id) !== -1; });
  matched.sort(function(a, b){
    return new Date(a.year, a.month - 1, a.date) - new Date(b.year, b.month - 1, b.date);
  });
  if(!matched.length){
    host.innerHTML = '<div class="muted" style="font-size:13px;padding:4px 0;">You haven’t RSVP’d to any events yet. RSVP from the Calendar page and they’ll show up here.</div>';
    return;
  }
  host.innerHTML = matched.map(function(e){
    var when = (MP_MONTH_NAMES[e.month - 1] || '').slice(0, 3) + ' ' + e.date + (e.time ? ' · ' + mpEsc(e.time) : '');
    var label = MP_CAT_LABELS[e.cat] || 'Event';
    return '<div class="rsvp-item"><div class="rsvp-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 4v4M16 4v4M4 10h16"/></svg></div>' +
      '<div><div class="rsvp-title">' + mpEsc(e.title) + '</div><div class="rsvp-sub">' + when + (e.location ? ' · ' + mpEsc(e.location) : '') + '</div></div>' +
      '<div class="rsvp-tag">' + label + '</div></div>';
  }).join('');
}

function mpRenderAdminStats(){
  var lf = cpLoadJSON('campuspilot.lostfound.v1', null);
  var lfPending = (lf && lf.items) ? lf.items.filter(function(it){ return it.status === 'pending'; }).length : 0;
  var jobs = cpLoadJSON('campuspilot.campusjobs.v1', []) || [];
  var jobsOpen = jobs.filter(function(j){ return j.status === 'open'; }).length;
  document.getElementById('mpStatLF').textContent = lfPending;
  document.getElementById('mpStatJobs').textContent = jobsOpen;
  document.getElementById('mpAttnLF').textContent = lfPending
    ? (lfPending + ' open Lost & Found report' + (lfPending === 1 ? '' : 's') + ' awaiting pickup')
    : 'No open Lost & Found reports right now';
  document.getElementById('mpAttnJobs').textContent = jobsOpen
    ? (jobsOpen + ' open job listing' + (jobsOpen === 1 ? '' : 's') + ' posted')
    : 'No Campus Jobs listings posted yet';
}

/* Admin-only: table of every self-registered student account, searchable
   by UNID or name. Reads the same accounts store (campuspilot.accounts.v1)
   that login.js writes to on sign-up — there's no separate admin-side
   copy, so a new sign-up shows up here immediately. */
function mpRenderStudentRoster(){
  var searchEl = document.getElementById('studentSearch');
  var q = (searchEl ? searchEl.value : '').toLowerCase().trim();
  var accounts = listAccounts();
  var filtered = accounts.filter(function(a){
    return !q || (a.unid + ' ' + a.name).toLowerCase().indexOf(q) !== -1;
  });

  document.getElementById('studentRosterCount').textContent =
    accounts.length === 0
      ? 'No students have registered yet'
      : filtered.length + ' of ' + accounts.length + ' registered student' + (accounts.length === 1 ? '' : 's');

  document.getElementById('studentRosterBody').innerHTML = filtered.map(function(a){
    return '<tr>' +
      '<td>' + mpEsc(a.unid) + '</td>' +
      '<td>' + mpEsc(a.name) + '</td>' +
      '<td>' + mpEsc(a.major || '—') + '</td>' +
      '<td>' + mpFormatJoined(a.joinedAt) + '</td>' +
    '</tr>';
  }).join('');

  document.querySelector('#adminStudentPanel .roster-wrap').classList.toggle('hidden', filtered.length === 0);
  document.getElementById('studentRosterEmpty').style.display = filtered.length === 0 ? 'block' : 'none';
}

/* Student: changes the password on their own registered account (prompt-
   based, consistent with this prototype's other lightweight dialogs).
   Admin: there's no admin account to change — the passcode is fixed and
   managed by IT, so this just explains that instead. */
function mpChangePassword(){
  if(isAdmin){
    showToast('Admin passcodes are managed by UAC IT directly.');
    return;
  }
  if(!SESSION || !SESSION.unid){
    showToast("Couldn't find your account — try signing in again.");
    return;
  }
  var current = window.prompt('Enter your current password:');
  if(current === null) return;
  var account = findAccount(SESSION.unid);
  if(!account || account.password !== current){
    showToast('Current password is incorrect.');
    return;
  }
  var next = window.prompt('Enter your new password (at least 6 characters):');
  if(next === null) return;
  if(next.length < 6){
    showToast('New password must be at least 6 characters.');
    return;
  }
  var confirmNext = window.prompt('Re-enter your new password:');
  if(confirmNext === null) return;
  if(next !== confirmNext){
    showToast('New passwords did not match.');
    return;
  }
  updateAccountPassword(SESSION.unid, next);
  showToast('Password updated.');
}

function mpApplyAdmin(){
  var s = (typeof SESSION !== 'undefined' && SESSION) ? SESSION : {};

  document.getElementById('profileAvatar').textContent = isAdmin ? 'A' : (s.initial || 'S');
  document.getElementById('profileAvatar').className = 'profile-avatar' + (isAdmin ? ' is-admin' : '');
  document.getElementById('profileName').textContent = isAdmin ? 'UAC Admin (Department Admin)' : (s.name || 'Student');
  document.getElementById('profileMeta').textContent = 'University of Utah Asia Campus (UAC), Songdo';
  document.getElementById('kvUnid').textContent = isAdmin ? '—' : (s.unid || '—');
  document.getElementById('kvEmail').textContent = isAdmin ? '—' : (s.unid ? (s.unid + '@umail.utah.edu') : '—');
  document.getElementById('kvJoined').textContent = isAdmin ? '—' : mpFormatJoined(s.joinedAt);
  /* "Status" used to just say "Active Student" for every single student,
     which told nobody anything -- the major (+ optional double-major/
     minor) is the useful thing to show here instead. Admin has no major,
     so it keeps a department line of its own. */
  document.getElementById('kvMajorValue').textContent = isAdmin
    ? 'UAC IT & Student Affairs'
    : (s.major || 'Major not set yet') + (s.major2 ? ' · ' + s.major2 : '');
  document.getElementById('kvMajorEditBtn').classList.toggle('hidden', isAdmin);
  document.getElementById('signinMethodValue').textContent = isAdmin ? 'Departmental Passcode' : 'Campuspilot Account (self-registered)';
  document.getElementById('fhSub').textContent = isAdmin
    ? 'Manage your account, plus a quick overview of what needs platform attention'
    : 'Manage your account, saved events, and notification preferences';

  document.getElementById('adminPanel').classList.toggle('hidden', !isAdmin);
  document.getElementById('adminStudentPanel').classList.toggle('hidden', !isAdmin);
  if(isAdmin){
    mpRenderAdminStats();
    mpRenderStudentRoster();
  } else {
    mpRenderRsvps();
  }
}

/* ---------------- Edit Major modal (student only) ----------------
   Lets a student set or change their major/minor at any time, not just
   at signup -- important for any account that was created before the
   major field existed (it just has an empty major), and for anyone who
   simply wants to change it. Reuses the exact same UAC_DEPARTMENTS /
   fillDeptSelect helpers login.js's signup form uses, from shared/
   session.js, so the two stay consistent. */
function mpOpenEditMajor(){
  if(isAdmin || !SESSION || !SESSION.unid) return;
  fillDeptSelect(document.getElementById('mp-major-select'), 'Select your major…');
  fillDeptSelect(document.getElementById('mp-minor-select'), 'Select a department…');

  var majorSel = document.getElementById('mp-major-select');
  var major = SESSION.major || '';
  if(major && UAC_DEPARTMENTS.indexOf(major) === -1){
    majorSel.value = '__other__';
    document.getElementById('mp-major-other-wrap').classList.remove('hidden');
    document.getElementById('mp-major-other').value = major;
  } else {
    majorSel.value = major;
    document.getElementById('mp-major-other-wrap').classList.add('hidden');
    document.getElementById('mp-major-other').value = '';
  }

  var major2 = SESSION.major2 || '';
  var minorBox = document.getElementById('mp-minor-fields');
  var minorToggleRow = document.getElementById('mp-minor-toggle-row');
  if(major2){
    minorBox.classList.remove('hidden');
    minorToggleRow.classList.add('hidden');
    var isMinor = major2.indexOf('Minor:') === 0;
    document.querySelector('input[name="mp-minor-type"][value="' + (isMinor ? 'minor' : 'double') + '"]').checked = true;
    var dept = major2.replace(/^(Minor|Double Major):\s*/, '');
    var minorSel = document.getElementById('mp-minor-select');
    if(UAC_DEPARTMENTS.indexOf(dept) === -1){
      minorSel.value = '__other__';
      document.getElementById('mp-minor-other-wrap').classList.remove('hidden');
      document.getElementById('mp-minor-other').value = dept;
    } else {
      minorSel.value = dept;
      document.getElementById('mp-minor-other-wrap').classList.add('hidden');
    }
  } else {
    minorBox.classList.add('hidden');
    minorToggleRow.classList.remove('hidden');
    document.getElementById('mp-minor-select').value = '';
    document.getElementById('mp-minor-other-wrap').classList.add('hidden');
    document.getElementById('mp-minor-other').value = '';
  }

  document.getElementById('mp-edit-major-modal').classList.remove('hidden');
}
function mpCloseEditMajor(){
  document.getElementById('mp-edit-major-modal').classList.add('hidden');
}
function mpToggleMinorFields(){
  var box = document.getElementById('mp-minor-fields');
  var row = document.getElementById('mp-minor-toggle-row');
  var opening = box.classList.contains('hidden');
  box.classList.toggle('hidden', !opening);
  row.classList.toggle('hidden', opening);
  if(opening){
    document.getElementById('mp-minor-select').value = '';
    document.getElementById('mp-minor-other-wrap').classList.add('hidden');
    document.getElementById('mp-minor-other').value = '';
  }
}
function mpRefreshMajorOtherVisibility(){
  var sel = document.getElementById('mp-major-select');
  document.getElementById('mp-major-other-wrap').classList.toggle('hidden', sel.value !== '__other__');
}
function mpRefreshMinorOtherVisibility(){
  var sel = document.getElementById('mp-minor-select');
  document.getElementById('mp-minor-other-wrap').classList.toggle('hidden', sel.value !== '__other__');
}
function mpResolveMajor(){
  var sel = document.getElementById('mp-major-select').value;
  if(sel === '__other__') return (document.getElementById('mp-major-other').value || '').trim();
  return sel;
}
function mpResolveMajor2(){
  var box = document.getElementById('mp-minor-fields');
  if(box.classList.contains('hidden')) return '';
  var typeEl = document.querySelector('input[name="mp-minor-type"]:checked');
  var type = typeEl ? typeEl.value : 'double';
  var sel = document.getElementById('mp-minor-select').value;
  var dept = (sel === '__other__') ? (document.getElementById('mp-minor-other').value || '').trim() : sel;
  if(!dept) return '';
  return (type === 'minor' ? 'Minor: ' : 'Double Major: ') + dept;
}
function mpSaveEditMajor(){
  var major = mpResolveMajor();
  if(!major){
    showToast('Select your major (or choose "Other" and type it in).');
    return;
  }
  var major2 = mpResolveMajor2();
  var updated = updateAccountMajor(SESSION.unid, major, major2);
  if(!updated){
    showToast("Couldn't find your account — try signing in again.");
    return;
  }
  SESSION = setSession('student', updated);
  mpCloseEditMajor();
  mpApplyAdmin();
  showToast('Major updated.');
}
