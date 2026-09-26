import { catalysts, skills } from '../content/definitions.js';
import { items } from '../content/items.js';
import type { RefusedCard, RewardOffer } from './types.js';

const AXIS_GLYPH: Record<string, string> = {
  tempo: 'ТЕМП',
  multiplicity: 'ЧИСЛ',
  precision: 'ТОЧН',
  persistence: 'СРОК',
  conductivity: 'ПРОВ',
  mobility: 'ПОДВ'
};

const STAT_GLYPH: Record<string, string> = {
  hp: 'ЗДОР',
  pickup: 'СБОР',
  fortune: 'УДАЧ',
  armor: 'БРОН'
};

/**
 * Owns declined reward history and the dedicated refusal selection stream.
 *
 * The ledger intentionally returns live cards because elites attach heldBy ownership directly
 * to the same records. Presentation snapshots are responsible for copying them for consumers.
 */
export class RefusalLedger {
  private readonly cards: RefusedCard[] = [];
  private serial = 0;

  constructor(private readonly randomInt: (maxExclusive: number) => number) {}

  all() {
    return this.cards;
  }

  get serialValue() {
    return this.serial;
  }

  set serialValue(value: number) {
    this.serial = value;
  }

  replace(cards: RefusedCard[]) {
    this.cards.splice(0, this.cards.length, ...cards);
    this.serial = cards.reduce((max, card) => Math.max(max, card.serial), 0);
  }

  pickIndex(maxExclusive: number) {
    return this.randomInt(maxExclusive);
  }

  fromOffer(offer: RewardOffer): RefusedCard | null {
    const base = { serial: 0, title: offer.title, heldBy: 0 };

    if (offer.skill)
      return {
        ...base,
        kind: 'skill',
        icon: skills[offer.skill].icon,
        skill: offer.skill
      };

    if (offer.catalyst)
      return {
        ...base,
        kind: 'catalyst',
        icon: catalysts[offer.catalyst].shortName,
        catalyst: offer.catalyst
      };

    if (offer.item)
      return {
        ...base,
        kind: 'item',
        icon: items[offer.item].short,
        item: offer.item
      };

    if (offer.resonance)
      return {
        ...base,
        kind: 'axis',
        icon:
          AXIS_GLYPH[offer.resonance] ??
          offer.resonance.slice(0, 3).toUpperCase(),
        resonance: offer.resonance,
        amount: offer.amount ?? 1
      };

    if (offer.stat)
      return {
        ...base,
        kind: 'global',
        icon: STAT_GLYPH[offer.stat] ?? offer.stat.slice(0, 3).toUpperCase(),
        stat: offer.stat,
        amount: offer.amount ?? 0
      };

    return null;
  }

  concede(passed: RewardOffer[]) {
    const cards = passed
      .map((offer) => this.fromOffer(offer))
      .filter((card): card is RefusedCard => !!card);

    if (!cards.length) return null;

    // Preserve the original index semantics exactly: the UI marks an offer index, and the
    // historical implementation indexed the filtered card list with that same position.
    const wanted = passed.findIndex((offer) => offer.marked);
    const card =
      wanted >= 0 && cards[wanted]
        ? cards[wanted]
        : cards[this.randomInt(cards.length)];

    card.serial = ++this.serial;
    this.cards.push(card);
    return card;
  }
}
