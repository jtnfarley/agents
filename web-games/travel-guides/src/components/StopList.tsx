import { sideName } from "@/lib/constants";
import type { Side } from "@/lib/types";

export interface StopRow {
  time?: string;
  name: string;
  note?: string;
  from?: Side;
}

/** A list of stops. Pass `tagged` to show whose pick each one is. */
export default function StopList({ stops, tagged = false }: { stops: StopRow[]; tagged?: boolean }) {
  return (
    <ul className="stops">
      {stops.map((s, i) => (
        <li key={i} className="stop">
          <span className="when">{s.time ?? ""}</span>
          <span>
            <span className="nm">{s.name}</span>
            {tagged && s.from && <span className={`pill ${s.from}`}>{sideName(s.from)}</span>}
            {s.note && <span className="nt">{s.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
