import { items } from '../content/items.js';
import type {
  Construct,
  Ent,
  Field,
  Obstacle,
  Pickup,
  Poi,
  Projectile,
  Relic
} from './state.js';
import type {
  CatalystId,
  CatalystRuntime,
  DoctrineRuntime,
  ItemId,
  Metrics,
  RefusedCard,
  ResonanceRuntime,
  RewardOffer,
  RunMode,
  SkillId,
  SkillRuntime,
  Snapshot
} from './types.js';

type EchoView = {
  phase: 'tell' | 'active' | 'recovery';
  skill: SkillId;
};

export interface SnapshotBuilderInput {
  tick: number;
  time: number;
  runDuration: number;
  finished: boolean;
  mode: RunMode;

  player: Snapshot['player'];

  entities: readonly Ent[];
  refusalStore: readonly RefusedCard[];
  echoFor(entityId: number): EchoView | undefined;

  pickups: readonly Pickup[];
  relics: readonly Relic[];
  heldItems: readonly ItemId[];
  fields: readonly Field[];
  constructs: readonly Construct[];
  projectiles: readonly Projectile[];
  orbit: Snapshot['orbit'];

  world: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    pois: readonly Poi[];
    obstacles: readonly Obstacle[];
    bossSpawned: boolean;
    bossDefeated: boolean;
  };

  chain: {
    beat: number;
    cycle: number;
    tempo: number;
    slots: readonly (SkillId | null)[];
    catalysts: readonly (CatalystId | null)[];
    skillReserve: readonly (SkillId | null)[];
    catalystReserve: readonly (CatalystId | null)[];
    catalystRuntime: Iterable<CatalystRuntime>;
  };

  skills: Iterable<SkillRuntime>;
  resonance: ResonanceRuntime;
  doctrines: DoctrineRuntime;
  metrics: Metrics;

  eliteCore: number;
  mutationCores: number;
  rewardOffers: RewardOffer[] | null;
  refusals: readonly RefusedCard[];
  mutationOffer: Snapshot['mutationOffer'];
  rerolls: number;
  choiceSerial: number;
}

/**
 * Pure runtime -> presentation snapshot adapter.
 *
 * Simulation owns gameplay state and derived gameplay values. This builder owns cloning,
 * presentation-only projections and stable Snapshot shape, so render/UI concerns do not spread
 * back into the simulation root.
 */
export class SnapshotBuilder {
  build(input: SnapshotBuilderInput): Snapshot {
    const {
      tick,
      time,
      runDuration,
      finished,
      mode,
      player,
      entities
    } = input;

    return {
      tick,
      time,
      runDuration,
      finished,
      mode,
      player: { ...player },

      entities: entities.map((entity) => {
        // Resolve each repertoire once; the old snapshot path repeated the same lookup three times.
        const refused = entity.repertoire
          .map((serial) => input.refusalStore.find((card) => card.serial === serial))
          .filter((card): card is RefusedCard => !!card);
        const echo = input.echoFor(entity.id);

        return {
          id: entity.id,
          kind: entity.kind,
          x: entity.x,
          z: entity.z,
          hp: entity.hp,
          maxHp: entity.maxHp,
          radius: entity.radius,
          elite: entity.kind === 'elite',
          boss: entity.boss,
          guardianPoi: entity.guardianPoi,
          chassis: entity.chassis,
          affix: entity.affix,
          facingX: entity.facingX,
          facingZ: entity.facingZ,
          telegraph: entity.state === 'telegraph' ? Math.max(0, entity.stateTimer / 0.72) : 0,
          eliteAction: entity.eliteAction,
          eliteActionProgress:
            entity.eliteActionUntil && entity.eliteActionUntil > time
              ? Math.max(0, Math.min(1, (entity.eliteActionUntil - time) / 0.9))
              : 0,
          linkedTo: entity.linkedTo,
          revived: entity.revived,
          buffed: entity.buffUntil > time,
          shieldAngle: entity.shieldAngle,
          shieldState: entity.shieldState ?? 'guard',
          shieldStability: entity.shieldStability ?? 100,
          echoPhase: echo?.phase ?? 'none',
          echoSkill: echo?.skill,
          regenerating: entity.affix === 'regenerating' && time - entity.lastDamageAt > 3,
          orderX: entity.orderX,
          orderZ: entity.orderZ,
          orderActive: entity.orderUntil > time,
          squadTask:
            entity.squadUntil && entity.squadUntil > time
              ? (entity.squadTask ?? 'none')
              : 'none',
          adaptationStage: entity.adaptStage,
          eliteRarity: entity.rarity,
          refusalTitles: refused.map((card) => card.title),
          refusalKinds: refused.map((card) => card.kind as string),
          refusalIcons: refused.map((card) => card.icon).filter((icon) => !!icon),
          relicItems: [...(entity.relicItems ?? [])],
          evolutionItems: [...(entity.evolutionItems ?? [])],
          bossPhase: entity.bossPhase,
          bossPattern: entity.bossPattern,
          status: {
            marked: entity.markUntil > time,
            ignited: entity.igniteUntil > time,
            chilled: entity.chillUntil > time,
            frozen: (entity.frozenUntil ?? 0) > time,
            wounded: entity.woundUntil > time,
            exposed: entity.exposedUntil > time,
            embedded: entity.embedded,
            toxined: entity.toxinUntil > time
          }
        };
      }),

      pickups: input.pickups.map((pickup) => ({ ...pickup })),

      relics: input.relics.map((relic) => ({
        id: relic.id,
        x: relic.x,
        z: relic.z,
        item: relic.item,
        category: items[relic.item].category,
        contested: entities.some(
          (entity) =>
            entity.kind === 'elite' &&
            !entity.boss &&
            Math.hypot(entity.x - relic.x, entity.z - relic.z) < 9
        )
      })),

      heldItems: [...input.heldItems],

      fields: input.fields.map((field) => ({
        id: field.id,
        x: field.x,
        z: field.z,
        radius: field.radius,
        ttl: field.ttl,
        kind: field.kind,
        faction: field.faction ?? 'hero',
        source: field.source ?? field.kind,
        mutation: field.mutation ?? null,
        behavior: field.behavior
      })),

      constructs: input.constructs.map((construct) => ({
        id: construct.id,
        x: construct.x,
        z: construct.z,
        ttl: construct.ttl,
        range: construct.range,
        kind: 'sentry',
        faction: construct.faction,
        mutation: construct.mutation,
        mutationUpgrade: construct.mutationUpgrade,
        mutationApotheosis: construct.mutationApotheosis ?? null
      })),

      projectiles: input.projectiles.map((projectile) => ({
        id: projectile.id,
        x: projectile.x,
        z: projectile.z,
        radius: projectile.radius,
        faction: projectile.faction,
        source: projectile.source,
        guarded: projectile.guarded,
        behavior: projectile.behavior ?? 'normal',
        phase: projectile.phase ?? 0,
        mutation: projectile.mutation,
        apotheosis: projectile.apotheosis ?? null,
        carousel: !!projectile.carousel
      })),

      orbit: { ...input.orbit },

      world: {
        minX: input.world.minX,
        maxX: input.world.maxX,
        minZ: input.world.minZ,
        maxZ: input.world.maxZ,
        pois: input.world.pois.map((poi) => ({ ...poi })),
        obstacles: input.world.obstacles.map((obstacle) => ({ ...obstacle })),
        bossSpawned: input.world.bossSpawned,
        bossDefeated: input.world.bossDefeated
      },

      chain: {
        beat: input.chain.beat,
        cycle: input.chain.cycle,
        tempo: input.chain.tempo,
        slots: [...input.chain.slots],
        catalysts: [...input.chain.catalysts],
        skillReserve: [...input.chain.skillReserve],
        catalystReserve: [...input.chain.catalystReserve],
        catalystRuntime: [...input.chain.catalystRuntime].map((runtime) => ({ ...runtime }))
      },

      skills: [...input.skills].map((skill) => ({ ...skill })),
      resonance: { ...input.resonance },
      doctrines: { ...input.doctrines },
      metrics: { ...input.metrics },
      eliteCore: input.eliteCore,
      mutationCores: input.mutationCores,
      rewardOffers: input.rewardOffers
        ? input.rewardOffers.map((offer) => ({ ...offer }))
        : null,
      refusals: input.refusals.map((card) => ({ ...card })),
      mutationOffer: input.mutationOffer
        ? {
            skill: input.mutationOffer.skill,
            choices: [...input.mutationOffer.choices],
            refusalAvailable: input.mutationOffer.refusalAvailable,
            tier: input.mutationOffer.tier
          }
        : null,
      rerolls: input.rerolls,
      choiceSerial: input.choiceSerial
    };
  }
}
