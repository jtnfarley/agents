import { subscribe, type TableEvent } from "@/lib/events";
import { tableStore } from "@/lib/store";

// SSE must not be statically optimized or cached — this connection stays
// open and pushes events for as long as the client is listening.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatEvent(event: TableEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`;
}

export async function GET(request: Request) {
  // The table plays continuously once at least one spectator is watching;
  // idempotent, so every connection calling this is fine.
  tableStore.start();

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      // A client connecting mid-game still needs to see the table
      // immediately, not wait for the next applied action.
      controller.enqueue(
        encoder.encode(
          formatEvent({ type: "state_update", payload: tableStore.getGameState() }),
        ),
      );

      unsubscribe = subscribe((event) => {
        try {
          controller.enqueue(encoder.encode(formatEvent(event)));
        } catch {
          // Controller is already closed (client disconnected) — the
          // abort listener below handles unsubscribing.
        }
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });

  request.signal.addEventListener("abort", () => {
    unsubscribe?.();
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
