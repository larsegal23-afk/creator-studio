// Coins System - Direct Stripe Integration
console.log('=== Coins System Initializing ===');

class CoinsManager {
  constructor() {
    this.currentCoins = 0;
    this.isLoaded = false;
    this.listeners = [];
  }

  async init() {
    try {
      console.log('Initializing coins system...');
      await this.loadCoins();
      this.setupEventListeners();
      console.log('Coins system initialized');
    } catch (error) {
      console.error('Failed to initialize coins system:', error);
    }
  }

  async loadCoins() {
    try {
      const response = await window.authFetch('/api/get-coins');
      
      if (!response || !response.ok) {
        throw new Error(`API Error: ${response?.status}`);
      }

      const data = await response.json();
      this.currentCoins = data.coins || 0;
      this.isLoaded = true;
      
      this.updateUI();
      this.notifyListeners();
      
      console.log('Coins loaded:', this.currentCoins);
      return this.currentCoins;
    } catch (error) {
      console.error('Failed to load coins:', error);
      this.currentCoins = 0;
      this.updateUI();
      return 0;
    }
  }

  async purchaseCoins(packageType) {
    try {
      console.log(`Purchasing ${packageType} package...`);
      
      const packages = {
        starter: { name: 'Starter', coins: 50, price: '4,99€' },
        professional: { name: 'Professional', coins: 150, price: '12,99€' },
        enterprise: { name: 'Enterprise', coins: 500, price: '39,99€' }
      };

      const selectedPackage = packages[packageType];
      if (!selectedPackage) {
        throw new Error('Invalid package type');
      }

      // Show loading state
      window.showToast(`Starte Kauf von ${selectedPackage.name} Paket...`, 'info');

      // Create Stripe checkout session
      const response = await window.authFetch('/api/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ pack: packageType })
      });

      if (!response || !response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const session = await response.json();
      
      if (!session.url) {
        throw new Error('No checkout URL received');
      }

      // Redirect to Stripe Checkout
      window.location.href = session.url;

    } catch (error) {
      console.error('Coin purchase failed:', error);
      window.showToast('Kauf fehlgeschlagen. Bitte erneut versuchen.', 'error');
    }
  }

  updateUI() {
    // Update all coin displays
    const coinElements = [
      document.getElementById('coinsValue'),
      document.getElementById('coinsTopValue'),
      document.getElementById('currentCoins')
    ].filter(Boolean);

    coinElements.forEach(element => {
      if (element) {
        element.textContent = this.currentCoins.toLocaleString('de-DE');
      }
    });

    // Update purchase buttons state
    this.updatePurchaseButtons();
  }

  updatePurchaseButtons() {
    const purchaseButtons = document.querySelectorAll('[data-coins-purchase]');
    
    purchaseButtons.forEach(button => {
      const packageType = button.dataset.coinsPurchase;
      const packages = {
        starter: { coins: 50 },
        professional: { coins: 150 },
        enterprise: { coins: 500 }
      };

      const packageInfo = packages[packageType];
      if (packageInfo) {
        button.disabled = false;
        button.textContent = `${packageInfo.coins} Coins kaufen`;
      }
    });
  }

  setupEventListeners() {
    // Purchase button listeners
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-coins-purchase]');
      if (button) {
        const packageType = button.dataset.coinsPurchase;
        this.purchaseCoins(packageType);
      }
    });

    // Auto-refresh coins when page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isLoaded) {
        this.loadCoins();
      }
    });
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  notifyListeners() {
    this.listeners.forEach(callback => callback(this.currentCoins));
  }

  getCoins() {
    return this.currentCoins;
  }

  async refreshCoins() {
    return await this.loadCoins();
  }
}

// Global coins manager instance
window.coinsManager = new CoinsManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.coinsManager.init());
} else {
  window.coinsManager.init();
}

// Export for legacy compatibility
window.loadUser = async function() {
  return await window.coinsManager.loadCoins();
};

window.buyCoins = async function(pack) {
  return await window.coinsManager.purchaseCoins(pack);
};
