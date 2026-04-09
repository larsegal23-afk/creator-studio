/* LOGIN CHECK */

function isLogged(){

return !!localStorage.getItem("token");

}

/* ROUTER */

async function loadPage(name){

/* AUTH PROTECT */

if(!isLogged() && name!=="login"){

name="login";

}

try{

const container=
document.getElementById("app");

if(!container){

console.log("Router container missing");

return;

}

/* SIDEBAR ACTIVE */

document
.querySelectorAll("#sidebar button")
.forEach(btn=>{

btn.classList.remove("active");

if(
btn.innerText
.toLowerCase()
.includes(name)
){

btn.classList.add("active");

}

});

/* LOADING */

container.innerHTML=

`<div class="card">

<h3>Loading</h3>

<div class="loader"></div>

</div>`;

/* FETCH */

const res=
await fetch(

"pages/"+name+".html"

);

if(!res.ok){

throw new Error();

}

const html=
await res.text();

/* INJECT */

container.innerHTML=html;

/* INIT */

initPage(name);

}catch(e){

console.log("Router error:",e);

document
.getElementById("app")
.innerHTML=

`<div class="card">

<h2>Page error</h2>

<p>Could not load page</p>

</div>`;

}

}

/* PAGE INIT */

function initPage(name){

/* LOGIN */

if(name==="login"){

if(typeof initLoginPage==="function"){

initLoginPage();

}

}

/* DASHBOARD */

if(name==="dashboard"){

if(typeof loadUser==="function"){

loadUser();

}

}

/* PROJECTS */

if(name==="projects"){

if(typeof loadProjects==="function"){

loadProjects();

}

}

/* ACTIVITY */

if(name==="activity"){

if(typeof loadActivity==="function"){

loadActivity();

}

}

/* ADMIN */

if(name==="admin"){

if(typeof loadAdmin==="function"){

loadAdmin();

}

if(typeof loadAnalytics==="function"){

loadAnalytics();

}

}

/* SETTINGS */

if(name==="settings"){

if(typeof loadSettings==="function"){

loadSettings();

}

}

/* VIDEO */

if(name==="video"){

console.log("Video ready");

}

/* LOGO */

if(name==="logo"){

console.log("Logo ready");

}

}

/* AUTO START */

window.addEventListener(

"load",

()=>{

/* LOAD UI */

if(typeof loadSidebar==="function"){
loadSidebar();
}

if(typeof loadTopbar==="function"){
loadTopbar();
}

/* ROUTE */

if(isLogged()){

loadPage("dashboard");

}else{

loadPage("login");

}

}
);
window.addEventListener("load",()=>{

loadSidebar();

loadTopbar();

if(isLogged()){

loadPage("dashboard");

}else{

loadPage("login");

}

});