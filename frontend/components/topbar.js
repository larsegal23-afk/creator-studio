function loadTopbar(){

const topbar=
document.getElementById("topbar");

if(!topbar){
return;
}

topbar.innerHTML=

`<div style="
height:60px;
background:#0d0d16;
display:flex;
align-items:center;
justify-content:space-between;
padding:0 20px;
border-bottom:1px solid #1e293b;
">

<div>

Creator Studio

</div>

<div style="
display:flex;
gap:15px;
align-items:center;
">

<span id="coinsTop">

Coins: -

</span>

<button id="logoutBtn">

Logout

</button>

</div>

</div>`;

/* LOGOUT */

const logoutBtn=
document.getElementById("logoutBtn");

if(logoutBtn){

logoutBtn.addEventListener(

"click",

()=>{

logout();

}

);

}

}