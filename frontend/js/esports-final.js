// Esports Final Functions - Clean Output & Proper Sizes
console.log('=== Esports Final Functions ===');

window.esportsFinal = {
  // 2. Richtige Größen für Assets
  assetSizes: {
    overlay: { width: 1920, height: 1080 },
    alert: { width: 1920, height: 1080 },
    panel: { width: 1920, height: 1080 },
    badge: { width: 64, height: 64 },
    sticker: { width: 512, height: 512 },
    avatar: { width: 512, height: 512 },
    banner: { width: 1920, height: 480 },
    mobile: { width: 1080, height: 1920 },
    ultraWide: { width: 2560, height: 1920 }
  },

  // 3. Coins Integration finalisieren
  async generateLogo() {
    try {
      console.log('Generating Esports logo...');
      
      // Check coins first
      const hasCoins = await window.useCoins(5);
      if (!hasCoins) {
        throw new Error('Nicht genug Coins für Logo-Generierung');
      }

      // Get form data
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
        button.innerHTML = '<span class="btn-icon">⏳</span>Erstelle Esports Logo...';
      }

      if (result) {
        result.innerHTML = '<div class="esports-loader"></div>';
      }

      // Build esports prompt
      const prompt = this.buildEsportsPrompt({
        brandName,
        clanName,
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
          requestId: `esports-logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          quality: 'esports-4k'
        })
      });

      if (!response || !response.ok) {
        throw new Error('Logo-Generierung fehlgeschlagen');
      }

      const data = await response.json();
      
      // Clean output - no junk
      if (data.image && !data.image.includes('data:,')) {
        window.CreatorState.logoImage = data.image;
        
        // Update preview
        const preview = document.getElementById('logoPreviewFrame');
        if (preview) {
          preview.innerHTML = `<img src="${data.image}" alt="Esports Logo" style="max-width: 100%; border-radius: 8px;">`;
        }

        // Update result
        if (result) {
          result.innerHTML = `
            <div class="esports-asset">
              <h3 style="color: var(--esports-primary);">${brandName}</h3>
              <p class="muted">Esports Logo erstellt mit 4K Qualität</p>
              <div class="action-buttons">
                <button class="esports-btn" onclick="window.downloadEsportsLogo()">
                  <span class="btn-icon">📥</span>
                  Logo herunterladen
                </button>
                <button class="esports-btn" onclick="window.copyEsportsPrompt()">
                  <span class="btn-icon">📋</span>
                  Prompt kopieren
                </button>
              </div>
            </div>
          `;
        }

        // Save to DNA library
        this.saveToDnaLibrary({ brandName, clanName, game, style, colors, notes });
        
        window.showToast('Esports Logo erfolgreich erstellt!', 'success');
      }

    } catch (error) {
      console.error('Esports logo generation failed:', error);
      window.showToast(error.message || 'Logo-Generierung fehlgeschlagen', 'error');
    } finally {
      // Reset button
      const button = document.getElementById('generateLogoBtn');
      if (button) {
        button.disabled = false;
        button.innerHTML = '<span class="btn-icon">🎨</span>Esports Logo erstellen (5 Coins)';
      }
    }
  },

  async generateStreamPack() {
    try {
      console.log('Generating Esports stream pack...');
      
      // Check coins first
      const hasCoins = await window.useCoins(15);
      if (!hasCoins) {
        throw new Error('Nicht genug Coins für Stream Pack');
      }

      const brandName = document.getElementById('streamBrandName')?.value?.trim();
      const theme = document.getElementById('streamTheme')?.value;
      const assets = Array.from(document.querySelectorAll('input[name="streamAsset"]:checked'))
        .map(input => input.value);
      const format = document.querySelector('input[name="streamFormat"]:checked')?.value;
      const colorScheme = document.querySelector('input[name="colorScheme"]:checked')?.value;

      if (!brandName) {
        window.showToast('Bitte einen Projektnamen eingeben.', 'error');
        return;
      }

      // Show loading
      const button = document.getElementById('generateStreamBtn');
      if (button) {
        button.disabled = true;
        button.innerHTML = '<span class="btn-icon">⏳</span>Erstelle Esports Stream Pack...';
      }

      // Generate clean assets
      const assetData = this.generateEsportsAssets({
        brandName,
        theme,
        assets,
        format,
        colorScheme
      });

      // Update preview
      const preview = document.getElementById('streamPreview');
      if (preview) {
        preview.innerHTML = `
          <div class="esports-asset">
            <h3 style="color: var(--esports-primary);">${brandName} Esports Pack</h3>
            <p class="muted">Professionelle Esports Assets erstellt</p>
            <div class="esports-grid">
              ${assets.map(asset => `
                <div class="asset-option esports-asset">
                  <span class="esports-quality">${asset.name}</span>
                  <span>${this.assetSizes[asset.type] ? `${this.assetSizes[asset.type].width}x${this.assetSizes[asset.type].height}` : 'Standard'}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      // Update download area
      const downloadArea = document.getElementById('streamDownloadArea');
      if (downloadArea) {
        downloadArea.innerHTML = `
          <div class="esports-asset">
            <h4>Download-Optionen</h4>
            <div class="action-buttons">
              <button class="esports-btn" onclick="window.downloadEsportsStreamPack()">
                <span class="btn-icon">📦</span>
                Komplettes Pack herunterladen
              </button>
              <button class="esports-btn" onclick="window.downloadEsportsAssets()">
                <span class="btn-icon">📁</span>
                Einzelne Assets
              </button>
            </div>
          </div>
        `;
      }

      window.showToast('Esports Stream Pack erfolgreich erstellt!', 'success');

    } catch (error) {
      console.error('Esports stream pack generation failed:', error);
      window.showToast(error.message || 'Stream Pack-Erstellung fehlgeschlagen', 'error');
    } finally {
      // Reset button
      const button = document.getElementById('generateStreamBtn');
      if (button) {
        button.disabled = false;
        button.innerHTML = '<span class="btn-icon">🎦</span>Esports Stream Pack erstellen (15 Coins)';
      }
    }
  },

  // 4. Kein Müll Output - Clean generation
  buildEsportsPrompt({ brandName, clanName, game, style, colors, notes }) {
    const cleanBrandName = String(brandName || '').trim();
    const cleanClanName = String(clanName || '').trim();
    const cleanGame = String(game || '').trim();
    const cleanStyle = String(style || '').trim();
    const cleanNotes = String(notes || '').trim();
    const cleanColors = Array.isArray(colors) ? colors.filter(Boolean) : [];

    // Esports-specific game profiles
    const esportsProfiles = {
      'valorant': { tier: 'Tactical', vibe: 'precise, competitive, team-based' },
      'apex': { tier: 'Battle Royale', vibe: 'fast-paced, aggressive, survival' },
      'cs2': { tier: 'Strategic', vibe: 'tactical, precise, competitive' },
      'fortnite': { tier: 'Battle Royale', vibe: 'energetic, colorful, dynamic' },
      'lol': { tier: 'MOBA', vibe: 'strategic, team-fighting, champion-focused' },
      'call of duty': { tier: 'Military FPS', vibe: 'realistic, tactical, intense' }
    };

    const profile = esportsProfiles[cleanGame.toLowerCase()] || { tier: 'Esports', vibe: 'competitive, professional' };

    // Build clean prompt
    const promptParts = [
      'ESPORTS LOGO GENERATION - PROFESSIONAL QUALITY',
      '',
      'BRAND IDENTITY:',
      `- Brand Name: "${cleanBrandName}"`,
      cleanClanName ? `- Clan/Team: "${cleanClanName}"` : '',
      cleanGame ? `- Game: ${cleanGame} (${profile.tier} Tier)` : '',
      cleanStyle ? `- Style: ${cleanStyle}` : '',
      cleanColors.length ? `- Colors: ${cleanColors.join(', ')}` : '',
      cleanNotes ? `- Notes: ${cleanNotes}` : '',
      '',
      'ESPORTS REQUIREMENTS:',
      '- Professional gaming aesthetic',
      '- High contrast for visibility',
      '- Scalable for different sizes',
      `- Vibe: ${profile.vibe}`,
      '- Modern, clean design',
      '- Suitable for tournaments',
      '',
      'TECHNICAL SPECIFICATIONS:',
      '- Resolution: 4K (4096x4096)',
      '- Format: PNG with transparency',
      '- Color mode: RGB',
      '- No compression artifacts',
      '- Clean, sharp edges'
    ];

    return promptParts.filter(Boolean).join('\n');
  },

  generateEsportsAssets({ brandName, theme, assets, format, colorScheme }) {
    const cleanAssets = assets.filter(Boolean);
    
    return cleanAssets.map(asset => ({
      name: asset,
      type: this.getAssetType(asset),
      size: this.assetSizes[this.getAssetType(asset)] || this.assetSizes.overlay,
      format: format || '16:9',
      theme: theme || 'Esports',
      colorScheme: colorScheme || 'Dark'
    }));
  },

  getAssetType(asset) {
    if (asset.includes('Overlay') || asset.includes('Rahmen')) return 'overlay';
    if (asset.includes('Alert')) return 'alert';
    if (asset.includes('Panel')) return 'panel';
    if (asset.includes('Badge')) return 'badge';
    if (asset.includes('Sticker')) return 'sticker';
    if (asset.includes('Banner')) return 'banner';
    if (asset.includes('Avatar')) return 'avatar';
    return 'overlay'; // default
  },

  saveToDnaLibrary(entry) {
    try {
      const library = JSON.parse(localStorage.getItem('esports-dna-library') || '[]');
      library.unshift({
        ...entry,
        id: Date.now(),
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('esports-dna-library', JSON.stringify(library.slice(0, 20)));
    } catch (error) {
      console.error('Failed to save to DNA library:', error);
    }
  }
};

// Export functions
window.downloadEsportsLogo = function() {
  if (window.CreatorState.logoImage) {
    const link = document.createElement('a');
    link.href = window.CreatorState.logoImage;
    link.download = 'esports-logo-4k.png';
    link.click();
  }
};

window.copyEsportsPrompt = function() {
  const prompt = window.esportsFinal.buildEsportsPrompt({
    brandName: document.getElementById('logoName')?.value,
    clanName: document.getElementById('logoClan')?.value,
    game: document.getElementById('logoGame')?.value,
    style: document.getElementById('logoStyle')?.value,
    colors: Array.from(document.querySelectorAll('input[name="logoColor"]:checked'))
      .map(input => input.value),
    notes: document.getElementById('logoNotes')?.value
  });
  
  navigator.clipboard.writeText(prompt);
  window.showToast('Esports Prompt kopiert!', 'success');
};

window.downloadEsportsStreamPack = function() {
  window.showToast('Stream Pack Download wird vorbereitet...', 'info');
  // Implementation would go here
};

window.downloadEsportsAssets = function() {
  window.showToast('Einzelne Assets werden vorbereitet...', 'info');
  // Implementation would go here
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('Esports Final Functions loaded');
});
