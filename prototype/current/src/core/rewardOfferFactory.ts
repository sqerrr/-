import {
  catalysts,
  doctrineOrder,
  doctrines,
  mutationDef,
  rarityMultiplier,
  rarityOrder,
  resonance,
  resonanceOrder,
  skills
} from '../content/definitions.js';
import type {
  CatalystId,
  DoctrineId,
  MutationId,
  Rarity,
  ResonanceId,
  RewardOffer,
  SkillId
} from './types.js';

export interface RewardOfferFactoryPort {
  randomInt(maxExclusive: number): number;
  randomFloat(): number;
  nextU32(): number;
  fortune(): number;
  resonanceLevel(id: ResonanceId): number;
  doctrineLevel(id: DoctrineId): number;
  slots(): readonly (SkillId | null)[];
  catalystCompatibleEdges(id: CatalystId): number[];
}

/**
 * Builds player-facing reward cards.
 *
 * Reward selection policy stays with progression. This factory owns only the concrete card model
 * and its concise Russian copy, so gameplay orchestration no longer formats presentation text.
 */
export class RewardOfferFactory {
  constructor(private readonly port: RewardOfferFactoryPort) {}

  resonance(id?: ResonanceId): RewardOffer {
    const rid =
        id ?? resonanceOrder[this.port.randomInt(resonanceOrder.length)],
      definition = resonance[rid],
      before = this.port.resonanceLevel(rid),
      after = before + 1;

    return {
      id: `axis:${rid}:${this.port.nextU32()}`,
      kind: 'resonance',
      title: definition.name,
      subtitle: `УСИЛЕНИЕ ЯДРА ${before} → ${after}`,
      description: definition.description,
      resonance: rid,
      stat: rid,
      amount: 1,
      before: String(before),
      after: String(after)
    };
  }

  global(): RewardOffer {
    const stats = ['hp', 'pickup', 'fortune', 'armor'] as const;
    const stat = stats[this.port.randomInt(stats.length)];
    const rarity = this.rollRarity();
    const multiplier = rarityMultiplier[rarity];

    if (stat === 'hp')
      return {
        id: `g:h:${this.port.nextU32()}`,
        kind: 'global',
        title: 'Закалка',
        subtitle: `+${Math.round(18 * multiplier)} к максимуму здоровья`,
        description: 'Универсальная выживаемость; не привязана к конкретному феномену.',
        stat,
        amount: 18 * multiplier,
        rarity
      };

    if (stat === 'pickup')
      return {
        id: `g:pick:${this.port.nextU32()}`,
        kind: 'global',
        title: 'Притяжение осколков',
        subtitle: `+${Math.round(15 * multiplier)}% радиуса сбора`,
        description: 'Опыт и подбираемые объекты раньше начинают лететь к игроку.',
        stat,
        amount: 0.15 * multiplier,
        rarity
      };

    if (stat === 'fortune')
      return {
        id: `g:f:${this.port.nextU32()}`,
        kind: 'global',
        title: 'Удача',
        subtitle: `+${Math.round(8 * multiplier)}% к удаче`,
        description: 'Редкие находки выпадают чаще.',
        stat,
        amount: 0.08 * multiplier,
        rarity
      };

    return {
      id: `g:a:${this.port.nextU32()}`,
      kind: 'global',
      title: 'Архивная броня',
      subtitle: `+${Math.round(10 * multiplier)} брони`,
      description:
        'Снижает входящий урон; каждый следующий пункт брони даёт чуть меньший прирост защиты.',
      stat: 'armor',
      amount: 10 * multiplier,
      rarity
    };
  }

  catalystAdd(id: CatalystId): RewardOffer {
    const slots = this.port.slots();
    const examples = this.port
      .catalystCompatibleEdges(id)
      .slice(0, 2)
      .map((edge) => {
        const left = slots[edge]!;
        const right = slots[edge + 1]!;
        return `${skills[left].shortName} → ${skills[right].shortName}`;
      });

    return {
      id: `addcat:${id}:${this.port.nextU32()}`,
      kind: 'catalyst_add',
      title: catalysts[id].name,
      subtitle: 'КАТАЛИЗАТОР · связь феноменов',
      description:
        catalysts[id].desc +
        (examples.length
          ? ` Сейчас подходит: ${examples.join(' · ')}.`
          : ' Поставьте его между совместимой парой феноменов.'),
      catalyst: id
    };
  }

  doctrine(id?: DoctrineId): RewardOffer {
    const did = id ?? doctrineOrder[this.port.randomInt(doctrineOrder.length)];
    const definition = doctrines[did];
    const before = this.port.doctrineLevel(did);
    const after = before + 1;

    return {
      id: `doctrine:${did}:${this.port.nextU32()}`,
      kind: 'doctrine',
      title: definition.name,
      subtitle: `СПЕЦИАЛИЗАЦИЯ ${before} → ${after}`,
      description: definition.description,
      doctrine: did,
      amount: 1,
      before: String(before),
      after: String(after)
    };
  }

  skillAdd(id: SkillId): RewardOffer {
    return {
      id: `discover:${id}:${this.port.nextU32()}`,
      kind: 'skill_add',
      title: skills[id].name,
      subtitle: 'НАХОДКА · новый феномен',
      description:
        `${skills[id].description} Сильная сторона: ${skills[id].identity ?? '—'} Слабость: ${skills[id].weakness ?? '—'}`,
      skill: id
    };
  }

  skillSwap(id: SkillId): RewardOffer {
    const slots = this.port.slots();
    const slot = this.port.randomInt(slots.length);
    const leaving = slots[slot];

    return {
      id: `swap:${id}:${this.port.nextU32()}`,
      kind: 'skill_swap',
      title: skills[id].name,
      subtitle: `ЗАМЕНА · вместо «${leaving ? skills[leaving].name : '—'}»`,
      description: `${skills[id].description} Снятый феномен уходит в резерв, а не пропадает.`,
      skill: id,
      swapSlot: slot
    };
  }

  mutationTarget(
    id: SkillId,
    tier: 1 | 2 | 3,
    cores: number,
    parent: MutationId | null
  ): RewardOffer {
    return {
      id: `mut-target:${id}:${this.port.nextU32()}`,
      kind: 'mutation_target',
      title: skills[id].name,
      subtitle:
        tier === 3
          ? `АПОФЕОЗ · ЯДРА: ${cores}`
          : `${tier === 2 ? 'ПРОДОЛЖЕНИЕ' : 'МУТАЦИЯ'} · ЯДРА: ${cores}`,
      description:
        tier === 3 && parent
          ? `Третий уровень ветви «${mutationDef(id, parent).name}»: качественная трансформация, а не числовой бонус.`
          : tier === 2 && parent
            ? `Продолжить ветвь «${mutationDef(id, parent).name}». Корень останется активен.`
            : `Выбрать одну из трёх ветвей ${skills[id].name}.`,
      skill: id
    };
  }

  eliteCatalyst(id: CatalystId): RewardOffer {
    const offer = this.catalystAdd(id);
    offer.kind = 'elite';
    offer.subtitle = 'ТАЙНИК ЭЛИТЫ · новый катализатор';
    return offer;
  }

  eliteResonance(id: ResonanceId): RewardOffer {
    const offer = this.resonance(id);
    offer.kind = 'elite';
    offer.description += ' Усиливает всю сборку.';
    return offer;
  }

  eliteSkill(id: SkillId): RewardOffer {
    return {
      id: `elite-discover:${id}:${this.port.nextU32()}`,
      kind: 'elite',
      title: skills[id].name,
      subtitle: 'ТАЙНИК ЭЛИТЫ · новый феномен',
      description: `${skills[id].description} Сразу использует текущий уровень ядра.`,
      skill: id
    };
  }

  private rollRarity(min: Rarity = 'common') {
    const fortune = this.port.fortune();
    const weights = [
      52 / (1 + 0.5 * fortune),
      28,
      13 * (1 + 0.6 * fortune),
      5.5 * (1 + 1.1 * fortune),
      1.5 * (1 + 1.8 * fortune)
    ];
    const minIndex = rarityOrder.indexOf(min);

    for (let index = 0; index < minIndex; index++) weights[index] = 0;

    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = this.port.randomFloat() * total;

    for (let index = 0; index < weights.length; index++) {
      roll -= weights[index];
      if (roll <= 0) return rarityOrder[index];
    }

    return rarityOrder[4];
  }
}

