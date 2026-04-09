function loadSidebar(){

const sidebar=
document.getElementById("sidebar");

if(!sidebar){
return;
}

const token=
localStorage.getItem("token");

let isAdmin=false;

/* CHECK ADMIN */

if(token){

try{

const payload=
JSON.parse(
atob(
token.split(".")[1]
)
);

if(
payload.email===
"admin@email.com" /* same as ADMIN_EMAIL */
){

isAdmin=true;

}

}catch(e){

console.log("Token parse error");

}

}

/* MENU */

let html=`

<div style="background:#020617;
padding:20px;
height:100%;
display:flex;
flex-direction:column;
gap:10px;">

<h3>Creator</h3>

<button id="navDashboard">
Dashboard
</button>

<button id="navLogo">
Brand AI
</button>

<button id="navVideo">
Video AI
</button>

<button id="navProjects">
Projects
</button>

`;

/* ADMIN */

if(isAdmin){

html+=`

<button id="navAdmin">
Admin
</button>

`;

}

html+=`</div>`;

sidebar.innerHTML=html;

/* EVENTS */

document
.getElementById("navDashboard")
?.addEventListener(
"click",
()=>loadPage("dashboard")
);

document
.getElementById("navLogo")
?.addEventListener(
"click",
()=>loadTool("logo")
);

document
.getElementById("navVideo")
?.addEventListener(
"click",
()=>loadTool("video")
);

document
.getElementById("navProjects")
?.addEventListener(
"click",
()=>loadPage("projects")
);

document
.getElementById("navAdmin")
?.addEventListener(
"click",
()=>loadPage("admin")
);

}