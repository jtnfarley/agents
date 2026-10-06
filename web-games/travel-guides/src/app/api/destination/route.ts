import { runDestination } from "@/lib/handlers";
import { destinationRequest } from "@/lib/schemas";
import { handleRoute } from "@/lib/serverRoute";

export async function POST(req: Request) {
  return handleRoute(req, destinationRequest, (body) => runDestination(body.place));
}
