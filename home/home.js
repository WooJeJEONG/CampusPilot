/* Campuspilot — HOME page logic.
   Greets the signed-in student by name, keeps "today" synced to the real
   current date (never a fixed demo date), and surfaces what's actually
   happening today in the right-panel "Today's Schedule" box: official /
   career / food / deadline events from Calendar (gray until this student
   has confirmed the RSVP, red once they have -- reusing the exact same
   per-account RSVP store Calendar itself writes to, so the two pages
   never disagree) plus this student's own Personal Schedule entries
   (green), filtered to just today. shared/session.js (SESSION),
   shared/toast.js, shared/nav.js and shared/modal.js are already loaded
   before this file. */

var HOME_TODAY = (function(){
  var d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, date: d.getDate() };
})();

var HOME_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function homeMonthName(m){ return HOME_MONTH_NAMES[m-1] || ''; }
function homeDaysInMonth(y, m){ return new Date(y, m, 0).getDate(); }
function homeFirstWeekday(y, m){ return new Date(y, m-1, 1).getDay(); }
function homeEsc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

/* Reads the exact same shared stores Calendar reads/writes -- Home never
   owns or re-seeds this data, it just reflects whatever Calendar has (an
   empty/missing store just means nothing to show yet, e.g. if this
   browser has never opened the Calendar page). */
var HOME_CAL_STORE_KEY = 'campuspilot.calendar.events.v2';
var HOME_PERSONAL_KEY = 'campuspilot.calendar.personal.v1';
var HOME_RSVP_KEY = 'campuspilot.calendar.myrsvps.v1';

function homePersonalKey(){
  return (typeof SESSION !== 'undefined' && SESSION && SESSION.role === 'student' && SESSION.unid) ? SESSION.unid : null;
}
function homeIsToday(e){
  return e.year === HOME_TODAY.year && e.month === HOME_TODAY.month && e.date === HOME_TODAY.date;
}
function homeLoadCampusEventsToday(){
  try {
    var raw = JSON.parse(localStorage.getItem(HOME_CAL_STORE_KEY)) || [];
    return raw.filter(homeIsToday);
  } catch(e){ return []; }
}
function homeLoadPersonalToday(){
  var key = homePersonalKey();
  if(!key) return [];
  try {
    var all = JSON.parse(localStorage.getItem(HOME_PERSONAL_KEY)) || {};
    return (all[key] || []).filter(homeIsToday);
  } catch(e){ return []; }
}
function homeLoadRsvpIds(){
  var key = homePersonalKey();
  if(!key) return [];
  try {
    var all = JSON.parse(localStorage.getItem(HOME_RSVP_KEY)) || {};
    return all[key] || [];
  } catch(e){ return []; }
}
function homeIsAdmin(){ return typeof SESSION !== 'undefined' && SESSION && SESSION.role === 'admin'; }
function homeIsRsvpd(eventId){
  return !!eventId && homeLoadRsvpIds().indexOf(eventId) !== -1;
}
/* Writes to the exact same shared per-student RSVP store Calendar owns
   (HOME_RSVP_KEY === CAL_RSVP_KEY), so confirming an RSVP from Home's
   today-panel modal and from Calendar's modal are the same action and
   can never disagree. */
function homeSetRsvpd(eventId, done){
  var key = homePersonalKey();
  if(!key || !eventId) return;
  var all = {};
  try { all = JSON.parse(localStorage.getItem(HOME_RSVP_KEY)) || {}; } catch(e){}
  var ids = all[key] || [];
  var idx = ids.indexOf(eventId);
  if(done && idx === -1) ids.push(eventId);
  if(!done && idx !== -1) ids.splice(idx, 1);
  all[key] = ids;
  try { localStorage.setItem(HOME_RSVP_KEY, JSON.stringify(all)); } catch(e){}
}

function homeRenderGreeting(){
  var el = document.getElementById('homeGreeting');
  if(!el) return;
  var session = (typeof SESSION !== 'undefined') ? SESSION : null;
  var first = (session && session.name) ? session.name.trim().split(' ')[0] : (session && session.role === 'admin' ? 'Admin' : 'there');
  el.textContent = 'Hi, ' + first + ' 👋';
}

/* Mini month-at-a-glance grid -- always the REAL current month, with
   today's real date highlighted (never a fixed September 2026 demo
   date). Leading cells from the tail of the previous month are shown
   dimmed, same as Calendar's own month grid, but this box only needs
   enough rows to reach today, not the whole month. */
function homeRenderMiniCal(){
  var titleEl = document.getElementById('miniCalTitle');
  if(titleEl) titleEl.textContent = homeMonthName(HOME_TODAY.month) + ' ' + HOME_TODAY.year;
  var grid = document.getElementById('miniCalGrid');
  if(!grid) return;

  var daysInMonth = homeDaysInMonth(HOME_TODAY.year, HOME_TODAY.month);
  var firstDow = homeFirstWeekday(HOME_TODAY.year, HOME_TODAY.month);
  var prevMonth = HOME_TODAY.month === 1 ? 12 : HOME_TODAY.month - 1;
  var prevYear = HOME_TODAY.month === 1 ? HOME_TODAY.year - 1 : HOME_TODAY.year;
  var daysInPrevMonth = homeDaysInMonth(prevYear, prevMonth);

  var cellsNeeded = firstDow + HOME_TODAY.date; // through today, rounded up to a full week below
  var rowsNeeded = Math.ceil(cellsNeeded / 7);
  var totalCells = rowsNeeded * 7;

  var html = '<div class="dow sun">S</div><div class="dow">M</div><div class="dow">T</div><div class="dow">W</div><div class="dow">T</div><div class="dow">F</div><div class="dow">S</div>';
  for(var i = 0; i < totalCells; i++){
    var dayNum = i - firstDow + 1;
    if(dayNum < 1){
      html += '<div class="mini-day dim">' + (daysInPrevMonth + dayNum) + '</div>';
    } else if(dayNum > daysInMonth){
      html += '<div class="mini-day dim">' + (dayNum - daysInMonth) + '</div>';
    } else {
      html += '<div class="mini-day' + (dayNum === HOME_TODAY.date ? ' today' : '') + '">' + dayNum + '</div>';
    }
  }
  grid.innerHTML = html;
}

/* "Today's Schedule & RSVPs" box in the right panel: every official /
   career / food / deadline event dated today (gray; red once this
   student has confirmed the RSVP -- an event with no rsvpLink at all is
   never RSVP-gated, so it always renders gray) plus this student's own
   Personal Schedule entries for today (green), clickable into the exact
   same shared event-detail modal Calendar uses. */
function homeRenderTodayPanel(){
  var dateEl = document.getElementById('rpTodayDate');
  if(dateEl) dateEl.textContent = (homeMonthName(HOME_TODAY.month).slice(0,3) + ' ' + HOME_TODAY.date).toUpperCase();

  var rsvpIds = homeLoadRsvpIds();
  var campusToday = homeLoadCampusEventsToday();
  var personalToday = homeLoadPersonalToday();
  var list = document.getElementById('rpTodayList');
  if(!list) return;

  if(!campusToday.length && !personalToday.length){
    list.innerHTML = '<div class="muted" style="font-size:12.5px;padding:6px 2px;">Nothing scheduled for today. Official events and your RSVPs will show up here.</div>';
    return;
  }

  var rows = [];
  personalToday.forEach(function(e){
    rows.push(
      '<div class="rp-today-row personal"><span class="rp-today-dot"></span>' +
      '<span class="rp-today-title">[Personal] ' + homeEsc(e.title) + '</span>' +
      (e.time ? '<span class="rp-today-time">' + homeEsc(e.time) + '</span>' : '') +
      '</div>'
    );
  });
  campusToday.forEach(function(e){
    var rsvpd = !!(e.rsvpLink && rsvpIds.indexOf(e.id) !== -1);
    var cls = rsvpd ? 'confirmed' : 'pending';
    var tag = e.rsvpLink ? (rsvpd ? 'RSVP’d' : 'RSVP open') : '';
    var key = (typeof registerEventDetailHome === 'function') ? registerEventDetailHome(e) : null;
    var clickAttr = key ? ' onclick="homeOpenModal(\'' + key + '\')" role="button" tabindex="0"' : '';
    rows.push(
      '<div class="rp-today-row ' + cls + (key ? ' clickable' : '') + '"' + clickAttr + '><span class="rp-today-dot"></span>' +
      '<span class="rp-today-title">' + homeEsc(e.title) + (e.location ? ' — ' + homeEsc(e.location) : '') + '</span>' +
      (e.time ? '<span class="rp-today-time">' + homeEsc(e.time) + '</span>' : '') +
      (tag ? '<span class="rp-today-tag ' + cls + '">' + tag + '</span>' : '') +
      '</div>'
    );
  });
  list.innerHTML = rows.join('');
}

/* Registers a today's-event into the shared EVENTS_DETAIL map (see
   shared/modal.js) so clicking it opens the exact same event-detail
   modal Calendar uses, badge color included. */
var HOME_CAT_META = {
  official: {color:'granite', label:'Campus Event'},
  career:   {color:'teal',    label:'Career Event'},
  food:     {color:'gold',    label:'Free Food Event'},
  deadline: {color:'red',     label:'Deadline'}
};
var homeChipCounter = 0;
function registerEventDetailHome(e){
  if(typeof EVENTS_DETAIL === 'undefined') return null;
  var key = 'home-evt-' + (homeChipCounter++);
  var meta = HOME_CAT_META[e.cat] || HOME_CAT_META.official;
  var when = homeMonthName(e.month) + ' ' + e.date + ', ' + e.year + (e.time ? ' · ' + e.time : '');
  EVENTS_DETAIL[key] = {
    badge: e.org || meta.label,
    title: e.title,
    badgeClass: meta.color,
    poster: e.poster || null,
    eventId: e.id,
    rsvpLink: e.rsvpLink || null,
    rows: [
      {color: meta.color, icon:'calendar', label:'Date/Time', value: when},
      {color:'granite', icon:'pin', label:'Location', value: e.location || '—'},
      {color:'granite', icon:'people', label:'Host', value: e.org || '—'},
      {color:'granite', icon:'mail', label:'Contact', value: e.contact || '—'},
      {color:'gold', icon:'food', label:'Perks', value: e.perks || '—'}
    ]
  };
  return key;
}

var HOME_POSTER_PLACEHOLDER = '<svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#8B93A0" stroke-width="1.3"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 4v4M16 4v4M4 10h16"/><path d="M8 14h2M8 17h2M14 14h2M14 17h2"/></svg>';
/* Mirrors Calendar's openCalModal(): sets the modal badge color, and
   shows/hides the RSVP link + confirmation checkbox + note exactly the
   same way (checkbox hidden for admin, link always shown; checking the
   box is what writes into the shared My RSVPs store). */
function homeOpenModal(key){
  var det = EVENTS_DETAIL[key];
  openModal(key);
  if(!det) return;
  var b = document.getElementById('modal-badge');
  if(b) b.className = 'badge ' + (det.badgeClass || 'red');
  var rsvpSection = document.getElementById('modal-rsvp-section');
  var rsvpLinkEl = document.getElementById('modal-rsvp-link');
  var rsvpDoneWrap = document.getElementById('modal-rsvp-done-wrap');
  var rsvpDoneBox = document.getElementById('modal-rsvp-done');
  var rsvpNote = document.getElementById('modal-rsvp-note');
  if(rsvpSection){
    if(det.rsvpLink){
      rsvpSection.style.display = '';
      if(rsvpLinkEl) rsvpLinkEl.href = det.rsvpLink;
      var admin = homeIsAdmin();
      if(rsvpDoneWrap) rsvpDoneWrap.classList.toggle('hidden', admin);
      if(rsvpNote) rsvpNote.textContent = admin
        ? 'Students see a confirmation checkbox here once they open the form.'
        : "Checking the box above is what adds this to your My RSVPs — opening the form alone doesn't.";
      if(!admin && rsvpDoneBox){
        rsvpDoneBox.checked = homeIsRsvpd(det.eventId);
        rsvpDoneBox.onchange = function(){
          homeSetRsvpd(det.eventId, this.checked);
          homeRenderTodayPanel();
        };
      }
    } else {
      rsvpSection.style.display = 'none';
    }
  }
  var posterEl = document.getElementById('modal-poster');
  if(posterEl){
    posterEl.innerHTML = det.poster ? '<img src="' + det.poster + '" alt="Event poster">' : HOME_POSTER_PLACEHOLDER;
  }
}

function homeInit(){
  homeRenderGreeting();
  homeRenderMiniCal();
  homeRenderTodayPanel();
}
