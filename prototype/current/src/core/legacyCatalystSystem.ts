import { legacyCatalystOrder } from '../content/definitions.js';
import type { ActivationContext, Ent } from './state.js';
import type { CatalystId, SkillId, SkillRuntime } from './types.js';

type LegacyReaction = 'aegis' | 'conduit' | 'echo';

export interface LegacyCatalystPort {
  time(): number;
  tick(): number;
  playerX(): number;
  playerZ(): number;
  movePlayer(dx: number, dz: number): void;

  getAliveEntity(id: number): Ent | undefined;
  entities(): readonly Ent[];
  skillAt(slot: number): SkillId | null;
  skillRuntime(id: SkillId): SkillRuntime | undefined;

  applyState(entity: Ent, state: string, potency: number): void;
  healPlayer(amount: number): void;
  grantBarrier(amount: number): void;
  damageEcho(entity: Ent, amount: number, x: number, z: number): void;
  castDerived(skill: SkillId, runtime: SkillRuntime, slot: number, scale: number): void;

  noteReaction(): void;
  emitReaction(reaction: LegacyReaction, x: number, z: number, amount?: number): void;
  emitCatalystTriggered(
    catalyst: CatalystId,
    fromSlot: number,
    toSlot: number,
    sourceX: number,
    sourceZ: number,
    targetX: number,
    targetZ: number
  ): void;
}

export interface LegacyBeforeCastInput {
  catalyst: CatalystId | null;
  slot: number;
  conductivity: number;
  previous: ActivationContext;
  aimX: number;
  aimZ: number;
  activationScale: number;
  activationCountBonus: number;
}

export interface LegacyBeforeCastResult {
  aimX: number;
  aimZ: number;
  activationScale: number;
  activationCountBonus: number;
}

export interface LegacyAfterCastInput {
  catalyst: CatalystId | null;
  slot: number;
  skill: SkillId;
  runtime: SkillRuntime;
  conductivity: number;
  previous: ActivationContext;
  currentHits: ReadonlySet<number>;
  currentKills: number;
}

export interface LegacyAfterContextInput {
  catalyst: CatalystId | null;
  slot: number;
  conductivity: number;
  previous: ActivationContext;
  targetX: number;
  targetZ: number;
}

/**
 * Save/replay compatibility for Catalyst 1.x.
 *
 * None of these operators are offered by current Discovery. Keeping their execution in a
 * dedicated layer prevents obsolete abstract operators from obscuring the Catalyst 2.x
 * physical-choreography pipeline while old seeds and replays remain executable.
 */
export class LegacyCatalystSystem {
  private readonly feedbackCountBonus = new Map<number, number>();
  private overflowGuard = false;
  private readonly legacy = new Set<CatalystId>(legacyCatalystOrder);

  constructor(private readonly port: LegacyCatalystPort) {}

  isLegacy(catalyst: CatalystId | null): boolean {
    return !!catalyst && this.legacy.has(catalyst);
  }

  beforeCast(input: LegacyBeforeCastInput): LegacyBeforeCastResult {
    const p = this.port;
    const conduct = 1 + input.conductivity * 0.16;
    let aimX = input.aimX;
    let aimZ = input.aimZ;
    let activationScale = input.activationScale;
    let activationCountBonus = input.activationCountBonus;

    if (this.isLegacy(input.catalyst)) {
      const incoming = input.catalyst!;

      if (incoming === 'anchor' && input.previous.hitIds.length) {
        const dx = input.previous.x - p.playerX();
        const dz = input.previous.z - p.playerZ();
        const magnitude = Math.hypot(dx, dz) || 1;
        aimX = dx / magnitude;
        aimZ = dz / magnitude;
      }

      if (incoming === 'capacitor') {
        const divisor = Math.max(3, 6 - input.conductivity);
        activationCountBonus += Math.min(3, Math.floor(input.previous.hitIds.length / divisor));
      }

      if (incoming === 'reservoir') {
        const crowdMass = input.previous.hitIds.length + input.previous.kills * 2;
        const threshold = Math.max(5, 9 - input.conductivity);
        if (crowdMass >= threshold) {
          activationCountBonus += 2 + Math.min(2, input.conductivity);
          p.noteReaction();
        }
      }

      if (incoming === 'recoil') {
        activationScale *= 1.55;
        p.movePlayer(-aimX * 1.2, -aimZ * 1.2);
      }

      if (incoming === 'focus') {
        activationScale *= 1.5;
        activationCountBonus -= 1;
      }

      if (incoming === 'surge' && !input.previous.hitIds.length) activationScale *= 1.9;

      if (incoming === 'glut' && input.previous.hitIds.length)
        activationScale *= Math.min(1.6, 1 + input.previous.hitIds.length * 0.06);

      if (incoming === 'stagger' && input.previous.hitIds.length) {
        let far: Ent | null = null;
        let best = -1;
        for (const entityId of input.previous.hitIds) {
          const entity = p.getAliveEntity(entityId);
          if (!entity) continue;
          const distance = Math.hypot(entity.x - p.playerX(), entity.z - p.playerZ());
          if (distance > best) {
            best = distance;
            far = entity;
          }
        }
        if (far) {
          const magnitude = Math.hypot(far.x - p.playerX(), far.z - p.playerZ()) || 1;
          aimX = (far.x - p.playerX()) / magnitude;
          aimZ = (far.z - p.playerZ()) / magnitude;
        }
      }

      if (incoming === 'splinter') activationCountBonus += 2;
    }

    const feedback = this.feedbackCountBonus.get(input.slot) ?? 0;
    if (feedback) {
      activationCountBonus += feedback;
      this.feedbackCountBonus.delete(input.slot);
    }

    if (
      this.isLegacy(input.catalyst) &&
      input.catalyst === 'aegis_relay' &&
      input.previous.control > 0
    ) {
      const gain = Math.min(
        36,
        (input.previous.control * 2.6 + input.previous.hitIds.length * 0.35) * conduct
      );
      p.grantBarrier(gain);
      p.emitReaction('aegis', p.playerX(), p.playerZ(), gain);
      p.noteReaction();
    }

    return { aimX, aimZ, activationScale, activationCountBonus };
  }

  afterCast(input: LegacyAfterCastInput) {
    if (!this.isLegacy(input.catalyst)) return;

    const p = this.port;
    const incoming = input.catalyst!;
    const conduct = 1 + input.conductivity * 0.16;

    if (incoming === 'relay' && input.previous.kills > 0) {
      const need = Math.max(1, 3 - Math.min(2, input.conductivity));
      if (input.previous.kills >= need) {
        p.castDerived(input.skill, input.runtime, input.slot, 0.82);
        p.noteReaction();
      }
    }

    if (incoming === 'conduit' && input.previous.state && input.currentHits.size) {
      for (const entityId of input.currentHits) {
        const entity = p.getAliveEntity(entityId);
        if (entity) p.applyState(entity, input.previous.state, 0.65 * conduct);
      }
      p.noteReaction();
      p.emitReaction('conduit', p.playerX(), p.playerZ());
    }

    if (incoming === 'echo_shard' && input.previous.damage > 0 && input.currentHits.size) {
      const targets = [...input.currentHits]
        .map((entityId) => p.getAliveEntity(entityId))
        .filter((entity): entity is Ent => !!entity);

      if (targets.length) {
        const centerX = targets.reduce((sum, entity) => sum + entity.x, 0) / targets.length;
        const centerZ = targets.reduce((sum, entity) => sum + entity.z, 0) / targets.length;
        const radius = 1.45;
        const perTarget = Math.min(
          160,
          (input.previous.damage * 0.48 * conduct) /
            Math.max(1, Math.min(4, input.previous.hitIds.length || 1))
        );

        for (const entity of p.entities()) {
          if (
            entity.hp > 0 &&
            Math.hypot(entity.x - centerX, entity.z - centerZ) <= radius + entity.radius
          )
            p.damageEcho(entity, perTarget, centerX, centerZ);
        }

        p.noteReaction();
        p.emitReaction('echo', centerX, centerZ, perTarget);
      }
    }

    if (incoming === 'backflow' && input.slot > 0 && input.currentHits.size >= 3) {
      this.feedbackCountBonus.set(input.slot - 1, 1);
      p.noteReaction();
    }

    if ((incoming === 'brand' || incoming === 'rime') && input.currentHits.size) {
      const state = incoming === 'brand' ? 'mark' : 'chill';
      for (const entityId of input.currentHits) {
        const entity = p.getAliveEntity(entityId);
        if (entity) p.applyState(entity, state, 0.9 * conduct);
      }
      p.noteReaction();
    }

    if (incoming === 'harvest' && input.currentKills > 0) {
      p.healPlayer(Math.min(20, input.currentKills * 4 * conduct));
      p.noteReaction();
    }

    if (incoming === 'vault' && input.currentHits.size >= 3) {
      const gain = Math.min(
        36,
        (input.currentHits.size * 3.2 + input.currentKills * 2.4) * conduct
      );
      p.grantBarrier(gain);
      p.noteReaction();
    }

    if (incoming === 'handoff' && p.skillAt(input.slot + 1)) {
      this.feedbackCountBonus.set(input.slot + 1, 2);
      p.noteReaction();
    }
  }

  afterContextPublished(input: LegacyAfterContextInput) {
    if (!this.isLegacy(input.catalyst)) return;

    const p = this.port;
    const incoming = input.catalyst!;
    const previousSkill = input.slot > 0 ? p.skillAt(input.slot - 1) : null;

    if (input.slot > 0 && previousSkill) {
      p.emitCatalystTriggered(
        incoming,
        input.slot - 1,
        input.slot,
        input.previous.x,
        input.previous.z,
        input.targetX,
        input.targetZ
      );
    }

    if (
      incoming === 'overflow' &&
      input.slot > 0 &&
      !this.overflowGuard &&
      input.previous.hitIds.length >= Math.max(5, 8 - input.conductivity) &&
      previousSkill
    ) {
      const runtime = p.skillRuntime(previousSkill);
      if (runtime) {
        this.overflowGuard = true;
        try {
          p.castDerived(previousSkill, runtime, input.slot - 1, 0.78);
          p.noteReaction();
        } finally {
          this.overflowGuard = false;
        }
      }
    }
  }

  diagnostics() {
    return {
      feedbackSlots: [...this.feedbackCountBonus.entries()].sort((a, b) => a[0] - b[0]),
      overflowGuard: this.overflowGuard
    };
  }
}
