# ENGINE_SPEC.md — техническая спецификация собственного движка v0.1

> **Статус:** обязательная архитектурная спецификация перед началом реализации.  
> **Цель:** собственный Windows/Delphi-движок для изометрического 2.5D autobattler/survivors-like, который не привязан к текущим деталям Chain/Elite/Mutation и выдерживает изменение геймдизайна без каскада переписываний.  
> **Базовый стек:** Delphi 13.1 Florence, Win64, Win32 API, Direct3D 11, DXGI, Direct2D 1.1/DirectWrite для UI, XAudio2 2.9, XInput v1; GameInput — возможный последующий backend.  
> **Поддерживаемая ОС v1:** Windows 10 x64 / Windows 11 x64.  
> **Главный принцип:** движок предоставляет универсальные примитивы. Ни `Skill`, ни `Catalyst`, ни `Elite`, ни `Mutation`, ни roguelite-прогрессия не имеют права появляться в Engine layer.

---

# 1. Зафиксированная модель игры, важная для движка

Игра визуально — **изометрическая / action-RPG 2.5D сцена**.

Используется настоящий 3D coordinate space:

- геометрия мира — 3D;
- камера — фиксированный изометрический/action-RPG ракурс, конфигурируемый как perspective или orthographic;
- сущности могут быть:
  - полноценными 3D mesh;
  - camera-facing/Y-axis billboard sprite;
  - animated sprite atlas в 3D мире;
- земля, препятствия, декоративные объекты имеют настоящую высоту;
- визуальные прыжки, полёт, arcs и VFX используют Y-height.

Но **авторитетный gameplay остаётся 2D**:

- игровая плоскость: XZ;
- Y — визуальная высота и ограниченные special-case механики;
- расстояния для targeting/AoE/steering по умолчанию считаются в XZ;
- не нужен general-purpose 3D physics engine;
- массовые враги используют дешёвую 2D spatial simulation.

Это фундаментальная граница. Нельзя позволять renderer/3D geometry протекать в боевые правила.

---

# 2. Основные архитектурные правила

## 2.1 KISS

Всегда выбирать простейшую архитектуру, которая удовлетворяет измеренной потребности.

Запрещено заранее реализовывать:

- Vulkan/D3D12 backend «на будущее»;
- полноценный scene graph с произвольной иерархией для каждого моба;
- general-purpose scripting VM;
- network replication;
- full ECS framework с query DSL;
- multithreaded simulation, пока single-thread профилирование не доказало необходимость;
- deferred D3D11 contexts без профилировочного доказательства.

## 2.2 SOLID — только там, где это полезно

SOLID применяется на **границах подсистем**:

- rendering;
- audio;
- input;
- assets;
- file system;
- platform/window;
- telemetry.

В горячих циклах допускается и рекомендуется data-oriented код, даже если он выглядит менее «ООП-чисто».

Не создавать `TEnemy = class`, `TProjectile = class`, `TEffect = class` для десятков/сотен тысяч transient-событий.

## 2.3 SRP

Каждый unit имеет одну ясную причину измениться.

Примеры:

- `Engine.Graphics.D3D11.Device` — device/swap-chain lifecycle;
- `Engine.Graphics.D3D11.Buffer` — GPU buffers;
- `Engine.World.Entity` — entity handle lifecycle;
- `Engine.World.SpatialHash2D` — spatial queries;
- `Game.Combat.Damage` — игровые damage rules.

Нельзя делать `Engine.pas` на 20 000 строк.

## 2.4 DRY без абстракций ради DRY

Повторить три строки иногда дешевле, чем создать неправильную абстракцию.

Абстракция вводится только если:

1. повторяется реальная концепция;
2. у неё одинаковые причины для изменения;
3. API проще повторяющегося кода.

## 2.5 Dependency Rule

Зависимости направлены внутрь:

```text
Platform/Backends ---> Engine Core <--- Game
                         ^
                         |
                       Tools
```

`Engine.*` **никогда** не `uses Game.*`.

`Game.*` может использовать публичные типы Engine.

D3D11/DXGI/Win32 типы не должны появляться в Game layer.

## 2.6 YAGNI

Любой слой «для будущей возможности», которой нет в roadmap, требует отдельного обоснования.

---

# 3. Toolchain

## 3.1 Delphi

Reference toolchain:

- Delphi 13.1 Florence;
- Win64 target;
- 64-bit IDE/Compiler допустим и рекомендован;
- Release build — Win64 only.

Код по возможности не должен зависеть от экзотических 13.x-only language features, если это не даёт явного выигрыша. Это снижает риск компиляторных регрессий и делает tooling проще.

## 3.2 Runtime framework

Game executable **не использует VCL и FireMonkey как runtime framework**.

Главное окно создаётся через Win32 API.

Причины:

- полный контроль message pump;
- отсутствие скрытого render/event lifecycle;
- меньше глобального состояния;
- проще high-DPI, borderless, resize, device recreation;
- engine core не зависит от visual component framework.

VCL разрешён для отдельных editor/tools executables.

## 3.3 DirectX headers для Delphi

Нужно выбрать **один** источник Delphi translations и не смешивать несовместимые определения интерфейсов.

Приоритет:

1. встроенные Delphi Winapi units, если покрытие D3D11/DXGI/D2D1/DirectWrite/XAudio2 достаточно и подтверждено smoke test;
2. иначе pinned/vendor snapshot нужных units из MfPack после проверки MPL-2.0 условий.

Все внешние declarations изолируются внутри `Engine.Platform.Win.DirectX.*`.

Game/Engine higher layers не знают, откуда пришли header translations.

---

# 4. Структура solution

Рекомендуемое дерево:

```text
/src
  /engine
    /core
    /math
    /platform/win32
    /graphics
      /frontend
      /d3d11
    /ui
    /audio
    /input
    /assets
    /world
    /spatial
    /jobs
    /debug
    /telemetry
  /game
    /simulation
    /combat
    /content
    /director
    /ui
    /meta
  /tools
    /asset_cooker
    /content_validator
    /benchmark
    /replay_inspector
/tests
  /unit
  /integration
  /performance
/assets_source
/assets_cooked
/config
```

Unit naming:

```text
Engine.Core.Log
Engine.Core.Time
Engine.Math.Vec
Engine.Platform.Win32.Window
Engine.Graphics.RenderFrame
Engine.Graphics.D3D11.Device
Engine.Graphics.D3D11.SpriteBatch
Engine.World.Entity
Engine.World.TransformStore
Engine.Spatial.HashGrid2D
Game.Combat.Damage
```

---

# 5. Ownership и lifetime

## 5.1 Главный owner

`TEngineHost` владеет subsystem instances явно:

```text
TEngineHost
  Window
  Clock
  Input
  Graphics
  UI
  Audio
  Assets
  Jobs
  Telemetry
```

Создание и уничтожение имеют строго определённый порядок.

Не использовать глобальные singleton'ы subsystem'ов.

## 5.2 Delphi interfaces

Internal engine interfaces применять ограниченно.

Причина: Delphi interface references автоматически ref-counted; смешивание object-reference и interface-reference способно создавать неочевидные lifetime bugs.

Правило:

- COM DirectX interfaces — естественно использовать как interface fields;
- internal high-level subsystem services — предпочтительно явный TObject ownership + dependency injection;
- если internal `IInterface` используется, объект живёт **только** через interface refs и это документируется;
- не использовать interface references внутри entity/component hot data.

## 5.3 Аллокации

Steady-state frame target:

> **0 обязательных heap allocations в simulation hot loop.**

Допустимы аллокации:

- при загрузке assets;
- при смене сцены;
- при росте заранее reusable container;
- при открытии сложного UI;
- в dev/debug code.

Hot-path containers должны повторно использовать capacity.

---

# 6. Entity model: hybrid data-oriented

Полный ECS framework не требуется.

Используется **generational entity handle + packed component stores**.

## 6.1 Entity ID

```pascal
type
  TEntityId = record
    Index: UInt32;
    Generation: UInt32;
  end;
```

`Index + Generation` предотвращает использование stale handle после reuse slot.

`InvalidEntity` фиксирован.

## 6.2 Registry

Registry хранит:

- generations[];
- free indices stack;
- alive bitmap/flags.

Создание/уничтожение O(1).

## 6.3 Component stores

Горячие компоненты — packed dense arrays.

Примеры:

```text
Transform2DStore
Velocity2DStore
HealthStore
SteeringStore
Collider2DStore
RenderableStore
LifetimeStore
```

Использовать sparse->dense lookup либо equivalent direct index storage там, где density высокая.

Критерий выбора — benchmark, не идеология.

## 6.4 Никаких TObject на моба

Обычный моб/снаряд/XP-orb не должен иметь собственный TObject.

Complex boss logic может иметь отдельный controller object, который управляет entity handle'ами, если это удобно и не находится в массовом цикле.

---

# 7. Fixed simulation и game loop

## 7.1 Timer

High-resolution clock: `QueryPerformanceCounter/Frequency`.

## 7.2 Fixed timestep

Engine поддерживает конфигурируемый fixed simulation timestep.

Базовая game config v0.1:

```text
simulation_hz = 30
fixed_dt = 1 / 30
```

Renderer работает с display frame rate и интерполирует transforms.

Архитектура обязана позволять сменить 30 -> 60 без переписывания subsystem contracts.

## 7.3 Accumulator loop

```text
poll OS messages
sample input
accumulator += real_delta
clamp accumulator
while accumulator >= fixed_dt and steps < max_steps:
    simulate(fixed_dt)
    accumulator -= fixed_dt
render(alpha = accumulator / fixed_dt)
present
```

`max_steps_per_frame` защищает от spiral-of-death.

После breakpoint/alt-tab giant delta clamp, например 250 ms.

## 7.4 Determinism

Game simulation:

- не использует wall-clock time;
- не использует random API напрямую;
- получает `fixed_dt` и named RNG streams;
- iteration order hot collections стабилен там, где влияет на результат.

Render/audio/UI не являются authoritative.

---

# 8. Threading model v1

## 8.1 Главный поток

V1 сознательно простой:

- Win32 message pump;
- authoritative simulation;
- render-frame build;
- D3D11 immediate context;
- DXGI Present

на одном main/render thread.

Это соответствует требованию D3D11/DXGI не использовать immediate context/Present конкурентно из разных потоков.

## 8.2 Worker threads

Background jobs разрешены только для неавторитетной или безопасно отделимой работы:

- file IO;
- image/audio decode;
- asset parsing/cooking;
- telemetry compression/write;
- shader source recompilation в dev;
- expensive analysis, результат которого применяется на deterministic boundary.

`System.Threading.TTask/TParallel` допустимы здесь.

## 8.3 Что пока не параллелить

Не параллелить до профилирования:

- damage resolution;
- entity creation/destruction;
- spatial collision resolution;
- combat event queue;
- Directors.

Причина: determinism и простота важнее гипотетического CPU gain.

---

# 9. Direct3D 11 backend

## 9.1 Почему D3D11

Для проекта D3D11 предпочтительнее Direct2D как основной renderer, потому что нужны:

- настоящий 3D world;
- depth testing;
- instancing;
- custom HLSL;
- meshes;
- sprites в 3D;
- GPU particles;
- post-processing;
- predictable batching.

D2D остаётся UI/text backend.

## 9.2 Device creation

Создать D3D11 hardware device.

Flags:

- `D3D11_CREATE_DEVICE_BGRA_SUPPORT` обязательно для D2D interop;
- `D3D11_CREATE_DEVICE_DEBUG` в debug build, если debug layer доступен.

Feature levels:

```text
11_1 optional
11_0 required baseline
```

Если 11_1 недоступен, 11_0 должен работать без degraded gameplay.

WARP:

- допустим как explicit debug/test backend;
- не fallback для обычной игры без сообщения пользователю.

## 9.3 DXGI swap chain

Windows 10+:

- `IDXGIFactory2::CreateSwapChainForHwnd`;
- `DXGI_SWAP_EFFECT_FLIP_DISCARD`;
- 2 или 3 buffers;
- swap-chain format `DXGI_FORMAT_B8G8R8A8_UNORM` для простой D2D interop;
- sample count = 1 у swap chain.

MSAA, если понадобится, реализуется через отдельный offscreen world target + resolve.

Не использовать legacy blt `DISCARD/SEQUENTIAL` model.

## 9.4 Present modes

Engine settings:

```text
VSync On
VSync Off
Frame limit N
```

Если tearing поддерживается DXGI factory и VSync Off:

- разрешить `DXGI_SWAP_CHAIN_FLAG_ALLOW_TEARING`;
- Present с соответствующим flag в windowed/borderless mode.

Borderless fullscreen — основной fullscreen v1.

Exclusive fullscreen не обязателен.

## 9.5 Frame latency

Предусмотреть поддержку waitable swap-chain latency object.

Включать после отдельного latency/perf test, не усложнять bootstrap раньше времени.

## 9.6 Resize

На `WM_SIZE`:

1. не ResizeBuffers при width/height == 0;
2. release views на backbuffer/D2D target;
3. `ResizeBuffers`;
4. recreate RTV/depth/UI target;
5. update viewport/camera aspect;
6. никакой game-state recreation.

## 9.7 Device removed

Любой `Present/Map/Create*` relevant error:

- логировать HRESULT;
- вызвать `GetDeviceRemovedReason`;
- сохранить crash context;
- GPU resources должны быть recreatable из CPU-side asset descriptors.

V1 acceptance минимум:

- device-removed корректно диагностируется;
- приложение не падает случайным AV.

Preferred shipping path:

- полный graphics backend recreate;
- reload GPU resources из AssetManager.

---

# 10. Renderer frontend/backend split

Gameplay не вызывает D3D11.

Game systems заполняют `TRenderFrame`/render proxy data.

Пример:

```text
Camera
OpaqueInstances[]
SpriteInstances[]
TransparentEffects[]
Decals[]
Lights[]
DebugPrimitives[]
UICommands[]
```

Renderer backend получает immutable frame description.

## 10.1 Render proxy

Entity -> renderer связь через compact `TRenderProxyId` / handle, а не через COM resources.

## 10.2 Draw-call policy

Нельзя делать один DrawCall на моба.

Batch key минимум:

```text
pipeline/material
mesh/sprite-atlas
blend mode
shader variant
```

Actors одного визуального типа должны рендериться instanced.

---

# 11. 2.5D render pipeline v1

Минимальный pipeline:

```text
1. clear color/depth
2. ground/environment opaque
3. opaque/alpha-test actor meshes
4. sprite/billboard actors
5. decals / ground telegraphs
6. transparent world effects
7. optional lightweight post FX
8. Direct2D/DirectWrite UI overlay
9. present
```

## 11.1 Lighting v1

Не строить deferred/PBR framework заранее.

V1:

- ambient term;
- 1 directional light;
- material tint;
- optional emissive;
- blob/projected shadows.

PBR/shadow maps только после art test.

## 11.2 Camera

Camera component поддерживает:

- perspective;
- orthographic;
- configurable yaw/pitch/distance/FOV/ortho size;
- target offset;
- dead-zone/smoothing;
- screen shake как presentation-only layer.

Gameplay не знает camera pitch.

## 11.3 World convention

Зафиксировать одну систему координат и покрыть unit tests.

Рекомендуется:

```text
X = world right
Y = up/height
Z = world forward
Gameplay plane = XZ
```

Матрицы и shader convention фиксируются один раз в `Engine.Math`.

---

# 12. Instancing и массовые сущности

Direct3D 11 instancing — основной путь для массовых actors.

## 12.1 Instance buffer

Per-instance data держать компактным.

Начальный budget <= 64 bytes/instance.

Пример:

```text
position.xyz
rotation_y
scale.xy
animation_frame
packed_color
flags
material_param
```

Не отправлять 4x4 world matrix на каждый swarm mob, если хватает position/yaw/scale.

## 12.2 Dynamic upload

Для часто обновляемых instance buffers использовать dynamic buffers и `Map(WRITE_DISCARD)`; при нескольких append-upload в кадре возможно `NO_OVERWRITE` после доказанной необходимости.

## 12.3 Target engineering headroom

Дизайн ожидает примерно 100–200 читаемых enemies late game, bursts выше.

Engine benchmark обязан держать запас:

- 500 full simulated simple agents;
- 1000–2000 visible instanced actor render-proxies;
- 20 000 simple GPU/cheap particles;
- 3–8 complex elites;

Это stress target, не рекомендация дизайну держать столько мобов постоянно.

---

# 13. Sprites в 3D

Engine должен одинаково поддерживать:

1. static mesh renderable;
2. Y-axis billboard sprite;
3. full camera-facing billboard;
4. animated sprite atlas;
5. VFX quad/ribbon.

Sprite renderer использует texture atlas/array и instancing.

Alpha policy:

- actors по возможности alpha-test/cutout + depth;
- полноценный alpha blend — для VFX;
- не сортировать сотни основных мобов back-to-front каждый кадр, если art style может этого избежать.

---

# 14. UI и Direct2D/DirectWrite

## 14.1 Почему отдельный UI layer

HUD/Chain/Reserve требует:

- текст;
- tooltips;
- drag-and-drop;
- panels;
- icons;
- progress bars;
- DPI scaling;
- хорошую локализацию.

Direct2D/DirectWrite дают качественный Windows text stack и могут работать с D3D11 через DXGI.

## 14.2 Абстракция

Game UI не вызывает `ID2D1DeviceContext` напрямую.

Нужны engine-level commands/widgets:

```text
Panel
Image
Text
ProgressBar
NineSlice
ScrollArea
Tooltip
DragSource
DropTarget
```

D2D — backend v1.

Если позже UI будет перенесён на D3D sprite renderer, game UI logic не меняется.

## 14.3 DPI

Process/window — Per Monitor DPI Aware v2.

Обработать `WM_DPICHANGED`.

UI layout использует logical units и DPI scale, а не hard-coded physical pixels.

## 14.4 UI performance

Обычный HUD не должен генерировать тысячи heap allocations в кадр.

Text layouts кешируются по content/style/width, когда это имеет смысл.

---

# 15. Input

## 15.1 Input abstraction

Game читает actions:

```text
Move
Aim optional
Interact
Pause
OpenBuild
Confirm
Cancel
Map
UI navigation
```

а не VK codes/XInput constants.

## 15.2 Keyboard/mouse

Win32 backend:

- keyboard state;
- Raw Input для относительного mouse delta, если понадобится;
- mouse wheel/buttons;
- text input для UI отдельно от gameplay keys.

## 15.3 Gamepad

V1: XInput.

Причины:

- простой API;
- controller state polling;
- vibration;
- достаточно для первого PC build.

GameInput — возможный второй backend после vertical slice.

## 15.4 Rebinding

Binding database data-driven.

Не вшивать key codes в Game code.

---

# 16. Audio

Backend v1: XAudio2 2.9.

Audio architecture:

```text
Master
  Music
  SFX
    Combat
    World
  UI
  Ambience
```

## 16.1 Horde-specific rule

В массовой игре нельзя проигрывать звук на каждый hit.

Audio Event Aggregator обязан поддерживать:

- per-event cooldown;
- max voices per category;
- spatial clustering;
- volume compression при частом повторе;
- priority stealing.

Например 200 одинаковых hit events за 50 ms превращаются в 1–3 audible events, а не 200 voices.

## 16.2 Prototype formats

Prototype:

- WAV/PCM для SFX;
- streaming interface для музыки.

Decoder backend отделить от XAudio2 playback, чтобы позже подключить Media Foundation/Ogg decoder без изменения gameplay API.

---

# 17. 2D collision / spatial system

General 3D physics в v1 запрещён.

## 17.1 Shapes

Gameplay primitives:

- circle;
- AABB2;
- capsule/segment where needed;
- ray/segment;
- static polygon/edge for map obstacles only if действительно нужно.

## 17.2 Uniform spatial hash/grid

Основная broad phase:

- fixed/adjustable cell size;
- contiguous bucket storage where possible;
- no per-query allocations;
- query buffer supplied by caller.

Use cases:

- nearby enemies;
- target selection;
- AoE overlap;
- avoidance;
- projectile contacts;
- elite aura recipients.

## 17.3 Fast projectiles

Для быстрых projectile использовать swept segment/circle test, а не повышать всю simulation frequency.

## 17.4 Enemy separation

Local separation считается только по соседним grid cells.

Никаких all-pairs O(N^2).

---

# 18. Navigation / steering

Карта ожидается в основном открытой.

V1 pathing:

- seek target;
- local obstacle avoidance;
- local separation;
- optional steering weights;
- simple static navigation grid/flow field только если препятствия реально требуют.

Не запускать A* на каждого моба.

Если нужен маршрут вокруг больших препятствий:

- shared flow field к player/goal;
- обновляется редко;
- обычные mobs используют его + local steering.

Elite commander/orders находятся в Game layer и выдают generic movement intents/groups.

---

# 19. Asset system

## 19.1 Stable handles

Game/render code использует `TAssetId/TTextureHandle/TMeshHandle`, не file paths и не COM pointers.

## 19.2 Source formats

Рекомендуемые source assets:

- glTF 2.0 для meshes/scenes/animations;
- PNG/TGA для textures;
- WAV/other source audio;
- HLSL source;
- JSON для game definitions.

## 19.3 Cooked assets

Release не должен парсить тяжёлые authoring formats, если это можно сделать offline.

`AssetCooker` преобразует source -> versioned binary assets.

Каждый cooked asset содержит:

```text
magic
format_version
asset_type
source_hash
dependency hashes
payload
```

## 19.4 Asset hot reload

Dev-only:

- HLSL;
- JSON content;
- textures;
- UI layouts.

Hot reload failure не уничтожает текущий valid resource; ошибка логируется/показывается overlay.

---

# 20. Shaders

HLSL Shader Model 5.x.

Release:

- precompiled shader bytecode;
- не требовать runtime shader compilation.

Development:

- runtime compile/hot reload допустим;
- warnings = visible;
- compile error keeps previous shader.

Shader permutations должны быть ограничены.

Не генерировать combinatorial explosion defines.

---

# 21. Resource management

GPU resources разделяются:

- immutable/static;
- dynamic per-frame;
- render targets;
- transient frame resources.

Resource wrapper хранит CPU descriptor enough для recreation.

COM interface refs не проходят в Game layer.

---

# 22. Logging / diagnostics

Обязательные log channels:

```text
Core
Platform
Graphics
Audio
Input
Asset
Simulation
Content
Performance
AI/MCP
```

Каждая запись:

```text
timestamp
thread id
severity
channel
message
optional key-values
```

Sinks:

- file;
- debugger OutputDebugString;
- in-game console/overlay optional.

Release сохраняет rolling log последних N MB.

---

# 23. Debug HUD

Toggle overlay должен показывать:

- FPS;
- frame ms CPU/GPU if available;
- simulation ms;
- render-build ms;
- draw calls;
- triangles/instances;
- enemy/entity counts;
- spatial query counts;
- collision candidate count;
- combat event count;
- particle count;
- audio voices/events dropped;
- memory use;
- current run seed;
- camera coordinates.

Без этого баланс/performance большого roguelike вслепую невозможен.

---

# 24. Memory diagnostics

Debug build:

- `ReportMemoryLeaksOnShutdown := True` минимум;
- optional FastMM5 full debug mode **только после решения по лицензии**;
- bounds/range/overflow checks где разумно;
- D3D11 debug layer;
- `ID3D11InfoQueue` messages в log/debugger.

Не включать тяжёлые leak/debug managers в shipping build без профилирования.

---

# 25. Save/config

Engine settings отдельно от game save.

`engine_settings.json`:

```text
resolution
window_mode
vsync
frame_limit
render_scale
ui_scale
audio volumes
input bindings
quality toggles
```

Version field обязателен.

Game save не должен сериализовать raw pointers/entity handles/COM handles.

---

# 26. Error handling

Низкоуровневые DirectX HRESULT errors переводятся в typed engine errors с context.

Нельзя оставлять `if Failed(hr) then Exit;` без логирования причины.

Fatal error report минимум:

- build version;
- OS;
- GPU adapter/driver;
- feature level;
- last log lines;
- HRESULT/device removed reason;
- run seed if gameplay active.

---

# 27. Coding standard Delphi

## 27.1 Общие правила

- `Option Explicit` аналогично по смыслу: никаких неинициализированных локальных данных;
- warnings/hints review, не массово suppress;
- `with` запрещён;
- magic numbers -> named constants/config;
- public API документируется;
- `FreeAndNil` не использовать как автоматический ритуал; ownership должен быть понятен;
- исключения — для exceptional conditions, не flow control hot loop;
- anonymous methods/closures не создавать в кадр;
- managed strings/dynamic arrays не хранить в самых горячих per-entity records;
- generic containers допустимы outside hot loops; hot stores специализированы.

## 27.2 Types

Использовать явные fixed-size integer types в serialized/GPU/network-like data:

```text
UInt32
Int32
UInt64
Single
```

Не сериализовать native `Integer/NativeInt` без schema decision.

## 27.3 Records

Hot records — plain/unmanaged where possible.

Не помещать `string/interface/dynamic array` в массовый component record без доказанной необходимости: Delphi managed fields требуют hidden initialization/finalization/reference-count operations.

## 27.4 Unit dependency hygiene

Circular unit dependencies запрещены.

`implementation uses` не должен использоваться как способ скрыть архитектурный цикл.

---

# 28. Public engine API philosophy

Engine API должен предоставлять возможности, а не игру.

Хорошо:

```text
SpawnEntity
AddTransform
QueryCircle
SubmitRenderProxy
PlayAudioEvent
LoadAsset
GetActionState
```

Плохо:

```text
SpawnElite
ApplyMutation
FireSkill
RollLegendary
```

---

# 29. Performance budgets v0.1

Эти числа — начальные engineering budgets, а не финальные обещания.

Reference stress scene 1080p:

```text
500 simple simulated agents
1000-2000 instanced visible actors
20k cheap particles
1000 simple projectiles/effects
8 elite-like complex controllers
```

Target on baseline midrange PC:

```text
60 FPS render target
simulation step 30 Hz with < 8 ms CPU budget
normal gameplay simulation ideally < 4 ms
render submission CPU < 3 ms
GPU frame < 12 ms normal, < 16 ms stress
steady-state hot frame allocations ~0
```

Нужен отдельный `EngineBenchmark.exe`.

Нельзя оптимизировать игру по среднему FPS: логировать P95/P99 frame time.

---

# 30. Required benchmarks

## B01 — Empty

Window + clear + UI text.

## B02 — Instanced Sprites

10k billboard instances, без gameplay.

Цель: доказать, что renderer batching не зависит линейно от draw call count.

## B03 — Instanced Meshes

2k одинаковых low-poly meshes.

## B04 — Spatial Hash

500 / 1000 / 5000 circles, thousands radius queries/tick.

## B05 — Movement Horde

500 agents seek player + separation.

## B06 — Projectiles

1000 moving projectiles + swept contacts.

## B07 — VFX

20k cheap particles.

## B08 — UI Stress

HUD + 200 text/icon widgets + drag-drop.

## B09 — Resize/DPI

Repeated resize, monitor DPI change, alt-tab, borderless toggle.

## B10 — Device recovery

Synthetic device recreation code path / forced resource rebuild where feasible.

---

# 31. Automated tests

Unit tests обязательны для:

- vector/matrix math;
- world<->screen conversion;
- entity generation/stale handles;
- component add/remove;
- spatial hash insert/move/remove/query;
- circle/AABB/segment intersections;
- fixed timestep accumulator;
- deterministic RNG;
- asset handle/versioning;
- serialization migrations;
- input deadzone/action mapping.

Integration tests:

- run 10 000 deterministic simulation ticks headless, сравнить hash;
- create D3D device with WARP and render smoke frame;
- resize 100 times;
- load/unload asset pack repeatedly;
- entity churn test millions create/destroy operations;
- lost-reference/stale-handle test.

---

# 32. What engine must NOT know

До отдельного архитектурного решения Engine не знает:

- число активных Skill slots;
- что такое Catalyst;
- rarity;
- affix;
- elite;
- boss;
- adaptation;
- loot;
- XP;
- run duration;
- roguelite meta progression;
- MCP semantics.

Это всё Game layer.

Изменение 6 slots -> 8 slots не должно требовать ни одной правки D3D/Entity/Spatial/Audio subsystem.

---

# 33. AI-agent friendliness

Каждая engine subsystem должна иметь:

1. `README`/unit-level contract;
2. explicit invariants;
3. тесты;
4. no hidden globals;
5. deterministic minimal repro;
6. benchmark where performance-sensitive.

Агенту запрещено «исправлять» failing test удалением assert/ослаблением tolerance без описания причины.

Любая новая dependency:

- объяснить зачем;
- проверить лицензию;
- pin version/commit;
- обернуть за adapter.

---

# 34. Definition of Engine v0.1 Done

Движок v0.1 считается готовым для vertical slice только если одновременно выполнено:

1. Win64 raw Win32 window стабильно создаётся/resize/fullscreen/DPI.
2. D3D11 flip-model backend проходит debug layer без errors в normal frame.
3. Perspective/orthographic isometric camera работает.
4. Есть static mesh + instanced mesh + billboard sprite.
5. 500-agent horde simulation работает через data stores + spatial hash.
6. 1000+ visible instances не создают 1000 draw calls.
7. Fixed simulation + interpolation работает независимо от refresh rate.
8. Input actions работают keyboard/mouse + XInput.
9. D2D/DirectWrite UI умеет text/icon/panel/progress/drag-drop.
10. XAudio2 воспроизводит SFX и имеет event throttling.
11. AssetManager умеет texture + mesh + shader + JSON definition handles.
12. Нет прямых Game->D3D calls.
13. Benchmark executable существует и сохраняет результаты.
14. Seeded/headless tests стабильны.
15. Leak/debug checks не показывают систематических утечек engine resources.
16. Через публичные API можно собрать маленький prototype: player + 200 mobs + projectiles + HUD без модификации engine internals.

---

# 35. Research basis

Решения основаны на следующих официальных/практических источниках:

- Microsoft: Direct3D 11 / DXGI flip model и `FLIP_DISCARD` как современный presentation path.
- Microsoft: D3D11 immediate context и DXGI/Present должны использоваться без конкурентного доступа.
- Microsoft: Direct2D/D3D11 interoperability через DXGI и BGRA support.
- Microsoft: `DrawIndexedInstanced` для массовой геометрии.
- Microsoft: dynamic buffers + `WRITE_DISCARD/NO_OVERWRITE`.
- Microsoft: `QueryPerformanceCounter` для high-resolution game timing.
- Microsoft: Per-Monitor DPI Awareness v2.
- Microsoft: XAudio2 2.9 и XInput.
- Embarcadero: Delphi 13.1 Florence/Win64 toolchain, `System.Threading`, managed records и interface lifetime rules.
- MfPack: актуальные Delphi translations DirectX/MediaFoundation stack, если встроенных declarations недостаточно.

Ссылки и выводы собраны отдельно в `ENGINE_RESEARCH.md`.
