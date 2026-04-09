async function login(){

const email=document
.getElementById("email")
.value
.trim()
.toLowerCase();

const password=document
.getElementById("password")
.value;

if(!email || !password){

showToast(
"Enter email and password",
"error"
);

return;

}

const btn=
document.getElementById("loginBtn");

if(btn){

btn.disabled=true;

btn.innerText="Logging in...";

}

try{

const res=
await fetch(
"/api/login",
{
method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

email,
password

})

}
);

/* STATUS CHECK */

if(!res.ok){

throw new Error();

}

const data=
await res.json();

/* SUCCESS */

if(data?.success && data?.token){

localStorage.setItem(
"token",
data.token
);

/* BETTER NAVIGATION */

loadPage("dashboard");

return;

}

showToast(
data?.error || "Login failed",
"error"
);

}catch(e){

showToast(
"Server error",
"error"
);

}

/* ALWAYS RESET BUTTON */

if(btn){

btn.disabled=false;

btn.innerText="Login";

}

}

/* ENTER LOGIN */

function initLoginPage(){

const passwordInput=
document.getElementById("password");

if(passwordInput){

passwordInput.addEventListener(

"keypress",

(e)=>{

if(e.key==="Enter"){

login();

}

}

);

}

}