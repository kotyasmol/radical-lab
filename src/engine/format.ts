import Decimal from 'decimal.js';
import type { ComplexValue } from './numeric';
import { CalculationError } from './parser';
export type Notation = 'auto' | 'scientific';
export function formatComplex(value: ComplexValue, digits: number, notation: Notation): string {
  if (!Number.isInteger(digits) || digits < 2 || digits > 200) throw new CalculationError('PRECISION');
  const D = Decimal.clone({ rounding: Decimal.ROUND_HALF_EVEN, toExpNeg: -7, toExpPos: 21 });
  const part = (x: Decimal) => {
    const rounded = x.toSignificantDigits(digits);
    if (rounded.isZero()) return '0';
    return notation === 'scientific' ? rounded.toExponential(digits - 1) : rounded.toString();
  };
  const re = new D(value.re), im = new D(value.im);
  if (im.isZero()) return part(re);
  const imaginary = (im.abs().eq(1) ? '' : part(im.abs())) + 'i';
  if (re.isZero()) return (im.isNegative() ? '-' : '') + imaginary;
  return `${part(re)} ${im.isNegative() ? '-' : '+'} ${imaginary}`;
}
