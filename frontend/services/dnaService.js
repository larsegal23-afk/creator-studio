// services/dnaService.js

export function saveDNA(dna) {
  localStorage.setItem("logoDNA", JSON.stringify(dna));
}

export function getDNA() {
  return JSON.parse(localStorage.getItem("logoDNA"));
}