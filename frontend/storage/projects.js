console.log("projects system ready");

/* LOAD PROJECTS */

async function loadProjects(){

try{

const data=
await authFetch("/api/projects");

if(!data){

throw new Error();

}

const container=
document.getElementById("projectsList");

if(!container){

return;

}

if(data.length===0){

container.innerHTML=

"<div class='card'>No projects yet</div>";

return;

}

let html="";

data.forEach(p=>{

html+=`

<div class="card project">

<h3>${p.name}</h3>

<p>${p.type}</p>

<button onclick="deleteProject(${p.id})">

Delete

</button>

</div>

`;

});

container.innerHTML=html;

}catch(e){

console.log(e);

}

}

/* DELETE */

async function deleteProject(id){

if(!confirm("Delete project?")){
return;
}

const data=
await authFetch(

"/api/deleteProject",

{

method:"POST",

body:JSON.stringify({

id

})

}

);

if(data?.success){

showToast(

"Project deleted"

);

loadProjects();

return;

}

showToast(

"Delete failed",

"error"

);

}