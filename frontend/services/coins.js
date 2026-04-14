window.userCoins = 9999; // 🔥 TEST MODE

window.useCoins = function(amount) {
  if (window.userCoins < amount) {
    alert("Nicht genug Coins!");
    return false;
  }

  window.userCoins -= amount;
  console.log("Coins:", window.userCoins);

  updateCoinsUI();
  return true;
};

window.updateCoinsUI = function() {
  const el = document.getElementById("coinDisplay");
  if (el) {
    el.innerText = "Coins: " + window.userCoins;
  }
};