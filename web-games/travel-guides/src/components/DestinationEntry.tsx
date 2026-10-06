"use client";

import { useState } from "react";
import { useStore } from "@/state/store";
import { SUGGESTIONS } from "@/lib/constants";

export default function DestinationEntry() {
  const { state, actions } = useStore();
  const [text, setText] = useState("");
  const busy = state.busy !== null;
  const finding = state.busy?.kind === "dest";

  async function submit(value: string) {
    const ok = await actions.addDestination(value);
    if (ok) setText("");
  }

  return (
    <section className="entry" aria-labelledby="entryTitle">
      <h2 id="entryTitle">Where are you going?</h2>
      <form
        className="row-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <input
          type="text"
          id="place"
          maxLength={60}
          placeholder="A city or region, like Lisbon or Oaxaca"
          autoComplete="off"
          aria-label="Destination"
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn" type="submit" disabled={busy}>
          {finding ? "Finding guides..." : "Meet your guides"}
        </button>
      </form>
      <div className="chips">
        {SUGGESTIONS.map((name) => (
          <button
            key={name}
            className="chip"
            type="button"
            disabled={busy}
            onClick={() => {
              setText(name);
              submit(name);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <p className="status">{finding ? state.busy?.label : state.messages.place}</p>
    </section>
  );
}
