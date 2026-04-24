// Stripe Preise dynamisch vom Backend laden
window.stripePrices = {
  currentPrices: null,
  
  async loadPrices() {
    try {
      const response = await window.authFetch("/api/stripe-prices");
      
      if (!response || !response.ok) {
        throw new Error(`API Error: ${response?.status}`);
      }
      
      const data = await response.json();
      this.currentPrices = data.packages;
      
      console.log('Stripe Preise geladen:', this.currentPrices);
      this.updatePricingDisplay();
      
      return this.currentPrices;
    } catch (error) {
      console.error('Fehler beim Laden der Stripe Preise:', error);
      this.showFallbackPrices();
    }
  },
  
  updatePricingDisplay() {
    if (!this.currentPrices) return;
    
    // Preise mit data-Attributen aktualisieren
    const starterAmount = document.querySelector('[data-package="starter-amount"]');
    const starterCoins = document.querySelector('[data-package="starter-coins"]');
    const proAmount = document.querySelector('[data-package="pro-amount"]');
    const proCoins = document.querySelector('[data-package="pro-coins"]');
    const ultimateAmount = document.querySelector('[data-package="ultimate-amount"]');
    const ultimateCoins = document.querySelector('[data-package="ultimate-coins"]');
    
    // Starter Paket
    if (starterAmount && this.currentPrices.starter) {
      starterAmount.textContent = this.currentPrices.starter.price.toFixed(2);
    }
    if (starterCoins && this.currentPrices.starter) {
      starterCoins.textContent = `${this.currentPrices.starter.coins} Coins`;
    }
    
    // Pro Paket
    if (proAmount && this.currentPrices.pro) {
      proAmount.textContent = this.currentPrices.pro.price.toFixed(2);
    }
    if (proCoins && this.currentPrices.pro) {
      proCoins.textContent = `${this.currentPrices.pro.coins} Coins`;
    }
    
    // Ultimate Paket
    if (ultimateAmount && this.currentPrices.ultimate) {
      ultimateAmount.textContent = this.currentPrices.ultimate.price.toFixed(2);
    }
    if (ultimateCoins && this.currentPrices.ultimate) {
      ultimateCoins.textContent = `${this.currentPrices.ultimate.coins} Coins`;
    }
  },
  
  showFallbackPrices() {
    // Fallback Preise falls API nicht erreichbar
    const fallbackPrices = {
      starter: { price: 4.99, coins: 50 },
      pro: { price: 9.99, coins: 150 },
      ultimate: { price: 19.99, coins: 500 }
    };
    
    this.currentPrices = fallbackPrices;
    this.updatePricingDisplay();
  },
  
  getPackagePrice(packageType) {
    return this.currentPrices?.[packageType] || null;
  }
};

// Automatisch laden wenn Seite bereit
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('billing')) {
    window.stripePrices.loadPrices();
  }
});
