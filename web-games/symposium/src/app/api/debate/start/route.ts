import { startDebate } from "@/lib/debateEngine";
import { startRequest } from "@/lib/schemas";
import { handleRoute } from "@/lib/serverRoute";

export async function POST(req: Request) {
  return handleRoute(req, startRequest, (body) => startDebate(body));
}
