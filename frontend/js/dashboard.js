const API = "https://logomakergermany-ultimate-backend-production.up.railway.app"

/* TOKEN */
async function getToken(){
  const user = firebase.auth().currentUser

  if(!user){
    window.location.href="/"
    return null
  }

  return await user.getIdToken()
}
/* AUTH FETCH */
async function authFetch(url,options={}){
  const token = await getToken()

  if(!token) return

  options.headers={
    ...(options.headers || {}),
    "Authorization":"Bearer "+token,
    "Content-Type":"application/json"
  }

  const res = await fetch(API + url,options)

  if(res.status===401){
    window.location.href="/"
    return
  }

  return res
}

/* INIT USER */
async function initUser(){
  await authFetch("/api/init-user",{method:"POST"})
}

/* LOAD USER DATA */
async function loadUser(){
  try{
    const res = await authFetch("/api/user")

    if(!res || !res.ok){
      throw new Error()
    }

    const data = await res.json()

    updateUI(data)

  }catch(e){
    console.log("User load error:",e)
    fallbackUI()
  }
}

/* LOAD COINS */
async function loadCoins(){
  const res = await authFetch("/api/get-coins")

  if(!res) return

  const data = await res.json()

  document.getElementById("coins").innerText =
    "Coins: " + (data.coins ?? 0)
}

/* LOAD ACTIVITY */
async function loadActivity(){
  try{
    const res = await authFetch("/api/activity")

    if(!res || !res.ok){
      throw new Error()
    }

    const data = await res.json()

    let html=""

    if(!data || data.length===0){
      html="<p style='color:#9ca3af'>No activity yet</p>"
      document.getElementById("activityList").innerHTML=html
      return
    }

    data.forEach(a=>{
      html+=`
        <div class="card">
          <p><b>${a.type || "Activity"}</b></p>
          <p style="color:#9ca3af">${a.reference || ""}</p>
          <p style="color:#7c3aed">
            Coins: ${a.amount ?? 0}
          </p>
        </div>
      `
    })

    document.getElementById("activityList").innerHTML=html

  }catch(e){
    document.getElementById("activityList").innerHTML =
      "<p style='color:red'>Failed loading activity</p>"
  }
}

/* BUY COINS (STRIPE) */
async function buyCoins(){
  const res = await authFetch("/api/create-checkout-session",{
    method:"POST"
  })

  if(!res) return

  const data = await res.json()

  if(data.url){
    window.location.href = data.url
  }else{
    alert("Payment error")
  }
}

/* UPDATE UI */
function updateUI(data){
  const coinsText = "Coins: " + (data.coins ?? 0)
  const projectsText = "Projects: " + (data.projects ?? 0)

  document.getElementById("coins").innerText = coinsText
  document.getElementById("projects").innerText = projectsText

  const top = document.getElementById("coinsTop")
  if(top){
    top.innerText = coinsText
  }
}

/* FALLBACK */
function fallbackUI(){
  document.getElementById("coins").innerText="Coins: -"
  document.getElementById("projects").innerText="Projects: -"
}

/* INIT */
async function initDashboard(){
  await initUser()
  await loadUser()
  await loadActivity()
}

setTimeout(initDashboard,500)