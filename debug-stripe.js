// Stripe Debug Script
console.log('=== Stripe Debug ===');

// Test buyCoins function
if (typeof window.buyCoins === 'function') {
  console.log('buyCoins function available: YES');
} else {
  console.log('buyCoins function available: NO');
}

// Test authFetch
if (typeof window.authFetch === 'function') {
  console.log('authFetch function available: YES');
} else {
  console.log('authFetch function available: NO');
}

// Test API client
if (window.Api && window.Api.user) {
  console.log('API client available: YES');
} else {
  console.log('API client available: NO');
}

// Manual test of checkout endpoint
window.testCheckout = async function testCheckout() {
  console.log('Testing checkout endpoint...');
  
  try {
    const response = await window.authFetch("/api/create-checkout-session", {
      method: "POST",
      body: JSON.stringify({ pack: 'small' })
    });
    
    console.log('Response status:', response?.status);
    console.log('Response ok:', response?.ok);
    console.log('Response headers:', response?.headers);
    
    if (response && response.ok) {
      const payload = await response.json();
      console.log('Response payload:', payload);
    } else {
      console.log('Response error:', response?.statusText);
    }
  } catch (error) {
    console.error('Checkout test failed:', error);
  }
};

// Auto-run test after 2 seconds
setTimeout(() => {
  console.log('Running checkout test...');
  window.testCheckout();
}, 2000);
