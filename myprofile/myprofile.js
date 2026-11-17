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
  document.getElementById('profileMeta').innerHTML = isAdmin
    ? 'UAC IT &amp; Student Affairs<br>University of Utah Asia Campus (UAC), Songdo'
    : mpEsc(s.major || 'Major not set yet') + '<br>University of Utah Asia Campus (UAC), Songdo';
  document.getElementById('kvUnid').textContent = isAdmin ? '—' : (s.unid || '—');
  document.getElementById('kvEmail').textContent = isAdmin ? '—' : (s.unid ? (s.unid + '@umail.utah.edu') : '—');
  document.getElementById('kvJoined').textContent = isAdmin ? '—' : mpFormatJoined(s.joinedAt);
  document.getElementById('statusValue').textContent = isAdmin ? 'Department Staff — UAC IT Authorized' : 'Active Student';
  document.getElementById('signinMethodValue').textContent = isAdmin ? 'Departmental Passcode' : 'Campuspilot Account (self-registered)';
  document.getElementById('fhSub').textContent = isAdmin
    ? 'Manage your account, plus a quick overview of what needs platform attention'
    : 'Manage your account, saved events, and notification preferences';

  document.getElementById('adminPanel').classList.toggle('hidden', !isAdmin);
  document.getElementById('adminStudentPanel').classList.toggle('hidden', !isAdmin);
  if(isAdmin){
    mpRenderAdminStats();
    mpRenderStudentRoster();
  }
}
