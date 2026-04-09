/* API BASE */

const API="";

/* BASIC FETCH */

async function api(

url,

options={}

){

try{

const res=
await fetch(

API+url,

options

);

if(!res.ok){

throw new Error();

}

try{

return await res.json();

}catch{

return null;

}

}catch(e){

console.log("API error");

return null;

}

}

/* STATUS */

async function status(){

return await api(

"/api/status"

);

}

/* AUTH FETCH */

async function apiAuth(

url,

options={}

){

const token=
localStorage.getItem("token");

options.headers={

"Content-Type":"application/json",

...(options.headers||{}),

...(token?{

Authorization:
"Bearer "+token

}:{})

};

return await api(

url,

options

);

}