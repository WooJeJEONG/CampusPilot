/* Campuspilot — login page logic.
   Students self-register (UNID + password + name + major/year) into a
   localStorage accounts store (createAccount / findAccount, defined in
   shared/session.js) and then sign in against that record — there is no
   shared demo password anymore, and no seeded account: every student has
   to sign up once before they can sign in. The admin side is unchanged:
   a single fixed departmental passcode, no accounts, no sign-up. */

var ADMIN_PASSCODE = '000000';
var studentMode = 'login'; // 'login' | 'signup'

function toggleSignupMode(){
  studentMode = (studentMode === 'login') ? 'signup' : 'login';
  renderStudentMode();
}

function renderStudentMode(){
  var isSignup = studentMode === 'signup';
  document.getElementById('loginFields').classList.toggle('hidden', isSignup);
  document.getElementById('signupFields').classList.toggle('hidden', !isSignup);
  document.getElementById('studentPanelTitle').textContent = isSignup ? 'Create Student Account' : 'Student Login';
  document.getElementById('studentPanelDesc').textContent = isSignup
    ? 'Register with your University ID to create your Campuspilot account — then sign in with it below.'
    : 'Sign in with your University ID (UNID) to view departmental campus events, RSVP for workshops, and configure personal schedule sync.';
  document.getElementById('studentActionLabel').textContent = isSignup ? 'Create Account' : 'Sign In with UNID';
  document.getElementById('studentActionBtn').onclick = isSignup ? trySignUp : tryStudentLogin;
  document.getElementById('forgotPwBtn').classList.toggle('hidden', isSignup);
  document.getElementById('studentModeToggle').textContent = isSignup ? 'Already have an account? Sign In' : "Don't have an account? Sign Up";
}

function tryStudentLogin(){
  var unid = (document.getElementById('login-unid').value || '').trim();
  var pw = (document.getElementById('login-pw').value || '').trim();

  if(!unid || !pw){
    showToast('Enter your UNID and password.');
    return;
  }
  var account = findAccount(unid);
  if(!account || account.password !== pw){
    showToast('Incorrect UNID or password.');
    return;
  }
  setSession('student', account);
  window.location.href = '../home/index.html';
}

function trySignUp(){
  var unid = document.getElementById('signup-unid').value;
  var name = document.getElementById('signup-name').value;
  var major = document.getElementById('signup-major').value;
  var pw = document.getElementById('signup-pw').value;
  var pw2 = document.getElementById('signup-pw2').value;

  if(!unid.trim() || !name.trim() || !pw){
    showToast('Fill in your UNID, name, and password.');
    return;
  }
  if(pw.length < 6){
    showToast('Password must be at least 6 characters.');
    return;
  }
  if(pw !== pw2){
    showToast('Passwords do not match.');
    return;
  }

  var result = createAccount(unid, pw, name, major);
  if(!result.ok){
    showToast(result.error);
    return;
  }

  showToast('Account created — sign in with your new UNID and password.');
  document.getElementById('login-unid').value = result.account.unid;
  document.getElementById('login-pw').value = '';
  document.getElementById('signup-unid').value = '';
  document.getElementById('signup-name').value = '';
  document.getElementById('signup-major').value = '';
  document.getElementById('signup-pw').value = '';
  document.getElementById('signup-pw2').value = '';
  studentMode = 'login';
  renderStudentMode();
}

function getOtpValue(){
  var out = '';
  for(var i = 0; i < 6; i++){
    var box = document.getElementById('otp-' + i);
    out += (box && box.value) ? box.value : '';
  }
  return out;
}

function clearOtp(){
  for(var i = 0; i < 6; i++){
    var box = document.getElementById('otp-' + i);
    if(box) box.value = '';
  }
  var first = document.getElementById('otp-0');
  if(first) first.focus();
}

function tryAdminLogin(){
  var code = getOtpValue();
  if(code.length < 6){
    showToast('Enter the full 6-digit departmental passcode.');
    return;
  }
  if(code !== ADMIN_PASSCODE){
    showToast('Incorrect departmental passcode.');
    clearOtp();
    return;
  }
  setSession('admin');
  window.location.href = '../home/index.html';
}

function wireOtpBoxes(){
  for(var i = 0; i < 6; i++){
    (function(idx){
      var box = document.getElementById('otp-' + idx);
      if(!box) return;
      box.addEventListener('input', function(){
        box.value = box.value.replace(/[^0-9]/g, '').slice(0, 1);
        if(box.value && idx < 5){
          var next = document.getElementById('otp-' + (idx + 1));
          if(next) next.focus();
        }
      });
      box.addEventListener('keydown', function(e){
        if(e.key === 'Backspace' && !box.value && idx > 0){
          var prev = document.getElementById('otp-' + (idx - 1));
          if(prev){ prev.focus(); }
        }else if(e.key === 'Enter'){
          tryAdminLogin();
        }
      });
    })(i);
  }
}

document.addEventListener('DOMContentLoaded', wireOtpBoxes);
