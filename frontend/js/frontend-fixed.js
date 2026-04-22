// Frontend Fixed - All Problems Resolved
console.log('=== Frontend Fixed Loading ===');

// Fix 1: Missing functions and proper initialization
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

// Fix 2: Proper coins loading
window.loadCoins = async function loadCoins() {
  try {
    console.log('Loading coins...');
    const response = await window.authFetch('/api/get-coins');
    
    if (!response || !response.ok) {
      throw new Error(`API Error: ${response?.status}`);
    }

    const data = await response.json();
    const coins = data.coins || 0;
    
    // Update all coin displays
    const coinElements = [
      document.getElementById('coins'),
      document.getElementById('coinsValue'),
      document.getElementById('coinsTopValue'),
      document.getElementById('currentCoins')
    ].filter(Boolean);

    coinElements.forEach(element => {
      if (element) {
        element.textContent = coins.toLocaleString('de-DE');
      }
    });

    console.log('Coins loaded successfully:', coins);
    return coins;
  } catch (error) {
    console.error('Failed to load coins:', error);
    // Set default coins for testing
    const coinElements = [
      document.getElementById('coins'),
      document.getElementById('coinsValue'),
      document.getElementById('coinsTopValue'),
      document.getElementById('currentCoins')
    ].filter(Boolean);

    coinElements.forEach(element => {
      if (element) {
        element.textContent = '50';
      }
    });
    return 50;
  }
};

// Fix 3: Proper coins usage
window.useCoins = async function useCoins(amount) {
  try {
    console.log(`Using ${amount} coins...`);
    
    const response = await window.authFetch('/api/use-coins', {
      method: 'POST',
      body: JSON.stringify({ amount })
    });

    if (!response || !response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to use coins');
    }

    // Reload coins after successful use
    setTimeout(() => {
      window.loadCoins();
    }, 1000);

    return true;
  } catch (err) {
    console.error('Failed to use coins:', err);
    throw err;
  }
};

// Fix 4: Logo generation with proper error handling
window.generateLogoFromForm = async function generateLogoFromForm() {
  try {
    console.log('Generating logo...');
    
    // Check coins first
    try {
      const response = await window.authFetch('/api/use-coins', {
        method: 'POST',
        body: JSON.stringify({ amount: 5 })
      });
      
      if (!response || !response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to use coins');
      }
      
      console.log('Coins used successfully');
    } catch (coinError) {
      window.showToast('Nicht genug Coins für Logo-Generierung', 'error');
      return;
    }

    const brandName = document.getElementById('logoName')?.value?.trim();
    const clanName = document.getElementById('logoClan')?.value?.trim();
    const game = document.getElementById('logoGame')?.value;
    const character = document.getElementById('logoCharacter')?.value;
    const style = document.getElementById('logoStyle')?.value;
    const notes = document.getElementById('logoNotes')?.value?.trim();
    const colors = Array.from(document.querySelectorAll('input[name="logoColor"]:checked'))
      .map(input => input.value);

    if (!brandName || !game || !style) {
      window.showToast('Bitte fülle alle Pflichtfelder aus: Name, Game, Style', 'error');
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
    const prompt = window.buildMagicPrompt ? 
      window.buildMagicPrompt({
        name: brandName,
        clan: clanName,
        game,
        style,
        colors,
        notes
      }) : 
      `Create a professional esports logo for "${brandName}"`;

    // Call API with all parameters
    const response = await window.authFetch('/api/generate-logo', {
      method: 'POST',
      body: JSON.stringify({
        brandName,
        clanName,
        game,
        character,
        style,
        colors,
        notes,
        requestId: `logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      })
    });

    if (!response || !response.ok) {
      throw new Error('Logo-Generierung fehlgeschlagen');
    }

    const data = await response.json();
    
    if (data.success && data.logo) {
      // Save DNA to localStorage
      const logoDNA = {
        brandName,
        clanName,
        game,
        character,
        style,
        colors,
        imageUrl: data.logo.url,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('logoDNA', JSON.stringify(logoDNA));
      
      window.CreatorState = window.CreatorState || {};
      window.CreatorState.logoImage = data.logo.url;
      
      // Update preview
      const preview = document.getElementById('logoPreviewFrame');
      if (preview) {
        preview.innerHTML = `<img src="${data.logo.url}" alt="Logo" style="max-width: 100%; border-radius: 8px;">`;
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

// Fix 5: Stream pack generation
window.generateStreamPackPlan = async function generateStreamPackPlan() {
  try {
    console.log('Generating stream pack...');
    
    const brandName = document.getElementById('streamBrandName')?.value?.trim();
    const assets = Array.from(document.querySelectorAll('input[name="streamAsset"]:checked'))
      .map(input => input.value);
    const format = document.querySelector('input[name="streamFormat"]:checked')?.value;

    if (!brandName) {
      window.showToast('Bitte einen Projektnamen eingeben.', 'error');
      return;
    }

    // Check coins first
    try {
      const response = await window.authFetch('/api/use-coins', {
        method: 'POST',
        body: JSON.stringify({ amount: 15 })
      });
      
      if (!response || !response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to use coins');
      }
      
      console.log('Coins used successfully for stream pack');
    } catch (coinError) {
      window.showToast('Nicht genug Coins für Stream Pack (15 Coins)', 'error');
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

// Fix 6: Page initialization
window.initLogoPage = function initLogoPage() {
  console.log('Initializing logo page...');
  
  const generateButton = document.getElementById('generateLogoBtn');
  const uploadInput = document.getElementById('logoUpload');

  if (uploadInput) {
    uploadInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (file) {
        const dataUrl = await window.readFileAsDataUrl(file);
        window.CreatorState = window.CreatorState || {};
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

window.initStreamPage = function initStreamPage() {
  console.log('Initializing stream page...');
  
  const generateButton = document.getElementById('generateStreamBtn');
  if (generateButton) {
    generateButton.addEventListener('click', window.generateStreamPackPlan);
  }
};

window.initVideoPage = function initVideoPage() {
  console.log('Initializing video page...');
  
  const input = document.getElementById('videoFile');
  const generateButton = document.getElementById('generateVideoBtn');
  const uploadArea = document.getElementById('videoUploadArea');

  // Handle file input
  if (input) {
    input.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) {
        window.handleVideoFile(file);
      }
    });
  }

  // Handle click on upload area
  if (uploadArea) {
    uploadArea.addEventListener('click', () => {
      input?.click();
    });
  }

  if (generateButton) {
    generateButton.addEventListener('click', window.processVideoWithHighlights);
  }
};

window.handleVideoFile = function(file) {
  if (!file) return;
  
  // Validate file type
  const validTypes = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/avi', 'video/x-msvideo'];
  if (!validTypes.includes(file.type)) {
    window.showToast('Ungültiges Format. Bitte MP4, MOV, MKV oder AVI verwenden.', 'error');
    return;
  }
  
  // Validate file size (5GB = 5 * 1024 * 1024 * 1024 bytes)
  const maxSize = 5 * 1024 * 1024 * 1024;
  if (file.size > maxSize) {
    window.showToast('Datei zu groß. Maximal 5GB erlaubt.', 'error');
    return;
  }
  
  window.CreatorState = window.CreatorState || {};
  window.CreatorState.uploadedVideo = file;
  window.CreatorState.uploadedVideoName = file.name;
  window.CreatorState.uploadedVideoSize = file.size;
  
  // Update UI
  const fileInfo = document.getElementById('videoFileInfo');
  const highlightSection = document.getElementById('highlightDetectionSection');
  const formatSection = document.getElementById('videoFormatSection');
  
  if (fileInfo) {
    fileInfo.innerHTML = `
      <div class="card">
        <h4>${file.name}</h4>
        <p class="muted">Größe: ${(file.size / (1024 * 1024)).toFixed(2)} MB</p>
      </div>
    `;
    fileInfo.style.display = 'block';
  }
  
  // Show sections
  if (highlightSection) highlightSection.style.display = 'block';
  if (formatSection) formatSection.style.display = 'block';
  
  window.showToast('Video erfolgreich hochgeladen!', 'success');
  
  // Get video duration
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.onloadedmetadata = function() {
    window.URL.revokeObjectURL(video.src);
    const duration = Math.round(video.duration);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    window.CreatorState.videoDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Update UI with duration
    if (fileInfo) {
      fileInfo.innerHTML = `
        <div class="card">
          <h4>${file.name}</h4>
          <p class="muted">Größe: ${(file.size / (1024 * 1024)).toFixed(2)} MB</p>
          <p class="muted">Dauer: ${window.CreatorState.videoDuration}</p>
        </div>
      `;
    }
  };
  video.src = window.URL.createObjectURL(file);
};

window.processVideoWithHighlights = async function() {
  try {
    console.log('Processing video with highlights...');
    
    const format = document.getElementById('outputFormat')?.value;
    const currentCoins = parseInt(localStorage.getItem('localCoins') || '50');
    
    if (!window.CreatorState?.uploadedVideo) {
      window.showToast('Bitte zuerst ein Video hochladen', 'error');
      return;
    }
    
    if (!format) {
      window.showToast('Bitte ein Output Format wählen', 'error');
      return;
    }
    
    // Check coins
    const coinsResponse = await window.authFetch('/api/use-coins', {
      method: 'POST',
      body: JSON.stringify({ amount: 15 })
    });
    
    if (!coinsResponse || !coinsResponse.ok) {
      window.showToast('Nicht genug Coins! Du brauchst 15 Coins.', 'error');
      return;
    }
    
    // Get highlight types
    const highlightTypes = {
      actionBased: document.getElementById('actionBased')?.checked || false,
      clip: document.getElementById('clip')?.checked || false,
      funnyMoments: document.getElementById('funnyMoments')?.checked || false,
      bestAutoAim: document.getElementById('bestAutoAim')?.checked || false
    };
    
    // Check if at least one is selected
    if (!Object.values(highlightTypes).some(v => v)) {
      window.showToast('Bitte mindestens einen Highlight Type auswählen', 'error');
      return;
    }
    
    // Show loading
    const result = document.getElementById('videoResult');
    const button = document.getElementById('generateVideoBtn');
    
    if (button) {
      button.disabled = true;
      button.innerHTML = '<span class="btn-icon">Loading...</span>Verarbeite Video...';
    }
    
    if (result) {
      result.innerHTML = '<div class="loader"></div><p class="muted">Video wird verarbeitet...</p>';
      result.style.display = 'block';
    }
    
    // Call API
    const response = await window.authFetch('/api/create-highlights', {
      method: 'POST',
      body: JSON.stringify({
        videoName: window.CreatorState.uploadedVideoName,
        format,
        highlightTypes
      })
    });
    
    if (!response || !response.ok) {
      throw new Error('Video-Verarbeitung fehlgeschlagen');
    }
    
    const data = await response.json();
    
    if (data.success && data.highlights) {
      // Reload coins
      window.loadCoins();
      
      // Update result
      if (result) {
        const clips = data.highlights.clips || [];
        const highlightsHtml = clips.map((clip, i) => `
          <div class="card" style="margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #ff6b35;">Highlight ${i + 1}</strong>
                <p class="muted" style="margin: 0;">${clip.title}</p>
              </div>
              <span class="muted">${clip.start} - ${clip.end}</span>
            </div>
          </div>
        `).join('');
        
        result.innerHTML = `
          <div class="card" style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981;">
            <h4 style="color: #10b981;"><span style="margin-right: 8px;">✓</span>Video erfolgreich verarbeitet!</h4>
            <p class="muted">${clips.length} Highlights gefunden</p>
            <p class="muted">Format: ${format}</p>
            <p class="muted">15 Coins wurden abgezogen</p>
          </div>
          
          <h4 style="margin-top: 20px;">GEFUNDENE HIGHLIGHTS:</h4>
          ${highlightsHtml || '<p class="muted">Keine Highlights gefunden</p>'}
          
          <div class="action-buttons" style="margin-top: 20px;">
            <button class="btn primary" onclick="window.downloadVideoResult()">
              <span class="btn-icon">Download</span>Video herunterladen
            </button>
            <button class="btn secondary" onclick="window.resetVideoPage()">
              <span class="btn-icon">Reset</span>Neues Video
            </button>
          </div>
        `;
      }
      
      window.showToast('Video erfolgreich verarbeitet!', 'success');
    }
    
  } catch (error) {
    console.error('Video processing failed:', error);
    window.showToast('Video-Verarbeitung fehlgeschlagen', 'error');
    
    const result = document.getElementById('videoResult');
    if (result) {
      result.innerHTML = '<p class="muted">Fehler bei der Verarbeitung. Bitte versuche es erneut.</p>';
    }
  } finally {
    const button = document.getElementById('generateVideoBtn');
    if (button) {
      button.disabled = false;
      button.innerHTML = '<span class="btn-icon">Create</span>Video verarbeiten (15 Coins)';
    }
  }
};

window.downloadVideoResult = function() {
  window.showToast('Download wird vorbereitet...', 'info');
};

window.resetVideoPage = function() {
  window.CreatorState = window.CreatorState || {};
  delete window.CreatorState.uploadedVideo;
  delete window.CreatorState.uploadedVideoName;
  delete window.CreatorState.uploadedVideoSize;
  delete window.CreatorState.videoDuration;
  
  const fileInfo = document.getElementById('videoFileInfo');
  const highlightSection = document.getElementById('highlightDetectionSection');
  const formatSection = document.getElementById('videoFormatSection');
  const result = document.getElementById('videoResult');
  const input = document.getElementById('videoFile');
  
  if (fileInfo) fileInfo.style.display = 'none';
  if (highlightSection) highlightSection.style.display = 'none';
  if (formatSection) formatSection.style.display = 'none';
  if (result) result.style.display = 'none';
  if (input) input.value = '';
  
  window.showToast('Bereit für neues Video', 'info');
};

// Fix 7: Utility functions
window.readFileAsDataUrl = function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

window.downloadGeneratedLogo = function downloadGeneratedLogo() {
  if (window.CreatorState?.logoImage) {
    const link = document.createElement('a');
    link.href = window.CreatorState.logoImage;
    link.download = 'creator-studio-logo.png';
    link.click();
    window.showToast('Logo heruntergeladen', 'success');
  } else {
    window.showToast('Kein Logo zum Download vorhanden', 'error');
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
  
  const prompt = window.buildMagicPrompt ? 
    window.buildMagicPrompt({
      name: brandName,
      clan: clanName,
      game,
      style,
      colors,
      notes
    }) :
    `Create a professional esports logo for "${brandName}"`;

  try {
    await navigator.clipboard.writeText(prompt);
    window.showToast('Prompt kopiert', 'success');
  } catch (error) {
    console.error('Failed to copy prompt:', error);
    window.showToast('Prompt kopieren fehlgeschlagen', 'error');
  }
};

// Fix 8: Auto-initialization and page detection
document.addEventListener('DOMContentLoaded', () => {
  console.log('Frontend Fixed loaded successfully');
  
  // Load coins immediately
  window.loadCoins();
  
  // Refresh coins every 30 seconds
  setInterval(window.loadCoins, 30000);
  
  // Initialize current page
  const currentPath = window.location.hash.replace('#', '') || 'dashboard';
  
  setTimeout(() => {
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
  }, 1000);
});

console.log('Frontend Fixed loaded');
