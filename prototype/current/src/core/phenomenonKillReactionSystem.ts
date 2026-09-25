import type { Ent } from './state.js';
import type { MutationId, SkillId } from './types.js';

export interface PhenomenonKillReactionPort {
  entities(): readonly Ent[];
  globalPower(): number;
  hasMutation(skill: SkillId, mutation: MutationId): boolean;
  damage(
    target: Ent,
    amount: number,
    source: string,
    sourceX: number,
    sourceZ: number
  ): void;
}

/**
 * Phenomenon-specific reactions to a resolved kill.
 *
 * Generic damage resolution should only decide whether a target died. Any authored behavior
 * caused by a particular Phenomenon belongs here, so adding future kill reactions does not
 * turn Simulation.damage back into a switchboard of skill identities.
 */
export class PhenomenonKillReactionSystem {
  constructor(private readonly port: PhenomenonKillReactionPort) {}

  onKill(entity: Ent, source: string) {
    if (
      source !== 'ember_lance' ||
      !this.port.hasMutation('ember_lance', 'ember_backdraft')
    ) return;

    for (const other of this.port.entities()) {
      if (
        other === entity ||
        other.hp <= 0 ||
        Math.hypot(other.x - entity.x, other.z - entity.z) >= 2.3
      ) continue;

      const dx = entity.x - other.x;
      const dz = entity.z - other.z;
      const distance = Math.hypot(dx, dz) || 1;
      other.x += (dx / distance) * 0.45;
      other.z += (dz / distance) * 0.45;

      this.port.damage(
        other,
        18 * (1 + this.port.globalPower()),
        'backdraft',
        entity.x,
        entity.z
      );
    }
  }
}
