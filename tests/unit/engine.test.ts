import { describe, expect, it } from 'vitest';
import { calculate, CalculationError } from '../../src/engine';
import { formatComplex } from '../../src/engine/format';
import { parse, serialize } from '../../src/engine/parser';
const evaluate = (expression: string, precision = 50) =>
  calculate({ expression, precision, mode: 'numeric' });
const text = (expression: string, digits = 20, precision = 50) =>
  formatComplex(evaluate(expression, precision).value!, digits, 'auto');
describe('black-box numeric acceptance', () => {
  it.each([
    ['0', '0'],
    ['sqrt(0)', '0'],
    ['sqrt(1)', '1'],
    ['sqrt(4)', '2'],
    ['sqrt(0.25)', '0.5'],
    ['sqrt(-1)', 'i'],
    ['sqrt(-4)', '2i'],
    ['sqrt(-0.25)', '0.5i'],
    ['sqrt(-0)', '0'],
    ['sqrt(3+4i)', '2 + i'],
    ['sqrt(3-4i)', '2 - i'],
    ['sqrt(-3+4i)', '1 + 2i'],
    ['sqrt(-3-4i)', '1 - 2i'],
    ['(2+3*i)^2', '-5 + 12i'],
    ['(2+3i)+(5-7i)', '7 - 4i'],
    ['(2+3i)-(5-7i)', '-3 + 10i'],
    ['(2+3i)*(5-7i)', '31 + i'],
    ['(1+i)/(1-i)', 'i'],
    ['(1+i)/(0+2i)', '0.5 - 0.5i'],
    ['(1+i)/(2+i)', '0.6 + 0.2i'],
    ['i^0', '1'],
    ['i^1', 'i'],
    ['i^2', '-1'],
    ['i^3', '-i'],
    ['i^4', '1'],
    ['2^-3', '0.125'],
    ['(-1)^0.5', 'i'],
    ['0^0.5', '0'],
    ['2^3^2', '512'],
    ['-2^2', '-4'],
    ['(-2)^2', '4'],
    ['+2', '2'],
    ['2(1+i)', '2 + 2i'],
    ['(1+i)(1-i)', '2'],
    ['0.1+0.2', '0.3'],
    ['0,1+0,2', '0.3'],
    ['sqrt(0,25)', '0.5'],
    ['.25', '0.25'],
    ['1.', '1'],
    ['1e4', '10000'],
    ['1E-4', '0.0001'],
    ['abs(3+4i)', '5'],
    ['re(2+3i)', '2'],
    ['im(2+3i)', '3'],
    ['conj(2+3i)', '2 - 3i'],
    ['exp(0)', '1'],
    ['ln(1)', '0'],
    ['log(e)', '1'],
    ['sin(0)', '0'],
    ['cos(0)', '1'],
    ['tan(0)', '0'],
    ['sin(pi/6)', '0.5'],
    ['cos(pi/3)', '0.5'],
    ['sin(i)/i', '1.1752011936438014569'],
    ['sqrt(1e100)', '1e+50'],
    ['sqrt(1e-100)', '1e-50'],
    ['1e10000', '1e+10000'],
    ['1e-10000', '1e-10000'],
    ['2×3−1', '5'],
    ['6÷2', '3'],
    ['sin(π/6)', '0.5'],
    ['  \n 4 + 5\t', '9'],
    ['12345678901234567890+1', '12345678901234567891'],
  ])('%s → %s', (expression, expected) => {
    expect(text(expression)).toBe(expected);
  });
  it('keeps 50 sqrt(2) digits, not a double approximation', () => {
    expect(text('sqrt(2)', 50)).toBe('1.4142135623730950488016887242096980785696718753769');
  });
  it('supports a 200-digit integer without Number conversion', () => {
    expect(text(`${'9'.repeat(180)}+1`, 200, 200)).toBe('1e+180');
  });
  it('evaluates fractional and complex powers on the principal branch', () => {
    expect(text('8^(1/3)')).toBe('2');
    expect(text('i^i')).toBe('0.20787957635076190855');
    expect(text('ln(-1)')).toBe('3.1415926535897932385i');
  });
  it('warns on detected precision loss', () => {
    expect(evaluate('(1e60+1)-1e60', 20).warnings).toContain('rounding');
  });
  it('keeps the small component of a nearly real complex root', () => {
    const result = evaluate('sqrt(1+1e-80*i)', 50).value!;
    expect(result.im).toBe('5e-81');
  });
});
describe('malformed, unsafe and boundary inputs', () => {
  it.each([
    ['', 'EMPTY'],
    ['  ', 'EMPTY'],
    ['abc', 'UNKNOWN_NAME'],
    ['NaN', 'UNKNOWN_NAME'],
    ['Infinity', 'UNKNOWN_NAME'],
    ['x+1', 'UNKNOWN_NAME'],
    ['1/0', 'DIV_ZERO'],
    ['1/(i-i)', 'DIV_ZERO'],
    ['0^-1', 'DIV_ZERO'],
    ['0^0', 'DOMAIN'],
    ['0^i', 'DOMAIN'],
    ['ln(0)', 'DOMAIN'],
    ['2+', 'SYNTAX'],
    ['(2', 'SYNTAX'],
    ['sqrt', 'SYNTAX'],
    ['sqrt 2', 'SYNTAX'],
    ['sqrt()', 'SYNTAX'],
    ['sqrt(2', 'SYNTAX'],
    ['2)', 'SYNTAX'],
    ['1 2', 'SYNTAX'],
    ['1.2.3', 'SYNTAX'],
    ['1,234.5', 'SYNTAX'],
    ['1;alert(1)', 'SYNTAX'],
    ['[1]', 'SYNTAX'],
    ['x=1', 'SYNTAX'],
    ['constructor(1)', 'UNKNOWN_NAME'],
    ['<script>', 'SYNTAX'],
    ['1e10001', 'LIMIT'],
    ['1e-10001', 'LIMIT'],
    ['2^10001', 'LIMIT'],
    ['sin(1e7)', 'LIMIT'],
    ['cos(1e7)', 'LIMIT'],
    ['tan(1e7)', 'LIMIT'],
    ['exp(20001)', 'LIMIT'],
    ['exp(1e7*i)', 'LIMIT'],
    ['1e10000*10', 'LIMIT'],
    ['1e-10000/10', 'LIMIT'],
    ['9'.repeat(1001), 'LIMIT'],
    ['1'.repeat(4097), 'LIMIT'],
    ['('.repeat(70) + '1' + ')'.repeat(70), 'LIMIT'],
    ['1+'.repeat(260) + '1', 'LIMIT'],
  ])('rejects %s as %s', (expression, code) => {
    try {
      evaluate(expression);
      throw new Error('Expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(CalculationError);
      expect((error as CalculationError).code).toBe(code);
    }
  });
  it.each([0, 1, 201, -2, 2.5, NaN, Infinity])('rejects precision %s', (precision) => {
    expect(() => evaluate('1', precision)).toThrow('PRECISION');
  });
  it('supports both precision endpoints', () => {
    expect(text('1/3', 2, 2)).toBe('0.33');
    expect(text('1/3', 200, 200)).toBe('0.' + '3'.repeat(200));
  });
});
describe('symbolic black-box acceptance', () => {
  const symbolic = (expression: string) =>
    calculate({ expression, precision: 50, mode: 'symbolic' }).symbolic;
  it.each([
    ['sqrt(8)', '2*sqrt(2)'],
    ['1/3', '1/3'],
    ['x+x', '2*x'],
    ['x+x+2*y-y', '2*x+y'],
    ['sin(x)^2+cos(x)^2', '1'],
    ['(x^2-1)/(x-1)', '1+x'],
  ])('%s → %s', (expression, expected) => {
    expect(symbolic(expression)).toBe(expected);
  });
  it.each(['re(i)', 'im(i)', 'conj(i)', '1/0', 'ln(0)'])(
    'rejects undefined/unsupported %s',
    (expression) => {
      expect(() => symbolic(expression)).toThrow('DOMAIN');
    },
  );
  it('limits symbolic input and exponent size', () => {
    expect(() => symbolic('1+'.repeat(260) + '1')).toThrow('LIMIT');
    expect(() => symbolic('2^1001')).toThrow('LIMIT');
  });
  it('canonicalizes only an allowlisted AST', () => {
    expect(serialize(parse('-sqrt(2)+x/3'))).toBe('((-sqrt(2))+(x/3))');
  });
});
describe('metamorphic complex properties', () => {
  for (let a = -4; a <= 4; a++)
    for (let b = -3; b <= 3; b++) {
      it(`z*conj(z)=|z|² for (${a},${b})`, () => {
        expect(text(`(${a}+(${b})*i)*conj(${a}+(${b})*i)`)).toBe(String(a * a + b * b));
      });
    }
  it.each([1, 2, 19, 100, 999])('sqrt(n²)=n for n=%s', (n) => {
    expect(text(`sqrt(${n}^2)`)).toBe(String(n));
  });
});
describe('output formatting', () => {
  it('uses ties-to-even rounding', () => {
    expect(formatComplex({ re: '1.245', im: '0' }, 3, 'auto')).toBe('1.24');
    expect(formatComplex({ re: '1.255', im: '0' }, 3, 'auto')).toBe('1.26');
  });
  it('handles scientific complex results and signed zero', () => {
    expect(formatComplex({ re: '2', im: '-3' }, 4, 'scientific')).toBe('2.000e+0 - 3.000e+0i');
    expect(formatComplex({ re: '-0', im: '-0' }, 4, 'auto')).toBe('0');
  });
  it.each([1, 201, 2.2])('rejects invalid output digits %s', (digits) => {
    expect(() => formatComplex({ re: '1', im: '0' }, digits, 'auto')).toThrow('PRECISION');
  });
});
