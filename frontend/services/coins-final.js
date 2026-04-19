// Final Coins Service - Production Ready
console.log('=== Final Coins Service Initializing ===');

window.coinsService = {
  currentCoins: 0,
  isLoaded: false,

  async init() {
    console.log('Final coins service init...');
    try {
      await this.loadCoins();
      this.setupEventListeners();
      console.log('Final coins service ready');
    } catch (error) {
      console.error('Final coins service init failed:', error);
    }
  },

  async loadCoins() {
    try {
      console.log('Loading coins from production...');
      const response = await window.authFetch('/api/get-coins');
      
      if (!response || !response.ok) {
        throw new Error(`API Error: ${response?.status}`);
      }

      const data = await response.json();
      this.currentCoins = data.coins || 0;
      this.isLoaded = true;
      
      console.log('Coins loaded from production:', this.currentCoins);
      this.updateUI();
      return this.currentCoins;
    } catch (error) {
      console.error('Failed to load coins from production:', error);
      this.currentCoins = 0;
      this.updateUI();
      return 0;
    }
  },

  async purchaseCoins(packageType) {
    try {
      console.log(`Purchasing ${packageType} from production...`);
      
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

  async useCoins(amount) {
    try {
      console.log(`Using ${amount} coins...`);
      
      const response = await window.authFetch('/api/use-coins', {
        method: 'POST',
        body: JSON.stringify({ amount })
      });

      if (!response || !response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to use coins');
      }

      // Reload coins after successful use
      setTimeout(() => {
        this.loadCoins();
      }, 1000);

      return true;
    } catch (error) {
      console.error('Failed to use coins:', error);
      throw error;
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

    // Refresh coins when page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isLoaded) {
        this.loadCoins();
      }
    });

    // Auto-refresh coins every 30 seconds
    setInterval(() => {
      if (this.isLoaded) {
        this.loadCoins();
      }
    }, 30000);
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

// Export globally
window.loadCoins = () => window.coinsService.loadCoins();
window.useCoins = (amount) => window.coinsService.useCoins(amount);
window.refreshCoins = () => window.coinsService.refreshCoins();

console.log('Final Coins Service loaded');
