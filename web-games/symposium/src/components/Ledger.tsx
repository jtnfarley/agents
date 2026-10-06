import type { Ledger as LedgerData } from "@/lib/types";

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="ledger-block">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted">Nothing yet.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Ledger({ ledger }: { ledger: LedgerData | null }) {
  return (
    <aside className="ledger" aria-labelledby="ledger-title">
      <h2 id="ledger-title">Where things stand</h2>
      {!ledger ? (
        <p className="muted">The ledger fills in after the first four philosopher turns.</p>
      ) : (
        <>
          <Block title="Common ground" items={ledger.agree} />
          <Block title="Fault lines" items={ledger.split} />
          <Block title="Open questions" items={ledger.openQuestions} />
        </>
      )}
    </aside>
  );
}
