# ENGINE_RESEARCH.md — результаты исследования технического стека

> Дата: 2026-09-16.  
> Цель: обосновать технические решения `ENGINE_SPEC.md`.

---

# 1. Delphi toolchain

Текущая стабильная линия RAD Studio на момент исследования — **13.1 Florence**. Embarcadero также предоставляет 64-bit IDE, ориентированную на Delphi Win64/C++ Win64 Modern workloads.

Практический вывод:

- Win64-first больше не требует держать основной workflow вокруг 32-bit IDE/compiler process;
- проект имеет смысл сразу делать Win64-only;
- platform assumptions можно существенно упростить.

Источники:

- https://docwiki.embarcadero.com/RADStudio/Florence/en/13_Florence_-_Release_1
- https://docwiki.embarcadero.com/RADStudio/Florence/en/64-bit_IDE

---

# 2. Direct3D 11 vs Direct2D

Direct2D отлично подходит для 2D UI/text, но выбранная игра — настоящий 3D/2.5D world:

- depth;
- perspective/orthographic camera;
- 3D meshes;
- billboards;
- custom HLSL;
- instancing;
- post effects.

Следовательно, Direct3D 11 должен быть world renderer.

Direct2D официально interoperates с Direct3D 11 через DXGI на DirectX 11.1+; D3D device для такого сценария создаётся с BGRA support.

Источник:

- https://learn.microsoft.com/windows/win32/direct2d/direct2d-and-direct3d-interoperation-overview

Вывод:

- D3D11 world;
- D2D1.1 + DirectWrite UI overlay;
- UI backend изолирован, чтобы позже его можно было заменить D3D UI renderer.

---

# 3. Swap chain

Microsoft рекомендует современную DXGI flip model вместо legacy blt model.

`DXGI_SWAP_EFFECT_FLIP_DISCARD` поддерживается D3D11 на Windows 10 и позволяет DWM работать эффективнее без лишнего copy path.

Источники:

- https://learn.microsoft.com/windows/win32/direct3ddxgi/for-best-performance--use-dxgi-flip-model
- https://learn.microsoft.com/windows/win32/api/dxgi/ne-dxgi-dxgi_swap_effect

Решение:

- Windows 10+ baseline;
- CreateSwapChainForHwnd;
- FLIP_DISCARD;
- 2–3 backbuffers;
- borderless fullscreen.

---

# 4. D3D11 threading

Microsoft отдельно указывает, что immediate context должен использоваться только одним thread одновременно, и DXGI operations/Present должны быть на том же thread.

Источник:

- https://learn.microsoft.com/windows/win32/direct3d11/overviews-direct3d-11-render-multi-thread-intro

Решение:

- v1 renderer/main thread единый;
- worker threads не трогают immediate context;
- GPU uploads маршалятся на render thread;
- deferred contexts не добавлять без profiling need.

---

# 5. Instancing

D3D11 `DrawIndexedInstanced` прямо предназначен для повторного использования geometry с различными per-instance attributes.

Источник:

- https://learn.microsoft.com/windows/win32/api/d3d11/nf-d3d11-id3d11devicecontext-drawindexedinstanced

Это хорошо соответствует survivors-like:

- много одинаковых базовых врагов;
- repeated environmental props;
- billboard units;
- particles/decals.

Решение: batching/instancing обязательны с самого начала.

---

# 6. Dynamic buffers

Microsoft рекомендует `D3D11_USAGE_DYNAMIC` для часто меняющихся buffers и `D3D11_MAP_WRITE_DISCARD`; `WRITE_NO_OVERWRITE` используется для append в ещё не затронутые GPU regions.

Источники:

- https://learn.microsoft.com/windows/win32/direct3d11/how-to--use-dynamic-resources
- https://learn.microsoft.com/windows/win32/api/d3d11/ne-d3d11-d3d11_map

Решение:

- dynamic instance buffers;
- DISCARD-first upload;
- NO_OVERWRITE только при реальной необходимости.

---

# 7. Device removed

D3D11 предоставляет `GetDeviceRemovedReason`, возвращающий `DEVICE_HUNG/REMOVED/RESET/...`.

Источник:

- https://learn.microsoft.com/windows/win32/api/d3d11/nf-d3d11-id3d11device-getdeviceremovedreason

Решение:

- ошибки device removal должны быть first-class diagnostics;
- GPU resources создаются из CPU asset descriptors, чтобы backend recreation был возможен.

---

# 8. Timing

Microsoft рекомендует `QueryPerformanceCounter/QueryPerformanceFrequency` для high-resolution game timing вместо прямого RDTSC.

Источники:

- https://learn.microsoft.com/windows/win32/api/profileapi/nf-profileapi-queryperformancecounter
- https://learn.microsoft.com/windows/win32/dxtecharts/game-timing-and-multicore-processors

Решение:

- QPC clock;
- fixed-step accumulator;
- render interpolation;
- clamp delta после suspend/debug break.

---

# 9. High DPI

Per-Monitor DPI Awareness v2 доступна на современных Windows и требует реакции на DPI changes окна.

Источники:

- https://learn.microsoft.com/windows/win32/hidpi/dpi-awareness-context
- https://learn.microsoft.com/windows/win32/api/windef/ne-windef-dpi_awareness

Решение:

- PMv2 сразу;
- UI в logical units;
- `WM_DPICHANGED` обработан как обязательный lifecycle event.

---

# 10. DirectWrite

DirectWrite поддерживает layouts и custom renderer; Direct2D напрямую умеет рисовать `IDWriteTextLayout`.

Источники:

- https://learn.microsoft.com/windows/win32/directwrite/rendering-directwrite
- https://learn.microsoft.com/windows/win32/api/dwrite/nn-dwrite-idwritetextlayout

Решение:

- DWrite — text shaping/layout;
- D2D — v1 text/UI raster backend;
- game UI не зависит от этих COM types.

---

# 11. XInput vs GameInput

GameInput — современный unified API и functional superset legacy APIs, поддерживающий PC начиная с Windows 10 19H1 через distribution package.

Однако XInput намного проще для первого controller backend и покрывает обычный Xbox-compatible gamepad.

Источники:

- https://learn.microsoft.com/gaming/gdk/_content/gc/input/overviews/input-overview
- https://learn.microsoft.com/windows/win32/xinput/getting-started-with-xinput

Решение:

- Input Action layer абстрактен;
- XInput backend v1;
- GameInput можно добавить позже без изменений gameplay code.

---

# 12. XAudio2

XAudio2 2.9 входит в Windows 10/11; Microsoft рекомендует 2.9 redist вместо старого XAudio2 2.7 для старых систем.

Источники:

- https://learn.microsoft.com/windows/win32/xaudio2/xaudio2-versions
- https://learn.microsoft.com/windows/win32/xaudio2/xaudio2-redistributable

Так как project baseline — Windows 10+, можно использовать системный XAudio2 2.9.

Для horde game важнее не API itself, а application-level event aggregation: нельзя создавать audible voice на каждый hit.

---

# 13. Delphi threading

RAD Studio PPL предоставляет `TTask`, `TParallel.For` и thread pool. Documentation отдельно предупреждает, что parallel code требует thread-safe access.

Источники:

- https://docwiki.embarcadero.com/RADStudio/Florence/en/Using_TTask_from_the_Parallel_Programming_Library
- https://docwiki.embarcadero.com/RADStudio/Florence/en/Using_TParallel.For_from_the_Parallel_Programming_Library

Решение:

- PPL допустим для asset/background work;
- authoritative combat simulation v1 single-threaded ради determinism;
- parallelization только после profiler.

---

# 14. Delphi interfaces / lifetime

Delphi interface refs обычно reference-counted через `_AddRef/_Release`; Embarcadero документация подчёркивает необходимость последовательной lifetime-модели и опасность смешивания object pointer с ref-counted interface reference.

Источники:

- https://docwiki.embarcadero.com/RADStudio/en/Interface_References
- https://docwiki.embarcadero.com/RADStudio/Athens/en/Using_Reference_Counting

Решение:

- COM interfaces используются естественно;
- mass gameplay data — plain records/handles;
- internal interface proliferation запрещено.

---

# 15. Delphi managed records

Managed fields (`string`, interface, dynamic arrays) требуют compiler-managed initialize/finalize/refcount behavior.

Источник:

- https://docwiki.embarcadero.com/RADStudio/en/Custom_Managed_Records

Решение:

- hot components по возможности unmanaged POD-like records;
- strings/arrays вынесены в definition/assets layer.

---

# 16. DirectX translations for Delphi

MfPack поддерживает актуальные Delphi translations D3D11/D3D12/DXGI/D2D/DirectWrite/XAudio2/WIC; на момент проверки текущий repo заявляет Delphi 13.1 и Windows 11 SDK 10.0.28000.x, лицензия MPL-2.0.

Источник:

- https://github.com/FactoryXCode/MfPack

Решение:

- сначала проверить встроенные Winapi units Delphi 13.1;
- если покрытия/совместимости не хватает, vendor pinned subset MfPack;
- не смешивать две независимые translations одного COM API в одних публичных types.

---

# 17. Memory diagnostics

Delphi имеет `ReportMemoryLeaksOnShutdown` на Windows.

Источник:

- https://docwiki.embarcadero.com/Libraries/Florence/en/System.ReportMemoryLeaksOnShutdown

FastMM5 даёт более глубокие diagnostics, но имеет отдельную dual-license модель; нельзя автоматически тащить его как dependency без решения по лицензии.

Источник:

- https://github.com/pleriche/FastMM5

Решение:

- built-in leak reporting обязательно в Debug;
- FastMM5 optional после license decision.

---

# 18. Итоговое техническое решение

Для текущей игры оптимальный low-risk stack:

```text
Delphi Win64
Raw Win32 host
D3D11 + DXGI flip-discard world renderer
D2D1.1 + DirectWrite UI/text
XAudio2 2.9
XInput
QPC fixed-step timing
Hybrid data-oriented entity/component stores
2D spatial hash gameplay
3D visual scene / XZ gameplay plane
Data-driven assets/content
Single-thread deterministic simulation initially
Async IO/decoding only
```

Это не самый «модный» стек, но для Windows-only Delphi проекта он минимизирует количество moving parts и хорошо соответствует требованиям игры.
