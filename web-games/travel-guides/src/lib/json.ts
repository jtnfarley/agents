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
