"use client";

import { useEffect } from "react";
import { StoreProvider, currentDestination, useStore } from "@/state/store";
import { sideHue } from "@/lib/palette";
import DestinationEntry from "./DestinationEntry";
import DestinationTabs from "./DestinationTabs";
import GuidePair from "./GuidePair";
import ChatPanel from "./ChatPanel";
import TripPanel from "./TripPanel";

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { state } = useStore();
  const dest = currentDestination(state);
  const pal = dest?.pal;

  // The guides' colors come from the current destination's palette.
  useEffect(() => {
    if (pal === undefined) return;
    const root = document.documentElement.style;
    root.setProperty("--h1", String(sideHue(pal, "local")));
    root.setProperty("--h2", String(sideHue(pal, "tourist")));
  }, [pal]);

  return (
    <div className="app" id="app">
      <header className="top">
        <h1>Local Voices</h1>
        <p className="lede">
          Enter a destination and meet two guides who live there. One swears by the local
          spots, the other by the must-see sights. Ask one, make them argue, then build a
          trip from what they said.
        </p>
      </header>

      <DestinationEntry />

      {dest && (
        <div className="stage">
          <DestinationTabs />
          <GuidePair dest={dest} />
          <main className="grid">
            <ChatPanel dest={dest} />
            <TripPanel dest={dest} />
          </main>
          <p className="foot">
            Prototype. Guides and their backstories are AI inventions. They suggest well-known
            places but cannot check hours, prices or closures, so confirm details before you go.
          </p>
        </div>
      )}
    </div>
  );
}
