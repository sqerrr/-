import type { Poi } from './state.js';
import type { GameEvent } from './types.js';

export interface PoiSystemPort {
  tick(): number;
  bossSpawned(): boolean;
  playerX(): number;
  playerZ(): number;
  maxHp(): number;
  hasChoice(): boolean;
  hasUnownedSkills(): boolean;

  emit(event: GameEvent): void;
  healPlayer(amount: number): void;
  grantBarrier(amount: number): void;
  openPhenomenonDiscovery(): void;
  openCatalystDiscovery(): void;
  openResonanceChoice(): void;
}

/**
 * Owns authored world POIs and their dormant -> guarded -> cleared lifecycle.
 *
 * Reward construction remains with progression systems. This owner decides when a POI is
 * discovered/completed and which reward channel its kind routes into.
 */
export class PoiSystem {
  static readonly ACTIVATION_RADIUS = 3.0;

  private points: Poi[] = [];

  constructor(private readonly port: PoiSystemPort) {}

  get all(): Poi[] {
    return this.points;
  }

  replace(points: Poi[]) {
    this.points = points;
  }

  initialize() {
    // Build sources stay distributed around the opening so a run has several visible routes
    // to an early build decision. Keep these authored coordinates stable for seeded/world tests.
    this.points = [
      { id: 1, kind: 'phenomenon', x: 14, z: -7, state: 'dormant', guardianId: 0 },
      { id: 2, kind: 'catalyst', x: -19, z: 9, state: 'dormant', guardianId: 0 },
      { id: 3, kind: 'resonance', x: -34, z: -23, state: 'dormant', guardianId: 0 },
      { id: 4, kind: 'vital', x: 2, z: 29, state: 'dormant', guardianId: 0 },
      { id: 5, kind: 'phenomenon', x: 34, z: 21, state: 'dormant', guardianId: 0 },
      { id: 6, kind: 'catalyst', x: 35, z: -23, state: 'dormant', guardianId: 0 },
      { id: 7, kind: 'phenomenon', x: -9, z: 15, state: 'dormant', guardianId: 0 },
      { id: 8, kind: 'vital', x: -23, z: -14, state: 'dormant', guardianId: 0 }
    ];
  }

  update() {
    const p = this.port;
    if (p.bossSpawned()) return;

    const px = p.playerX();
    const pz = p.playerZ();

    for (const poi of this.points) {
      if (poi.state !== 'dormant') continue;
      if (Math.hypot(px - poi.x, pz - poi.z) > PoiSystem.ACTIVATION_RADIUS) continue;

      poi.state = 'guarded';
      poi.guardianId = 0;
      p.emit({
        type: 'PoiAwakened',
        tick: p.tick(),
        poi: poi.id,
        kind: poi.kind,
        x: poi.x,
        z: poi.z,
        guardian: 0
      });

      // Current game semantics complete an awakened POI immediately. Keep that ordering here;
      // introducing actual guardian-gated completion is a gameplay change, not a refactor.
      this.complete(poi.id);
    }
  }

  complete(id: number) {
    const p = this.port;
    const poi = this.points.find((candidate) => candidate.id === id);
    if (!poi || poi.state === 'cleared') return false;

    poi.state = 'cleared';
    poi.guardianId = 0;
    p.emit({
      type: 'PoiCleared',
      tick: p.tick(),
      poi: poi.id,
      kind: poi.kind,
      x: poi.x,
      z: poi.z
    });

    if (poi.kind === 'vital') {
      p.healPlayer(Math.max(45, p.maxHp() * 0.42));
      p.grantBarrier(20);
      return true;
    }

    // Clearing remains world-state even if another choice modal is already open.
    if (p.hasChoice()) return true;

    if (poi.kind === 'phenomenon') {
      if (p.hasUnownedSkills()) p.openPhenomenonDiscovery();
      else p.openResonanceChoice();
      return true;
    }

    if (poi.kind === 'catalyst') {
      p.openCatalystDiscovery();
      return true;
    }

    p.openResonanceChoice();
    return true;
  }

  get(id: number) {
    return this.points.find((poi) => poi.id === id);
  }
}
