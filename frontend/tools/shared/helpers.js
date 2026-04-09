function loading(el){

el.innerHTML="Processing...";

}

function resultCard(title,body){

return `
<div class="card">
<h3>${title}</h3>
${body}
</div>
`;

}
