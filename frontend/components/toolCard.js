window.ToolCard = function ToolCard({ title, description, onClick }) {
  const card = document.createElement("article");
  card.className = "tool-card";

  const heading = document.createElement("h3");
  heading.textContent = title;

  const text = document.createElement("p");
  text.className = "muted";
  text.textContent = description;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn secondary";
  button.textContent = "Oeffnen";
  button.addEventListener("click", onClick);

  card.appendChild(heading);
  card.appendChild(text);
  card.appendChild(button);

  return card;
};
