import { runTrip } from "@/lib/handlers";
import { tripRequest } from "@/lib/schemas";
import { handleRoute } from "@/lib/serverRoute";
import type { Trip } from "@/lib/types";

export async function POST(req: Request) {
  return handleRoute(req, tripRequest, (body) =>
    runTrip({ ...body, currentTrip: body.currentTrip as Trip | undefined }),
  );
}
