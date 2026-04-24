window.register = async function(){

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if(!email || !password){
    alert("Enter email and password");
    return;
  }

  try {

  const API = "https://logomakergermany-ultimate-backen.up.railway.app/api/register";

const res = await fetch(API + "/api/register", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ email, password })
});

    const data = await res.json();

    if(data.success){
      alert("Account created!");
      loadPage("login");
    } else {
      alert(data.error || "Register failed");
    }

  } catch(e){
    alert("Server error");
  }

}