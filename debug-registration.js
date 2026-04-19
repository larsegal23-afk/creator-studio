// Registration Debug Script
console.log('=== Registration Debug ===');

// Test Firebase availability
if (typeof firebase !== 'undefined') {
  console.log('Firebase SDK loaded: YES');
  
  // Test Firebase Auth
  try {
    const auth = firebase.getAuth(firebase.getApp());
    console.log('Firebase Auth available: YES');
    
    // Test createUserWithEmailAndPassword
    if (typeof firebase.createUserWithEmailAndPassword === 'function') {
      console.log('createUserWithEmailAndPassword available: YES');
    } else {
      console.log('createUserWithEmailAndPassword available: NO');
      console.log('Available auth methods:', Object.getOwnPropertyNames(firebase).filter(name => name.includes('auth')));
    }
  } catch (error) {
    console.log('Firebase Auth error:', error);
  }
} else {
  console.log('Firebase SDK loaded: NO');
}

// Test firebaseAuthApi
if (window.firebaseAuthApi) {
  console.log('firebaseAuthApi available: YES');
  console.log('Available methods:', Object.getOwnPropertyNames(window.firebaseAuthApi));
} else {
  console.log('firebaseAuthApi available: NO');
}

// Test registration function
if (typeof window.register === 'function') {
  console.log('window.register available: YES');
} else {
  console.log('window.register available: NO');
}

// Test DOM elements
console.log('=== DOM Elements ===');
console.log('registerForm:', document.getElementById('registerForm'));
console.log('regEmail:', document.getElementById('regEmail'));
console.log('regPassword:', document.getElementById('regPassword'));
console.log('regPasswordConfirm:', document.getElementById('regPasswordConfirm'));
console.log('registerBtn:', document.getElementById('registerBtn'));

// Test form submission
document.getElementById('registerForm')?.addEventListener('submit', function(e) {
  console.log('Registration form submitted!');
  e.preventDefault();
});
