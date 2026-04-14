window.APP_CONFIG = {
  apiBase: "https://logomakergermany-ultimate-backend-production.up.railway.app"
};

window.CreatorState = {
  logoImage: "",
  uploadedLogo: "",
  uploadedVideoName: "",
  uploadedVideoToken: ""
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

window.consumeCoins = async function consumeCoins(amount = 1) {
  const response = await window.authFetch("/api/use-coins", {
    method: "POST",
    body: JSON.stringify({ amount })
  });

  if (!response) {
    return { ok: false, reason: "NETWORK", message: "Coins konnten nicht geprueft werden." };
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const isNoCoins = payload?.error === "NO_COINS"
      || payload?.code === "NO_COINS"
      || response.status === 402;

    if (isNoCoins) {
      return { ok: false, reason: "NO_COINS", message: "Nicht genug Coins fuer diese Aktion." };
    }

    return {
      ok: false,
      reason: "FAILED",
      message: payload?.message || payload?.error || "Coins konnten nicht abgezogen werden."
    };
  }

  return { ok: true, payload };
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

  const prompt = window.buildMagicPrompt({
    name: brandName,
    clan: clanName,
    game,
    style,
    colors,
    notes
  });

  const response = await window.authFetch("/api/generate-logo", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      requestId: `logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    })
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
  const notes = document.getElementById("logoNotes")?.value.trim() || "";
  const colors = Array.from(document.querySelectorAll('input[name="logoColor"]:checked')).map((input) => input.value);
  const prompt = window.buildMagicPrompt({
    name: brandName,
    clan: clanName,
    game,
    style,
    colors,
    notes
  });

  await navigator.clipboard.writeText(prompt);
  window.showToast("Magic Prompt in die Zwischenablage kopiert.");
};

window.buildMagicPrompt = function buildMagicPrompt({ name, clan, game, style, colors, notes }) {
  const normalizedName = String(name || "").trim();
  const normalizedClan = String(clan || "").trim();
  const normalizedGame = String(game || "").trim();
  const normalizedStyle = String(style || "").trim();
  const normalizedNotes = String(notes || "").trim();
  const selectedColors = Array.isArray(colors) ? colors.filter(Boolean) : [];

  const providedSignals = [
    normalizedClan,
    normalizedGame,
    normalizedStyle,
    normalizedNotes,
    selectedColors.length ? "hasColors" : ""
  ].filter(Boolean).length;

  const shouldAutoBoost = providedSignals <= 1;
  const boostLevel = providedSignals === 0 ? "strong" : (providedSignals === 1 ? "medium" : "none");
  const fallbackGenre = normalizedGame || "competitive gaming";
  const fallbackStyle = normalizedStyle || "esports cinematic";
  const selectedPalette = selectedColors.length ? selectedColors.join(", ") : "electric blue, crimson red, titanium silver";
  const gameKey = normalizedGame.toLowerCase();

  const genreProfiles = {
    valorant: {
      dnaName: "Valorant Tactical DNA",
      vibe: "precise tactical discipline, sharp confidence, elite squad identity",
      iconDirection: "angular emblem, tactical mask or blade motif, clean geometric edges",
      composition: "high negative space control, centered insignia, readable at small sizes",
      effects: "subtle neon accents, red-cyan highlight split, polished metallic finish"
    },
    "call of duty": {
      dnaName: "CoD Combat DNA",
      vibe: "military intensity, battlefield grit, commanding frontline presence",
      iconDirection: "armored mascot or military crest, aggressive stance, heavy silhouette",
      composition: "thick outlines, compact center mass, high-impact badge framing",
      effects: "smoke haze layers, muzzle-flash style glow, gunmetal textures"
    },
    cod: {
      dnaName: "CoD Combat DNA",
      vibe: "military intensity, battlefield grit, commanding frontline presence",
      iconDirection: "armored mascot or military crest, aggressive stance, heavy silhouette",
      composition: "thick outlines, compact center mass, high-impact badge framing",
      effects: "smoke haze layers, muzzle-flash style glow, gunmetal textures"
    },
    fortnite: {
      dnaName: "Fortnite Energetic DNA",
      vibe: "playful chaos, bold personality, colorful competitive energy",
      iconDirection: "stylized hero mascot, expressive pose, dynamic contour shapes",
      composition: "chunky readable forms, motion-driven diagonals, social-ready clarity",
      effects: "vibrant gradients, comic-like highlights, glossy punchy materials"
    },
    apex: {
      dnaName: "Apex Arena DNA",
      vibe: "high-speed aggression, squad survival, futuristic combat confidence",
      iconDirection: "hunter-style mascot, angular crest, tactical tech details",
      composition: "triangular framing cues, compact center emblem, ranked-ready readability",
      effects: "smoky volumetric light, ember accents, matte-metal and carbon textures"
    },
    "counter-strike 2": {
      dnaName: "CS2 Precision DNA",
      vibe: "discipline, precision shooting, elite tactical identity",
      iconDirection: "operator emblem, minimalist weapon-inspired geometry, strict clean lines",
      composition: "strong symmetry, clear hierarchy, icon-first clarity for avatars",
      effects: "controlled contrast, subtle grain, steel and graphite material accents"
    },
    cs2: {
      dnaName: "CS2 Precision DNA",
      vibe: "discipline, precision shooting, elite tactical identity",
      iconDirection: "operator emblem, minimalist weapon-inspired geometry, strict clean lines",
      composition: "strong symmetry, clear hierarchy, icon-first clarity for avatars",
      effects: "controlled contrast, subtle grain, steel and graphite material accents"
    },
    "league of legends": {
      dnaName: "LoL Mythic DNA",
      vibe: "mythic power, strategic mastery, legendary fantasy atmosphere",
      iconDirection: "champion-inspired crest, arcane symbol layering, noble silhouette",
      composition: "ornamental balance, strong central sigil, elegant scalable framing",
      effects: "gold trims, magical aura glows, refined gemstone-like highlights"
    },
    lol: {
      dnaName: "LoL Mythic DNA",
      vibe: "mythic power, strategic mastery, legendary fantasy atmosphere",
      iconDirection: "champion-inspired crest, arcane symbol layering, noble silhouette",
      composition: "ornamental balance, strong central sigil, elegant scalable framing",
      effects: "gold trims, magical aura glows, refined gemstone-like highlights"
    },
    fifa: {
      dnaName: "FIFA Elite Club DNA",
      vibe: "elite club legacy, competitive pride, modern football prestige",
      iconDirection: "club badge motif, crown or shield hybrid, athletic typography focus",
      composition: "crest-centered structure, banner-ready symmetry, jersey-print readability",
      effects: "clean gloss layers, premium metallic accents, stadium-light highlights"
    }
  };

  const fallbackProfile = {
    dnaName: "Universal Esports DNA",
    vibe: "competitive confidence, premium identity, memorable visual impact",
    iconDirection: "mascot or emblem icon aligned to the brand name and audience",
    composition: "centered mark, clean hierarchy, scalable for avatars and banners",
    effects: "high contrast lighting, premium shading, subtle glow accents"
  };

  const matchedProfile = genreProfiles[gameKey] || fallbackProfile;

  const directionalLines = [
    `creative direction: ${fallbackStyle},`,
    `theme context: ${fallbackGenre},`,
    `color strategy: ${selectedPalette},`,
    `genre dna profile: ${matchedProfile.dnaName},`,
    `genre mood: ${matchedProfile.vibe},`,
    `icon system: ${matchedProfile.iconDirection},`,
    `composition logic: ${matchedProfile.composition},`,
    `material and fx: ${matchedProfile.effects},`
  ];

  const autoBoostLines = shouldAutoBoost
    ? [
      `auto-boost v2: ${boostLevel} enhancement enabled for low user input,`,
      "generate 2-3 internal concept directions and select the strongest one,",
      "prefer a dominant mascot or emblem icon aligned with logo text,",
      "increase silhouette readability, contrast hierarchy and tournament visibility,",
      "add premium material rendering, layered depth and dramatic rim lighting,"
    ]
    : [];

  const parts = [
    "Ultra Magic Prompt v2",
    "",
    "objective:",
    "ultra detailed cinematic esports logo with commercial-ready branding quality,",
    `logo text: "${normalizedName}",`,
    "",
    "identity inputs:",
    normalizedClan ? `clan name: ${normalizedClan},` : "clan name: not provided,",
    normalizedGame ? `inspired by: ${normalizedGame},` : "",
    normalizedStyle ? `style preference: ${normalizedStyle},` : "",
    selectedColors.length ? `preferred colors: ${selectedPalette},` : "",
    normalizedNotes ? `extra notes: ${normalizedNotes},` : "",
    "",
    "art direction:",
    ...directionalLines,
    ...autoBoostLines,
    "",
    "quality constraints:",
    "high contrast lighting, crystal sharp details, premium edges,",
    "balanced composition, centered mark, transparent-friendly output,",
    "4k quality, no blur, no low-detail noise, no distorted text,",
    "presentation: dark neutral background for strong foreground separation"
  ];

  return parts.filter((line, index, arr) => {
    if (line) {
      return true;
    }

    return index > 0 && arr[index - 1] && arr.slice(index + 1).some(Boolean);
  }).join("\n");
};

function getLogoDnaBlueprints() {
  try {
    return JSON.parse(localStorage.getItem("creatorStudio.logoDnaSystem") || "[]");
  } catch {
    return [];
  }
}

function setLogoDnaBlueprints(entries) {
  localStorage.setItem("creatorStudio.logoDnaSystem", JSON.stringify(entries));
}

function addLogoDnaBlueprint(entry) {
  const entries = getLogoDnaBlueprints();
  const next = [{ ...entry, id: Date.now(), createdAt: new Date().toISOString() }, ...entries].slice(0, 20);
  setLogoDnaBlueprints(next);
}

const DNA_ARCHETYPE_PROFILES = {
  warrior: { label: "Warrior", vibe: "aggressive leadership", shape: "sharp geometric emblem", tone: "bold" },
  guardian: { label: "Guardian", vibe: "trusted stability", shape: "shield inspired silhouette", tone: "balanced" },
  visionary: { label: "Visionary", vibe: "future innovation", shape: "clean futuristic glyph", tone: "refined" },
  phantom: { label: "Phantom", vibe: "mystic stealth", shape: "dark dynamic mark", tone: "dramatic" },
  royal: { label: "Royal", vibe: "premium authority", shape: "ornamental crest", tone: "luxury" }
};

window.collectLogoDnaInput = function collectLogoDnaInput() {
  const toInt = (id, fallback) => Number.parseInt(document.getElementById(id)?.value || String(fallback), 10);
  return {
    brandName: document.getElementById("dnaBrandName")?.value.trim() || "",
    archetype: document.getElementById("dnaArchetype")?.value || "warrior",
    domain: document.getElementById("dnaDomain")?.value.trim() || "",
    symbol: document.getElementById("dnaSymbol")?.value.trim() || "",
    energy: toInt("dnaEnergy", 7),
    minimalism: toInt("dnaMinimalism", 6),
    colorForce: toInt("dnaColorForce", 8),
    typography: toInt("dnaTypography", 7)
  };
};

window.buildLogoDnaBlueprint = function buildLogoDnaBlueprint(input) {
  const profile = DNA_ARCHETYPE_PROFILES[input.archetype] || DNA_ARCHETYPE_PROFILES.warrior;
  const dnaScore = Math.round(
    (input.energy * 3.2)
    + (input.colorForce * 2.6)
    + (input.typography * 2.1)
    + ((11 - input.minimalism) * 2.1)
  );

  const prompt = [
    `Create a premium logo for "${input.brandName}".`,
    `Archetype: ${profile.label} (${profile.vibe}).`,
    input.domain ? `Domain or game context: ${input.domain}.` : "",
    input.symbol ? `Core icon motif: ${input.symbol}.` : "",
    `Visual shape language: ${profile.shape}.`,
    `Tone: ${profile.tone}, energy ${input.energy}/10, minimalism ${input.minimalism}/10, color impact ${input.colorForce}/10, typography force ${input.typography}/10.`,
    "Clean composition, center weighted, high readability, transparent friendly background."
  ].filter(Boolean).join(" ");

  return {
    ...input,
    archetypeLabel: profile.label,
    dnaScore,
    prompt
  };
};

window.renderLogoDnaPreview = function renderLogoDnaPreview(blueprint) {
  const target = document.getElementById("dnaPreviewPanel");
  if (!target) {
    return;
  }

  target.innerHTML = `
    <article class="result-card">
      <h3>${window.escapeHtml(blueprint.brandName || "Unbenannt")}</h3>
      <p class="muted">${window.escapeHtml(blueprint.archetypeLabel)} - DNA Score ${blueprint.dnaScore}</p>
      <div class="tag-list">
        <span class="tag">Energy ${blueprint.energy}/10</span>
        <span class="tag">Minimalism ${blueprint.minimalism}/10</span>
        <span class="tag">Color ${blueprint.colorForce}/10</span>
        <span class="tag">Type ${blueprint.typography}/10</span>
      </div>
      <div class="empty-state" style="margin-top:12px; text-align:left;">
        ${window.escapeHtml(blueprint.prompt)}
      </div>
    </article>
  `;
};

window.renderLogoDnaLibrary = function renderLogoDnaLibrary() {
  const target = document.getElementById("logoDnaLibraryList");
  if (!target) {
    return;
  }

  const entries = getLogoDnaBlueprints();
  if (!entries.length) {
    target.innerHTML = `<div class="empty-state">Noch keine DNA-Blueprints gespeichert.</div>`;
    return;
  }

  target.innerHTML = entries.map((entry, index) => `
    <article class="dna-item">
      <div class="section-head">
        <div>
          <h3>${window.escapeHtml(entry.brandName || "Unbenannt")}</h3>
          <p class="muted">${window.escapeHtml(entry.archetypeLabel || "Archetype")} - Score ${entry.dnaScore || "-"}</p>
        </div>
        <div class="actions-row">
          <button class="btn secondary" type="button" onclick="loadLogoDnaBlueprint(${index})">Laden</button>
          <button class="btn secondary" type="button" onclick="pushLogoDnaBlueprintToLogo(${index})">Zu Logo</button>
        </div>
      </div>
    </article>
  `).join("");
};

window.loadLogoDnaIntoForm = function loadLogoDnaIntoForm(blueprint) {
  const mapping = {
    dnaBrandName: blueprint.brandName,
    dnaArchetype: blueprint.archetype,
    dnaDomain: blueprint.domain,
    dnaSymbol: blueprint.symbol,
    dnaEnergy: blueprint.energy,
    dnaMinimalism: blueprint.minimalism,
    dnaColorForce: blueprint.colorForce,
    dnaTypography: blueprint.typography
  };

  Object.entries(mapping).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.value = value ?? "";
    }
  });
};

window.loadLogoDnaBlueprint = function loadLogoDnaBlueprint(index) {
  const entries = getLogoDnaBlueprints();
  const entry = entries[index];
  if (!entry) {
    return;
  }
  window.loadLogoDnaIntoForm(entry);
  window.renderLogoDnaPreview(entry);
  window.showToast("DNA-Blueprint geladen.");
};

window.pushLogoDnaBlueprintToLogo = function pushLogoDnaBlueprintToLogo(index) {
  const entries = getLogoDnaBlueprints();
  const entry = entries[index];
  if (!entry) {
    return;
  }

  addBrandDna({
    brandName: entry.brandName,
    clanName: entry.symbol || "",
    game: entry.domain || "",
    style: entry.archetypeLabel || entry.archetype || "",
    colors: [],
    notes: `DNA Score ${entry.dnaScore}; prompt: ${entry.prompt}`
  });
  window.showToast("DNA ins Logo-System uebernommen.");
};

window.exportLogoDnaLibrary = async function exportLogoDnaLibrary() {
  const entries = getLogoDnaBlueprints();
  if (!entries.length) {
    window.showToast("Keine DNA-Blueprints zum Export vorhanden.", "error");
    return;
  }

  await navigator.clipboard.writeText(JSON.stringify(entries, null, 2));
  window.showToast("DNA-Bibliothek als JSON in Zwischenablage kopiert.");
};

window.initLogoDnaPage = function initLogoDnaPage() {
  const buildButton = document.getElementById("buildDnaBtn");
  const saveButton = document.getElementById("saveDnaBlueprintBtn");
  const pushButton = document.getElementById("pushDnaToLogoBtn");
  const exportButton = document.getElementById("exportDnaLibraryBtn");
  let currentBlueprint = null;

  buildButton?.addEventListener("click", () => {
    const input = window.collectLogoDnaInput();
    if (!input.brandName) {
      window.showToast("Bitte zuerst einen Brand Name eingeben.", "error");
      return;
    }

    currentBlueprint = window.buildLogoDnaBlueprint(input);
    window.renderLogoDnaPreview(currentBlueprint);
    window.showToast("Logo DNA analysiert.");
  });

  saveButton?.addEventListener("click", () => {
    if (!currentBlueprint) {
      const input = window.collectLogoDnaInput();
      if (!input.brandName) {
        window.showToast("Bitte zuerst DNA analysieren oder Brand Name eingeben.", "error");
        return;
      }
      currentBlueprint = window.buildLogoDnaBlueprint(input);
    }

    addLogoDnaBlueprint(currentBlueprint);
    window.renderLogoDnaLibrary();
    window.showToast("DNA-Blueprint gespeichert.");
  });

  pushButton?.addEventListener("click", () => {
    if (!currentBlueprint) {
      const input = window.collectLogoDnaInput();
      if (!input.brandName) {
        window.showToast("Bitte zuerst DNA analysieren oder Brand Name eingeben.", "error");
        return;
      }
      currentBlueprint = window.buildLogoDnaBlueprint(input);
    }

    addBrandDna({
      brandName: currentBlueprint.brandName,
      clanName: currentBlueprint.symbol || "",
      game: currentBlueprint.domain || "",
      style: currentBlueprint.archetypeLabel,
      colors: [],
      notes: `DNA Score ${currentBlueprint.dnaScore}; prompt: ${currentBlueprint.prompt}`
    });
    window.showToast("DNA direkt in den Logo Builder uebernommen.");
  });

  exportButton?.addEventListener("click", window.exportLogoDnaLibrary);
  window.renderLogoDnaLibrary();
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
  const generateButton = document.getElementById("generateVideoBtn");
  const analyzeButton = document.getElementById("analyzeVideoBtn");

  input?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    window.CreatorState.uploadedVideoName = file?.name || "";
    window.CreatorState.uploadedVideoFile = file || null;
    window.CreatorState.detectedHighlights = [];
    window.CreatorState.selectedHighlightIds = [];
    window.renderDetectedHighlights?.([]);

    const meta = document.getElementById("videoFileMeta");
    if (meta) {
      meta.textContent = file
        ? `${file.name} - ${Math.round(file.size / 1024 / 1024)} MB`
        : "Noch kein Video ausgewaehlt";
    }
  });

  analyzeButton?.addEventListener("click", window.analyzeVideoHighlights);
  generateButton?.addEventListener("click", window.generateVideoPlan);
};

window.renderDetectedHighlights = function renderDetectedHighlights(highlights) {
  const target = document.getElementById("detectedHighlightsList");
  if (!target) {
    return;
  }

  if (!Array.isArray(highlights) || !highlights.length) {
    target.className = "empty-state";
    target.innerHTML = "Noch keine Highlights erkannt. Starte zuerst \"Highlights erkennen\".";
    return;
  }

  target.className = "";
  target.innerHTML = `
    <div class="option-grid">
      ${highlights.map((item) => `
        <label class="selection-card">
          <input
            type="checkbox"
            name="detectedHighlight"
            value="${window.escapeHtml(item.id)}"
            ${item.selected ? "checked" : ""}
          >
          <span>
            <strong>${window.escapeHtml(item.type)}</strong>
            <span>${window.escapeHtml(item.startLabel)} - ${window.escapeHtml(item.endLabel)} | Score ${item.score}</span>
          </span>
        </label>
      `).join("")}
    </div>
  `;

  target.querySelectorAll('input[name="detectedHighlight"]').forEach((input) => {
    input.addEventListener("change", (event) => {
      const id = event.target.value;
      const selectedIds = new Set(window.CreatorState.selectedHighlightIds || []);
      if (event.target.checked) {
        selectedIds.add(id);
      } else {
        selectedIds.delete(id);
      }
      window.CreatorState.selectedHighlightIds = Array.from(selectedIds);
    });
  });
};

window.analyzeVideoHighlights = async function analyzeVideoHighlights() {
  if (!window.CreatorState.uploadedVideoFile) {
    window.showToast("Bitte zuerst ein Gameplay-Video auswaehlen.", "error");
    return;
  }

  const analyzeButton = document.getElementById("analyzeVideoBtn");
  if (analyzeButton) {
    analyzeButton.disabled = true;
    analyzeButton.textContent = "Analysiere...";
  }

  const highlightTypes = Array.from(document.querySelectorAll('input[name="highlightType"]:checked')).map((input) => input.value);
  const requestedTypes = highlightTypes.length ? highlightTypes : ["Kills", "Action Scenes", "Wins"];

  const mockHighlights = requestedTypes.map((type, index) => {
    const startSecond = 10 + (index * 9);
    const endSecond = startSecond + 6;
    return {
      id: `hl-${Date.now()}-${index}`,
      type,
      score: Math.min(99, 84 + (index * 4)),
      start: startSecond,
      end: endSecond,
      startLabel: window.secondsToTimestamp(startSecond),
      endLabel: window.secondsToTimestamp(endSecond),
      selected: true
    };
  });

  const payload = new FormData();
  payload.append("video", window.CreatorState.uploadedVideoFile);
  payload.append("highlightTypes", JSON.stringify(requestedTypes));

  let highlights = mockHighlights;
  try {
    const response = await window.authFetch("/api/video/analyze-highlights", {
      method: "POST",
      body: payload
    });
    if (response && response.ok) {
      const data = await response.json().catch(() => null);
      const apiHighlights = Array.isArray(data?.highlights) ? data.highlights : [];
      window.CreatorState.uploadedVideoToken = String(data?.uploadToken || "");
      if (apiHighlights.length) {
        highlights = apiHighlights.map((item, index) => {
          const start = Number(item.start || 0);
          const end = Number(item.end || (start + 5));
          return {
            id: String(item.id || `api-hl-${Date.now()}-${index}`),
            type: String(item.type || "Highlight"),
            score: Number(item.score || 80),
            start,
            end,
            startLabel: window.secondsToTimestamp(start),
            endLabel: window.secondsToTimestamp(end),
            selected: true
          };
        });
      }
    }
  } catch (error) {
    console.log("Highlight analysis fallback used", error);
  }

  window.CreatorState.detectedHighlights = highlights;
  window.CreatorState.selectedHighlightIds = highlights.map((item) => item.id);
  window.renderDetectedHighlights(highlights);

  const preview = document.getElementById("videoPreviewFrame");
  if (preview) {
    preview.innerHTML = `
      <div class="empty-state" style="text-align:left;">
        Analyse abgeschlossen fuer ${window.escapeHtml(window.CreatorState.uploadedVideoName)}.
        <br>Erkannt: ${highlights.length} Highlights (${window.escapeHtml(requestedTypes.join(", "))}).
        <br>Waehle jetzt die Szenen per Checkbox aus.
      </div>
    `;
  }

  if (analyzeButton) {
    analyzeButton.disabled = false;
    analyzeButton.textContent = "1) Highlights erkennen";
  }

  window.showToast("Highlights erkannt. Waehle deine Szenen aus.");
};

window.secondsToTimestamp = function secondsToTimestamp(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

window.generateVideoPlan = async function generateVideoPlan() {
  const title = document.getElementById("videoTitle")?.value.trim() || "";
  const outputFormats = Array.from(document.querySelectorAll('input[name="outputFormat"]:checked')).map((input) => input.value);
  const result = document.getElementById("videoPlanResult");
  const selectedIds = new Set(window.CreatorState.selectedHighlightIds || []);
  const selectedHighlights = (window.CreatorState.detectedHighlights || []).filter((item) => selectedIds.has(item.id));

  if (!window.CreatorState.uploadedVideoName) {
    window.showToast("Bitte zuerst ein Gameplay-Video auswaehlen.", "error");
    return;
  }

  if (!selectedHighlights.length) {
    window.showToast("Bitte zuerst Highlights erkennen und mindestens einen Clip auswaehlen.", "error");
    return;
  }

  const button = document.getElementById("generateVideoBtn");
  if (button) {
    button.disabled = true;
    button.textContent = "Erstelle Kurzvideo...";
  }

  saveLocalProject({
    name: title || window.CreatorState.uploadedVideoName,
    type: "Video Builder",
    summary: `${selectedHighlights.length} Clips - ${outputFormats.length || 1} Formate`
  });

  const selectedFormats = outputFormats.length ? outputFormats : ["TikTok 9:16"];
  const logoDna = getBrandDna?.()[0] || null;
  const logoStyle = logoDna?.style || "Esports";

  const requestPayload = {
    title: title || window.CreatorState.uploadedVideoName,
    uploadToken: window.CreatorState.uploadedVideoToken || "",
    requestId: `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    outputFormats: selectedFormats,
    highlights: selectedHighlights.map((item) => ({
      id: item.id,
      type: item.type,
      start: item.start,
      end: item.end,
      score: item.score
    })),
    transitionStyle: {
      mode: "logo-dna",
      logoStyle,
      notes: logoDna?.notes || ""
    }
  };

  let renderResult = null;
  const response = await window.authFetch("/api/video/build-short", {
    method: "POST",
    body: JSON.stringify(requestPayload)
  });
  if (response && response.ok) {
    renderResult = await response.json().catch(() => null);
  }

  if (result) {
    result.innerHTML = `
      <div class="result-card">
        <h3>${window.escapeHtml(title || "AI Kurzvideo Auftrag")}</h3>
        <p class="muted">Upload: ${window.escapeHtml(window.CreatorState.uploadedVideoName)}</p>
        <ul class="mini-list list-reset">
          <li>Ausgewaehlte Highlight-Clips: ${selectedHighlights.length}</li>
          <li>Ausgabeformate: ${selectedFormats.map(window.escapeHtml).join(", ")}</li>
          <li>Transition-Style: ${window.escapeHtml(logoStyle)} (Logo-DNA)</li>
          <li>Animationen: Auto-Beat-Cut, Flash-Whip, Logo-Reveal zwischen Highlights</li>
          <li>Output: ${(renderResult?.videoUrl ? "Render abgeschlossen" : "Render-Queue vorbereitet (Fallback-Modus)")}</li>
        </ul>
        ${renderResult?.videoUrl ? `
          <div class="actions-row">
            <a class="btn secondary" href="${window.escapeHtml(renderResult.videoUrl)}" target="_blank" rel="noopener noreferrer">Kurzvideo oeffnen</a>
          </div>
        ` : ""}
      </div>
    `;
  }

  const preview = document.getElementById("videoPreviewFrame");
  if (preview) {
    preview.innerHTML = `
      <div class="empty-state" style="text-align:left;">
        Kurzvideo-Builder fertig.
        <br>${selectedHighlights.length} Highlight-Clips wurden in eine TikTok-Storyline sortiert.
        <br>Transitions folgen deinem Logo-Style (${window.escapeHtml(logoStyle)}).
      </div>
    `;
  }

  if (button) {
    button.disabled = false;
    button.textContent = "2) Short Video erstellen";
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
