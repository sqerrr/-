export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }
  nextU32(): number {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s;
  }
  float(): number {
    return this.nextU32() / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.float();
  }
  int(n: number): number {
    return Math.floor(this.float() * n);
  }
  state(): number {
    return this.s >>> 0;
  }
}
