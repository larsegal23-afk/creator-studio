// Full System Debug
console.log('=== FULL SYSTEM DEBUG ===');

// Test 1: Check Firebase
console.log('1. Firebase Status:');
console.log('- firebase object:', typeof firebase !== 'undefined' ? 'YES' : 'NO');
console.log('- firebaseAuthApi:', typeof window.firebaseAuthApi !== 'undefined' ? 'YES' : 'NO');
console.log('- firebaseAuthReady:', typeof window.firebaseAuthReady !== 'undefined' ? 'YES' : 'NO');

// Test 2: Check API Client
console.log('2. API Client Status:');
console.log('- APP_CONFIG:', window.APP_CONFIG);
console.log('- authFetch:', typeof window.authFetch !== 'undefined' ? 'YES' : 'NO');
console.log('- Api object:', typeof window.Api !== 'undefined' ? 'YES' : 'NO');

// Test 3: Check Coins Manager
console.log('3. Coins Manager Status:');
console.log('- coinsManager:', typeof window.coinsManager !== 'undefined' ? 'YES' : 'NO');
if (window.coinsManager) {
  console.log('- currentCoins:', window.coinsManager.getCoins());
  console.log('- isLoaded:', window.coinsManager.isLoaded);
}

// Test 4: Check Backend Connection
window.testBackend = async function testBackend() {
  console.log('4. Testing Backend Connection...');
  
  try {
    // Test basic health endpoint
    const response = await fetch(`${window.APP_CONFIG.apiBase}/api/test`);
    console.log('- Backend health:', response.status);
    
    // Test coins endpoint
    const coinsResponse = await window.authFetch('/api/get-coins');
    console.log('- Coins API status:', coinsResponse?.status);
    console.log('- Coins API ok:', coinsResponse?.ok);
    
    if (coinsResponse && coinsResponse.ok) {
      const data = await coinsResponse.json();
      console.log('- Coins data:', data);
    }
    
  } catch (error) {
    console.error('- Backend test failed:', error);
  }
};

// Test 5: Check Authentication
window.testAuth = async function testAuth() {
  console.log('5. Testing Authentication...');
  
  try {
    const token = localStorage.getItem('token');
    console.log('- Token in localStorage:', token ? 'YES' : 'NO');
    
    if (token) {
      // Test token with backend
      const response = await window.authFetch('/api/get-coins');
      console.log('- Auth test status:', response?.status);
    }
    
  } catch (error) {
    console.error('- Auth test failed:', error);
  }
};

// Test 6: Check DOM Elements
window.checkDOM = function checkDOM() {
  console.log('6. DOM Elements Check:');
  
  const elements = [
    'coinsValue',
    'coinsTopValue', 
    'currentCoins',
    'app'
  ];
  
  elements.forEach(id => {
    const element = document.getElementById(id);
    console.log(`- ${id}:`, element ? 'FOUND' : 'NOT FOUND');
    if (element && id.includes('coins')) {
      console.log(`  text: "${element.textContent}"`);
    }
  });
};

// Test 7: Manual Coins Update
window.testCoinsUpdate = function testCoinsUpdate() {
  console.log('7. Manual Coins Update Test:');
  
  const coinElements = [
    document.getElementById('coinsValue'),
    document.getElementById('coinsTopValue'),
    document.getElementById('currentCoins')
  ].filter(Boolean);
  
  coinElements.forEach((element, index) => {
    element.textContent = `TEST_${index}`;
    console.log(`- Set element to: ${element.textContent}`);
  });
};

// Auto-run tests
setTimeout(() => {
  console.log('=== RUNNING AUTO TESTS ===');
  window.checkDOM();
  window.testBackend();
  window.testAuth();
}, 2000);

// Manual test trigger
console.log('=== MANUAL TESTS AVAILABLE ===');
console.log('Run: testBackend(), testAuth(), checkDOM(), testCoinsUpdate()');
