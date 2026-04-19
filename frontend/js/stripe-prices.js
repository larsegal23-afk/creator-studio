// Stripe Preise dynamisch vom Backend laden
window.stripePrices = {
  currentPrices: null,
  
  async loadPrices() {
    try {
      const response = await window.authFetch("https://logomakergermany-ultimate-backend-production.up.railway.app/api/stripe-prices");
      
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
    const professionalAmount = document.querySelector('[data-package="professional-amount"]');
    const professionalCoins = document.querySelector('[data-package="professional-coins"]');
    const enterpriseAmount = document.querySelector('[data-package="enterprise-amount"]');
    const enterpriseCoins = document.querySelector('[data-package="enterprise-coins"]');
    
    // Starter Paket
    if (starterAmount && this.currentPrices.starter) {
      starterAmount.textContent = (this.currentPrices.starter.amount / 100).toFixed(2);
    }
    if (starterCoins && this.currentPrices.starter) {
      starterCoins.textContent = `${this.currentPrices.starter.coins} Coins`;
    }
    
    // Professional Paket
    if (professionalAmount && this.currentPrices.professional) {
      professionalAmount.textContent = (this.currentPrices.professional.amount / 100).toFixed(2);
    }
    if (professionalCoins && this.currentPrices.professional) {
      professionalCoins.textContent = `${this.currentPrices.professional.coins} Coins`;
    }
    
    // Enterprise Paket
    if (enterpriseAmount && this.currentPrices.enterprise) {
      enterpriseAmount.textContent = (this.currentPrices.enterprise.amount / 100).toFixed(2);
    }
    if (enterpriseCoins && this.currentPrices.enterprise) {
      enterpriseCoins.textContent = `${this.currentPrices.enterprise.coins} Coins`;
    }
  },
  
  showFallbackPrices() {
    // Fallback Preise falls API nicht erreichbar
    const fallbackPrices = {
      starter: { amount: 599, coins: 50 },
      professional: { amount: 1599, coins: 150 },
      enterprise: { amount: 4999, coins: 500 }
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
