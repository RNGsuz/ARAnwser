class ArithmeticParser {
  private index = 0;

  constructor(private readonly source: string) {}

  parse(): number {
    const value = this.expression();
    this.space();
    if (this.index !== this.source.length || !Number.isFinite(value)) throw new Error("invalid_expression");
    return value;
  }

  private expression(): number {
    let value = this.term();
    while (true) {
      this.space();
      if (this.take("+")) value += this.term();
      else if (this.take("-")) value -= this.term();
      else return value;
    }
  }

  private term(): number {
    let value = this.factor();
    while (true) {
      this.space();
      if (this.take("*")) value *= this.factor();
      else if (this.take("/")) value /= this.factor();
      else return value;
    }
  }

  private factor(): number {
    this.space();
    if (this.take("+")) return this.factor();
    if (this.take("-")) return -this.factor();
    if (this.take("(")) {
      const value = this.expression();
      this.space();
      if (!this.take(")")) throw new Error("invalid_expression");
      return value;
    }
    const match = this.source.slice(this.index).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
    if (!match) throw new Error("invalid_expression");
    this.index += match[0].length;
    return Number(match[0]);
  }

  private take(value: string): boolean {
    if (!this.source.startsWith(value, this.index)) return false;
    this.index += value.length;
    return true;
  }

  private space(): void {
    while (/\s/.test(this.source[this.index] || "")) this.index += 1;
  }
}

export function calculateArithmetic(expression: string): number | null {
  const normalized = expression.replace(/,/g, ".").replace(/[×·]/g, "*").replace(/÷/g, "/");
  if (!/^[\d\s.+\-*/()]+$/.test(normalized) || normalized.length > 300) return null;
  try {
    return new ArithmeticParser(normalized).parse();
  } catch {
    return null;
  }
}
