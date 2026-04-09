/* TOOL LOADER */

async function loadTool(name){

try{

const container=
document.getElementById("app");

if(!container){

return;

}

container.innerHTML=
"<div class='card'>Loading tool...</div>";

const response=
await fetch("/tools/"+name+"/index.html");

if(!response.ok){

throw new Error();

}

const html=
await response.text();

container.innerHTML=html;

window.scrollTo(0,0);

}catch(e){

const container=
document.getElementById("app");

if(container){

container.innerHTML=

`<div class="card">
<h2>Tool Error</h2>
<p>Tool could not be loaded.</p>
</div>`;

}

}

}

/* TIMEOUT FETCH */

async function fetchTimeout(url,options={},timeout=15000){

return Promise.race([

fetch(url,options),

new Promise((_,reject)=>
setTimeout(()=>reject(new Error("timeout")),timeout)
)

]);

}

/* AUTH FETCH */

async function authFetch(url,options={}){

try{

const token=
localStorage.getItem("token");

options.headers={

...(options.headers||{}),

"Content-Type":"application/json",

...(token?{

Authorization:"Bearer "+token

}:{})

};

const response=
await fetchTimeout(url,options);

/* EXPIRED */

if(!response){

throw new Error();

}

if(response.status===401){

showToast("Session expired","error");

logout();

return null;

}

return response;

}catch(e){

showToast("Network error","error");

return null;

}

}

/* 🔥 AI JOB CREATOR */

async function createAIJob(tool,prompt){

const res=
await authFetch("/api/ai/create",{

method:"POST",

body:JSON.stringify({

tool,
prompt

})

});

if(!res){

return null;

}

const data=
await res.json();

if(!data?.success){

showToast(
data?.error || "Failed",
"error"
);

return null;

}

return data.job;

}

/* 🔥 JOB POLLING */

async function waitForJob(jobId,callback){

let tries=0;

const maxTries=40;

const interval=setInterval(async()=>{

tries++;

const res=
await authFetch("/api/ai/status/"+jobId);

if(!res){

clearInterval(interval);
return;

}

const data=
await res.json();

/* FINISHED */

if(data.status==="finished"){

clearInterval(interval);

callback(data.result);

return;

}

/* FAILED */

if(data.status==="failed"){

clearInterval(interval);

showToast("AI failed","error");

return;

}

/* TIMEOUT */

if(tries>=maxTries){

clearInterval(interval);

showToast("Timeout","error");

}

},2000);

}

/* 🔥 GENERIC TOOL RUNNER */

async function runAITool(tool,prompt,onResult){

showToast("Processing...");

const job=
await createAIJob(tool,prompt);

if(!job){

return;

}

waitForJob(job,(result)=>{

showToast("Done");

if(onResult){

onResult(result);

}

});

}

/* LOGOUT */

function logout(){

localStorage.removeItem("token");

const app=
document.getElementById("app");

if(app){

app.innerHTML="";

}

const coinsTop=
document.getElementById("coinsTop");

if(coinsTop){

coinsTop.innerText="Coins: -";

}

if(typeof loadPage==="function"){

loadPage("login");

}

}

/* TOAST */

function showToast(message,type="success"){

let toast=
document.getElementById("toast");

if(!toast){

toast=
document.createElement("div");

toast.id="toast";

document.body.appendChild(toast);

}

toast.className=
"toast "+type;

toast.innerText=message;

toast.style.display="block";

if(toast.timer){

clearTimeout(toast.timer);

}

toast.timer=
setTimeout(()=>{

toast.style.display="none";

},2500);

}