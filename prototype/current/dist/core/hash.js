export function fnv1a(parts) {
    let h = 0x811c9dc5;
    const add = (b) => {
        h ^= b;
        h = Math.imul(h, 0x01000193) >>> 0;
    };
    for (const p of parts) {
        const s = typeof p === 'number' ? (Number.isInteger(p) ? String(p) : p.toFixed(4)) : p;
        for (let i = 0; i < s.length; i++)
            add(s.charCodeAt(i) & 255);
        add(124);
    }
    return h.toString(16).padStart(8, '0');
}
