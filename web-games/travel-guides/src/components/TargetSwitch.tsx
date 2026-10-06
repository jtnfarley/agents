"use client";

import { useStore } from "@/state/store";
import type { Destination, Target } from "@/lib/types";

export default function TargetSwitch({ dest }: { dest: Destination }) {
  const { state, actions } = useStore();
  const busy = state.busy !== null;
  const options: [Target, string][] = [
    ["local", `Ask ${dest.guides.local.name}`],
    ["tourist", `Ask ${dest.guides.tourist.name}`],
    ["both", "Make them argue"],
  ];

  return (
    <div className="seg" role="group" aria-label="Who to ask">
      {options.map(([value, label]) => (
        <button
          key={value}
          type="button"
          className="segb"
          data-t={value}
          aria-pressed={state.target === value}
          disabled={busy}
          onClick={() => actions.setTarget(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
