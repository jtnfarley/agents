/** Hues for destination colors. The local guide takes HUES[pal], the must-see guide the one four steps on. */
export const HUES = [222, 330, 150, 24, 352, 178, 268, 200];

export const palIndex = (id: string) => hashIdToPal(id);

function hashIdToPal(id: string) {
  let x = 0;
  for (let i = 0; i < id.length; i++) x = (x * 31 + id.charCodeAt(i)) >>> 0;
  return x % HUES.length;
}

export const sideHue = (pal: number, side: "local" | "tourist") =>
  side === "local" ? HUES[pal] : HUES[(pal + 4) % HUES.length];
