// Sidebar Component with Navigation
window.loadSidebar = function loadSidebar(route = window.getCurrentRoute?.() || "dashboard") {
  window.renderSidebar?.(route);
};

window.renderSidebar = function renderSidebar(route) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const user = firebase.auth().currentUser;
  
  if (!user) {
    // Nicht eingeloggt - zeige nur Branding
    sidebar.innerHTML = `
      <div class="sidebar-branding">
        <h1>Creator Studio</h1>
        <p class="muted">Logo & Video Tools</p>
      </div>
      <div class="sidebar-footer">
        <button class="btn primary full-width" onclick="window.loadPage('login')">
          Anmelden
        </button>
      </div>
    `;
    return;
  }

  // Eingeloggt - zeige volle Navigation
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'logo', label: 'Logo Generator', icon: '🎨' },
    { id: 'stream', label: 'Stream Assets', icon: '🎬' },
    { id: 'video', label: 'Video Tools', icon: '📹' },
    { id: 'billing', label: 'Coins & Billing', icon: '🪙' }
  ];

  sidebar.innerHTML = `
    <div class="sidebar-branding">
      <h1>Creator Studio</h1>
      <p class="muted">Logo & Video Tools</p>
    </div>
    <nav class="sidebar-nav">
      ${navItems.map(item => `
        <a href="#${item.id}" 
           class="nav-item ${route === item.id ? 'active' : ''}"
           onclick="window.loadPage('${item.id}'); return false;">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
        </a>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <div class="user-info">
        <span class="user-email-small">${user.email || 'User'}</span>
      </div>
      <button class="btn secondary full-width" onclick="window.logout()">
        Abmelden
      </button>
    </div>
  `;
};
