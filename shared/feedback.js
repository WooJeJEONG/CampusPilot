/* Campuspilot — shared Feedback feature, available from the "Feedback"
   button at the bottom of the left nav rail on every protected page.
   Student: picks a 1-5 star rating (+ optional comment) and submits it.
   Resubmitting replaces their previous entry (one feedback record per
   account) rather than piling up duplicates.
   Admin: instead of the rating picker, sees the aggregated average star
   rating across every student's real submitted feedback, plus the full
   list of individual responses.
   Requires shared/toast.js (showToast) to already be loaded, and the
   page's own global SESSION (set by requireSession()) to be in place
   before openFeedbackModal() is called — true on every page that uses
   this, since the nav rail that holds the Feedback button is only
   mounted after SESSION exists. Reads/writes localStorage directly
   (not shared/store.js's cpLoadJSON/cpSaveJSON) since a few pages that
   need Feedback don't otherwise load store.js. */
var FB_KEY = 'campuspilot.feedback.v1';
var fbDraftRating = 0;

function fbLoad(){
  try{ var raw = localStorage.getItem(FB_KEY); return raw ? JSON.parse(raw) : []; }catch(e){ return []; }
}
function fbSave(list){
  try{ localStorage.setItem(FB_KEY, JSON.stringify(list)); }catch(e){ /* private mode / quota exceeded — best effort */ }
}

function fbEsc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

function fbTimeAgo(t){
  var s = Math.max(0, Date.now() - t) / 1000;
  if(s < 60) return 'Just now';
  if(s < 3600) return Math.floor(s / 60) + 'm ago';
  if(s < 86400) return Math.floor(s / 3600) + 'h ago';
  if(s < 86400 * 30) return Math.floor(s / 86400) + 'd ago';
  var d = new Date(t);
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

/* Builds a "★★★☆☆"-style string for a given rating, as static display
   text (not clickable) — used for the admin average and each response
   row. fbSetModalStars() below handles the clickable picker instead. */
function fbStarString(n){
  var out = '';
  for(var i = 1; i <= 5; i++) out += i <= Math.round(n) ? '★' : '☆';
  return out;
}

/* Injects the (initially empty/hidden) modal shell into the document
   once per page load. The actual content is filled in by
   fbRenderStudentView()/fbRenderAdminView() each time the modal opens,
   since which one applies depends on SESSION.role. */
function fbMount(){
  if(document.getElementById('fb-modal')) return;
  var div = document.createElement('div');
  div.innerHTML =
    '<div class="modal-overlay hidden" id="fb-modal" onclick="if(event.target===this)closeFeedbackModal()">' +
      '<div class="fb-card" id="fb-card-inner"></div>' +
    '</div>';
  document.body.appendChild(div.firstElementChild);
}

function openFeedbackModal(){
  fbMount();
  var isAdminView = (typeof SESSION !== 'undefined' && SESSION && SESSION.role === 'admin');
  if(isAdminView) fbRenderAdminView();
  else fbRenderStudentView();
  document.getElementById('fb-modal').classList.remove('hidden');
}

function closeFeedbackModal(){
  var m = document.getElementById('fb-modal');
  if(m) m.classList.add('hidden');
}

function fbSetModalStars(n){
  fbDraftRating = n;
  var btns = document.querySelectorAll('#fb-stars-picker button');
  btns.forEach(function(b){
    var v = +b.getAttribute('data-n');
    b.classList.toggle('on', v <= n);
  });
}

function fbRenderStudentView(){
  fbDraftRating = 0;
  var mine = (typeof SESSION !== 'undefined' && SESSION && SESSION.unid)
    ? fbLoad().filter(function(f){ return f.unid === SESSION.unid; })[0]
    : null;
  var starsHtml = '<div class="fb-stars-picker" id="fb-stars-picker">' +
    [1,2,3,4,5].map(function(n){
      return '<button type="button" data-n="' + n + '" onclick="fbSetModalStars(' + n + ')" aria-label="' + n + ' star' + (n > 1 ? 's' : '') + '">★</button>';
    }).join('') + '</div>';
  document.getElementById('fb-card-inner').innerHTML =
    '<h3>Give Feedback</h3>' +
    '<p class="fb-sub">' + (mine
      ? "You've already rated Campuspilot — submitting again will update your response."
      : "Rate your experience with Campuspilot and let UAC IT know what's working (or not).") + '</p>' +
    starsHtml +
    '<textarea class="fb-comment" id="fb-comment" placeholder="Anything you\'d like to tell us? (optional)">' + (mine ? fbEsc(mine.comment) : '') + '</textarea>' +
    '<div class="fb-actions">' +
      '<button type="button" class="btn btn-ghost" onclick="closeFeedbackModal()">Cancel</button>' +
      '<button type="button" class="btn btn-red" onclick="fbSubmitModalForm()">Submit</button>' +
    '</div>';
  if(mine) fbSetModalStars(mine.rating);
}

function fbSubmitModalForm(){
  if(!fbDraftRating){
    showToast('Pick a star rating before submitting.');
    return;
  }
  var comment = (document.getElementById('fb-comment').value || '').trim();
  var list = fbLoad();
  var unid = (typeof SESSION !== 'undefined' && SESSION && SESSION.unid) ? SESSION.unid : null;
  var name = (typeof SESSION !== 'undefined' && SESSION && SESSION.name) ? SESSION.name : 'Student';
  var existingIdx = unid ? list.findIndex(function(f){ return f.unid === unid; }) : -1;
  var entry = { unid: unid, name: name, rating: fbDraftRating, comment: comment, time: Date.now() };
  if(existingIdx !== -1) list[existingIdx] = entry;
  else list.push(entry);
  fbSave(list);
  closeFeedbackModal();
  showToast('Thanks — your feedback has been submitted to UAC IT 💬');
}

function fbRenderAdminView(){
  var list = fbLoad().slice().sort(function(a, b){ return b.time - a.time; });
  var avg = list.length ? (list.reduce(function(a, f){ return a + f.rating; }, 0) / list.length) : 0;
  var summary = '<div class="fb-admin-summary">' +
    '<div class="fb-avg-num">' + (list.length ? avg.toFixed(1) : '—') + '</div>' +
    '<div><div class="fb-avg-stars">' + fbStarString(avg) + '</div>' +
    '<div class="fb-avg-count">' + list.length + ' response' + (list.length === 1 ? '' : 's') + '</div></div>' +
  '</div>';
  var rows = list.length
    ? list.map(function(f){
        return '<div class="fb-admin-row">' +
          '<div class="fb-admin-row-top"><span class="fb-row-stars">' + fbStarString(f.rating) + '</span>' +
          '<span class="fb-row-who">' + fbEsc(f.name || 'Student') + '</span>' +
          '<span class="fb-row-time">' + fbTimeAgo(f.time) + '</span></div>' +
          (f.comment ? '<p class="fb-row-comment">' + fbEsc(f.comment) + '</p>' : '') +
        '</div>';
      }).join('')
    : '<div class="fb-admin-empty">No feedback submitted yet.</div>';
  document.getElementById('fb-card-inner').innerHTML =
    '<h3>Student Feedback <span class="admin-badge">ADMIN</span></h3>' +
    summary +
    '<div class="fb-admin-list">' + rows + '</div>' +
    '<div class="fb-actions"><button type="button" class="btn btn-ghost" style="flex:1;" onclick="closeFeedbackModal()">Close</button></div>';
}
