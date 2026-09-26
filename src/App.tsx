import { useEffect, useRef, useState } from 'react';
import WorkerFactory from './engine/worker?worker&inline';
import type { CalculationResult, Mode } from './engine';
import { formatComplex, type Notation } from './engine/format';
import { createRunner, type WorkerLike } from './services/runner';
import { detectLanguage, languages, translations, type Language, type TextKey } from './i18n';
import { VERSION } from './services/updates';
import { PrecisionPanel } from './components/PrecisionPanel';
import { History, type HistoryEntry } from './components/History';
import { Dialogs, type DialogKind } from './components/Dialogs';
import { Icon } from './components/Icons';

export default function App() {
  const [language, setLanguage] = useState<Language>(() => detectLanguage(navigator.language));
  const t = translations[language];
  const [expression, setExpression] = useState('sqrt(-16) + sqrt(2)');
  const [mode, setMode] = useState<Mode>('numeric');
  const [working, setWorking] = useState('50');
  const [display, setDisplay] = useState('20');
  const [notation, setNotation] = useState<Notation>('auto');
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [copy, setCopy] = useState<'idle' | 'ok' | 'failed'>('idle');
  const runner = useRef(createRunner(() => new WorkerFactory() as unknown as WorkerLike));
  const input = useRef<HTMLTextAreaElement>(null);
  const serial = useRef(0);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => () => { runner.current.cancel(); clearTimeout(copyTimer.current); }, []);
  const validPrecision = (v: string) => /^\d+$/.test(v) && Number(v) >= 2 && Number(v) <= 200;
  const valid = validPrecision(working) && validPrecision(display) && Number(display) <= Number(working);
  const output = result?.symbolic ?? (result?.value && valid ? formatComplex(result.value, Number(display), notation) : '');
  const examples = mode === 'numeric'
    ? [['sqrt(-1)', t.imaginary], ['1/3', t.fraction], ['(2+3*i)^2', t.complex]]
    : [['sqrt(8)', t.radical], ['x+x+2*y-y', t.algebra], ['sin(x)^2+cos(x)^2', t.identity]];
  function invalidate() { serial.current++; runner.current.cancel(); setBusy(false); setResult(null); setError(''); setCopy('idle'); }
  function changeExpression(value: string) { invalidate(); setExpression(value); }
  function changeMode(value: Mode) { invalidate(); setMode(value); input.current?.focus(); }
  async function run() {
    invalidate();
    if (mode === 'numeric' && !valid) { setError('PRECISION'); return; }
    const id = ++serial.current; setBusy(true);
    try {
      const response = await runner.current.run({ expression, precision: mode === 'symbolic' ? 50 : Number(working), mode });
      if (serial.current !== id) return;
      setResult(response);
      const value = response.symbolic ?? formatComplex(response.value!, Number(display), notation);
      setHistory(entries => [{ id, expression, output: value, precision: Number(working), digits: Number(display), mode, date: new Date().toISOString() }, ...entries].slice(0, 50));
    } catch (code) { if (serial.current === id) setError(typeof code === 'string' ? code : 'INTERNAL'); }
    finally { if (serial.current === id) setBusy(false); }
  }
  async function copyResult() {
    try { await navigator.clipboard.writeText(output); setCopy('ok'); }
    catch { setCopy('failed'); }
    clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopy('idle'), 2500);
  }
  function reset() { invalidate(); setExpression(''); setHistory([]); setWorking('50'); setDisplay('20'); setNotation('auto'); setMode('numeric'); setDialog(null); input.current?.focus(); }
  const errorText = t[`error${error}` as TextKey] || t.errorINTERNAL;
  return <div className="app">
    <header className="topbar"><a className="brand" href="#" onClick={e => { e.preventDefault(); input.current?.focus(); }} aria-label="Radical Lab"><span className="brand-mark">√</span>Radical Lab</a>
      <nav aria-label={t.language}><select className="language-select" aria-label={t.language} value={language} onChange={e => setLanguage(e.target.value as Language)}>{Object.entries(languages).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><button className="plain-button" onClick={() => setDialog('help')}>{t.help}</button></nav>
    </header>
    <main className="main"><div className="intro"><h1>{t.title}</h1><p>{t.subtitle}</p></div>
      <div className="workspace"><div className="calculator">
        <div className="tabs" role="group" aria-label={t.expression}><button aria-pressed={mode === 'numeric'} className={mode === 'numeric' ? 'selected' : ''} onClick={() => changeMode('numeric')}>{t.numeric}</button><button aria-pressed={mode === 'symbolic'} className={mode === 'symbolic' ? 'selected' : ''} onClick={() => changeMode('symbolic')}>{t.symbolic}</button></div>
        <section className="editor" aria-label={t.expression}>
          <form onSubmit={e => { e.preventDefault(); void run(); }}><label htmlFor="expression">{t.expression}</label>
            <textarea ref={input} id="expression" value={expression} spellCheck={false} autoComplete="off" autoCapitalize="off" rows={2} maxLength={4096} aria-describedby="syntax" aria-invalid={!!error} onChange={e => changeExpression(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void run(); } }}/>
            <small id="syntax">{t.syntax}</small>
            <div className="calculate-actions"><button className="primary" type="submit" disabled={busy}>{busy ? t.calculating : t.calculate}</button>{busy ? <button type="button" className="secondary" onClick={() => runner.current.cancel()}>{t.cancel}</button> : <span className="keyboard-hint">{t.enter}</span>}</div>
          </form>
          {error && <p className="error" role="alert">{errorText}</p>}
          {!valid && mode === 'numeric' && <p className="error" role="alert">{t.errorPRECISION} {t.displayHint}</p>}
          <div className={`result ${output ? 'has-result' : ''}`} aria-live="polite" aria-busy={busy}><div className="section-heading"><span className="result-label">{t.result}</span>{output && <button className="text-button" onClick={copyResult}><Icon name="copy"/>{copy === 'ok' ? t.copied : t.copy}</button>}</div>
            {output ? <output data-testid="result">{output}</output> : <p className="empty-result">{t.emptyResult}</p>}
            {copy === 'failed' && <small role="status">{t.copyFailed}</small>}
          </div>
          {result?.warnings.map(w => <p key={w} className="warning" role="status">{w === 'rounding' ? t.warningRounding : t.warningSymbolic}</p>)}
        </section>
        <section className="examples" aria-labelledby="try-title"><h2 id="try-title">{t.try}</h2><div className="example-list">{examples.map(([value, description]) => <button key={value} onClick={() => { changeExpression(value); input.current?.focus(); }}><code>{value}</code><span>{description}</span><Icon name="arrow"/></button>)}</div></section>
        <History t={t} entries={history} onClear={() => setHistory([])} onReuse={entry => { invalidate(); setExpression(entry.expression); setMode(entry.mode); setWorking(String(entry.precision)); setDisplay(String(entry.digits)); input.current?.focus(); }}/>
      </div>
      <PrecisionPanel t={t} working={working} display={display} notation={notation} symbolic={mode === 'symbolic'} onWorking={value => { invalidate(); setWorking(value); if (validPrecision(value) && Number(display) > Number(value)) setDisplay(value); }} onDisplay={setDisplay} onNotation={setNotation}/>
      </div>
    </main>
    <footer><span>v{VERSION}</span><div><button className="plain-button" onClick={() => setDialog('updates')}>{t.updates}</button><button className="plain-button" onClick={() => setDialog('reset')}>{t.reset}</button></div></footer>
    {dialog && <Dialogs kind={dialog} t={t} onClose={() => setDialog(null)} onReset={reset}/>}
  </div>;
}
