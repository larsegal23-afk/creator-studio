function getToken(){

return localStorage.getItem("token");

}

/* AUTH FETCH */

async function authFetch(url,options={}){

const token=getToken();

if(!token){

window.location.href="/";
return;
}

options.headers={
...(options.headers || {}),
"Authorization":"Bearer "+token,
"Content-Type":"application/json"
};

const res=await fetch(url,options);

/* AUTO LOGOUT */

if(res.status===401){

localStorage.removeItem("token");
window.location.href="/";
return;
}

return res;

}

/* LOAD USER */

async function loadUser(){

try{

const res=
await authFetch("/api/user");

if(!res || !res.ok){

throw new Error();

}

const data=
await res.json();

/* DASHBOARD */

updateUI(data);

}catch(e){

console.log("Dashboard error:",e);

fallbackUI();

}

}

/* UPDATE UI */

function updateUI(data){

const coinsText=
"Coins: "+(data.coins ?? 0);

const projectsText=
"Projects: "+(data.projects ?? 0);

/* MAIN */

const coins=
document.getElementById("coins");

if(coins){

coins.innerText=coinsText;

}

const projects=
document.getElementById("projects");

if(projects){

projects.innerText=projectsText;

}

/* TOP BAR */

const top=
document.getElementById("coinsTop");

if(top){

top.innerText=coinsText;

}

}

/* FALLBACK */

function fallbackUI(){

const coins=
document.getElementById("coins");

if(coins){

coins.innerText="Coins: -";

}

const projects=
document.getElementById("projects");

if(projects){

projects.innerText="Projects: -";

}

const top=
document.getElementById("coinsTop");

if(top){

top.innerText="Coins: -";

}

}