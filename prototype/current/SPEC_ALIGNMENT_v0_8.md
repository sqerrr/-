# v0.8 — сверка с текущими design specs

Это не новый источник истины. Документ фиксирует, где текущий исполняемый prototype совпадает со спеками, а где остаётся намеренно неполным.

## Уже близко к baseline

### Chain / Planning

- 6 фиксированных Skill beats и 5 Catalyst edges.
- Beat cadence остаётся независимой от пустых slots.
- Active + Reserve: 3 Skill / 4 Catalyst reserve slots.
- Reserve → Active Skill получает COLD и пропускает первую активацию.
- Planning полностью останавливает бой.

Отклонение: prototype применяет перестановку сразу во время paused planning; строгий commit только на cycle boundary из спеки пока не моделируется как отдельная транзакция.

### Skill progression

- `BaseDamage * (1 + 0.04*(level-1))` сохранён.
- Есть skill-specific random rolls и rarity weights с Fortune.
- Mutation на level 5 перевзвешивает дальнейшие rolls.
- Добавлены prototype breakpoints на level 3/8 для проверяемой perceptual progression.

Отклонение: полный набор runtime-stat axes и level-9 Ascension/Distortion ещё не реализован.

### State grammar / ChainContext

Используемая subset grammar: Ignite, Chill, Wound, Toxin, Mark, Exposed, Embed, Displaced. ChainContext переносит damage, kills, overkill, control, last state, hit targets и impact point.

Реализованы producer/consumer-style реакции и transfer через Conduit/Detonator/Echo/Aegis.

Отклонение: полный primitive vocabulary спеки (`tether`, `charge`, `stored`, `field`, `compressed`, `corpse`, `construct` и др.) пока используется частично или не унифицирован в общий state runtime.

### Catalysts

19 prototype Catalysts из целевых 28. v0.8 специально добавляет не только directional `→`, но bridge/state/storage/feedback/sustain semantics.

Отклонения:

- не все 28 каталожных нод;
- Catalyst upgrades в основном повышают potency, без полного random stat-pool слоя;
- часть сложных взаимодействий пока имеет safety caps и упрощённые compatibility rules;
- proc coefficient / recursive-trigger модель ещё не доведена до полного spec damage pipeline.

### Sustain / drops

Есть XP, healing pickup и Elite Core. Есть Barrier conversion, close defensive Phenomenon и guaranteed elite heal.

Отклонение: rarity/economy drop tables и все будущие economy-Catalysts не полные.

### Black Archive normals

Все 8 текущих archetypes присутствуют: Footnote, Bookmark, Binder, Redactor, Palimpsest, Indexer, Inkblot, Marginwalker.

### Elites

Все 8 chassis присутствуют: Marshal, Bulwark, Shepherd, Hunter, Architect, Broodmaker, Harvester, Archivist. Есть generic affix layer и упрощённая адаптация.

Отклонение: полный Adaptation Director, его telemetry-driven family selection, весь набор adaptive families и полная Rare/Epic/Legendary encounter/reward ladder ещё отсутствуют.

### World scaling / density

HP, damage, spawn pressure и composition растут раздельно. Default 8 минут сжимают 24-минутную design curve. Ранняя population target сознательно снижена после playtest feedback; поздняя остаётся survivors-like, но не стремится максимизировать swarm сам по себе.

Enemy projectile pressure имеет отдельный cap; это соответствует telemetry red-flag из BALANCE_SPEC о недопустимом late projectile carpet.

### Determinism / telemetry / calibration

- seeded fixed-step simulation;
- headless test;
- canonical deterministic hash;
- per-source damage/kills/hits;
- world density/projectile telemetry;
- build matrix на одинаковой world curve;
- automatic assertions для мёртвых билдов, схлопывания identity и экстремального разброса эффективности.

Это соответствует требованию использовать симуляцию и telemetry как обязательный инструмент калибровки.

## Пока отсутствует / следующий слой

- полный каталог Skills/Phenomena (сейчас 11, не полный целевой каталог);
- оставшиеся Catalysts до 28;
- POI и риск-награда карты;
- Legendary Laws;
- полный Ascension / Manifest / Distort reward layer;
- полный Adaptation Director;
- полный damage/proc-coefficient pipeline;
- настоящая cycle-boundary equipment transaction;
- production-grade spatial grid / perf pass для максимальной late density;
- полноценная telemetry UI/экспорт replay, а не только headless reports.

## Главный критерий v0.8

Система считается успешнее v0.7 только если **одинаковый набор Phenomena с другим порядком/Catalysts даёт другой способ нанесения урона, контроля и выживания**, а не только другой итоговый коэффициент DPS.
