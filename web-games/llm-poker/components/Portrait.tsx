import Image from "next/image";
import styles from "./Table.module.css";

// Deterministic placeholder color (for personas without a portrait asset yet)
// — same persona id always maps to the same hue so it reads as a stable
// "face" across the table.
const HUES = [10, 35, 60, 90, 145, 180, 210, 250, 285, 320];

// Illustrated/photographic portraits live in /public/avatars, named by
// persona id (see design/README.md's Assets section). Sappho's is a .jpg;
// everything else is .png.
const AVATAR_EXTENSIONS: Record<string, string> = {
  sappho: "jpg",
};

const AVATAR_IDS = new Set([
  "sappho",
  "nietzsche",
  "diogenes",
  "marie-curie",
  "frida-kahlo",
  "mozart",
  "sun-tzu",
  "socrates",
  "confucius",
  "machiavelli",
  "joan-of-arc",
  "genghis-khan",
  "cleopatra",
  "boudica",
  "darwin",
  "shakespeare",
  "poe",
  "wilde",
  "beethoven",
  "wagner",
  "catherine-the-great",
  "harriet-tubman",
  "immanuel-kant",
  "kahlil-gibran",
  "tesla",
  "grace-o-malley",
  "ching-shih",
  "mark-twain",
  "walt-whitman",
  "rasputin",
  "leonardo-da-vinci",
  "lorenzo-de-medici",
  "hieronymus-bosch",
]);

function hashHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return HUES[hash % HUES.length];
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Portrait({ id, name, size }: { id: string; name: string; size: number }) {
  if (AVATAR_IDS.has(id)) {
    const ext = AVATAR_EXTENSIONS[id] ?? "png";
    return (
      <Image
        className={styles.portrait}
        src={`/avatars/${id}.${ext}`}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: "cover" }}
      />
    );
  }

  const hue = hashHue(id);
  return (
    <span
      className={styles.portrait}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `oklch(0.78 0.09 ${hue})`,
        color: `oklch(0.3 0.07 ${hue})`,
      }}
    >
      {initials(name)}
    </span>
  );
}
