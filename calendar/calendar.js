/* Campuspilot — CALENDAR page logic (month/year navigation, campus +
   personal events, filters, add-schedule modal, event-detail modal). */

var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function monthName(m){ return MONTH_NAMES[m-1]; }
function pad2(n){ return n < 10 ? '0'+n : ''+n; }
function daysInMonth(y,m){ return new Date(y, m, 0).getDate(); }
function firstWeekday(y,m){ return new Date(y, m-1, 1).getDay(); }

/* "Today" always tracks the real, current date -- not a fixed demo
   date -- so it keeps changing day to day on its own. (The September
   2026 seed events below are last year's/last semester's history from
   "today"'s point of view; they stay browsable by navigating the
   month picker back to September, same as any other past month.) */
var TODAY = (function(){
  var d = new Date();
  return {year: d.getFullYear(), month: d.getMonth() + 1, date: d.getDate()};
})();

/* Campus events are admin-managed data, registered through the same
   "+ Add Schedule" modal on this page (see openAddModal/addSchedule
   below -- it behaves differently for an admin session), persisted
   under CAL_STORE_KEY so they show up to every student immediately.
   CAMPUS_EVENTS_SEED is only the one-time starting content the store
   is initialized with on first load.

   Category (cat) is one of 'official' / 'career' / 'food' / 'deadline'
   -- what KIND of event it is. RSVP is a separate, orthogonal concern:
   any category can optionally carry an rsvpLink (the admin's Google
   Form / Microsoft Forms / etc. URL for that event); its mere presence
   is what turns on the RSVP button for students, rather than a
   dedicated "RSVP-required" category of its own. Bumped to .v2 since
   older saved events used a different shape (a 'rsvp' category plus a
   separate 'career' checkbox flag). */
var CAL_STORE_KEY = 'campuspilot.calendar.events.v2';
var CAMPUS_EVENTS_SEED = [
  {id:'seed-1',  year:2026, month:9, date:1,  cat:'official', title:'Fall Convocation', time:'10am', location:'Grand Hall, UAC Main Building', org:'Office of the Dean', contact:'dean-office@utah.edu'},
  {id:'seed-2',  year:2026, month:9, date:2,  cat:'official', title:'UAC Fall Club Fair', time:'11am–2pm', location:'Central Plaza', org:'University Activities Council', contact:'uac@utah.edu', perks:'Free club swag & giveaways'},
  {id:'seed-3',  year:2026, month:9, date:4,  cat:'official', title:'Global Leader Forum', time:'4pm', location:'Auditorium A', org:'Office of International Affairs', contact:'oia@utah.edu'},
  {id:'seed-4',  year:2026, month:9, date:5,  cat:'official', title:'IS Welcome Social', time:'6pm', location:'IS Lounge, 3F', org:'Information Systems Dept.', contact:'is-dept@utah.edu', perks:'Light refreshments provided'},
  {id:'seed-5',  year:2026, month:9, date:10, cat:'career', title:'Resume Clinic', time:'1–4pm', location:'Career Center, Rm 210', org:'Career Services', contact:'career-uac@utah.edu'},
  {id:'seed-6',  year:2026, month:9, date:11, cat:'career', title:'Career Fair Pre-Reg', time:'2pm', location:'Student Center Gym', locAbbr:'Gym', org:'Career Services', contact:'career-uac@utah.edu', perks:'Free resume review & coffee bar', rsvpLink:'https://forms.office.com/r/CampusPilotCareerFairPreReg'},
  {id:'seed-7',  year:2026, month:9, date:11, cat:'career', title:'Alumni Career Talk', time:'2pm', location:'Rm 310', org:'Alumni Association', contact:'alumni@utah.edu'},
  {id:'seed-8',  year:2026, month:9, date:17, cat:'food', title:'Midterm Pizza Social', time:'12:30pm', location:'1F Student Lounge', perks:'Free pizza & drinks — while supplies last'},
  {id:'seed-9',  year:2026, month:9, date:18, cat:'career', title:'Tech Career Night', time:'5–7:30pm', location:'U821 Grand Auditorium (UAC Building 8F)', locAbbr:'U821', org:'UAC IS Student Council & Career Center', contact:'career-uac@utah.edu', perks:'Pizza catering & official UAC tech sticker pack', rsvpLink:'https://forms.gle/CampusPilotTechCareerNight'},
  {id:'seed-10', year:2026, month:9, date:18, cat:'career', title:'Alumni Networking', time:'7:30–8:30pm', location:'Grand Hall Lobby', org:'Alumni Association', contact:'alumni@utah.edu'},
  {id:'seed-11', year:2026, month:9, date:23, cat:'career', title:'Startup Pitch Day', time:'1–4pm', location:'Innovation Hub', org:'Entrepreneurship Center', contact:'entrepreneurship@utah.edu', perks:'Pitch prizes & networking reception'},
  {id:'seed-12', year:2026, month:9, date:25, cat:'official', title:'SLC Exchange Briefing', time:'3pm', location:'Rm 118', org:'Office of International Affairs', contact:'oia@utah.edu'},
  {id:'seed-13', year:2026, month:9, date:26, cat:'food', title:'Coffee & Krispy Kreme', time:'10am', location:'5F Career Center'},
  /* this month's own live examples, so the calendar isn't empty just
     because "today" has moved on from the September seed data above */
  {id:'seed-14', year:TODAY.year, month:TODAY.month, date: Math.min(20, daysInMonth(TODAY.year, TODAY.month)), cat:'career', title:'Fall Career Fair', time:'1–4pm', location:'Student Center Gym', locAbbr:'Gym', org:'Career Services', contact:'career-uac@utah.edu', perks:'Free resume review & coffee bar', rsvpLink:'https://forms.office.com/r/CampusPilotFallCareerFair'},
  {id:'seed-15', year:TODAY.year, month:TODAY.month, date: Math.min(20, daysInMonth(TODAY.year, TODAY.month)), cat:'food', title:'Free Pizza Friday', time:'12pm', location:'1F Student Lounge', perks:'Free pizza & drinks — while supplies last'},
  {id:'seed-16', year:TODAY.year, month:TODAY.month, date: Math.min(23, daysInMonth(TODAY.year, TODAY.month)), cat:'deadline', title:'Course Withdrawal Deadline', location:"Registrar's Office (online portal)", org:'Office of the Registrar', contact:'registrar@utah.edu'}
];
function calLoadEvents(){
  try {
    var raw = localStorage.getItem(CAL_STORE_KEY);
    if(raw) return JSON.parse(raw);
  } catch(e){}
  try { localStorage.setItem(CAL_STORE_KEY, JSON.stringify(CAMPUS_EVENTS_SEED)); } catch(e){}
  return CAMPUS_EVENTS_SEED.slice();
}
var CAMPUS_EVENTS = calLoadEvents();
/* Pick up a change made from another tab/page immediately. */
window.addEventListener('storage', function(e){
  if(e.key === CAL_STORE_KEY){ CAMPUS_EVENTS = calLoadEvents(); renderCalendar(); }
});
/* Personal Schedule is each student's own private calendar, not a
   shared campus list -- so it's keyed by the signed-in account's unid
   and loaded/saved only for that one account (never for admin: see
   calPersonalKey, and the [data-role="student"] Personal Schedule
   toggle in index.html that keeps the feature out of the admin view
   entirely). calLoadPersonal() is called once SESSION exists (from the
   inline script at the bottom of index.html, after requireSession()),
   since this file itself loads before that. */
var CAL_PERSONAL_KEY = 'campuspilot.calendar.personal.v1';
var CAL_PERSONAL_SEED = [
  {year:2026, month:9, date:3,  title:'CS 3500 Study Group', time:''},
  {year:2026, month:9, date:15, title:'Library Study Session', time:''}
];
var personalEvents = []; /* {year,month,date,title,time}; populated per-account by calLoadPersonal() */
function calPersonalKey(){
  return (typeof SESSION !== 'undefined' && SESSION && SESSION.role === 'student' && SESSION.unid) ? SESSION.unid : null;
}
function calLoadPersonal(){
  var key = calPersonalKey();
  if(!key){ personalEvents = []; return; }
  var all = {};
  try { all = JSON.parse(localStorage.getItem(CAL_PERSONAL_KEY)) || {}; } catch(e){}
  if(!(key in all) || !Array.isArray(all[key])){
    /* first time this account opens Calendar (or its stored record got
       corrupted/was left over from an older data shape): seed it with
       the demo's own two examples, same as before -- just scoped to
       this one account now instead of shared globally with everyone.
       The Array.isArray guard matters: without it, a non-array leftover
       value here gets assigned straight into personalEvents below, and
       the next personalEvents.filter()/.forEach() call throws -- which
       silently aborts the rest of the page's init script (including
       mountNavRail()), leaving the left nav rail empty. */
    all[key] = CAL_PERSONAL_SEED.slice();
    try { localStorage.setItem(CAL_PERSONAL_KEY, JSON.stringify(all)); } catch(e){}
  }
  personalEvents = all[key];
}
function calSavePersonal(){
  var key = calPersonalKey();
  if(!key) return;
  var all = {};
  try { all = JSON.parse(localStorage.getItem(CAL_PERSONAL_KEY)) || {}; } catch(e){}
  all[key] = personalEvents;
  try { localStorage.setItem(CAL_PERSONAL_KEY, JSON.stringify(all)); } catch(e){}
}

/* My RSVPs: which RSVP-able events (an event is RSVP-able simply by
   having an rsvpLink) THIS student has actually confirmed they
   submitted the form for -- same per-account scoping as Personal
   Schedule above (never shared between students, never shown to
   admin), but tracked as a list of event ids rather than full event
   records, since the event itself still lives in the one shared
   CAMPUS_EVENTS list. Clicking "Open RSVP Form" does NOT add an event
   here by itself -- only checking "I've submitted the form" in the
   event-detail modal does (see openCalModal). */
var CAL_RSVP_KEY = 'campuspilot.calendar.myrsvps.v1';
var myRsvpIds = [];
function calLoadMyRsvps(){
  var key = calPersonalKey();
  if(!key){ myRsvpIds = []; return; }
  var all = {};
  try { all = JSON.parse(localStorage.getItem(CAL_RSVP_KEY)) || {}; } catch(e){}
  myRsvpIds = Array.isArray(all[key]) ? all[key] : [];
}
function calSaveMyRsvps(){
  var key = calPersonalKey();
  if(!key) return;
  var all = {};
  try { all = JSON.parse(localStorage.getItem(CAL_RSVP_KEY)) || {}; } catch(e){}
  all[key] = myRsvpIds;
  try { localStorage.setItem(CAL_RSVP_KEY, JSON.stringify(all)); } catch(e){}
}
function calIsRsvpd(eventId){ return !!eventId && myRsvpIds.indexOf(eventId) !== -1; }
function calSetRsvpd(eventId, done){
  if(!eventId) return;
  var idx = myRsvpIds.indexOf(eventId);
  if(done && idx === -1) myRsvpIds.push(eventId);
  if(!done && idx !== -1) myRsvpIds.splice(idx, 1);
  calSaveMyRsvps();
}

var viewYear = TODAY.year, viewMonth = TODAY.month;

/* ---------------- event-detail modal wiring (shared/modal.js) ---------------- */
/* cat -> {color, label}: color drives both the chip's border/fill
   (.ev-chip--<cat> in calendar.css) and the modal badge color
   (.badge.<color>); label is the modal badge's fallback text when the
   event has no host (org) of its own. */
var CAL_CAT_META = {
  official: {color:'granite', label:'Campus Event'},
  career:   {color:'teal',    label:'Career Event'},
  food:     {color:'gold',    label:'Free Food Event'},
  deadline: {color:'red',     label:'Deadline'},
  personal: {color:'green',   label:'Personal Schedule'}
};
var chipCounter = 0;
function registerEventDetail(e, cat){
  var key = 'cal-evt-' + (chipCounter++);
  var rows = [];
  var meta = CAL_CAT_META[cat] || CAL_CAT_META.official;
  var when = monthName(e.month) + ' ' + e.date + ', ' + e.year + (e.time ? ' · ' + e.time : '');
  /* Every event shows the same five rows, in the same order, so the
     card's height (and the A4-ratio poster panel beside it) stays
     consistent from event to event -- a field the source data doesn't
     have just shows as "—" instead of being left out. */
  rows.push({color: meta.color, icon:'calendar', label:'Date/Time', value: when});
  rows.push({color:'granite', icon:'pin', label:'Location', value: e.location || '—'});
  rows.push({color:'granite', icon:'people', label:'Host', value: e.org || '—'});
  rows.push({color:'granite', icon:'mail', label:'Contact', value: e.contact || '—'});
  rows.push({color:'gold', icon:'food', label:'Perks', value: e.perks || '—'});
  EVENTS_DETAIL[key] = {
    badge: e.org || meta.label,
    title: e.title,
    rows: rows,
    badgeClass: meta.color,
    poster: e.poster || null,
    rsvpLink: e.rsvpLink || null,
    eventId: e.id || null
  };
  return key;
}
/* Placeholder markup for events with no admin-uploaded poster photo
   (the default state for every event until one is added). */
var CAL_POSTER_PLACEHOLDER = '<svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#8B93A0" stroke-width="1.3"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 4v4M16 4v4M4 10h16"/><path d="M8 14h2M8 17h2M14 14h2M14 17h2"/></svg>';
function openCalModal(key){
  var det = EVENTS_DETAIL[key];
  openModal(key);
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
      var admin = calIsAdmin();
      if(rsvpDoneWrap) rsvpDoneWrap.classList.toggle('hidden', admin);
      if(rsvpNote) rsvpNote.textContent = admin
        ? 'Students see a confirmation checkbox here once they open the form.'
        : "Checking the box above is what adds this to your My RSVPs — opening the form alone doesn't.";
      if(!admin && rsvpDoneBox){
        rsvpDoneBox.checked = calIsRsvpd(det.eventId);
        rsvpDoneBox.onchange = function(){
          calSetRsvpd(det.eventId, this.checked);
          renderCalendar();
        };
      }
    } else {
      rsvpSection.style.display = 'none';
    }
  }
  var posterEl = document.getElementById('modal-poster');
  if(posterEl){
    posterEl.innerHTML = det.poster ? '<img src="' + det.poster + '" alt="Event poster">' : CAL_POSTER_PLACEHOLDER;
  }
}

function makeChip(e){
  var span = document.createElement('span');
  span.className = 'ev-chip ev-chip--' + e.cat + ' clickable';
  span.setAttribute('data-cat', e.cat);
  if(e.id) span.setAttribute('data-event-id', e.id);
  var prefix = (e.rsvpLink && calIsRsvpd(e.id)) ? "[RSVP'd] " : '';
  var bits = [prefix + e.title];
  if(e.location) bits.push('— ' + e.location);
  if(e.time) bits.push('· ' + e.time);
  span.textContent = bits.join(' ');
  var key = registerEventDetail(e, e.cat);
  span.addEventListener('click', function(){ openCalModal(key); });
  return span;
}

function makePersonalChip(e){
  var span = document.createElement('span');
  span.className = 'ev-chip ev-chip--personal clickable';
  span.setAttribute('data-cat', 'personal');
  span.textContent = '[Personal] ' + e.title + (e.time ? ' · ' + e.time : '');
  var key = registerEventDetail(e, 'personal');
  span.addEventListener('click', function(){ openCalModal(key); });
  return span;
}

/* ---------------- calendar grid rendering ---------------- */
function makeCell(num, dim, realDate, isToday){
  var cell = document.createElement('div');
  cell.className = 'cal-cell' + (isToday ? ' today' : '');
  if(!dim) cell.setAttribute('data-date', String(realDate));
  if(dim){
    cell.innerHTML = '<div class="cal-date dim">' + num + '</div>';
    return cell;
  }
  if(isToday){
    cell.innerHTML = '<div class="date-row"><span class="cal-date" style="color:#BE0000;">' + num + '</span><span class="today-chip">TODAY</span></div>';
  } else {
    cell.innerHTML = '<div class="cal-date">' + num + '</div>';
  }
  CAMPUS_EVENTS.filter(function(e){ return e.year === viewYear && e.month === viewMonth && e.date === num; })
    .forEach(function(e){ cell.appendChild(makeChip(e)); });
  personalEvents.filter(function(e){ return e.year === viewYear && e.month === viewMonth && e.date === num; })
    .forEach(function(e){ cell.appendChild(makePersonalChip(e)); });
  return cell;
}

function renderCalendar(){
  var body = document.getElementById('cal-body');
  body.innerHTML = '';
  var numDays = daysInMonth(viewYear, viewMonth);
  var startDow = firstWeekday(viewYear, viewMonth);
  var prevY = viewMonth === 1 ? viewYear - 1 : viewYear;
  var prevM = viewMonth === 1 ? 12 : viewMonth - 1;
  var prevDays = daysInMonth(prevY, prevM);

  for(var i = 0; i < startDow; i++){
    body.appendChild(makeCell(prevDays - startDow + 1 + i, true, null, false));
  }
  for(var d = 1; d <= numDays; d++){
    var isToday = (viewYear === TODAY.year && viewMonth === TODAY.month && d === TODAY.date);
    body.appendChild(makeCell(d, false, d, isToday));
  }
  var totalCells = startDow + numDays;
  var trailing = (7 - (totalCells % 7)) % 7;
  for(var j = 1; j <= trailing; j++){
    body.appendChild(makeCell(j, true, null, false));
  }

  renderRightPanel();
  updateFilterCounts();
  applyFilters();
}

var DOW_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function daysUntil(e){
  var target = new Date(e.year, e.month-1, e.date);
  var today = new Date(TODAY.year, TODAY.month-1, TODAY.date);
  return Math.round((target - today) / 86400000);
}
function renderRightPanel(){
  var panel = document.querySelector('.right-panel');
  var monthEvents = CAMPUS_EVENTS.filter(function(e){ return e.year === viewYear && e.month === viewMonth; });
  var foodEvents = monthEvents.filter(function(e){ return e.cat === 'food'; });
  /* "My RSVPs" is per-student now: any event with an rsvpLink qualifies,
     but it only shows up here once THIS student has checked "I've
     submitted the form" on it (see calIsRsvpd/openCalModal) -- never
     just because it exists on the shared campus calendar. For admin,
     calIsRsvpd() is always false (no personal unid to key off of), so
     this list is naturally always empty for them. */
  var rsvpEvents = monthEvents.filter(function(e){ return e.rsvpLink && calIsRsvpd(e.id); });
  var html = '';
  if(foodEvents.length){
    html += '<div class="rp-head"><div class="rp-head-title">🍴 FREE FOOD EVENTS</div></div>';
    foodEvents.forEach(function(e){
      var dateAbbr = monthName(e.month).slice(0,3).toUpperCase() + ' ' + e.date;
      html += '<div class="rp-food-box">'
        + '<div class="rp-food-top"><span class="rp-food-date">' + dateAbbr + '</span>' + (e.time ? '<span class="rp-food-time">' + e.time + '</span>' : '') + '</div>'
        + '<div class="rp-food-title">' + e.title + '</div>'
        + (e.location ? '<div class="rp-food-loc">' + e.location + '</div>' : '')
        + '</div>';
    });
  }
  if(foodEvents.length && rsvpEvents.length) html += '<div class="rp-divider"></div>';
  if(rsvpEvents.length){
    html += '<div class="rp-head"><div class="rp-head-title">🔖 MY RSVPS (' + rsvpEvents.length + ')</div></div>';
    rsvpEvents.forEach(function(e){
      var dday = daysUntil(e);
      var ddayText = dday > 0 ? ('D-' + dday) : (dday === 0 ? 'D-DAY' : ('D+' + Math.abs(dday)));
      var dow = DOW_NAMES[new Date(e.year, e.month-1, e.date).getDay()];
      var locAbbr = e.locAbbr || e.location || '';
      html += '<div class="rp-rsvp-box">'
        + '<div class="rp-rsvp-top"><span class="rp-rsvp-confirmed">CONFIRMED</span><span class="rp-rsvp-dday">' + ddayText + '</span></div>'
        + '<div class="rp-rsvp-title">' + e.title + '</div>'
        + '<div class="rp-rsvp-sub">' + dow + ', ' + monthName(e.month).slice(0,3) + ' ' + e.date + (e.time ? ' · ' + e.time : '') + (locAbbr ? ' (' + locAbbr + ')' : '') + '</div>'
        + '</div>';
    });
  }
  if(!foodEvents.length && !rsvpEvents.length){
    html = '<div class="rp-head"><div class="rp-head-title">📅 THIS MONTH</div></div><div class="rp-empty">No official campus events on the calendar for ' + monthName(viewMonth) + ' ' + viewYear + '.</div>';
  }
  panel.innerHTML = html;
}

function updateFilterCounts(){
  var monthEvents = CAMPUS_EVENTS.filter(function(e){ return e.year === viewYear && e.month === viewMonth; });
  var counts = {all: monthEvents.length, rsvp: 0, food: 0, career: 0};
  monthEvents.forEach(function(e){
    if(e.rsvpLink && calIsRsvpd(e.id)) counts.rsvp++;
    if(e.cat === 'food') counts.food++;
    if(e.cat === 'career') counts.career++;
  });
  var setCount = function(sel, n){
    var el = document.querySelector(sel);
    if(el) el.textContent = '(' + n + ')';
  };
  setCount('[data-filter="all"] .count', counts.all);
  setCount('[data-filter="rsvp"] .count', counts.rsvp);
  setCount('[data-filter="food"] .count', counts.food);
  setCount('[data-filter="career"] .count', counts.career);
}

/* ---------------- year/month dropdown ---------------- */
function updateSelectLabels(){
  var yLabel = document.querySelector('#cal-select-year .cal-select-label');
  var mLabel = document.querySelector('#cal-select-month .cal-select-label');
  if(yLabel) yLabel.textContent = viewYear;
  if(mLabel) mLabel.textContent = monthName(viewMonth);
  document.querySelectorAll('#cal-select-year-menu .cal-select-opt').forEach(function(o){
    o.classList.toggle('active', parseInt(o.getAttribute('data-value'), 10) === viewYear);
  });
  document.querySelectorAll('#cal-select-month-menu .cal-select-opt').forEach(function(o){
    o.classList.toggle('active', parseInt(o.getAttribute('data-value'), 10) === viewMonth);
  });
}
function toggleCalSelect(which){
  var menu = document.getElementById('cal-select-' + which + '-menu');
  var isOpen = menu.classList.contains('open');
  document.querySelectorAll('.cal-select-menu').forEach(function(m){ m.classList.remove('open'); });
  if(!isOpen) menu.classList.add('open');
}
document.addEventListener('click', function(e){
  if(!e.target.closest('.cal-select')){
    document.querySelectorAll('.cal-select-menu').forEach(function(m){ m.classList.remove('open'); });
  }
});
function selectCalOption(e, which, value){
  e.stopPropagation();
  document.getElementById('cal-select-' + which + '-menu').classList.remove('open');
  if(which === 'year') viewYear = parseInt(value, 10);
  else viewMonth = parseInt(value, 10);
  updateSelectLabels();
  renderCalendar();
}
function goToToday(){
  viewYear = TODAY.year;
  viewMonth = TODAY.month;
  updateSelectLabels();
  renderCalendar();
}

/* ---------------- add schedule modal ---------------- */
/* Date is a free Year/Month/Day pick -- not limited to whatever month
   the grid happens to be showing, same as registering a real calendar
   event. Year/Month options are filled once; Day options refresh
   whenever Year or Month changes (months have different lengths). */
var CAL_YEAR_OPTIONS = [2024, 2025, 2026, 2027, 2028];
function calFillYearMonthSelects(){
  var ySel = document.getElementById('as-year');
  var mSel = document.getElementById('as-month');
  if(!ySel || !mSel) return;
  ySel.innerHTML = CAL_YEAR_OPTIONS.map(function(y){ return '<option value="'+y+'">'+y+'</option>'; }).join('');
  mSel.innerHTML = MONTH_NAMES.map(function(name, i){ return '<option value="'+(i+1)+'">'+name+'</option>'; }).join('');
}
function calRefreshDaySelect(keepDay){
  var ySel = document.getElementById('as-year'), mSel = document.getElementById('as-month'), dSel = document.getElementById('as-day');
  if(!ySel || !mSel || !dSel) return;
  var y = parseInt(ySel.value, 10), m = parseInt(mSel.value, 10);
  var n = daysInMonth(y, m);
  var prev = keepDay ? parseInt(dSel.value, 10) : null;
  var opts = '';
  for(var d = 1; d <= n; d++){ opts += '<option value="'+d+'">'+d+'</option>'; }
  dSel.innerHTML = opts;
  if(prev && prev <= n) dSel.value = prev;
}

/* Admin uses this exact same modal/button to register an Official,
   RSVP-required or Free-Food event instead of a personal one -- same
   calendar page, same "+ Add Schedule" flow, just a different target
   store depending on who's signed in. */
function calIsAdmin(){ return typeof SESSION !== 'undefined' && SESSION && SESSION.role === 'admin'; }
var calPendingPoster = null;
function calResetAddForm(){
  document.getElementById('as-title').value = '';
  calResetTimeField('start');
  calResetTimeField('end');
  var loc = document.getElementById('as-location'); if(loc) loc.value = '';
  var org = document.getElementById('as-org'); if(org) org.value = '';
  var contact = document.getElementById('as-contact'); if(contact) contact.value = '';
  var perks = document.getElementById('as-perks'); if(perks) perks.value = '';
  var locAbbr = document.getElementById('as-locAbbr'); if(locAbbr) locAbbr.value = '';
  var rsvpLink = document.getElementById('as-rsvp-link'); if(rsvpLink) rsvpLink.value = '';
  var posterInput = document.getElementById('as-poster'); if(posterInput) posterInput.value = '';
  var posterName = document.getElementById('as-poster-filename'); if(posterName) posterName.textContent = 'No file chosen';
  var catSel = document.getElementById('as-cat'); if(catSel) catSel.value = 'official';
  calPendingPoster = null;
  var preview = document.getElementById('as-poster-preview-wrap');
  if(preview) preview.classList.add('hidden');
  var locAbbrField = document.getElementById('as-locAbbr-field');
  if(locAbbrField) locAbbrField.classList.add('hidden');
  var errEl = document.getElementById('as-error'); if(errEl) errEl.textContent = '';
}
function openAddModal(){
  var admin = calIsAdmin();
  document.getElementById('add-official-fields-top').classList.toggle('hidden', !admin);
  document.getElementById('add-official-fields-bottom').classList.toggle('hidden', !admin);
  document.getElementById('add-modal-title').textContent = admin ? 'Register Official Event' : 'Add Personal Schedule';
  document.getElementById('add-modal-sub').textContent = admin
    ? 'This publishes to the shared Calendar — every student will see it right away.'
    : "This event is visible only to you and won't appear as an Official Campus event.";
  document.getElementById('add-schedule-btn').textContent = admin ? 'Register Event' : 'Add Schedule';
  /* default the date pick to whatever month the grid is currently on,
     but it can be freely changed to any year/month/day from here */
  document.getElementById('as-year').value = viewYear;
  document.getElementById('as-month').value = viewMonth;
  calRefreshDaySelect(false);
  document.getElementById('add-modal').classList.remove('hidden');
}
function closeAddModal(){ document.getElementById('add-modal').classList.add('hidden'); }
document.getElementById('as-year').addEventListener('change', function(){ calRefreshDaySelect(true); });
document.getElementById('as-month').addEventListener('change', function(){ calRefreshDaySelect(true); });
calFillYearMonthSelects();

/* 24h "HH:MM" input -> demo-style 12h label ("5pm", "7:30pm") */
function calFormatTime12(t){
  if(!t) return '';
  var bits = t.split(':');
  var h = parseInt(bits[0], 10), m = bits[1];
  var ampm = h >= 12 ? 'pm' : 'am';
  var h12 = h % 12; if(h12 === 0) h12 = 12;
  return h12 + (m !== '00' ? ':' + m : '') + ampm;
}
/* start+end -> "5–7:30pm" when both share am/pm, "11am–2pm" otherwise;
   either side alone just shows that one time, matching existing data. */
function calFormatTimeRange(start, end){
  if(!start && !end) return '';
  if(start && !end) return calFormatTime12(start);
  if(!start && end) return calFormatTime12(end);
  var sMer = parseInt(start.split(':')[0], 10) >= 12 ? 'pm' : 'am';
  var eMer = parseInt(end.split(':')[0], 10) >= 12 ? 'pm' : 'am';
  var startLabel = calFormatTime12(start);
  if(sMer === eMer) startLabel = startLabel.slice(0, -2); /* drop the shared am/pm off the start half */
  return startLabel + '–' + calFormatTime12(end);
}

/* Custom start/end time picker -- plain English hour/minute/AM-PM
   columns styled to match the year/month dropdowns above (.cal-select),
   instead of the native <input type="time">, whose picker UI is drawn
   by the OS/browser in the system locale (e.g. Korean AM/PM labels on
   a Korean-locale machine) and can't be forced to stay in English. */
var calTimeState = { start: {h:null, m:null, ap:null}, end: {h:null, m:null, ap:null} };
function calBuildTimeMenu(field){
  var hourCol = document.getElementById('as-time-' + field + '-hour');
  var minCol = document.getElementById('as-time-' + field + '-minute');
  var apCol = document.getElementById('as-time-' + field + '-ampm');
  if(!hourCol || !minCol || !apCol) return;
  hourCol.innerHTML = Array.from({length: 12}, function(_, i){ var h = i + 1; return '<div class="time-menu-opt" data-kind="h" data-val="' + h + '">' + h + '</div>'; }).join('');
  /* every minute 0-59, not just 00/15/30/45 -- a meeting at, say, 2:10
     should be settable exactly, not rounded to the nearest quarter-hour. */
  minCol.innerHTML = Array.from({length: 60}, function(_, m){ var mm = (m < 10 ? '0' : '') + m; return '<div class="time-menu-opt" data-kind="m" data-val="' + mm + '">' + mm + '</div>'; }).join('');
  apCol.innerHTML = ['AM', 'PM'].map(function(ap){ return '<div class="time-menu-opt" data-kind="ap" data-val="' + ap + '">' + ap + '</div>'; }).join('');
  [hourCol, minCol, apCol].forEach(function(col){
    col.querySelectorAll('.time-menu-opt').forEach(function(opt){
      opt.addEventListener('click', function(e){
        e.stopPropagation();
        var kind = opt.getAttribute('data-kind'), val = opt.getAttribute('data-val');
        if(kind === 'h') calTimeState[field].h = parseInt(val, 10);
        if(kind === 'm') calTimeState[field].m = val;
        if(kind === 'ap') calTimeState[field].ap = val;
        calRefreshTimeMenuActive(field);
        calUpdateTimeLabel(field);
      });
    });
  });
}
function calRefreshTimeMenuActive(field){
  var st = calTimeState[field];
  document.querySelectorAll('#as-time-' + field + '-hour .time-menu-opt').forEach(function(o){ o.classList.toggle('active', st.h !== null && parseInt(o.getAttribute('data-val'), 10) === st.h); });
  document.querySelectorAll('#as-time-' + field + '-minute .time-menu-opt').forEach(function(o){ o.classList.toggle('active', st.m !== null && o.getAttribute('data-val') === st.m); });
  document.querySelectorAll('#as-time-' + field + '-ampm .time-menu-opt').forEach(function(o){ o.classList.toggle('active', st.ap !== null && o.getAttribute('data-val') === st.ap); });
}
function calUpdateTimeLabel(field){
  var st = calTimeState[field];
  var label = document.getElementById('as-time-' + field + '-label');
  if(!label) return;
  if(st.h !== null && st.m !== null && st.ap !== null){
    label.textContent = st.h + ':' + st.m + ' ' + st.ap;
    label.classList.add('set');
  } else {
    label.textContent = field === 'start' ? 'Start time' : 'End time';
    label.classList.remove('set');
  }
}
function toggleTimeMenu(field){
  var other = field === 'start' ? 'end' : 'start';
  var otherField = document.getElementById('as-time-' + other + '-field');
  if(otherField) otherField.classList.remove('open');
  var el = document.getElementById('as-time-' + field + '-field');
  var opening = !el.classList.contains('open');
  el.classList.toggle('open');
  if(opening){
    /* the minute column has 60 rows -- jump straight to whatever is
       already picked (or to :00) instead of making every open start
       scrolled to the top. */
    ['hour', 'minute', 'ampm'].forEach(function(part){
      var col = document.getElementById('as-time-' + field + '-' + part);
      if(!col) return;
      var active = col.querySelector('.time-menu-opt.active') || col.querySelector('.time-menu-opt');
      if(active) col.scrollTop = active.offsetTop - col.offsetTop - (col.clientHeight / 2) + (active.clientHeight / 2);
    });
  }
}
document.addEventListener('click', function(e){
  if(!e.target.closest('.time-field')){
    ['start', 'end'].forEach(function(field){
      var f = document.getElementById('as-time-' + field + '-field');
      if(f) f.classList.remove('open');
    });
  }
});
/* Picked hour/minute/am-pm -> 24h "HH:MM" string (what calFormatTimeRange expects); '' if nothing picked yet. */
function calGetTimeValue24(field){
  var st = calTimeState[field];
  if(st.h === null || st.m === null || st.ap === null) return '';
  var h24 = st.h % 12;
  if(st.ap === 'PM') h24 += 12;
  return (h24 < 10 ? '0' : '') + h24 + ':' + st.m;
}
function calResetTimeField(field){
  calTimeState[field] = {h: null, m: null, ap: null};
  calUpdateTimeLabel(field);
  calRefreshTimeMenuActive(field);
  var f = document.getElementById('as-time-' + field + '-field');
  if(f) f.classList.remove('open');
}
calBuildTimeMenu('start');
calBuildTimeMenu('end');

/* the short location label is only useful once an event is RSVP-able
   (it's what shows on the My RSVPs sidebar card), so it only reveals
   itself once an RSVP link is actually entered -- not tied to category
   anymore, since any category can carry an RSVP link now. */
var calRsvpLinkEl = document.getElementById('as-rsvp-link');
if(calRsvpLinkEl){
  calRsvpLinkEl.addEventListener('input', function(){
    document.getElementById('as-locAbbr-field').classList.toggle('hidden', !this.value.trim());
  });
}
var calPosterInputEl = document.getElementById('as-poster');
if(calPosterInputEl){
  calPosterInputEl.addEventListener('change', function(input){
    var file = input.target.files && input.target.files[0];
    if(!file) return;
    var nameEl = document.getElementById('as-poster-filename');
    if(nameEl) nameEl.textContent = file.name;
    var reader = new FileReader();
    reader.onload = function(ev){
      calPendingPoster = ev.target.result;
      document.getElementById('as-poster-preview').src = calPendingPoster;
      document.getElementById('as-poster-preview-wrap').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });
}
var calPosterRemoveEl = document.getElementById('as-poster-remove');
if(calPosterRemoveEl){
  calPosterRemoveEl.addEventListener('click', function(){
    calPendingPoster = null;
    document.getElementById('as-poster').value = '';
    var nameEl = document.getElementById('as-poster-filename');
    if(nameEl) nameEl.textContent = 'No file chosen';
    document.getElementById('as-poster-preview-wrap').classList.add('hidden');
  });
}

function calUid(){ return 'e' + Math.random().toString(36).slice(2, 9); }
function addSchedule(){
  var title = document.getElementById('as-title').value.trim() || (calIsAdmin() ? 'New Event' : 'New Personal Event');
  var year = parseInt(document.getElementById('as-year').value, 10);
  var month = parseInt(document.getElementById('as-month').value, 10);
  var date = parseInt(document.getElementById('as-day').value, 10);
  var timeStart = calGetTimeValue24('start');
  var timeEnd = calGetTimeValue24('end');
  var time = calFormatTimeRange(timeStart, timeEnd);

  if(calIsAdmin()){
    var cat = document.getElementById('as-cat').value;
    var location = document.getElementById('as-location').value.trim();
    var errEl = document.getElementById('as-error');
    if(!location){
      if(errEl) errEl.textContent = 'Location is required.';
      return;
    }
    if(errEl) errEl.textContent = '';
    var rsvpLink = document.getElementById('as-rsvp-link').value.trim();
    var rec = {
      id: calUid(),
      cat: cat,
      title: title,
      year: year, month: month, date: date,
      time: time,
      location: location,
      org: document.getElementById('as-org').value.trim(),
      contact: document.getElementById('as-contact').value.trim(),
      perks: document.getElementById('as-perks').value.trim(),
      rsvpLink: rsvpLink,
      poster: calPendingPoster
    };
    if(rsvpLink) rec.locAbbr = document.getElementById('as-locAbbr').value.trim();
    CAMPUS_EVENTS.push(rec);
    try { localStorage.setItem(CAL_STORE_KEY, JSON.stringify(CAMPUS_EVENTS)); } catch(e){}
    closeAddModal();
    calResetAddForm();
    renderCalendar();
    showToast('Registered "' + title + '" as an Official Campus event for ' + monthName(month).slice(0,3) + ' ' + date + ', ' + year);
    return;
  }

  personalEvents.push({year: year, month: month, date: date, title: title, time: time});
  calSavePersonal();
  closeAddModal();
  calResetAddForm();
  renderCalendar();
  showToast('Personal schedule added to ' + monthName(month).slice(0,3) + ' ' + date + ', ' + year);
}

/* ---------------- calendar filters ---------------- */
var currentFilter = 'all';
var personalOn = true;
function applyFilters(){
  document.querySelectorAll('.ev-chip').forEach(function(chip){
    var cat = chip.getAttribute('data-cat');
    var eventId = chip.getAttribute('data-event-id');
    var pass = true;
    if(currentFilter === 'rsvp') pass = calIsRsvpd(eventId);
    else if(currentFilter === 'food') pass = cat === 'food';
    else if(currentFilter === 'career') pass = cat === 'career';
    if(cat === 'personal' && !personalOn) pass = false;
    chip.classList.toggle('chip-hidden', !pass);
  });
}
document.getElementById('filter-row').addEventListener('click', function(e){
  var btn = e.target.closest('.pill');
  if(!btn) return;
  document.querySelectorAll('#filter-row .pill').forEach(function(p){ p.classList.remove('active'); });
  btn.classList.add('active');
  currentFilter = btn.getAttribute('data-filter');
  applyFilters();
});
function togglePersonal(){
  personalOn = !personalOn;
  document.getElementById('personal-switch').classList.toggle('on', personalOn);
  document.getElementById('personal-toggle').style.opacity = personalOn ? '1' : '.6';
  applyFilters();
  showToast(personalOn ? 'Personal schedule shown' : 'Personal schedule hidden');
}

/* keeps the "Today (...)" button's label in sync with the real TODAY
   computed at the top of this file -- it's never a stale hardcoded
   string, so it reads correctly no matter what day this loads on. */
function calUpdateTodayBtnLabel(){
  var btn = document.getElementById('cal-today-btn');
  if(btn) btn.textContent = 'Today (' + monthName(TODAY.month).slice(0,3) + ' ' + TODAY.date + ')';
}

calUpdateTodayBtnLabel();
updateSelectLabels();
renderCalendar();
