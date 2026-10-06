"use client";

import { useStore } from "@/state/store";
import type { Destination, Guide, Side } from "@/lib/types";

function GuideCard({ guide, side }: { guide: Guide; side: Side }) {
  return (
    <div className={`gcard ${side}`}>
      <span className="mono" aria-hidden="true">
        {guide.initials}
      </span>
      <div className="gwho">
        <span className="gstance">{guide.stance}</span>
        <span className="gname">{guide.name}</span>
        <span className="grole">{guide.role}</span>
        <span className="gtrait">
          Personality: <b>{guide.personality.trait}</b>
        </span>
        {guide.personality.how && <span className="ghow">{guide.personality.how}</span>}
      </div>
    </div>
  );
}

export default function GuidePair({ dest }: { dest: Destination }) {
  const { state, actions } = useStore();
  const busy = state.busy !== null;
  const rerolling = state.busy?.kind === "reroll";

  return (
    <section className="gsec" aria-labelledby="gTitle">
      <div className="ph">
        <h2 id="gTitle">Your guides in {dest.city}</h2>
        <button className="btn alt sm" type="button" disabled={busy} onClick={() => actions.reroll()}>
          {rerolling ? "Rerolling..." : "Reroll personalities"}
        </button>
      </div>
      <div className="guides">
        <GuideCard guide={dest.guides.local} side="local" />
        <span className="vs" aria-hidden="true">
          vs
        </span>
        <GuideCard guide={dest.guides.tourist} side="tourist" />
      </div>
      <p className="status">{state.messages.guides}</p>
    </section>
  );
}
