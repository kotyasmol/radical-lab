import type { CalculationRequest, CalculationResult } from '../engine';
import type { ErrorCode } from '../engine/parser';
export type WorkerReply = { ok: true; result: CalculationResult } | { ok: false; code: ErrorCode };
export interface WorkerLike {
  onmessage: ((event: MessageEvent<WorkerReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(request: CalculationRequest): void;
  terminate(): void;
}
export function createRunner(createWorker: () => WorkerLike, timeout = 4000) {
  let cancelCurrent: (() => void) | undefined;
  return {
    cancel() { cancelCurrent?.(); },
    run(request: CalculationRequest): Promise<CalculationResult> {
      cancelCurrent?.();
      return new Promise((resolve, reject) => {
        let worker: WorkerLike;
        try { worker = createWorker(); } catch { reject('WORKER'); return; }
        let settled = false;
        const finish = () => {
          settled = true; clearTimeout(timer); worker.terminate(); cancelCurrent = undefined;
        };
        const fail = (code: string) => { if (!settled) { finish(); reject(code); } };
        const timer = setTimeout(() => fail('TIMEOUT'), timeout);
        cancelCurrent = () => fail('CANCELLED');
        worker.onmessage = ({ data }) => {
          if (settled) return;
          finish();
          if (data.ok) resolve(data.result); else reject(data.code);
        };
        worker.onerror = () => fail('WORKER');
        try { worker.postMessage(request); } catch { fail('WORKER'); }
      });
    },
  };
}
