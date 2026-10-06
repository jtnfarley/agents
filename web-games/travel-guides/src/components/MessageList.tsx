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
        <div className="msg user">
          <div className="bubble">{message.text}</div>
        </div>
      );
    case "divider":
      return (
        <div className="divider">
          <span className="label">{message.text}</span>
        </div>
      );
    case "ground":
      return (
        <div className="ground">
          <span className="label">Common ground</span>
          <p>{message.text}</p>
        </div>
      );
    case "error":
      return (
        <div className="msg error">
          <div className="bubble">{message.text}</div>
        </div>
      );
    case "guide": {
      const guide = dest.guides[message.side];
      return (
        <div className={`msg guide ${message.side}`}>
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

  // Scroll to the newest message after a send.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dest.messages, typing]);

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
