# v0.9C DESIGN RESET NOTICE

The executable described below is still the v0.9B implementation, but its progression/Elite/Catalyst assumptions are no longer accepted as the next design direction.

Do not extend v0.9B by merely tuning HP, damage, Elite HP, or reward percentages. The next implementation should be based on:

- `11_CORE_PILLARS_INVESTIGATION_2026-09-17.md`
- `12_V09C_DESIGN_TARGET.md`

In particular, reopen XP reward grammar, Elite cadence/adaptation, mutations, Resonance and Catalyst semantics. Preserve world/presentation infrastructure.

---

# NEXT PROTOTYPE BRIEF — v0.9B WORLD / THREAT / READABILITY

**Status:** implemented experimental slice on top of v0.9A-R.  
**Design question:** может ли текущая build-system читаться и требовать решений, если мир сам создаёт направление, враги задают разные понятные spatial questions, а Elite/Boss объясняют свои mechanics через поведение и geometry?

## Acceptance здесь качественный, не DPS-based

Milestone не считается успешным только потому, что technical tests проходят. Ручной игрок должен понимать:

- куда на карте можно/нужно идти и какую категорию награды он там получает;
- какая Elite является приоритетом и почему;
- что изменилось после Adaptation;
- где безопасно стоять/куда двигаться против конкретной угрозы;
- что сделал Catalyst;
- как исследование повлияло на финальный boss encounter.

## World

- hard bounds: X `[-48,48]`, Z `[-36,36]`;
- 6 POI:
  - Phenomenon `(14,-7)`;
  - Catalyst `(-19,9)`;
  - Resonance `(-34,-23)`;
  - Vital `(2,29)`;
  - Phenomenon `(34,21)`;
  - Catalyst `(35,-23)`;
- POI activates at close approach (~3 units), spawns a guardian and stays guarded until guardian death;
- minimap shows POI state, important pickups and important enemies;
- far normals recycle near player; far Elite reacquire rather than de-aggro forever;
- Warden spawns at `runDuration * .875`;
- finale support based on cleared POI: `>=4 → 0`, `2–3 → 1`, `0–1 → 2` visible support Elites.

### Known limitation

No hard terrain topology yet. This is an **objective-map slice**, not a finished level-layout system. Before adding blocking geometry, implement/choose crowd navigation good enough that obstacles cannot trivialize combat.

## Normal enemy language

Current roster uses 8 roles. Difficulty should rise primarily through population, role composition and coordinated pressure. Normal projectiles are not a core pressure source.

Rule: a new normal enemy must have a one-sentence spatial question. If the answer is only «у него больше HP/скорости», it is not a new role.

## Elite grammar

Every Elite encounter is read as:

`Chassis → Affix → Adaptation`.

Current discoverable affixes:

- Shielded — frontal defense;
- Vanguard — coordinated surge order to nearby normals;
- Temporal — telegraphed phase shift + post-action exposure;
- Brood — reinforcement production.

Current adaptations:

- Screening — stronger directional screen;
- Repulsor — large radius pulse + post-pulse exposure;
- Intercept — predicted dash line + post-dash exposure;
- Anchored — consumes a relevant player field and retaliates at that position.

Presentation requirement: persistent shape/link/marker must survive longer than banner text. Banner only names the rule/counter.

## Boss

Warden:

- `sweep`: sector telegraph;
- `rupture`: ray telegraph + residual hazard;
- `charge`: ray telegraph then movement along that path;
- phase 2 at 50% HP;
- exposure windows after major actions;
- may add normals in phase 2;
- canonical Core geometry drives renderer telegraph.

## Sustain/readability

- Elite/Boss HP bars;
- floating damage values;
- player HP is prominent in HUD;
- Heal pickup is a high-salience object: green world pulse + beacon + minimap `+`;
- Vital POI performs a large heal and barrier grant.

Survival balance is explicitly **not accepted yet**. Values are scaffolding until manual runs show where damage becomes meaningful.

## Progression lanes

Standard XP: **three active-Phenomenon upgrade cards only**.

Separate lanes:

- Phenomenon acquisition → Discovery / Phenomenon POI;
- Catalyst acquisition → Elite Cache / Catalyst POI;
- Resonance → Resonance POI / rare structural reward;
- Vital → sustain.

Maximum active Phenomena: **4**.

## Catalyst explanation

First trigger of each Catalyst in a run must:

- identify source Phenomenon;
- identify Catalyst/operator;
- identify target Phenomenon;
- show a color causal route in world/Chain UI;
- never require event log to know that it fired.

## HUD

Always visible priorities:

- HP / XP / time / level;
- current objective;
- minimap;
- current major Elite/Boss threat;
- Chain.

Debug metrics/log are hidden (F8 technical panel only). No decorative corner/frame blocks that look interactable.

## Next architecture experiment — not part of this acceptance

`10_CHAIN_TOPOLOGY_EXPERIMENT.md`: universal physical cells + typed ordered semantics. Do not merge it before a v0.9B manual pass unless explicitly requested.

---

## Historical v0.9A brief (superseded where it conflicts with v0.9B)

# v0.9A-R prototype brief — POWER & ASSEMBLY + PRESENTATION

**Статус:** реализованный baseline v0.9A-R от 2026-09-17: Power & Assembly + merged presentation foundation. Это всё ещё не финальная спецификация игры.  
**Главная цель:** впервые проверить руками не готовый loadout, а путь **от одного Phenomenon к собранной Chain**, где отдельный Catalyst ощущается как большой power spike, а оружия читаются по поведению без tooltip.

## 1. Что именно проверяет v0.9A

В этой итерации не пытаемся автоматически доказать баланс или “лучший билд”. Проверяем четыре человеческих ощущения:

1. понятно ли, что делает первый Phenomenon, когда на экране ещё мало шума;
2. заметно ли появление второго Phenomenon как нового независимого инструмента;
3. превращает ли первый Catalyst две отдельные атаки в **связку**, которую видно и ощущается сразу;
4. даёт ли дальнейший рост разные типы эскалации: конкретное оружие становится крупнее/множественнее, а вся Chain получает общий характер через Resonance.

Автоматические проверки v0.9A-R используются только как технические regression/smoke: компиляция, deterministic hash, выбор наград, Planning/Reserve, content contracts, presentation contracts и запуск HTTP build. Старые build-matrix/world calibration остаются историческим инструментом и не участвуют в дизайн-решениях этой итерации.

### 1.1 Presentation contract, добавленный в v0.9A-R

- gameplay Core остаётся единственным источником истины для попаданий и геометрии;
- Core публикует `CombatShape`: `circle / sector / ray`;
- `PresentationBridge` получает `Snapshot + GameEvent` и создаёт semantic visual cues;
- renderer визуализирует фактические shape/radius/target, но не вычисляет gameplay hit;
- hit/death/recoil/fade могут иметь отдельную visual lifetime после события;
- Catalyst source→target cue и v0.9A runtime growth VFX сохранены;
- jerk-prone 4-frame cast strip не возвращён.

Это пока sprite/WebGL2 renderer. Реальных glTF/skeletal actors, 3D-героя и 3D-элиток в baseline нет; Hybrid3D остаётся отдельным будущим workstream.

## 2. Два режима запуска

### Clean Run — основной режим

Это default.

Старт:

- 1 выбранный Phenomenon;
- 0 Catalysts;
- пустой Reserve;
- Resonance 0/0/0/0/0/0;
- без заранее выданного global power/tempo/fortune;
- более мягкая opening population;
- Chain фактически имеет длину до последнего занятого active-слота: пустой хвост **не создаёт мёртвые такты**.

Первый Discovery приходит очень рано и даёт второй Phenomenon. Первая убитая Elite, пока у игрока ещё нет Catalyst, гарантирует достаточно Core для первого Elite Cache. Первый новый Catalyst автоматически встаёт в первый валидный пустой edge между двумя Phenomena.

Нужная драматургия начала:

`1 оружие → 2 оружия → первый Catalyst → связка → дальнейшая специализация`.

### Showcase

Заполненная Chain/Reserve для быстрых технических проверок interaction/Planning. Не использовать Showcase для оценки ощущения прогрессии.

## 3. Reward lanes

В v0.9A зафиксирован один вариант вместо A/B.

### XP level-up

Обычный уровень даёт три карты:

- развитие активного Phenomenon A;
- развитие активного Phenomenon B;
- один Resonance всей Chain.

Reserve не участвует в обычной прокачке.

### Discovery

Отдельный milestone-канал нового Phenomenon. В текущем slice milestones: уровни 2 / 4 / 7 / 11 / 16, пока остаются не открытые Phenomena.

### Elite Cache

Главный канал Catalysts. Пока есть место и неоткрытые операторы — предлагает три новых Catalyst. После заполнения доступного Catalyst storage переключается на structural upgrades: Catalyst / Phenomenon / Resonance.

### Будущие каналы

POI / Laws / body economy пока не смешиваются в XP pool. Их вернуть отдельными каналами после проверки v0.9A.

## 4. Resonance — глобальный рост не как копия Tomes

Рабочая идея: run-wide прогрессия принадлежит **самой Chain**, а каждый Phenomenon интерпретирует её своим способом.

Шесть осей:

- **Амплитуда** — общий напор/impact;
- **Масштаб** — радиусы, ширина, дальность;
- **Множественность** — дополнительные projectiles / hops / waves / blades / constructs;
- **Темп** — скорость тактов Chain;
- **Память** — жизнь fields, constructs и состояний;
- **Проводимость** — сила передачи через Catalysts.

Ключевое правило: Resonance не должен ощущаться как “+10% ко всему одинаково”. Например, Multiplicity для Mortar означает дополнительные взрывы, для Frost — дополнительные волны, для Chain Arc — дополнительные jumps, для Orbit — новые лезвия, для Sentry — дополнительные constructs.

## 5. Рост конкретного Phenomenon

Старый обязательный `+4% scalar per level` снят. В v0.9A уровень отдельного Phenomenon состоит из:

- крупного skill-specific stat step;
- небольшого остаточного level scalar (`+1.5%`) только как фон;
- geometry breakpoints на уровнях 3 и 6;
- impact breakpoints на 4 и 7;
- Mutation на 5.

Точные числа временные. Критерий — изменение должно быть видно в геометрии/количестве/ритме, а не только в damage counter.

## 6. Catalysts — “Phenomenon = существительное, Catalyst = глагол”

Первый уровень Catalyst обязан уже содержать полный оператор. Нельзя строить центральную механику вокруг камней, которые на первом уровне дают только незаметный `+X%`.

Discoverable slice v0.9A:

- Echo Shard — переносит output слева в точку воздействия справа;
- Detonator — consumes state и превращает его в burst;
- Relay — kills слева могут повторить правый Phenomenon;
- Conduit — переносит state;
- Capacitor — сохраняет часть фактического damage и отдаёт вправо;
- Overflow — переносит overkill;
- Aegis Relay — конвертирует control/overkill в Barrier;
- Backflow — успешный правый узел усиливает левый на следующем цикле;
- Splitter — увеличивает экземпляры projectile-Phenomenon;
- Diffuser — трансформирует area;
- Reservoir — трансформирует persistence;
- Anchor — усиливает повторное попадание по маршруту слева→справа.

Scalar-only Catalysts могут оставаться в definitions для совместимости/будущих кирпичиков, но не входят в current discovery pool.

### Визуальная причинность

При прохождении активной связи renderer показывает цветной импульс `source → Catalyst → target/result`. Реакции (Echo/Detonation/Conduit/Aegis и т.п.) имеют отдельный impact cue.

Первый ручной вопрос после подбора камня:

> «Я без tooltip понял, что между этими двумя оружиями появилось новое правило?»

## 7. Readability slice: восемь Phenomena

Для текущего теста discovery ограничен восьмью более различимыми Phenomena:

1. **Ember Lance** — летящие огненные bolts;
2. **Frost Front** (`frost_ring` internal id) — расширяющаяся волна;
3. **Cleaver** — фронтальная slash-дуга;
4. **Chain Arc** — сеть переходов между целями;
5. **Orbit Blades** — постоянные вращающиеся объекты;
6. **Mortar Bloom** — наведение/trajectory → удалённый взрыв;
7. **Sentry** — persistent construct;
8. **Toxic Mist** — persistent area/cloud.

`Rail Spear`, `Mass Driver`, `Repulse Halo` остаются определены в коде, но выведены из discovery v0.9A. Причина — они слишком сильно пересекаются с уже занятыми визуальными языками “ещё один луч” / “ещё одно кольцо”. Вернуть их только после собственной чёткой роли.

### Readability contract

Каждый Phenomenon должен отличаться минимум по трём каналам из пяти:

- silhouette действия;
- origin;
- trajectory;
- rhythm;
- реакция целей/мира.

Цвет считается вспомогательным каналом, а не основной идентичностью.

Acceptance: две секунды боя без HUD должны позволять назвать, какой Phenomenon только что сработал; после нескольких апгрейдов должен быть виден **тот же глагол, но разросшийся**.

## 8. Player animation

Исходные run/cast assets — screenshot-derived и часть кадров содержит соседние фрагменты/подписи. Кроме того, v0.8 перезапускал 4-frame cast animation почти на каждый автоудар, то есть при частом Chain beat персонаж постоянно перескакивал между позами.

v0.9A временно делает следующее:

- auto-attacks больше не перезапускают full-body cast strip;
- атака читается через weapon VFX;
- locomotion использует две наиболее чистые run poses;
- между ними идёт непрерывный cross-fade, плюс плавный idle↔run blend;
- dirty frames 2–3 и cast strip не используются как locomotion loop.

Это технический readability fix, не финальная animation pipeline. Если движение всё ещё выглядит “мыльным”, следующий art-step — заново сделать согласованный 8–12-frame loop или перейти к mesh/skeletal deformation; не пытаться лечить плохой source strip ещё большим FPS.

## 9. Что намеренно НЕ балансируем сейчас

Не принимать решения по:

- “правильному” enemy HP;
- равенству DPS архетипов;
- финальному Elite TTK;
- оптимальной cadence Elite;
- точным коэффициентам Resonance;
- финальным XP thresholds.

Сначала требуется ручной ответ на Power & Assembly. World curve подстраивать после того, как собственный рост игрока вообще начал ощущаться.

## 10. Первый ручной playtest v0.9A

Не смотреть сначала на damage meter. Пройти Clean Run и зафиксировать:

1. Что делает стартовое оружие — понятно ли это за первые 10–20 секунд?
2. Стало ли визуально очевидно, что появился **второй независимый Phenomenon**?
3. Какой первый Catalyst выпал и что изменилось **сразу после вставки**?
4. Был ли момент “да, теперь связка реально сильнее двух отдельных оружий”?
5. Какая карточка Phenomenon upgrade дала видимое изменение?
6. Какая Resonance-карта была заметна без чтения чисел?
7. Какое оружие всё ещё выглядит как абстрактный эффект без собственного глагола?
8. Стал ли герой двигаться плавнее после удаления постоянного cast-strip switching?

Только после этого выбирать следующий redesign.
