import { useEffect, useRef, useState } from 'react';
import type { translations } from '../i18n';
import { checkForUpdate, RELEASES, REPOSITORY, VERSION } from '../services/updates';
import { Icon } from './Icons';
export type DialogKind = 'help' | 'reset' | 'updates';
export function Dialogs({
  kind,
  t,
  onClose,
  onReset,
}: {
  kind: DialogKind;
  t: typeof translations.en;
  onClose: () => void;
  onReset: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [update, setUpdate] = useState<'idle' | 'checking' | 'current' | 'available' | 'error'>(
    'idle',
  );
  const [latest, setLatest] = useState('');
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  async function check() {
    setUpdate('checking');
    try {
      const result = await checkForUpdate();
      setLatest(result.version);
      setUpdate(result.newer ? 'available' : 'current');
    } catch {
      setUpdate('error');
    }
  }
  const title = kind === 'help' ? t.helpTitle : kind === 'reset' ? t.resetTitle : t.updateTitle;
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      aria-labelledby="dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-content">
        <div className="section-heading">
          <h2 id="dialog-title">{title}</h2>
          <button className="icon-button" aria-label={t.close} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {kind === 'help' && (
          <div className="help-text">
            <h3>{t.expression}</h3>
            <p>{t.helpInput}</p>
            <p>{t.helpFunctions}</p>
            <h3>{t.precision}</h3>
            <p>{t.helpPrecision}</p>
            <p>{t.helpLimits}</p>
            <h3>{t.symbolic}</h3>
            <p>{t.helpSymbolic}</p>
            <h3>{t.offline}</h3>
            <p>{t.helpPortability}</p>
            <h3>{t.reset}</h3>
            <p>{t.helpRemoval}</p>
            <h3>{t.documentation}</h3>
            <p>{t.helpLinks}</p>
            <a href={`${REPOSITORY}/tree/main/docs`} target="_blank" rel="noreferrer">
              GitHub · {t.documentation}
            </a>
          </div>
        )}
        {kind === 'reset' && (
          <>
            <p>{t.resetText}</p>
            <div className="dialog-actions">
              <button className="secondary" onClick={onClose}>
                {t.cancel}
              </button>
              <button className="primary" onClick={onReset}>
                {t.resetConfirm}
              </button>
            </div>
          </>
        )}
        {kind === 'updates' && (
          <>
            <p>
              {t.version} {VERSION}
            </p>
            <p role="status">
              {update === 'current'
                ? t.upToDate
                : update === 'available'
                  ? `${t.available} ${latest}`
                  : update === 'error'
                    ? t.unavailable
                    : ''}
            </p>
            <div className="dialog-actions">
              <a href={RELEASES} target="_blank" rel="noreferrer">
                {t.releases}
              </a>
              <button className="primary" onClick={check} disabled={update === 'checking'}>
                {update === 'checking' ? t.checking : t.check}
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
