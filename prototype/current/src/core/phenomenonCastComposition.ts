import { PhenomenonCastSystem } from './phenomenonCastSystem.js';
import {
  StatefulPhenomenonCastSystem,
  type StatefulPhenomenonCastPort
} from './statefulPhenomenonCastSystem.js';
import type { CastSource } from './state.js';
import type { SkillId, SkillRuntime } from './types.js';

export type PhenomenonCastCompositionPort = StatefulPhenomenonCastPort;

/**
 * Composition boundary for authored Phenomenon casting.
 *
 * Both cast families consume the same explicit runtime port. The composition owns dispatch order:
 * compact/stateless geometry first, then stateful/persistent actors. Simulation therefore does not
 * need to know which concrete cast family owns a Phenomenon.
 */
export class PhenomenonCastComposition {
  private readonly stateless: PhenomenonCastSystem;
  private readonly stateful: StatefulPhenomenonCastSystem;

  constructor(port: PhenomenonCastCompositionPort) {
    this.stateless = new PhenomenonCastSystem(port);
    this.stateful = new StatefulPhenomenonCastSystem(port);
  }

  cast(id: SkillId, runtime: SkillRuntime, slot: number, source: CastSource) {
    if (this.stateless.cast(id, runtime, slot, source)) return true;
    return this.stateful.cast(id, runtime, slot, source);
  }
}
