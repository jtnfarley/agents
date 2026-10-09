import { takeTurn } from "@/lib/debateEngine";
import { turnRequest } from "@/lib/schemas";
import { handleStream } from "@/lib/serverRoute";

// Streams the reply, so it must never be prerendered or buffered.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleStream(req, turnRequest, (body, emit) =>
    takeTurn(body, {
      onStart: (start) => emit({ type: "start", ...start }),
      onText: (text) => emit({ type: "text", text }),
    }),
  );
}
