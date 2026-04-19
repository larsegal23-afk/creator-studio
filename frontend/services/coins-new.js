// Coins Service - Simplified and Working
console.log('=== Coins Service Initializing ===');

window.coinsService = {
  currentCoins: 0,
  isLoaded: false,

  async init() {
    console.log('Coins service init...');
    try {
      await this.loadCoins();
      this.setupEventListeners();
      console.log('Coins service ready');
    } catch (error) {
      console.error('Coins service init failed:', error);
    }
  },

  async loadCoins() {
    try {
      console.log('Loading coins...');
      const response = await window.authFetch('/api/get-coins');
      
      if (!response || !response.ok) {
        throw new Error(`API Error: ${response?.status}`);
      }

      const data = await response.json();
      this.currentCoins = data.coins || 0;
      this.isLoaded = true;
      
      console.log('Coins loaded:', this.currentCoins);
      this.updateUI();
      return this.currentCoins;
    } catch (error) {
      console.error('Failed to load coins:', error);
      this.currentCoins = 0;
      this.updateUI();
      return 0;
    }
  },

  async purchaseCoins(packageType) {
    try {
      console.log(`Purchasing ${packageType}...`);
      
      const packages = {
        starter: { name: 'Starter', coins: 50 },
        professional: { name: 'Professional', coins: 150 },
        enterprise: { name: 'Enterprise', coins: 500 }
      };

      const selectedPackage = packages[packageType];
      if (!selectedPackage) {
        throw new Error('Invalid package type');
      }

      window.showToast(`Starte Kauf von ${selectedPackage.name}...`, 'info');

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

      window.location.href = session.url;

    } catch (error) {
      console.error('Coin purchase failed:', error);
      window.showToast('Kauf fehlgeschlagen. Bitte erneut versuchen.', 'error');
    }
  },

  updateUI() {
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

    console.log('UI updated with coins:', this.currentCoins);
  },

  setupEventListeners() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-coins-purchase]');
      if (button) {
        const packageType = button.dataset.coinsPurchase;
        this.purchaseCoins(packageType);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isLoaded) {
        this.loadCoins();
      }
    });
  },

  getCoins() {
    return this.currentCoins;
  },

  async refreshCoins() {
    return await this.loadCoins();
  }
};

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.coinsService.init());
} else {
  window.coinsService.init();
}

// Legacy compatibility
window.loadUser = async function() {
  return await window.coinsService.loadCoins();
};

window.buyCoins = async function(pack) {
  return await window.coinsService.purchaseCoins(pack);
};
