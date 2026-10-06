"use client";

import { useState } from "react";
import { useStore } from "@/state/store";
import { INTERESTS, LEANS, PACES } from "@/lib/constants";
import { raisedStops } from "@/lib/transcript";
import type { Destination, Lean, Pace } from "@/lib/types";
import Itinerary from "./Itinerary";

function contextLine(dest: Destination): string {
  if (dest.messages.length === 0) {
    return "No questions yet. Ask the guides something and the plan will be built from their answers. Until then it uses the settings below.";
  }
  const n = raisedStops(dest.messages).length;
  if (n === 0) return "The plan will follow your chat so far.";
  return `Built from your chat: ${n} stop${n === 1 ? "" : "s"} the guides raised.`;
}

export default function TripPanel({ dest }: { dest: Destination }) {
  const { state, actions } = useStore();
  const [days, setDays] = useState(1);
  const [pace, setPace] = useState<Pace>("Relaxed");
  const [lean, setLean] = useState<Lean>("split");
  const [revision, setRevision] = useState("");
  const busy = state.busy !== null;
  const hasTrip = dest.trip !== null;
  const options = { days, pace, lean, interests: state.interests };
  const status = state.busy?.kind === "trip" ? state.busy.label : state.messages.trip;

  return (
    <section className="panel" aria-labelledby="tripTitle">
      <div className="ph">
        <div>
          <h2 id="tripTitle">Trip builder</h2>
          <div className="sub">Built from your chat, then tweaked by you.</div>
        </div>
      </div>

      <p className="ctx">{contextLine(dest)}</p>

      <form
        className="day"
        style={{ gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          actions.draftTrip(options);
        }}
      >
        <div className="fields">
          <div className="field">
            <label className="label" htmlFor="days">
              Days
            </label>
            <select id="days" value={days} disabled={busy} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={1}>1 day</option>
              <option value={2}>2 days</option>
              <option value={3}>3 days</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="pace">
              Pace
            </label>
            <select id="pace" value={pace} disabled={busy} onChange={(e) => setPace(e.target.value as Pace)}>
              {PACES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="lean">
              Lean toward
            </label>
            <select id="lean" value={lean} disabled={busy} onChange={(e) => setLean(e.target.value as Lean)}>
              {LEANS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <span className="label">Extra interests</span>
          <div className="chips">
            {INTERESTS.map((name) => (
              <button
                key={name}
                type="button"
                className="chip"
                aria-pressed={state.interests.includes(name)}
                disabled={busy}
                onClick={() => actions.toggleInterest(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <button className="btn" type="submit" disabled={busy}>
          Draft my itinerary
        </button>
      </form>

      <Itinerary trip={dest.trip} />

      <form
        className="row-form"
        onSubmit={(e) => {
          e.preventDefault();
          const change = revision.trim();
          if (!change) return;
          setRevision("");
          actions.draftTrip(options, change);
        }}
      >
        <input
          type="text"
          value={revision}
          autoComplete="off"
          aria-label="Change the itinerary"
          placeholder="Swap the museum for something outdoors"
          disabled={busy || !hasTrip}
          onChange={(e) => setRevision(e.target.value)}
        />
        <button className="btn alt" type="submit" disabled={busy || !hasTrip}>
          Revise
        </button>
      </form>

      <p className="status">{status}</p>
    </section>
  );
}
