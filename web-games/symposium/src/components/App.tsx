"use client";

import { StoreProvider, currentDebate, useStore } from "@/state/store";
import Stage from "./Stage";
import TopicEntry from "./TopicEntry";

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { state } = useStore();
  const debate = currentDebate(state);
  // Once a debate is under way the transcript needs the room, so the intro goes.
  const started = (debate?.turns.length ?? 0) > 0;

  return (
    <div className={started ? "app app-started" : "app"}>
      <header className="top">
        <h1>Symposium</h1>
        {!started && (
          <p className="lede">
            Give a topic and two philosophers, drawn at random, will debate it. You sit at the table:
            ask either one a question, challenge both, or interrupt mid-argument.
          </p>
        )}
      </header>

      {state.hydrated && (debate ? <Stage debate={debate} /> : <TopicEntry />)}

      <footer className="foot">
        <p>
          Prototype. The philosophers are AI reimaginings and may misstate their historical views.
          Check primary sources.
        </p>
      </footer>
    </div>
  );
}
