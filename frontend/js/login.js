window.initLoginPage = function initLoginPage() {
  const form = document.getElementById("loginForm");
  const passwordInput = document.getElementById("password");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await window.login();
  });

  passwordInput?.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await window.login();
    }
  });
};

window.login = async function login() {
  const email = document.getElementById("email")?.value.trim().toLowerCase() || "";
  const password = document.getElementById("password")?.value || "";
  const button = document.getElementById("loginBtn");
  const hint = document.getElementById("loginHint");

  if (!email || !password) {
    window.showToast("Bitte Email und Passwort eingeben.", "error");
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Anmeldung laeuft...";
  }

  if (hint) {
    hint.textContent = "Verbindung zu Firebase wird aufgebaut...";
  }

  try {
    await window.firebaseAuthReady;
    await window.firebaseAuthApi.login(email, password);
    await window.authFetch("/api/init-user", { method: "POST" });

    if (hint) {
      hint.textContent = "Login erfolgreich. Studio wird geladen...";
    }

    await window.loadPage("dashboard");
    window.showToast("Willkommen im Creator Studio.");
  } catch (error) {
    console.log("Login failed", error);

    if (hint) {
      hint.textContent = "Login fehlgeschlagen. Bitte Zugangsdaten pruefen.";
    }

    window.showToast("Login fehlgeschlagen.", "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Login";
    }
  }
};
