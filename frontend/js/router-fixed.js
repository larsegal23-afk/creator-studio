// Router Fixed - All Navigation Problems Resolved
console.log('=== Router Fixed Loading ===');

// Simple, reliable router
window.Router = {
  currentPage: null,
  appElement: null,
  
  init() {
    this.appElement = document.getElementById('app');
    if (!this.appElement) {
      console.error('App element not found');
      return;
    }
    
    // Handle initial route
    this.handleRoute();
    
    // Handle hash changes
    window.addEventListener('hashchange', () => {
      this.handleRoute();
    });
    
    console.log('Router initialized');
  },
  
  handleRoute() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    this.loadPage(hash);
  },
  
  async loadPage(route) {
    if (this.currentPage === route) {
      return; // Already on this page
    }
    
    console.log(`Loading page: ${route}`);
    
    // Show loading
    this.appElement.innerHTML = `
      <div class="card">
        <div class="loader"></div>
        <p>Lade Seite...</p>
      </div>
    `;
    
    try {
      let pageFile;
      
      // Route mapping
      switch (route) {
        case 'logo':
          pageFile = 'logo-final.html';
          break;
        case 'stream':
          pageFile = 'stream-final.html';
          break;
        case 'billing':
          pageFile = 'billing-simple.html';
          break;
        case 'video':
          pageFile = 'video.html';
          break;
        case 'dashboard':
          pageFile = 'dashboard-fixed.html';
          break;
        case 'login':
          pageFile = 'login.html';
          break;
        default:
          pageFile = 'dashboard.html';
      }
      
      // Load page content
      const response = await fetch(`pages/${pageFile}`);
      if (!response.ok) {
        throw new Error(`Page ${route} not found`);
      }
      
      const html = await response.text();
      this.appElement.innerHTML = html;
      this.currentPage = route;
      
      // Initialize page-specific functionality
      this.initializePage(route);
      
      // Update navigation
      this.updateNavigation(route);
      
      console.log(`Page ${route} loaded successfully`);
      
    } catch (error) {
      console.error('Failed to load page:', error);
      this.appElement.innerHTML = `
        <div class="card">
          <h3>Seite nicht gefunden</h3>
          <p class="muted">Die Seite "${route}" konnte nicht geladen werden.</p>
          <button class="btn primary" onclick="window.Router.loadPage('dashboard')">
            Zum Dashboard
          </button>
        </div>
      `;
    }
  },
  
  initializePage(route) {
    // Initialize page-specific functions
    setTimeout(() => {
      switch (route) {
        case 'logo':
          if (typeof window.initLogoPage === 'function') {
            window.initLogoPage();
          }
          break;
        case 'stream':
          if (typeof window.initStreamPage === 'function') {
            window.initStreamPage();
          }
          break;
        case 'video':
          if (typeof window.initVideoPage === 'function') {
            window.initVideoPage();
          }
          break;
        case 'dashboard':
          this.loadDashboardData();
          break;
      }
    }, 100);
  },
  
  updateNavigation(currentRoute) {
    // Update sidebar navigation
    const navButtons = document.querySelectorAll('.sidebar button');
    navButtons.forEach(button => {
      const buttonRoute = button.getAttribute('onclick')?.match(/loadPage\('([^']+)'\)/)?.[1];
      if (buttonRoute === currentRoute) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  },
  
  async loadDashboardData() {
    try {
      // Load coins
      if (typeof window.loadCoins === 'function') {
        await window.loadCoins();
      }
      
      // Load user stats
      const projects = JSON.parse(localStorage.getItem('creatorStudio.projects') || '[]');
      const projectsElement = document.getElementById('projectsValue');
      if (projectsElement) {
        projectsElement.textContent = projects.length;
      }
      
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  },
  
  // Global navigation function
  navigate(route) {
    window.location.hash = route;
  }
};

// Global loadPage function for backward compatibility
window.loadPage = function(route) {
  window.Router.navigate(route);
};

// Initialize router when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.Router.init();
});

console.log('Router Fixed loaded');
