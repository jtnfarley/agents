import { tableStore, validateSeatFill } from "@/lib/store";
import type { SeatRequestBody } from "@/types";

// Not SSE — a plain request/response POST, unlike the stream route. Still
// force-dynamic since it must always see the live tableStore state.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let body: Partial<SeatRequestBody>;
  try {
    body = await request.json();
  } catch {
    return jsonError("request body must be JSON", 400);
  }

  const { seatId, personaId } = body;
  if (typeof seatId !== "number" || typeof personaId !== "string" || personaId.length === 0) {
    return jsonError("body must be { seatId: number, personaId: string }", 400);
  }

  const { seats } = tableStore.getGameState();
  const validationError = validateSeatFill(seats, seatId, personaId);
  if (validationError) {
    return jsonError(validationError.error, 400);
  }

  tableStore.fillSeat(seatId, personaId);
  return Response.json({ seatId, personaId }, { status: 200 });
}
