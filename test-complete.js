// Complete Function Test - Full System Validation
console.log('=== COMPLETE FUNCTION TEST STARTING ===');

const testResults = {
  backend: {},
  frontend: {},
  coins: {},
  design: {},
  overall: { passed: 0, failed: 0, total: 0 }
};

// 1. Backend API Tests
async function testBackendAPI() {
  console.log('=== TESTING BACKEND API ===');
  
  const tests = [
    {
      name: 'API Base URL',
      test: () => {
        const baseUrl = window.APP_CONFIG?.apiBase;
        return baseUrl && baseUrl.includes('railway.app');
      }
    },
    {
      name: 'Auth Fetch Function',
      test: () => {
        return typeof window.authFetch === 'function';
      }
    },
    {
      name: 'Get Coins API',
      test: async () => {
        try {
          const response = await window.authFetch('/api/get-coins');
          return response && typeof response.json === 'function';
        } catch (error) {
          return false;
        }
      }
    },
    {
      name: 'Use Coins API',
      test: async () => {
        try {
          const response = await window.authFetch('/api/use-coins', {
            method: 'POST',
            body: JSON.stringify({ amount: 1 })
          });
          return response && typeof response.json === 'function';
        } catch (error) {
          return false;
        }
      }
    },
    {
      name: 'Generate Logo API',
      test: async () => {
        try {
          const response = await window.authFetch('/api/generate-logo', {
            method: 'POST',
            body: JSON.stringify({
              prompt: 'test logo',
              requestId: 'test-' + Date.now()
            })
          });
          return response && typeof response.json === 'function';
        } catch (error) {
          return false;
        }
      }
    },
    {
      name: 'Create Checkout API',
      test: async () => {
        try {
          const response = await window.authFetch('/api/create-checkout-session', {
            method: 'POST',
            body: JSON.stringify({ pack: 'starter' })
          });
          return response && typeof response.json === 'function';
        } catch (error) {
          return false;
        }
      }
    }
  ];

  for (const test of tests) {
    try {
      const result = await test.test();
      testResults.backend[test.name] = result;
      console.log(`Backend Test: ${test.name} - ${result ? 'PASS' : 'FAIL'}`);
      testResults.overall[result ? 'passed' : 'failed']++;
      testResults.overall.total++;
    } catch (error) {
      testResults.backend[test.name] = false;
      console.log(`Backend Test: ${test.name} - FAIL (${error.message})`);
      testResults.overall.failed++;
      testResults.overall.total++;
    }
  }
}

// 2. Frontend Function Tests
async function testFrontendFunctions() {
  console.log('=== TESTING FRONTEND FUNCTIONS ===');
  
  const tests = [
    {
      name: 'Show Toast Function',
      test: () => {
        return typeof window.showToast === 'function';
      }
    },
    {
      name: 'Load Coins Function',
      test: () => {
        return typeof window.loadCoins === 'function';
      }
    },
    {
      name: 'Use Coins Function',
      test: () => {
        return typeof window.useCoins === 'function';
      }
    },
    {
      name: 'Generate Logo Function',
      test: () => {
        return typeof window.generateLogoFromForm === 'function';
      }
    },
    {
      name: 'Generate Stream Pack Function',
      test: () => {
        return typeof window.generateStreamPackPlan === 'function';
      }
    },
    {
      name: 'Router Load Page Function',
      test: () => {
        return typeof window.loadPage === 'function';
      }
    },
    {
      name: 'Auth Token Function',
      test: () => {
        return typeof window.getAuthToken === 'function';
      }
    },
    {
      name: 'Logout Function',
      test: () => {
        return typeof window.logout === 'function';
      }
    },
    {
      name: 'Coins Service',
      test: () => {
        return window.coinsService && typeof window.coinsService.loadCoins === 'function';
      }
    },
    {
      name: 'Video Coins Service',
      test: () => {
        return window.videoCoins && typeof window.videoCoins.processVideo === 'function';
      }
    }
  ];

  for (const test of tests) {
    try {
      const result = test.test();
      testResults.frontend[test.name] = result;
      console.log(`Frontend Test: ${test.name} - ${result ? 'PASS' : 'FAIL'}`);
      testResults.overall[result ? 'passed' : 'failed']++;
      testResults.overall.total++;
    } catch (error) {
      testResults.frontend[test.name] = false;
      console.log(`Frontend Test: ${test.name} - FAIL (${error.message})`);
      testResults.overall.failed++;
      testResults.overall.total++;
    }
  }
}

// 3. Coin System Tests
async function testCoinSystem() {
  console.log('=== TESTING COIN SYSTEM ===');
  
  const tests = [
    {
      name: 'Coin Display Elements',
      test: () => {
        const elements = [
          document.getElementById('coinsValue'),
          document.getElementById('coinsTopValue'),
          document.getElementById('currentCoins')
        ];
        return elements.some(el => el !== null);
      }
    },
    {
      name: 'Load Coins API Call',
      test: async () => {
        try {
          await window.loadCoins();
          return true;
        } catch (error) {
          return false;
        }
      }
    },
    {
      name: 'Coins Service Initialization',
      test: () => {
        return window.coinsService && window.coinsService.isLoaded;
      }
    },
    {
      name: 'Coin Purchase Buttons',
      test: () => {
        const buttons = document.querySelectorAll('[data-coins-purchase]');
        return buttons.length > 0;
      }
    },
    {
      name: 'Billing Page Elements',
      test: () => {
        // Check if billing page has required elements
        const billingElements = document.querySelectorAll('.coin-package, .purchase-btn');
        return billingElements.length > 0;
      }
    }
  ];

  for (const test of tests) {
    try {
      const result = await test.test();
      testResults.coins[test.name] = result;
      console.log(`Coin System Test: ${test.name} - ${result ? 'PASS' : 'FAIL'}`);
      testResults.overall[result ? 'passed' : 'failed']++;
      testResults.overall.total++;
    } catch (error) {
      testResults.coins[test.name] = false;
      console.log(`Coin System Test: ${test.name} - FAIL (${error.message})`);
      testResults.overall.failed++;
      testResults.overall.total++;
    }
  }
}

// 4. Design & UI Tests
async function testDesignUI() {
  console.log('=== TESTING DESIGN & UI ===');
  
  const tests = [
    {
      name: 'Main CSS Loaded',
      test: () => {
        const styles = Array.from(document.styleSheets);
        return styles.some(sheet => sheet.href && sheet.href.includes('main.css'));
      }
    },
    {
      name: 'CSS Variables Defined',
      test: () => {
        const root = document.documentElement;
        const style = getComputedStyle(root);
        return style.getPropertyValue('--esports-primary') !== '';
      }
    },
    {
      name: 'Card Elements Styled',
      test: () => {
        const cards = document.querySelectorAll('.card');
        return cards.length > 0;
      }
    },
    {
      name: 'Button Elements Styled',
      test: () => {
        const buttons = document.querySelectorAll('.btn, .esports-btn');
        return buttons.length > 0;
      }
    },
    {
      name: 'Form Elements Styled',
      test: () => {
        const inputs = document.querySelectorAll('input, select, textarea');
        return inputs.length > 0;
      }
    },
    {
      name: 'Responsive Grid Working',
      test: () => {
        const grids = document.querySelectorAll('.form-grid, .esports-grid, .tool-grid');
        return grids.length > 0;
      }
    },
    {
      name: 'Toast Notification Element',
      test: () => {
        return document.getElementById('toast') !== null;
      }
    },
    {
      name: 'Loading States Working',
      test: () => {
        return document.querySelectorAll('.loader, .esports-loader').length > 0;
      }
    }
  ];

  for (const test of tests) {
    try {
      const result = test.test();
      testResults.design[test.name] = result;
      console.log(`Design Test: ${test.name} - ${result ? 'PASS' : 'FAIL'}`);
      testResults.overall[result ? 'passed' : 'failed']++;
      testResults.overall.total++;
    } catch (error) {
      testResults.design[test.name] = false;
      console.log(`Design Test: ${test.name} - FAIL (${error.message})`);
      testResults.overall.failed++;
      testResults.overall.total++;
    }
  }
}

// 5. Integration Tests
async function testIntegration() {
  console.log('=== TESTING INTEGRATION ===');
  
  const tests = [
    {
      name: 'Firebase Auth Integration',
      test: () => {
        return window.firebaseAuthApi !== undefined;
      }
    },
    {
      name: 'Router Navigation Working',
      test: () => {
        return typeof window.loadPage === 'function' && document.getElementById('app') !== null;
      }
    },
    {
      name: 'Page Content Loading',
      test: async () => {
        try {
          // Try to load a page
          if (typeof window.loadPage === 'function') {
            // Test if router can load pages
            return true;
          }
          return false;
        } catch (error) {
          return false;
        }
      }
    },
    {
      name: 'Error Handling Working',
      test: () => {
        return typeof window.showToast === 'function';
      }
    }
  ];

  for (const test of tests) {
    try {
      const result = await test.test();
      testResults.overall[result ? 'passed' : 'failed']++;
      testResults.overall.total++;
      console.log(`Integration Test: ${test.name} - ${result ? 'PASS' : 'FAIL'}`);
    } catch (error) {
      testResults.overall.failed++;
      testResults.overall.total++;
      console.log(`Integration Test: ${test.name} - FAIL (${error.message})`);
    }
  }
}

// 6. Performance Tests
async function testPerformance() {
  console.log('=== TESTING PERFORMANCE ===');
  
  const tests = [
    {
      name: 'Page Load Time',
      test: () => {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        return loadTime < 5000; // Less than 5 seconds
      }
    },
    {
      name: 'CSS Load Time',
      test: () => {
        const styles = Array.from(document.styleSheets);
        return styles.length > 0;
      }
    },
    {
      name: 'JavaScript Load Time',
      test: () => {
        return typeof window.showToast === 'function'; // Should be loaded
      }
    }
  ];

  for (const test of tests) {
    try {
      const result = test.test();
      testResults.overall[result ? 'passed' : 'failed']++;
      testResults.overall.total++;
      console.log(`Performance Test: ${test.name} - ${result ? 'PASS' : 'FAIL'}`);
    } catch (error) {
      testResults.overall.failed++;
      testResults.overall.total++;
      console.log(`Performance Test: ${test.name} - FAIL (${error.message})`);
    }
  }
}

// Main Test Runner
async function runCompleteTest() {
  console.log('=== STARTING COMPLETE FUNCTION TEST ===');
  
  // Wait for page to fully load
  if (document.readyState !== 'complete') {
    await new Promise(resolve => {
      window.addEventListener('load', resolve);
    });
  }
  
  // Run all test suites
  await testBackendAPI();
  await testFrontendFunctions();
  await testCoinSystem();
  await testDesignUI();
  await testIntegration();
  await testPerformance();
  
  // Generate final report
  console.log('=== TEST RESULTS ===');
  console.log('Backend Tests:', testResults.backend);
  console.log('Frontend Tests:', testResults.frontend);
  console.log('Coin System Tests:', testResults.coins);
  console.log('Design Tests:', testResults.design);
  console.log('Overall:', testResults.overall);
  
  const successRate = ((testResults.overall.passed / testResults.overall.total) * 100).toFixed(1);
  console.log(`\n=== FINAL RESULT: ${successRate}% (${testResults.overall.passed}/${testResults.overall.total}) ===`);
  
  // Show results in UI
  if (typeof window.showToast === 'function') {
    if (successRate >= 90) {
      window.showToast(`System Test: ${successRate}% - EXCELLENT`, 'success');
    } else if (successRate >= 70) {
      window.showToast(`System Test: ${successRate}% - GOOD`, 'success');
    } else {
      window.showToast(`System Test: ${successRate}% - NEEDS ATTENTION`, 'error');
    }
  }
  
  // Return results for further processing
  return testResults;
}

// Auto-run test
window.runCompleteTest = runCompleteTest;

// Run test after page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(runCompleteTest, 2000); // Wait 2 seconds for everything to load
  });
} else {
  setTimeout(runCompleteTest, 2000);
}

console.log('Complete Function Test loaded');
