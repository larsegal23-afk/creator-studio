// Page initialization functions

window.initLogoPage = function initLogoPage() {
  console.log('Logo page initialized');
  window.loadUser();
  
  const logoForm = document.getElementById('logoForm');
  if (logoForm) {
    logoForm.addEventListener('submit', handleLogoSubmit);
  }
};

window.initStreamPage = function initStreamPage() {
  console.log('Stream page initialized');
  window.loadUser();
  
  const streamForm = document.getElementById('streamForm');
  if (streamForm) {
    streamForm.addEventListener('submit', handleStreamSubmit);
  }
};

window.initVideoPage = function initVideoPage() {
  console.log('Video page initialized');
  window.loadUser();
  
  const videoUpload = document.getElementById('videoUpload');
  if (videoUpload) {
    videoUpload.addEventListener('change', handleVideoUpload);
  }
};

window.initLogoDnaPage = function initLogoDnaPage() {
  console.log('Logo DNA page initialized');
  window.loadUser();
  
  const dnaForm = document.getElementById('dnaForm');
  if (dnaForm) {
    dnaForm.addEventListener('submit', handleDnaSubmit);
  }
};

window.initSystemPage = function initSystemPage() {
  console.log('System page initialized');
  checkSystemStatus();
};

window.initDashboardPage = function initDashboardPage() {
  console.log('Dashboard page initialized');
  window.loadUser();
  loadProjects();
};

window.initSettingsPage = function initSettingsPage() {
  console.log('Settings page initialized');
  window.loadUser();
};

window.initProfilePage = function initProfilePage() {
  console.log('Profile page initialized');
  window.loadUser();
};

window.initBillingPage = function initBillingPage() {
  console.log('Billing page initialized');
  window.loadUser();
  loadBillingInfo();
  loadTransactionHistory();
  
  // Check URL parameters for success/canceled
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('success') === 'true') {
    window.showToast('Zahlung erfolgreich! Coins wurden gutgeschrieben.', 'success');
  } else if (urlParams.get('canceled') === 'true') {
    window.showToast('Zahlung abgebrochen.', 'info');
  }
};

async function loadBillingInfo() {
  try {
    const response = await window.Api.user.getCoins();
    const coinsElement = document.getElementById('currentCoins');
    
    if (coinsElement && response) {
      coinsElement.textContent = response.coins || 0;
    }
  } catch (error) {
    console.error('Failed to load billing info:', error);
  }
}

async function loadTransactionHistory() {
  const container = document.getElementById('transactionHistory');
  if (!container) return;
  
  try {
    // This would need a new endpoint /api/transactions
    container.innerHTML = '<p class="muted">Transaktionshistorie wird geladen...</p>';
  } catch (error) {
    container.innerHTML = '<p class="muted">Konnte Transaktionen nicht laden.</p>';
  }
}

window.initCoinsPage = function initCoinsPage() {
  console.log('Coins page initialized');
  window.loadUser();
  loadCoinsHistory();
};

// Event handlers
async function handleLogoSubmit(event) {
  event.preventDefault();
  const prompt = document.getElementById('logoPrompt')?.value;
  if (!prompt) {
    window.showToast('Bitte geben Sie eine Beschreibung ein', 'error');
    return;
  }
  
  try {
    const response = await window.apiAuth('/api/logo/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });
    
    if (response?.image) {
      window.CreatorState.logoImage = response.image;
      window.showToast('Logo erfolgreich erstellt!', 'success');
    }
  } catch (error) {
    window.showToast('Fehler beim Erstellen des Logos', 'error');
  }
}

async function handleStreamSubmit(event) {
  event.preventDefault();
  window.showToast('Stream-Pack wird erstellt...', 'info');
}

async function handleVideoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const formData = new FormData();
    formData.append('video', file);
    
    const response = await fetch(`${window.APP_CONFIG.apiBase}/api/video/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (response.ok) {
      window.showToast('Video erfolgreich hochgeladen', 'success');
    }
  } catch (error) {
    window.showToast('Fehler beim Hochladen des Videos', 'error');
  }
}

async function handleDnaSubmit(event) {
  event.preventDefault();
  window.showToast('Logo DNA wird gespeichert...', 'info');
}

async function checkSystemStatus() {
  try {
    const status = await window.status();
    const statusElement = document.getElementById('systemStatus');
    if (statusElement) {
      statusElement.innerHTML = status?.status === 'running' 
        ? '✅ System online' 
        : '❌ System offline';
    }
  } catch (error) {
    console.error('Status check failed:', error);
  }
}

async function loadProjects() {
  const projects = JSON.parse(localStorage.getItem('creatorStudio.projects') || '[]');
  const projectsElement = document.getElementById('projectsList');
  if (projectsElement) {
    projectsElement.innerHTML = projects.length 
      ? `${projects.length} Projekte` 
      : 'Keine Projekte';
  }
}

async function loadBillingInfo() {
  // Load billing information
}

async function loadCoinsHistory() {
  // Load coins transaction history
}
