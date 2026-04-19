window.CreatorRoutes = {
  dashboard: {
    title: "Branding Studio",
    copy: "Zentrale fuer Logo, Stream und Video.",
    protected: true,
    init: () => window.initDashboardPage?.()
  },
  logo: {
    title: "Mein Logo",
    copy: "Logo erstellen, Varianten testen, DNA speichern.",
    protected: true,
    init: () => window.initLogoPage?.()
  },
  "logo-dna": {
    title: "Logo DNA System",
    copy: "Markenprofil und Prompt-Blueprint.",
    protected: true,
    init: () => window.initLogoDnaPage?.()
  },
  stream: {
    title: "Logo + Stream Pack",
    copy: "Stream-Assets im selben Markenstil.",
    protected: true,
    init: () => window.initStreamPage?.()
  },
  video: {
    title: "Video Builder",
    copy: "Highlights erkennen, Clips waehlen, Short exportieren.",
    protected: true,
    init: () => window.initVideoPage?.()
  },
  login: {
    title: "Login",
    copy: "Sicher anmelden und direkt starten.",
    protected: false,
    init: () => window.initLoginPage?.()
  },
  billing: {
    title: "Coins",
    copy: "Coins aufladen und verwalten.",
    protected: true,
    init: () => window.coinsManager?.init?.()
  }
};

window.getCurrentRoute = function getCurrentRoute() {
  return window.__creatorCurrentRoute || "dashboard";
};

window.isLogged = function isLogged() {
  return Boolean(localStorage.getItem("token"));
};

window.renderSidebar = function renderSidebar(activeRoute) {
  const sidebar = document.getElementById("sidebar");

  if (!sidebar) {
    return;
  }

  const isAuthed = window.isLogged();
  const navItems = [
    { key: "dashboard", label: "Dashboard", copy: "Uebersicht" },
    { key: "logo", label: "Logo", copy: "Logo und DNA" },
    { key: "logo-dna", label: "DNA", copy: "Profil und Blueprint" },
    { key: "stream", label: "Stream Pack", copy: "Assets und Formate" },
    { key: "video", label: "Video", copy: "Highlights und Export" },
    { key: "billing", label: "Coins", copy: "Kauf und Verwaltung" }
  ];

  sidebar.innerHTML = `
    <section class="brand-block">
      <p class="brand-kicker">Creator Studio</p>
      <h1 class="brand-title">Branding. Video. Ergebnis.</h1>
      <p class="brand-copy">Klare Module, schneller Workflow.</p>
    </section>

    <nav class="sidebar-nav">
      ${navItems.map((item, index) => `
        <button
          class="nav-button ${activeRoute === item.key ? "active" : ""}"
          type="button"
          ${!isAuthed ? "disabled" : ""}
          onclick="loadPage('${item.key}')"
        >
          <span class="nav-label">
            <strong>${item.label}</strong>
            <span>${item.copy}</span>
          </span>
          <span class="nav-index">0${index + 1}</span>
        </button>
      `).join("")}
    </nav>

    <div class="sidebar-footer">
      <p>${isAuthed ? "Studio aktiv." : "Bitte einloggen."}</p>
      ${isAuthed
        ? '<button class="btn ghost" type="button" onclick="logout()">Logout</button>'
        : '<button class="btn secondary" type="button" onclick="loadPage(\'login\')">Zum Login</button>'}
    </div>
  `;
};

window.renderTopbar = function renderTopbar(routeName) {
  const topbar = document.getElementById("topbar");
  const route = window.CreatorRoutes[routeName] || window.CreatorRoutes.dashboard;

  if (!topbar) {
    return;
  }

  topbar.innerHTML = `
    <div>
      <h2 class="topbar-title">${route.title}</h2>
      <p class="topbar-copy">${route.copy}</p>
    </div>
    <div class="topbar-right">
      <div class="pill">Coins: <strong id="coinsTopValue">-</strong></div>
      <div class="pill">${window.isLogged() ? "Live verbunden" : "Gastmodus"}</div>
    </div>
  `;
};

window.handleLoggedOutState = function handleLoggedOutState() {
  window.renderSidebar("login");
  window.renderTopbar("login");
  window.loadPage("login");
};

window.loadPage = async function loadPage(name) {
  try {
    // Route validation
    const requestedRoute = window.CreatorRoutes[name] ? name : "dashboard";
    const route = window.CreatorRoutes[requestedRoute];
    
    if (!route) {
      throw new Error(`Route ${requestedRoute} not found`);
    }

    // Authentication guard
    const targetRoute = route.protected && !window.isLogged() ? "login" : requestedRoute;
    const target = window.CreatorRoutes[targetRoute];
    
    if (!target) {
      throw new Error(`Target route ${targetRoute} not found`);
    }

    // DOM elements check
    const app = document.getElementById("app");
    if (!app) {
      throw new Error("App container not found");
    }

    // Update navigation state
    window.__creatorCurrentRoute = targetRoute;
    window.renderSidebar(targetRoute);
    window.renderTopbar(targetRoute);

    // Loading state
    app.innerHTML = `
      <div class="card">
        <div class="loader"></div>
        <p>Lade Seite...</p>
      </div>
    `;

    // Load page content
    const pageFile = targetRoute === 'billing' ? 'billing-standalone.html' : 
                     targetRoute === 'logo' ? 'logo-final.html' : 
                     targetRoute === 'stream' ? 'stream-final.html' : 
                     `${targetRoute}.html`;
    const response = await fetch(`pages/${pageFile}`);
    if (!response.ok) {
      throw new Error(`Page ${targetRoute} not found`);
    }

    const html = await response.text();
    app.innerHTML = html;

    // Initialize page
    if (typeof target.init === 'function') {
      await target.init();
    }

    // Load user data if authenticated
    if (window.isLogged() && typeof window.loadUser === 'function') {
      await window.loadUser();
    }

  } catch (error) {
    console.error("Route loading failed:", error);
    ErrorHandler?.log(error, `Router: ${name}`);
    
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `
        <div class="card">
          <h2>Seite konnte nicht geladen werden</h2>
          <p class="muted">Fehler: ${error.message}</p>
          <button class="btn primary" onclick="loadPage('dashboard')">Zum Dashboard</button>
        </div>
      `;
    }
  }
};

window.addEventListener("creator-auth-changed", async (event) => {
  const nextRoute = event.detail?.user ? window.getCurrentRoute() : "login";
  window.renderSidebar(nextRoute);
  window.renderTopbar(nextRoute);
  await window.loadPage(nextRoute === "login" && event.detail?.user ? "dashboard" : nextRoute);
});

window.addEventListener("load", async () => {
  await window.firebaseAuthReady;
  const startRoute = window.isLogged() ? "dashboard" : "login";
  window.renderSidebar(startRoute);
  window.renderTopbar(startRoute);
  await window.loadPage(startRoute);
});
