export class Rng {
    s;
    constructor(seed) {
        this.s = seed >>> 0 || 0x9e3779b9;
    }
    nextU32() {
        let x = this.s;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.s = x >>> 0;
        return this.s;
    }
    float() {
        return this.nextU32() / 4294967296;
    }
    range(a, b) {
        return a + (b - a) * this.float();
    }
    int(n) {
        return Math.floor(this.float() * n);
    }
    state() {
        return this.s >>> 0;
    }
}
