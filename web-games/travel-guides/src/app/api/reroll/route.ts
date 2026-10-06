import { runReroll } from "@/lib/handlers";
import { rerollRequest } from "@/lib/schemas";
import { handleRoute } from "@/lib/serverRoute";

export async function POST(req: Request) {
  return handleRoute(req, rerollRequest, (body) => runReroll(body));
}
