"use client";

import { useState } from "react";
import type { PersonaProfile } from "@/types";
import { Portrait } from "./Portrait";
import styles from "./Table.module.css";

interface SeatPickerModalProps {
  seatId: number;
  candidates: PersonaProfile[];
  onClose: () => void;
}

function flavorLine(profile: PersonaProfile): string {
  return profile.temperament.split(/(?<=[.!?])\s/)[0];
}

// Rendered once a seat_open event hands the browser a candidate list for an
// empty seat. POSTs to /api/table/seat; on success the store publishes
// seat_filled, useTableStream drops this seatId from openSeats, and Table
// closes this modal on its own — no local success state to manage.
export function SeatPickerModal({ seatId, candidates, onClose }: SeatPickerModalProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(personaId: string) {
    setPendingId(personaId);
    setError(null);
    try {
      const res = await fetch("/api/table/seat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatId, personaId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not seat that persona.");
        setPendingId(null);
      }
    } catch {
      setError("Network error — try again.");
      setPendingId(null);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalEyebrow}>A Seat Has Opened</div>
        <div className={styles.modalSubtitle}>A chair sits empty at the table. Who takes it?</div>
        <div className={styles.modalList}>
          {candidates.map((c) => (
            <div key={c.id} className={styles.modalRow}>
              <Portrait id={c.id} name={c.displayName} size={44} />
              <div className={styles.modalRowInfo}>
                <div className={styles.modalRowName}>{c.displayName}</div>
                <div className={styles.modalRowFlavor}>{flavorLine(c)}</div>
              </div>
              <button
                type="button"
                className={styles.modalSeatButton}
                disabled={pendingId !== null}
                onClick={() => pick(c.id)}
              >
                {pendingId === c.id ? "Seating…" : "Seat"}
              </button>
            </div>
          ))}
        </div>
        {error && <p className={styles.modalError}>{error}</p>}
      </div>
    </div>
  );
}
