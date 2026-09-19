import { fallbackDeadActor } from './types.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export class PresentationBridge {
    entityCache = new Map();
    hits = new Map();
    deaths = [];
    lastHitDir = new Map();
    reset(snapshot) {
        this.entityCache.clear();
        this.hits.clear();
        this.deaths = [];
        this.lastHitDir.clear();
        if (snapshot)
            this.sync(snapshot);
    }
    sync(snapshot) {
        this.entityCache = new Map(snapshot.entities.map((e) => [e.id, { ...e, status: { ...e.status } }]));
    }
    consume(events, time, snapshot) {
        const cues = [];
        const postById = new Map(snapshot.entities.map((e) => [e.id, e]));
        for (const e of events) {
            if (e.type === 'SkillActivated')
                cues.push({
                    type: 'skillCast',
                    time,
                    skill: e.skill,
                    x: e.x,
                    z: e.z,
                    aimX: e.aimX,
                    aimZ: e.aimZ
                });
            else if (e.type === 'CombatShape')
                cues.push({
                    type: 'combatShape',
                    time,
                    source: e.source,
                    shape: e.shape,
                    intent: e.intent
                });
            else if (e.type === 'CatalystTriggered')
                cues.push({
                    type: 'catalyst',
                    time,
                    catalyst: e.catalyst,
                    fromSlot: e.fromSlot,
                    toSlot: e.toSlot,
                    sourceX: e.sourceX,
                    sourceZ: e.sourceZ,
                    targetX: e.targetX,
                    targetZ: e.targetZ
                });
            else if (e.type === 'DamageResolved') {
                const target = postById.get(e.entity) ?? this.entityCache.get(e.entity);
                const dx = e.x - e.sourceX, dz = e.z - e.sourceZ, mag = Math.hypot(dx, dz) || 1, dirX = dx / mag, dirZ = dz / mag;
                const maxHp = Math.max(1, target?.maxHp ?? e.amount), ratio = e.amount / maxHp;
                const intensity = clamp(0.28 + Math.sqrt(Math.max(0, ratio)) * 1.35 + (e.crit ? 0.28 : 0), 0.32, 1.65);
                this.lastHitDir.set(e.entity, { x: dirX, z: dirZ });
                const prev = this.hits.get(e.entity);
                this.hits.set(e.entity, {
                    entity: e.entity,
                    start: time,
                    ttl: e.elite ? 0.16 : 0.12,
                    x: e.x,
                    z: e.z,
                    radius: target?.radius ?? (e.elite ? 0.8 : 0.42),
                    dirX,
                    dirZ,
                    intensity: Math.max(intensity, prev?.intensity ?? 0),
                    elite: e.elite,
                    crit: e.crit || !!prev?.crit
                });
                cues.push({
                    type: 'damage',
                    time,
                    entity: e.entity,
                    amount: e.amount,
                    source: e.source,
                    x: e.x,
                    z: e.z,
                    sourceX: e.sourceX,
                    sourceZ: e.sourceZ,
                    elite: e.elite,
                    crit: e.crit,
                    target
                });
            }
            else if (e.type === 'EntityDied') {
                const actor = this.entityCache.get(e.entity) ?? postById.get(e.entity) ?? fallbackDeadActor(e);
                const dir = this.lastHitDir.get(e.entity) ?? { x: 0, z: 0 };
                this.deaths.push({
                    entity: e.entity,
                    start: time,
                    ttl: e.elite ? 0.82 : 0.48,
                    x: e.x,
                    z: e.z,
                    dirX: dir.x,
                    dirZ: dir.z,
                    actor: { ...actor, x: e.x, z: e.z, hp: 0, status: { ...actor.status } }
                });
                this.hits.delete(e.entity);
                this.lastHitDir.delete(e.entity);
                cues.push({ type: 'death', time, entity: e.entity, x: e.x, z: e.z, elite: e.elite });
            }
            else if (e.type === 'Reaction')
                cues.push({
                    type: 'reaction',
                    time,
                    reaction: e.reaction,
                    x: e.x,
                    z: e.z,
                    amount: e.amount
                });
            else if (e.type === 'EntitySpawned' && e.kind === 'elite')
                cues.push({ type: 'eliteSpawn', time, x: e.x, z: e.z, chassis: e.chassis });
            else if (e.type === 'PlayerHit')
                cues.push({ type: 'playerHit', time, amount: e.amount, x: e.x, z: e.z });
            else if (e.type === 'EliteEchoPhase')
                cues.push({ type: 'eliteEcho', time, entity: e.entity, skill: e.skill, phase: e.phase, x: e.x, z: e.z, aimX: e.aimX, aimZ: e.aimZ });
            else if (e.type === 'RareEvent')
                cues.push({ type: 'rareEvent', time, title: e.title, detail: e.detail, x: e.x, z: e.z });
            else if (e.type === 'EliteOrder')
                cues.push({ type: 'eliteOrder', time, x: e.x, z: e.z, order: e.order, count: e.count });
        }
        this.sync(snapshot);
        return cues;
    }
    frame(time) {
        for (const [id, h] of this.hits)
            if (time - h.start > h.ttl)
                this.hits.delete(id);
        this.deaths = this.deaths.filter((d) => time - d.start < d.ttl);
        return { time, hits: [...this.hits.values()], deaths: this.deaths };
    }
}
