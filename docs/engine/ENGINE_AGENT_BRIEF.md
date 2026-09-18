# ENGINE_AGENT_BRIEF.md — архитектурный бриф для разработки движка

> **Статус:** исходный инженерный бриф для сильного coding-агента.
> **Характер требований:** требования к результату и архитектурные инварианты обязательны; конкретные паттерны, структура классов/records, детали Job System, ECS/не-ECS, allocator'ы, способ батчинга и прочие реализации — **рекомендательные**. Если агент видит более устойчивое решение, он должен предложить его до реализации, описать trade-offs и при необходимости обновить спецификацию/ADR.
> **Цель:** создать долговечное ядро собственного игрового движка на Delphi/Win64, пригодное сначала для текущей игры, а затем для других проектов близкого класса.

---

## 1. Что мы в итоге хотим получить

Нужен не «движок специально под один рогалик», а небольшой контролируемый framework/engine foundation, который:

- хорошо подходит для action/autobattler/survivors-like игр с большим количеством сущностей;
- позволяет делать изометрические/2.5D/3D сцены;
- не привязан к конкретному числу оружия, элиток, уровней, длительности рана или текущей системе Chain;
- масштабируется от простого прототипа до полноценной игры;
- допускает использование в будущих одиночных 2D/2.5D/3D проектах;
- имеет прозрачный performance profile и диагностируемую архитектуру;
- нормально развивается AI-агентами без накопления хаотичного legacy;
- не пытается заранее стать Unity/Unreal/Godot.

Главная цель — **простое, предсказуемое и расширяемое ядро**, а не максимально универсальный engine.

---

# 2. Контекст первой игры

Агент должен понимать, какую реальную нагрузку движок должен обслужить.

## 2.1 Жанр

Первая игра — изометрический roguelite/autobattler/survivors-like.

Игрок в основном:

- перемещает персонажа по карте;
- собирает автоматически исполняемый боевой билд;
- комбинирует активные способности и модифицирующие их элементы;
- регулярно встречает элитных противников;
- исследует карту ради POI/алтарей/событий;
- периодически перестраивает билд;
- получает мутации/легендарные эффекты, способные заметно менять правила боя.

Большая часть атак происходит автоматически. Игра должна комфортно поддерживать большое количество боевых сущностей, projectile/effect событий и визуальных эффектов.

## 2.2 Визуальная модель

Предпочтительный вариант:

- настоящий 3D world space;
- изометрическая/action-RPG камера;
- игровая плоскость — X/Z;
- Y используется для визуальной высоты, рельефа, прыжков, полёта, projectile arcs и VFX;
- gameplay targeting/collision/steering в основном остаётся 2D;
- одновременно допустимы:
  - 3D meshes;
  - billboard sprites;
  - sprite-atlas animation в 3D мире;
  - частицы;
  - world-space UI/VFX.

То есть визуально игра может выглядеть как полноценная 2.5D/3D action-RPG, но массовая simulation не должна платить цену полноценной 3D physics-системы.

## 2.3 Примерная нагрузка игры

Точные цифры будут меняться после прототипа, поэтому движок не должен быть заточен под них жёстко.

Рабочие ориентиры дизайна:

- обычный late-game: примерно 100–200 читаемых врагов на экране;
- короткие события могут давать больше;
- несколько активных элиток одновременно — нормальное состояние позднего рана;
- элитки будут встречаться часто и могут управлять поведением окружающей толпы;
- одновременно могут существовать сотни projectile/effect объектов;
- некоторые билды могут генерировать очень большое число hit/query событий;
- тысячи дешёвых визуальных particle/instance элементов допустимы.

Движок желательно stress-test'ить заметно выше обычной игровой нагрузки, например:

- 500+ простых simulation agents;
- 1000–2000 видимых instanced actors;
- 1000+ projectile/effect entities;
- 20k дешёвых particles;
- несколько сложных commander/elite controllers.

Это **benchmark target**, а не обещание фактической плотности игры.

## 2.4 Важная особенность элиток

Элитки — не редкие mini-boss HP bags.

Они являются частью обычного игрового ритма и могут:

- менять формацию группы;
- задавать приоритет/направление атаки;
- заставлять отряд окружать игрока;
- приказывать держать дистанцию;
- защищать другие типы существ;
- синхронизировать наступление;
- адаптироваться к особенностям текущего билда игрока.

Архитектура AI должна позволять иметь сравнительно дорогую логику для небольшого числа «командиров» и дешёвое исполнение приказов большими группами обычных мобов.

## 2.5 AI/MCP как опциональное направление

В будущем часть решений элиток/Director может опционально передаваться внешнему AI через MCP или другую интеграцию.

Это **не должно быть обязательным для игры**.

Правильная архитектура:

- игровая simulation имеет детерминированный обычный AI;
- AI/LLM получает только ограниченный набор разрешённых команд высокого уровня;
- AI не меняет HP/damage/spawn rate произвольными числами;
- при отсутствии/ошибке/таймауте AI игра немедленно использует локальный fallback;
- внешняя модель не входит в hot simulation loop.

Engine должен позволять такой control adapter, но не знать что-либо про LLM/MCP сам по себе.

---

# 3. Технологическая исходная точка

## 3.1 Обязательное

- язык: Delphi;
- target: **Win64/x64 only**;
- основная ОС: Windows 10/11 x64;
- runtime не должен зависеть от VCL/FMX;
- оконный слой: Win32;
- fixed-step simulation;
- современная многопоточная архитектура;
- source control friendly;
- тестируемость и headless режим.

## 3.2 Графика — baseline recommendation

Предпочтительный baseline:

- Direct3D 11;
- DXGI flip-model swap chain;
- DirectWrite/Direct2D или собственный D3D11 UI layer для текста/UI;
- HLSL;
- hardware instancing;
- batching;
- explicit render passes;
- GPU/CPU profiling markers.

Это рекомендация, а не религия.

Если агент считает, что другой Windows API/backend или другой способ организации renderer лучше для целей проекта, он должен:

1. сравнить варианты;
2. показать стоимость разработки и поддержки;
3. оценить Delphi ecosystem/API bindings;
4. оценить performance и debugging tooling;
5. объяснить migration risk;
6. вынести решение отдельным ADR.

Без такого анализа baseline остаётся Direct3D 11.

---

# 4. Основные архитектурные требования

## 4.1 Engine не должен знать геймдизайн

Engine layer не должен содержать понятий:

- Skill;
- Phenomenon;
- Catalyst;
- Mutation;
- Elite;
- Affix;
- Run;
- Shrine;
- 6 active slots;
- roguelite meta progression.

Engine знает только более общие примитивы:

- entities/handles;
- transforms;
- spatial data;
- jobs/tasks;
- render proxies;
- input actions;
- audio events;
- assets;
- timing;
- serialization primitives;
- diagnostics.

Game layer использует эти примитивы для реализации конкретного проекта.

## 4.2 Не проектировать движок только под эту игру

При выборе API задавать вопрос:

> Будет ли этот модуль естественно использоваться и в другой одиночной action/strategy/2.5D игре?

Если ответ «нет», вероятнее всего это Game layer.

При этом не нужно делать generic framework ради гипотетических будущих проектов. Универсальность должна появляться из хорошего разделения ответственности, а не из огромного abstraction layer.

---

# 5. Data-oriented hot path

Для массовых сущностей приоритет — cache locality, predictable memory access и минимум аллокаций.

Не рекомендуется делать:

```text
TEnemy = class
TProjectile = class
TParticle = class
```

для каждого transient entity.

Предпочтительны:

- generational/entity handles;
- packed arrays;
- SoA/AoSoA там, где это даёт пользу;
- component stores либо другая похожая data-oriented модель;
- pools/free lists;
- batch processing.

Не требуется обязательно реализовывать «полный ECS».

Агент должен исследовать минимум:

- простой custom component storage;
- archetype ECS;
- sparse-set подход;
- hybrid entity/component storage.

И выбрать минимально сложное решение, которое удовлетворяет игре и будущей расширяемости.

---

# 6. Многопоточность

Многопоточность является частью архитектуры с первого этапа.

Необходимо избежать двух крайностей:

- single-thread architecture, которую потом невозможно нормально распараллелить;
- слишком сложный lock-free/job-graph framework до появления реальных задач.

## 6.1 Рекомендуемая модель

Общий Worker Pool / Job System.

Работа симуляции разбита на явные фазы, между которыми допустимы synchronization barriers.

Примерная модель:

```text
Input
  ↓
Prepare Simulation
  ↓
Parallel AI / perception / steering jobs
  ↓ barrier
Parallel movement / spatial update
  ↓ barrier
Combat queries / effects
  ↓ barrier
Deterministic event merge / resolve
  ↓
Render snapshot build
  ↓
Render
```

Это только ориентир. Агент должен предложить окончательную модель.

## 6.2 Хорошие кандидаты на jobs

- perception queries;
- flock/group steering;
- animation evaluation;
- visibility/culling;
- render instance preparation;
- particle update;
- broad-phase spatial work;
- path request preparation;
- async file IO/decompression/asset decode;
- telemetry/stat aggregation;
- editor/background tools.

## 6.3 Не делать

- thread per entity;
- uncontrolled Task/anonymous thread creation;
- gameplay state mutation из произвольного worker thread;
- fine-grained locks на каждом entity/component;
- shared random generator между jobs.

## 6.4 Determinism

Полная bit-identical determinism на всех CPU не является обязательной целью, если её цена чрезмерна.

Но обязательно должны быть:

- seeded RNG streams;
- стабильный fixed timestep;
- воспроизводимый порядок gameplay resolution;
- deterministic merge результатов параллельных jobs;
- возможность воспроизвести игровой баг по seed/replay насколько практически возможно.

Агент должен отдельно описать, какой уровень determinism реалистичен для Delphi/Win64 и где проходит граница.

---

# 7. Rendering

Renderer должен быть отделён от Game simulation.

Game не вызывает D3D напрямую.

Предпочтительная схема:

```text
Simulation World
      ↓
Render Extraction / Snapshot
      ↓
Render World / Frame Data
      ↓
Renderer Backend
      ↓
D3D11
```

Renderer должен поддерживать минимум:

- perspective + orthographic camera;
- isometric camera presets;
- static meshes;
- skinned meshes — можно позже, но архитектура не должна исключать;
- hardware instancing;
- billboard/sprite rendering;
- sprite animation;
- transparency;
- particles;
- world-space decals/indicators;
- simple lights/shadows по мере необходимости;
- debug primitives;
- UI/text;
- postprocess hooks.

Система должна позволять визуализировать сотни однотипных существ небольшим количеством draw calls.

Renderer не должен читать gameplay component stores в произвольное время.

---

# 8. Spatial / collision / movement

Первая игра не требует полноценного general-purpose 3D physics engine.

Нужны эффективные 2D/XZ операции:

- radius query;
- nearest-N;
- cone/sector query;
- AABB query;
- broadphase collision;
- neighbor lookup;
- density/cluster information;
- visibility/LOS при необходимости;
- simple static obstacle navigation.

Агент должен сравнить варианты spatial partition:

- uniform grid/spatial hash;
- loose grid;
- quadtree;
- BVH для отдельных задач;
- hybrid model.

Для массовых динамических агентов baseline предпочтение — grid/hash, но окончательный выбор должен подтверждаться benchmark.

Не использовать N² neighbor scanning.

---

# 9. Horde AI

Обычные враги должны быть дешёвыми.

Нужны примитивы для:

- seek/approach;
- separation;
- cohesion/formation bias;
- flank direction;
- avoidance;
- keep-distance;
- follow leader/order;
- attack slot/engagement allocation;
- local obstacle avoidance.

Сложные решения принимаются ограниченным количеством controller/commander entities либо higher-level Director.

Один приказ должен применяться к группе обычных агентов без индивидуального expensive planning для каждого.

Архитектура должна позволять заменить конкретный AI алгоритм без изменения core entity/render systems.

---

# 10. Assets и data-driven architecture

Контент игры должен максимально описываться данными.

Engine должен иметь стабильную систему asset handles и resource lifecycle.

Нужны:

- async loading;
- background decoding;
- cooked runtime assets;
- source assets отдельно от runtime data;
- dev hot reload там, где это безопасно;
- stable resource handles;
- missing asset fallback;
- dependency tracking по мере необходимости.

Не допускается synchronous disk IO внутри simulation/render hot path.

Формат исходных 3D данных агент может выбрать после анализа; glTF 2.x является предпочтительным стартовым вариантом, но не обязательным.

---

# 11. Game data / scripting

Не нужно заранее писать полноценный scripting language/VM.

Первая версия должна уметь описывать data-driven definitions для:

- entities/archetypes;
- abilities;
- enemies;
- effects;
- balance values;
- visual/audio references;
- maps/POI descriptors.

Конкретный формат должен быть удобен для:

- Git diff;
- AI editing;
- validation;
- schema evolution;
- hot reload.

JSON/YAML/TOML/custom binary — открытый вопрос.

Runtime желательно читать cooked/binary representation, а человек/AI редактирует source definitions.

---

# 12. Input

Game layer должен использовать action abstraction, а не VK codes/XInput напрямую.

Например:

```text
MoveX
MoveY
Pause
OpenBuild
Confirm
Cancel
Interact
```

Backend может быть:

- keyboard/mouse;
- XInput;
- позже GameInput/другой backend.

Не надо делать гигантскую rebinding систему до необходимости, но архитектура не должна её блокировать.

---

# 13. Audio

Audio system должен быть event-based.

В bullet-heaven/autobattler нельзя проигрывать отдельный звук на каждое попадание.

Необходимо предусмотреть:

- voice limits;
- event aggregation;
- priority;
- distance attenuation;
- category buses;
- music/SFX/UI separation;
- high-frequency event suppression/merging.

Baseline Windows backend — XAudio2, если агент не предложит более разумную альтернативу.

---

# 14. Diagnostics прежде красивых инструментов

С самого начала нужны:

- frame CPU time;
- simulation time;
- render submission time;
- GPU frame time если возможно;
- job utilization;
- active/queued jobs;
- entity counts;
- projectile/effect counts;
- spatial query count/time;
- collision candidates;
- draw calls;
- instances;
- triangles;
- GPU resource memory estimates;
- allocation counters;
- asset IO/decode timing.

Нужен простой runtime debug overlay.

Developer experience важнее красивого editor на первом этапе.

---

# 15. Tests и benchmarks

Тесты являются частью архитектуры, а не финальным этапом.

Обязательны:

## Unit

- math;
- containers;
- entity handles;
- allocators/pools;
- spatial queries;
- RNG;
- serialization;
- job primitives.

## Integration

- entity lifetime;
- renderer resource recreation;
- async asset loading;
- shutdown with jobs in flight;
- resize/minimize/device-loss paths;
- replay/seed simulation.

## Stress/performance

Отдельный benchmark executable или режим.

Сценарии должны включать:

- thousands of render instances;
- hundreds of moving agents;
- heavy neighbor queries;
- projectile stress;
- particle stress;
- many audio events;
- asset streaming.

Benchmark results желательно сохранять в JSON/CSV, чтобы сравнивать commits.

Не оптимизировать без измерений.

---

# 16. Memory/lifetime

Delphi memory/lifetime semantics должны быть рассмотрены явно.

Агент должен предложить правила для:

- classes vs records;
- interfaces/COM interfaces;
- dynamic arrays;
- generics;
- managed strings;
- anonymous methods/closures;
- ARC/reference counting где применимо;
- thread ownership;
- GPU resource lifetime;
- job captured data.

В hot path избегать скрытых allocations/refcount operations.

Нужен документ с правилами «что разрешено в hot loop».

---

# 17. Error handling и recovery

Engine должен корректно обрабатывать:

- missing/corrupt asset;
- shader compile failure;
- device removed/reset;
- swap-chain resize;
- monitor/DPI change;
- focus/minimize;
- async IO failure;
- worker job exception/error;
- graceful shutdown.

Ошибки в dev build должны быть диагностируемыми, а не проглатываться.

---

# 18. Reuse для будущих проектов

Движок следует рассматривать как несколько библиотечных слоёв, а не один monolith.

Желательно, чтобы будущий проект мог переиспользовать:

- Engine.Core;
- Engine.Platform;
- Engine.Graphics;
- Engine.Assets;
- Engine.Input;
- Engine.Audio;
- Engine.World/Spatial;
- Engine.Jobs;

и полностью заменить Game.*.

Не нужно обещать backward compatibility API до появления второго проекта.

Но Game-specific dependencies в Engine считаются архитектурной ошибкой.

---

# 19. Принципы проектирования

Это не формальный запрет на отклонения, а порядок приоритетов.

1. Correctness.
2. Simplicity / KISS.
3. Observability/testability.
4. Performance в доказанных hot paths.
5. Modularity.
6. Generalization только после реальной потребности.

SOLID полезен в API boundaries.

Data-oriented код важнее OO-purity внутри simulation.

DRY не должен создавать ложную общность.

SRP относится прежде всего к modules/subsystems.

YAGNI — обязательный фильтр архитектурных фантазий.

---

# 20. Чего особенно избегать

- God Object/Game singleton со всеми системами;
- Service Locator как основной способ зависимостей;
- global mutable state;
- circular unit dependencies;
- giant Utils.pas;
- TObject-per-particle/projectile/enemy без причины;
- interfaces в массовом hot loop;
- hidden heap allocation каждый tick;
- render API types в Game layer;
- gameplay logic в renderer;
- synchronous file IO в update;
- один mutex вокруг всего World;
- pathfinding A* для каждого моба каждый tick;
- premature Vulkan/D3D12 abstraction;
- massive editor до рабочего gameplay runtime;
- самописный scripting VM без реальной необходимости;
- модуль, который существует только потому, что «так принято в движках».

---

# 21. Что агент должен сделать ДО основной реализации

Не начинать сразу писать тысячи строк движка.

Сначала провести короткий архитектурный этап и выдать:

1. понимание задачи и предполагаемого профиля нагрузки;
2. предлагаемые module boundaries;
3. dependency graph;
4. entity/data storage proposal;
5. threading/job model;
6. simulation/render synchronization model;
7. renderer architecture;
8. spatial architecture;
9. asset pipeline;
10. testing/benchmark strategy;
11. Delphi-specific risks;
12. external dependencies и лицензии;
13. risk register;
14. спорные решения и альтернативы;
15. что из этого документа агент рекомендует изменить и почему.

После обсуждения эти решения превращаются в current specs и ADR.

---

# 22. Первый технический milestone

Первый milestone — **engine stress sandbox**, а не кусок финальной игры.

Он должен доказать:

- Win64 host стабилен;
- D3D renderer работает;
- job system масштабируется хотя бы на нескольких CPU cores;
- entity storage пригоден для массовых сущностей;
- spatial queries работают под нагрузкой;
- camera/isometric world работает;
- meshes/sprites/instancing работают;
- render extraction не связан с gameplay;
- debug/profiling показывает узкие места;
- headless simulation запускается без graphics;
- benchmark воспроизводим.

В sandbox должны быть простые dummy agents, а не полноценная система скиллов игры.

---

# 23. Definition of Done foundation

Engine foundation считается достаточно зрелым для начала vertical slice игры, если:

- clean checkout собирается документированной командой/из IDE;
- Release x64 запускается без Delphi IDE;
- renderer стабилен при resize/minimize/fullscreen transitions;
- worker shutdown не зависает;
- stress tests проходят без memory corruption;
- spatial benchmark имеет baseline;
- large entity benchmark имеет baseline;
- renderer benchmark имеет baseline;
- headless seeded run повторяем;
- Game layer не зависит от D3D/Win32 implementation details;
- основные архитектурные решения задокументированы;
- нет известных critical debug-layer ошибок;
- repo имеет понятный workflow для следующего coding-agent session.

---

# 24. Самое важное указание агенту

**Не воспринимать этот документ как приказ использовать конкретные паттерны.**

Он описывает:

- цели;
- нагрузку;
- ограничения;
- инварианты;
- риски, которых мы хотим избежать.

Если после анализа кода, Delphi runtime, DirectX API или современных практик агент считает, что:

- иной threading model лучше;
- другой component storage лучше;
- D3D11 frontend надо организовать иначе;
- OpenSpec не подходит;
- некоторые требования конфликтуют;

он должен прямо это сказать и предложить улучшение.

Ожидается инженерное мышление, а не механическое выполнение текста.
