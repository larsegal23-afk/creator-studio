window.CreatorRoutes = {
  dashboard: {
    title: "Branding Studio",
    copy: "Zentrale fuer Logo, Stream Pack, Video Builder und Systemstatus.",
    protected: true,
    init: () => window.initDashboardPage?.()
  },
  logo: {
    title: "Mein Logo",
    copy: "Namensfeld, Stil-DNA, Farben und grosses Logo-Fenster wie in deiner Vorlage.",
    protected: true,
    init: () => window.initLogoPage?.()
  },
  "logo-dna": {
    title: "Logo DNA System",
    copy: "Identitaetsprofil mit Archetyp, Energie und sofort nutzbarem Prompt-Blueprint.",
    protected: true,
    init: () => window.initLogoDnaPage?.()
  },
  stream: {
    title: "Logo + Stream Pack",
    copy: "Auswahl fuer Facecam, Alerts, Layout und Sticker mit uebernommenem Stil.",
    protected: true,
    init: () => window.initStreamPage?.()
  },
  video: {
    title: "Video Upload und Creator Builder",
    copy: "Gameplay-Upload, Highlight Detection und Ausgabeformate in einer klaren Builder-Ansicht.",
    protected: true,
    init: () => window.initVideoPage?.()
  },
  system: {
    title: "System",
    copy: "Hintergrund, Deployment-Status und technische Uebersicht.",
    protected: true,
    init: () => window.initSystemPage?.()
  },
  login: {
    title: "Login",
    copy: "Firebase-Anmeldung fuer das Creator Studio.",
    protected: false,
    init: () => window.initLoginPage?.()
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
    { key: "dashboard", label: "Branding Studio", copy: "Cockpit und Uebersicht" },
    { key: "logo", label: "Mein Logo", copy: "Logo und Brand-DNA" },
    { key: "logo-dna", label: "Logo DNA System", copy: "Archetyp und DNA-Blueprint" },
    { key: "stream", label: "Stream Pack", copy: "Assets und Formate" },
    { key: "video", label: "Video Builder", copy: "Upload und Clip-Plan" },
    { key: "system", label: "System", copy: "Status und Hintergrund" }
  ];

  sidebar.innerHTML = `
    <section class="brand-block">
      <p class="brand-kicker">Creator Studio</p>
      <h1 class="brand-title">Branding und Video in einer klaren Struktur.</h1>
      <p class="brand-copy">Links die Module, rechts die Builder-Flaeche mit grossem Vorschaufenster wie in deinen Tabellen.</p>
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
      <p>${isAuthed ? "Backend angebunden und Studio entsperrt." : "Bitte zuerst einloggen, damit Coins und Backend-Module aktiv sind."}</p>
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
  const requestedRoute = window.CreatorRoutes[name] ? name : "dashboard";
  const route = window.CreatorRoutes[requestedRoute];
  const targetRoute = route.protected && !window.isLogged() ? "login" : requestedRoute;
  const target = window.CreatorRoutes[targetRoute];
  const app = document.getElementById("app");

  if (!app) {
    return;
  }

  window.__creatorCurrentRoute = targetRoute;
  window.renderSidebar(targetRoute);
  window.renderTopbar(targetRoute);

  app.innerHTML = `
    <div class="card">
      <div class="loader"></div>
    </div>
  `;

  try {
    const response = await fetch(`pages/${targetRoute}.html`);
    if (!response.ok) {
      throw new Error(`Page ${targetRoute} not found`);
    }

    app.innerHTML = await response.text();
    target.init?.();

    if (window.isLogged()) {
      window.loadUser?.();
    }
  } catch (error) {
    console.log("Route loading failed", error);
    app.innerHTML = `
      <div class="card">
        <h2>Seite konnte nicht geladen werden</h2>
        <p class="muted">Bitte pruefe die Projektdateien und lade die Route erneut.</p>
      </div>
    `;
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
