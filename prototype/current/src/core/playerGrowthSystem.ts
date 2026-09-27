import { items } from '../content/items.js';
import type {
  DoctrineId,
  DoctrineRuntime,
  ItemId,
  ResonanceId,
  ResonanceRuntime
} from './types.js';

export interface PlayerGrowthPort {
  armor(): number;
  setArmor(value: number): void;
  maxHp(): number;
  setMaxHp(value: number): void;
  playerHp(): number;
  setPlayerHp(value: number): void;
  moveSpeed(): number;
  setMoveSpeed(value: number): void;
  tempo(): number;
  setTempo(value: number): void;
  pickupRadius(): number;
  setPickupRadius(value: number): void;
  fortune(): number;
  setFortune(value: number): void;
  globalPower(): number;
  setGlobalPower(value: number): void;
  resonance(): ResonanceRuntime;
  doctrines(): DoctrineRuntime;
  healPlayer(amount: number): void;
  grantBarrier(amount: number): void;
}

/**
 * Owns persistent player-growth effects after a reward has been selected.
 *
 * ChoiceRuntime owns the choice window and ProgressionOfferSystem owns selection policy.
 * This system owns the mechanical application of relics, Resonance, Doctrines and generic
 * run upgrades, including all item-derived combat multipliers.
 */
export class PlayerGrowthSystem {
  heldItems: ItemId[] = [];

  itemDamageMul = 1;
  itemCrit = 0;
  itemSiphon = 0;
  itemEliteDamageMul = 1;
  itemDamageTakenMul = 1;
  itemRefusalDamageMul = 1;
  itemBarrierOnEliteKill = 0;
  itemXpMul = 1;
  itemCoreBonus = 0;
  itemRelicRateMul = 1;
  dashCooldownMul = 1;
  dashIFrameMul = 1;

  constructor(private readonly port: PlayerGrowthPort) {}

  applyItem(id: ItemId) {
    this.heldItems.push(id);
    const effect = items[id].effect;

    if (effect.kind === 'armor') {
      this.port.setArmor(this.port.armor() + effect.amount);
    } else if (effect.kind === 'maxHp') {
      this.port.setMaxHp(this.port.maxHp() + effect.amount);
      this.port.healPlayer(effect.amount);
    } else if (effect.kind === 'barrierOnEliteKill') {
      this.itemBarrierOnEliteKill += effect.amount;
    } else if (effect.kind === 'damageTakenMul') {
      this.itemDamageTakenMul *= effect.amount;
    } else if (effect.kind === 'damageMul') {
      this.itemDamageMul *= effect.amount;
    } else if (effect.kind === 'crit') {
      this.itemCrit += effect.amount;
    } else if (effect.kind === 'siphon') {
      this.itemSiphon += effect.amount;
    } else if (effect.kind === 'eliteDamageMul') {
      this.itemEliteDamageMul *= effect.amount;
    } else if (effect.kind === 'moveSpeedMul') {
      this.port.setMoveSpeed(this.port.moveSpeed() * effect.amount);
    } else if (effect.kind === 'tempo') {
      this.port.setTempo(this.port.tempo() + effect.amount);
    } else if (effect.kind === 'dashCooldownMul') {
      this.dashCooldownMul *= effect.amount;
    } else if (effect.kind === 'dashIFrameMul') {
      this.dashIFrameMul *= effect.amount;
    } else if (effect.kind === 'pickupRadiusMul') {
      this.port.setPickupRadius(this.port.pickupRadius() * effect.amount);
    } else if (effect.kind === 'fortune') {
      this.port.setFortune(this.port.fortune() + effect.amount);
    } else if (effect.kind === 'xpMul') {
      this.itemXpMul *= effect.amount;
    } else if (effect.kind === 'relicRateMul') {
      this.itemRelicRateMul *= effect.amount;
    } else if (effect.kind === 'coreBonus') {
      this.itemCoreBonus += effect.amount;
    } else if (effect.kind === 'refusalDamageMul') {
      this.itemRefusalDamageMul *= effect.amount;
    }
  }

  applyCoreAxis(axis: ResonanceId, amount = 1) {
    this.port.resonance()[axis] += amount;
    if (axis === 'mobility')
      this.port.setMoveSpeed(this.port.moveSpeed() * (1 + 0.045 * amount));
  }

  applyDoctrine(id: DoctrineId, amount: number) {
    this.port.doctrines()[id] += amount;

    if (id === 'mobility') {
      this.port.setMoveSpeed(
        this.port.moveSpeed() * Math.pow(1.055, amount)
      );
      this.dashCooldownMul *= Math.pow(0.96, amount);
    }

    if (id === 'guard') {
      this.port.setArmor(this.port.armor() + 4 * amount);
      this.port.grantBarrier(5 * amount);
    }
  }

  applyGlobal(stat?: string, amount = 0) {
    if (stat === 'hp') {
      const maxHp = this.port.maxHp() + amount;
      this.port.setMaxHp(maxHp);
      this.port.setPlayerHp(Math.min(maxHp, this.port.playerHp() + amount));
    } else if (stat === 'move') {
      this.port.setMoveSpeed(this.port.moveSpeed() * (1 + amount));
    } else if (stat === 'tempo') {
      this.port.setTempo(this.port.tempo() + amount);
    } else if (stat === 'globalPower') {
      this.port.setGlobalPower(this.port.globalPower() + amount);
    } else if (stat === 'pickup') {
      this.port.setPickupRadius(this.port.pickupRadius() * (1 + amount));
    } else if (stat === 'fortune') {
      this.port.setFortune(this.port.fortune() + amount);
    } else if (stat === 'armor') {
      this.port.setArmor(this.port.armor() + amount);
    }
  }
}
