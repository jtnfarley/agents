/**
 * Pulls a JSON object out of model text. Models sometimes wrap it in fences
 * or add a sentence before it, so: trim, strip fences, then take first { to last }.
 */
export function extractJson(text: string): unknown {
  let s = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(s);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new SyntaxError("No JSON object in model output");
  return JSON.parse(s.slice(start, end + 1));
}

const ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\", "/": "/" };

/**
 * The decoded value of the "text" field in a possibly unfinished JSON reply, or null before it starts.
 * Stops at the closing quote, and holds back an escape that has not fully arrived.
 */
export function partialText(raw: string): string | null {
  const m = /"text"\s*:\s*"/.exec(raw);
  if (!m) return null;
  let out = "";
  for (let i = m.index + m[0].length; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') break;
    if (c !== "\\") {
      out += c;
      continue;
    }
    const n = raw[i + 1];
    if (n === undefined) break;
    if (n === "u") {
      const hex = raw.slice(i + 2, i + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) break;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
    } else {
      out += ESCAPES[n] ?? n;
      i += 1;
    }
  }
  return out;
}
