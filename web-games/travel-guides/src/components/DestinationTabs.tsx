"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import { useStore } from "@/state/store";
import { HUES } from "@/lib/palette";

export default function DestinationTabs() {
  const { state, actions } = useStore();
  const { order, destinations, currentId } = state;

  // Arrow keys move between destinations, as a tablist should.
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (e.key === "ArrowRight") next = (index + 1) % order.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + order.length) % order.length;
    else return;
    e.preventDefault();
    actions.selectDestination(order[next]);
    const siblings = e.currentTarget.parentElement?.children;
    (siblings?.[next] as HTMLElement | undefined)?.focus();
  }

  return (
    <div className="dests" role="tablist" aria-label="Your destinations">
      {order.map((id, index) => {
        const d = destinations[id];
        const selected = id === currentId;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            className="dest"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            style={{ "--th": HUES[d.pal] } as CSSProperties}
            onClick={() => actions.selectDestination(id)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            <span className="dn">{d.city}</span>
            <span className="ds">{d.tagline}</span>
          </button>
        );
      })}
    </div>
  );
}
