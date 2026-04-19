// Global error handling and logging
window.ErrorHandler = {
  log: function(error, context = '') {
    console.error(`[Error${context ? ` - ${context}` : ''}]`, error);
    
    // Send to error tracking service in production
    if (window.APP_CONFIG.apiBase.includes('railway.app')) {
      this.reportError(error, context);
    }
  },

  reportError: async function(error, context) {
    try {
      await window.apiAuth('/api/error/report', {
        method: 'POST',
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          context,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      });
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
    }
  },

  handleApiError: function(response, error) {
    if (response.status === 401) {
      window.showToast('Session abgelaufen. Bitte erneut anmelden.', 'error');
      setTimeout(() => window.loadPage('login'), 2000);
      return;
    }
    
    if (response.status === 402) {
      window.showToast('Nicht genügend Coins.', 'error');
      return;
    }
    
    if (response.status === 503) {
      window.showToast('Dienst nicht verfügbar. Bitte später versuchen.', 'error');
      return;
    }
    
    window.showToast('Ein Fehler ist aufgetreten.', 'error');
  }
};

// Global error event listeners
window.addEventListener('error', (event) => {
  ErrorHandler.log(event.error, 'Global Error');
});

window.addEventListener('unhandledrejection', (event) => {
  ErrorHandler.log(event.reason, 'Unhandled Promise Rejection');
});

// Enhanced API wrapper with error handling
window.apiWithErrorHandling = async function(path, options = {}) {
  try {
    const response = await window.api(path, options);
    return response;
  } catch (error) {
    ErrorHandler.log(error, `API: ${path}`);
    throw error;
  }
};

window.apiAuthWithErrorHandling = async function(path, options = {}) {
  try {
    const response = await window.apiAuth(path, options);
    return response;
  } catch (error) {
    ErrorHandler.log(error, `Auth API: ${path}`);
    throw error;
  }
};
