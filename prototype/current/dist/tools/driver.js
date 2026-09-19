/**
 * Which of the three cards an automated driver takes.
 *
 * The drivers used to take the first one. That was harmless while every card at a level was a
 * growth direction, and became misleading the moment a level could offer a find, an operator,
 * a relic and a direction side by side: taking index zero after a shuffle meant the hero chose
 * growth roughly one level in three, so he grew about a third as fast as the elite durability
 * had been calibrated against, and a common elite stretched from twelve seconds to thirty.
 *
 * The policy is deliberately crude - fill the empty nodes, then grow - because anything
 * cleverer would measure the policy rather than the game. A new phenomenon is only offered as
 * `skill_add` while there is somewhere to put it; once the build is full the generator sends
 * `skill_swap` instead, which this driver declines in favour of growth rather than churning
 * its own roster on every level.
 */
export function pickOffer(s) {
    const offers = s.rewardOffers;
    if (!offers || !offers.length)
        return 0;
    const add = offers.findIndex((o) => o.kind === 'skill_add');
    if (add >= 0)
        return add;
    const grow = offers.findIndex((o) => o.kind === 'resonance');
    if (grow >= 0)
        return grow;
    return 0;
}
/**
 * Where the driver walks. Relics carry a large part of the hero's power now and they do not
 * come to him, so a driver that only circles measures a player who ignores half of what the
 * design hands out. It heads for the nearest relic when one is within reach and otherwise
 * traces the same wandering circle as before.
 */
export function steer(s, tick, hz) {
    const a = tick / (hz * 4.3);
    const sx = Math.cos(a) * 0.65, sy = Math.sin(a * 0.73) * 0.58;
    let moveX = (sx + sy) * 0.7071, moveZ = (-sx + sy) * 0.7071;
    let bestX = 0, bestZ = 0, bestD = 26, found = false;
    for (const r of s.relics) {
        const d = Math.hypot(r.x - s.player.x, r.z - s.player.z);
        if (d < bestD) {
            bestD = d;
            bestX = r.x;
            bestZ = r.z;
            found = true;
        }
    }
    if (found) {
        const dx = bestX - s.player.x, dz = bestZ - s.player.z, m = Math.hypot(dx, dz) || 1;
        moveX = dx / m;
        moveZ = dz / m;
    }
    const targets = [...s.entities].sort((p, q) => Number(q.elite) - Number(p.elite) ||
        Math.hypot(p.x - s.player.x, p.z - s.player.z) -
            Math.hypot(q.x - s.player.x, q.z - s.player.z));
    const t = targets[0];
    let aimX = Math.cos(a), aimZ = Math.sin(a);
    if (t) {
        const dx = t.x - s.player.x, dz = t.z - s.player.z, m = Math.hypot(dx, dz) || 1;
        aimX = dx / m;
        aimZ = dz / m;
    }
    return { moveX, moveZ, aimX, aimZ };
}
