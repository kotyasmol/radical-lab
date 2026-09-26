import Decimal from 'decimal.js';
import { type Ast, CalculationError } from './parser';
export type ComplexValue = { re: string; im: string };
type Complex = { re: Decimal; im: Decimal };

export function evaluateNumeric(ast: Ast, precision: number): ComplexValue {
  const D = Decimal.clone({
    precision: precision + 30,
    rounding: Decimal.ROUND_HALF_EVEN,
    maxE: 9000000000000000,
    minE: -9000000000000000,
    toExpNeg: -7,
    toExpPos: 21,
  });
  const C = (re: Decimal.Value, im: Decimal.Value = 0): Complex => ({
    re: new D(re),
    im: new D(im),
  });
  const add = (a: Complex, b: Complex) => C(a.re.plus(b.re), a.im.plus(b.im));
  const neg = (a: Complex) => C(a.re.neg(), a.im.neg());
  const sub = (a: Complex, b: Complex) => add(a, neg(b));
  const mul = (a: Complex, b: Complex) =>
    C(a.re.mul(b.re).minus(a.im.mul(b.im)), a.re.mul(b.im).plus(a.im.mul(b.re)));
  const zero = (a: Complex) => a.re.isZero() && a.im.isZero();
  const div = (a: Complex, b: Complex) => {
    if (zero(b)) throw new CalculationError('DIV_ZERO');
    // Scaled division avoids unnecessary squaring of huge/small components.
    if (b.re.abs().gte(b.im.abs())) {
      const r = b.im.div(b.re),
        d = b.re.plus(b.im.mul(r));
      return C(a.re.plus(a.im.mul(r)).div(d), a.im.minus(a.re.mul(r)).div(d));
    }
    const r = b.re.div(b.im),
      d = b.im.plus(b.re.mul(r));
    return C(a.re.mul(r).plus(a.im).div(d), a.im.mul(r).minus(a.re).div(d));
  };
  const magnitude = (a: Complex) => D.hypot(a.re, a.im);
  const sqrt = (a: Complex): Complex => {
    if (a.im.isZero()) return a.re.isNegative() ? C(0, a.re.neg().sqrt()) : C(a.re.sqrt());
    const m = magnitude(a);
    if (a.re.gte(0)) {
      const re = m.plus(a.re).div(2).sqrt();
      return C(re, a.im.div(re.mul(2)));
    }
    const im = m
      .minus(a.re)
      .div(2)
      .sqrt()
      .mul(a.im.isNegative() ? -1 : 1);
    return C(a.im.div(im.mul(2)), im);
  };
  const ln = (a: Complex) => {
    if (zero(a)) throw new CalculationError('DOMAIN');
    return C(magnitude(a).ln(), D.atan2(a.im.isZero() ? new D(0) : a.im, a.re));
  };
  const exp = (a: Complex) => {
    if (a.re.abs().gt(20000) || a.im.abs().gt('1e6')) throw new CalculationError('LIMIT');
    const r = a.re.exp();
    return C(r.mul(a.im.cos()), r.mul(a.im.sin()));
  };
  function power(a: Complex, b: Complex): Complex {
    if (b.im.isZero() && b.re.isInteger()) {
      if (b.re.abs().gt(10000)) throw new CalculationError('LIMIT');
      let n = b.re.abs().toNumber();
      if (zero(a) && n === 0) throw new CalculationError('DOMAIN');
      let result = C(1),
        base = a;
      while (n > 0) {
        if (n % 2) result = mul(result, base);
        n = Math.floor(n / 2);
        if (n) base = mul(base, base);
      }
      return b.re.isNegative() ? div(C(1), result) : result;
    }
    if (zero(a)) {
      if (b.im.isZero() && b.re.gt(0)) return C(0);
      throw new CalculationError('DOMAIN');
    }
    if (b.im.isZero() && b.re.eq('0.5')) return sqrt(a);
    return exp(mul(b, ln(a)));
  }
  function fn(name: string, a: Complex): Complex {
    if (['sin', 'cos', 'tan'].includes(name) && (a.re.abs().gt('1e6') || a.im.abs().gt(20000)))
      throw new CalculationError('LIMIT');
    switch (name) {
      case 'sqrt':
        return sqrt(a);
      case 'abs':
        return C(magnitude(a));
      case 're':
        return C(a.re);
      case 'im':
        return C(a.im);
      case 'conj':
        return C(a.re, a.im.neg());
      case 'ln':
      case 'log':
        return ln(a);
      case 'exp':
        return exp(a);
      case 'sin':
        return C(a.re.sin().mul(a.im.cosh()), a.re.cos().mul(a.im.sinh()));
      case 'cos':
        return C(a.re.cos().mul(a.im.cosh()), a.re.sin().mul(a.im.sinh()).neg());
      case 'tan':
        return div(fn('sin', a), fn('cos', a));
      default:
        throw new CalculationError('UNKNOWN_NAME');
    }
  }
  function visit(node: Ast): Complex {
    let result: Complex;
    switch (node.kind) {
      case 'number':
        result = C(node.value);
        break;
      case 'name':
        if (node.name === 'i') result = C(0, 1);
        else if (node.name === 'pi') result = C(D.acos(-1));
        else if (node.name === 'e') result = C(new D(1).exp());
        else throw new CalculationError('UNKNOWN_NAME');
        break;
      case 'unary':
        result = node.op === '-' ? neg(visit(node.value)) : visit(node.value);
        break;
      case 'call':
        result = fn(node.name, visit(node.value));
        break;
      case 'binary': {
        const a = visit(node.left),
          b = visit(node.right);
        switch (node.op) {
          case '+':
            result = add(a, b);
            break;
          case '-':
            result = sub(a, b);
            break;
          case '*':
            result = mul(a, b);
            break;
          case '/':
            result = div(a, b);
            break;
          case '^':
            result = power(a, b);
            break;
          default:
            throw new CalculationError('SYNTAX');
        }
      }
    }
    if (!result.re.isFinite() || !result.im.isFinite()) throw new CalculationError('NON_FINITE');
    if ([result.re, result.im].some((part) => !part.isZero() && Math.abs(part.e) > 10000))
      throw new CalculationError('LIMIT');
    return result;
  }
  const result = visit(ast);
  return {
    re: result.re.toSignificantDigits(precision).toString(),
    im: result.im.toSignificantDigits(precision).toString(),
  };
}
