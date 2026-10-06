"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/state/store";
import { sideName } from "@/lib/constants";
import type { Destination, Message } from "@/lib/types";
import StopList from "./StopList";

function Item({ message, dest }: { message: Message; dest: Destination }) {
  switch (message.role) {
    case "user":
      return (
        <div className="msg user" data-msg-id={message.id}>
          <div className="bubble">{message.text}</div>
        </div>
      );
    case "divider":
      return (
        <div className="divider" data-msg-id={message.id}>
          <span className="label">{message.text}</span>
        </div>
      );
    case "ground":
      return (
        <div className="ground" data-msg-id={message.id}>
          <span className="label">Common ground</span>
          <p>{message.text}</p>
        </div>
      );
    case "error":
      return (
        <div className="msg error" data-msg-id={message.id}>
          <div className="bubble">{message.text}</div>
        </div>
      );
    case "guide": {
      const guide = dest.guides[message.side];
      return (
        <div className={`msg guide ${message.side}`} data-msg-id={message.id}>
          <div className="bubble">
            <div className="who-l">
              {guide.name} · {sideName(message.side)}
            </div>
            {message.text}
          </div>
          {message.stops.length > 0 && (
            <StopList stops={message.stops.map((s) => ({ time: s.when, name: s.name, note: s.note }))} />
          )}
          {message.tip && (
            <div className="tip">
              <span className="label">Insider tip</span>
              <p>{message.tip}</p>
            </div>
          )}
        </div>
      );
    }
  }
}

export default function MessageList({ dest }: { dest: Destination }) {
  const { state } = useStore();
  const listRef = useRef<HTMLDivElement>(null);
  const typing =
    state.busy?.kind === "chat" && state.busy.destId === dest.id ? state.busy.label : null;

  // Track what was on screen last time, so only a new question moves the list.
  const seen = useRef({ destId: dest.id, count: dest.messages.length });

  // When the user sends a question, bring it to the top of the list so they see their own message first.
  // Replies, debate turns and the typing bubble never move the list, so the reader can start from the top.
  useEffect(() => {
    const prev = seen.current;
    const count = dest.messages.length;
    seen.current = { destId: dest.id, count };
    if (prev.destId !== dest.id || count <= prev.count) return;

    const last = dest.messages[count - 1];
    if (last.role !== "user") return;
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-msg-id="${last.id}"]`);
    if (!list || !row) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({ top: row.offsetTop - 8, behavior: reduce ? "auto" : "smooth" });
  }, [dest.id, dest.messages]);

  return (
    <div className="msgs" ref={listRef} aria-live="polite">
      {dest.messages.length === 0 && !typing && (
        <p className="empty">No questions yet. Pick one below, or type your own and choose who answers.</p>
      )}
      {dest.messages.map((m) => (
        <Item key={m.id} message={m} dest={dest} />
      ))}
      {typing && (
        <div className="msg guide typing">
          <div className="bubble">{typing}</div>
        </div>
      )}
    </div>
  );
}
