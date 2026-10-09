"use client";

import type { CSSProperties } from "react";
import { HUES } from "@/lib/constants";
import { rosterById } from "@/lib/roster";
import { useStore } from "@/state/store";
import type { Debate, SpeakerId } from "@/lib/types";
import Composer from "./Composer";
import Ledger from "./Ledger";
import PhilosopherCard from "./PhilosopherCard";
import Transcript from "./Transcript";

const BUSY_TEXT = {
  topic: "Drawing a new pair...",
  turn: "Speaking...",
  summary: "Updating the ledger...",
} as const;

export default function Stage({ debate }: { debate: Debate }) {
  const { state, actions } = useStore();
  const philosophers = {
    A: rosterById(debate.philosophers.A),
    B: rosterById(debate.philosophers.B),
  };
  if (!philosophers.A || !philosophers.B) return null;

  const names: Record<SpeakerId, string> = {
    A: philosophers.A.displayName,
    B: philosophers.B.displayName,
  };
  const started = debate.turns.length > 0;
  const busy = state.busy !== null;
  // Seat hues. The seat cards and turns read these through data-seat in CSS.
  const style = {
    "--hA": HUES[philosophers.A.accent],
    "--hB": HUES[philosophers.B.accent],
  } as CSSProperties;

  return (
    <div className="stage" style={style}>
      <header className="strip">
        <div>
          <p className="eyebrow">Topic</p>
          <h2>{debate.topic}</h2>
        </div>
        <div className="strip-actions">
          <button
            type="button"
            aria-pressed={state.autoplay}
            onClick={() => actions.setAutoplay(!state.autoplay)}
          >
            Auto-play {state.autoplay ? "on" : "off"}
          </button>
          <button type="button" onClick={() => actions.newDebate()}>
            New debate
          </button>
        </div>
      </header>

      <section className="seats" aria-label="The two philosophers">
        <PhilosopherCard seat="A" p={philosophers.A} stance={debate.stances.A} />
        <span className="vs" aria-hidden="true">
          vs
        </span>
        <PhilosopherCard seat="B" p={philosophers.B} stance={debate.stances.B} />
      </section>

      <p className="status" role="status">
        {state.busy ? BUSY_TEXT[state.busy] : ""}
      </p>

      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}

      {!started ? (
        <section className="setup" aria-label="Before the debate">
          <p>
            Two philosophers have been drawn. Reshuffle for a different pair, or begin. The pair
            locks once the first turn is taken.
          </p>
          <div className="row">
            <button type="button" disabled={busy} onClick={() => void actions.reshuffle()}>
              Reshuffle
            </button>
            <button type="button" className="primary" disabled={busy} onClick={() => void actions.takeTurn()}>
              Begin debate
            </button>
          </div>
        </section>
      ) : (
        <div className="layout">
          <div className="main">
            <Transcript turns={debate.turns} names={names} draft={state.draft} />
            <Composer names={names} />
          </div>
          <Ledger ledger={debate.ledger} />
        </div>
      )}
    </div>
  );
}
