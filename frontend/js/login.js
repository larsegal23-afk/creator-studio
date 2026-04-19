window.initLoginPage = function initLoginPage() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");

  // Tab switching
  loginTab?.addEventListener("click", () => switchToLogin());
  registerTab?.addEventListener("click", () => switchToRegister());

  // Login form
  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await window.login();
  });

  // Register form
  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await window.register();
  });

  // Enter key support
  document.getElementById("password")?.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await window.login();
    }
  });

  document.getElementById("regPasswordConfirm")?.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await window.register();
    }
  });
};

function switchToLogin() {
  document.getElementById("loginTab")?.classList.add("active");
  document.getElementById("registerTab")?.classList.remove("active");
  document.getElementById("loginForm")?.classList.remove("hidden");
  document.getElementById("registerForm")?.classList.add("hidden");
  
  document.getElementById("formTitle").textContent = "Login";
  document.getElementById("formSubtitle").textContent = "Sicher ueber Firebase.";
  document.getElementById("authTitle").textContent = "Anmelden und direkt starten.";
  document.getElementById("authSubtitle").textContent = "Nach dem Login werden Coins und Module automatisch synchronisiert.";
}

function switchToRegister() {
  document.getElementById("loginTab")?.classList.remove("active");
  document.getElementById("registerTab")?.classList.add("active");
  document.getElementById("loginForm")?.classList.add("hidden");
  document.getElementById("registerForm")?.classList.remove("hidden");
  
  document.getElementById("formTitle").textContent = "Registrieren";
  document.getElementById("formSubtitle").textContent = "Neues Konto erstellen.";
  document.getElementById("authTitle").textContent = "Konto erstellen und starten.";
  document.getElementById("authSubtitle").textContent = "Erstelle dein Konto und erhalte sofort 50 Coins.";
}

window.register = async function register() {
  const email = document.getElementById("regEmail")?.value.trim().toLowerCase() || "";
  const password = document.getElementById("regPassword")?.value || "";
  const passwordConfirm = document.getElementById("regPasswordConfirm")?.value || "";
  const button = document.getElementById("registerBtn");
  const hint = document.getElementById("loginHint");

  if (!email || !password || !passwordConfirm) {
    window.showToast("Bitte alle Felder ausfüllen.", "error");
    return;
  }

  if (password.length < 6) {
    window.showToast("Passwort muss mindestens 6 Zeichen lang sein.", "error");
    return;
  }

  if (password !== passwordConfirm) {
    window.showToast("Passwörter stimmen nicht überein.", "error");
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Wird erstellt...";
  }

  if (hint) {
    hint.textContent = "Konto wird erstellt...";
  }

  try {
    await window.firebaseAuthReady;
    
    // Create user with Firebase Auth API
    const userCredential = await window.firebaseAuthApi.register(email, password);
    
    // Initialize user in backend
    await window.authFetch("https://logomakergermany-ultimate-backend-production.up.railway.app/api/init-user", { method: "POST" });

    if (hint) {
      hint.textContent = "Konto erstellt! Dashboard wird geladen...";
    }

    await window.loadPage("dashboard");
    window.showToast("Konto erfolgreich erstellt! Willkommen.");
  } catch (error) {
    console.log("Registration failed", error);

    if (hint) {
      hint.textContent = "Registrierung fehlgeschlagen. Bitte erneut versuchen.";
    }

    if (error.code === 'auth/email-already-in-use') {
      window.showToast("Diese E-Mail wird bereits verwendet.", "error");
    } else if (error.code === 'auth/weak-password') {
      window.showToast("Passwort ist zu schwach.", "error");
    } else {
      window.showToast("Registrierung fehlgeschlagen: " + error.message, "error");
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Konto erstellen";
    }
  }
};

window.login = async function login() {
  const email = document.getElementById("email")?.value.trim().toLowerCase() || "";
  const password = document.getElementById("password")?.value || "";
  const button = document.getElementById("loginBtn");
  const hint = document.getElementById("loginHint");

  if (!email || !password) {
    window.showToast("Bitte E-Mail und Passwort eingeben.", "error");
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Anmeldung...";
  }

  if (hint) {
    hint.textContent = "Verbindung wird hergestellt...";
  }

  try {
    await window.firebaseAuthReady;
    await window.firebaseAuthApi.login(email, password);
    await window.authFetch("https://logomakergermany-ultimate-backend-production.up.railway.app/api/init-user", { method: "POST" });

    if (hint) {
      hint.textContent = "Login erfolgreich. Dashboard wird geladen...";
    }

    await window.loadPage("dashboard");
    window.showToast("Willkommen.");
  } catch (error) {
    console.log("Login failed", error);

    if (hint) {
      hint.textContent = "Login fehlgeschlagen. Zugangsdaten pruefen.";
    }

    window.showToast("Login fehlgeschlagen.", "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Login";
    }
  }
};

// Debug registration
setTimeout(() => {
  console.log('=== Registration Debug Check ===');
  console.log('Firebase available:', typeof firebase !== 'undefined');
  console.log('firebaseAuthApi:', window.firebaseAuthApi);
  console.log('register function:', typeof window.register);
  
  if (window.firebaseAuthApi && typeof window.firebaseAuthApi.register === 'function') {
    console.log('Registration method available: YES');
  } else {
    console.log('Registration method available: NO');
  }
}, 2000);
