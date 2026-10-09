"use client";

import { useEffect, useState } from "react";
import { LIMITS, SUGGESTIONS, sampleSuggestions } from "@/lib/constants";
import { useStore } from "@/state/store";

export default function TopicEntry() {
  const { state, actions } = useStore();
  const [topic, setTopic] = useState("");
  // The first render uses a fixed set so server and client markup match. One random draw
  // follows on mount, and the chips then stay put.
  const [chips, setChips] = useState<string[]>(SUGGESTIONS);
  const busy = state.busy !== null;

  useEffect(() => {
    setChips(sampleSuggestions());
  }, []);

  return (
    <section className="entry" aria-labelledby="topic-label">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void actions.startDebate(topic);
        }}
      >
        <label id="topic-label" htmlFor="topic">
          What should they debate?
        </label>
        <div className="row">
          <input
            id="topic"
            name="topic"
            type="text"
            value={topic}
            maxLength={LIMITS.topic}
            placeholder="e.g. Is it ever right to lie?"
            autoComplete="off"
            onChange={(e) => setTopic(e.target.value)}
          />
          <button type="submit" className="primary" disabled={busy}>
            {state.busy === "topic" ? "Drawing..." : "Begin"}
          </button>
        </div>
      </form>

      <div className="chips-wrap">
        <p className="muted">Or try one of these:</p>
        <ul className="chips" aria-label="Suggested topics">
          {chips.map((s) => (
            <li key={s}>
              <button type="button" className="chip" disabled={busy} onClick={() => void actions.startDebate(s)}>
                {s}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
    </section>
  );
}
