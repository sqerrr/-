/**
 * The five categories owner decision D35 asked for. The category is not decoration: it decides
 * what the item does to an elite that reaches it first, because D14 makes relics a source both
 * sides draw from and D15 requires every gain the hero can make to have a counterpart.
 *
 * No category touches elite durability. That is deliberate and it cost a rollback to learn:
 * fight length under D49 is calibrated through exactly that number, so a second multiplier on
 * top of it collapses the run. The counterparts work on reach, bite, cadence and company.
 */
export const itemCategoryName = {
    guard: 'Защита',
    edge: 'Остриё',
    pace: 'Темп',
    finding: 'Находки',
    elite: 'Охота'
};
export const itemCategoryRival = {
    guard: 'Касание элиты становится больнее',
    edge: 'Отвергнутые приёмы элиты бьют сильнее',
    pace: 'Элита быстрее и применяет отказы чаще',
    finding: 'Элита уносит со склада на одну карту больше',
    elite: 'Элита выходит с прикрытием отряда'
};
export const items = {
    plating: {
        id: 'plating',
        name: 'Пластина',
        short: 'ПЛА',
        category: 'guard',
        description: 'Броня +22. Каждый удар по тебе срезается сильнее.',
        effect: { kind: 'armor', amount: 22 }
    },
    vitality: {
        id: 'vitality',
        name: 'Живучесть',
        short: 'ЖИВ',
        category: 'guard',
        description: 'Запас здоровья +30, и столько же восстанавливается сразу.',
        effect: { kind: 'maxHp', amount: 30 }
    },
    aegis_core: {
        id: 'aegis_core',
        name: 'Ядро оплота',
        short: 'ОПЛ',
        category: 'guard',
        description: 'Убийство элиты даёт 22 барьера.',
        effect: { kind: 'barrierOnEliteKill', amount: 22 }
    },
    ablation: {
        id: 'ablation',
        name: 'Отслойка',
        short: 'ОТС',
        category: 'guard',
        description: 'Весь получаемый урон −10%.',
        effect: { kind: 'damageTakenMul', amount: 0.9 }
    },
    keen_edge: {
        id: 'keen_edge',
        name: 'Заточка',
        short: 'ЗАТ',
        category: 'edge',
        description: 'Урон всех узлов +14%.',
        effect: { kind: 'damageMul', amount: 1.14 }
    },
    hollow_point: {
        id: 'hollow_point',
        name: 'Раскол',
        short: 'РАС',
        category: 'edge',
        description: 'Шанс крита +8%.',
        effect: { kind: 'crit', amount: 0.08 }
    },
    siphon: {
        id: 'siphon',
        name: 'Сифон',
        short: 'СИФ',
        category: 'edge',
        description: '2% нанесённого урона возвращается здоровьем.',
        effect: { kind: 'siphon', amount: 0.02 }
    },
    bane: {
        id: 'bane',
        name: 'Погибель',
        short: 'ПОГ',
        category: 'edge',
        description: 'Урон по элитам +20%.',
        effect: { kind: 'eliteDamageMul', amount: 1.2 }
    },
    light_step: {
        id: 'light_step',
        name: 'Лёгкий шаг',
        short: 'ШАГ',
        category: 'pace',
        description: 'Скорость +9%.',
        effect: { kind: 'moveSpeedMul', amount: 1.09 }
    },
    quickened: {
        id: 'quickened',
        name: 'Ускорение',
        short: 'УСК',
        category: 'pace',
        description: 'Темп цепочки +12%.',
        effect: { kind: 'tempo', amount: 0.12 }
    },
    short_cord: {
        id: 'short_cord',
        name: 'Короткий шнур',
        short: 'ШНУ',
        category: 'pace',
        description: 'Восстановление рывка −18%.',
        effect: { kind: 'dashCooldownMul', amount: 0.82 }
    },
    afterimage: {
        id: 'afterimage',
        name: 'Послеобраз',
        short: 'ПОС',
        category: 'pace',
        description: 'Окно неуязвимости рывка +40%.',
        effect: { kind: 'dashIFrameMul', amount: 1.4 }
    },
    lodestone: {
        id: 'lodestone',
        name: 'Магнит',
        short: 'МАГ',
        category: 'finding',
        description: 'Радиус подбора +35%.',
        effect: { kind: 'pickupRadiusMul', amount: 1.35 }
    },
    keen_eye: {
        id: 'keen_eye',
        name: 'Зоркость',
        short: 'ЗОР',
        category: 'finding',
        description: 'Удача +0.25 — редкие находки встречаются чаще.',
        effect: { kind: 'fortune', amount: 0.25 }
    },
    scavenger: {
        id: 'scavenger',
        name: 'Мусорщик',
        short: 'МУС',
        category: 'finding',
        description: 'Получаемый опыт +15%.',
        effect: { kind: 'xpMul', amount: 1.15 }
    },
    beacon: {
        id: 'beacon',
        name: 'Маяк',
        short: 'МАЯ',
        category: 'finding',
        description: 'Предметы появляются на 18% чаще.',
        effect: { kind: 'relicRateMul', amount: 0.82 }
    },
    spoils: {
        id: 'spoils',
        name: 'Трофейщик',
        short: 'ТРО',
        category: 'elite',
        description: 'Убитая элита отдаёт на одно ядро больше.',
        effect: { kind: 'coreBonus', amount: 1 }
    },
    unravel: {
        id: 'unravel',
        name: 'Распутывание',
        short: 'РАП',
        category: 'elite',
        description: 'Урон от твоих же отвергнутых приёмов −25%.',
        effect: { kind: 'refusalDamageMul', amount: 0.75 }
    },
    tribute: {
        id: 'tribute',
        name: 'Подать',
        short: 'ПОД',
        category: 'elite',
        description: 'Убийство элиты даёт 26 барьера.',
        effect: { kind: 'barrierOnEliteKill', amount: 26 }
    },
    reprisal: {
        id: 'reprisal',
        name: 'Возмездие',
        short: 'ВОЗ',
        category: 'elite',
        description: 'Урон по элитам +16%, и они находят тебя чуть охотнее.',
        effect: { kind: 'eliteDamageMul', amount: 1.16 }
    }
};
export const itemOrder = [
    'plating',
    'vitality',
    'aegis_core',
    'ablation',
    'keen_edge',
    'hollow_point',
    'siphon',
    'bane',
    'light_step',
    'quickened',
    'short_cord',
    'afterimage',
    'lodestone',
    'keen_eye',
    'scavenger',
    'beacon',
    'spoils',
    'unravel',
    'tribute',
    'reprisal'
];
