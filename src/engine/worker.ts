import { calculate, CalculationError, type CalculationRequest } from './index';
self.onmessage = (event: MessageEvent<CalculationRequest>) => {
  try { self.postMessage({ ok: true, result: calculate(event.data) }); }
  catch (error) { self.postMessage({ ok: false, code: error instanceof CalculationError ? error.code : 'INTERNAL' }); }
};
