> **ARCHIVED / HISTORICAL:** v0.10 handoff retained for historical rationale; it is not the current implementation authority. Current entry point: `00_START_HERE.md`.

# UPDATE 2026-09-17 — v0.10 CORE REBUILD PLAYABLE SANDBOX

**Executable is now v0.10-core-rebuild.** The v0.9C investigation below is historical reasoning; current design authority is `13_V010_CORE_REBUILD_SPEC.md`.

The owner-approved experimental direction is now implemented as a focused playable branch:

- no meaningful personal Phenomenon levels;
- no Catalyst levels / generic potency;
- run-wide Core Rank + experimental global Core Axes;
- fixed full Chain-cycle cadence so horizontal expansion no longer slows existing Phenomena;
- Archive modules do not age;
- limited Mutation Cores are run-level capacity and are reclaimable on Archive swap in this experiment;
- POIs no longer spawn guardian Elites just to deliver structural rewards;
- free Elites are six anomaly prototypes that alter movement, perception, source sequencing, Catalyst-derived events, hit-event frequency or damage-signature form;
- normal density and free-Elite cadence are deliberately raised for qualitative testing.

This is **not balance-calibrated**. Read `13_V010_CORE_REBUILD_SPEC.md`, `14_V010_IMPLEMENTATION_NOTES_2026-09-17.md`, then `prototype/current/PLAYTEST_CHECKLIST.md`.

---

# UPDATE 2026-09-17 — v0.9C DESIGN RESET / CORE PILLARS INVESTIGATION

**Executable remains v0.9B.** No gameplay code was changed in this handoff pass. This update records a new owner playtest that invalidates major assumptions in v0.9B progression/Elite/Catalyst design and therefore has priority over the v0.9B design conclusions below.

## Product verdict

v0.9B is useful as a **world/presentation foundation**, but it is **not an accepted gameplay-progression baseline**.

Preserve:

- bounded map, minimap, POI/boss infrastructure;
- presentation bridge and canonical CombatShape;
- HP bars, damage numbers, threat/offscreen indicators;
- reduced normal projectile-soup direction;
- rendering workstream separation.

Reopen/redesign:

- Elite cadence/reward economy;
- adaptation selection and presentation;
- XP reward grammar and Phenomenon acquisition cadence;
- Resonance/general-stat model;
- mutation budgets;
- Catalyst semantics and later Chain topology.

## New owner observations

1. Elites became too rare and no longer feel like the central heartbeat.
2. Sparse Phenomenon acquisition + XP-only active-Phenomenon upgrades make one-weapon tunnelling overwhelmingly rational; the Chain is optional.
3. Randomness/control was over-simplified: with one weapon, almost every level can be guaranteed into it.
4. Mutations have wildly different budgets; some repair weak base weapons and simultaneously create huge power spikes (Orbit Blades is the clearest example). Poison, Mortar and Chain Arc can also produce obviously dominant variants.
5. Coverage/expansion behaves like a near-universal S-tier choice and therefore does not create identity.
6. The defining pillars — **adaptive controllable Elites** and **interesting Catalyst/Chain combinatorics** — are still not carrying the run.
7. Catalysts should not routinely require an unconditional weakening of the target skill just to justify their existence.

## Root-cause findings from current code

- Free-roaming Elite cadence is first Elite ~55 s, then ~82 s intervals early and ~68 s later, with a low simultaneous cap. POI guardians are route-dependent and therefore cannot substitute for core Elite rhythm.
- `generateLevelOffers()` draws all three normal XP choices only from active Phenomena. With one active Phenomenon, all three offers target it. This structurally rewards refusing horizontal growth.
- Mutation is triggered at Phenomenon level 5, so tunnelling accelerates access to the strongest transformative event.
- Adaptation currently samples **whole-run aggregate** damage/movement categories and then includes random gating. It does not primarily react to what this specific Elite observed recently, so the adaptation is technically adaptive but perceptually weak.
- Coverage/Scale affects physical hit geometry across many archetypes; with dense crowds, geometry often converts directly into effective throughput and safety.
- Catalyst implementation is still largely “left output -> stored scalar/context -> right activation -> proc/damage/state”, rather than a fully expressive event-routing grammar.

## New target

Do not tune final HP/DPS first. The next gameplay experiment should prove:

1. **Elite heartbeat:** approximately the earlier project target of 25–40 meaningful Elite encounters per ~24 min, paced with intensity/recovery rather than long fixed gaps.
2. **Visible adaptation conversation:** `observe -> declare -> change question -> expose counter -> player responds` using encounter-local telemetry.
3. **Catalyst event grammar:** Phenomena expose shared events (`CAST / IMPACT / HIT / KILL / STATE / CONTROL / FIELD / CONSTRUCT / CHARGE`) and Catalysts route/transform them (`Carrier / Trigger / Transducer / Fork / Memory / Feedback`).
4. **Controlled progression:** XP can still specialize, but horizontal acquisition must arrive often enough and offer uncertainty/control balance so one-weapon tunnelling is not the free default.
5. **Mutation sidegrades:** base Phenomenon is viable; mutation specializes behavior and creates a new Chain surface rather than serving as a jackpot multiplier.

Full investigation and references: `11_CORE_PILLARS_INVESTIGATION_2026-09-17.md`.  
Focused next-target brief: `12_V09C_DESIGN_TARGET.md`.

---

# PROJECT HANDOFF — актуальный контекст, web prototype v0.9B WORLD / THREAT / READABILITY

**Дата:** 2026-09-17.  
**Текущий executable:** `prototype/current/` — Black Archive web prototype v0.9B.  
**Ключевой статус:** Power & Assembly и presentation architecture сохранены; текущий slice проверяет **осмысленную конечную карту, читаемые угрозы и связь исследования с Elite/Boss**, прежде чем снова балансировать цифры.

## UPDATE 2026-09-17 — v0.9B WORLD / THREAT / READABILITY

Этот update имеет приоритет над v0.9A/v0.9A-R ниже.

### Почему понадобился redirect

Ручной плейтест v0.9A-R выявил, что проблему нельзя решать только HP/DPS tuning:

- карта ощущалась бесконечной и не давала причины идти в конкретное место;
- от обычных мобов и даже от Elite можно было просто уйти;
- heal плохо читался, а survivability почти не требовала решений;
- Elite были заметны как «особый моб», но Chassis/Affix/Adaptation почти не читались как разные вопросы;
- билд мог пройти ран почти без перестройки Catalyst topology;
- Resonance/global growth был слишком универсально выгоден относительно Phenomenon growth;
- обычные враги отличались недостаточно, а projectile pressure давал скорее шум, чем позиционное решение;
- Catalyst mechanics всё ещё требовали чтения текста вместо визуальной причинности;
- HUD показывал отладочную информацию вместо приоритетов боя;
- 5–6 Phenomena одновременно ухудшали читаемость Chain.

### Реализованный world layer

- мир ограничен прямоугольником X `[-48,48]`, Z `[-36,36]`;
- 6 POI размещены в разных частях карты: 2 Phenomenon, 2 Catalyst, 1 Resonance, 1 Vital;
- подход к POI будит guardian Elite; структурная награда выдаётся только после его убийства;
- minimap показывает мир, игрока, POI, Elite/Boss и Heal;
- удалённые обычные враги рециклятся в боевую зону, а удалённая Elite получает `reacquire`, поэтому движение не превращается в бесплатный reset encounter;
- Warden появляется около 87.5% run timer и завершает ран после смерти;
- исследование влияет на финал **контентом**: 4+ очищенных POI → 0 дополнительных guardian supports; 2–3 → 1; 0–1 → 2. Неочищенные узлы также получают красный visual state после появления босса.

Это решает «зачем двигаться» на уровне objectives/rewards/finale, но **не завершает terrain topology**. Текущая площадка всё ещё почти открытая: стены/коридоры/чокпойнты/региональные hazards и навигация толпы остаются следующим map-layer experiment.

### Реализованный threat layer

Нормальные враги теперь должны задавать разные пространственные вопросы, а не просто иметь разные числа. Roster current slice — 8 ролей. Регулярные projectiles у normals убраны; Archivist Elite остаётся специальным исключением.

Elite identity формализована как:

`Chassis behavior + Affix behavior + Adaptation response`.

Affix redesign current:

- `Shielded` — направленная защита/обход;
- `Vanguard` — периодически командует до 7 nearby normals идти surge к предсказанной позиции игрока; affected mobs визуально связаны/подсвечены;
- `Temporal` — явно telegraph'ит точку phase shift, затем атакует и открывает короткое vulnerability window;
- `Brood` — периодически порождает дешёвую свиту.

Adaptation current:

- `Screening` — более сильный направленный экран;
- `Repulsor` — большое читаемое кольцо, которое надо покинуть; после pulse — exposure;
- `Intercept` — telegraphed линия рывка по прогнозу движения; counter = поперечное смещение;
- `Anchored` — уничтожает/наказывает player field и telegraph'ит ответ в той же точке.

Эти mechanics имеют устойчивую visual language в renderer: aura/ring/line/link, а не только fleeting text notification.

### Boss

`Warden` — первый настоящий финальный boss vertical slice:

- `Sweep` — сектор;
- `Rupture` — широкая линия + остаточная опасная зона;
- `Charge` — telegraphed dash;
- после больших действий есть короткие exposure windows;
- на 50% HP — phase 2, быстрее cadence и возможные adds;
- атаки используют canonical CombatShape, поэтому telegraph geometry совпадает с Core hit geometry.

### Readability / HUD

- floating damage numbers;
- HP bars над Elite/Boss;
- large threat panel с названием Chassis, Affix, Adaptation и её counter-hint;
- screen-edge indicators для off-screen Elite/Boss;
- Heal = pulse + world beacon + `+` на minimap;
- first-use Catalyst alert показывает фактический causal path `source → operator → target`, а edge Chain кратко вспыхивает;
- debug/stat panels скрыты по умолчанию; F8 оставлен только для технической диагностики;
- декоративные corner/frame UI, которые могли читаться как world objects, скрыты.

### Progression separation

- максимум 4 active Phenomena;
- XP теперь даёт 3 предложения роста активных Phenomena и **не предлагает Resonance/global stat**;
- Phenomenon acquisition, Catalyst acquisition и Resonance разведены по отдельным reward lanes;
- это сознательно сильнее, чем просто nerf general stats: универсальная система больше не конкурирует с identity-bearing weapon growth на каждом уровне.

### Chain topology

Current executable сохраняет 4 Phenomenon slots + 3 typed Catalyst edges. Вопрос владельца «может ли любой слот содержать Phenomenon или Catalyst и можно ли свободно переставлять их» исследован отдельно.

Рекомендуемый следующий candidate: **7 universal physical cells, но ordered typed grammar**. Только Phenomenon потребляет beat; Catalyst — zero-time operator между ближайшим левым и следующим правым Phenomenon; 2 consecutive Catalyst могут композиционно применяться слева направо. Подробности: `10_CHAIN_TOPOLOGY_EXPERIMENT.md`.

Это намеренно **не внедрено одновременно** с v0.9B, чтобы ручной тест world/threat/readability не смешивался с ещё одним крупным изменением фундаментальной Chain semantics.

### Техническая validation

`npm test` остаётся только техническим suite: build, determinism, choice lifecycle, Chain/Planning contracts, content contracts, presentation contracts. Balance/build-matrix не являются acceptance criteria текущего milestone.

---

## UPDATE 2026-09-17 — v0.9A-R: rendering workstream merge

После v0.9A в актуальную gameplay-ветку вручную перенесён presentation foundation из независимого rendering workstream. **Ветка rendering agent не копировалась целиком**, потому что она была заморожена на более старом gameplay baseline и при прямой замене откатила бы Clean Run, Resonance, reward lanes, Catalyst/VFX и исправление анимации героя.

Что теперь является частью current baseline:

- Core публикует canonical `CombatShape` (`circle / sector / ray`) из тех же геометрических параметров, которыми реально считает попадания;
- `PresentationBridge` преобразует `Snapshot + GameEvent` в semantic visual cues и хранит только presentation state;
- hit feedback использует фактическую поражённую entity, её radius и направление удара;
- death actor может кратко жить после удаления gameplay entity и делать collapse/recoil/fade без влияния на Core;
- sprite/WebGL2 renderer отображает canonical combat geometry, hit/death feedback и прежние v0.9A runtime VFX/Catalyst causality cues;
- старый дёрганый full-body 4-frame cast strip **не возвращён**: v0.9A smooth locomotion placeholder сохранён;
- добавлен `presentation_regression` в технический `npm test`.

Важно: это **не переход на настоящий 3D**. Runtime glTF/skeleton/3D hero/3D elites rendering agent ещё не реализовал. Текущий merge делает renderer честнее относительно Core и создаёт независимую presentation boundary, на которую позже можно посадить Hybrid3D без переписывания gameplay.

Контрольный deterministic headless сценарий v0.9A до и после merge даёт один и тот же hash `7a32daf1`; gameplay outcome baseline не изменился.

**Следующий продуктовый фокус: баланс и развитие Clean Run.** Rendering теперь не должен тормозить этот разбор; отдельные визуальные проблемы фиксируем только если они мешают прочитать оружие, power spike или elite response. Подробности merge: `08_RENDERING_MERGE_2026-09-17.md`.

---

## UPDATE 2026-09-17 — v0.9A POWER & ASSEMBLY реализован

После написания исходного handoff был собран следующий experimental slice `prototype/current/` v0.9A. Этот update **имеет приоритет над более старыми формулировками ниже**, где v0.9 ещё описан как будущий план.

Что теперь реализовано:

- default **Clean Run**: 1 Phenomenon, без Catalysts/Reserve/Resonance; отдельный Showcase mode;
- пустой хвост Active Chain не создаёт мёртвых тактов;
- standard XP: 2 active Phenomenon upgrades + 1 Resonance;
- Discovery — отдельный канал новых Phenomena;
- Elite Cache — основной канал Catalysts, первая убитая Elite без Catalyst гарантирует первый Cache;
- 6 Resonance axes: Amplitude / Scale / Multiplicity / Tempo / Memory / Conductivity;
- discoverable roster сокращён до 8 визуально более различных Phenomena; Rail/Mass Driver/Repulse временно parked;
- discoverable Catalyst pool сокращён до 12 более структурных operators;
- крупные skill-specific stat steps и geometry/impact breakpoints вместо обязательного `+4%`;
- VFX используют runtime count/range/coverage/Resonance сильнее; Catalyst traversal имеет source→target pulse;
- персонаж больше не перезапускает dirty 4-frame cast strip на каждом auto-attack; временно используется сглаженный 2-pose locomotion blend.

**Следующий шаг теперь — ручной qualitative Clean Run, а не новые build-matrix/calibration прогоны.** Проверяем: читаемость первого оружия, различимость второго, момент первого Catalyst spike, заметность Resonance и плавность героя. Баланс enemy HP/TTK подстраивать после этого.

Актуальные детали: `02_DECISIONS_AND_OPEN_QUESTIONS.md`, `06_NEXT_PROTOTYPE_BRIEF_v0_9.md`, `prototype/current/PLAYTEST_CHECKLIST.md`.

---

## 1. Что за проект

Это PC-first autobattler / survivors-like roguelite, где игрок строит не шесть независимых cooldown-оружий, а **упорядоченную автоматическую машину**:

`Phenomenon — Catalyst — Phenomenon — Catalyst — ...`

Игрок двигается и позиционируется, направленные Phenomena используют направление мыши, а в planning mode перестраивает Chain/Reserve. Мир отвечает частыми Elite-командирами и адаптациями. Элита должна менять состояние поля, а не быть просто мешком HP.

Визуальное направление: изометрическая/2.5D подача, mechanical simulation преимущественно в XZ. Текущий browser prototype — reference implementation, а не обязательный финальный стек.

## 2. Что уже технически доказано прототипами v0.2–v0.8

Работают и покрыты regression/headless тестами:

- deterministic fixed-step simulation и seeded hash;
- Core отделён от browser presentation;
- WebGL2 renderer;
- WASD как экранное движение + mouse-facing для directional Phenomena;
- 6 fixed beats, 5 Catalyst edges;
- planning mode с полной паузой, Active + Reserve и drag-and-drop;
- Cold при Reserve→Active;
- state/context transfer и несколько нелинейных Catalyst-семантик;
- 11 Phenomena / 55 prototype Mutations / 19 prototype Catalysts;
- все 8 Black Archive normal roles и 8 elite chassis в упрощённом виде;
- XP / healing / Elite Core;
- headless world probe и curated build matrix;
- автоматические regression-тесты выбора наград, перестановки Chain, Reserve и content contracts.

Это полезный фундамент. **Не выбрасывать deterministic/headless/telemetry подход при redesign gameplay.**

## 3. Главный результат ручного плейтеста v0.8

Автоматическая калибровка показывала разные damage/source/reaction-профили и ~1.56× spread по damage между curated builds. Ручной тест показал, что этого недостаточно: **игрок всё равно почти не ощущает принципиально разные машины и сильную эскалацию мощности**.

Следовательно:

> Статистическое различие билдов — необходимое, но не достаточное условие. Нужна перцептивная и геометрическая идентичность.

Новый acceptance-критерий сборки должен проверять не только damage/kills, но и:

- эффективную рабочую дистанцию;
- площадь/длину/число одновременно поражаемых областей;
- количество/размер/траектории payload;
- uptime persistent effects;
- control/defense/sustain profile;
- positioning demand;
- видимый маршрут states/context через Chain;
- изменение экрана и способа зачистки после крупных power spikes.

## 4. Проблемы, которые считать подтверждёнными playtest findings

### 4.1 Прогрессия слишком ровная

`+4% baseline + небольшой random roll + разумные интервалы breakpoint` не дали нужного чувства роста. Даже если итоговая математика растёт, игрок не получает перехода уровня Megabonk-подобного ощущения: в начале отдельного врага приходится долго разбирать, через несколько минут удачный билд должен буквально перерабатывать пачки.

**Вывод:** фиксированный `+4%/уровень` больше не design baseline. Нужен data-driven nonlinear level scalar и/или multiplicative/geometric axes: Size/Range, Count, Pierce/Targets, Duration/Uptime, repeat/multicast, zone count, construct count, state propagation и редкие rule-breakers.

Power curve должна иметь крупные видимые ступени, включая возможность очень сильного high-roll.

### 4.2 Reward surface слишком широкий — билд трудно сфокусировать

Текущий prototype смешивает в обычном level-up слишком много потенциальных объектов улучшения: многочисленные active/inactive Phenomena, Catalysts/их улучшения, global/player stats и новые компоненты. В результате выбор часто даёт небольшой прирост в случайное место, а вложения размазываются.

**Вывод:** число active slots и размер каталога не обязаны уменьшаться, но **каналы приобретения/прокачки должны быть разделены**. Нельзя считать хорошим UX ситуацию, где стандартный level-up одновременно конкурирует за ~17+ различных компонентных целей плюс характеристики тела.

Следующий prototype обязан сравнить вертикальные схемы reward acquisition, например:

- обычный XP level-up в основном улучшает уже активные Phenomena;
- Reserve по умолчанию не засоряет обычный pool;
- новые Phenomena/Catalysts приходят из отдельных Discovery/Elite/POI каналов;
- global/body stats получают отдельный milestone/event channel;
- elite rewards дают Catalyst/Mutation/Ascend/редкие качественные изменения, а не ещё один маленький random roll.

Это **направление эксперимента**, не финально утверждённая конкретная таблица.

### 4.3 Catalysts всё ещё недостаточно меняют Chain

v0.8 уже содержит Conduit/Detonator/Echo/Aegis/Backflow и т.п., но ручной тест не дал ощущения, что перестановка пары камней превращает билд в другую машину. Слишком большая доля каталога всё ещё читается как “что-то улучшает справа”.

**Новый принцип:** Catalyst должен иметь явный `scope`/оператор, и каталог не может доминироваться directional-right buffs.

Нужные классы поведения:

- направленный modifier;
- двустороннее отношение;
- перенос/преобразование event packet;
- payload delivery/trigger;
- обратная связь в следующий цикл;
- whole-cycle/operator;
- sustain/economy conversion;
- изменение origin/target/geometry;
- memory/storage/cash-out;
- pattern/topology operator.

Положение остаётся важным, но значение должно быть **качественным**: например self-AoE справа может возникнуть в impact-point слева; kills слева создают число зон справа; control слева превращается в Barrier; состояния меняются/детонируются; payload вкладывается в trigger.

### 4.4 Phenomena и Mutations меняются геометрически слишком слабо

Mutation нельзя принимать как удачную, если без tooltip игрок видит только больше damage/немного другой radius.

Правило для следующего slice:

> Сильный mutation/breakpoint должен быть заметен по поведению на экране без чтения чисел.

Примеры допустимого изменения: pulse→moving front; orbit→projectile interception; single mortar→cluster/field; line→embedded relay; self ring→remote ring; construct→mobile/relay construct; close sweep→wide arc/return wave.

### 4.5 AoE/close archetypes пока не имеют убедительного пути

В v0.7/v0.8 close/AoE часто формально существуют, но игроку трудно войти в толпу и реализовать их. Это связано одновременно с:

- слишком медленной геометрической прогрессией;
- ранней/средней плотностью;
- ranged pressure;
- недостаточным sustain/defense;
- reward dilution.

Нужны реальные defensive/sustain archetypes: Barrier, projectile interception, push/slow, healing/conversion, recovery pickups; не универсальный lifesteal всем подряд.

### 4.6 Enemy projectile pressure всё ещё нужно снижать

Замечание относится **к мобам, не к projectile-билдам игрока**. Наша игра не должна превращаться в Touhou/bullet-hell по умолчанию.

Ranged enemies должны чаще использовать:

- редкие читаемые shots;
- телеграфируемые volleys;
- зоны/линии;
- delayed artillery;
- dash/intercept/formation/control;

а не просто повышать число одновременно летящих пуль.

### 4.7 Early population всё ещё можно уменьшить

v0.8 уже мягче v0.7, но владелец проекта считает старт всё ещё потенциально перегруженным. Следующий slice должен начинаться с пространства для наблюдения за первым Phenomenon и позволять power curve позже догнать/перегнать world pressure.

Не задавать “survivors feel” только количеством тел. Улучшить инструменты убийства и геометрический рост прежде, чем снова повышать density.

### 4.8 Элиты недостаточно читаются как командиры/адаптация мира

Их нужно усилить не только HP. Игрок должен **в каждый момент видеть, что именно элитка делает с миром**.

Требования:

- долгоживущий визуальный канал/аура/связи к affected mobs/terrain;
- понятная редкость chassis/affix/adaptation;
- effect label не исчезает через секунду: краткое постоянное объяснение доступно, пока Elite жива;
- адаптация визуально изменяет и элитку, и affected entities;
- приказ/состояние мира видно в пространстве;
- после смерти эффект заметно пропадает/инвертируется;
- Elite должна быть существенно сильнее обычного моба, а reward — отдельным power event.

Текущий target 6–15/8–20 sec TTK для массовой обычной Elite **не финализирован**; после playtest допускается более редкая/более тяжёлая кривая, если эффект элитки читаем и награда оправдывает encounter.

### 4.9 Pickups/sustain плохо читаются

Healing/Core/другие важные сущности должны иметь приоритетную визуальную иерархию, edge indicator/beam/pulse либо другой способ заметить их среди толпы. Если pickup существует математически, но игрок его не видит, механика фактически отсутствует.

### 4.10 Взаимодействия Chain должны быть визуально причинными

Если Conduit/Echo/Detonator/другая связь математически сработала, игрок должен увидеть:

`источник → Catalyst → цель/результат`.

Нужны временные VFX-связи, цвет/символ Catalyst на результирующем payload, compact combat annotations и inspection overlay. Сейчас часть interactions существует только в логах.

## 5. Что остаётся core baseline

Несмотря на redesign, пока сохраняются:

- ordered Chain как главная гипотеза идентичности;
- Catalysts как отдельные компоненты отношений, а не generic item inventory;
- planning mode с **полной паузой** как нормальный default UX для перестановок;
- небольшой Reserve;
- Mutations как крупные поведенческие развилки;
- high-roll / broken-feeling runs как желательная часть roguelike;
- frequent/meaningful Elites и adaptive world response;
- нормальные враги с функциональными ролями;
- POI как будущий targeted RNG/risk layer;
- deterministic/headless simulation и telemetry;
- Core/Platform separation и переносимость;
- AI/MCP только optional layer.

## 6. Что больше НЕ считать подтверждённым baseline

- `+4% Skill scalar за каждый уровень` как обязательную формулу;
- “small continuous roll почти каждый level” как достаточное ощущение progression;
- текущую схему обычного level-up, где смешаны почти все типы наград;
- текущий каталог Catalyst как доказательство, что Chain работает;
- показатель build-matrix spread 1.4–1.6× как доказательство meaningful build identity;
- текущий Elite TTK/cadence как окончательный;
- текущую раннюю density curve;
- текущий набор визуальных VFX взаимодействий как достаточный;
- v0.8 mutations как design-complete — это implementation test content.

## 7. Рекомендуемый следующий prototype: v0.9 “Power & Assembly”

Не расширять ещё каталог. Сначала сделать маленький качественный эксперимент поверх существующего core.

### Обязательные эксперименты

1. **Vertical reward lanes.** Разделить standard XP, component acquisition, Catalyst progression, body/global stats и elite rewards.
2. **Nonlinear weapon growth.** Для 6–8 Phenomena дать крупные geometry/count/range/duration breakpoints и high-roll multipliers.
3. **Catalyst operators.** Оставить 10–14, но минимум половина должна менять payload/origin/state/time/feedback, а не коэффициент справа.
4. **Visual causality.** Любая Chain-связка имеет видимый source→operator→result язык.
5. **Elite presence.** 4–5 chassis, но очень хорошо читаемые ауры/links/orders/adaptation + сильная награда.
6. **Enemy pressure.** Ещё мягче старт; ranged threats — телеграфы/зоны вместо bullet carpet.
7. **Sustain readability.** Pickups заметны; close builds имеют 2–3 разных жизнеспособных defensive routes.
8. **Simulation v2.** Сравнивать не только финальный damage, а power curve по времени и geometry/coverage metrics.

### Acceptance для progression

Нужна хотя бы одна curated strong-run симуляция/ручной прогон, где к 1/3–1/2 тестового рана эффективная зачистка выросла **кратно**, а на экране это видно без DPS meter: больше площадь, targets, повторов, объектов, реакций или другой качественный rule change.

Не ставить целью равный DPS всех архетипов. Нужно, чтобы разные билды были жизнеспособны, но сильный high-roll имел право заметно обгонять медиану.

## 8. Исследовательские выводы по референсам

Подробно: `05_CORE_REDIRECT_RESEARCH.md`.

Коротко:

- **Megabonk:** отдельные weapon-stat pools и высокие уровни Size/Quantity/Attack Speed дают геометрическое и мультипликативное ощущение снежного кома; разные оружия вообще имеют разные доступные оси.
- **Noita:** modifier/trigger/payload и порядок создают качественно другую машину; особенно важна область действия модификатора и вложенный payload, а не только проценты.
- **20 Minutes Till Dawn:** upgrade trees уменьшают хаос, а отдельные Synergy upgrades появляются только после prerequisite-комбинаций; elite chests несут отдельный reward class.
- **Brotato:** разделяет level-up stats и магазин оружия/items; early same-class/same-weapon bias помогает сборке не распадаться на случайный шум.

Заимствовать принципы, не интерфейсы целиком.

## 9. Текущий web prototype

Путь: `prototype/current/`.

Запуск Windows:

```powershell
.\run.ps1
```

Технические тесты:

```powershell
npm test
```

`npm test` теперь намеренно проверяет только build/determinism/choice/planning/content plumbing. Старые `world_probe`/`build_matrix` сохранены как `npm run legacy:calibrate`, но **не используются сейчас как design acceptance**.

Важно: v0.9A — текущий qualitative experiment. Следующий шаг — ручной Clean Run по `prototype/current/PLAYTEST_CHECKLIST.md`, а не расширение каталога или попытка автоматически “добалансировать” DPS.

## 10. Техническое направление

Сохранять:

- deterministic fixed-step;
- seed + decision/input log;
- headless mode;
- canonical hash;
- data-driven definitions;
- telemetry по source/skill/catalyst/elite;
- WebGL2 reference renderer;
- hard Core/Platform boundary;
- переносимый gameplay core как спецификацию для будущего native/Delphi foundation.

Delphi architecture proposal по-прежнему proposal. Не объявлять его принятым ADR без отдельного решения.
