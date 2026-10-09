import { suggestions } from "@/lib/debateEngine";
import { handleGet } from "@/lib/serverRoute";

// Model-backed, so it must never be prerendered at build time.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleGet(req, () => suggestions());
}
