import { resonanceOrder } from '../content/definitions.js';
import { fnv1a } from './hash.js';
import type {
  ActivationContext,
  ChoreographyCarrier,
  Ent,
  Poi
} from './state.js';
import type {
  CatalystId,
  CatalystRuntime,
  ItemId,
  Metrics,
  ResonanceRuntime,
  RunMode,
  SkillId,
  SkillRuntime
} from './types.js';

export const CANONICAL_SCHEMA_VERSION = 6;

export interface CanonicalStateInput {
  mode: RunMode;
  tick: number;
  rngState: number;

  player: {
    x: number;
    z: number;
    hp: number;
    maxHp: number;
    barrier: number;
    armor: number;
    dashUntil: number;
    dashIFramesUntil: number;
    dashReadyAt: number;
    level: number;
    xp: number;
    xpNeed: number;
  };

  chain: {
    beat: number;
    cycle: number;
    capacitorCharge: number;
    overflowCharge: number;
    aegisCharge: number;
    orbitChoreoUntil: number;
    orbitChoreoX: number;
    orbitChoreoZ: number;
    orbitChoreoCarrier: ChoreographyCarrier | null;
    context: ActivationContext;
  };

  growth: {
    tempo: number;
    globalPower: number;
    fortune: number;
    resonance: ResonanceRuntime;
  };

  economy: {
    eliteCore: number;
    rerolls: number;
    mutationRefusalToken: number | boolean;
  };

  boss: {
    spawned: boolean;
    defeated: boolean;
  };

  loadout: {
    slots: readonly (SkillId | null)[];
    skillReserve: readonly (SkillId | null)[];
    catalysts: readonly (CatalystId | null)[];
    catalystReserve: readonly (CatalystId | null)[];
  };

  pois: readonly Poi[];
  skills: Iterable<SkillRuntime>;
  catalysts: Iterable<CatalystRuntime>;
  entities: readonly Ent[];
  metrics: Metrics;

  relicCount: number;
  heldItems: readonly ItemId[];
  eliteLegacyItems: readonly ItemId[];
  eliteEvolutionHistory: readonly ItemId[];
}

type CanonicalAtom = number | string;
type CanonicalValue = CanonicalAtom | boolean | null | undefined;

/**
 * Stable deterministic run-state schema.
 *
 * This object owns only serialization order/normalization. It deliberately receives an explicit
 * grouped view instead of the whole Simulation so gameplay systems remain the owners of state.
 * Any layout change must bump CANONICAL_SCHEMA_VERSION.
 */
export class CanonicalStateSerializer {
  serialize(input: CanonicalStateInput): CanonicalAtom[] {
    const parts: CanonicalAtom[] = [];
    const put = (name: string, ...values: CanonicalValue[]) => {
      parts.push(name);
      for (const value of values)
        parts.push(
          value === null || value === undefined
            ? '-'
            : typeof value === 'boolean'
              ? (value ? 1 : 0)
              : value
        );
    };

    put('schema', CANONICAL_SCHEMA_VERSION);
    put('mode', input.mode);
    put('tick', input.tick);
    put('rng', input.rngState);

    const player = input.player;
    put('player.pos', player.x, player.z);
    put('player.hp', player.hp, player.maxHp);
    put('player.mitigation', player.barrier, player.armor);
    put('player.dash', player.dashUntil, player.dashIFramesUntil, player.dashReadyAt);
    put('player.xp', player.level, player.xp, player.xpNeed);

    const chain = input.chain;
    put('chain.beat', chain.beat, chain.cycle);
    put('chain.charges', chain.capacitorCharge, chain.overflowCharge, chain.aegisCharge);
    put(
      'chain.orbitChoreo',
      chain.orbitChoreoUntil,
      chain.orbitChoreoX,
      chain.orbitChoreoZ,
      chain.orbitChoreoCarrier?.kind ?? '-',
      chain.orbitChoreoCarrier && 'id' in chain.orbitChoreoCarrier
        ? chain.orbitChoreoCarrier.id
        : chain.orbitChoreoCarrier?.kind === 'orbit'
          ? chain.orbitChoreoCarrier.index
          : -1
    );
    put(
      'chain.context',
      chain.context.skill ?? '-',
      chain.context.x,
      chain.context.z,
      ...chain.context.hitIds
    );

    if (chain.context.trace) {
      const trace = chain.context.trace;
      put(
        'chain.trace',
        trace.skill,
        trace.origin.x,
        trace.origin.z,
        trace.aimX,
        trace.aimZ,
        trace.terminal?.x ?? '-',
        trace.terminal?.z ?? '-'
      );
      for (const point of trace.points) put('chain.trace.point', point.x, point.z);
      for (const point of trace.areaPoints) put('chain.trace.area', point.x, point.z);
      for (const path of trace.paths)
        put('chain.trace.path', ...path.flatMap((point) => [point.x, point.z]));
      for (const carrier of trace.carriers)
        put('chain.trace.carrier', carrier.kind, 'id' in carrier ? carrier.id : carrier.index);
      for (const point of trace.scheduled)
        put('chain.trace.scheduled', point.x, point.z);
    }

    const growth = input.growth;
    put('growth.tempo', growth.tempo);
    put('growth.power', growth.globalPower);
    put('growth.fortune', growth.fortune);
    put('growth.axes', ...resonanceOrder.map((id) => growth.resonance[id]));

    put('economy.eliteCore', input.economy.eliteCore);
    put('economy.rerolls', input.economy.rerolls);
    put('economy.mutationRefusal', input.economy.mutationRefusalToken);

    put('boss.spawned', input.boss.spawned);
    put('boss.defeated', input.boss.defeated);

    put('loadout.slots', ...input.loadout.slots.map((skill) => skill ?? '-'));
    put('loadout.skillReserve', ...input.loadout.skillReserve.map((skill) => skill ?? '-'));
    put('loadout.catalysts', ...input.loadout.catalysts.map((catalyst) => catalyst ?? '-'));
    put(
      'loadout.catalystReserve',
      ...input.loadout.catalystReserve.map((catalyst) => catalyst ?? '-')
    );

    for (const poi of input.pois)
      put('poi', poi.id, poi.kind, poi.state, poi.guardianId, poi.x, poi.z);

    for (const skill of [...input.skills].sort((a, b) => a.id.localeCompare(b.id)))
      put(
        'skill',
        skill.id,
        skill.level,
        skill.power,
        skill.coverage,
        skill.range,
        skill.duration,
        skill.crit,
        skill.eliteDamage,
        skill.count,
        skill.control,
        skill.statusPotency,
        skill.mutation,
        skill.mutationUpgrade,
        skill.mutationApotheosis
      );

    for (const catalyst of [...input.catalysts].sort((a, b) => a.id.localeCompare(b.id)))
      put('catalyst', catalyst.id);

    for (const entity of input.entities)
      put(
        'ent',
        entity.id,
        entity.kind,
        entity.x,
        entity.z,
        entity.hp,
        entity.chassis,
        entity.affix,
        entity.boss,
        entity.guardianPoi,
        entity.adaptStage,
        entity.adaptCooldown,
        entity.eliteAction ?? '-',
        entity.eliteActionUntil ?? 0,
        entity.bossPhase,
        entity.bossPattern,
        entity.affixTimer,
        entity.affixPulse,
        entity.markUntil,
        entity.igniteUntil,
        entity.chillUntil,
        entity.woundUntil,
        entity.toxinUntil,
        entity.displacedUntil,
        entity.embedded,
        entity.orderUntil,
        (entity.relicItems ?? []).join(','),
        (entity.evolutionItems ?? []).join(',')
      );

    const metrics = input.metrics;
    put('metrics.population', metrics.spawned, metrics.killed, metrics.maxEnemies);
    put('metrics.elites', metrics.eliteSpawned, metrics.eliteKilled);
    put('metrics.output', metrics.damage, metrics.reactions);
    put('metrics.progression', metrics.levels, metrics.mutations);
    put(
      'metrics.survival',
      metrics.damageTaken,
      metrics.healingReceived,
      metrics.barrierGenerated,
      metrics.healsPicked
    );

    put('relics', input.relicCount, input.heldItems.length, input.heldItems.join(','));
    put('eliteLegacyItems', input.eliteLegacyItems.join(','));
    put('eliteEvolutionHistory', input.eliteEvolutionHistory.join(','));

    return parts;
  }

  hash(input: CanonicalStateInput) {
    return fnv1a(this.serialize(input));
  }
}
