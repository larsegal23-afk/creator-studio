// Frontend App.js - Coins System
console.log('=== Frontend App Initializing ===');

// 2.1 COINS LADEN (KEIN SPAM!)
async function loadCoins() {
  try {
    const token = await getUserToken(); // deine Firebase Funktion

    const res = await fetch("/api/get-coins", {
      headers: {
        "Authorization": "Bearer " + token
      }
    });

    const data = await res.json();
    
    // Update all coin displays
    const coinElements = [
      document.querySelector("#coins"),
      document.querySelector("#coinsValue"),
      document.querySelector("#coinsTopValue"),
      document.querySelector("#currentCoins")
    ].filter(Boolean);

    coinElements.forEach(element => {
      element.innerText = data.coins || 0;
    });

    console.log('Coins loaded:', data.coins);
  } catch (error) {
    console.error('Failed to load coins:', error);
  }
}

// Get Firebase Token
async function getUserToken() {
  if (window.firebaseAuthApi) {
    return await window.firebaseAuthApi.getToken();
  }
  return localStorage.getItem("token");
}

// einmal laden
document.addEventListener('DOMContentLoaded', () => {
  loadCoins();
});

// nur alle 30 Sekunden
setInterval(loadCoins, 30000);

// 3.1 USE COINS FUNCTION
async function useCoins(amount) {
  try {
    const token = await getUserToken();

    const res = await fetch("/api/use-coins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ amount })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Coins error");
    }

    // Reload coins after successful use
    setTimeout(() => {
      loadCoins();
    }, 1000);

    return true;
  } catch (err) {
    console.error('Failed to use coins:', err);
    throw err;
  }
}

// 3.2 LOGO GENERATOR → COINS ABZIEHEN
async function generateLogo() {
  try {
    // 👇 HIER
    await useCoins(5);

    // 👉 DANN ERST GENERIEREN
    await generateLogoAI();

  } catch (err) {
    alert("Nicht genug Coins!");
  }
}

// Placeholder for actual logo generation
async function generateLogoAI() {
  console.log('Generating logo with AI...');
  // Your actual logo generation logic here
}

// Export functions globally
window.loadCoins = loadCoins;
window.useCoins = useCoins;
window.generateLogo = generateLogo;
window.getUserToken = getUserToken;
