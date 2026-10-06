import type { Philosopher, SpeakerId } from "@/lib/types";

export default function PhilosopherCard({
  seat,
  p,
  stance,
}: {
  seat: SpeakerId;
  p: Philosopher;
  stance: string | null;
}) {
  return (
    <article className="seat" data-seat={seat} aria-label={p.displayName}>
      <h3>{p.displayName}</h3>
      <p className="meta">
        {p.era} · {p.school}
      </p>
      <p className="method">{p.method}</p>
      {stance ? (
        <p className="stance">
          <span className="stance-label">Holds that</span> {stance}
        </p>
      ) : (
        <p className="stance pending">Stance arrives with the opening turn.</p>
      )}
    </article>
  );
}
