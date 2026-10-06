/** Trims, drops control characters (keeps tabs and newlines), and caps the length. */
export const str = (v: unknown, max: number) =>
  (typeof v === "string" ? v : "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);

/** Caps text at a sentence end when possible, so it is never cut mid-sentence. */
export function fit(v: unknown, max: number): string {
  const s = str(v, 100000);
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf("! "),
    cut.lastIndexOf("? "),
    /[.!?]$/.test(cut) ? cut.length - 1 : -1,
  );
  if (end > max * 0.4) return cut.slice(0, end + 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > 0 ? cut.slice(0, sp) : cut).replace(/[,;:\s]+$/, "") + "...";
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const hashStr = (s: string) => {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
  return x;
};
