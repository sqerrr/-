import type {
  DamageSourceId,
  EliteActionId,
  EliteAffix,
  EliteChassis
} from '../core/types.js';

type ChassisUi = {
  name: string;
  role: string;
  glyph: string;
  shortRule: string;
  tint: string;
  overlayAlpha: number;
  deathHint: string;
};

type AffixUi = {
  name: string;
  role: string;
  glyph: string;
  shortRule: string;
  tint: string;
  overlayAlpha: number;
};

type ActionUi = { label: string; hint: string };
type DamageUi = { name: string; hint: string };

export const eliteChassisUi: Record<EliteChassis, ChassisUi> = {
  marshal: {
    name: 'Маршал',
    role: 'давит строем и ускоряет союзников',
    glyph: '⚑',
    shortRule: 'КОМАНДУЕТ СТАЕЙ',
    tint: '#ffc36a',
    overlayAlpha: 0.92,
    deathHint: 'Не задерживайся рядом со стаей, которую Маршал усиливает.'
  },
  hunter: {
    name: 'Хищник',
    role: 'предсказывает движение и делает перехватывающий рывок',
    glyph: '➤',
    shortRule: 'ПЕРЕХВАТЫВАЕТ ТРАЕКТОРИЮ',
    tint: '#ff79b8',
    overlayAlpha: 0.94,
    deathHint: 'Меняй направление после фиксации траектории и уходи с линии рывка.'
  },
  bulwark: {
    name: 'Призма',
    role: 'запоминает источник: повтор защищает её, смена источника вскрывает',
    glyph: '▣',
    shortRule: 'МЕНЯЙ ИСТОЧНИК УРОНА',
    tint: '#79d6ff',
    overlayAlpha: 0.94,
    deathHint: 'Обходи фронт щита и используй окно после его удара.'
  },
  architect: {
    name: 'Завеса',
    role: 'создаёт туман, в котором дальний автоматический захват теряет цель',
    glyph: '⌗',
    shortRule: 'СТАВИТ ЗАВЕСЫ',
    tint: '#9eeaff',
    overlayAlpha: 0.92,
    deathHint: 'Не стой в точке смещения и выходи из завесы для дальнего захвата.'
  },
  harvester: {
    name: 'Нуль-ткач',
    role: 'поглощает срабатывания катализаторов; прямые такты разбивают заряд',
    glyph: '⌒',
    shortRule: 'ПОГЛОЩАЕТ ПРОИЗВОДНЫЕ',
    tint: '#74ead3',
    overlayAlpha: 0.92,
    deathHint: 'Смотри на сектор Жатвы и выходи из него до срабатывания.'
  },
  shepherd: {
    name: 'Метаморф',
    role: 'эволюционирует от реальной сигнатуры полученного урона',
    glyph: 'Ψ',
    shortRule: 'ПЕРЕСТРАИВАЕТ СТАЮ',
    tint: '#9bea7d',
    overlayAlpha: 0.92,
    deathHint: 'Разрывай дистанцию со стаей перед командным импульсом.'
  },
  broodmaker: {
    name: 'Репликатор',
    role: 'частые попадания порождают копии; убийство копии ранит оригинал',
    glyph: '∴',
    shortRule: 'ПОРОЖДАЕТ КОПИИ',
    tint: '#ed82cb',
    overlayAlpha: 0.92,
    deathHint: 'Не оставайся в круге выброса и убивай копии, чтобы ранить оригинал.'
  },
  archivist: {
    name: 'Архивист',
    role: 'копирует боевые роли и меняет рисунок боя',
    glyph: '▥',
    shortRule: 'КОПИРУЕТ РОЛИ',
    tint: '#8eb5ff',
    overlayAlpha: 0.92,
    deathHint: 'Следи, какую роль Архивист скопировал, и меняй позицию под неё.'
  },
  warden: {
    name: 'Хранитель',
    role: 'финальный босс: заранее показывает взмах, разлом и таран',
    glyph: '⬢',
    shortRule: 'ПАТТЕРНЫ ФИНАЛА',
    tint: '#f4e7c8',
    overlayAlpha: 0.96,
    deathHint: 'Красная геометрия показывает следующую атаку Хранителя.'
  }
};

export const eliteAffixUi: Record<EliteAffix, AffixUi> = {
  none: { name: 'Без аффикса', role: '', glyph: '', shortRule: '', tint: '#ffffff', overlayAlpha: 0 },
  swift: { name: 'Быстрый', role: 'движется быстрее', glyph: '≡', shortRule: 'БЫСТРЕЕ', tint: '#eef5ff', overlayAlpha: 0.92 },
  dense: { name: 'Плотный', role: 'тяжелее сдвигается', glyph: '■', shortRule: 'ТЯЖЁЛЫЙ', tint: '#aaa4b1', overlayAlpha: 0.92 },
  volatile: { name: 'Взрывной', role: 'после смерти оставляет красную зону взрыва', glyph: '▲', shortRule: 'ВЗРЫВ ПОСЛЕ СМЕРТИ', tint: '#ffad5c', overlayAlpha: 0.96 },
  regenerating: { name: 'Регенерирующий', role: 'восстанавливается, если несколько секунд не получать урон', glyph: '✚', shortRule: 'РЕГЕН БЕЗ УРОНА', tint: '#79ee9b', overlayAlpha: 0.96 },
  shielded: { name: 'Щитоносец', role: 'щит фиксирует направление перед рывком — обходи с фланга или ломай стойкость', glyph: '⬟', shortRule: 'ЩИТ ПО НАПРАВЛЕНИЮ', tint: '#78d8ff', overlayAlpha: 0.96 },
  vanguard: { name: 'Авангард', role: 'периодически ускоряет и направляет ближайшую стаю', glyph: '»', shortRule: 'ВЕДЁТ СТАЮ', tint: '#ffb15e', overlayAlpha: 0.96 },
  temporal: { name: 'Темпоральный', role: 'заранее отмечает точку скачка и бьёт после перемещения', glyph: '⌛', shortRule: 'СКАЧОК + УДАР', tint: '#b69aff', overlayAlpha: 0.96 },
  brood: { name: 'Роевой', role: 'периодически вызывает подкрепление', glyph: '∴', shortRule: 'ВЫЗЫВАЕТ СТАЮ', tint: '#f58abd', overlayAlpha: 0.96 },
  crowned: { name: 'Коронованный', role: 'чаще использует собственные механики', glyph: '♛', shortRule: 'ЧАЩЕ ИСПОЛЬЗУЕТ ПРИЁМЫ', tint: '#ffe477', overlayAlpha: 0.98 }
};

export const eliteActionUi: Record<EliteActionId, ActionUi> = {
  predator: { label: 'ПЕРЕХВАТ', hint: 'СМЕНИ ТРАЕКТОРИЮ' },
  predator_dash: { label: 'ПЕРЕХВАТ', hint: 'УЙДИ С ЛИНИИ РЫВКА' },
  veil: { label: 'СМЕЩЕНИЕ', hint: 'НЕ СТОЙ В ТОЧКЕ СМЕЩЕНИЯ' },
  replicate: { label: 'ВЫБРОС КОПИИ', hint: 'ВЫЙДИ ИЗ КРУГА' },
  prism: { label: 'ФРОНТАЛЬНЫЙ УДАР', hint: 'ЗАЙДИ ЗА ФРОНТ ЩИТА' },
  null: { label: 'ЖАТВА', hint: 'ВЫЙДИ ИЗ СЕКТОРА' },
  metamorph: { label: 'КОМАНДНЫЙ ИМПУЛЬС', hint: 'ОТОРВИСЬ ОТ СТАИ' }
};

export const damageSourceUi: Record<DamageSourceId, DamageUi> = {
  contact: {
    name: 'контакт с противником',
    hint: 'Не оставайся внутри стаи: держи проход для отхода и используй рывок для выхода из окружения.'
  },
  temporal_shift: {
    name: 'темпоральный скачок',
    hint: 'Метка показывает будущую точку удара. Смени траекторию до скачка.'
  },
  brood_pulse: { name: 'роевой импульс', hint: 'Уйди из отмеченного круга до импульса.' },
  prism_bash: {
    name: 'фронтальный удар Призмы',
    hint: 'Обойди фронт щита. После удара у Призмы есть окно уязвимости.'
  },
  null_harvest: { name: 'Жатва Нуль-ткача', hint: 'Выйди из сектора Жатвы до срабатывания.' },
  shepherd_pulse: { name: 'командный импульс Метаморфа', hint: 'Оторвись от стаи перед командным импульсом.' },
  warden_sweep: { name: 'секторный взмах Хранителя', hint: 'Выйди из красного сектора до взмаха.' },
  warden_rupture: { name: 'разлом Хранителя', hint: 'Уйди с красной линии до разлома.' }
};

const project = <K extends string, V, T>(src: Record<K, V>, pick: (value: V) => T) =>
  Object.fromEntries(Object.entries(src).map(([key, value]) => [key, pick(value as V)])) as Record<K, T>;

export const chassisName = project(eliteChassisUi, (x) => x.name);
export const chassisRole = project(eliteChassisUi, (x) => x.role);
export const chassisGlyph = project(eliteChassisUi, (x) => x.glyph);
export const chassisShortRule = project(eliteChassisUi, (x) => x.shortRule);
export const chassisUiTint = project(eliteChassisUi, (x) => x.tint);
export const chassisOverlayAlpha = project(eliteChassisUi, (x) => x.overlayAlpha);
export const chassisDeathHint = project(eliteChassisUi, (x) => x.deathHint);

export const affixName = project(eliteAffixUi, (x) => x.name);
export const affixRole = project(eliteAffixUi, (x) => x.role);
export const affixGlyph = project(eliteAffixUi, (x) => x.glyph);
export const affixShortRule = project(eliteAffixUi, (x) => x.shortRule);
export const affixUiTint = project(eliteAffixUi, (x) => x.tint);
export const affixOverlayAlpha = project(eliteAffixUi, (x) => x.overlayAlpha);

export const eliteActionLabel = project(eliteActionUi, (x) => x.label);
export const eliteActionHint = project(eliteActionUi, (x) => x.hint);
export const damageSourceName = project(damageSourceUi, (x) => x.name);
export const damageSourceHint = project(damageSourceUi, (x) => x.hint);
