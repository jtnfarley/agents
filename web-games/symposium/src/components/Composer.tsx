"use client";

import { useState } from "react";
import { LIMITS } from "@/lib/constants";
import { useStore } from "@/state/store";
import type { SpeakerId, Target } from "@/lib/types";

export default function Composer({ names }: { names: Record<SpeakerId, string> }) {
  const { state, actions } = useStore();
  const [target, setTarget] = useState<Target>("both");
  const [text, setText] = useState("");
  const busy = state.busy !== null;

  const options: { value: Target; label: string }[] = [
    { value: "A", label: `Ask ${names.A}` },
    { value: "B", label: `Ask ${names.B}` },
    { value: "both", label: "Challenge both" },
  ];

  return (
    <form
      className="composer"
      aria-label="Speak to the table"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = text.trim();
        if (!trimmed || busy) return;
        void actions.takeTurn({ text: trimmed, target });
        setText("");
      }}
    >
      <fieldset className="targets">
        <legend>Address</legend>
        {options.map((o) => (
          <label key={o.value} className="target">
            <input
              type="radio"
              name="target"
              value={o.value}
              checked={target === o.value}
              onChange={() => setTarget(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </fieldset>

      <label className="visually-hidden" htmlFor="visitor-text">
        Your message
      </label>
      <textarea
        id="visitor-text"
        rows={3}
        maxLength={LIMITS.visitorText}
        value={text}
        placeholder="Ask a question, press a point, or interrupt."
        onChange={(e) => setText(e.target.value)}
      />

      <div className="row composer-actions">
        <button type="submit" disabled={busy || text.trim() === ""}>
          Send
        </button>
        <button type="button" className="primary" disabled={busy} onClick={() => void actions.takeTurn()}>
          Next turn
        </button>
        {state.autoplay && (
          <button type="button" onClick={() => actions.setAutoplay(false)}>
            Pause
          </button>
        )}
      </div>
    </form>
  );
}
