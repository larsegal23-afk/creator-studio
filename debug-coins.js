// Coins Debug Script
console.log('=== Coins Debug ===');

// Test API connection
window.testCoinsAPI = async function testCoinsAPI() {
  console.log('Testing coins API...');
  
  try {
    const response = await window.authfetch("https://logomakergermany-ultimate-backend-production.up.railway.app/api/get-coins")
    console.log('API Response:', response);
    console.log('Response status:', response?.status);
    console.log('Response ok:', response?.ok);
    
    if (response && response.ok) {
      const payload = await response.json();
      console.log('Coins payload:', payload);
      console.log('Coins value:', payload.coins);
    } else {
      console.log('API Error:', response?.statusText);
    }
  } catch (error) {
    console.error('Coins API test failed:', error);
  }
};

// Test authFetch
if (typeof window.authFetch === 'function') {
  console.log('authFetch available: YES');
} else {
  console.log('authFetch available: NO');
}

// Test APP_CONFIG
if (window.APP_CONFIG) {
  console.log('APP_CONFIG:', window.APP_CONFIG);
} else {
  console.log('APP_CONFIG: NOT AVAILABLE');
}

// Test DOM elements
setTimeout(() => {
  console.log('=== DOM Elements Check ===');
  console.log('coinsValue:', document.getElementById('coinsValue'));
  console.log('coinsTopValue:', document.getElementById('coinsTopValue'));
  console.log('projectsValue:', document.getElementById('projectsValue'));
  
  // Test if elements exist and are editable
  const coinValue = document.getElementById('coinsValue');
  if (coinValue) {
    console.log('coinsValue element found, current text:', coinValue.textContent);
    coinValue.textContent = 'TEST';
    console.log('Set test value, new text:', coinValue.textContent);
  }
}, 2000);

// Auto-run test after 3 seconds
setTimeout(() => {
  console.log('Running coins API test...');
  window.testCoinsAPI();
}, 3000);
