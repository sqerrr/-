import { Simulation } from '../core/simulation.js';
import type {
  EliteAffix,
  EliteRarity,
  EnemyKind,
  RefusedCard,
  SkillId,
  SkillRuntime
} from '../core/types.js';
import type {
  CastSource,
  Construct,
  EliteEchoState,
  Ent,
  Field,
  Obstacle,
  Projectile,
  Relic
} from '../core/state.js';

type NormalEnemyKind = Exclude<EnemyKind, 'elite' | 'hero'>;

/**
 * One explicit unsafe boundary for regression/scenario tooling.
 *
 * Production code keeps Simulation internals private. Tests no longer scatter unsafe casts
 * across dozens of files; an internal rename breaks this adapter once, while scenario intent
 * stays typed and readable.
 */
interface SimulationInternals {
  ents: Ent[];
  fields: Field[];
  constructs: Construct[];
  projectiles: Projectile[];
  obstacles: Obstacle[];
  relics: Relic[];
  skillsRuntime: Map<SkillId, SkillRuntime>;
  eliteEchoSystem: { get(entityId: number): EliteEchoState | undefined };
  playerVX: number;
  playerVZ: number;
  spawnElite(opening?: boolean): void;
  spawnEnemyAt(kind: NormalEnemyKind, x: number, z: number, buffedFor?: number, cloneParent?: number): Ent | undefined;
  spawnProjectile(projectile: Omit<Projectile, 'id' | 'guarded'>): number;
  updateProjectiles(): void;
  newSkill(id: SkillId): SkillRuntime;
  activateSlot(slot: number): void;
  dispatchSkill(id: SkillId, runtime: SkillRuntime, slot: number, source: CastSource): void;
  heroSource(): CastSource;
  flushPhysicalEvents(): void;
  updateEliteAI(entity: Ent, speed: number, distance: number, nx: number, nz: number): void;
  startEliteEcho(entity: Ent, card: RefusedCard): void;
  updateEliteEchoes(): void;
  takeRelic(relic: Relic): void;
  giveEliteRelic(entity: Ent, relic: Relic): void;
  blocked(x: number, z: number, radius: number): boolean;
  buildObstacleGrid(): void;
  rollEliteAffix(rarity: EliteRarity): EliteAffix;
}

export class SimulationHarness {
  private readonly internals: SimulationInternals;

  constructor(readonly sim: Simulation) {
    this.internals = sim as unknown as SimulationInternals;
  }

  static create(config: ConstructorParameters<typeof Simulation>[0]) {
    return new SimulationHarness(new Simulation(config));
  }

  get entities() {
    return this.internals.ents;
  }

  set entities(value: Ent[]) {
    this.internals.ents = value;
  }

  get fields() {
    return this.internals.fields;
  }

  get constructs() {
    return this.internals.constructs;
  }

  get projectiles() {
    return this.internals.projectiles;
  }

  get obstacles() {
    return this.internals.obstacles;
  }

  set obstacles(value: Obstacle[]) {
    this.internals.obstacles = value;
    this.internals.buildObstacleGrid();
  }

  get relics() {
    return this.internals.relics;
  }

  spawnElite(opening = false) {
    this.internals.spawnElite(opening);
    return this.entities.find((entity) => entity.kind === 'elite');
  }

  spawnEnemyAt(kind: NormalEnemyKind, x: number, z: number, buffedFor = 0, cloneParent = 0) {
    return this.internals.spawnEnemyAt(kind, x, z, buffedFor, cloneParent);
  }

  spawnProjectile(projectile: Omit<Projectile, 'id' | 'guarded'>) {
    return this.internals.spawnProjectile(projectile);
  }

  updateProjectiles(ticks = 1) {
    for (let i = 0; i < ticks; i++) this.internals.updateProjectiles();
  }

  skill(id: SkillId) {
    return this.internals.skillsRuntime.get(id);
  }

  ensureSkill(id: SkillId) {
    let runtime = this.skill(id);
    if (!runtime) {
      runtime = this.internals.newSkill(id);
      this.internals.skillsRuntime.set(id, runtime);
    }
    return runtime;
  }

  activateSlot(slot: number) {
    this.internals.activateSlot(slot);
  }

  castSkill(id: SkillId, runtime: SkillRuntime, slot: number, source: CastSource) {
    this.internals.dispatchSkill(id, runtime, slot, source);
  }

  heroSource() {
    return this.internals.heroSource();
  }

  flushPhysicalEvents() {
    this.internals.flushPhysicalEvents();
  }

  clearEvents() {
    this.sim.events.length = 0;
  }

  setPlayerPosition(x: number, z: number) {
    this.sim.px = x;
    this.sim.pz = z;
  }

  setPlayerVelocity(x: number, z: number) {
    this.internals.playerVX = x;
    this.internals.playerVZ = z;
  }

  setTick(tick: number) {
    this.sim.tick = tick;
  }

  setTime(seconds: number) {
    this.sim.tick = Math.ceil(seconds * this.sim.hz);
  }

  updateEliteAI(entity: Ent, speed: number, distance: number, nx: number, nz: number) {
    this.internals.updateEliteAI(entity, speed, distance, nx, nz);
  }

  startEliteEcho(entity: Ent, card: RefusedCard) {
    this.internals.startEliteEcho(entity, card);
  }

  eliteEcho(entityId: number) {
    return this.internals.eliteEchoSystem.get(entityId);
  }

  updateEliteEchoes() {
    this.internals.updateEliteEchoes();
  }

  takeRelic(relic: Relic) {
    this.internals.takeRelic(relic);
  }

  giveEliteRelic(entity: Ent, relic: Relic) {
    this.internals.giveEliteRelic(entity, relic);
  }

  blocked(x: number, z: number, radius: number) {
    return this.internals.blocked(x, z, radius);
  }

  rollEliteAffix(rarity: EliteRarity) {
    return this.internals.rollEliteAffix(rarity);
  }
}
