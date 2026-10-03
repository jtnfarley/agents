"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GENRE_POOL, SURPRISE_ME, sampleGenres } from "@/lib/gameRules";
import type { GameState } from "@/lib/schemas";
import { savePendingStart } from "@/lib/storage";

type Gender = GameState["protagonist"]["gender"];

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "nonbinary", label: "Nonbinary" },
  { value: "unspecified", label: "Unspecified" },
];

export default function HomePage() {
  const router = useRouter();
  // Sampled on the client only, after mount — Math.random() during the
  // initial render would produce different picks on the server vs. the
  // client and trigger a hydration mismatch.
  const [genreOptions, setGenreOptions] = useState<string[] | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [descriptor, setDescriptor] = useState("");
  const [gender, setGender] = useState<Gender>("unspecified");

  useEffect(() => {
    // Client-only randomness — deliberately deferred out of render to avoid
    // an SSR/client hydration mismatch (see comment on genreOptions above).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- not derived render state
    setGenreOptions([...sampleGenres(3), SURPRISE_ME]);
  }, []);

  const canStart = genre !== null && name.trim() !== "" && descriptor.trim() !== "";

  function handleStart() {
    if (!canStart || !genre) return;

    const resolvedGenre =
      genre === SURPRISE_ME ? GENRE_POOL[Math.floor(Math.random() * GENRE_POOL.length)] : genre;

    savePendingStart({
      genre: resolvedGenre,
      protagonist: {
        name: name.trim(),
        descriptor: descriptor.trim(),
        gender,
      },
    });
    router.push("/play");
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Story Forge</h1>
        <p className="text-sm text-foreground/70">
          An LLM game master improvises the story as you play — no branch tree, no
          script. Pick a genre and a protagonist, then see what happens.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/60">
          Genre
        </h2>
        <div className="flex flex-wrap gap-2">
          {genreOptions === null
            ? Array.from({ length: 4 }, (_, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="h-9 w-28 animate-pulse rounded-full border border-foreground/10 bg-foreground/5"
                />
              ))
            : genreOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setGenre(option)}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    genre === option
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground/20 hover:border-foreground/50"
                  }`}
                >
                  {option === SURPRISE_ME ? "Surprise me" : option}
                </button>
              ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/60">
          Protagonist
        </h2>

        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mireille"
            className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/60"
            maxLength={60}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Descriptor
          <input
            type="text"
            value={descriptor}
            onChange={(e) => setDescriptor(e.target.value)}
            placeholder="e.g. a disgraced smuggler with one favor left to call in"
            className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/60"
            maxLength={140}
          />
        </label>

        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1">Gender</legend>
          <div className="flex flex-wrap gap-2">
            {GENDER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setGender(option.value)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  gender === option.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/20 hover:border-foreground/50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <button
        type="button"
        disabled={!canStart}
        onClick={handleStart}
        className="mt-4 rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        Start
      </button>
    </main>
  );
}
