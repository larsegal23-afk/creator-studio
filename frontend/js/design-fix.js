// Design Fix - Unified JavaScript Functions
console.log('=== Design Fix Initializing ===');

// Fix for missing functions
window.showToast = function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) {
    console.warn('Toast element not found');
    return;
  }

  toast.textContent = message;
  toast.className = `toast visible ${type === 'error' ? 'error' : type === 'success' ? 'success' : ''}`;

  window.clearTimeout(window.__creatorToastTimer);
  window.__creatorToastTimer = window.setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
};

// Fix for logo generation
window.generateLogoFromForm = async function generateLogoFromForm() {
  try {
    console.log('Generating logo with design fix...');
    
    // Check coins first
    const hasCoins = await window.useCoins(5);
    if (!hasCoins) {
      window.showToast('Nicht genug Coins für Logo-Generierung', 'error');
      return;
    }

    const brandName = document.getElementById('logoName')?.value?.trim();
    const clanName = document.getElementById('logoClan')?.value?.trim();
    const game = document.getElementById('logoGame')?.value;
    const style = document.getElementById('logoStyle')?.value;
    const notes = document.getElementById('logoNotes')?.value?.trim();
    const colors = Array.from(document.querySelectorAll('input[name="logoColor"]:checked'))
      .map(input => input.value);

    if (!brandName) {
      window.showToast('Bitte zuerst einen Namen eingeben.', 'error');
      return;
    }

    // Show loading
    const button = document.getElementById('generateLogoBtn');
    const result = document.getElementById('logoResult');
    
    if (button) {
      button.disabled = true;
      button.innerHTML = '<span class="btn-icon">Loading...</span>Erstelle Logo...';
    }

    if (result) {
      result.innerHTML = '<div class="loader"></div>';
    }

    // Build prompt
    const prompt = window.buildMagicPrompt({
      name: brandName,
      clan: clanName,
      game,
      style,
      colors,
      notes
    });

    // Call API
    const response = await window.authFetch('/api/generate-logo', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        requestId: `logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      })
    });

    if (!response || !response.ok) {
      throw new Error('Logo-Generierung fehlgeschlagen');
    }

    const data = await response.json();
    
    if (data.image) {
      window.CreatorState.logoImage = data.image;
      
      // Update preview
      const preview = document.getElementById('logoPreviewFrame');
      if (preview) {
        preview.innerHTML = `<img src="${data.image}" alt="Logo" style="max-width: 100%; border-radius: 8px;">`;
      }

      // Update result
      if (result) {
        result.innerHTML = `
          <div class="card">
            <h3>${brandName}</h3>
            <p class="muted">Logo erstellt mit professioneller Qualität</p>
            <div class="action-buttons">
              <button class="btn primary" onclick="window.downloadGeneratedLogo()">
                <span class="btn-icon">Download</span>
                Logo herunterladen
              </button>
              <button class="btn secondary" onclick="window.copyLogoPrompt()">
                <span class="btn-icon">Copy</span>
                Prompt kopieren
              </button>
            </div>
          </div>
        `;
      }

      window.showToast('Logo erfolgreich erstellt!', 'success');
    }

  } catch (error) {
    console.error('Logo generation failed:', error);
    window.showToast('Logo-Generierung fehlgeschlagen', 'error');
  } finally {
    // Reset button
    const button = document.getElementById('generateLogoBtn');
    if (button) {
      button.disabled = false;
      button.innerHTML = '<span class="btn-icon">Create</span>Logo erstellen (5 Coins)';
    }
  }
};

// Fix for stream pack generation
window.generateStreamPackPlan = function generateStreamPackPlan() {
  try {
    console.log('Generating stream pack with design fix...');
    
    const brandName = document.getElementById('streamBrandName')?.value?.trim();
    const assets = Array.from(document.querySelectorAll('input[name="streamAsset"]:checked'))
      .map(input => input.value);
    const format = document.querySelector('input[name="streamFormat"]:checked')?.value;

    if (!brandName) {
      window.showToast('Bitte einen Projektnamen eingeben.', 'error');
      return;
    }

    const preview = document.getElementById('streamPreview');
    const downloadArea = document.getElementById('streamDownloadArea');
    const selectedAssets = assets.length ? assets : ['Facecam Rahmen', 'Alerts', 'Layout'];
    const selectedFormat = format || '16:9';

    if (preview) {
      preview.innerHTML = `
        <div class="card">
          <h3>${brandName} Stream Pack</h3>
          <p class="muted">Stream Pack erstellt. Auswahl ist gespeichert.</p>
          <div class="tool-grid">
            ${selectedAssets.map((asset) => `
              <div class="tool">
                <span>${asset}</span>
              </div>
            `).join('')}
          </div>
          <p class="muted">Format: ${selectedFormat}</p>
        </div>
      `;
    }

    if (downloadArea) {
      downloadArea.innerHTML = `
        <div class="card">
          <h4>Download-Optionen</h4>
          <div class="action-buttons">
            <button class="btn primary">
              <span class="btn-icon">Download</span>
              Komplettes Pack herunterladen
            </button>
            <button class="btn secondary">
              <span class="btn-icon">Assets</span>
              Einzelne Assets
            </button>
          </div>
        </div>
      `;
    }

    window.showToast('Stream Pack erstellt!', 'success');

  } catch (error) {
    console.error('Stream pack generation failed:', error);
    window.showToast('Stream Pack-Erstellung fehlgeschlagen', 'error');
  }
};

// Fix for video page initialization
window.initVideoPage = function initVideoPage() {
  const input = document.getElementById('videoFile');
  const generateButton = document.getElementById('generateVideoBtn');

  if (input) {
    input.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) {
        window.CreatorState.uploadedVideoName = file.name;
        console.log('Video selected:', file.name);
      }
    });
  }

  if (generateButton) {
    generateButton.addEventListener('click', () => {
      window.showToast('Video-Verarbeitung wird vorbereitet...', 'info');
    });
  }
};

// Fix for logo page initialization
window.initLogoPage = function initLogoPage() {
  const generateButton = document.getElementById('generateLogoBtn');
  const uploadInput = document.getElementById('logoUpload');

  if (uploadInput) {
    uploadInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (file) {
        const dataUrl = await window.readFileAsDataUrl(file);
        window.CreatorState.uploadedLogo = dataUrl;
        const frame = document.getElementById('logoPreviewFrame');
        if (frame) {
          frame.innerHTML = `<img src="${dataUrl}" alt="Hochgeladenes Logo" style="max-width: 100%; border-radius: 8px;">`;
        }
      }
    });
  }

  if (generateButton) {
    generateButton.addEventListener('click', window.generateLogoFromForm);
  }
};

// Fix for stream page initialization
window.initStreamPage = function initStreamPage() {
  const generateButton = document.getElementById('generateStreamBtn');
  if (generateButton) {
    generateButton.addEventListener('click', window.generateStreamPackPlan);
  }
};

// Fix for missing functions
window.readFileAsDataUrl = function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

window.downloadGeneratedLogo = function downloadGeneratedLogo() {
  if (window.CreatorState.logoImage) {
    const link = document.createElement('a');
    link.href = window.CreatorState.logoImage;
    link.download = 'creator-studio-logo.png';
    link.click();
    window.showToast('Logo heruntergeladen', 'success');
  }
};

window.copyLogoPrompt = async function copyLogoPrompt() {
  const brandName = document.getElementById('logoName')?.value?.trim() || '';
  const clanName = document.getElementById('logoClan')?.value?.trim() || '';
  const game = document.getElementById('logoGame')?.value || '';
  const style = document.getElementById('logoStyle')?.value || '';
  const notes = document.getElementById('logoNotes')?.value?.trim() || '';
  const colors = Array.from(document.querySelectorAll('input[name="logoColor"]:checked'))
    .map(input => input.value);
  
  const prompt = window.buildMagicPrompt({
    name: brandName,
    clan: clanName,
    game,
    style,
    colors,
    notes
  });

  await navigator.clipboard.writeText(prompt);
  window.showToast('Prompt kopiert', 'success');
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Design Fix loaded successfully');
  
  // Initialize pages based on current route
  const currentPath = window.location.hash.replace('#', '') || 'dashboard';
  
  switch (currentPath) {
    case 'logo':
      window.initLogoPage();
      break;
    case 'stream':
      window.initStreamPage();
      break;
    case 'video':
      window.initVideoPage();
      break;
  }
});

console.log('Design Fix loaded');
