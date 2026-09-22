import type { CatalystId, DoctrineId, MutationId, Rarity, ResonanceId, SkillId } from '../core/types.js';

export interface MutationContinuation {
  powerMul?: number;
  rangeMul?: number;
  radiusMul?: number;
  durationMul?: number;
  countAdd?: number;
}
export interface MutationDef {
  id: MutationId;
  name: string;
  tag: string;
  description: string;
  /** D28: absent on one of the three roots, set on its single second-level continuation. */
  parent?: MutationId;
  /** Small data-driven reinforcement layered over the parent's identity. */
  continuation?: MutationContinuation;
  /** v0.11 Tier III: must map to a distinct runtime behaviour/VFX, never only scalars. */
  apotheosis?: boolean;
}
export type SkillStat =
  | 'power'
  | 'coverage'
  | 'range'
  | 'duration'
  | 'crit'
  | 'eliteDamage'
  | 'count'
  | 'control'
  | 'statusPotency';
export type EffectRoot =
  | 'projectile'
  | 'pulse'
  | 'beam'
  | 'chain'
  | 'orbit'
  | 'impact'
  | 'construct'
  | 'field'
  | 'control';
export type EffectPhase = 'instant' | 'travel' | 'persistent';
export type EffectGeneration = 'root' | 'derived' | 'construct';
export interface EffectGrammar {
  /** Spatial root of the phenomenon: this replaces code-side allowlists as capability data. */
  root: EffectRoot;
  /** When the root resolves relative to the cast. */
  phase: EffectPhase;
  /** Whether the root is the cast itself, a derived effect, or an autonomous construct. */
  generation: EffectGeneration;
  /** Smallest legal repeat interval for persistent/derived work, in seconds. */
  internalInterval: number;
  /** D41: enemy mirror budget for this phenomenon; intentionally not one global scalar. */
  rivalConcentration: number;
  /** Whether hard cover blocks target acquisition / travel for the root. */
  blockedByCover: boolean;
}

export interface SkillDef {
  id: SkillId;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  directional: boolean;
  baseDamage: number;
  description: string;
  baseRange: number;
  baseRadius: number;
  upgradePool: SkillStat[];
  mutations: MutationDef[];
  baseCrit?: number;
  axes?: ResonanceId[];
  identity?: string;
  weakness?: string;
}
const A = '/assets/';
export const skills: Record<SkillId, SkillDef> = {
  ember_lance: {
    id: 'ember_lance',
    name: 'Игла',
    shortName: 'Игла',
    icon: A + 'skill_ember.png',
    color: '#ff9844',
    directional: true,
    baseDamage: 54,
    baseRange: 13.5,
    baseRadius: 0.28,
    baseCrit: 0.24,
    axes: ['tempo', 'precision', 'multiplicity', 'conductivity'],
    identity: 'Очень частая точная атака с высоким естественным шансом крита.',
    weakness: 'Почти не решает плотную толпу без синергии.',
    description: 'Точная одиночная атака: высокий шанс критического удара, узкая линия и быстрое переключение цели.',
    upgradePool: ['power', 'range', 'count', 'statusPotency', 'crit'],
    mutations: [
      {
        id: 'ember_volley',
        name: 'Залп',
        tag: 'зачистка',
        description:
          'Игла эволюционирует в веер быстрых копий: больше охват и выше общий поток попаданий.'
      },
      {
        id: 'ember_brand',
        name: 'Клеймо',
        tag: 'связка',
        description: 'Метка усиливает следующее попадание другого феномена.'
      },
      {
        id: 'ember_furnace',
        name: 'Горн',
        tag: 'поле',
        description: 'Широкий удар оставляет горящую полосу.'
      },
      {
        id: 'ember_impaler',
        parent: 'ember_volley',
        name: 'Пронзатель',
        tag: 'элита',
        description: 'Один пробивающий снаряд особенно силён против элитных врагов.'
      },
      {
        id: 'ember_backdraft',
        parent: 'ember_brand',
        name: 'Обратная тяга',
        tag: 'контроль',
        description: 'Убийство стягивает соседей и вызывает дополнительный взрыв.'
      },
      {
        id: 'ember_foundry',
        parent: 'ember_furnace',
        name: 'Литейный горн',
        tag: 'поле',
        description: 'Горн разрастается в более широкую и долгую зону плавления.',
        continuation: { powerMul: 1.1, radiusMul: 1.25, durationMul: 1.5 }
      }
    ]
  },
  frost_ring: {
    id: 'frost_ring',
    name: 'Ледяной фронт',
    shortName: 'Фронт',
    icon: A + 'skill_frost.png',
    color: '#78d7ff',
    directional: false,
    baseDamage: 17,
    baseRange: 0,
    baseRadius: 4.15,
    baseCrit: 0.02,
    axes: ['tempo', 'persistence', 'conductivity'],
    identity: 'Массово тормозит и перестраивает поток толпы.',
    weakness: 'Низкий прямой урон, особенно по одиночной цели.',
    description: 'Большая контрольная волна: слабый урон, сильное управление массой.',
    upgradePool: ['coverage', 'statusPotency', 'duration', 'power', 'control'],
    mutations: [
      {
        id: 'frost_snap',
        name: 'Мгновенная заморозка',
        tag: 'взрыв',
        description: 'Повторное охлаждение раскалывает цель и наносит дополнительный урон вокруг неё.'
      },
      {
        id: 'frost_rim',
        name: 'Ледяной обод',
        tag: 'геометрия',
        description: 'Основной урон переносится на внешний край.'
      },
      {
        id: 'frost_front',
        name: 'Холодный фронт',
        tag: 'поле',
        description: 'Кольцо превращается в расширяющееся длительное поле.'
      },
      {
        id: 'frost_skin',
        parent: 'frost_snap',
        name: 'Хрустальная кожа',
        tag: 'защита',
        description: 'Убийства охлаждённых целей дают барьер.'
      },
      {
        id: 'frost_brittle',
        parent: 'frost_rim',
        name: 'Хрупкость',
        tag: 'связка',
        description: 'Охлаждённая цель сильнее страдает от следующего тяжёлого попадания.'
      },
      {
        id: 'frost_whiteout',
        parent: 'frost_front',
        name: 'Белая мгла',
        tag: 'поле',
        description: 'Холодный фронт держится дольше и занимает больше пространства.',
        continuation: { radiusMul: 1.25, durationMul: 1.45 }
      }
    ]
  },
  rail_spear: {
    id: 'rail_spear',
    name: 'Рельсовое копьё',
    shortName: 'Рельса',
    icon: A + 'skill_rail.png',
    color: '#ff55ba',
    directional: true,
    baseDamage: 58,
    baseRange: 18.5,
    baseRadius: 0.34,
    description: 'Очень дальняя пробивающая линия по курсору.',
    baseCrit: 0.12,
    axes: ['precision', 'multiplicity'],
    identity: 'Прошивает выстроенную колонну на дальности, недоступной остальным.',
    weakness: 'Требует, чтобы цели встали в линию; по рассыпанной толпе почти бесполезна.',
    upgradePool: ['power', 'range', 'crit', 'eliteDamage', 'count'],
    mutations: [
      {
        id: 'rail_rack',
        name: 'Стойка пронзателей',
        tag: 'подготовка',
        description: 'Меньше прямого урона, но больше снарядов застревает в цели.'
      },
      {
        id: 'rail_gun',
        name: 'Рельсотрон',
        tag: 'фокус',
        description: 'Раз в два цикла — один почти экранный сверхтяжёлый выстрел. Количество не клонирует его: для множества линий есть отдельная ветвь.'
      },
      {
        id: 'rail_fan',
        name: 'Веер копий',
        tag: 'зачистка',
        description: 'Три более слабых линии.'
      },
      {
        id: 'rail_harpoon',
        parent: 'rail_rack',
        name: 'Гарпун',
        tag: 'контроль',
        description: 'Первая крупная цель подтягивается.'
      },
      {
        id: 'rail_spot',
        parent: 'rail_gun',
        name: 'Точечное копьё',
        tag: 'связка',
        description: 'Цели с меткой получают приоритет и становятся уязвимее.'
      },
      {
        id: 'rail_crossfire',
        parent: 'rail_fan',
        name: 'Перекрёстный веер',
        tag: 'зачистка',
        description: 'Веер добавляет ещё две линии и слегка растягивает прострел.',
        continuation: { powerMul: 0.9, rangeMul: 1.1, countAdd: 2 }
      }
    ]
  },
  cleaver: {
    id: 'cleaver',
    name: 'Секач',
    shortName: 'Секач',
    icon: A + 'skill_cleaver.png',
    color: '#e7e8e9',
    directional: true,
    baseDamage: 132,
    baseRange: 0,
    baseRadius: 2.35,
    baseCrit: 0.08,
    axes: ['tempo', 'precision', 'conductivity'],
    identity: 'Очень высокий мгновенный урон в опасной ближней зоне.',
    weakness: 'Почти отсутствует дальнее давление.',
    description: 'Тяжёлый ближний сектор: чрезвычайно силён рядом, бесполезен на дистанции.',
    upgradePool: ['power', 'coverage', 'control', 'crit', 'statusPotency'],
    mutations: [
      {
        id: 'cleaver_guillotine',
        name: 'Гильотина',
        tag: 'добивание',
        description: 'Узкий взмах резко усиливается по целям с малым запасом здоровья.'
      },
      {
        id: 'cleaver_roundhouse',
        name: 'Круговой удар',
        tag: 'зачистка',
        description:
          'Секач превращает фронтальный удар в полный 360° sweep без штрафа к базовой силе.'
      },
      {
        id: 'cleaver_hook',
        name: 'Крюк',
        tag: 'контроль',
        description: 'Задетые враги подтягиваются.'
      },
      {
        id: 'cleaver_rhythm',
        parent: 'cleaver_roundhouse',
        name: 'Ритм мясника',
        tag: 'темп',
        description: 'Убийства могут повторить взмах.'
      },
      {
        id: 'cleaver_deep',
        parent: 'cleaver_guillotine',
        name: 'Рассекающий клин',
        tag: 'пробой',
        description: 'Гильотина бьёт тяжелее и проталкивает задетых врагов дальше по линии удара.'
      },
      {
        id: 'cleaver_chainhook',
        parent: 'cleaver_hook',
        name: 'Цепной крюк',
        tag: 'контроль',
        description: 'Крюк получает больше охвата и веса, усиливая сбор толпы.',
        continuation: { powerMul: 1.08, radiusMul: 1.12 }
      }
    ]
  },
  chain_arc: {
    id: 'chain_arc',
    name: 'Цепная дуга',
    shortName: 'Дуга',
    icon: A + 'skill_chain_arc.png',
    color: '#68cfff',
    directional: false,
    baseDamage: 31,
    baseRange: 9.0,
    baseRadius: 0,
    baseCrit: 0.04,
    axes: ['tempo', 'multiplicity', 'conductivity'],
    identity: 'Распределяет воздействие между разрозненными целями.',
    weakness: 'Резко теряет эффективность, когда целей мало.',
    description: 'Сеть сама выбирает цели: сильна по разбросанной толпе, слаба по одиночной цели.',
    upgradePool: ['power', 'count', 'range', 'statusPotency', 'crit'],
    mutations: [
      {
        id: 'arc_forked',
        name: 'Разветвлённая сеть',
        tag: 'зачистка',
        description: 'Больше прыжков с постепенным падением силы.'
      },
      {
        id: 'arc_capacitive',
        name: 'Обратная дуга',
        tag: 'фокус',
        description: 'Если целей не хватило на все прыжки, остаток сразу возвращается быстрыми импульсами в первую цель.'
      },
      {
        id: 'arc_ground',
        name: 'Заземление',
        tag: 'фокус',
        description: 'Цели с меткой или застрявшим снарядом получают приоритет.'
      },
      {
        id: 'arc_cage',
        parent: 'arc_forked',
        name: 'Дуговая клетка',
        tag: 'поле',
        description: 'Повторные попадания создают электрическое поле.'
      },
      {
        id: 'arc_relay',
        parent: 'arc_capacitive',
        name: 'Обратный резонатор',
        tag: 'фокус',
        description: 'Возвратные импульсы становятся шире и сильнее, а сама цепь прыгает дальше.'
      },
      {
        id: 'arc_groundloop',
        parent: 'arc_ground',
        name: 'Контур заземления',
        tag: 'связка',
        description: 'Заземлённая дуга тянется дальше и получает дополнительный переход.',
        continuation: { rangeMul: 1.3, countAdd: 1 }
      }
    ]
  },
  orbit_blades: {
    id: 'orbit_blades',
    name: 'Орбитальные лезвия',
    shortName: 'Лезвия',
    icon: A + 'skill_orbit_blades.png',
    color: '#60e6bd',
    directional: false,
    baseDamage: 18,
    baseRange: 0,
    baseRadius: 1.95,
    baseCrit: 0.05,
    axes: ['multiplicity', 'precision', 'mobility', 'conductivity'],
    identity: 'Постоянная плотность контактов вокруг героя.',
    weakness: 'Практически не отвечает угрозам на дистанции.',
    description: 'Контактная орбита: много мелких попаданий рядом с героем.',
    upgradePool: ['power', 'count', 'coverage', 'crit', 'eliteDamage'],
    mutations: [
      {
        id: 'orbit_many',
        name: 'Много ножей',
        tag: 'зачистка',
        description: 'Больше лезвий, но каждое наносит меньше урона.'
      },
      {
        id: 'orbit_saw',
        name: 'Пильная корона',
        tag: 'элита',
        description: 'Меньше тяжёлых лезвий, но они заметно лучше против элитных врагов.'
      },
      {
        id: 'orbit_outbound',
        name: 'Вылет',
        tag: 'взрыв',
        description: 'На такте лезвия расходятся наружу.'
      },
      {
        id: 'orbit_guard',
        parent: 'orbit_many',
        name: 'Защитное кольцо',
        tag: 'защита',
        description: 'Лезвия ослабляют вражеские снаряды.'
      },
      {
        id: 'orbit_blood',
        parent: 'orbit_saw',
        name: 'Жатвенная орбита',
        tag: 'толпа',
        description: 'Чем плотнее враги вокруг героя, тем шире и сильнее становится орбита.'
      },
      {
        id: 'orbit_comet',
        parent: 'orbit_outbound',
        name: 'Кометный вылет',
        tag: 'взрыв',
        description: 'Вылет становится тяжелее и захватывает более широкий пояс.',
        continuation: { powerMul: 1.35, radiusMul: 1.2 }
      }
    ]
  },
  mortar_bloom: {
    id: 'mortar_bloom',
    name: 'Бомбардир',
    shortName: 'Бомбардир',
    icon: A + 'skill_mortar.png',
    color: '#ffbf5a',
    directional: true,
    baseDamage: 76,
    baseRange: 14.5,
    baseRadius: 2.85,
    baseCrit: 0.03,
    axes: ['multiplicity', 'persistence', 'conductivity'],
    identity: 'Движущийся источник артиллерии: позиция героя и метка меняют маршрут захода.',
    weakness: 'Медленно перестраивает маршрут и требует предсказывать движение цели.',
    description: 'Автономный бомбардир делает последовательные заходы по маршруту и отмеченной цели.',
    upgradePool: ['power', 'coverage', 'count', 'range', 'crit'],
    mutations: [
      {
        id: 'mortar_cluster',
        name: 'Кластерный цветок',
        tag: 'зачистка',
        description:
          'Каждый залп распадается на несколько полноценных зон поражения и резко расширяет pack clear.'
      },
      {
        id: 'mortar_fuse',
        name: 'Длинный фитиль',
        tag: 'риск',
        description: 'Больше урон и площадь поражения, но атака визуально медленнее.'
      },
      {
        id: 'mortar_spotter',
        name: 'Наводчик',
        tag: 'фокус',
        description: 'Элитные враги с меткой притягивают точку падения.'
      },
      {
        id: 'mortar_crater',
        parent: 'mortar_fuse',
        name: 'Кратер',
        tag: 'контроль',
        description: 'После взрыва остаётся поле, замедляющее врагов.'
      },
      {
        id: 'mortar_airburst',
        parent: 'mortar_cluster',
        name: 'Воздушный разрыв',
        tag: 'геометрия',
        description: 'Взрыв шире, но центр слабее и длительного поля не остаётся.'
      },
      {
        id: 'mortar_beacon',
        parent: 'mortar_spotter',
        name: 'Маяк наводчика',
        tag: 'фокус',
        description: 'Наводчик получает более дальний и крупный прицельный разрыв.',
        continuation: { powerMul: 1.2, radiusMul: 1.15, rangeMul: 1.15 }
      }
    ]
  },
  sentry: {
    id: 'sentry',
    name: 'Турель',
    shortName: 'Турель',
    icon: A + 'skill_sentry.png',
    color: '#72efdb',
    directional: false,
    baseDamage: 22,
    baseRange: 12.5,
    baseRadius: 0,
    baseCrit: 0.09,
    axes: ['persistence', 'precision', 'multiplicity', 'conductivity'],
    identity: 'Каждый такт оставляет несколько секунд автономного огня в текущей точке маршрута.',
    weakness: 'Старые позиции быстро гаснут: силу даёт цепочка свежих постановок по ходу движения.',
    description: 'Короткоживущие турели ставятся снова на каждом такте, образуя меняющийся огневой след за маршрутом героя.',
    upgradePool: ['power', 'range', 'duration', 'count', 'eliteDamage'],
    mutations: [
      {
        id: 'sentry_gatling',
        name: 'Гатлинг',
        tag: 'темп',
        description: 'Частые слабые выстрелы и быстрое переключение между целями.'
      },
      {
        id: 'sentry_rail',
        name: 'Рельсовая установка',
        tag: 'фокус',
        description: 'Медленные тяжёлые выстрелы в первую очередь ищут элитных врагов.'
      },
      {
        id: 'sentry_relay',
        name: 'Ретранслятор',
        tag: 'связка',
        description: 'Турель становится промежуточным узлом для цепной молнии.'
      },
      {
        id: 'sentry_crawler',
        parent: 'sentry_gatling',
        name: 'Ползун',
        tag: 'мобильность',
        description: 'Турель держится ближе к игроку.'
      },
      {
        id: 'sentry_salvager',
        parent: 'sentry_rail',
        name: 'Утилизатор',
        tag: 'экономика',
        description: 'Убийства элит при участии турелей быстрее дают ядра.'
      },
      {
        id: 'sentry_grid',
        parent: 'sentry_relay',
        name: 'Сетка ретрансляторов',
        tag: 'связка',
        description: 'Ретранслятор живёт дольше и держит большую рабочую зону.',
        continuation: { rangeMul: 1.3, durationMul: 1.35 }
      }
    ]
  },
  toxic_mist: {
    id: 'toxic_mist',
    name: 'Токсичный туман',
    shortName: 'Туман',
    icon: A + 'skill_toxic.png',
    color: '#94df72',
    directional: false,
    baseDamage: 12,
    baseRange: 0,
    baseRadius: 4.5,
    description: 'Большое длительное поле вокруг позиции героя.',
    baseCrit: 0,
    axes: ['persistence', 'conductivity'],
    identity: 'Держит площадь вокруг героя и наказывает давку без единого нажатия.',
    weakness: 'Против одиночной крупной цели почти ничего не решает.',
    upgradePool: ['power', 'duration', 'coverage', 'statusPotency', 'control'],
    mutations: [
      {
        id: 'toxic_corrosive',
        name: 'Коррозия',
        tag: 'поддержка',
        description: 'Яд сильнее ослабляет защищённые цели.'
      },
      {
        id: 'toxic_contagion',
        name: 'Заражение',
        tag: 'зачистка',
        description: 'Смерть заражённого передаёт яд соседям.'
      },
      {
        id: 'toxic_distilled',
        name: 'Дистиллят',
        tag: 'фокус',
        description: 'Поле намного меньше, но гораздо сильнее.'
      },
      {
        id: 'toxic_plume',
        parent: 'toxic_contagion',
        name: 'Шлейф',
        tag: 'движение',
        description: 'Туман тянется следом за героем.'
      },
      {
        id: 'toxic_reactive',
        parent: 'toxic_corrosive',
        name: 'Реактивный растворитель',
        tag: 'связка',
        description: 'Враг под уже действующим контролем или горением сразу вызывает дополнительный химический всплеск.'
      },
      {
        id: 'toxic_still',
        parent: 'toxic_distilled',
        name: 'Перегонный куб',
        tag: 'фокус',
        description: 'Дистиллят ещё плотнее: меньше площадь, выше концентрация и срок.',
        continuation: { powerMul: 1.3, radiusMul: 0.85, durationMul: 1.35 }
      }
    ]
  },
  repulse_halo: {
    id: 'repulse_halo',
    name: 'Импульс отталкивания',
    shortName: 'Импульс',
    icon: A + 'skill_repulse.png',
    color: '#8de8ff',
    directional: false,
    baseDamage: 16,
    baseRange: 0,
    baseRadius: 3.0,
    description:
      'Защитная волна отталкивает толпу, освобождает пространство и может превращать контроль в барьер.',
    baseCrit: 0.02,
    axes: ['conductivity', 'mobility'],
    identity: 'Расчищает место вокруг и превращает контроль в защиту.',
    weakness: 'Прямой урон ничтожен; сам по себе никого не убивает.',
    upgradePool: ['control', 'coverage', 'power', 'statusPotency', 'duration'],
    mutations: [
      {
        id: 'repulse_gravity',
        name: 'Гравитационный колодец',
        tag: 'контроль',
        description: 'Отталкивание превращается в притяжение и собирает врагов под следующую атаку по площади.'
      },
      {
        id: 'repulse_front',
        name: 'Ударный фронт',
        tag: 'взрыв',
        description: 'Основной урон переносится на внешний край импульса.'
      },
      {
        id: 'repulse_aegis',
        name: 'Эгида',
        tag: 'защита',
        description: 'Каждый реально отодвинутый враг даёт немного барьера до лимита активации.'
      },
      {
        id: 'repulse_relay',
        parent: 'repulse_gravity',
        name: 'Кинетический релей',
        tag: 'связка',
        description: 'Чем сильнее сдвинуты враги, тем больше заряд следующего феномена.'
      },
      {
        id: 'repulse_rings',
        parent: 'repulse_front',
        name: 'Компрессионные кольца',
        tag: 'геометрия',
        description: 'Две последовательные меньшие волны вместо одной.'
      },
      {
        id: 'repulse_bastion',
        parent: 'repulse_aegis',
        name: 'Кинетический бастион',
        tag: 'защита',
        description: 'Эгида расширяет безопасный пояс и усиливает сам импульс.',
        continuation: { powerMul: 1.08, radiusMul: 1.18 }
      }
    ]
  },
  mass_driver: {
    id: 'mass_driver',
    name: 'Могильный вал',
    shortName: 'Вал',
    icon: A + 'skill_mass_driver.png',
    color: '#e891ff',
    directional: true,
    baseDamage: 24,
    baseRange: 22,
    baseRadius: 0.38,
    baseCrit: 0.01,
    axes: ['tempo', 'precision', 'conductivity'],
    identity: 'Огромная медленная масса физически катится по арене, ломает укрытия и разрывает строй.',
    weakness: 'Медленный и требует заранее построить траекторию; промах дорог.',
    description: 'Медленный тяжёлый валун: сильный импульс, разрушение укрытий и растущая мощь по мере движения.',
    upgradePool: ['power', 'range', 'control', 'crit', 'eliteDamage'],
    mutations: [
      {
        id: 'mass_rail',
        name: 'Рельсовая масса',
        tag: 'фокус',
        description: 'Ещё уже, дальше и тяжелее.'
      },
      {
        id: 'mass_snowball',
        name: 'Снежный ком',
        tag: 'масштаб',
        description: 'Урон растёт за каждого обычного врага на линии.'
      },
      {
        id: 'mass_recoil',
        name: 'Отдача',
        tag: 'риск',
        description: 'Сильнее, но отталкивает самого игрока.'
      },
      {
        id: 'mass_cargo',
        parent: 'mass_snowball',
        name: 'Груз',
        tag: 'комбо',
        description: 'Тела и созданные объекты на линии усиливают удар.'
      },
      {
        id: 'mass_terminal',
        parent: 'mass_rail',
        name: 'Предельная скорость',
        tag: 'пробой',
        description: 'Рельсовая масса сразу становится быстрее и тяжелее, без накопления скрытого ресурса.'
      },
      {
        id: 'mass_counterthrust',
        parent: 'mass_recoil',
        name: 'Контртяга',
        tag: 'риск',
        description: 'Отдача превращается в ещё более тяжёлый дальний разгон.',
        continuation: { powerMul: 1.28, rangeMul: 1.12 }
      }
    ]
  },
  breach_line: {
    id: 'breach_line',
    name: 'Линия пробоя',
    shortName: 'ПРОБОЙ',
    icon: A + 'skill_rail.png',
    color: '#ff8f5a',
    directional: true,
    baseDamage: 34,
    description: 'Широкая полоса пробоя, проходящая сквозь всех на пути.',
    baseRange: 9,
    baseRadius: 0.95,
    baseCrit: 0.06,
    axes: ['precision', 'multiplicity'],
    identity: 'Бьёт всю глубину колонны разом, не теряя силы на первом теле.',
    weakness: 'Требует, чтобы цели стояли по линии; против россыпи почти бесполезна.',
    upgradePool: ['power', 'coverage', 'crit'],
    mutations: [
      {
        id: 'breach_wide',
        name: 'Расширенный пробой',
        tag: 'зачистка',
        description: 'Полоса шире, но урон по каждому ниже.'
      },
      {
        id: 'breach_deep',
        name: 'Глубокий пробой',
        tag: 'элита',
        description: 'Дальность и урон выше, полоса уже.'
      },
      {
        id: 'breach_stagger',
        name: 'Оглушающий пробой',
        tag: 'контроль',
        description: 'Задетые теряют ход на мгновение.'
      },
      {
        id: 'breach_waveguide',
        parent: 'breach_wide',
        name: 'Волновод',
        tag: 'зачистка',
        description: 'Расширенный пробой охватывает ещё больше пространства и дальше держит линию.',
        continuation: { radiusMul: 1.35, rangeMul: 1.1 }
      },
      {
        id: 'breach_lance',
        parent: 'breach_deep',
        name: 'Осадная игла',
        tag: 'элита',
        description: 'Глубокий пробой становится длиннее и тяжелее, жертвуя шириной.',
        continuation: { powerMul: 1.3, rangeMul: 1.25, radiusMul: 0.85 }
      },
      {
        id: 'breach_aftershock',
        parent: 'breach_stagger',
        name: 'Вторичный толчок',
        tag: 'контроль',
        description: 'Оглушающий пробой усиливает давление и шире удерживает проход.',
        continuation: { powerMul: 1.12, radiusMul: 1.12 }
      }
    ]
  },
  contact_saw: {
    id: 'contact_saw',
    name: 'Контактная пила',
    shortName: 'ПИЛА',
    icon: A + 'skill_cleaver.png',
    color: '#ffd7a8',
    directional: true,
    baseDamage: 11,
    description: 'Режущий орган прямо перед телом, работающий непрерывно.',
    baseRange: 0,
    baseRadius: 1.7,
    baseCrit: 0.04,
    axes: ['tempo', 'conductivity'],
    identity: 'Постоянный урон в упор без единой паузы на прицеливание.',
    weakness: 'Вынуждает стоять вплотную; на отходе не наносит ничего.',
    upgradePool: ['power', 'coverage', 'crit'],
    mutations: [
      {
        id: 'saw_teeth',
        name: 'Крупный зуб',
        tag: 'элита',
        description: 'Реже, но каждый заход бьёт вдвое.'
      },
      {
        id: 'saw_spin',
        name: 'Раскрутка',
        tag: 'зачистка',
        description: 'Сектор до полного круга, урон ниже.'
      },
      {
        id: 'saw_bleed',
        name: 'Рваный край',
        tag: 'поле',
        description: 'Задетые долго теряют здоровье.'
      },
      {
        id: 'saw_executioner',
        parent: 'saw_teeth',
        name: 'Зуб палача',
        tag: 'элита',
        description: 'Крупный зуб становится ещё тяжелее в контакте с одной целью.',
        continuation: { powerMul: 1.35, radiusMul: 0.95 }
      },
      {
        id: 'saw_whirlwind',
        parent: 'saw_spin',
        name: 'Зубчатый вихрь',
        tag: 'зачистка',
        description: 'Раскрутка расширяет рабочую окружность ценой части силы удара.',
        continuation: { powerMul: 0.9, radiusMul: 1.3 }
      },
      {
        id: 'saw_hemorrhage',
        parent: 'saw_bleed',
        name: 'Кровопускание',
        tag: 'поле',
        description: 'Рваный край глубже поддерживает длительный урон.',
        continuation: { powerMul: 1.15, durationMul: 1.6 }
      }
    ]
  },
  backhand: {
    id: 'backhand',
    name: 'Обратный размах',
    shortName: 'РАЗМАХ',
    icon: A + 'skill_cleaver.png',
    color: '#ffe0c0',
    directional: false,
    baseDamage: 27,
    description: 'Удар назад по ходу движения, накрывающий тех, кого герой миновал.',
    baseRange: 0,
    baseRadius: 2.7,
    baseCrit: 0.05,
    axes: ['mobility', 'conductivity'],
    identity: 'Награждает за проход сквозь массу, а не за отход от неё.',
    weakness: 'Неподвижному герою бьёт в пустоту.',
    upgradePool: ['power', 'coverage', 'crit'],
    mutations: [
      {
        id: 'backhand_wake',
        name: 'След',
        tag: 'зачистка',
        description: 'Радиус растёт от пройденного пути.'
      },
      {
        id: 'backhand_shove',
        name: 'Отбрасывание',
        tag: 'контроль',
        description: 'Задетые отлетают назад.'
      },
      {
        id: 'backhand_twin',
        name: 'Двойной',
        tag: 'связка',
        description: 'Бьёт и вперёд, и назад, но слабее.'
      },
      {
        id: 'backhand_stampede',
        parent: 'backhand_wake',
        name: 'Разгонный след',
        tag: 'зачистка',
        description: 'След сильнее растёт вместе с движением и бьёт шире.',
        continuation: { powerMul: 1.15, radiusMul: 1.3 }
      },
      {
        id: 'backhand_rebound',
        parent: 'backhand_shove',
        name: 'Рикошет',
        tag: 'контроль',
        description: 'Отбрасывание получает больший охват и вес импульса.',
        continuation: { powerMul: 1.12, radiusMul: 1.15 }
      },
      {
        id: 'backhand_crossbeat',
        parent: 'backhand_twin',
        name: 'Перекрёстный такт',
        tag: 'связка',
        description: 'Двойной удар усиливает обе стороны и расширяет дугу.',
        continuation: { powerMul: 1.2, radiusMul: 1.1 }
      }
    ]
  },
  spreading_front: {
    id: 'spreading_front',
    name: 'Расходящийся фронт',
    shortName: 'ФРОНТ',
    icon: A + 'skill_repulse.png',
    color: '#9ad8ff',
    directional: false,
    baseDamage: 31,
    description: 'Кольцевая волна, расходящаяся от героя и обходящая тех, кто вплотную.',
    baseRange: 0,
    baseRadius: 6.2,
    baseCrit: 0.03,
    axes: ['persistence', 'multiplicity'],
    identity: 'Накрывает средний круг целиком, не требуя прицела.',
    weakness: 'Прижатых вплотную не задевает вовсе.',
    upgradePool: ['power', 'coverage', 'crit'],
    mutations: [
      {
        id: 'front_inner',
        name: 'Ближний фронт',
        tag: 'зачистка',
        description: 'Волна начинается у самого тела.'
      },
      {
        id: 'front_far',
        name: 'Дальний фронт',
        tag: 'поле',
        description: 'Кольцо шире и дальше, урон ниже.'
      },
      {
        id: 'front_slow',
        name: 'Вязкий фронт',
        tag: 'контроль',
        description: 'Задетые замедляются.'
      },
      {
        id: 'front_surge',
        parent: 'front_inner',
        name: 'Прилив',
        tag: 'зачистка',
        description: 'Ближний фронт становится тяжелее и быстрее заполняет пространство вокруг тела.',
        continuation: { powerMul: 1.3, radiusMul: 1.2 }
      },
      {
        id: 'front_horizon',
        parent: 'front_far',
        name: 'Горизонт',
        tag: 'поле',
        description: 'Дальний фронт разрастается ещё сильнее и удерживает внешнюю дистанцию.',
        continuation: { powerMul: 1.1, radiusMul: 1.35 }
      },
      {
        id: 'front_quagmire',
        parent: 'front_slow',
        name: 'Тягучий вал',
        tag: 'контроль',
        description: 'Вязкий фронт шире контролирует пространство и наносит больше давления.',
        continuation: { powerMul: 1.1, radiusMul: 1.25 }
      }
    ]
  },
  shard_fan: {
    id: 'shard_fan',
    name: 'Возвратный клинок',
    shortName: 'ВОЗВРАТ',
    icon: A + 'returner_normal.svg',
    color: '#ffb36b',
    directional: true,
    baseDamage: 15,
    description: 'Физический клинок уходит вперёд, зависает на пределе и возвращается через новую линию боя.',
    baseRange: 7.2,
    baseRadius: 0.34,
    baseCrit: 0.07,
    axes: ['multiplicity', 'precision'],
    identity: 'Одна атака создаёт два разных прохода; позиционирование между вылетом и возвратом — часть урона.',
    weakness: 'Нужен маршрут возврата; мгновенного покрытия сектора больше нет.',
    upgradePool: ['power', 'coverage', 'crit'],
    mutations: [
      {
        id: 'fan_tight',
        name: 'Сжатый веер',
        tag: 'элита',
        description: 'Угол уже, все полосы могут лечь в одну цель.'
      },
      {
        id: 'fan_wide',
        name: 'Раскрытый веер',
        tag: 'зачистка',
        description: 'Угол шире, полос больше, урон ниже.'
      },
      { id: 'fan_burn', name: 'Жгучий веер', tag: 'поле', description: 'Задетые загораются.' },
      {
        id: 'fan_needle',
        parent: 'fan_tight',
        name: 'Игловой строй',
        tag: 'элита',
        description: 'Сжатый веер летит дальше и заметно тяжелее бьёт по узкой линии.',
        continuation: { powerMul: 1.35, rangeMul: 1.15 }
      },
      {
        id: 'fan_storm',
        parent: 'fan_wide',
        name: 'Осколочная буря',
        tag: 'зачистка',
        description: 'Раскрытый веер добавляет ещё две полосы и тянется дальше.',
        continuation: { powerMul: 1.05, rangeMul: 1.15, countAdd: 2 }
      },
      {
        id: 'fan_cinder',
        parent: 'fan_burn',
        name: 'Угольный дождь',
        tag: 'поле',
        description: 'Жгучие осколки летят дальше и оставляют более тяжёлый урон.',
        continuation: { powerMul: 1.15, rangeMul: 1.1 }
      }
    ]
  },
  tether_drag: {
    id: 'tether_drag',
    name: 'Гравиякорь',
    shortName: 'ЯКОРЬ',
    icon: A + 'gravity_anchor_normal.svg',
    color: '#8fe0c8',
    directional: true,
    baseDamage: 19,
    description: 'Ставит гравитационный якорь впереди и стягивает врагов к нему, а не к телу героя.',
    baseRange: 11,
    baseRadius: 0.45,
    baseCrit: 0.05,
    axes: ['conductivity', 'mobility'],
    identity: 'Безопасно перестраивает толпу вокруг выбранной точки и готовит её под точный удар, заморозку или цепную молнию.',
    weakness: 'Сам по себе почти не убивает; ценность раскрывается через подготовку целей и сильный импульс.',
    upgradePool: ['power', 'coverage', 'crit'],
    mutations: [
      {
        id: 'tether_hook',
        name: 'Крюк',
        tag: 'элита',
        description: 'Тянет сильнее, но только одну цель.'
      },
      {
        id: 'tether_net',
        name: 'Сеть',
        tag: 'зачистка',
        description: 'Тянет больше целей, но слабее.'
      },
      { id: 'tether_bind', name: 'Путы', tag: 'контроль', description: 'Подтянутые теряют ход.' },
      {
        id: 'tether_anchor',
        parent: 'tether_hook',
        name: 'Якорный крюк',
        tag: 'элита',
        description: 'Одиночный крюк получает больше веса и дальности.',
        continuation: { powerMul: 1.3, rangeMul: 1.15 }
      },
      {
        id: 'tether_dragnet',
        parent: 'tether_net',
        name: 'Трал',
        tag: 'зачистка',
        description: 'Сеть становится шире и захватывает пространство дальше по фронту.',
        continuation: { radiusMul: 1.4, rangeMul: 1.1 }
      },
      {
        id: 'tether_lock',
        parent: 'tether_bind',
        name: 'Мёртвый узел',
        tag: 'контроль',
        description: 'Путы получают более тяжёлый и широкий контакт.',
        continuation: { powerMul: 1.15, radiusMul: 1.15 }
      }
    ]
  },
  pin_burst: {
    id: 'pin_burst',
    name: 'Пригвождение',
    shortName: 'ПРИГВОЗДЬ',
    icon: A + 'skill_mortar.png',
    color: '#d9a0ff',
    directional: true,
    baseDamage: 25,
    description: 'Разрыв в выбранной точке, пригвождающий задетых к месту.',
    baseRange: 8.5,
    baseRadius: 2.7,
    baseCrit: 0.05,
    axes: ['precision', 'persistence'],
    identity: 'Останавливает группу там, где она стоит, а не там, где герой.',
    weakness: 'Бьёт по месту, а не по цели: подвижные успевают уйти.',
    upgradePool: ['power', 'coverage', 'crit'],
    mutations: [
      {
        id: 'pin_deep',
        name: 'Глубокий разрыв',
        tag: 'элита',
        description: 'Урон выше, радиус меньше.'
      },
      {
        id: 'pin_field',
        name: 'Осевший прах',
        tag: 'поле',
        description: 'Задетые долго теряют здоровье.'
      },
      {
        id: 'pin_twin',
        name: 'Двойной разрыв',
        tag: 'связка',
        description: 'Второй разрыв через мгновение.'
      },
      {
        id: 'pin_corebreak',
        parent: 'pin_deep',
        name: 'Разлом ядра',
        tag: 'элита',
        description: 'Глубокий разрыв ещё сильнее концентрирует удар в малой зоне.',
        continuation: { powerMul: 1.4, radiusMul: 0.9 }
      },
      {
        id: 'pin_gravefield',
        parent: 'pin_field',
        name: 'Мёртвое поле',
        tag: 'поле',
        description: 'Осевший прах держится дольше и сильнее давит внутри зоны.',
        continuation: { powerMul: 1.15, durationMul: 1.5 }
      },
      {
        id: 'pin_chainburst',
        parent: 'pin_twin',
        name: 'Цепной разрыв',
        tag: 'связка',
        description: 'Двойной разрыв усиливает повтор и расширяет точку поражения.',
        continuation: { powerMul: 1.25, radiusMul: 1.1 }
      }
    ]
  }
};


/**
 * v0.11 — Tier III Apotheosis. Exactly one continuation exists above every Tier II branch
 * in the active roster. The runtime is required to recognize every id below; content tests
 * deliberately reject an Apotheosis that exists only as text.
 */
const v011Apotheoses: Partial<Record<SkillId, MutationDef[]>> = {
  frost_ring: [
    { id:'frost_glacier_heart', parent:'frost_skin', name:'Сердце ледника', tag:'АПОФЕОЗ · смерч', description:'Каждый раскол выпускает движущийся ледяной смерч; он замораживает новую линию целей.', apotheosis:true },
    { id:'frost_spirefall', parent:'frost_brittle', name:'Падение шпилей', tag:'АПОФЕОЗ · шипы', description:'Раскол хрупкой цели вызывает крест ледяных шпилей вокруг неё.', apotheosis:true },
    { id:'frost_worldstorm', parent:'frost_whiteout', name:'Белый шторм', tag:'АПОФЕОЗ · фронт', description:'Фронт становится большим движущимся штормом, который проходит через значительную часть арены.', apotheosis:true }
  ],
  rail_spear: [
    { id:'rail_execution_line', parent:'rail_harpoon', name:'Казнящая тяга', tag:'АПОФЕОЗ · гарпун', description:'Гарпун фиксирует крупную цель и вызывает отложенный вертикальный удар в точку захвата.', apotheosis:true },
    { id:'rail_sky_lance', parent:'rail_spot', name:'Небесное копьё', tag:'АПОФЕОЗ · приоритет', description:'Попадание по цели с меткой создаёт заметный маяк; сверху падает отдельный мощный луч.', apotheosis:true },
    { id:'rail_lattice', parent:'rail_crossfire', name:'Лазерная решётка', tag:'АПОФЕОЗ · сеть', description:'После веера остаются две перекрёстные отложенные линии, повторно прорезающие пространство.', apotheosis:true }
  ],
  cleaver: [
    { id:'cleaver_harvest_dance', parent:'cleaver_rhythm', name:'Танец жатвы', tag:'АПОФЕОЗ · цепь', description:'Убийство в ближнем бою запускает самостоятельный круговой добивающий взмах и наращивает темп жатвы.', apotheosis:true },
    { id:'cleaver_rupture', parent:'cleaver_deep', name:'Разрыв строя', tag:'АПОФЕОЗ · толпа', description:'Первые задетые тяжёлым взмахом враги сразу выпускают вокруг себя режущие разрывы, прорезая соседей без накопления стаков.', apotheosis:true },
    { id:'cleaver_rift_hook', parent:'cleaver_chainhook', name:'Крюк разлома', tag:'АПОФЕОЗ · разлом', description:'Стянутые цели сходятся в точке удара, после чего наружу проходит большой режущий разлом.', apotheosis:true }
  ],
  chain_arc: [
    { id:'arc_hunting_storm', parent:'arc_cage', name:'Охотничья гроза', tag:'АПОФЕОЗ · поиск', description:'Клетка выпускает дополнительные дуги из заряженных целей и продолжает искать новые узлы.', apotheosis:true },
    { id:'arc_living_circuit', parent:'arc_relay', name:'Живой контур', tag:'АПОФЕОЗ · ретрансляторы', description:'Турели и якоря становятся полноценными узлами сети и соединяются электрическими линиями.', apotheosis:true },
    { id:'arc_closed_loop', parent:'arc_groundloop', name:'Замкнутый контур', tag:'АПОФЕОЗ · петля', description:'Последняя дуга возвращается к первой/приоритетной цели и замыкает мощный контур.', apotheosis:true }
  ],
  orbit_blades: [
    { id:'orbit_aegis_crown', parent:'orbit_guard', name:'Корона эгиды', tag:'АПОФЕОЗ · защита', description:'Перехват вражеского снаряда заряжает барьер; полный заряд выпускает защитную ударную волну.', apotheosis:true },
    { id:'orbit_sanguine_crown', parent:'orbit_blood', name:'Корона толпы', tag:'АПОФЕОЗ · давление', description:'Плотная толпа ещё сильнее расширяет орбиту; попадания внутри давки понемногу возвращают барьер.', apotheosis:true },
    { id:'orbit_phoenix', parent:'orbit_comet', name:'Фениксовый вылет', tag:'АПОФЕОЗ · возврат', description:'Часть лезвий физически вылетает к цели с меткой или элите и возвращается, прорезая цели дважды.', apotheosis:true }
  ],
  mortar_bloom: [
    { id:'mortar_gravity_field', parent:'mortar_crater', name:'Гравибомба', tag:'АПОФЕОЗ · поле', description:'После захода остаётся видимое поле, стягивающее толпу к эпицентру следующего сброса.', apotheosis:true },
    { id:'mortar_carpet', parent:'mortar_airburst', name:'Ковровый проход', tag:'АПОФЕОЗ · маршрут', description:'Бомбардир проходит над линией и сбрасывает серию разнесённых зарядов по траектории.', apotheosis:true },
    { id:'mortar_hunter_pass', parent:'mortar_beacon', name:'Охотничий заход', tag:'АПОФЕОЗ · элита', description:'Элита с меткой получает три последовательных, заранее показанных захода с разных направлений.', apotheosis:true }
  ],
  sentry: [
    { id:'sentry_walker', parent:'sentry_crawler', name:'Ходячий бастион', tag:'АПОФЕОЗ · бастион', description:'Турели собираются в подвижный кластер вокруг героя и создают короткие безопасные зоны.', apotheosis:true },
    { id:'sentry_hunter_battery', parent:'sentry_salvager', name:'Охотничья батарея', tag:'АПОФЕОЗ · фокус', description:'Все турели одновременно захватывают цель с меткой или элиту и периодически дают общий тяжёлый залп.', apotheosis:true },
    { id:'sentry_gravity_grid', parent:'sentry_grid', name:'Грависеть', tag:'АПОФЕОЗ · сеть', description:'Соседние турели соединяются полями, которые тянут и повреждают противников между ними.', apotheosis:true }
  ],
  toxic_mist: [
    { id:'toxic_plague_road', parent:'toxic_plume', name:'Чумная дорога', tag:'АПОФЕОЗ · след', description:'Движение постоянно оставляет цепочку заражённых пятен; смерть переносит инфекцию дальше.', apotheosis:true },
    { id:'toxic_septic_bloom', parent:'toxic_reactive', name:'Септический цветок', tag:'АПОФЕОЗ · детонация', description:'Цели под контролем или горением немедленно рассыпают вокруг себя новые ядовитые очаги и могут запустить цепную реакцию в толпе.', apotheosis:true },
    { id:'toxic_pestilent_host', parent:'toxic_still', name:'Носитель мора', tag:'АПОФЕОЗ · сущность', description:'Плотное облако отделяется от героя и медленно преследует ближайшую элиту как самостоятельный объект.', apotheosis:true }
  ],
  mass_driver: [
    { id:'mass_avalanche', parent:'mass_cargo', name:'Лавина', tag:'АПОФЕОЗ · масса', description:'Могильный вал физически растёт после каждого тела и куска разрушенного укрытия.', apotheosis:true },
    { id:'mass_singularity', parent:'mass_terminal', name:'Терминальная масса', tag:'АПОФЕОЗ · коллапс', description:'В конце пути вал схлопывается в тяжёлый импульсный взрыв, особенно опасный для элиты.', apotheosis:true },
    { id:'mass_comet_recoil', parent:'mass_counterthrust', name:'Кометная контртяга', tag:'АПОФЕОЗ · манёвр', description:'Запуск резко отбрасывает героя назад, даёт короткое защитное окно и выпускает сверхтяжёлый вал.', apotheosis:true }
  ],
  shard_fan: [
    { id:'returner_execution', parent:'fan_needle', name:'Охотничий возврат', tag:'АПОФЕОЗ · элита', description:'Возвратный клинок цепляется за цель с меткой или элиту и возвращается через неё после короткой задержки.', apotheosis:true },
    { id:'returner_carousel', parent:'fan_storm', name:'Карусель', tag:'АПОФЕОЗ · маршрут', description:'На пределе клинки делают полный оборот вокруг точки и только затем возвращаются.', apotheosis:true },
    { id:'returner_phoenix', parent:'fan_cinder', name:'Феникс возврата', tag:'АПОФЕОЗ · след', description:'Оба прохода оставляют огненный след; пересечение исходящего и обратного пути вызывает взрыв.', apotheosis:true }
  ],
  tether_drag: [
    { id:'gravity_singularity', parent:'tether_anchor', name:'Сингулярность', tag:'АПОФЕОЗ · якорь', description:'Якорь накапливает массу стянутых целей, затем взрывается и делает выживших уязвимее.', apotheosis:true },
    { id:'gravity_dragnet', parent:'tether_dragnet', name:'Орбитальная сеть', tag:'АПОФЕОЗ · сеть', description:'Вместо одного луча появляются три якоря, образующие широкую область стягивания.', apotheosis:true },
    { id:'gravity_prison', parent:'tether_lock', name:'Гравитюрьма', tag:'АПОФЕОЗ · контроль', description:'Элита не тянется к герою: вокруг неё на время замыкается видимая клетка, быстрее ломающая её защиту.', apotheosis:true }
  ]
};
for (const [skill, defs] of Object.entries(v011Apotheoses) as [SkillId, MutationDef[]][]) {
  skills[skill].mutations.push(...defs);
}

/**
 * Step 3 effect grammar. Behaviour-specific numbers still live with each cast implementation,
 * but ownership/capability/timing no longer do: the engine asks this table what kind of root it
 * is dealing with and how the rival mirror spends the same budget. This is intentionally data,
 * so adding a phenomenon cannot silently forget to make it rival-capable.
 */
export const effectGrammar: Record<SkillId, EffectGrammar> = {
  ember_lance: { root: 'projectile', phase: 'travel', generation: 'root', internalInterval: 0, rivalConcentration: 1.8, blockedByCover: true },
  frost_ring: { root: 'pulse', phase: 'instant', generation: 'root', internalInterval: 0, rivalConcentration: 2.6, blockedByCover: false },
  rail_spear: { root: 'beam', phase: 'instant', generation: 'root', internalInterval: 0, rivalConcentration: 2.2, blockedByCover: true },
  cleaver: { root: 'pulse', phase: 'instant', generation: 'root', internalInterval: 0, rivalConcentration: 1.15, blockedByCover: false },
  chain_arc: { root: 'chain', phase: 'instant', generation: 'root', internalInterval: 0, rivalConcentration: 3.2, blockedByCover: true },
  orbit_blades: { root: 'orbit', phase: 'persistent', generation: 'derived', internalInterval: 0.13, rivalConcentration: 2.0, blockedByCover: false },
  mortar_bloom: { root: 'impact', phase: 'travel', generation: 'root', internalInterval: 0, rivalConcentration: 1.4, blockedByCover: true },
  sentry: { root: 'construct', phase: 'persistent', generation: 'construct', internalInterval: 0.3, rivalConcentration: 0.95, blockedByCover: true },
  toxic_mist: { root: 'field', phase: 'persistent', generation: 'derived', internalInterval: 0.25, rivalConcentration: 0.9, blockedByCover: false },
  mass_driver: { root: 'projectile', phase: 'travel', generation: 'root', internalInterval: 0, rivalConcentration: 4.1, blockedByCover: true },
  repulse_halo: { root: 'control', phase: 'instant', generation: 'root', internalInterval: 0, rivalConcentration: 2.2, blockedByCover: false },
  breach_line: { root: 'beam', phase: 'instant', generation: 'root', internalInterval: 0, rivalConcentration: 2.8, blockedByCover: true },
  contact_saw: { root: 'pulse', phase: 'persistent', generation: 'root', internalInterval: 0.18, rivalConcentration: 2.0, blockedByCover: false },
  backhand: { root: 'pulse', phase: 'instant', generation: 'root', internalInterval: 0, rivalConcentration: 2.0, blockedByCover: false },
  spreading_front: { root: 'pulse', phase: 'instant', generation: 'root', internalInterval: 0, rivalConcentration: 2.35, blockedByCover: false },
  shard_fan: { root: 'projectile', phase: 'travel', generation: 'root', internalInterval: 0, rivalConcentration: 3.0, blockedByCover: true },
  tether_drag: { root: 'control', phase: 'instant', generation: 'root', internalInterval: 0, rivalConcentration: 2.6, blockedByCover: true },
  pin_burst: { root: 'impact', phase: 'travel', generation: 'root', internalInterval: 0, rivalConcentration: 2.0, blockedByCover: true }
};

export const activeSkillOrder: SkillId[] = [
  'frost_ring', 'rail_spear', 'cleaver', 'chain_arc', 'orbit_blades', 'mortar_bloom',
  'sentry', 'toxic_mist', 'mass_driver', 'shard_fan', 'tether_drag'
];

/** Compatibility-only definitions for old seeds/replays. Never offer these through Discovery or use them as live test fixtures. */
export const legacySkillOrder: SkillId[] = [
  'ember_lance', 'repulse_halo', 'breach_line', 'contact_saw', 'backhand', 'spreading_front', 'pin_burst'
];

export const skillOrder: SkillId[] = [
  'ember_lance',
  'frost_ring',
  'cleaver',
  'chain_arc',
  'orbit_blades',
  'mortar_bloom',
  'sentry',
  'mass_driver',
  'rail_spear',
  'toxic_mist',
  'repulse_halo',
  'breach_line',
  'contact_saw',
  'backhand',
  'spreading_front',
  'shard_fan',
  'tether_drag',
  'pin_burst'
];
// Showcase preload uses only active Phenomena; Clean Run starts from the selected active Phenomenon and world acquisition.
export const initialSlots: (SkillId | null)[] = [
  'frost_ring',
  'rail_spear',
  'cleaver',
  'chain_arc'
];
export const initialSkillReserve: (SkillId | null)[] = ['orbit_blades', 'sentry', 'mass_driver'];

export interface CatalystDef {
  id: CatalystId;
  name: string;
  shortName: string;
  desc: string;
  color: string;
  scope: string;
}
export const catalysts: Record<CatalystId, CatalystDef> = {
  source: {
    id: 'source',
    name: 'Источник',
    shortName: 'ИЗ A',
    desc: 'Правый феномен возникает из физической точки, где закончился левый: удара, якоря или конца его пути.',
    color: '#74e4ff',
    scope: 'хореография · источник'
  },
  carrier: {
    id: 'carrier',
    name: 'Носитель',
    shortName: 'НА A',
    desc: 'Правый феномен разыгрывается из существующих объектов левого: лезвий, осколков, валов или турелей.',
    color: '#d7a0ff',
    scope: 'хореография · носитель'
  },
  trail: {
    id: 'trail',
    name: 'След',
    shortName: 'ПО ПУТИ',
    desc: 'Правый феномен разыгрывается вдоль траектории, которую только что прочертил левый.',
    color: '#8ff0b0',
    scope: 'хореография · путь'
  },
  reverse: {
    id: 'reverse',
    name: 'Обратный ход',
    shortName: 'НАЗАД',
    desc: 'Правый феномен стартует в конце пути левого и разыгрывается обратно к его началу.',
    color: '#ffb06a',
    scope: 'хореография · возврат'
  },
  collapse: {
    id: 'collapse',
    name: 'Схлопывание',
    shortName: 'К ЦЕНТРУ',
    desc: 'Правый феномен использует область левого: внешние точки сходятся к общему центру и меняют рисунок розыгрыша.',
    color: '#ff7ec8',
    scope: 'хореография · схлопывание'
  },
  capacitor: {
    id: 'capacitor',
    name: 'Преобразователь массы',
    shortName: '×ЦЕЛИ',
    desc: 'Число целей, задетых слева, превращается в дополнительные срабатывания правого феномена. Урон напрямую не переносится.',
    color: '#70d8ff',
    scope: 'преобразование'
  },
  anchor: {
    id: 'anchor',
    name: 'Маршрутизатор',
    shortName: 'ЦЕНТР',
    desc: 'Естественный такт справа перенаводится на центр массы, которую только что задел левый феномен.',
    color: '#8ce5c7',
    scope: 'перенаведение'
  },
  reservoir: {
    id: 'reservoir',
    name: 'Напор массы',
    shortName: 'ТОЛПА→×N',
    desc: 'Если левый феномен за один такт задел достаточно врагов, правый сразу получает несколько дополнительных проявлений. Никакого скрытого запаса между циклами.',
    color: '#79e19b',
    scope: 'массовая связка'
  },
  echo_shard: {
    id: 'echo_shard',
    name: 'Эхо-отпечаток',
    shortName: 'ЭХО',
    desc: 'Запоминает результат слева и один раз повторяет часть результата правого в точке предыдущего воздействия.',
    color: '#86d8ff',
    scope: 'отпечаток'
  },
  relay: {
    id: 'relay',
    name: 'Реле убийств',
    shortName: 'УБИЙ→',
    desc: 'Серия убийств слева гарантированно заряжает ослабленное внеочередное проявление правого феномена.',
    color: '#ffe27a',
    scope: 'запуск'
  },
  conduit: {
    id: 'conduit',
    name: 'Сплав',
    shortName: 'СВОЙСТВО',
    desc: 'Правый феномен сохраняет свою форму, но переносит совместимое состояние/свойство результата слева на собственные цели.',
    color: '#7ee7d2',
    scope: 'слияние'
  },
  overflow: {
    id: 'overflow',
    name: 'Возврат',
    shortName: '↩',
    desc: 'Если слева было массовое успешное воздействие, после правого такта исполнение один раз возвращается к левому феномену. Меняет топологию, а не цифру урона.',
    color: '#ffb879',
    scope: 'петля'
  },
  aegis_relay: {
    id: 'aegis_relay',
    name: 'Эгида потока',
    shortName: 'ЩИТ',
    desc: 'Массовый контроль слева на следующем такте превращается в барьер. Катализатор создаёт защитную связку вместо дополнительной атаки.',
    color: '#72cfff',
    scope: 'преобразование'
  },
  backflow: {
    id: 'backflow',
    name: 'Обратная связь',
    shortName: '↶',
    desc: 'Успешный правый такт меняет следующий естественный такт слева: добавляет одно дополнительное срабатывание вместо простого усиления урона.',
    color: '#b7a0ff',
    scope: 'обратная связь'
  },
  recoil: {
    id: 'recoil',
    name: 'Отдача',
    shortName: 'ОТД',
    desc: 'Удар бьёт заметно сильнее, но отбрасывает самого носителя назад по линии прицела.',
    color: '#ff8a5c',
    scope: 'позиция'
  },
  focus: {
    id: 'focus',
    name: 'Сосредоточение',
    shortName: 'СОС',
    desc: 'Одно проявление снимается, оставшееся бьёт в полтора раза тяжелее.',
    color: '#ffd36b',
    scope: 'концентрация'
  },
  surge: {
    id: 'surge',
    name: 'Разгон',
    shortName: 'РЗГ',
    desc: 'Если предыдущий такт не задел никого, этот бьёт почти вдвое сильнее.',
    color: '#7fe4ff',
    scope: 'момент'
  },
  glut: {
    id: 'glut',
    name: 'Пресыщение',
    shortName: 'ПРС',
    desc: 'Чем больше целей задел предыдущий такт, тем тяжелее этот. Потолок роста жёсткий.',
    color: '#ff6b9d',
    scope: 'последствие'
  },
  stagger: {
    id: 'stagger',
    name: 'Расстановка',
    shortName: 'РСТ',
    desc: 'Такт наводится в самую дальнюю из целей предыдущего, а не по курсору.',
    color: '#9d7aff',
    scope: 'адресат'
  },
  splinter: {
    id: 'splinter',
    name: 'Расщеп',
    shortName: 'РЩП',
    desc: 'Два дополнительных проявления. Их сила не урезается автоматически: цена — занятый слот катализатора и более широкое распределение попаданий.',
    color: '#a0ff7a',
    scope: 'число'
  },
  brand: {
    id: 'brand',
    name: 'Клеймо',
    shortName: 'КЛМ',
    desc: 'Задетые этим тактом получают метку: следующий удар по ним тяжелее.',
    color: '#ffb347',
    scope: 'метка'
  },
  rime: {
    id: 'rime',
    name: 'Изморозь',
    shortName: 'ИЗМ',
    desc: 'Задетые этим тактом остывают и двигаются медленнее.',
    color: '#8fd6ff',
    scope: 'контроль'
  },
  harvest: {
    id: 'harvest',
    name: 'Жатва',
    shortName: 'ЖТВ',
    desc: 'Каждое убийство на такте возвращает носителю немного здоровья.',
    color: '#7affc0',
    scope: 'возврат'
  },
  vault: {
    id: 'vault',
    name: 'Панцирь толпы',
    shortName: 'ТОЛПА→ЩИТ',
    desc: 'Массовый правый такт сразу даёт барьер: чем больше разных врагов он задел, тем сильнее защита. Ничего не копит между циклами.',
    color: '#c8b6ff',
    scope: 'массовая защита'
  },
  handoff: {
    id: 'handoff',
    name: 'Передача',
    shortName: 'ПРД',
    desc: 'Следующий узел цепочки получает два дополнительных проявления.',
    color: '#ff9de2',
    scope: 'связь'
  }
};
export const initialCatalysts: (CatalystId | null)[] = ['source', 'trail', 'carrier'];
export const initialCatalystReserve: (CatalystId | null)[] = ['reverse', 'collapse'];

/**
 * Catalyst 2.0 Discovery is intentionally small. Old operators remain defined for save/replay
 * compatibility, but they are not offered: a Catalyst slot is reserved for visible A→B choreography.
 */
export const catalystOrder: CatalystId[] = ['source', 'carrier', 'trail', 'reverse', 'collapse'];
export const legacyCatalystOrder: CatalystId[] = [
  'capacitor','anchor','reservoir','echo_shard','relay','conduit','overflow','aegis_relay','backflow',
  'recoil','focus','surge','glut','stagger','splinter','brand','rime','harvest','vault','handoff'
];

export type ChoreographySignal = 'terminal' | 'path' | 'carrier' | 'area';
export type ChoreographyOperator = 'source' | 'carrier' | 'trail' | 'reverse' | 'collapse';
export interface PhenomenonChoreographyDef {
  emits: ChoreographySignal[];
  accepts: ChoreographyOperator[];
}

/**
 * Physical contract of the eleven live Phenomena. Compatibility is deliberately partial:
 * a bright 25–60% pair space is better than pretending every abstract modifier fits everything.
 */
export const phenomenonChoreography: Record<SkillId, PhenomenonChoreographyDef> = {
  frost_ring:    { emits:['area'],                         accepts:['source','carrier','trail','collapse'] },
  rail_spear:    { emits:['terminal','path'],              accepts:['source','carrier','trail','reverse','collapse'] },
  cleaver:       { emits:['terminal','area'],              accepts:['source','carrier','trail','reverse','collapse'] },
  chain_arc:     { emits:['terminal','path'],              accepts:['source','carrier','trail','reverse','collapse'] },
  // Runtime owns one continuous Orbit set. Until multiple independent orbit actors exist,
  // only a single Source origin is honest on the right side.
  orbit_blades:  { emits:['carrier','area'],               accepts:['source'] },
  // Mortar is a delayed impact actor, not a ground-travelling ray: impact is its Carrier.
  mortar_bloom:  { emits:['terminal','carrier','area'],    accepts:['source','carrier','trail','reverse','collapse'] },
  sentry:        { emits:['carrier','area'],               accepts:['source','carrier','trail','reverse','collapse'] },
  toxic_mist:    { emits:['area'],                         accepts:['source','carrier','trail','collapse'] },
  mass_driver:   { emits:['terminal','path','carrier'],    accepts:['source','carrier','trail','reverse','collapse'] },
  shard_fan:     { emits:['terminal','path','carrier'],    accepts:['source','carrier','trail','reverse','collapse'] },
  tether_drag:   { emits:['terminal','path','area'],       accepts:['source','carrier','trail','reverse','collapse'] },
  // Compatibility definitions never enter current Discovery; minimal profiles keep old saves type-safe.
  ember_lance:       { emits:['terminal','path'], accepts:['source','trail','reverse'] },
  repulse_halo:      { emits:['area'], accepts:['source','collapse'] },
  breach_line:       { emits:['terminal','path'], accepts:['source','trail','reverse'] },
  contact_saw:       { emits:['area'], accepts:['source','collapse'] },
  backhand:          { emits:['area'], accepts:['source','collapse'] },
  spreading_front:   { emits:['area'], accepts:['source','trail','collapse'] },
  pin_burst:         { emits:['terminal','area'], accepts:['source','collapse'] }
};

export function catalystPairCompatible(id: CatalystId, left: SkillId, right: SkillId) {
  if (!(['source','carrier','trail','reverse','collapse'] as CatalystId[]).includes(id)) return true;
  const l = phenomenonChoreography[left], r = phenomenonChoreography[right];
  if (!l || !r || !r.accepts.includes(id as ChoreographyOperator)) return false;
  if (id === 'source' || id === 'reverse') return l.emits.includes('terminal');
  if (id === 'carrier') return l.emits.includes('carrier');
  if (id === 'trail') return l.emits.includes('path');
  if (id === 'collapse') return l.emits.includes('area');
  return false;
}

export interface ResonanceDef {
  id: ResonanceId;
  name: string;
  shortName: string;
  description: string;
  color: string;
}
export const resonanceOrder: ResonanceId[] = [
  'tempo',
  'multiplicity',
  'precision',
  'persistence',
  'conductivity',
  'mobility'
];
export const resonance: Record<ResonanceId, ResonanceDef> = {
  tempo: {
    id: 'tempo',
    name: 'Темп',
    shortName: 'ТЕМП',
    description:
      'Сокращает длительность полного цикла Chain. Добавление феномена больше не замедляет уже взятые.',
    color: '#ffe36f'
  },
  multiplicity: {
    id: 'multiplicity',
    name: 'Множественность',
    shortName: '×N',
    description:
      'Поддерживаемые феномены получают дополнительные снаряды, прыжки, лезвия, волны или призванные объекты.',
    color: '#cf94ff'
  },
  precision: {
    id: 'precision',
    name: 'Точность',
    shortName: 'КРИТ',
    description:
      'Усиливает естественный крит и точные сценарии только у феноменов, которые поддерживают эту ось.',
    color: '#ff9fd0'
  },
  persistence: {
    id: 'persistence',
    name: 'Присутствие',
    shortName: 'ДОЛГО',
    description:
      'Увеличивает время существования полей, призванных объектов и других длительных эффектов.',
    color: '#79e19b'
  },
  conductivity: {
    id: 'conductivity',
    name: 'Проводимость',
    shortName: 'СВЯЗЬ',
    description:
      'Улучшает ёмкость, пороги и передачу эффектов катализаторов, а не отдельный камень.',
    color: '#75f0d2'
  },
  mobility: {
    id: 'mobility',
    name: 'Подвижность',
    shortName: 'ХОД',
    description:
      'Ускоряет перемещение героя; отдельные феномены используют движение как часть своего поведения.',
    color: '#7de7f4'
  }
};


export interface DoctrineDef { id: DoctrineId; name: string; shortName: string; description: string; glyph: string; color: string; }
export const doctrineOrder: DoctrineId[] = ['might','size','quantity','duration','mobility','guard','force','precision'];
export const doctrines: Record<DoctrineId, DoctrineDef> = {
  might:{id:'might',name:'Мощь',shortName:'МОЩЬ',glyph:'✦',color:'#ffb66d',description:'Увеличивает общий урон феноменов. Надёжное усиление без изменения их формы.'},
  size:{id:'size',name:'Масштаб',shortName:'РАЗМЕР',glyph:'◎',color:'#8fe8ff',description:'Увеличивает дальность ближних атак, радиус орбит и зон, а также размер физических эффектов.'},
  quantity:{id:'quantity',name:'Количество',shortName:'×N',glyph:'⁝',color:'#c89cff',description:'Добавляет дополнительные снаряды, призванные объекты или действующие элементы там, где это поддерживает оружие.'},
  duration:{id:'duration',name:'Длительность',shortName:'ВРЕМЯ',glyph:'◴',color:'#83df9b',description:'Продлевает поля, призванные объекты, следы и другие длительные эффекты.'},
  mobility:{id:'mobility',name:'Подвижность',shortName:'ХОД',glyph:'➤',color:'#75e7f4',description:'Ускоряет героя и восстановление рывка; особенно полезно сборкам, которые сражаются вблизи.'},
  guard:{id:'guard',name:'Оплот',shortName:'ЩИТ',glyph:'⬡',color:'#77bfff',description:'Попадания вблизи дают барьер, а входящий урон рядом с врагами немного снижается.'},
  force:{id:'force',name:'Импульс',shortName:'ИМП',glyph:'✺',color:'#ffd36b',description:'Сильнее отбрасывает врагов, быстрее ломает стойкость щитов элит и хрупкие укрытия.'},
  precision:{id:'precision',name:'Точность',shortName:'МЕТКА',glyph:'⌖',color:'#ff91ca',description:'Повышает шанс критического удара и пользу меток против приоритетных одиночных целей.'}
};

export const rarityOrder: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const rarityName: Record<Rarity, string> = {
  common: 'Обычный',
  uncommon: 'Необычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный ролл'
};
export const rarityMultiplier: Record<Rarity, number> = {
  common: 1,
  uncommon: 1.18,
  rare: 1.42,
  epic: 1.75,
  legendary: 2.25
};
export const rarityColor: Record<Rarity, string> = {
  common: '#9aa7b0',
  uncommon: '#7ed79d',
  rare: '#66b9ff',
  epic: '#c27aff',
  legendary: '#ffbe52'
};
export const statBase: Record<SkillStat, number> = {
  power: 0.24,
  coverage: 0.38,
  range: 0.3,
  duration: 0.38,
  crit: 0.1,
  eliteDamage: 0.24,
  count: 1,
  control: 0.32,
  statusPotency: 0.34
};

export function mutationDef(skill: SkillId, id: MutationId) {
  return skills[skill].mutations.find((m) => m.id === id)!;
}
export function mutationRoots(skill: SkillId) {
  return skills[skill].mutations.filter((m) => !m.parent);
}
export function mutationChildren(skill: SkillId, parent: MutationId) {
  return skills[skill].mutations.filter((m) => m.parent === parent);
}
