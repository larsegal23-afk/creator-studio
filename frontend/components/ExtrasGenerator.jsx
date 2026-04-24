// components/ExtrasGenerator.jsx

import { getDNA } from "../services/dnaService";

export default function ExtrasGenerator({ generateImage, user, setUser }) {
  const COST = 5;

  async function generate(type) {
    const dna = getDNA();

    if (!dna) return alert("Kein Logo vorhanden");
    if (user.coins < COST) return alert("Nicht genug Coins");

    let extraPrompt = "";

    if (type === "banner") {
      extraPrompt = `${dna.prompt}, wide banner format, streaming overlay`;
    }

    if (type === "sticker") {
      extraPrompt = `${dna.prompt}, sticker style, transparent background`;
    }

    if (type === "frame") {
      extraPrompt = `${dna.prompt}, gaming webcam frame overlay`;
    }

    const image = await generateImage(extraPrompt);

    setUser({ ...user, coins: user.coins - COST });

    console.log("Generated:", image);
  }

  return (
    <div>
      <h2>Extras</h2>

      <button onClick={() => generate("banner")}>Banner</button>
      <button onClick={() => generate("sticker")}>Sticker</button>
      <button onClick={() => generate("frame")}>Frame</button>
    </div>
  );
}