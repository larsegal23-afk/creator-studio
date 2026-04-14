window.loadUser = async function loadUser() {
  const response = await window.authFetch("/api/get-coins");
  const coinValue = document.getElementById("coinsValue");
  const coinTop = document.getElementById("coinsTopValue");
  const projectValue = document.getElementById("projectsValue");

  if (!response || !response.ok) {
    if (coinValue) {
      coinValue.textContent = "-";
    }
    if (coinTop) {
      coinTop.textContent = "-";
    }
    if (projectValue) {
      projectValue.textContent = String(JSON.parse(localStorage.getItem("creatorStudio.projects") || "[]").length || 0);
    }
    return;
  }

  const payload = await response.json();
  const projects = JSON.parse(localStorage.getItem("creatorStudio.projects") || "[]");

  if (coinValue) {
    coinValue.textContent = String(payload.coins ?? 0);
  }

  if (coinTop) {
    coinTop.textContent = String(payload.coins ?? 0);
  }

  if (projectValue) {
    projectValue.textContent = String(projects.length);
  }
};

window.loadActivityFeed = async function loadActivityFeed() {
  const container = document.getElementById("activityFeed");
  if (!container) {
    return;
  }

  const response = await window.authFetch("/api/activity");

  if (!response || !response.ok) {
    container.innerHTML = `
      <div class="empty-state">
        Aktivitaeten konnten gerade nicht geladen werden.
      </div>
    `;
    return;
  }

  const entries = await response.json();

  if (!entries.length) {
    container.innerHTML = `
      <div class="empty-state">
        Noch keine Aktivitaeten vorhanden. Starte mit dem ersten Logo oder Streampack.
      </div>
    `;
    return;
  }

  container.innerHTML = entries.map((entry) => `
    <article class="activity-item">
      <div class="section-head">
        <div>
          <h3>${window.escapeHtml(entry.type || "Aktivitaet")}</h3>
          <p class="muted">${window.escapeHtml(entry.reference || "Ohne Referenz")}</p>
        </div>
        <strong>${entry.amount ?? 0} Coins</strong>
      </div>
    </article>
  `).join("");
};

window.buyCoins = async function buyCoins(pack) {
  const response = await window.authFetch("/api/create-checkout-session", {
    method: "POST",
    body: JSON.stringify({ pack })
  });

  if (!response || !response.ok) {
    window.showToast("Checkout konnte nicht gestartet werden.", "error");
    return;
  }

  const payload = await response.json();

  if (!payload?.url) {
    window.showToast("Keine Checkout-URL vom Backend erhalten.", "error");
    return;
  }

  window.location.href = payload.url;
};

window.renderProjectOverview = function renderProjectOverview() {
  const container = document.getElementById("projectOverview");
  if (!container) {
    return;
  }

  const projects = JSON.parse(localStorage.getItem("creatorStudio.projects") || "[]");

  if (!projects.length) {
    container.innerHTML = `
      <div class="empty-state">
        Noch keine lokalen Projektkarten gespeichert. Sobald du im Builder arbeitest, tauchen sie hier auf.
      </div>
    `;
    return;
  }

  container.innerHTML = projects.slice(0, 6).map((project) => `
    <article class="tool-card">
      <h3>${window.escapeHtml(project.name)}</h3>
      <p class="muted">${window.escapeHtml(project.type)}</p>
      <p>${window.escapeHtml(project.summary || "Ohne Zusammenfassung")}</p>
    </article>
  `).join("");
};

window.initDashboardPage = async function initDashboardPage() {
  await window.loadUser();
  await window.loadActivityFeed();
  window.renderProjectOverview();
};
