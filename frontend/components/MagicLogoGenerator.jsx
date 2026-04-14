import { useState } from "react";

export default function MagicLogoGenerator({ generateImage, saveDNA, user, setUser }) {
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("random");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const COST = 5;

  function buildMagicPrompt(name, genre) {
    const base = `
ultra detailed cinematic esports logo, professional gamer logo,
centered composition, high contrast lighting, sharp details,
glowing accents, 4k quality, bold typography`;

    const styles = {
      shooter: "military soldier, dark warzone, tactical gear",
      fantasy: "epic warrior, magic effects, medieval armor",
      scifi: "cyberpunk neon, futuristic tech",
      anime: "anime style, vibrant colors",
      clean: "minimalist clean logo, smooth gradients",
      random: "creative unique concept, high detail"
    };

    return `${base}, logo text: "${name}", ${styles[genre] || styles.random}`;
  }

  async function handleGenerate() {
    if (!name) return alert("Name fehlt");
    if (user.coins < COST) return alert("Nicht genug Coins");

    setLoading(true);

    const prompt = buildMagicPrompt(name, genre);

    const image = await generateImage(prompt);

    const dna = {
      name,
      genre,
      prompt,
    };

    saveDNA(dna);

    setUser({ ...user, coins: user.coins - COST });

    setResult(image);
    setLoading(false);
  }

  return (
    <div>
      <h2>Magic Logo</h2>

      <input
        placeholder="Dein Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <select value={genre} onChange={(e) => setGenre(e.target.value)}>
        <option value="random">Random</option>
        <option value="shooter">Shooter</option>
        <option value="fantasy">Fantasy</option>
        <option value="scifi">Sci-Fi</option>
        <option value="anime">Anime</option>
        <option value="clean">Clean</option>
      </select>

      <button onClick={handleGenerate} disabled={loading}>
        {loading ? "Lade..." : "Logo erstellen"}
      </button>

      {result && (
        <div>
          <img src={result} alt="logo" style={{ width: 300 }} />
        </div>
      )}
    </div>
  );
}