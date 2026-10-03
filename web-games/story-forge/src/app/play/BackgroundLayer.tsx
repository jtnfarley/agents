"use client";

import { useEffect, useState } from "react";

/**
 * Fixed full-viewport background behind the narration panel, with a
 * left-to-right gradient scrim: opaque behind the text column on the left,
 * fading to fully transparent on the right so the image reads clearly there
 * (api/art's "cut" composition prompt keeps subjects in the right third for
 * exactly this reason). Crossfades between images: the incoming one starts
 * at opacity 0 over the still-visible previous one, then transitions to
 * opacity 1. `src` is a data URL (or null before the first image resolves)
 * — there's no server storage, so the image itself travels through React
 * state.
 */
export default function BackgroundLayer({ src }: { src: string | null }) {
  const [current, setCurrent] = useState(src);
  const [previous, setPrevious] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);

  // Adjust state during render when `src` changes, rather than in an
  // effect — this is the React-documented pattern for deriving state from a
  // prop change (see "Adjusting state when a prop changes" in the React
  // docs); it re-renders once, synchronously, before anything paints.
  if (src !== current) {
    setPrevious(current);
    setCurrent(src);
    setEntering(true);
  }

  useEffect(() => {
    if (!entering) return;
    // Start the new layer transparent, then flip to opaque on the next
    // frame so the browser actually animates the opacity change instead of
    // applying both style updates in the same paint.
    const raf = requestAnimationFrame(() => setEntering(false));
    return () => cancelAnimationFrame(raf);
  }, [entering]);

  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-background">
      {previous && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${previous})` }}
        />
      )}
      {current && (
        <div
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${
            entering ? "opacity-0" : "opacity-100"
          }`}
          style={{ backgroundImage: `url(${current})` }}
        />
      )}
      <div className="absolute inset-0 bg-linear-to-r from-background/95 via-background/55 to-transparent" />
    </div>
  );
}
