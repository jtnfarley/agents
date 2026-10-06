import type { Trip } from "@/lib/types";
import StopList from "./StopList";

export default function Itinerary({ trip }: { trip: Trip | null }) {
  if (!trip) {
    return (
      <div className="day" style={{ gap: 14 }}>
        <p className="empty">
          No itinerary yet. Draft one from the settings, or chat with the guides first and it will follow what they said.
        </p>
      </div>
    );
  }
  return (
    <div className="day" style={{ gap: 14 }}>
      <div className="trip-title">{trip.title}</div>
      {trip.days.map((day, i) => (
        <div key={i} className="day">
          <h3>{day.label}</h3>
          <StopList stops={day.stops.map((s) => ({ time: s.time, name: s.name, note: s.note, from: s.from }))} tagged />
        </div>
      ))}
    </div>
  );
}
