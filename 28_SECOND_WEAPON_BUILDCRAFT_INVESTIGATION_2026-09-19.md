# 28 — SECOND WEAPON / BUILDCRAFT / ELITE INVESTIGATION

**Дата:** 2026-09-19  
**Статус:** research / design proposal, НЕ принятое решение и НЕ реализация.  
**Основание:** повторный плейтест после `27_WEAPON_ELITE_PROGRESSION_RESEARCH_2026-09-19.md`.

---

## 0. Зачем понадобился второй проход

Первое исследование правильно нашло четыре проблемы — похожие Phenomena, буквальное зеркало у элит, смешанные награды и слабый контроль билда — но сделало слишком осторожный вывод: в основном сохранить нынешнюю базу из 18 Phenomena и улучшить геометрию.

Новый плейтест показывает, что этого недостаточно.

Проблема не в том, что кругов/линий мало. Проблема в том, что у большинства Phenomena нет полноценного **build contract**: они не определяют одновременно

1. как игрок наносит урон;
2. какую вторичную механику создаёт;
3. за счёт каких общих статов растёт;
4. как компенсирует собственный риск;
5. как решает elite encounter;
6. во что качественно превращается через Mutation;
7. чем читается визуально без цифр урона.

Если оружие отличается только сектором/линией/кругом, это вариация delivery geometry, а не отдельный билд.

---

# 1. Главный диагноз текущего прототипа

## 1.1. Ranged сейчас структурно доминирует, а не просто «чуть сильнее»

Главная угроза рана — elite. Значит критерий ценности Phenomenon автоматически становится: **насколько безопасно и быстро он убивает элиту**.

При этом:

- `rail_spear` имеет дальность порядка 18.5;
- часть лучей/линий работает почти мгновенно;
- `cleaver` живёт примерно на радиусе 2.35;
- `contact_saw` — около 1.7;
- `backhand` — около 2.7;
- у игрока нет полноценного общего Size/Reach направления;
- `mobility` даёт лишь +4.5% move speed за ранг;
- defensive growth существует в предметах, но не является естественным спутником close-range специализации.

Следовательно игрок, выбравший melee, платит:

- временем внутри контактной опасности;
- меньшим временем на реакцию;
- более сложным чтением изометрической дистанции;
- большей зависимостью от hitbox;
- риском тел элит/мобов;
- риском enemy Echo;

и почти ничего системного за это не получает.

Это не вопрос DPS. Если просто умножить Cleaver ×2, melee станет либо всё ещё неприятным, либо внезапно имбой, но останется тем же плохим игровым контрактом.

## 1.2. AoE почти не имеет собственной победной линии

Если Elite — главный экзамен, а AoE хорошо только чистит trash, игрок рационально выбирает single-target/pierce.

Сейчас отсутствует достаточное количество механизмов, превращающих преимущества AoE/control в elite damage или elite safety:

- freeze/shatter;
- armor break через mass hits;
- charge collection from trash -> elite burst;
- linked bodyguards;
- breakable elite nodes;
- statuses, которые складываются толпой, а затем конвертируются в приоритетную цель;
- kill-driven resource;
- meaningful stagger/break.

Из-за этого «хорошо чистит trash» — слабое свойство: trash не является главным проигрышным условием.

## 1.3. Текущие Resonance axes не позволяют объявить билд

Сейчас есть:

- Tempo;
- Multiplicity;
- Precision;
- Persistence;
- Conductivity;
- Mobility.

Это полезные абстракции для Chain, но плохая замена внешнему слою character/build stats.

Особенно отсутствуют:

- Size / Reach;
- Guard / Recovery;
- Control Potency;
- Projectile/Travel Velocity;
- возможно Force;

поэтому игрок не может сказать:

> «Я взял Aura/cleave — теперь целенаправленно строю Size + Guard + Mobility».

Именно это ощущение планирования пользователь ожидает от MegaBonk-подобной системы.

## 1.4. Mutation level 2 сейчас подтверждает проблему «числа вместо нового правила»

В runtime `MutationContinuation` почти полностью представлен полями:

- `powerMul`;
- `rangeMul`;
- `radiusMul`;
- `durationMul`;
- `countAdd`.

Структурно дерево стало корректным, но содержательно второй слой часто означает «ещё +X%».

Для Mutation Core, добытого с серьёзной элиты, это слишком слабая награда.

## 1.5. Literal Elite mirror остаётся фундаментальным изъяном

Даже после data-driven расширения rival runtime в большинстве случаев по-прежнему вызывает тот же `dispatchSkill()` от лица элиты и компенсирует несоответствие через `rivalConcentration`.

То есть массовое оружие героя пытаются числом превратить в дуэльную механику.

Отсюда худший пример: отказанный Rail превращается в почти непонятный hitscan/beam, который может убить игрока прежде, чем тот понял tell.

Это не «неудачный damage multiplier». Это неправильная модель.

## 1.6. Shield Elite сейчас проверяет orbit race, а не tactical answer

Щит доворачивается к игроку примерно на `0.82 rad/s`. Фронт сильно режет входящий урон, а бок/тыл дают сравнительно небольшую награду.

В одиночной изометрической игре это означает:

- дальний билд может продолжать kite;
- ближний должен физически обежать элиту быстрее её shield tracking;
- crowd/body collision мешают обходу;
- нет shield break/overheat;
- нет committed attack, после которого shield не может мгновенно развернуться;
- нет отдельного melee counter.

То есть заявленная тактика «обойти щит» практически не является читаемым боевым циклом.

---

# 2. Что показывают другие игры — не список фич, а повторяющиеся паттерны

## 2.1. MegaBonk: оружие становится билдом за счёт совместимости со статами

Сильный урок не в конкретных пушках, а в том, что разные оружия имеют разные **upgrade surfaces**.

Примеры:

- Aura растёт от Size и Attack Speed; Size одновременно увеличивает безопасную дистанцию;
- Axe использует Damage + Duration + Projectile Count + Size;
- Aegis совмещает defense и offense, блокируя удары и выпуская shockwaves;
- Frostwalker — не основной DPS, а control/setup, который замораживает врагов для других источников;
- Bananarang меняет маршрут атаки за счёт возврата;
- Flamewalker создаёт trail и меняет ценность движения;
- Space Noodle создаёт связь между игроком и целью;
- Tomes дают отдельный ограниченный слой общих статов: Movement, Attack Speed, Damage, Shield, Size, Armor, Lifesteal, Duration, Quantity и т.д.

Ключ: игрок после раннего выбора оружия может **сформулировать следующий план роста**.

## 2.2. Vampire Survivors: сильная идентичность часто не совпадает с простой геометрией

Peachone/Ebony Wings — хороший пример: птица летает рядом с героем, а зона bombardment сама вращается вокруг игрока. Это другой пространственный ритм, а не очередной cone.

Axe имеет дуговую траекторию, а Evolution Death Spiral полностью перестраивает delivery в радиальный поток пронзающих кос.

Garlic -> Soul Eater показывает ещё более важную вещь: evolution не только увеличивает ауру. Она меняет взаимодействия — ослабляет сопротивление knockback/freeze, может порождать healing и масштабирует damage от восстановленного HP.

То есть поздняя форма становится **системой**, а не увеличенным хитбоксом.

## 2.3. Halls of Torment: melee получает survivability и utility как часть экосистемы

Shield Maiden связывает melee с Block, Regeneration и Defense, а shield bash способен воздействовать даже на Elites.

Norseman сочетает Dual Axes с Frost Nova и имеет сильные направления Vitality, Regeneration, Movement Speed и Defense.

Это важный контрпример нашей модели: melee не обязано «просто наносить больше урона вблизи». Оно может покупать право находиться рядом посредством своего же build ecosystem.

Кроме того, Abilities приходят из Tome/Scroll, отдельно от обычных Traits — полезный пример разделения progression layers.

## 2.4. Brotato: weapon family одновременно даёт identity и мягко направляет RNG

Weapon classes дают set bonuses:

- Blade — melee damage + lifesteal;
- Blunt — Armor/HP;
- другие классы дают свои характерные бонусы.

Shop также имеет шанс предлагать тот же weapon или тот же class, который игрок уже начал собирать.

Это важный принцип: **выбор билда не гарантирует рецепт, но меняет распределение вероятностей**.

## 2.5. Deep Rock Galactic: Survivor: поздний upgrade должен менять поведение

Overclocks дают хороший масштаб мутаций:

- drones получают electrical tether;
- turrets могут deploy all at once;
- projectiles split;
- devices получают дополнительные beam/field interactions;
- unstable upgrades часто имеют tradeoff.

Это существенно ближе к ожидаемому Mutation Core, чем `+35% damage`.

## 2.6. 20 Minutes Till Dawn: prerequisite synergies создают план без жёсткого рецепта

Synergies появляются только после необходимых компонентов.

Примерный урок для нас:

- игрок выбрал Frost + Burn-like effect -> в пул может войти новая cross-system карта;
- появился конкретный play pattern -> игра начинает предлагать его усиление;
- elite/boss rewards могут быть отдельным качественным слоем.

## 2.7. Soulstone Survivors: один skill имеет несколько смысловых tags

Skill одновременно может быть:

- Swing;
- Area;
- Burst;
- Frontal;
- Lasting;
- Summon;
- Missile;
- Ice/Fire/Nature и т.д.

Эти tags используются для synergy/scaling, а статусы могут запускать effect chains.

Для нашего Chain это особенно релевантно: Catalyst не обязан быть единственным источником связи между двумя Phenomena.

## 2.8. Noita: глубина рождается из события и payload, а не из формы хитбокса

Trigger/Timer/Expiration отделяют:

- носитель;
- событие;
- место исполнения;
- payload.

Нашей игре не нужна полнота Noita, но нужен тот же принцип: Phenomenon может отличаться **тем, что он делает после попадания/возврата/смерти/пересечения/заморозки/разрушения cover**, а не только формой атаки.

## 2.9. Risk of Rain 2: elite modifier — это enemy mechanic, а не копия player item

Elites получают trail, delayed explosion, shield, slow, anti-heal, support effects и т.д.

Особенно полезен принцип Mithrix: даже когда босс буквально крадёт предметы игрока, игра использует blacklist и не позволяет ему применять всё одинаково, потому что часть player mechanics не подходит AI/boss encounter.

Это почти прямое подтверждение необходимости `Phenomenon -> Elite Echo`, а не `Phenomenon -> same dispatchSkill()`.

---

# 3. Новая единица дизайна: BUILD CONTRACT

Каждый Phenomenon 2.0 должен иметь обязательные поля не только данных, но и дизайна.

## 3.1. Delivery

Как действие физически существует:

- slash;
- orbit;
- returning actor;
- traveling mass;
- companion;
- construct;
- trail;
- chain;
- anchor;
- trap;
- homing swarm;
- precision shot;
- moving front.

## 3.2. Combat verb

Что игрок делает кроме «наносит damage»:

- stagger;
- freeze;
- mark;
- corrode;
- pull to anchor;
- break armor;
- build momentum;
- store charges;
- create safe zone;
- command construct;
- detonate status;
- convert trash kills into elite burst;
- destroy cover;
- rebound from cover;
- return through enemies.

## 3.3. Scaling hooks

Какие 2–4 общие характеристики превращают Phenomenon в осознанный билд.

Например:

`Cleaver = Size + Tempo + Guard + Force`

`Rail = Precision + Velocity/Reach + Mark potency`

`Bird = Duration + Quantity + Size`

`Boulder = Size + Force + Duration/Velocity`

## 3.4. Risk compensation

Если оружие требует подойти близко, стоять на месте, вести цель или ждать возврата, оно обязано дать системную компенсацию.

Не обязательно прямую броню. Это может быть:

- stagger;
- barrier generation;
- dash recharge;
- movement scaling;
- lifesteal;
- freeze window;
- knockback;
- invulnerability slice;
- elite armor break;
- temporary safe zone.

## 3.5. Elite conversion

У каждого Phenomenon должен быть ответ на вопрос:

> «Если мой основной талант — crowd/control, как он помогает в главном elite fight?»

Возможные конверторы:

- Shatter;
- Expose;
- Break meter;
- status detonation;
- stored kills -> charged strike;
- minion links transferring damage;
- constructs switching to focus mode;
- mark priority;
- repeated close hits opening vulnerability.

## 3.6. Mutation ladder

Каждый Phenomenon должен иметь визуально и механически читаемую лестницу превращения.

## 3.7. Readability signature

Если убрать damage numbers, по двухсекундному GIF должно быть понятно:

- какое оружие сработало;
- куда оно попало;
- что изменилось после Mutation;
- что делает Elite Echo.

---

# 4. Melee нужно проектировать как отдельную экосистему

## 4.1. Ввести PROXIMITY BUDGET

Каждый close-range Phenomenon получает не только DPS budget, но и `proximity budget`.

Чем ближе и дольше игрок обязан быть у цели, тем больше оружие/его tags должны позволять получить:

- Guard;
- Mobility;
- Control;
- Reach/Size;
- sustain;
- stagger;
- escape reset.

Это не означает, что каждый Cleaver сам лечит и даёт броню. Компенсация может идти через совместимые Doctrines/traits и conditional rewards.

Но система должна гарантировать, что close-range path вообще существует.

## 4.2. Предлагаемый Close Quarters package

При наличии 2+ Phenomena с `close` tag в progression pool начинают чаще попадать:

- **Reach Doctrine** — Size/Reach;
- **Guard Doctrine** — barrier/block/damage reduction;
- **Momentum Doctrine** — speed после close hit / dash recharge;
- **Sustain Doctrine** — ограниченный heal/barrier за close combat;
- **Impact Doctrine** — stagger/force/break.

Это не бесплатные бонусы. Игрок выбирает их вместо Quantity/Precision/Duration и тем самым **объявляет архетип**.

## 4.3. Melee не должно означать радиус 1.7 навсегда

В изометрии небольшой reach особенно наказуем.

Нужна возможность построить:

- маленькое, очень опасное melee с огромной отдачей;
- средний cleave с Size;
- dash-slash;
- melee, которое после close hit порождает дальний вторичный эффект.

Последнее особенно важно: поздняя melee Mutation может получить ranged expression, **но только как награду за close condition**, чтобы не потерять identity.

Пример:

> Cleaver III: каждый close hit заряжает «Разлом». После трёх попаданий следующий dash оставляет огромную режущую волну через экран.

Это позволяет сражаться с elite, не превращая Cleaver в ещё одну Rail.

---

# 5. Вернуть SIZE / REACH — но сделать его осознанной специализацией

Удаление radius growth закрыло важный build axis.

Нужно вернуть не бесконтрольное `+radius everywhere`, а понятный внешний слой.

## 5.1. Разделить Resonance и Doctrines

### Resonance

Оставить как язык **Chain**:

- Tempo;
- Multiplicity;
- Precision;
- Persistence;
- Conductivity;
- возможно Trigger/Link intensity.

### Doctrines / Tomes

Отдельный ограниченный слой персонажа:

- **Might** — общий damage/power;
- **Size** — attack size / melee reach / zone radius;
- **Quantity** — projectiles/actors, только совместимые Phenomena;
- **Velocity** — projectile/travel speed;
- **Duration** — lasting actors/zones/statuses;
- **Mobility** — move/dash;
- **Guard** — armor/barrier/recovery;
- **Control** — force/freeze/stagger/status potency;
- **Precision** — crit/mark/weakpoint;

Не обязательно иметь все девять одновременно. Для vertical slice достаточно 6–7.

## 5.2. Ограниченные слоты создают план

Например 3 или 4 Doctrine slots на ран.

Игрок с Cleaver + Orbit может решить:

- Size;
- Guard;
- Mobility;

и сознательно отказаться от Quantity/Precision.

Игрок с Rail + Returner может взять:

- Precision;
- Velocity;
- Quantity.

Это и есть недостающая фраза:

> «Я знаю, что пытаюсь собрать».

---

# 6. Effects должны стать полноценным языком боя

Сейчас яд/slow почти не создают нового принятия решений.

Нужны statuses, у которых есть **порог, событие или конверсия**.

## 6.1. Frost

Не `-12% speed`.

Предлагаемая модель:

1. удары накапливают **Frost meter**;
2. trash при пороге действительно freeze;
3. elites не обязаны полностью останавливаться — они получают **Brittle/Crack window**;
4. следующий сильный hit делает Shatter damage / break / interrupt;
5. отдельные Mutations меняют, что происходит при Shatter.

Так frost начинает работать и против элиты.

## 6.2. Corrosion / Poison

Не только DoT.

Возможные правила:

- stacks уменьшают armor;
- на N stacks можно detonate;
- смерть заражённого распространяет часть stacks;
- elite при максимуме получает Exposed;
- cloud может наследовать status погибших.

## 6.3. Shock / Conductive

- помечает цели как nodes;
- chain предпочитает Conductive;
- два заряженных объекта соединяются arc;
- turret/construct могут использовать эти nodes.

## 6.4. Force

- knockback;
- collision with cover;
- stagger;
- interrupt;
- shield rotation/break;
- grouping.

Force должен стать реальным build axis, а не cosmetic displacement.

## 6.5. Mark / Hunt

Для single-target build:

- mark elite;
- autonomous weapons переключаются на marked target;
- повторные precision hits создают weakpoint;
- при смерти mark передаётся.

Это позволяет turret/bird/swarm иметь meaningful focus mode.

---

# 7. Радикальнее пересобрать базовый roster

Не надо защищать все нынешние 18.

Для следующего slice лучше 12–14 **поведенчески разных шасси**, чем 18 геометрических вариаций.

Ниже не финальный каталог, а кандидатная библиотека.

## 7.1. Rift Cleaver — close / impact / momentum

**Роль:** активное melee.

База:

- широкий удар вперёд;
- высокий stagger;
- close hit даёт короткий Momentum stack;
- Momentum повышает move/dash recovery, а не просто damage.

Почему существует:

- игрок получает компенсацию за нахождение рядом;
- масштабируется Size/Guard/Mobility/Force;
- может стать основой melee archetype.

## 7.2. Orbit Ward — close / orbit / guard

База:

- реальные blades/orbs вокруг игрока;
- контакт с ними наносит damage;
- часть попаданий вражеских projectile может быть перехвачена;
- Quantity меняет число объектов, Size — orbit/reach, Duration/Tempo — uptime.

Позднее может отделять blades для hunt marked elite.

## 7.3. Rail Mark — precision / priority / line

Оставить **единственным чистым instant/precision line weapon**.

База:

- пронзает;
- первый elite hit получает Mark;
- повторный rail по Mark усиливает weakpoint или вызывает delayed secondary effect.

Именно сюда подходит пользовательский пример orbital/sky laser как поздняя Mutation.

## 7.4. Frostfront — control / moving field / shatter

Не instant circle.

База:

- выпускает медленно движущийся фронт/ice wave;
- копит Frost;
- оставляет краткие ледяные patches;
- Shatter — конвертер в elite damage.

## 7.5. Arc Conductor — network / shock

Chain Arc оставить, но дать ему network identity:

- targets become charged nodes;
- constructs/anchors могут быть nodes;
- crossing arcs damage/stagger;
- mutations меняют topology.

## 7.6. Returner — returning actor

Boomerang-like Phenomenon.

База:

- летит наружу;
- зависает/зацепляется;
- возвращается к игроку;
- обратный путь — отдельное событие.

Игрок может строить positioning вокруг **двух проходов** одной атаки.

## 7.7. Grave Roller — traveling mass / force

Медленный огромный шар/валун.

База:

- физически катится по арене;
- большой damage и Force;
- ломает destructible cover;
- отбрасывает/собирает trash;
- оставляет wake/terrain effect;
- очень медленный, поэтому требует прогнозирования.

Это пример того, как geometry становится следствием физического поведения, а не наоборот.

## 7.8. Bombardier Familiar — companion / moving bombardment

Вместо нынешней неудобной Mortar Bloom.

База:

- птица/дрон/дух летает по собственной орбите/маршруту;
- периодически бомбит область;
- Mark заставляет её сделать priority pass над elite;
- Size увеличивает blast, Quantity — salvos/companions, Duration/Tempo — attack window.

Это сохраняет fantasy artillery, но убирает «появилась ещё одна удалённая круглая зона».

## 7.9. Relay Sentry — construct / network

Турель перестаёт быть stationary auto-aim DPS.

База:

- каждый construct имеет роль;
- минимум одно meaningful взаимодействие между турелями/другими Phenomena;
- они могут прокладывать beam, бросать pull-field, передавать chain, подсвечивать mark.

Без такого взаимодействия Sentry лучше удалить: нынешняя версия слишком похожа на дополнительный самонаводящийся projectile emitter.

## 7.10. Wake — trail / movement

Оружие, которое зависит от маршрута героя.

- оставляет dangerous trail;
- crossing own trail может detonate/empower;
- movement stats становятся offensive stats;
- backhand idea можно сохранить здесь как Mutation: после dash появляется delayed reverse slash по прошлой траектории.

Сам **Backhand как базовый Phenomenon убрать**.

## 7.11. Gravity Anchor — anchor / control

Замена Tether Drag.

Не тянет врагов к игроку.

- ставит anchor;
- цепляет ближайших targets;
- тянет их к anchor/оси;
- может собрать линию для Rail или зону для Frost/Grave Roller;
- elite получает partial pull/stagger, а не free displacement.

## 7.12. Sigil Wire — trap / crossing

- ставятся два anchor;
- между ними wire;
- crossing запускает damage/status/payload;
- Quantity/Duration/Size меняют сеть.

Это даёт spatial planning, которого сейчас почти нет.

## 7.13. Hunt Swarm — summon / priority

- несколько малых автономных entities;
- обычно чистят слабые targets;
- Mark переводит их в focus mode;
- смерть/возврат/перенос target могут быть trigger events.

## 7.14. Plague Engine — status / propagation

Если сохранять toxic fantasy, сделать его не «зелёным DoT кругом».

Варианты:

- infect;
- propagation on death;
- detonation at threshold;
- elite corrosion;
- cloud consumes stacks and relocates;
- late mutation создаёт движущийся plague entity/storm.

---

# 8. Что из текущего каталога я бы реально удалил/слил

## Убрать как самостоятельные базовые Phenomena

### Backhand

Идея «зависит от движения» интересная, но цена слишком велика. Игроку приходится одновременно позиционироваться относительно толпы и намеренно получать удар *позади* направления движения.

Сохранить идею как Mutation для Wake/dash/melee.

### Breach Line

Слишком близко к Rail/Mass Driver по motor pattern.

### Mass Driver

Если остаётся Rail, третий line/beam не нужен. Fantasy можно перенести в Grave Roller или физический ram.

### Spreading Front в текущем виде

Instant radial ring — снова геометрический вариант pulse. Сохранить fantasy только как **реально движущуюся wavefront**.

### Mortar Bloom в текущем виде

Удалённый circle + latency неудобен и плохо читается в auto-survivor. Если оставлять artillery fantasy — превратить в Familiar/spotter/установку с собственной жизнью и циклом.

### Repulse Halo как отдельное оружие

Force очень полезен, но 360° pulse лучше сделать:

- effect/status;
- mutation;
- Doctrine interaction;
- часть Aegis/Orbit/Cleaver.

Он не обязательно заслуживает отдельный weapon slot.

### Pin Burst в текущем виде

Удалённая impact circle слишком близка к Mortar. Fantasy pinning лучше реализовать Tripwire/Stake network.

## Сохранить, но глубоко переделать

- Rail;
- Cleaver;
- Chain Arc;
- Orbit Blades;
- Sentry;
- Frost;
- toxic fantasy;
- tether fantasy;
- Shard Fan возможно трансформировать в Returner/ricochet weapon.

---

# 9. Три уровня Mutation должны иметь разную функцию

Если продуктовая цель — потенциально три качественных шага, надо перестать проектировать их как одинаковые upgrade nodes.

## Tier I — SPECIALIZATION

Меняет роль/ритм.

Пример Rail:

- `Scar`: Rail оставляет ion scar;
- `Hunter`: Rail маркирует сильнейшую цель;
- `Splitter`: Rail разветвляется после первого elite hit.

## Tier II — ENGINE

Добавляет внутренний цикл/ресурс/trigger.

Пример Rail Scar:

- повторный hit по scar заряжает его;
- при 3 зарядах scar detonates/вызывает вертикальный strike.

Это уже не `+35% damage`.

## Tier III — APOTHEOSIS

Визуально и механически превращает билд.

Пример Rail:

- каждый charged scar вызывает sky-lance по Mark;
- несколько scars соединяются laser lattice;
- rail после попадания вызывает delayed orbital sweep вдоль старой линии.

## GIF TEST

Tier III не принимается, если без damage numbers нельзя за 2–3 секунды отличить его от Tier II.

---

# 10. Примеры Mutation масштаба

## 10.1. Frostfront

### I — Brittle

Freeze meter открывает короткое Shatter window на elite.

### II — Ice Seed

Shatter создаёт новую ледяную точку/осколки, которые копят Frost на соседях.

### III — White Tempest

По карте проходит большой ледяной смерч/движущийся фронт; либо игрок получает свободно размещаемые frost fields, которые после задержки взрываются spikes.

Обе формы приемлемы, если они реально меняют поведение.

## 10.2. Relay Sentry

### I — Role choice

Hunter / Field / Relay.

### II — Network

Две турели начинают соединяться beam/полями, передавать Shock/Frost/Gravity payload.

### III — Fortress / Walker

Конструкты временно объединяются в большую систему: лазерная решётка, walker, gravity artillery, frost citadel и т.д.

## 10.3. Cleaver

### I — Momentum

Close hit заряжает movement/guard.

### II — Breaker

Повторные close hits быстро ломают elite break meter/shield.

### III — Rift

После close condition Cleaver создаёт огромную delayed slash/wave или dash-rift через экран.

Важно: дальняя сила **заработана melee play**, а не бесплатна.

## 10.4. Orbit Ward

### I — Guard Orbit

Blades перехватывают часть projectile.

### II — Hunt release

При Mark часть blades отделяется и атакует priority target, потом возвращается.

### III — Crown

Полный orbit периодически распадается на hunting constellation и затем собирается обратно, создавая barrier/shockwave.

## 10.5. Plague Engine

### I — Corrode

Poison stacks уменьшают armor.

### II — Bloom

Смерть на high stacks распространяет infection.

### III — Pestilent Host

Создаётся самостоятельный moving plague cloud/entity, который собирает stacks с погибших и переносит их на elite.

---

# 11. Elite encounter должен перестать быть single-target DPS dummy

Пока элита — толстая центральная цель, рациональная стратегия будет тянуться к safe single-target.

Нужно изменить **структуру боя**, не только HP.

## 11.1. Elite + entourage

Часть элит приходит с функцией мобов:

- shield bearers;
- heal/support links;
- volatile minions;
- anchors;
- relay nodes;
- bodyguards.

AoE build получает реальную ценность, потому что уничтожение entourage ослабляет элиту.

Single-target build всё ещё может быстро прожечь саму элиту.

Это две разные победные линии.

## 11.2. Conversion rule

Любой полноценный build должен иметь хотя бы **2 из 3**:

A. прямой elite DPS;

B. control/survival, позволяющие безопасно продлить fight;

C. conversion: свой массовый/utility ресурс превращается в damage/break по elite.

Примеры C:

- Frost -> Shatter;
- Poison -> detonation;
- kills -> stored charges;
- AoE hits shield nodes -> break;
- constructs -> focus command;
- Force -> wall impact/stagger.

Так pure-AoE не обязан внезапно иметь +100% boss damage, чтобы быть жизнеспособным.

---

# 12. Elite Echo: отказ сохраняется тематически, но НЕ механически буквально

Новая формула:

`Refused Phenomenon -> Elite Echo Profile`

Каждый profile обязан иметь:

1. **Tell** — anticipation/telegraph;
2. **Hazard** — собственно угроза;
3. **Counter** — минимум 2 разумных способа ответа;
4. **Recovery** — окно, где melee может наказать;
5. **Readability budget** — не конфликтует с другим hard-dodge mechanic.

## 12.1. Rail Echo

НЕ тот же Rail героя.

- 0.6–0.9s tracer line;
- lock sound;
- после lock направление фиксируется;
- выстрел проходит по линии;
- cover/dash/lateral movement решают угрозу;
- после выстрела elite получает короткое recovery/exposed window.

Melee может рискнуть и использовать это окно.

## 12.2. Frost Echo

- elite создаёт moving ice fronts/patches;
- есть gaps;
- frost terrain видно заранее;
- shattered ice может быть destructible;
- не мгновенный circle под игроком.

## 12.3. Turret Echo

- elite ставит 1–2 понятных construct;
- construct можно уничтожить;
- пока жив, он создаёт sector/field/link;
- выбор: focus elite или снять устройство.

## 12.4. Tether Echo

- видимый anchor;
- delayed tether;
- leash можно разорвать расстоянием/разрушением anchor/dash timing;
- только потом pull.

## 12.5. Cleaver Echo

- committed swing;
- sector telegraph;
- длиннее melee reach;
- после промаха/удара recovery.

## 12.6. Orbit Echo

- несколько реальных blades;
- между ними безопасные gaps;
- периодический release одного blade;
- читаемый rotation.

---

# 13. Shield Elite — новая модель

Текущий tracking shield заменить на **state machine**.

## State A — Guard

- shield arc 100–130°;
- явно нарисован;
- shield имеет `guard HP / stability`;
- front damage сильно режется.

## State B — Commit

Elite делает:

- shield rush;
- bash;
- heavy attack.

Во время commitment shield НЕ умеет идеально доворачиваться.

## State C — Break / Overheat

Срабатывает от:

- накопленного front pressure;
- Force;
- repeated melee impact;
- уничтожения linked guard units;
- попадания в cover после rush.

Щит на 1.2–2.0s опускается/ломается.

## Минимум три контра

1. flank во время committed move;
2. break через pressure/Force;
3. ground/field/construct частично обходит shield.

Тогда «обойти» — один вариант, а не единственный.

---

# 14. Построения обычных мобов должны стать частью elite mechanics

Сейчас orders существуют, но слабо воспринимаются.

Нужно не просто усиливать steering, а создавать **formation purpose**.

## 14.1. Shield line

Trash держит линию перед elite/ranged unit.

- AoE/Force разрушает построение;
- melee может пробить одну точку;
- precision стреляет через gap.

## 14.2. Intercept lane

Несколько быстрых мобов режут предполагаемый маршрут отхода игрока.

Это визуально должно читаться как lane/arc, а не случайное движение.

## 14.3. Relay formation

Мобы соединены с elite линиями buff/heal/armor.

Уничтожение нескольких links даёт opening.

## 14.4. Formation readability

Нужны:

- short spawn-in formation pose;
- тонкие link lines;
- directional animation;
- distinct silhouettes;
- break animation.

Без визуального языка AI может быть умным, но игрок этого не заметит.

---

# 15. Разделить progression layers окончательно

Текущий `generateLevelOffers()` продолжает смешивать skill/catalyst/item/resonance в одном выборе.

Это нужно убрать.

## Канал 1 — CORE LEVEL

Только Character/Doctrine growth.

Пример:

- Size;
- Guard;
- Mobility.

Игрок сравнивает сопоставимые вещи.

## Канал 2 — PHENOMENON FIND

Только новые weapons/Phenomena.

Именно здесь:

- acquire;
- swap;
- Archive;
- refusal -> future Elite Echo.

## Канал 3 — CATALYST FIND

Только chain operators, уже отфильтрованные по legal/meaningful adjacency.

## Канал 4 — ITEM / ECONOMY

World/chest/elite/shop layer.

Сюда остаются экономические решения, включая `Трофейщик`.

## Канал 5 — MUTATION CORE

Редкая качественная трансформация.

Не конкурирует с +5% stat card.

---

# 16. Build steering — не deterministic recipe, а мягкая обратная связь

## 16.1. Tags

Каждый Phenomenon получает 3–6 tags:

- close;
- projectile;
- area;
- lasting;
- construct;
- summon;
- force;
- frost;
- shock;
- poison;
- return;
- trail;
- priority;
- trigger;
- guard.

## 16.2. Doctrines как объявление намерения

Выбор Size + Guard должен повышать вероятность:

- close;
- area;
- orbit;
- lasting;

а Precision + Velocity — priority/projectile/return.

Не 100%.

Примерная стартовая схема для теста:

- 55% reinforcing;
- 30% bridge/adjacent;
- 15% wildcard.

## 16.3. Conditional synergy cards

Некоторые предложения вообще не существуют, пока prerequisites не выполнены.

Примеры:

`Frost + Force -> Shatter Wave`

`Construct + Gravity -> Gravity Relay`

`Trail + Shock -> Live Wire`

`Close + Guard -> Retaliation Barrier`

Это создаёт синергию **не только через Catalysts**, но Catalysts остаются уникальным языком Chain sequencing.

## 16.4. Pity / bridge rule

Если игрок уже собрал две части потенциального архетипа и несколько соответствующих reward events подряд не увидел ни одного connector, weight connector постепенно растёт.

Это не гарантирует билд, но предотвращает ситуацию «игра видит мой план и всё равно делает вид, что его нет».

---

# 17. Как не превратить synergy layer в кашу

Опасность реальна: если every status interacts with every weapon, система становится нечитаемой.

Ограничения:

1. максимум 3–4 meaningful tags на основном UI;
2. cross-synergy только для заранее объявленных пар/категорий;
3. Catalyst остаётся способом изменить **порядок/момент/адресата**;
4. Synergy card изменяет **правило между archetypes**;
5. Mutation изменяет **сам Phenomenon**;
6. Doctrine меняет **общую характеристику персонажа**.

Это четыре разных уровня — их нельзя смешивать в одну карту.

---

# 18. Экономика: `Трофейщик` сохранить

`Убитая элита отдаёт на одно ядро больше` — хороший пример настоящего run-defining economic choice.

Он ценен именно потому, что:

- элиты являются центром игры;
- Mutation Core должен быть качественным ресурсом;
- игрок принимает greed choice ради будущей силы.

Не нужно сейчас ослаблять саму идею.

Но после того, как Mutation станет действительно transformative, возможно придётся ограничить snowball:

- только rare/legendary;
- extra core shard вместо полного ядра;
- первые N элит;
- или tradeoff в threat/escalation.

Это вопрос последующей экономики. Сначала Mutation должна заслужить свою ценность.

---

# 19. Animation/readability — не polish, а часть механики

Сейчас отсутствие анимаций мешает даже оценить баланс.

Для каждого опасного действия нужна трёхфазная модель:

## Anticipation

- pose;
- wind-up;
- ground line/sector;
- audio cue;
- target lock.

## Active

- сам actor/projectile/beam;
- impact;
- hitstop/flash/shake в разумном объёме.

## Recovery

- отдельная поза/окно;
- особенно у elites.

## Пример Rail Echo

1. elite поднимает/заряжает устройство;
2. на земле появляется tracer;
3. короткий lock sound;
4. линия фиксируется;
5. выстрел;
6. после него остаётся afterglow;
7. elite 0.7–1.0s восстанавливается.

Только после этого можно честно говорить о Rail damage.

---

# 20. Reopen / keep decisions

## Переоткрыть

### D3 — ровно 18 Phenomena

Retire как product constraint. Качество chassis важнее квоты.

### D26 — mixed level offers

Retire. Progression layers должны быть отдельными.

### Текущий набор Resonance axes как единственный общий рост

Rework: Chain Resonance отдельно, Doctrines/Tomes отдельно.

### D28/D36 — mutation depth

Сохранить branch concept, но перейти к трём качественно разным ступеням, если три Mutation levels остаются продуктовой целью.

### D41 — facsimile elite use

Заменить формальным `Elite Echo Profile` для каждого Phenomenon.

## Сохранить

### D6 — Mutation Core с серьёзных элит

Сильный принцип.

### D7/D8 — отказ игрока меняет будущих элит

Это всё ещё одна из лучших уникальных идей проекта.

Меняется только **форма наследования**.

### Economy items

Сохранить как отдельный слой.

### Chain + Catalysts

Сохранить. Но Catalysts не должны быть единственным способом получить synergy.

---

# 21. Предлагаемые четыре prototype labs

Не переписывать сразу весь каталог.

## LAB A — MELEE SANITY

Только:

- Cleaver 2.0;
- Orbit Ward;
- Frostfront;
- Rail для сравнения;
- Size / Guard / Mobility doctrines;
- один Shield Elite 2.0.

Цель:

Melee build должен честно убить elite, не превращаясь в ranged и не требуя идеального no-hit.

Метрики:

- elite TTK;
- damage taken per second of proximity;
- доля времени <4m от elite;
- barrier/heal generated;
- dash use;
- failed runs.

## LAB B — MUTATION APOTHEOSIS

Только 3 Phenomena, но каждому сделать настоящие Tier I/II/III.

Предлагаю:

- Rail;
- Frostfront;
- Sentry.

Они покрывают precision, control и construct.

Критерий:

каждый Tier III визуально отличим без UI.

## LAB C — ELITE ECHO

Только 3 отказа:

- Rail Echo;
- Frost Echo;
- Sentry Echo.

Проверить:

- tell recognition;
- dodge success;
- melee punish window;
- одновременное число hard telegraphs.

## LAB D — BUILD DECLARATION

- 3 Doctrine slots;
- Size / Guard / Quantity / Precision / Mobility / Duration;
- разделённые reward channels;
- soft-weighting по tags;
- один conditional synergy layer.

Проверить, может ли игрок после 3–5 минут словами сказать:

> «Я строю X, мне сейчас нужны Y/Z, а W мне не подходит».

Если нет — система всё ещё недостаточно зрелая.

---

# 22. Метрики для следующего плейтеста

Нужны не только total DPS.

## Build identity

- Doctrine picks;
- weapon/tag concentration;
- compatible offer rate;
- rerolls/banishes;
- процент reward picks, которые игрок считает частью плана.

## Archetype viability

Для каждого archetype:

- trash clear;
- common/uplifted/legendary elite TTK;
- damage taken;
- proximity time;
- control uptime;
- elite break count;
- conversion damage (Shatter/Detonate/etc.).

## Mutation quality

- pick rate;
- damage share;
- behavioral event count;
- visual recognition test;
- delta in play pattern до/после.

## Elite readability

- time from telegraph start to hit;
- dodge rate;
- hit rate first encounter vs repeated encounter;
- damage source ambiguity;
- simultaneous hard telegraphs.

---

# 23. Самая важная новая формула проекта

Сейчас не надо спрашивать:

> «Какая ещё геометрия нам нужна?»

Нужно спрашивать:

> **«Какой новый способ строить ран, двигаться, выживать и решать элиту создаёт этот Phenomenon?»**

Если ответ только «у него круг вместо линии» — такого Phenomenon не должно быть.

Если Mutation III отвечает только «ещё больше damage/radius» — это не Mutation III.

Если Elite Echo отвечает «тот же skill, но у AI» — это не Echo.

Если melee требует подойти ближе, но не открывает отдельную defensive/mobility/control экономику — это не жизнеспособный archetype.

Если AoE отлично чистит trash, но ничего не превращает это преимущество в решение главной угрозы — игра сама заставит игрока собирать Rail/precision.

---

# 24. Рекомендуемое направление v0.11

Приоритет не «добавить контент».

1. **Разделить progression channels.**
2. **Добавить Doctrines/Tomes и вернуть Size как управляемый build axis.**
3. **Собрать melee sanity slice.**
4. **Заменить same-skill rival casting на 3 экспериментальных Elite Echo.**
5. **Сделать 3 настоящих mutation ladders до Tier III.**
6. **Проверить elite encounter с entourage/conversion mechanics.**
7. Только после этого утвердить новый каталог 12–14 Phenomena.

Это уменьшит количество контента на коротком горизонте, но резко увеличит число **реально разных билдов**.

---

# 25. Источники / игры для сравнительного анализа

Исследование опиралось на актуальные описания и механики следующих игр/систем:

- MegaBonk — Weapons, Aura, Axe, Aegis, Frostwalker, Tomes, Stats/Conditions;
- Vampire Survivors — Ebony Wings/Peachone, Axe/Death Spiral, Garlic/Soul Eater;
- Halls of Torment — Shield Maiden, Norseman, Abilities/Traits;
- Brotato — Weapon Classes, Shop steering;
- Deep Rock Galactic: Survivor — weapon Overclocks;
- 20 Minutes Till Dawn — prerequisite Synergies, character/boss reward layers;
- Soulstone Survivors — skill tags, effect chains, skill chains;
- Noita — triggers/timers/payload grammar;
- HoloCure — Collab/Super Collab qualitative late transformations;
- Risk of Rain 2 — elite affixes and filtered item use by Mithrix;
- Path of Achra — trigger-based powers and offense/defense coupling.

Эти игры не предлагается копировать. Они использовались как набор контрпримеров к текущим проблемам прототипа.

