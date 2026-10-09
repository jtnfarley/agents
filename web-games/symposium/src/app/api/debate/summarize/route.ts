import { summarize } from "@/lib/debateEngine";
import { summarizeRequest } from "@/lib/schemas";
import { handleRoute } from "@/lib/serverRoute";

export async function POST(req: Request) {
  return handleRoute(req, summarizeRequest, (body) => summarize(body));
}
