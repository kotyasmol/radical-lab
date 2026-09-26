import nerdamer from 'nerdamer/all.min';
import { CalculationError, parse, serialize, type Ast } from './parser';
import { evaluateNumeric, type ComplexValue } from './numeric';
export type Mode = 'numeric' | 'symbolic';
export interface CalculationRequest {
  expression: string;
  precision: number;
  mode: Mode;
}
export interface CalculationResult {
  mode: Mode;
  value?: ComplexValue;
  symbolic?: string;
  warnings: ('rounding' | 'symbolicDomain')[];
}

function validateSymbolic(node: Ast): void {
  if (node.kind === 'call') {
    if (['re', 'im', 'conj'].includes(node.name)) throw new CalculationError('DOMAIN');
    validateSymbolic(node.value);
  } else if (node.kind === 'unary') validateSymbolic(node.value);
  else if (node.kind === 'binary') {
    if (node.op === '^' && node.right.kind === 'number' && Number(node.right.value) > 1000)
      throw new CalculationError('LIMIT');
    validateSymbolic(node.left);
    validateSymbolic(node.right);
  }
}
export function calculate(request: CalculationRequest): CalculationResult {
  if (!Number.isInteger(request.precision) || request.precision < 2 || request.precision > 200)
    throw new CalculationError('PRECISION');
  if (request.mode !== 'numeric' && request.mode !== 'symbolic')
    throw new CalculationError('DOMAIN');
  const ast = parse(request.expression);
  if (request.mode === 'symbolic') {
    if (request.expression.length > 512) throw new CalculationError('LIMIT');
    validateSymbolic(ast);
    try {
      // Only a canonical expression built from the allowlisted AST enters the CAS.
      const symbolic = nerdamer(`simplify(${serialize(ast)})`).toString();
      if (symbolic.length > 10000) throw new CalculationError('LIMIT');
      if (/NaN|Infinity|undefined/.test(symbolic)) throw new CalculationError('DOMAIN');
      return { mode: 'symbolic', symbolic, warnings: ['symbolicDomain'] };
    } catch (error) {
      if (error instanceof CalculationError) throw error;
      throw new CalculationError('DOMAIN');
    } finally {
      nerdamer.clear('all');
    }
  }
  const value = evaluateNumeric(ast, request.precision);
  const check = evaluateNumeric(ast, request.precision + 20);
  // A second pass detects some loss of significance; it is not a proof of accuracy.
  const rounded = roundValue(check, request.precision);
  const unstable = value.re !== rounded.re || value.im !== rounded.im;
  return { mode: 'numeric', value, warnings: unstable ? ['rounding'] : [] };
}

import Decimal from 'decimal.js';
function roundValue(value: ComplexValue, precision: number): ComplexValue {
  const D = Decimal.clone({ rounding: Decimal.ROUND_HALF_EVEN });
  return {
    re: new D(value.re).toSignificantDigits(precision).toString(),
    im: new D(value.im).toSignificantDigits(precision).toString(),
  };
}
export { CalculationError };
