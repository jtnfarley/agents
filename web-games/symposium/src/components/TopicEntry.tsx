"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { LIMITS, SUGGESTIONS } from "@/lib/constants";
import { useStore } from "@/state/store";

export default function TopicEntry() {
  const { state, actions } = useStore();
  const [topic, setTopic] = useState("");
  const [chips, setChips] = useState<string[]>(SUGGESTIONS);
  const busy = state.busy !== null;

  // Model-written chips when the server can supply them. The static list is the fallback.
  useEffect(() => {
    let live = true;
    api
      .suggestions()
      .then((res) => {
        if (live && res.suggestions.length > 0) setChips(res.suggestions);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
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
