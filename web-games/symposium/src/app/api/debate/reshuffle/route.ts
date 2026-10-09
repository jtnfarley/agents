import { reshuffle } from "@/lib/debateEngine";
import { reshuffleRequest } from "@/lib/schemas";
import { handleRoute } from "@/lib/serverRoute";

export async function POST(req: Request) {
  return handleRoute(req, reshuffleRequest, (body) => reshuffle(body));
}
