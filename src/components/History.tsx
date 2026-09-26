import type { Mode } from '../engine';
import type { translations } from '../i18n';
import { Icon } from './Icons';
export interface HistoryEntry {
  id: number;
  expression: string;
  output: string;
  precision: number;
  digits: number;
  mode: Mode;
  date: string;
}
export function History({
  t,
  entries,
  onClear,
  onReuse,
}: {
  t: typeof translations.en;
  entries: HistoryEntry[];
  onClear: () => void;
  onReuse: (entry: HistoryEntry) => void;
}) {
  function exportHistory() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ format: 'radical-lab-history-v1', entries }, null, 2)], {
        type: 'application/json',
      }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'radical-lab-history.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="history" aria-labelledby="history-title">
      <div className="section-heading">
        <h2 id="history-title">{t.history}</h2>
        <div className="actions">
          <button className="text-button" onClick={onClear} disabled={!entries.length}>
            <Icon name="clear" />
            {t.clear}
          </button>
          <button className="text-button" onClick={exportHistory} disabled={!entries.length}>
            <Icon name="export" />
            {t.export}
          </button>
        </div>
      </div>
      {!entries.length ? (
        <div className="empty-history">
          <p>{t.emptyHistory}</p>
          <small>{t.historyHint}</small>
        </div>
      ) : (
        <ol className="history-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button onClick={() => onReuse(entry)} aria-label={`${t.reuse}: ${entry.expression}`}>
                <code>{entry.expression}</code>
                <Icon name="arrow" />
              </button>
              <code className="history-output">= {entry.output}</code>
              <small>
                {entry.mode === 'numeric'
                  ? `${entry.precision} / ${entry.digits} · ${t.numeric}`
                  : t.symbolic}
              </small>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
