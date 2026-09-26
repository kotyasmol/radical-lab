import type { translations } from '../i18n';
import type { Notation } from '../engine/format';
export function PrecisionPanel({
  t,
  working,
  display,
  notation,
  symbolic,
  onWorking,
  onDisplay,
  onNotation,
}: {
  t: typeof translations.en;
  working: string;
  display: string;
  notation: Notation;
  symbolic: boolean;
  onWorking: (v: string) => void;
  onDisplay: (v: string) => void;
  onNotation: (v: Notation) => void;
}) {
  return (
    <aside className="precision-panel" aria-labelledby="precision-title">
      <h2 id="precision-title">{t.precision}</h2>
      <div className="field">
        <label htmlFor="working">{t.working}</label>
        <input
          id="working"
          type="number"
          min="2"
          max="200"
          step="1"
          value={working}
          onChange={(e) => onWorking(e.target.value)}
          aria-describedby="working-help"
          disabled={symbolic}
        />
        <small id="working-help">{t.significant}</small>
      </div>
      <div className="field">
        <label htmlFor="display">{t.display}</label>
        <input
          id="display"
          type="number"
          min="2"
          max={Number(working) || 200}
          step="1"
          value={display}
          onChange={(e) => onDisplay(e.target.value)}
          aria-describedby="display-help"
          disabled={symbolic}
        />
        <small id="display-help">{t.displayHint}</small>
      </div>
      <div className="field">
        <label htmlFor="notation">{t.notation}</label>
        <select
          id="notation"
          value={notation}
          onChange={(e) => onNotation(e.target.value as Notation)}
          disabled={symbolic}
        >
          <option value="auto">{t.auto}</option>
          <option value="scientific">{t.scientific}</option>
        </select>
        <small>{symbolic ? t.symbolicPrecision : t.rounding}</small>
      </div>
    </aside>
  );
}
