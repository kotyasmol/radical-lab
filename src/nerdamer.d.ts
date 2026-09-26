declare module 'nerdamer/all.min' {
  interface Expression {
    toString(): string;
  }
  interface Nerdamer {
    (expression: string): Expression;
    clear(value: string): void;
  }
  const nerdamer: Nerdamer;
  export default nerdamer;
}
