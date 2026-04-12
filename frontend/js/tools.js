window.APP_CONFIG = {
  apiBase: "https://logomakergermany-ultimate-backend-production.up.railway.app"
};

window.CreatorState = {
  logoImage: "",
  uploadedLogo: "",
  uploadedVideoName: ""
};

window.escapeHtml = function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
};

function getStoredProjects() {
  try {
    return JSON.parse(localStorage.getItem("creatorStudio.projects") || "[]");
  } catch {
    return [];
  }
}

function setStoredProjects(projects) {
  localStorage.setItem("creatorStudio.projects", JSON.stringify(projects));
}

function saveLocalProject(project) {
  const projects = getStoredProjects();
  projects.unshift({
    id: Date.now(),
    createdAt: new Date().toISOString(),
    ...project
  });
  setStoredProjects(projects.slice(0, 20));
}

function getBrandDna() {
  try {
    return JSON.parse(localStorage.getItem("creatorStudio.brandDna") || "[]");
  } catch {
    return [];
  }
}

function setBrandDna(entries) {
  localStorage.setItem("creatorStudio.brandDna", JSON.stringify(entries));
}

function addBrandDna(entry) {
  const entries = getBrandDna();
  const nextEntries = [entry, ...entries].slice(0, 12);
  setBrandDna(nextEntries);
}

window.showToast = function showToast(message, type = "success") {
  const toast = document.getElementById("toast");

  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.className = `toast visible${type === "error" ? " error" : ""}`;

  window.clearTimeout(window.__creatorToastTimer);
  window.__creatorToastTimer = window.setTimeout(() => {
    toast.className = "toast";
  }, 2600);
};

window.getAuthToken = async function getAuthToken(forceRefresh = false) {
  try {
    if (window.firebaseAuthApi?.getToken) {
      return await window.firebaseAuthApi.getToken(forceRefresh);
    }
  } catch (error) {
    console.log("Token refresh failed", error);
  }

  return localStorage.getItem("token");
};

window.authFetch = async function authFetch(path, options = {}) {
  const token = await window.getAuthToken();

  if (!token) {
    window.handleLoggedOutState?.();
    return null;
  }

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`
  };

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(`${window.APP_CONFIG.apiBase}${path}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      await window.logout();
      return null;
    }

    return response;
  } catch (error) {
    console.log("API request failed", error);
    window.showToast("Netzwerkfehler beim Verbinden mit dem Backend.", "error");
    return null;
  }
};

window.logout = async function logout() {
  try {
    if (window.firebaseAuthApi?.logout) {
      await window.firebaseAuthApi.logout();
    }
  } catch (error) {
    console.log("Logout fallback", error);
  }

  localStorage.removeItem("token");
  window.handleLoggedOutState?.();
};

window.readFileAsDataUrl = function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

window.initLogoPage = function initLogoPage() {
  const generateButton = document.getElementById("generateLogoBtn");
  const uploadInput = document.getElementById("logoUpload");
  const reuseButton = document.getElementById("reuseDnaBtn");

  if (uploadInput) {
    uploadInput.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      window.CreatorState.uploadedLogo = await window.readFileAsDataUrl(file);
      const frame = document.getElementById("logoPreviewFrame");
      if (frame) {
        frame.innerHTML = `<img src="${window.CreatorState.uploadedLogo}" alt="Hochgeladenes Logo">`;
      }
    });
  }

  generateButton?.addEventListener("click", window.generateLogoFromForm);
  reuseButton?.addEventListener("click", () => {
    const entries = getBrandDna();
    if (!entries.length) {
      window.showToast("Noch keine gespeicherte DNA vorhanden.", "error");
      return;
    }

    window.fillLogoForm(entries[0]);
    window.showToast("Letzte Brand-DNA wurde in das Formular geladen.");
  });

  window.renderBrandDna();
};

window.fillLogoForm = function fillLogoForm(entry) {
  const mapping = {
    logoName: entry.brandName,
    logoClan: entry.clanName,
    logoGame: entry.game,
    logoStyle: entry.style,
    logoNotes: entry.notes
  };

  Object.entries(mapping).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.value = value || "";
    }
  });

  const selectedColors = new Set(entry.colors || []);
  document.querySelectorAll('input[name="logoColor"]').forEach((input) => {
    input.checked = selectedColors.has(input.value);
  });
};

window.renderBrandDna = function renderBrandDna() {
  const container = document.getElementById("dnaLibrary");

  if (!container) {
    return;
  }

  const entries = getBrandDna();

  if (!entries.length) {
    container.innerHTML = `
      <div class="empty-state">
        Noch keine Brand-DNA gespeichert. Generiere dein erstes Logo und wir merken uns Stil, Spiel und Farben.
      </div>
    `;
    return;
  }

  container.innerHTML = entries.map((entry, index) => `
    <article class="dna-item">
      <div class="section-head">
        <div>
          <h3>${window.escapeHtml(entry.brandName || "Unbenanntes Projekt")}</h3>
          <p class="muted">${window.escapeHtml(entry.game || "Game offen")} - ${window.escapeHtml(entry.style || "Style offen")}</p>
        </div>
        <button class="btn secondary" type="button" onclick="useBrandDna(${index})">Verwenden</button>
      </div>
      <div class="tag-list">
        ${(entry.colors || []).map((color) => `<span class="tag">${window.escapeHtml(color)}</span>`).join("")}
      </div>
    </article>
  `).join("");
};

window.useBrandDna = function useBrandDna(index) {
  const entries = getBrandDna();
  if (!entries[index]) {
    return;
  }

  window.fillLogoForm(entries[index]);
  window.showToast("Brand-DNA in das Formular uebernommen.");
};

window.generateLogoFromForm = async function generateLogoFromForm() {
  const brandName = document.getElementById("logoName")?.value.trim() || "";
  const clanName = document.getElementById("logoClan")?.value.trim() || "";
  const game = document.getElementById("logoGame")?.value || "";
  const style = document.getElementById("logoStyle")?.value || "";
  const notes = document.getElementById("logoNotes")?.value.trim() || "";
  const colors = Array.from(document.querySelectorAll('input[name="logoColor"]:checked')).map((input) => input.value);

  if (!brandName) {
    window.showToast("Bitte gib zuerst einen Namen fuer das Branding an.", "error");
    return;
  }

  const button = document.getElementById("generateLogoBtn");
  const result = document.getElementById("logoResult");
  const frame = document.getElementById("logoPreviewFrame");

  if (button) {
    button.disabled = true;
    button.textContent = "Generiere...";
  }

  if (result) {
    result.innerHTML = `<div class="loader"></div>`;
  }

  const promptParts = [
    `Create a premium esports logo for "${brandName}".`,
    clanName ? `Clan or agent name: ${clanName}.` : "",
    game ? `Game universe: ${game}.` : "",
    style ? `Visual style: ${style}.` : "",
    colors.length ? `Preferred colors: ${colors.join(", ")}.` : "",
    notes ? `Extra instructions: ${notes}.` : "",
    "High contrast, transparent-friendly composition, centered emblem, bold icon, clean text treatment."
  ].filter(Boolean);

  const response = await window.authFetch("/api/generate-logo", {
    method: "POST",
    body: JSON.stringify({ prompt: promptParts.join(" ") })
  });

  if (button) {
    button.disabled = false;
    button.textContent = "Generate Logo + Save DNA";
  }

  if (!response || !response.ok) {
    const errorPayload = response ? await response.json().catch(() => null) : null;
    const message = errorPayload?.error === "NO_COINS"
      ? "Nicht genug Coins fuer eine Logo-Generierung."
      : "Logo konnte nicht generiert werden.";
    window.showToast(message, "error");
    if (result) {
      result.innerHTML = `<div class="empty-state">${window.escapeHtml(message)}</div>`;
    }
    return;
  }

  const payload = await response.json();
  window.CreatorState.logoImage = payload.image || "";

  if (frame && window.CreatorState.logoImage) {
    frame.innerHTML = `<img src="${window.CreatorState.logoImage}" alt="Generiertes Logo">`;
  }

  addBrandDna({ brandName, clanName, game, style, colors, notes });
  window.renderBrandDna();

  saveLocalProject({
    name: brandName,
    type: "Logo",
    summary: `${game || "Game offen"} - ${style || "Style offen"}`
  });

  if (result) {
    result.innerHTML = `
      <div class="result-card">
        <h3>${window.escapeHtml(brandName)}</h3>
        <p class="muted">Deine Brand-DNA wurde gespeichert. Das Ergebnisfenster rechts zeigt das frische Logo an.</p>
        <div class="actions-row">
          <button class="btn secondary" type="button" onclick="downloadGeneratedLogo()">Download Logo</button>
          <button class="btn secondary" type="button" onclick="copyLogoPrompt()">Prompt kopieren</button>
        </div>
      </div>
    `;
  }

  window.loadUser?.();
  window.showToast("Logo generiert und Brand-DNA gespeichert.");
};

window.downloadGeneratedLogo = function downloadGeneratedLogo() {
  if (!window.CreatorState.logoImage) {
    window.showToast("Noch kein Logo zum Download vorhanden.", "error");
    return;
  }

  const link = document.createElement("a");
  link.href = window.CreatorState.logoImage;
  link.download = "creator-studio-logo.png";
  link.click();
};

window.copyLogoPrompt = async function copyLogoPrompt() {
  const brandName = document.getElementById("logoName")?.value.trim() || "";
  const clanName = document.getElementById("logoClan")?.value.trim() || "";
  const game = document.getElementById("logoGame")?.value || "";
  const style = document.getElementById("logoStyle")?.value || "";
  const colors = Array.from(document.querySelectorAll('input[name="logoColor"]:checked')).map((input) => input.value);
  const prompt = [
    `Brand: ${brandName || "-"}`,
    `Clan/Agent: ${clanName || "-"}`,
    `Game: ${game || "-"}`,
    `Style: ${style || "-"}`,
    `Farben: ${colors.join(", ") || "-"}`
  ].join("\n");

  await navigator.clipboard.writeText(prompt);
  window.showToast("Prompt-Zusammenfassung in die Zwischenablage kopiert.");
};

window.initStreamPage = function initStreamPage() {
  document.getElementById("generateStreamBtn")?.addEventListener("click", window.generateStreamPackPlan);
};

window.generateStreamPackPlan = function generateStreamPackPlan() {
  const brandName = document.getElementById("streamBrandName")?.value.trim() || "";
  const assetTypes = Array.from(document.querySelectorAll('input[name="streamAsset"]:checked')).map((input) => input.value);
  const formatTypes = Array.from(document.querySelectorAll('input[name="streamFormat"]:checked')).map((input) => input.value);

  if (!brandName) {
    window.showToast("Bitte gib einen Namen fuer das Streampack an.", "error");
    return;
  }

  const preview = document.getElementById("streamPreview");
  const downloadArea = document.getElementById("streamDownloadArea");
  const selectedAssets = assetTypes.length ? assetTypes : ["Facecam Rahmen", "Alerts", "Layout"];
  const selectedFormats = formatTypes.length ? formatTypes : ["16:9"];

  saveLocalProject({
    name: brandName,
    type: "Stream Pack",
    summary: `${selectedAssets.length} Assets - ${selectedFormats.join(", ")}`
  });

  if (preview) {
    preview.innerHTML = `
      <div class="result-card">
        <h3>${window.escapeHtml(brandName)} Stream Pack</h3>
        <p class="muted">Das Paket wurde als saubere Produktionsvorlage vorbereitet und kann jetzt als Aufgabenliste oder Design-Briefing genutzt werden.</p>
        <div class="tag-list">
          ${selectedAssets.map((asset) => `<span class="tag">${window.escapeHtml(asset)}</span>`).join("")}
        </div>
        <ul class="mini-list list-reset">
          ${selectedFormats.map((format) => `<li>${window.escapeHtml(format)} Ausgabeformat geplant</li>`).join("")}
        </ul>
      </div>
    `;
  }

  if (downloadArea) {
    downloadArea.innerHTML = `
      <div class="empty-state">
        Das Backend fuer ZIP-Export ist in dieser Frontend-Version noch nicht aktiv. Die Auswahl ist aber gespeichert und die Struktur laeuft jetzt ohne Fehler.
      </div>
    `;
  }

  window.showToast("Stream-Pack-Konzept erstellt.");
};

window.initVideoPage = function initVideoPage() {
  const input = document.getElementById("videoFile");
  const button = document.getElementById("generateVideoBtn");

  input?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    window.CreatorState.uploadedVideoName = file?.name || "";

    const meta = document.getElementById("videoFileMeta");
    if (meta) {
      meta.textContent = file
        ? `${file.name} - ${Math.round(file.size / 1024 / 1024)} MB`
        : "Noch kein Video ausgewaehlt";
    }
  });

  button?.addEventListener("click", window.generateVideoPlan);
};

window.generateVideoPlan = function generateVideoPlan() {
  const title = document.getElementById("videoTitle")?.value.trim() || "";
  const highlightTypes = Array.from(document.querySelectorAll('input[name="highlightType"]:checked')).map((input) => input.value);
  const outputFormats = Array.from(document.querySelectorAll('input[name="outputFormat"]:checked')).map((input) => input.value);
  const result = document.getElementById("videoPlanResult");

  if (!window.CreatorState.uploadedVideoName) {
    window.showToast("Bitte zuerst ein Gameplay-Video auswaehlen.", "error");
    return;
  }

  saveLocalProject({
    name: title || window.CreatorState.uploadedVideoName,
    type: "Video Builder",
    summary: `${highlightTypes.length || 1} Highlight-Typen - ${outputFormats.length || 1} Formate`
  });

  if (result) {
    result.innerHTML = `
      <div class="result-card">
        <h3>${window.escapeHtml(title || "Video Builder Auftrag")}</h3>
        <p class="muted">Upload registriert: ${window.escapeHtml(window.CreatorState.uploadedVideoName)}</p>
        <ul class="mini-list list-reset">
          <li>Highlight Detection: ${(highlightTypes.length ? highlightTypes : ["Action Scenes"]).map(window.escapeHtml).join(", ")}</li>
          <li>Ausgabeformate: ${(outputFormats.length ? outputFormats : ["TikTok 9:16"]).map(window.escapeHtml).join(", ")}</li>
          <li>Naechster Schritt: Thumbnail oder Mini-Player auf Basis des Uploads ausgeben</li>
        </ul>
      </div>
    `;
  }

  window.showToast("Video-Builder-Vorlage erstellt.");
};

window.initSystemPage = async function initSystemPage() {
  const statusTarget = document.getElementById("backendStatus");
  if (!statusTarget) {
    return;
  }

  try {
    const response = await fetch(`${window.APP_CONFIG.apiBase}/api/test`);
    const payload = await response.json();
    const isOk = Boolean(payload?.status === "running");
    statusTarget.innerHTML = `
      <div class="status-panel">
        <div class="section-head">
          <div>
            <h3>Backend Status</h3>
            <p class="muted">Railway Deployment und Kernservices</p>
          </div>
          <span class="status-dot ${isOk ? "ok" : "error"}"></span>
        </div>
        <ul class="mini-list list-reset">
          <li>Server: ${isOk ? "erreichbar" : "nicht erreichbar"}</li>
          <li>Firebase: ${payload?.firebase ? "verbunden" : "nicht bestaetigt"}</li>
          <li>OpenAI: ${payload?.openai ? "konfiguriert" : "nicht bestaetigt"}</li>
        </ul>
      </div>
    `;
  } catch (error) {
    statusTarget.innerHTML = `
      <div class="status-panel">
        <div class="section-head">
          <div>
            <h3>Backend Status</h3>
            <p class="muted">Die API konnte gerade nicht geprueft werden.</p>
          </div>
          <span class="status-dot error"></span>
        </div>
      </div>
    `;
  }
};
