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
    
    // Render initial components (before route handling)
    const initialRoute = window.location.hash.slice(1) || 'dashboard';
    if (typeof window.renderTopbar === 'function') {
      window.renderTopbar(initialRoute);
    }
    if (typeof window.renderSidebar === 'function') {
      window.renderSidebar(initialRoute);
    }
    
    // Handle initial route
    this.handleRoute();
    
    // Handle hash changes
    window.addEventListener('hashchange', () => {
      this.handleRoute();
    });
    
    // Re-render components when auth state changes
    firebase.auth().onAuthStateChanged(() => {
      const currentRoute = window.location.hash.slice(1) || 'dashboard';
      if (typeof window.renderTopbar === 'function') {
        window.renderTopbar(currentRoute);
      }
      if (typeof window.renderSidebar === 'function') {
        window.renderSidebar(currentRoute);
      }
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
          pageFile = 'login-simple.html';
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
        case 'login':
          // Initialize login page handler
          setTimeout(() => {
            if (typeof window.initLoginPage === 'function') {
              window.initLoginPage();
            }
          }, 300);
          break;
      }
    }, 100);
  },
  
  updateNavigation(currentRoute) {
    // Render topbar and sidebar components
    if (typeof window.renderTopbar === 'function') {
      window.renderTopbar(currentRoute);
    }
    if (typeof window.renderSidebar === 'function') {
      window.renderSidebar(currentRoute);
    }
    
    // Update sidebar navigation active states
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      const itemRoute = item.getAttribute('href')?.replace('#', '');
      if (itemRoute === currentRoute) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
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
