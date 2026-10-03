import { describe, expect, it } from "vitest";
import { listenerCount, publish, subscribe, type TableEvent } from "./index";

describe("events pub/sub", () => {
  it("delivers a published event to a subscribed listener", () => {
    const received: TableEvent[] = [];
    const unsubscribe = subscribe((event) => received.push(event));

    const event: TableEvent = {
      type: "hand_complete",
      payload: { handNumber: 1, winnerSeatId: 0, potWon: 30 },
    };
    publish(event);

    expect(received).toEqual([event]);
    unsubscribe();
  });

  it("stops delivering events after unsubscribe", () => {
    const received: TableEvent[] = [];
    const unsubscribe = subscribe((event) => received.push(event));
    unsubscribe();

    publish({ type: "hand_complete", payload: { handNumber: 1, winnerSeatId: 0, potWon: 30 } });

    expect(received).toEqual([]);
  });

  it("delivers to every subscribed listener independently", () => {
    const a: TableEvent[] = [];
    const b: TableEvent[] = [];
    const unsubA = subscribe((event) => a.push(event));
    const unsubB = subscribe((event) => b.push(event));

    publish({ type: "seat_filled", payload: { seatId: 2, personaId: "mozart" } });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    unsubA();
    unsubB();
  });

  it("tracks listener count as subscriptions come and go", () => {
    const before = listenerCount();
    const unsubscribe = subscribe(() => {});
    expect(listenerCount()).toBe(before + 1);
    unsubscribe();
    expect(listenerCount()).toBe(before);
  });
});
