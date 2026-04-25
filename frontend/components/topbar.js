// Topbar Component with Auth UI
window.loadTopbar = function loadTopbar(route = window.getCurrentRoute?.() || "dashboard") {
  window.renderTopbar?.(route);
};

window.renderTopbar = function renderTopbar(route) {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;

  const user = firebase.auth().currentUser;
  
  if (user) {
    // Eingeloggt - zeige User-Menü
    topbar.innerHTML = `
      <div class="topbar-content">
        <div class="topbar-left">
          <span class="route-label">${route.charAt(0).toUpperCase() + route.slice(1)}</span>
        </div>
        <div class="topbar-right">
          <div class="coins-display">
            <span class="coins-icon">🪙</span>
            <span id="coinsTopValue">-</span>
          </div>
          <div class="user-menu">
            <button class="user-button" onclick="window.toggleUserMenu()">
              <span class="user-avatar">${user.email?.charAt(0).toUpperCase() || 'U'}</span>
              <span class="user-email">${user.email || 'User'}</span>
              <span class="dropdown-arrow">▼</span>
            </button>
            <div id="userDropdown" class="user-dropdown" style="display: none;">
              <a href="#dashboard" onclick="window.loadPage('dashboard')">Dashboard</a>
              <a href="#billing" onclick="window.loadPage('billing')">Coins kaufen</a>
              <hr>
              <a href="#" onclick="window.logout(); return false;">Abmelden</a>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Lade Coins für Anzeige
    window.loadCoins?.();
    
  } else {
    // Nicht eingeloggt - zeige Login Button
    topbar.innerHTML = `
      <div class="topbar-content">
        <div class="topbar-left">
          <span class="route-label">${route.charAt(0).toUpperCase() + route.slice(1)}</span>
        </div>
        <div class="topbar-right">
          <button class="btn primary" onclick="window.loadPage('login')">
            Anmelden
          </button>
        </div>
      </div>
    `;
  }
};

window.toggleUserMenu = function toggleUserMenu() {
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  }
};

// Schließe Dropdown wenn außerhalb geklickt
document.addEventListener('click', function(e) {
  const userMenu = e.target.closest('.user-menu');
  const dropdown = document.getElementById('userDropdown');
  if (!userMenu && dropdown) {
    dropdown.style.display = 'none';
  }
});
