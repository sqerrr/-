# Исследование для core-redesign: progression, сборка билда и Chain

**Дата:** 2026-09-17.  
**Статус:** reference research / design input. Не source of truth; решения принимаются прототипом.

Цель исследования — ответить на три проблемы, найденные в v0.8:

1. почему усиление ощущается слишком линейным;
2. как сузить reward surface, не уничтожив roguelike-вариативность;
3. как сделать порядок/камни качественными операторами, а не последовательностью процентов.

## 1. Megabonk — геометрическое усиление и высокие пределы роста

Источники:

- https://megabonk.wiki/wiki/Weapons
- https://megabonk.wiki/wiki/Stats
- https://megabonk.wiki/wiki/Size_Tome
- https://megabonk.wiki/wiki/Quantity_Tome

Наблюдения:

- оружия имеют **разные доступные stat axes**, а не один универсальный upgrade pool;
- Size непосредственно увеличивает размер атак/AoE;
- Quantity добавляет projectile/attack instances;
- Damage, attack speed, size, count, duration и другие оси способны усиливать друг друга;
- некоторые общие Tome-stats имеют очень высокий max level, поэтому визуальный и численный scale не заканчивается после пары “разумных” +10%.

### Что полезно нашему проекту

Не копировать 99 уровней. Взять принцип: **геометрия является полноценной силой**, а не косметическим редким roll.

Phenomenon должен иметь небольшой набор собственных “раздувающих” осей. Например:

- Cleaver: arc width / reach / repeat arcs;
- Frost Ring: radius / ring count / propagation speed;
- Mortar: salvo count / blast radius / cluster count;
- Chain Arc: hops / branch count / transfer radius;
- Orbit: blade count / orbit radius / contact width;
- Sentry: construct count / beams / coverage;
- Rail: width / pierce / echo lanes.

Большие high-rarity rolls на таких осях могут давать **multiplicative effective clear**, а не +12% к одной и той же форме.

## 2. Noita — порядок как программа

Источники:

- https://noita.wiki.gg/wiki/Expert_Guide:_Draw
- https://noita.wiki.gg/wiki/Trigger
- https://noita.wiki.gg/wiki/Add_Trigger

Наблюдения:

- порядок элементов определяет draw/hand/payload;
- Trigger отделяет носитель от payload: содержимое может появиться в точке попадания/таймера/смерти;
- modifiers имеют область действия; часть свойств изолируется внутри payload;
- multicast меняет структуру одной активации, а не просто её damage;
- сильные сборки рождаются из композиции правил и scope.

### Что полезно нашему проекту

Catalyst между двумя Phenomena должен иметь возможность быть **оператором исполнения**.

Минимальный event packet для Chain:

```text
origin
impact_points
targets
hit_count
kills
overkill
damage
states
control/displacement
world_objects
corpse/economy
```

Примеры операторов:

- `Payload`: правый Phenomenon исполняется в impact-point левого;
- `Multicast`: число успешных targets слева создаёт несколько ослабленных правых instances;
- `Gate`: правый исполняется только при kill/state/elite-hit слева, но значительно сильнее;
- `Store/Cash-out`: несколько циклов копят packet, затем разряжают;
- `Feedback`: результат правого меняет следующий left cast;
- `Transpose`: self-centered geometry становится target-centered;
- `Convert`: control→Barrier, overkill→area, corpse→construct и т.п.

Так одна и та же пара Phenomena в другом порядке действительно создаёт другой механизм.

## 3. 20 Minutes Till Dawn — деревья и появляющиеся синергии

Источники:

- https://20minutestilldawn.wiki.gg/wiki/Upgrades
- https://20minutestilldawn.wiki.gg/wiki/Synergies
- https://20minutestilldawn.wiki.gg/wiki/Character_Upgrades

Наблюдения:

- upgrades организованы в деревья: выбор первого tier открывает более узкое продолжение;
- некоторые upgrades дают крупную геометрию (`+projectile`, `+piercing`, большой AoE);
- Synergy upgrade вообще не существует в pool, пока не собраны prerequisites;
- character-specific upgrades приходят из **Elite chests**, то есть reward channel отделён от обычного level-up;
- Boss/Tome награды также отделены.

### Что полезно нашему проекту

У нас не обязательно должны быть фиксированные деревья, но reward pool может **сужаться по уже сделанным инвестициям**, а новые synergy cards появляться только после фактического состояния билда.

Примеры:

- есть Ignite + Chill → в special pool появляется `Термошок`;
- есть Construct + Chain → `Проводящая сеть`;
- Barrier + Overkill → `Ударный щит`;
- Wound + Toxin → `Септический разрыв`.

Так рост становится вертикальным: игрок не ищет 17 независимых целей, а углубляет уже созданную структуру.

## 4. Brotato — разделение каналов и bias к текущему билду

Источники:

- https://brotato.wiki.spellsandguns.com/Shop
- secondary verified system reference: https://teemo.dev/game-design/brotato/systems/shop-economy-and-run-structure-reference/

Наблюдения:

- level-up upgrades и weapon/item shop — **разные системы**;
- shop использует bias к same weapon / same class, особенно в первых магазинах;
- есть reroll, lock и pool shaping;
- уровень не обязан одновременно решать “новое оружие или stat или support item”.

### Что полезно нашему проекту

Самая важная идея — **не всё должно выпадать из одного level-up окна**.

Кандидат для v0.9:

| Источник | Основной reward domain |
|---|---|
| XP level | рост active Phenomena / иногда Mutation milestone |
| Elite | Catalyst operators, Catalyst evolution, Ascend/Distort, сильный recovery |
| Discovery/major event | новое Phenomenon / Reserve expansion/replace |
| POI | targeted RNG, global/body stat, mutation control, risk/reward |
| Boss | Law / Legendary Opportunity |

Это резко уменьшает когнитивную ширину при сохранении общего каталога.

## 5. Halls of Torment — tiered ability progression

Доступные community/reference материалы показывают, что ability traits появляются на определённых tier/character-level thresholds, а не все одновременно. Полезный принцип: **временная недоступность вариантов — это инструмент фокуса**, а не потеря глубины.

Для нас это аргумент в пользу того, что не каждый возможный roll Phenomenon должен быть доступен на каждом уровне. После Mutation pool может специализироваться и становиться сильнее.

## 6. Почему простое “больше процентов” не решит проблему

Если Damage ×1.5, но:

- радиус тот же;
- targets те же;
- число instances то же;
- uptime тот же;
- позиционирование то же;

то ощущения могут почти не измениться, особенно когда world HP тоже растёт.

Поэтому target — не “более агрессивная таблица процентов”, а **несколько ортогональных осей, которые перемножают effective coverage**.

Условный пример (не баланс):

```text
Damage × 2
Area × 2
Instances × 2
Uptime × 1.5
```

не означает автоматически 12× реальный DPS из-за overlap/targets/caps, но даёт шанс получить именно визуальный power fantasy. Калибратор должен измерять actual effective clear, а не перемножать tooltip.

## 7. Предлагаемая модель progression для эксперимента, не финал

### 7.1 Phenomenon investment lane

У каждого active Phenomenon 3 слоя:

1. **Foundation levels** — небольшие, но не обязательные каждый level-up;
2. **Geometry/behavior milestones** — крупные дискретные изменения;
3. **Mutation/Ascension** — смена роли/правил.

Пример структуры:

```text
L1 base
L2 strong roll
L3 geometry breakpoint
L4 strong roll
L5 Mutation
L6 mutation-specific roll
L7 geometry/count breakpoint
L8 mutation-specific major
L9 Ascension eligibility
```

Важно: это только форма эксперимента. Число уровней/порогов можно менять.

### 7.2 Rarity должна менять не только величину

High rarity иногда может переводить continuous roll в discrete:

- Common Size +20%;
- Rare Size +45%;
- Epic +70%;
- Legendary “+1 extra ring и +35% radius”.

Так редкость может создавать запоминающийся high-roll.

### 7.3 Сильная горизонталь после вертикального фокуса

Новые Phenomena полезно давать реже, но заметнее. После заполнения основных slots ordinary XP должен гораздо чаще углублять существующий билд, чем предлагать 11-й потенциальный объект.

## 8. Кандидатная таксономия Catalyst scopes

Player-facing названия должны быть русскими; ниже инженерные категории.

| Scope | Смысл | Пример |
|---|---|---|
| `modifier` | меняет один соседний Phenomenon | больше ширина, но ниже сила |
| `bridge` | левый packet влияет на правый | kills→extra targets |
| `payload` | правый исполняется через событие левого | Frost Ring в точке Mortar impact |
| `bilateral` | оба соседа образуют правило | общий state pool / чередование |
| `feedback` | правый меняет следующий левый cast | hit→charge next cycle |
| `storage` | копит результаты нескольких активаций | damage bank/cash-out |
| `conversion` | переводит ресурс в другой | control→Barrier |
| `spatial` | переносит origin/targets/geometry | self AoE→remote AoE |
| `cycle` | действует на паттерн нескольких beats | every third beat repeats pair |
| `economy` | kills/corpses/pickups/reward | corpses→construct charge |

**Ограничение каталога:** ни один scope не должен занимать явное большинство support pool.

## 9. Reward architecture — кандидаты для A/B prototype

### Variant A — разделённые источники

- XP: 3 карточки, все относятся к active Phenomena; минимум 2 к уже инвестированным.
- Mutation milestone: отдельное окно внутри конкретного Phenomenon.
- Elite: 3 карты из Catalyst/Ascend/Distort/recovery.
- Discovery: новый Phenomenon или replace в Reserve.
- Global/body: редкие milestones/POI.

Плюсы: очень ясный вертикальный build.  
Риск: RNG становится слишком управляемым.

### Variant B — “выбери объект, потом эффект”

Level-up сначала показывает 3 active targets, затем 2–3 rolls только для выбранного объекта.

Плюсы: сохраняет случайность внутри выбранного направления.  
Риск: два клика/больше UI; можно решить быстрым hover/expand или одним экраном.

### Variant C — Focus slots

В Planning игрок помечает 2–3 компонента Focus. Standard XP pool сильно bias'ится к ним; Focus можно менять ограниченно/с Cold-like cost.

Плюсы: агентность без полного детерминизма.  
Риск: ещё один management layer.

**Не выбирать на бумаге.** Реализовать минимум A и B как дешёвые симуляционные/UX варианты.

## 10. Что должен измерять новый калибратор

Старый build matrix полезен, но недостаточен. Добавить power-curve snapshots:

- kills/sec по минутам;
- median TTK normal / elite;
- enemies hit per activation;
- unique area covered / sec;
- effective reach percentile;
- number of simultaneous active payloads/zones;
- geometry scale relative to L1;
- sustain generated / damage taken;
- fraction damage from state/catalyst-derived events;
- contribution entropy — не мёртв ли половина Chain;
- reward concentration — сколько level-ups ушло в main 1/2/3 Phenomena;
- upgrade regret/dead offers;
- perceptual event count/VFX budget.

Нужен отдельный тест **same components / different topology**. Успех — не просто разные hashes, а заметно различная geometry/source/state/sustain signature.

## 11. Red flags для следующего slice

Остановить расширение и пересмотреть core, если:

- хороший build к середине рана не убивает normals кратно быстрее раннего;
- high-roll почти не меняет geometry/coverage;
- >50% Catalyst pool снова описывается как “правый +X%”;
- standard level-up имеет >8–10 равноправных upgrade targets одновременно;
- Reserve регулярно получает upgrades, которые игрок не просил;
- curated topology swap меняет только damage <~25% и не меняет профиль;
- Elite order/adaptation нельзя объяснить, не читая event log;
- healing pickup существует, но его не замечают;
- enemy ranged pressure снова требует постоянного bullet-dodging.

## 12. Рекомендация по следующему этапу

Не делать “v0.9 с 20 Phenomena”.

Сделать **Power & Assembly slice**:

- 6–8 Phenomena;
- 10–14 Catalyst operators разных scopes;
- 4–5 Elites с очень сильной presentation;
- 5–6 normals;
- 2 reward-architecture variants;
- nonlinear geometry progression;
- короткий 6–8 minute run;
- telemetry power curve + manual side-by-side test.

Если это даст ощущение роста и сборки, старый широкий каталог можно возвращать поверх доказанного ядра.
