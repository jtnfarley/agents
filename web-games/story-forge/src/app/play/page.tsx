"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import BackgroundLayer from "./BackgroundLayer";
import { TurnResponseSchema, type GameState, type TurnResponse } from "@/lib/schemas";
import { readAndClearPendingStart } from "@/lib/storage";

type LogEntry = {
  narration: string;
  roll?: TurnResponse["roll"];
  action?: string;
};

async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}

export default function PlayPage() {
  const router = useRouter();
  const [state, setState] = useState<GameState | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [choices, setChoices] = useState<TurnResponse["choices"]>([]);
  const [ended, setEnded] = useState(false);
  const [epilogue, setEpilogue] = useState<string | null>(null);
  const [endingRoll, setEndingRoll] = useState<TurnResponse["endingRoll"]>(undefined);
  const [endingOffered, setEndingOffered] = useState(false);
  const [showMechanics, setShowMechanics] = useState(false);
  const [actionText, setActionText] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [background, setBackground] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  // Generated once, from the genre and opening narration only — the
  // background is a fixed ambient image for the whole session, not
  // regenerated as the story progresses. useCallback with no deps (only the
  // setState setter, stable across renders) so this can safely sit in the
  // mount-only effect's dependency array below without turning it into a
  // per-render effect.
  const requestArt = useCallback(async (params: { genre: string; narration: string }) => {
    try {
      const res = await fetch("/api/art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) return;
      const body = await res.json().catch(() => null);
      if (typeof body?.image === "string") {
        setBackground(body.image);
      }
    } catch {
      // Never block or surface an error over art — silently keep whatever
      // background is already showing (none, on the very first request).
    }
  }, []);

  useEffect(() => {
    // React Strict Mode double-invokes effects in dev. readAndClearPendingStart
    // has a real side effect (it deletes the handoff from sessionStorage), so
    // without this guard the second invocation finds it already gone and
    // falls through to the "no story in progress" state.
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // One-time read of a client-only external store (sessionStorage) to
    // hand off the `/` page's picks; can't happen during render because
    // sessionStorage isn't available on the server render pass.
    const pending = readAndClearPendingStart();
    if (!pending) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- external-store read, not derived render state
      setNotFound(true);
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending),
        });
        if (!res.ok) {
          throw new Error(await extractErrorMessage(res, "Failed to start the story"));
        }
        const turn = TurnResponseSchema.parse(await res.json());
        setState(turn.updatedState);
        setLog([{ narration: turn.narration, roll: turn.roll }]);
        setChoices(turn.choices);
        setEndingOffered(turn.endingOffered);
        void requestArt({ genre: turn.updatedState.genre, narration: turn.narration });
      } catch (err) {
        setInitError(err instanceof Error ? err.message : "Failed to start the story");
      }
    })();
  }, [requestArt]);

  async function submitAction(action: string, opts?: { forceEnd?: boolean }) {
    if (!state || ended || submitting) return;
    setSubmitting(true);
    setTurnError(null);
    try {
      const res = await fetch("/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, action, forceEnd: opts?.forceEnd }),
      });
      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "Something went wrong"));
      }
      const turn = TurnResponseSchema.parse(await res.json());
      setState(turn.updatedState);
      setLog((prev) => [...prev, { narration: turn.narration, roll: turn.roll, action }]);
      setChoices(turn.choices);
      setEndingOffered(turn.endingOffered);
      if (turn.ended) {
        setEnded(true);
        setEpilogue(turn.epilogue ?? null);
        setEndingRoll(turn.endingRoll);
      }
    } catch (err) {
      setTurnError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleChoice(text: string) {
    submitAction(text);
  }

  function handleFreeText(e: React.FormEvent) {
    e.preventDefault();
    if (actionText.trim() === "") return;
    const action = actionText.trim();
    setActionText("");
    submitAction(action);
  }

  function handleEndStory() {
    submitAction("I want to end the story here.", { forceEnd: true });
  }

  function handleRestart() {
    router.push("/");
  }

  if (notFound) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start gap-4 px-6 py-16">
        <p className="text-sm text-foreground/70">
          No story in progress. Start one from the beginning.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Go to start
        </button>
      </main>
    );
  }

  if (initError) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start gap-4 px-6 py-16">
        <p className="text-sm text-red-600">{initError}</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Back to start
        </button>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-6 py-16">
        <p className="text-sm text-foreground/60">Conjuring the opening scene…</p>
      </main>
    );
  }

  return (
    <main
      className="flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 md:px-12"
      style={{ backgroundColor: "rgba(255,255,255,.3)" }}
    >
      <BackgroundLayer src={background} />
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{state.protagonist.name}</h1>
          <p className="text-xs text-foreground/60">{state.genre}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-foreground/70">
          <input
            type="checkbox"
            checked={showMechanics}
            onChange={(e) => setShowMechanics(e.target.checked)}
          />
          Show mechanics
        </label>
      </header>

      <section className="flex flex-col gap-5">
        {log.map((entry, i) => (
          <div key={i} className="flex flex-col gap-2">
            {entry.action && (
              <p className="text-xs italic text-foreground/50">→ {entry.action}</p>
            )}
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{entry.narration}</p>
            {showMechanics && entry.roll && (
              <p className="w-fit rounded border border-foreground/20 px-2 py-1 font-mono text-xs text-foreground/60">
                roll {entry.roll.result} vs DC {entry.roll.dc} → {entry.roll.outcomeTier}
              </p>
            )}
          </div>
        ))}
        {submitting && <p className="text-xs text-foreground/50">The story continues…</p>}
      </section>

      {ended ? (
        <div className="flex flex-col gap-4 border-t border-foreground/10 pt-6">
          {epilogue && <p className="text-sm italic text-foreground/70">{epilogue}</p>}
          {showMechanics && endingRoll && (
            <p className="w-fit rounded border border-foreground/20 px-2 py-1 font-mono text-xs text-foreground/60">
              ending roll {endingRoll.result} → {endingRoll.tier}
            </p>
          )}
          <button
            type="button"
            onClick={handleRestart}
            className="w-fit rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Play again
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 border-t border-foreground/10 pt-6">
          {turnError && <p className="text-xs text-red-600">{turnError} — try again.</p>}

          {endingOffered && (
            <p className="text-xs italic text-foreground/50">
              This feels like it could be a natural place to stop, if you want — or press on.
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            {choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                disabled={submitting}
                onClick={() => handleChoice(choice.text)}
                className="flex-1 rounded-md border border-foreground/20 px-4 py-3 text-left text-sm hover:border-foreground/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {choice.text}
              </button>
            ))}
          </div>

          <form onSubmit={handleFreeText} className="flex gap-2">
            <input
              type="text"
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              placeholder="Or do something else…"
              disabled={submitting}
              className="flex-1 rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/60 disabled:opacity-40"
              maxLength={280}
            />
            <button
              type="submit"
              disabled={submitting || actionText.trim() === ""}
              className="rounded-md border border-foreground/20 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              Go
            </button>
          </form>

          <button
            type="button"
            disabled={submitting}
            onClick={handleEndStory}
            className="w-fit text-xs text-foreground/50 underline underline-offset-2 hover:text-foreground/80 disabled:opacity-40"
          >
            End Story
          </button>
        </div>
      )}
    </main>
  );
}
