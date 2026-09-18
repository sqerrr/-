# v0.10 PRIORITY OVERRIDE — CORE REBUILD IS NOW PLAYABLE

**This section supersedes conflicting v0.9C/v0.9B progression, Catalyst and free-Elite conclusions below.**

Current experimental invariants:

- vertical baseline belongs to the run (`Core Rank`), not to individual Phenomena or Catalyst levels;
- Phenomena and Catalysts must remain viable late discoveries;
- full Chain cycle has fixed duration, so adding a Phenomenon adds throughput rather than reducing old cadence;
- Catalyst is a ready-made operator (routing/conversion/memory/fusion/feedback/topology/defence as well as simple triggers);
- Mutation should be evolution + power and uses limited reclaimable run-level capacity in this sandbox;
- Archive content must not rot through missing personal XP;
- POIs are build/RNG-control infrastructure, not a second Elite-spawn system;
- free Elite prototypes are rule-changing anomalies, not ordinary mobs plus subtle stat modifiers;
- adaptation should read recent real Chain behavior/signature and produce visible mechanical responses, not blanket resistances.

Still open after implementation: exact global axes, final Phenomenon roster, Catalyst rarity/duplicate/reforge economy, final Mutation set, POI control actions, final Elite roster/affixes, normal formations, and all balance numbers.

See `13_V010_CORE_REBUILD_SPEC.md` for authority.

---

# v0.9C PRIORITY OVERRIDE — CORE PILLARS REOPENED

**This section supersedes conflicting v0.9B progression/Elite conclusions below. Executable is still v0.9B.**

## Preserve as implementation foundation

- bounded world / minimap / POI / boss infrastructure;
- presentation bridge / canonical hit geometry;
- HP bars, damage numbers and threat indicators;
- reduced normal-projectile direction;
- active Phenomenon cap around 3–4 for the next focused experiment.

## Rejected as current design baseline

- XP that offers only active Phenomenon upgrades;
- Phenomenon acquisition mostly through sparse world nodes;
- current 55 s first Elite + 68–82 s free-roaming Elite rhythm;
- whole-run aggregate + random adaptation selection;
- current mutation pool/power budgets;
- broad Resonance axes as a solved solution, especially universal Scale;
- Catalyst balancing that routinely weakens the right Phenomenon;
- universal-slot Chain implementation before Catalyst semantics are proven.

## Open questions now ordered by priority

1. **Elite director:** how to restore frequent Elite pressure while retaining peaks/valleys and avoiding permanent overload?
2. **Adaptation:** which encounter-local player behaviors should an Elite read, and what response exposes a new weakness instead of hard-countering the build?
3. **Catalyst grammar:** which 5–7 generic event operators create the broadest modular synergy across 3–4 test Phenomena?
4. **Progression:** what hybrid of vertical XP + horizontal Elite/Discovery rewards preserves agency without allowing guaranteed one-weapon tunnelling?
5. **Mutations:** what shared budget/rules keep branches comparable while allowing very different behavior?
6. **General progression:** should Resonance be replaced by narrower Techniques/Doctrines, heavily capped, or reserved for major milestones?
7. **Chain topology:** typed edges vs universal physical cells is still open, but must be decided **after** the event grammar works.

See `11_CORE_PILLARS_INVESTIGATION_2026-09-17.md` and `12_V09C_DESIGN_TARGET.md`.

---

# Текущие решения и открытые вопросы — v0.9B

**Срез:** 2026-09-17. Текущий фокус: **WORLD / THREAT / READABILITY**. Баланс цифр сознательно идёт после проверки этого слоя руками.

## Зафиксированные решения

### 1. Карта — конечная и должна давать route decisions

Принято для current slice:

- finite arena `96 × 72` world units;
- minimap всегда доступна;
- POI заранее видимы на minimap и имеют собственную reward category;
- POI охраняет тематическая Elite;
- исследование не optional decoration: число очищенных узлов меняет состав финального boss encounter;
- убегание далеко от normals/Elite не должно полностью снимать угрозу.

Не зафиксировано навсегда: конкретный размер карты, число 6 POI, статические координаты, пороги 4+/2–3/0–1.

### 2. Terrain topology пока OPEN

v0.9B создаёт **objective topology**, но не полноценную terrain topology. На карте пока нет достаточных стен/комнат/чокпойнтов, поэтому позиционирование ещё нельзя считать решённым.

Следующий map experiment должен проверять не «больше декораций», а пространственные решения:

- открытая площадка vs узкий проход;
- безопасный маршрут vs короткий опасный;
- line-of-sight/обход вокруг landmark;
- зона, выгодная одному типу Phenomenon и неудобная другому;
- возможность удерживать/терять пространство против Elite без эксплойта AI.

Не внедрять hard obstacles до минимально надёжного crowd pathing/steering: враги, застрявшие за стеной, хуже открытой карты.

### 3. Kiting — движение должно менять форму боя, а не отменять бой

Принято:

- far normals recycle вокруг игрока;
- far Elite reacquire игрока;
- Elite/guardian остаются стратегической угрозой до убийства;
- off-screen threat indicator сообщает, где важная угроза.

Это provisional implementation. Позже лучше перейти от teleport/recycle к spawn director + navigation/pressure ring, если terrain станет сложнее.

### 4. Boss обязателен для vertical slice

Принят один финальный Warden с 3 telegraphed patterns, phase 2 и vulnerability windows.

Цель boss — проверить одновременно:

- читает ли игрок telegraph до попадания;
- заставляет ли boss двигаться иначе, чем обычная толпа;
- помогает ли built Chain справляться с разными geometry questions;
- имеет ли значение исследование карты перед финалом.

Boss не должен быть просто Elite с ×10 HP.

### 5. Projectile pressure — специальный, не базовый язык игры

Normals в current slice не должны создавать bullet-soup. Projectile остаётся у Archivist Elite как намеренно редкая, легко атрибутируемая угроза. Сложность normals должна масштабироваться через density, formation, approach vectors, role synergy, area denial и body pressure.

### 6. Enemy role важнее статического stat package

Каждый enemy/Elite modifier должен отвечать:

`Question → Tell → Counter/Opportunity → Reward/relief`.

Если отличие формулируется только как `+30% speed`, `+50% defense` или `+damage`, оно не проходит design review, если эта цифра не создаёт новый читаемый spatial behavior.

### 7. Elite = Chassis + Affix + Adaptation

- **Chassis** задаёт основную роль encounter.
- **Affix** добавляет вторую читаемую механику.
- **Adaptation** возникает в ответ на текущий бой/состояние Elite и меняет counterplay.

Adaptation обязана иметь устойчивое world presentation, не только текст. Не допускается, чтобы два разных affix/adaptation визуально выглядели одинаковой аурой другого цвета.

### 8. Adaptation notification — текст только вспомогательный

Приоритет каналов:

1. модель/силуэт/постоянный marker;
2. telegraph geometry;
3. связь с affected mobs/field;
4. короткий banner с названием и counter-hint;
5. event log — только debug/history.

Игрок не должен читать бегущую строку в бою, чтобы понять механику.

### 9. Healing должен конкурировать за визуальный приоритет

Heal current: pulse ring + vertical beacon + minimap `+`. Vital POI даёт заметный heal + barrier.

OPEN: частота heal и реальная потребность в sustain. Сейчас это нельзя оценить headless-тестом; нужен ручной survival pass после threat/readability.

### 10. Standard level-up = vertical Phenomenon growth

Принято для v0.9B:

- XP предлагает только активные Phenomena;
- global stats не находятся в standard XP pool;
- Resonance вынесен в отдельный map lane / редкие structural rewards;
- новые Phenomena — отдельный Discovery lane;
- Catalysts — Elite/POI lane.

Мотив: если universal buff предлагается рядом с локальным weapon growth, он слишком часто становится рациональным default и размывает идентичность Phenomena.

### 11. Active Phenomena: максимум 4

Current slice: до 4 активных Phenomena. 8 определений остаются в discovery pool, но один ран не должен одновременно показывать все.

OPEN после ручного теста: 3 или 4 — лучше для читаемости/сборки. Не увеличивать раньше времени.

### 12. Catalyst обязан быть видимой причинностью

На первом trigger конкретного Catalyst UI показывает:

`левый Phenomenon → Catalyst → правый Phenomenon`

и world pulse/edge glow. Это minimum viable explanation, а не финальное решение.

OPEN:

- нужен ли постоянный miniature preview в Planning;
- достаточно ли одного цвета/линии или каждому operator нужен собственный motion language;
- должен ли tooltip показывать конкретный текущий результат для этой пары, а не generic description.

### 13. Universal physical slots — promising, но не current baseline

Следующий candidate описан в `10_CHAIN_TOPOLOGY_EXPERIMENT.md`:

- 7 физических ячеек;
- max 4 Phenomena / max 3 Catalysts;
- любой token можно положить в любую ячейку;
- только Phenomenon тратит beat;
- Catalyst является operator, который связывает ближайший Phenomenon слева со следующим Phenomenon справа;
- `P C C P` допустимо как ordered composition максимум из 2 operators в первом тесте;
- leading/trailing Catalyst invalid и должен сразу объясняться UI.

Полностью свободный graph/«камень влияет на всё справа» пока отвергается как слишком непрозрачный.

## Открытые вопросы следующего ручного рана

1. Есть ли теперь причина выбирать направление на карте без ощущения «иду потому что UI сказал»?
2. Достаточно ли POI/minimap для exploration, или открытая геометрия всё равно делает маршрут тривиальным?
3. Можно ли всё ещё дешево обнулить pressure постоянным движением по периметру?
4. Наносит ли игра достаточно читаемого урона, чтобы Heal/Vital стали решениями, но не обязательной рутиной?
5. Можно ли по одному взгляду отличить Vanguard/Temporal/Shielded/Brood и понять текущую adaptation?
6. Elite действительно заставляет поменять траекторию/приоритет цели или остаётся просто крупным HP bar?
7. Warden читается как boss encounter с паттернами, а не как ещё одна куча enemies?
8. Growth конкретного Phenomenon теперь ощущается ценнее и интереснее, чем универсальный stat?
9. Catalyst route читается во время хаоса без чтения tooltip?
10. Нужны 3 или 4 Phenomena для лучшей глубины при приемлемой читаемости?

## Технические правила остаются

- deterministic fixed-step Core;
- Core/Platform/Presentation separation;
- canonical combat geometry — один источник истины для hit logic и telegraph;
- технические regression/headless тесты обязательны;
- **автоматический DPS/TTK spread не является доказательством fun или баланса**.
