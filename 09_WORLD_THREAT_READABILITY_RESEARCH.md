# WORLD / THREAT / READABILITY — research synthesis

**Дата:** 2026-09-17.  
**Purpose:** не копировать конкретную игру, а вытащить проверенные design patterns для проблем v0.9A-R: бессмысленное перемещение по бесконечной карте, нечитаемые Elite/adaptations, projectile noise, слабая причинность Catalyst, незаметный heal и HUD без hierarchy.

## 1. Главная рамка: Question → Tell → Counter/Opportunity → Reward

Для каждого значимого enemy mechanic задаём четыре пункта:

1. **Question** — какое решение он требует прямо сейчас?
2. **Tell** — чем игра сообщает об этом до наказания?
3. **Counter/Opportunity** — что игрок реально может сделать иначе?
4. **Reward/Relief** — как игрок чувствует, что ответил правильно?

Game Developer в материалах по enemy telegraphing подчёркивает, что игрок должен понимать «вопрос» до получения урона; сложность лучше строить на перекрытии нескольких хорошо объяснённых вопросов, а не на непонимании происходящего. В другом разборе enemy AI отдельно отмечено, что сильные атаки обычно требуют более явных tells, иначе бой ощущается несправедливым.

Практическое правило Black Archive: **если mechanic нельзя описать этими четырьмя строками, он ещё не готов**.

## 2. Карта: цель должна быть видима раньше, чем игрок устанет искать

### Risk of Rain 2

Teleporter — основной objective уровня, обычно размещён далеко от spawn и виден по orange particles. В раннем patch Hopoo отдельно увеличили radius пассивных частиц с 38 до 60 и добавили rim glow, потому что игроки не находили objective. Важный урок не в конкретном teleporter, а в том, что **навигационная цель требует отдельного visual budget**.

Для Black Archive это означает:

- POI не прятать ради «исследования» в первом slice;
- minimap + world beacon/shape полезнее тайного объекта;
- exploration появляется из выбора **куда идти и чем рисковать**, а не из пиксель-хантинга.

### Vampire Survivors / Soulstone Survivors

Vampire Survivors использует карту/guide arrows, чтобы статичные важные объекты были достижимой навигационной целью. В Titan Hunt Soulstone Survivors задачи разбросаны по карте, помечены на minimap и собирают ресурс/прогресс к отдельной boss arena. Общий pattern: **движение получает смысл, когда world objective связан с прогрессией/финалом**.

Отсюда current v0.9B decision: POI имеют разные reward lanes, а количество зачищенных POI меняет состав финального Warden encounter.

## 3. Исследование ≠ лабиринт

Карта может быть конечной и всё равно бессмысленной, если вся площадь функционально одинакова. Поэтому различаем:

- **objective topology** — где находятся причины двигаться (POI, heal, boss, elite);
- **terrain topology** — как пространство меняет тактику (проходы, открытые зоны, препятствия, hazards, обходы).

v0.9B реализует первую, но ещё не вторую. Добавлять стены без pathing опасно: игрок получает бесплатные exploits, а толпа застревает. Следующий terrain slice должен сначала определить steering/navigation contract.

## 4. Enemy roster: роль должна быть видна из поведения

В официальных материалах Diablo IV recent monster redesign Blizzard формулирует похожую цель: каждый monster должен иметь clear role/identity; affixes должны быть более engaging, с меньшим overlap и лучшей visual clarity. Для monster families они также описывают разные archetypes, которые усиливают друг друга в группе.

Для нас это аргумент против восьми вариаций «бежит на игрока, но цифры другие» и против hidden +speed/+defense affixes.

Рабочий набор вопросов для normal roster:

- кто заполняет пространство дешёвой массой;
- кто пытается обогнать/обойти;
- кто держит/формирует плотную группу;
- кто оставляет опасную область;
- кто меняет target priority;
- кто взаимодействует с другими ролями.

Сложность массовой игры можно наращивать **числом и комбинациями ролей**, не превращая экран в постоянный projectile field.

## 5. Elite: Chassis + Affix + Adaptation, но каждый слой должен говорить разным языком

### Chassis

Отвечает на «что делает эта Elite всегда?» — командует, преследует, защищает, создаёт пространство, ест ресурсы, перестраивает толпу, размножает её, копирует поведение.

### Affix

Не просто modifier чисел, а второй вопрос. Current examples:

- Vanguard → coordinated surge;
- Temporal → telegraphed phase shift;
- Shielded → directional defense;
- Brood → production pressure.

### Adaptation

Не hard-counter билда и не `+50% resistance`, а изменение battlefield rule с новой слабостью:

- Screening → фронт закрыт, тыл открыт;
- Repulsor → покинь кольцо, потом punish window;
- Intercept → сломай предсказанный вектор движения, потом punish;
- Anchored → persistent field становится ресурсом/риском, Elite сама показывает точку ответа.

Так Adaptation делает игрока внимательнее к способу боя, но не говорит «твоя сборка запрещена».

## 6. VFX hierarchy: gameplay impact должен иметь visual impact

Riot VFX Style Guide формулирует четыре цели: gameplay clarity, low clutter, theme, delight; visual impact должен соответствовать gameplay impact. Их primary element должен точно сообщать gameplay purpose, secondary — поддерживать, а не конкурировать.

Для Black Archive:

- у boss attack primary = точная опасная geometry;
- у Shielded/Screening primary = направление закрытой стороны;
- у Intercept primary = линия будущего рывка;
- у Catalyst trigger primary = source→target route;
- у Heal primary = «это важный лечащий pickup», а не декоративная текстура.

Не использовать цвет как единственный discriminator. Нужны shape + motion + origin + timing.

## 7. Damage numbers / HP bars

Их задача не в том, чтобы превратить игру в spreadsheet. Они нужны как короткий feedback loop:

- HP bar над Elite/Boss показывает progress encounter;
- damage number подтверждает hit/crit/power spike;
- обычным мобам постоянные большие bars не нужны: это увеличивает clutter;
- damage numbers должны агрегироваться на коротком окне, иначе при высокой плотности получится числовой шум.

Текущая реализация агрегирует близкие DamageResolved одного target на коротком интервале и оставляет persistent bar только важным threats.

## 8. Projectile restraint

Projectile — сильный канал telegraph/counterplay именно потому, что он выделяется. Если им пользуется вся масса, он теряет смысл и конкурирует с weapon VFX. Поэтому current slice резервирует projectile в основном для Archivist Elite. Normal pressure строится через body movement, density, formations, zones и role overlap.

## 9. Chain/Catalyst — порядок полезен, непрозрачность опасна

Noita показывает мощь ordered spell grammar: modifier захватывает следующий spell, несколько modifiers могут композиционно примениться, trigger исполняет payload в новой точке. Сила — в том, что **позиция токена меняет программу**.

Но нам не нужна сложность Noita целиком. Для UX Black Archive полезно сохранить три свойства:

- порядок имеет смысл;
- Catalyst имеет конкретный source и target;
- UI может заранее показать parse/result.

Path of Exile 2 в redesign Support Gems прямо описывает проблему: разработчики не хотели, чтобы build превращался в «те же пять самых мощных supports на каждом skill», одновременно желая поощрять combo abilities. Это хорошее предупреждение против Catalyst как универсального multiplicative stat stick.

Отсюда кандидат `P C C P`, а не полностью свободное «камень даёт всё всем».

## 10. Что из research уже перенесено в v0.9B

- finite objective map + minimap;
- POI reward lanes;
- exploration → boss composition;
- off-screen important threat markers;
- behavioral Elite affixes;
- persistent visual language adaptations;
- normal projectile reduction;
- telegraphed final boss;
- heal beacon;
- hierarchy cleanup HUD;
- Catalyst first-trigger causal route;
- separation of Phenomenon XP from Resonance/general growth.

## 11. Что намеренно осталось OPEN

- terrain topology / obstacles / route geometry;
- exact mob density curve;
- sustain economy;
- boss final tuning;
- whether 3 or 4 active Phenomena is best;
- universal-slot Chain implementation;
- final art/model language for Elite variants.

## Reference links

- Riot Games — `/dev: League’s VFX Style Guide`: https://nexus.leagueoflegends.com/en-us/2017/10/dev-leagues-vfx-style-guide/
- Game Developer — `Enemy Attacks and Telegraphing`: https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing
- Game Developer — `Enemy design and enemy AI for melee combat systems`: https://www.gamedeveloper.com/design/enemy-design-and-enemy-ai-for-melee-combat-systems
- Hopoo / Risk of Rain 2 Early Access patch #3703355: https://store.steampowered.com/news/posts/?appids=632360&enddate=1556031072
- Risk of Rain 2 Wiki — Teleporter: https://riskofrain2.wiki.gg/wiki/Teleporter
- Blizzard — Diablo IV 2.5.0 PTR / Monster Combat Evolved: https://news.blizzard.com/en-us/article/24242857/the-2-5-0-ptr-what-you-need-to-know
- Blizzard — Diablo IV Feature Overview / Monster Families: https://news.blizzard.com/en-us/article/23189677/diablo-iv-feature-overview
- Noita Wiki — Wand Mechanics: https://noita.wiki.gg/wiki/Guide%3A_Wand_Mechanics
- Grinding Gear Games — Path of Exile 2 0.3.0 Support Gem System Overhaul: https://www.pathofexile.com/forum/view-thread/3826682
- Soulstone Survivors Wiki — Titan Hunt: https://soulstone-survivors.fandom.com/wiki/Titan_Hunt
