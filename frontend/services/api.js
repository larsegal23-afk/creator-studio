window.api = async function api(path, options = {}) {
  try {
    const response = await fetch(`${window.APP_CONFIG.apiBase}${path}`, options);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return await response.json().catch(() => null);
  } catch (error) {
    console.log("API error", error);
    return null;
  }
};

window.apiAuth = async function apiAuth(path, options = {}) {
  const response = await window.authFetch(path, options);
  if (!response) {
    return null;
  }

  return await response.json().catch(() => null);
};

window.status = async function status() {
  return await window.api("/api/test");
};
