import { runChat } from "@/lib/handlers";
import { chatRequest } from "@/lib/schemas";
import { handleRoute } from "@/lib/serverRoute";

export async function POST(req: Request) {
  return handleRoute(req, chatRequest, (body) => runChat(body));
}
