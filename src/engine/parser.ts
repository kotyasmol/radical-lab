export type ErrorCode = 'EMPTY' | 'SYNTAX' | 'UNKNOWN_NAME' | 'LIMIT' | 'DIV_ZERO' | 'DOMAIN' | 'NON_FINITE' | 'PRECISION' | 'TIMEOUT' | 'INTERNAL' | 'WORKER';
export class CalculationError extends Error {
  constructor(public code: ErrorCode, public position?: number) { super(code); }
}
export type Ast =
  | { kind: 'number'; value: string }
  | { kind: 'name'; name: string }
  | { kind: 'unary'; op: '+' | '-'; value: Ast }
  | { kind: 'binary'; op: string; left: Ast; right: Ast }
  | { kind: 'call'; name: string; value: Ast };
export const FUNCTIONS = ['sqrt', 'sin', 'cos', 'tan', 'exp', 'ln', 'log', 'abs', 're', 'im', 'conj'] as const;
const NAMES = ['pi', 'e', 'i', 'x', 'y', 'z'];
type Token = { value: string; kind: 'number' | 'name' | 'op' | 'end'; pos: number };

/** A deliberately small mathematical grammar; never JavaScript or a scripting language. */
export function parse(source: string): Ast {
  if (!source.trim()) throw new CalculationError('EMPTY');
  if (source.length > 4096) throw new CalculationError('LIMIT');
  const input = source.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi');
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < input.length) {
    if (/\s/.test(input[pos])) { pos++; continue; }
    const rest = input.slice(pos);
    const number = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?/.exec(rest);
    const name = /^[a-zA-Z_][a-zA-Z_0-9]*/.exec(rest);
    if (number) {
      const value = number[0].replace(',', '.');
      if (value.length > 1000 || Math.abs(Number(value.split(/[eE]/)[1] || 0)) > 10000) throw new CalculationError('LIMIT', pos);
      tokens.push({ kind: 'number', value, pos }); pos += number[0].length;
    } else if (name) {
      if (![...NAMES, ...FUNCTIONS].includes(name[0])) throw new CalculationError('UNKNOWN_NAME', pos);
      tokens.push({ kind: 'name', value: name[0], pos }); pos += name[0].length;
    } else if ('+-*/^()'.includes(input[pos])) {
      tokens.push({ kind: 'op', value: input[pos], pos }); pos++;
    } else throw new CalculationError('SYNTAX', pos);
    if (tokens.length > 512) throw new CalculationError('LIMIT', pos);
  }
  tokens.push({ kind: 'end', value: '', pos });
  let cursor = 0;
  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];
  function expression(min: number, depth: number): Ast {
    if (depth > 64) throw new CalculationError('LIMIT', peek().pos);
    const token = take();
    let left: Ast;
    if (token.kind === 'number') left = { kind: 'number', value: token.value };
    else if (token.value === '+' || token.value === '-') left = { kind: 'unary', op: token.value, value: expression(25, depth + 1) };
    else if (token.value === '(') {
      left = expression(0, depth + 1);
      if (take().value !== ')') throw new CalculationError('SYNTAX', peek()?.pos);
    } else if (token.kind === 'name') {
      if (FUNCTIONS.includes(token.value as typeof FUNCTIONS[number])) {
        if (take().value !== '(') throw new CalculationError('SYNTAX', token.pos);
        left = { kind: 'call', name: token.value, value: expression(0, depth + 1) };
        if (take().value !== ')') throw new CalculationError('SYNTAX', peek()?.pos);
      } else left = { kind: 'name', name: token.value };
    } else throw new CalculationError('SYNTAX', token.pos);
    while (true) {
      const next = peek();
      const implicit = next.kind === 'name' || next.value === '(';
      const op = implicit ? '*' : next.value;
      const precedence = op === '+' || op === '-' ? 10 : op === '*' || op === '/' ? 20 : op === '^' ? 30 : -1;
      if (precedence < min) break;
      if (!implicit) take();
      left = { kind: 'binary', op, left, right: expression(op === '^' ? precedence : precedence + 1, depth + 1) };
    }
    return left;
  }
  const ast = expression(0, 0);
  if (peek().kind !== 'end') throw new CalculationError('SYNTAX', peek().pos);
  return ast;
}

export function serialize(ast: Ast): string {
  switch (ast.kind) {
    case 'number': return ast.value;
    case 'name': return ast.name;
    case 'unary': return `(${ast.op}${serialize(ast.value)})`;
    case 'binary': return `(${serialize(ast.left)}${ast.op}${serialize(ast.right)})`;
    case 'call': return `${ast.name === 'ln' ? 'log' : ast.name}(${serialize(ast.value)})`;
  }
}
