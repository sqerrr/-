# ENGINE_AGENT_TASK.md — ТЗ coding-агенту на реализацию движка

> Этот документ — **исполняемое ТЗ**, а не набор пожеланий.  
> Главный архитектурный документ: `ENGINE_SPEC.md`.

---

# 0. Роль агента

Ты реализуешь собственный Windows/Delphi engine foundation.

Нельзя менять архитектурные границы молча.

Если обнаружена проблема в спецификации:

1. зафиксировать проблему в `DECISIONS.md`;
2. предложить минимум два решения;
3. выбрать минимально рискованное;
4. добавить/изменить тест;
5. только затем менять контракт.

Не добавлять gameplay-specific код в Engine.

---

# 1. Технологии

Обязательно:

```text
Language: Delphi
Target: Win64
Reference compiler: Delphi 13.1 Florence
Window: raw Win32 API
Graphics: Direct3D 11 + DXGI flip model
UI/Text: Direct2D 1.1 + DirectWrite through DXGI
Audio: XAudio2 2.9
Gamepad v1: XInput
Simulation: fixed timestep, configurable, default 30 Hz
```

Не использовать VCL/FMX в runtime game host.

---

# 2. Правило реализации по фазам

Каждая фаза должна:

- компилироваться;
- иметь automated smoke/unit tests;
- иметь demo/benchmark;
- не ломать предыдущие тесты;
- не создавать circular unit dependencies.

Не начинать следующую фазу, пока acceptance criteria текущей не выполнены.

---

# 3. Phase 0 — Repository foundation

Создать:

```text
/src/engine
/src/game_stub
/src/tools
/tests
/assets_source
/assets_cooked
/config
/docs
```

Создать проекты:

```text
GameHost.dproj
EngineTests.dproj
EngineBenchmark.dproj
AssetCooker.dproj
```

Добавить:

- build configurations Debug/Release/Profile;
- compiler warnings policy;
- build version constant;
- logging bootstrap;
- `DECISIONS.md`;
- `THIRD_PARTY.md` с лицензиями/версиями.

Acceptance:

- clean checkout компилируется;
- console/basic host запускается;
- tests runner возвращает non-zero при failure.

---

# 4. Phase 1 — Core + Win32 host

Реализовать:

- high-resolution clock QPC;
- raw Win32 window class;
- message pump;
- Per-Monitor DPI Aware v2 manifest/context;
- resize/minimize/focus events;
- borderless window mode;
- config loader;
- file logger;
- application lifecycle.

Не писать renderer кроме clear stub.

Acceptance:

- resize 100 раз без утечки/crash;
- перенос между мониторами с разным DPI корректен;
- minimize не вызывает giant timestep;
- shutdown clean.

---

# 5. Phase 2 — Math

Реализовать unmanaged records:

```text
TVec2f
TVec3f
TVec4f
TMat4f
TQuatf (можно минимально)
TRectF
TAabb2
TCircle2
```

Зафиксировать convention:

```text
world X right
Y up
Z forward
gameplay XZ
D3D depth 0..1
```

Tests:

- matrix multiply;
- inverse basic transforms;
- projection;
- world->clip->screen;
- screen ray -> gameplay plane;
- epsilon comparisons.

Не копировать FMX matrix types в gameplay API.

---

# 6. Phase 3 — D3D11 bootstrap

Реализовать units минимум:

```text
Engine.Graphics.D3D11.Device
Engine.Graphics.D3D11.SwapChain
Engine.Graphics.D3D11.Resources
Engine.Graphics.D3D11.Debug
```

Device:

- hardware;
- BGRA support;
- debug flag Debug config;
- feature level 11_0 minimum;
- adapter name/VRAM logging.

Swap chain:

- CreateSwapChainForHwnd;
- FLIP_DISCARD;
- B8G8R8A8_UNORM;
- 2 buffers initial;
- resize handling;
- VSync toggle;
- tearing support query.

Depth target.

Acceptance:

- colored clear;
- rotating test triangle/cube;
- debug layer has no errors;
- resize/fullscreen stable;
- WARP smoke mode works from command line.

---

# 7. Phase 4 — Render frontend

Создать engine-neutral render description:

```text
TRenderFrame
TCameraRenderData
TMeshInstance
TSpriteInstance
TDebugLine
```

Никаких `ID3D11*` types в этих структурах.

Добавить asset handles.

Acceptance:

- GameStub submits render frame without importing D3D units;
- renderer can be replaced with NullRenderer for tests.

---

# 8. Phase 5 — Mesh/sprite batching

Реализовать:

- static vertex/index buffers;
- instanced mesh draw;
- instanced quad/billboard;
- dynamic instance ring/buffer;
- atlas UV/frame selection;
- material handle;
- opaque/cutout/transparent passes.

Performance acceptance:

- 2000 identical low-poly mesh instances <= small constant draw-call count;
- 10k billboard smoke test;
- no per-instance heap allocation.

Логировать:

```text
draw calls
instances
triangles
buffer upload bytes
```

---

# 9. Phase 6 — Camera 2.5D

Реализовать:

- perspective camera;
- orthographic camera;
- configurable yaw/pitch;
- follow target;
- smoothing;
- viewport/aspect;
- world->screen;
- screen->ground-plane ray.

Создать demo action-RPG angle:

- yaw around 45 degrees;
- pitch configurable 35–60;
- player target below screen center.

Никаких hard-code этих значений в renderer.

---

# 10. Phase 7 — Entity registry + component stores

Реализовать:

- generational IDs;
- O(1) create/destroy;
- packed transform/velocity/render stores;
- no TObject per entity;
- stable iteration.

Stress test:

- миллионы create/destroy cycles;
- stale handle rejected;
- no leaks;
- 100k entities lifecycle test, даже если normal gameplay меньше.

---

# 11. Phase 8 — Spatial hash + 2D collision

Реализовать allocation-free queries:

```text
Insert
Move
Remove
QueryCircle
QueryAabb
QuerySegment
```

Collision helpers:

- circle-circle;
- circle-AABB;
- segment-circle;
- swept circle/point basic.

Benchmark:

- 500/1000/5000 objects;
- repeated area queries;
- query result buffer reused.

Запрещён O(N^2) broad phase.

---

# 12. Phase 9 — Simple horde steering

Реализовать generic movement primitives:

```text
Seek
Arrive optional
Separation
ObstacleAvoidance
DesiredVelocity
```

Система не знает `Enemy`.

Demo:

- 500 agents pursue moving target;
- local separation;
- static obstacles.

AI update rate должен быть configurable/decimated относительно simulation tick.

---

# 13. Phase 10 — Asset pipeline

## Runtime AssetManager

Handles:

```text
Texture
Mesh
Shader
Material
JsonBlob/DataBlob
```

States:

```text
Unloaded
Loading
Ready
Failed
```

GPU upload только render/main thread.

## AssetCooker

V1:

- PNG -> cooked texture data;
- simple glTF 2.0 subset -> custom mesh;
- HLSL -> bytecode;
- JSON validate/copy/hash.

Cooked file versioning обязательно.

Acceptance:

- missing/corrupt asset -> structured error, не AV;
- reload texture/shader dev mode;
- release path не требует parsing glTF at frame startup.

---

# 14. Phase 11 — Direct2D/DirectWrite UI

Создать UI model независимый от D2D.

Минимальные widgets:

- panel;
- image;
- text;
- button;
- progress bar;
- tooltip;
- drag source;
- drop target.

Нужны:

- anchor/layout;
- logical pixel/DPI scaling;
- hit test;
- keyboard/gamepad navigation hooks;
- clip rect.

Demo:

- draggable icons между двумя полосами slots;
- tooltip;
- progress bars;
- 200-widget stress scene.

Это прямо подготовит будущий Chain/Reserve UI, но UI engine не должен знать значение slots.

---

# 15. Phase 12 — Input actions

Backends:

- Win32 keyboard/mouse;
- XInput gamepad.

Action layer:

```text
Digital action
1D axis
2D axis
Press/Release/Held
Deadzone
Rebinding
```

Save bindings в config.

Demo:

- player controller moves target/entity;
- UI navigation;
- gamepad vibration smoke test.

---

# 16. Phase 13 — XAudio2

Реализовать:

- device/master voice;
- buses;
- SFX playback;
- simple spatial pan/attenuation;
- source voice pooling;
- audio event aggregator;
- category caps/priorities.

Stress test:

- submit 10k hit events in one second;
- audible voice count remains bounded;
- no allocation storm.

---

# 17. Phase 14 — Debug/Telemetry

Implement overlay:

```text
FPS/frame time
simulation ms
render CPU ms
entity counts
draw calls
instances
spatial queries/candidates
audio voices
allocations if tracked
```

CSV/JSON benchmark output.

P50/P95/P99 timings.

Seed/build id display hooks.

---

# 18. Phase 15 — Deterministic headless mode

Null graphics/audio backends.

Headless fixed-tick runner.

World state hash API.

Acceptance:

- same seed + same scripted input -> same hash after 10k ticks;
- renderer on/off не меняет result;
- logging verbosity не меняет result.

---

# 19. Обязательные архитектурные запреты

Агент НЕ должен:

- делать один TObject на entity;
- делать один Draw call на actor;
- вызывать D3D11 из Game code;
- загружать texture/file синхронно из combat tick;
- делать A* для каждого обычного агента;
- использовать `Random` глобально в deterministic game logic;
- создавать dynamic arrays/strings per entity per tick;
- хранить raw pointer на component при возможности entity churn между ticks;
- использовать VCL timers;
- завязывать simulation delta на FPS;
- вводить service locator/global singleton без отдельного решения;
- создавать общий `Utils.pas`, куда сваливается всё подряд;
- добавлять новый third-party package без лицензии/обоснования.

---

# 20. Code review checklist для каждой задачи агента

Перед завершением задачи ответить в commit/notes:

1. Что изменилось?
2. Какой public contract изменён?
3. Какие аллокации происходят в hot path?
4. Какие новые dependencies?
5. Какие tests добавлены?
6. Как измерена производительность?
7. Что происходит на invalid input/device failure?
8. Есть ли gameplay-specific knowledge в Engine?
9. Можно ли поменять реализацию subsystem без изменения caller'ов?
10. Не появилась ли premature abstraction?

---

# 21. Первая конечная демонстрация движка

`EngineBenchmark.exe` / `GameStub.exe` должен показать сцену:

- изометрическая perspective camera;
- 3D ground + несколько препятствий;
- controllable player proxy;
- 300 simple mobs;
- часть mobs — low-poly meshes, часть billboards;
- separation/seek;
- 500+ visual projectiles/particles;
- UI с двумя drag-drop полосами slots;
- health/progress bars;
- несколько sound events с throttling;
- runtime toggle debug HUD;
- VSync/window/fullscreen toggle;
- resize и DPI safe.

Важно: это **не gameplay prototype**, а engine integration demo.

---

# 22. Definition of task complete

Агент не должен считать «движок написан», если есть только окно и renderer.

Task complete только после прохождения `Definition of Engine v0.1 Done` из `ENGINE_SPEC.md` и сохранённого benchmark baseline.
