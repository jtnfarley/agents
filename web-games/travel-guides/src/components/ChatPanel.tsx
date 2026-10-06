"use client";

import { useState } from "react";
import { useStore } from "@/state/store";
import type { Destination } from "@/lib/types";
import MessageList from "./MessageList";
import TargetSwitch from "./TargetSwitch";

export default function ChatPanel({ dest }: { dest: Destination }) {
  const { state, actions } = useStore();
  const [question, setQuestion] = useState("");
  const busy = state.busy !== null;
  const { target } = state;
  const { local, tourist } = dest.guides;

  // Matches the prototype: the box clears on send, even if the send is refused.
  function send(text: string) {
    setQuestion("");
    actions.sendChat(text);
  }

  const placeholder =
    target === "both" ? "Ask a question and let them argue it out" : `Ask ${dest.guides[target].name} anything`;

  return (
    <section className="panel" aria-labelledby="chatTitle">
      <div className="ph">
        <div>
          <h2 id="chatTitle">Ask the guides</h2>
          <div className="sub">
            {local.name} (local) and {tourist.name} (must-see) in {dest.city}
          </div>
        </div>
      </div>

      <MessageList dest={dest} />

      <div className="chips">
        {dest.prompts.map((text) => (
          <button key={text} className="chip" type="button" disabled={busy} onClick={() => actions.sendChat(text)}>
            {text}
          </button>
        ))}
      </div>

      <TargetSwitch dest={dest} />

      <form
        className="row-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(question);
        }}
      >
        <input
          type="text"
          value={question}
          autoComplete="off"
          aria-label="Your question"
          placeholder={placeholder}
          disabled={busy}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button className="btn" type="submit" disabled={busy}>
          {target === "both" ? "Start the argument" : "Ask"}
        </button>
      </form>
    </section>
  );
}
