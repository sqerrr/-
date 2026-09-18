# Браузерный reference prototype — концепция и статус v0.8

## 0. Текущий статус (2026-09-17)

Reference prototype уже существует и включён в handoff как `prototype/current/` (v0.8 SYSTEMS). Реализованы TypeScript core, WebGL2 presentation, fixed-step determinism, planning/reserve, 11 Phenomena, 19 Catalysts, Black Archive enemies/elites и calibration tools.

Архитектурная цель достигнута достаточно, чтобы использовать web build как executable laboratory. **Design v0.8 не считается доказанным:** ручной плейтест выявил flat progression, diluted reward surface, слабую perceptual topology difference и недостаточную Elite visual causality. Следующий web milestone — v0.9 Power & Assembly redesign, а не простое расширение контента.

## 1. Зачем он нужен

Браузерная версия рассматривается как быстрый исполняемый reference implementation. Она не обязана определять финальный стек продукта.

Задачи:

- быстро проверять центральный gameplay;
- выдавать владельцу проекта запускаемый ZIP;
- гонять headless simulation и баланс;
- служить reference implementation формул и порядка событий;
- отделить Game Core от platform/rendering;
- обеспечить golden tests для будущего Delphi/native порта.

## 2. Рекомендуемый стек

Для первой версии:

- TypeScript;
- WebGL2 renderer;
- WebAudio;
- browser Gamepad/keyboard/mouse adapters;
- Web Worker для simulation после минимального single-thread baseline;
- TypedArrays / data-oriented stores в горячих циклах;
- JSON или другой простой validated data format для контента.

WebGPU не запрещён, но не нужен для первого vertical slice. Его можно добавить позже как backend/эксперимент после профилирования.

## 3. Жёсткая граница Core / Platform

Пример структуры:

```text
src/
  core/
    simulation/
    entities/
    combat/
    chain/
    skills/
    mutations/
    elites/
    directors/
    spatial/
    rng/
    math/
  content/
  renderer/
    contracts/
    webgl2/
  platform/
    web/
      input/
      audio/
      storage/
  ui/
  tools/
  tests/
```

`core/` не импортирует DOM, Canvas, WebGL, AudioContext, localStorage/IndexedDB.

## 4. Команды и выход симуляции

Core получает нейтральные команды, например:

```text
Move(x,z)
SelectUpgrade(id)
SwapSlot(a,b)
SwapReserve(active,reserve)
ActivatePOI(id)
ChooseMutation(id)
```

Core отдаёт snapshots/read views и tagged events:

```text
EntitySpawned
DamageResolved
SkillActivated
EliteOrderChanged
RewardOffered
MutationOffered
POIStateChanged
```

Платформа отвечает только за presentation/input/storage.

## 5. Fixed simulation

Частота — параметр сессии. 30/60 Hz нужно сравнить прототипом.

Canonical order должен быть явно зафиксирован и одинаков по смыслу с native implementation. Примерная схема:

1. tick input/commands;
2. directors;
3. AI intent/orders;
4. movement;
5. spatial rebuild;
6. chain/skill activation;
7. queries/collisions;
8. statuses/damage;
9. deaths/spawns/structural commit;
10. rewards/progression;
11. snapshot/events/hash.

Точная причинность уточняется до production implementation.

## 6. Worker model

Первая реализация может держать renderer/UI на main thread и authoritative simulation в Worker:

```text
MAIN: input + UI + WebGL2 rendering
   -> tick commands
WORKER: fixed simulation
   -> snapshots + events
```

Если profiling покажет необходимость, renderer можно отдельно переносить на OffscreenCanvas/Worker. Не усложнять раньше времени.

## 7. Data-oriented stores

Не создавать тяжёлый JS object на каждого массового моба/снаряд.

Предпочитать плотные typed arrays / chunked stores для горячих данных:

```text
posX Float32Array
posZ Float32Array
velX Float32Array
velZ Float32Array
health Float32Array
type Uint16Array
flags Uint32Array
```

Cold/rare data может оставаться в более удобных структурах.

## 8. Контент как данные

Skill/Catalyst/Enemy/Mutation/Elite definitions должны быть отделены от исполнения. Контентный файл хранит IDs, tags, scaling pools, state production/consumption, geometry/targeting primitive IDs и параметры.

Не пытаться сериализовать произвольный TypeScript-код как «данные». Нужен ограниченный vocabulary primitives.

## 9. Golden tests и перенос

Reference prototype должен уметь принимать:

- seed;
- versioned content pack;
- tick-indexed input/actions;
- session simulation rate.

После N ticks генерируется canonical result/hash и метрики.

Будущий Delphi/native port получает тот же сценарий и должен совпадать по дискретным authoritative результатам. Bit-identical float simulation между JS и Delphi может быть нереалистичной без специальных мер, поэтому golden contract должен сначала проверять дискретные события, RNG outcomes, counts и допустимые tolerance для float state.

## 10. Производительность

Для current design ожидаются сотни, а не десятки тысяч сложных AI-сущностей. Поэтому сначала оптимизировать алгоритмы и allocations, а не уходить в GPU compute.

Stress sandbox должен иметь запас относительно target gameplay:

- несколько сотен активных agents;
- значительно больше визуальных instanced/swarm элементов;
- сотни/тысячи простых projectile/effect entities;
- несколько сложных элитных controllers;
- большое число spatial queries.

## 11. Исторический результат первого web milestone / дальнейший статус

ZIP, который запускается локальным статическим сервером и содержит:

- одну карту/биом;
- движение персонажа;
- базовую Chain;
- несколько Skills/Catalysts;
- обычных врагов и одну-две elite/adaptation mechanics;
- debug HUD;
- headless/balance test runner;
- deterministic/replay seed metadata;
- profiler counters.

Затем наращивать до полноценного vertical slice.


## 12. Следующий web milestone — v0.9 Power & Assembly

Технически сохранить v0.8 core/render/test harness, но экспериментально заменить progression/reward layer:

- два переключаемых reward-channel варианта;
- nonlinear LevelScalar + geometry/count breakpoints;
- 6–8 Phenomena вместо расширения до полного каталога;
- 10–14 Catalyst operators разных scopes;
- visual interaction traces;
- усиленная persistent Elite influence presentation;
- более мягкий opening и меньший enemy projectile pressure;
- новый `power_curve` / `topology_signature` calibration.
