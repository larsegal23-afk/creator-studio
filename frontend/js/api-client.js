// Complete API Client Layer
window.ApiClient = {
  // Base configuration
  config: {
    baseUrl: window.APP_CONFIG?.apiBase || '',
    timeout: 30000,
    retries: 2
  },

  // Request queue for concurrent requests
  requestQueue: new Map(),

  // Authentication helpers
  getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? `Bearer ${token}` : null;
  },

  // Request wrapper with error handling
  async request(endpoint, options = {}) {
    const requestId = crypto.randomUUID();
    const url = `${this.config.baseUrl}${endpoint}`;
    
    try {
      // Set up default options
      const config = {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        signal: AbortSignal.timeout(this.config.timeout),
        ...options
      };

      // Add auth header if available
      const authHeader = this.getAuthHeader();
      if (authHeader) {
        config.headers.Authorization = authHeader;
      }

      // Log request in debug mode
      if (window.APP_CONFIG?.DEBUG_API_CALLS) {
        console.log(`[API] ${options.method || 'GET'} ${url}`, config);
      }

      // Make request
      const response = await fetch(url, config);
      
      // Handle different response types
      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else if (contentType?.includes('text/')) {
        data = await response.text();
      } else {
        data = await response.blob();
      }

      // Handle HTTP errors
      if (!response.ok) {
        throw new ApiError(response.status, data.message || data.error || 'Request failed', data);
      }

      // Log success in debug mode
      if (window.APP_CONFIG?.DEBUG_API_CALLS) {
        console.log(`[API] Response ${response.status}`, data);
      }

      return data;

    } catch (error) {
      // Handle different error types
      if (error.name === 'AbortError') {
        throw new ApiError(408, 'Request timeout');
      }
      
      if (error instanceof ApiError) {
        throw error;
      }

      // Network or other errors
      throw new ApiError(0, 'Network error', { originalError: error });
    }
  },

  // HTTP methods
  async get(endpoint, params = {}) {
    const url = new URL(endpoint, this.config.baseUrl);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });
    
    return this.request(url.pathname + url.search, { method: 'GET' });
  },

  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },

  // File upload
  async upload(endpoint, file, options = {}) {
    const formData = new FormData();
    formData.append('file', file);
    
    // Add additional fields
    Object.keys(options).forEach(key => {
      if (options[key] !== undefined && options[key] !== null) {
        formData.append(key, options[key]);
      }
    });

    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set content-type for multipart
    });
  },

  // Batch requests
  async batch(requests) {
    const promises = requests.map(({ endpoint, options }) => 
      this.request(endpoint, options)
    );
    
    return Promise.allSettled(promises);
  }
};

// Custom API Error class
class ApiError extends Error {
  constructor(status, message, data = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// API endpoints organized by feature
window.Api = {
  // Authentication
  auth: {
    async login(email, password) {
      return ApiClient.post('/api/auth/login', { email, password });
    },
    
    async logout() {
      return ApiClient.post('/api/auth/logout');
    },
    
    async verifyToken(token) {
      return ApiClient.post('/api/auth/verify', { token });
    }
  },

  // User management
  user: {
    async getProfile() {
      return ApiClient.get('/api/user/profile');
    },
    
    async updateProfile(data) {
      return ApiClient.put('/api/user/profile', data);
    },
    
    async getCoins() {
      return ApiClient.get('/api/get-coins');
    }
  },

  // Logo generation
  logo: {
    async generate(prompt, options = {}) {
      return ApiClient.post('/api/logo/generate', { 
        prompt, 
        ...options 
      });
    },
    
    async saveDna(dna) {
      return ApiClient.post('/api/logo/dna/save', { dna });
    },
    
    async getDna() {
      return ApiClient.get('/api/logo/dna');
    }
  },

  // Stream assets
  stream: {
    async generatePack(logoData, options = {}) {
      return ApiClient.post('/api/stream/generate', { 
        logoData, 
        ...options 
      });
    },
    
    async getAssets() {
      return ApiClient.get('/api/stream/assets');
    }
  },

  // Video processing
  video: {
    async upload(file, options = {}) {
      return ApiClient.upload('/api/video/upload', file, options);
    },
    
    async analyzeHighlights(videoId, types = []) {
      return ApiClient.post('/api/video/analyze-highlights', {
        videoId,
        highlightTypes: types
      });
    },
    
    async renderClips(videoId, clips, options = {}) {
      return ApiClient.post('/api/video/render-clips', {
        videoId,
        clips,
        ...options
      });
    },
    
    async getUploadToken(fileName) {
      return ApiClient.post('/api/video/upload-token', { fileName });
    }
  },

  // Coins and billing
  coins: {
    async useCoins(amount, type, reference = '') {
      return ApiClient.post('/api/use-coins', {
        amount,
        action: type,
        reference
      });
    },
    
    async getHistory() {
      return ApiClient.get('/api/coins/history');
    },
    
    async purchase(packageId) {
      return ApiClient.post('/api/coins/purchase', { packageId });
    }
  },

  // System and health
  system: {
    async getStatus() {
      return ApiClient.get('/api/test');
    },
    
    async getHealth() {
      return ApiClient.get('/api/health');
    }
  }
};

// Legacy compatibility - update existing functions
window.api = async function(endpoint, options = {}) {
  try {
    return await ApiClient.request(endpoint, options);
  } catch (error) {
    ErrorHandler?.log(error, `Legacy API: ${endpoint}`);
    throw error;
  }
};

window.apiAuth = async function(endpoint, options = {}) {
  try {
    return await ApiClient.request(endpoint, options);
  } catch (error) {
    ErrorHandler?.log(error, `Legacy Auth API: ${endpoint}`);
    throw error;
  }
};

window.authFetch = async function(endpoint, options = {}) {
  try {
    return await ApiClient.request(endpoint, options);
  } catch (error) {
    ErrorHandler?.log(error, `Auth Fetch: ${endpoint}`);
    throw error;
  }
};
