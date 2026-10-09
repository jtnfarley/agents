import { takeTurn } from "@/lib/debateEngine";
import { turnRequest } from "@/lib/schemas";
import { handleRoute } from "@/lib/serverRoute";

export async function POST(req: Request) {
  return handleRoute(req, turnRequest, (body) => takeTurn(body));
}
