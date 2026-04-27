/**
 * register.js — DEPRECATED
 *
 * Registration is now handled entirely inside frontend/pages/login.html
 * (the "Registrieren" tab).  This file is kept as a no-op stub so that
 * any legacy callers do not throw a ReferenceError.
 *
 * DO NOT add new logic here.  Remove this file once all call-sites have
 * been updated to use the unified auth page.
 */
window.register = function() {
  console.warn('[register.js] Deprecated — use the Registrieren tab on the login page.');
  if (typeof loadPage === 'function') {
    loadPage('login');
  } else {
    window.location.hash = '#/login';
  }
};