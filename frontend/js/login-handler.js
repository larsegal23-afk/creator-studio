// Login Handler - Direct Firebase Integration
console.log('=== LOGIN HANDLER LOADED ===');

window.initLoginPage = function() {
  console.log('Initializing login page...');
  
  // Check if already logged in
  const user = firebase.auth().currentUser;
  if (user) {
    console.log('Already logged in, redirecting to dashboard...');
    window.location.href = '#/dashboard';
    return;
  }
  
  var form = document.getElementById('loginFormSimple');
  var btn = document.getElementById('loginBtnSimple');
  var status = document.getElementById('loginStatus');
  
  console.log('Form:', !!form, 'Button:', !!btn, 'Status:', !!status);
  
  if (!form) {
    console.error('Login form not found!');
    return;
  }
  
  form.addEventListener('submit', function(e) {
    console.log('Login submitted!');
    e.preventDefault();
    
    var email = document.getElementById('loginEmail')?.value?.trim();
    var password = document.getElementById('loginPassword')?.value;
    
    console.log('Email:', email, 'Password length:', password?.length);
    
    if (!email || !password) {
      if (status) status.textContent = 'Bitte Email und Passwort eingeben.';
      return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Wird eingeloggt...';
    if (status) status.textContent = 'Login wird verarbeitet...';
    
    // Direct Firebase Auth
    firebase.auth().signInWithEmailAndPassword(email, password)
      .then(function(userCredential) {
        console.log('Login successful:', userCredential.user.email);
        return userCredential.user.getIdToken();
      })
      .then(function(token) {
        sessionStorage.setItem('token', token);
        if (status) status.textContent = 'Anmeldung erfolgreich! Weiterleitung...';
        setTimeout(function() {
          window.location.href = '#/dashboard';
        }, 1000);
      })
      .catch(function(error) {
        console.error('Login error:', error.code);
        if (status) status.textContent = 'Anmeldung fehlgeschlagen. Bitte überprüfe deine Zugangsdaten.';
        btn.disabled = false;
        btn.textContent = 'Login';
      });
  });
  
  console.log('Login handler attached!');
};

// Auto-init if on login page
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.hash === '#login' || window.location.hash === '#/login') {
    setTimeout(window.initLoginPage, 500);
  }
});
