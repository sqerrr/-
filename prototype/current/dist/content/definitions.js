const A = '/assets/';
export const skills = {
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
        description: 'Точная одиночная атака: высокий крит, узкая линия, быстрый retarget.',
        upgradePool: ['power', 'range', 'count', 'statusPotency', 'crit'],
        mutations: [
            {
                id: 'ember_volley',
                name: 'Залп',
                tag: 'зачистка',
                description: 'Игла эволюционирует в веер быстрых копий: больше охват и выше общий поток попаданий.'
            },
            {
                id: 'ember_brand',
                name: 'Клеймо',
                tag: 'связка',
                description: 'Метка усиливает следующий другой Skill.'
            },
            {
                id: 'ember_furnace',
                name: 'Горн',
                tag: 'поле',
                description: 'Широкий удар оставляет горящую полосу.'
            },
            {
                id: 'ember_impaler',
                name: 'Пронзатель',
                tag: 'элита',
                description: 'Один пробивающий снаряд особенно силён против Elite.'
            },
            {
                id: 'ember_backdraft',
                name: 'Обратная тяга',
                tag: 'контроль',
                description: 'Убийство стягивает соседей и вызывает burst.'
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
                description: 'Повторный Chill вызывает shatter-burst.'
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
                description: 'Кольцо становится расширяющимся persistent Field.'
            },
            {
                id: 'frost_skin',
                name: 'Хрустальная кожа',
                tag: 'защита',
                description: 'Убийства охлаждённых целей дают Barrier.'
            },
            {
                id: 'frost_brittle',
                name: 'Хрупкость',
                tag: 'связка',
                description: 'Chill открывает цель для следующего line/strike.'
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
        upgradePool: ['power', 'range', 'crit', 'eliteDamage', 'count'],
        mutations: [
            {
                id: 'rail_rack',
                name: 'Стойка пронзателей',
                tag: 'подготовка',
                description: 'Ниже direct damage, но больше Embeds.'
            },
            {
                id: 'rail_gun',
                name: 'Рельсотрон',
                tag: 'фокус',
                description: 'Раз в два цикла — почти экранный сверхтяжёлый shot.'
            },
            {
                id: 'rail_fan',
                name: 'Веер копий',
                tag: 'зачистка',
                description: 'Три более слабых линии.'
            },
            {
                id: 'rail_harpoon',
                name: 'Гарпун',
                tag: 'контроль',
                description: 'Первая крупная цель подтягивается.'
            },
            {
                id: 'rail_spot',
                name: 'Точечное копьё',
                tag: 'связка',
                description: 'Marked-цели приоритетны и становятся Exposed.'
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
                description: 'Узкий взмах резко усиливается по low-HP целям.'
            },
            {
                id: 'cleaver_roundhouse',
                name: 'Круговой удар',
                tag: 'зачистка',
                description: 'Секач превращает фронтальный удар в полный 360° sweep без штрафа к базовой силе.'
            },
            {
                id: 'cleaver_hook',
                name: 'Крюк',
                tag: 'контроль',
                description: 'Задетые враги подтягиваются.'
            },
            {
                id: 'cleaver_rhythm',
                name: 'Ритм мясника',
                tag: 'темп',
                description: 'Убийства могут повторить взмах.'
            },
            {
                id: 'cleaver_deep',
                name: 'Глубокий порез',
                tag: 'DoT',
                description: 'Меньше direct damage, сильнее Wound.'
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
        description: 'Auto-target сеть: сильна по разбросанной толпе, слаба по одиночной цели.',
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
                name: 'Ёмкостная дуга',
                tag: 'связка',
                description: 'Неиспользованные jumps копят Charge.'
            },
            {
                id: 'arc_ground',
                name: 'Заземление',
                tag: 'фокус',
                description: 'Marked/Embedded цели приоритетны.'
            },
            {
                id: 'arc_cage',
                name: 'Дуговая клетка',
                tag: 'поле',
                description: 'Повторные hits создают electric Field.'
            },
            {
                id: 'arc_relay',
                name: 'Статический ретранслятор',
                tag: 'дальность',
                description: 'Заметно увеличивает jump range.'
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
        description: 'Контактный orbit: много мелких попаданий рядом с героем.',
        upgradePool: ['power', 'count', 'coverage', 'crit', 'eliteDamage'],
        mutations: [
            {
                id: 'orbit_many',
                name: 'Много ножей',
                tag: 'зачистка',
                description: 'Больше лезвий, меньше power каждого.'
            },
            {
                id: 'orbit_saw',
                name: 'Пильная корона',
                tag: 'элита',
                description: 'Меньше тяжёлых лезвий, лучше против Elite.'
            },
            {
                id: 'orbit_outbound',
                name: 'Вылет',
                tag: 'взрыв',
                description: 'На такте лезвия расходятся наружу.'
            },
            {
                id: 'orbit_guard',
                name: 'Защитное кольцо',
                tag: 'защита',
                description: 'Лезвия ослабляют enemy projectiles.'
            },
            {
                id: 'orbit_blood',
                name: 'Кровавая орбита',
                tag: 'масштаб',
                description: 'Wounded enemies рядом ускоряют и усиливают orbit.'
            }
        ]
    },
    mortar_bloom: {
        id: 'mortar_bloom',
        name: 'Мортирный цветок',
        shortName: 'Мортира',
        icon: A + 'skill_mortar.png',
        color: '#ffbf5a',
        directional: true,
        baseDamage: 76,
        baseRange: 14.5,
        baseRadius: 2.85,
        baseCrit: 0.03,
        axes: ['multiplicity', 'persistence', 'conductivity'],
        identity: 'Большой редкий пакет урона по плотной группе.',
        weakness: 'Плохо отвечает на ближнее давление и одиночные быстрые цели.',
        description: 'Тяжёлая артиллерия по точке: огромный pack clear, слабый темп реакции.',
        upgradePool: ['power', 'coverage', 'count', 'range', 'crit'],
        mutations: [
            {
                id: 'mortar_cluster',
                name: 'Кластерный цветок',
                tag: 'зачистка',
                description: 'Каждый залп распадается на несколько полноценных зон поражения и резко расширяет pack clear.'
            },
            {
                id: 'mortar_fuse',
                name: 'Длинный фитиль',
                tag: 'риск',
                description: 'Больше урон и Coverage, но атака визуально медленнее.'
            },
            {
                id: 'mortar_spotter',
                name: 'Наводчик',
                tag: 'фокус',
                description: 'Marked Elite притягивают точку падения.'
            },
            {
                id: 'mortar_crater',
                name: 'Кратер',
                tag: 'контроль',
                description: 'После взрыва остаётся slowing Field.'
            },
            {
                id: 'mortar_airburst',
                name: 'Воздушный разрыв',
                tag: 'геометрия',
                description: 'Шире explosion, слабее центр, без persistent Field.'
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
        identity: 'Создаёт стабильный автономный канал урона и приоритет цели.',
        weakness: 'Требует времени присутствия и хуже при постоянной смене зоны.',
        description: 'Автономный construct: стабилен против приоритетных целей, инертен при миграции.',
        upgradePool: ['power', 'range', 'duration', 'count', 'eliteDamage'],
        mutations: [
            {
                id: 'sentry_gatling',
                name: 'Гатлинг',
                tag: 'темп',
                description: 'Частые слабые shots и быстрый target switching.'
            },
            {
                id: 'sentry_rail',
                name: 'Рельсовая установка',
                tag: 'фокус',
                description: 'Медленные тяжёлые shots с Elite priority.'
            },
            {
                id: 'sentry_relay',
                name: 'Ретранслятор',
                tag: 'связка',
                description: 'Турель усиливает Chain Arc как relay.'
            },
            {
                id: 'sentry_crawler',
                name: 'Ползун',
                tag: 'мобильность',
                description: 'Construct ближе следует за игроком.'
            },
            {
                id: 'sentry_salvager',
                name: 'Утилизатор',
                tag: 'экономика',
                description: 'Elite kills с участием Sentry быстрее дают Core.'
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
        description: 'Большое persistent поле вокруг позиции героя.',
        upgradePool: ['power', 'duration', 'coverage', 'statusPotency', 'control'],
        mutations: [
            {
                id: 'toxic_corrosive',
                name: 'Коррозия',
                tag: 'поддержка',
                description: 'Toxin сильнее ослабляет защищённые цели.'
            },
            {
                id: 'toxic_contagion',
                name: 'Заражение',
                tag: 'зачистка',
                description: 'Смерть заражённого передаёт Toxin соседям.'
            },
            {
                id: 'toxic_distilled',
                name: 'Дистиллят',
                tag: 'фокус',
                description: 'Поле намного меньше, но гораздо сильнее.'
            },
            {
                id: 'toxic_plume',
                name: 'Шлейф',
                tag: 'движение',
                description: 'Туман тянется следом за героем.'
            },
            {
                id: 'toxic_reactive',
                name: 'Реактивный растворитель',
                tag: 'связка',
                description: 'Wound/Ignite превращаются в дополнительный burst.'
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
        description: 'Защитный pulse: отталкивает толпу, открывает пространство и может конвертировать контроль в Barrier.',
        upgradePool: ['control', 'coverage', 'power', 'statusPotency', 'duration'],
        mutations: [
            {
                id: 'repulse_gravity',
                name: 'Гравитационный колодец',
                tag: 'контроль',
                description: 'Push превращается в Pull: собирает врагов для следующего AoE.'
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
                description: 'Каждый реально displaced враг даёт Barrier до лимита активации.'
            },
            {
                id: 'repulse_relay',
                name: 'Кинетический релей',
                tag: 'связка',
                description: 'Величина displacement превращается в Charge следующего феномена.'
            },
            {
                id: 'repulse_rings',
                name: 'Компрессионные кольца',
                tag: 'геометрия',
                description: 'Два последовательных меньших кольца вместо одного pulse.'
            }
        ]
    },
    mass_driver: {
        id: 'mass_driver',
        name: 'Пронзающий луч',
        shortName: 'Луч',
        icon: A + 'skill_mass_driver.png',
        color: '#e891ff',
        directional: true,
        baseDamage: 24,
        baseRange: 22,
        baseRadius: 0.38,
        baseCrit: 0.01,
        axes: ['tempo', 'precision', 'conductivity'],
        identity: 'Низкий урон на цель, зато прошивает длинную плотную линию насквозь.',
        weakness: 'Очень слаб по одной изолированной цели.',
        description: 'Длинная пробивающая линия: ценность растёт с плотностью и хорошим углом.',
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
                description: 'Урон растёт за каждого minor enemy на линии.'
            },
            {
                id: 'mass_recoil',
                name: 'Отдача',
                tag: 'риск',
                description: 'Сильнее, но отталкивает самого игрока.'
            },
            {
                id: 'mass_cargo',
                name: 'Груз',
                tag: 'комбо',
                description: 'Corpses/Constructs на линии усиливают impact.'
            },
            {
                id: 'mass_terminal',
                name: 'Предельная скорость',
                tag: 'связка',
                description: 'Stored/Charge конвертируется в скорость и damage.'
            }
        ]
    }
};
export const skillOrder = [
    'ember_lance',
    'frost_ring',
    'cleaver',
    'chain_arc',
    'orbit_blades',
    'mortar_bloom',
    'sentry',
    'mass_driver'
];
// v0.9 showcase is deliberately limited to eight visually distinct Phenomena. Clean Run overrides these arrays.
export const initialSlots = [
    'ember_lance',
    'frost_ring',
    'cleaver',
    'chain_arc'
];
export const initialSkillReserve = ['mortar_bloom', 'sentry', 'mass_driver'];
export const catalysts = {
    capacitor: {
        id: 'capacitor',
        name: 'Преобразователь массы',
        shortName: '×ЦЕЛИ',
        desc: 'Число целей, задетых слева, превращается в дополнительные instances правого феномена. Не переносит урон.',
        color: '#70d8ff',
        scope: 'converter'
    },
    anchor: {
        id: 'anchor',
        name: 'Маршрутизатор',
        shortName: 'ЦЕНТР',
        desc: 'Естественный такт справа перенаводится на центр массы, которую только что задел левый феномен.',
        color: '#8ce5c7',
        scope: 'router'
    },
    reservoir: {
        id: 'reservoir',
        name: 'Резервуар событий',
        shortName: 'ПАМЯТЬ',
        desc: 'Копит массовые попадания слева между циклами. После заполнения следующий естественный такт справа получает несколько дополнительных instances.',
        color: '#79e19b',
        scope: 'memory'
    },
    echo_shard: {
        id: 'echo_shard',
        name: 'Эхо-отпечаток',
        shortName: 'ЭХО',
        desc: 'Запоминает результат слева и один раз отражает часть результата правого в точке предыдущего воздействия. Базовый понятный proc-оператор.',
        color: '#86d8ff',
        scope: 'imprint'
    },
    relay: {
        id: 'relay',
        name: 'Реле убийств',
        shortName: 'KILL→',
        desc: 'Серия убийств слева гарантированно заряжает ослабленное внеочередное проявление правого. Это один из простых trigger-вариантов.',
        color: '#ffe27a',
        scope: 'gate'
    },
    conduit: {
        id: 'conduit',
        name: 'Сплав',
        shortName: 'СВОЙСТВО',
        desc: 'Правый феномен сохраняет свою форму, но переносит совместимое состояние/свойство результата слева на собственные цели.',
        color: '#7ee7d2',
        scope: 'fusion'
    },
    overflow: {
        id: 'overflow',
        name: 'Возврат',
        shortName: '↩',
        desc: 'Если слева было массовое успешное воздействие, после правого такта исполнение один раз возвращается к левому феномену. Меняет топологию, а не цифру урона.',
        color: '#ffb879',
        scope: 'topology'
    },
    aegis_relay: {
        id: 'aegis_relay',
        name: 'Эгида потока',
        shortName: 'ЩИТ',
        desc: 'Массовый контроль слева превращается при следующем такте в Barrier. Катализатор создаёт защитный маршрут вместо дополнительной атаки.',
        color: '#72cfff',
        scope: 'converter'
    },
    backflow: {
        id: 'backflow',
        name: 'Обратная связь',
        shortName: '↶',
        desc: 'Успешный правый такт меняет следующий естественный такт слева: добавляет один instance вместо простого усиления урона.',
        color: '#b7a0ff',
        scope: 'feedback'
    }
};
export const initialCatalysts = ['anchor', 'capacitor', 'backflow'];
export const initialCatalystReserve = [
    'relay',
    'reservoir',
    'conduit',
    'aegis_relay'
];
// v0.9 slice: operators with visible topology/causality. Scalar-only stones stay defined for compatibility but are outside discovery.
export const catalystOrder = [
    'relay',
    'anchor',
    'capacitor',
    'reservoir',
    'conduit',
    'echo_shard',
    'backflow',
    'overflow',
    'aegis_relay'
];
export const resonanceOrder = [
    'tempo',
    'multiplicity',
    'precision',
    'persistence',
    'conductivity',
    'mobility'
];
export const resonance = {
    tempo: {
        id: 'tempo',
        name: 'Темп',
        shortName: 'ТЕМП',
        description: 'Сокращает длительность полного цикла Chain. Добавление феномена больше не замедляет уже взятые.',
        color: '#ffe36f'
    },
    multiplicity: {
        id: 'multiplicity',
        name: 'Множественность',
        shortName: '×N',
        description: 'Поддерживаемые феномены трактуют её как дополнительные снаряды, прыжки, лезвия, волны или constructs.',
        color: '#cf94ff'
    },
    precision: {
        id: 'precision',
        name: 'Точность',
        shortName: 'КРИТ',
        description: 'Усиливает естественный крит и точные сценарии только у феноменов, которые поддерживают эту ось.',
        color: '#ff9fd0'
    },
    persistence: {
        id: 'persistence',
        name: 'Присутствие',
        shortName: 'ДОЛГО',
        description: 'Увеличивает время существования полей, constructs и других длительных проявлений.',
        color: '#79e19b'
    },
    conductivity: {
        id: 'conductivity',
        name: 'Проводимость',
        shortName: 'СВЯЗЬ',
        description: 'Улучшает ёмкость, пороги и передачу Catalyst-операторов, а не уровень отдельного камня.',
        color: '#75f0d2'
    },
    mobility: {
        id: 'mobility',
        name: 'Подвижность',
        shortName: 'ХОД',
        description: 'Ускоряет перемещение героя; отдельные Phenomena могут естественно использовать движение как часть своей идентичности.',
        color: '#7de7f4'
    }
};
export const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const rarityName = {
    common: 'Обычный',
    uncommon: 'Необычный',
    rare: 'Редкий',
    epic: 'Эпический',
    legendary: 'Легендарный ролл'
};
export const rarityMultiplier = {
    common: 1,
    uncommon: 1.18,
    rare: 1.42,
    epic: 1.75,
    legendary: 2.25
};
export const rarityColor = {
    common: '#9aa7b0',
    uncommon: '#7ed79d',
    rare: '#66b9ff',
    epic: '#c27aff',
    legendary: '#ffbe52'
};
export const statBase = {
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
export function mutationDef(skill, id) {
    return skills[skill].mutations.find((m) => m.id === id);
}
