# Архитектурное предложение foundation

Статус: предложение на согласование, 2026-09-16.

Документ конкретизирует [требования к движку](ENGINE_REQUIREMENTS.md) и
[план foundation](FOUNDATION_PLAN.md), но не заменяет их. Ни одно решение ниже
пока не является принятым ADR. Описанные проверки являются будущими критериями,
а не отчётом о выполненной реализации.

## 1. Рекомендуемый пакет решений

| ID | Рекомендация | Статус до согласования |
| --- | --- | --- |
| AP-01 | Разделить `Engine`, `Game.Simulation`, `Game.Presentation` и исполняемые приложения направленными зависимостями | Рекомендуется |
| AP-02 | Иметь отдельные client и headless executables, использующие одну реализацию simulation | Рекомендуется |
| AP-03 | Использовать fixed step; начать сравнение с 60 Hz, сохранив частоту параметром сессии | Проверяемая гипотеза |
| AP-04 | Хранить массовые сущности в плотных типизированных stores с generational handles | Рекомендуется |
| AP-05 | Использовать постоянный worker pool, фазовые batches, логические chunks и детерминированный merge | Рекомендуется |
| AP-06 | Начать dynamic broadphase с uniform grid в XZ и проверять его brute-force oracle | Рекомендуется |
| AP-07 | Принять D3D11 feature level 11_0, DXGI flip model и offline HLSL SM5/DXBC как минимальный graphics profile | Рекомендация, требующая согласования совместимости |
| AP-08 | Закрепить device/context и GPU resources за главным потоком | Рекомендуется |
| AP-09 | Сначала не перекрывать simulation и CPU render submission; передавать renderer извлечённый неизменяемый кадр | Рекомендуется |
| AP-10 | Разделить source/cooked CPU assets и backend-specific GPU resources; выполнять IO/decode вне simulation pool | Рекомендуется |
| AP-11 | Отделить neutral input actions от Win32 input adapter и tick sampling | Рекомендуется |
| AP-12 | Использовать DUnitX как первого кандидата для unit tests после отдельной CLI-пробы; сценарные тесты и benchmarks оставить самостоятельными executables | Проверяемая гипотеза |
| AP-13 | На foundation обрабатывать device removal диагностируемым controlled shutdown; автоматическое recovery отложить | Рекомендуется |
| AP-14 | Ввести neutral audio event contract, но выбирать и реализовывать backend после F3 | Рекомендуется |

Пакет намеренно не выбирает полный ECS, render graph, fibers, scripting VM,
general-purpose physics или multi-backend RHI. Эти механизмы не требуются
известной нагрузкой и заметно расширяют поверхность ошибок foundation.

После согласования дорогие решения оформляются отдельными ADR. Если владелец
не согласен с частью пакета, исключение сначала фиксируется здесь, а не
маскируется реализацией другого поведения.

## 2. Границы и зависимости

Предлагаемое направление зависимостей:

```text
ClientApp
  -> Game.Simulation
  -> Game.Presentation
  -> Engine.Assets.IO
  -> Engine.Input
  -> Engine.Audio.Contracts
  -> Engine.Render.Contracts
  -> Engine.Graphics.D3D11
  -> Engine.Platform.Win32

HeadlessApp
  -> Game.Simulation
  -> Engine.Assets.IO
  -> Engine simulation contracts, jobs, spatial and diagnostics

Game.Simulation
  -> Engine CPU contracts only

Game.Presentation
  -> Game.Simulation read views
  -> Engine.Audio.Contracts
  -> Engine.Render.Contracts

Engine.Render.Contracts
  -> Engine.Assets.Contracts

Engine.Audio.Contracts
  -> Engine.Assets.Contracts

Engine.Graphics.D3D11
  -> Engine.Render.Contracts
  -> Engine.Assets.Contracts
  -> Engine.Platform.Win32

Engine.Assets.IO
  -> Engine.Assets.Contracts

Engine.Platform.Win32.Input
  -> Engine.Input

Engine
  -X-> Game
```

`ClientApp` является composition root и может связывать Game presentation с
конкретным backend. Это не разрешает `Game.Presentation` вызывать D3D или
хранить COM interfaces. `HeadlessApp` не должен транзитивно подключать window,
presentation или graphics units, включая их `initialization` sections.

Предлагаемые каталоги отражают владение, но не требуют создавать интерфейс для
каждого файла:

```text
src/engine/core
src/engine/time
src/engine/input
src/engine/audio/contracts
src/engine/jobs
src/engine/spatial
src/engine/render
src/engine/assets/contracts
src/engine/assets/io
src/engine/diagnostics
src/engine/platform/win32
src/engine/graphics/d3d11
src/game/simulation
src/game/presentation
apps/client
apps/headless
tools
tests
```

Engine предоставляет механизмы времени, handles, storage, jobs, spatial,
CPU assets, input actions, audio events и rendering contracts. Конкретные
records врагов, снарядов, эффектов, Skills, Chain, Catalysts и правила их
разрешения принадлежат Game. GPU realization и upload являются частью
конкретного graphics backend, а не общей CPU asset-области.

## 3. Владение данными

| Данные | Владелец | Допустимый доступ | Время жизни заимствования |
| --- | --- | --- | --- |
| Авторитетный `World` и stores | Simulation coordinator | Structural mutation только в точках commit | До следующей structural phase |
| Job input | Владелец фазы | Только чтение worker-ом | До barrier текущей фазы |
| Job output/scratch | Логический chunk | Запись только в свой диапазон | До детерминированного merge |
| Spatial index | Simulation coordinator | Неизменяемые queries после build | До следующего rebuild |
| Presentation event arena | `ClientApp` composition root | Simulation пишет текущий tick slice, Presentation читает closed batches | До consumption/discard в той же host iteration |
| Extracted frame | Presentation/extraction | Неизменяемое чтение renderer | До возврата synchronous render consumption |
| GPU submission batch | Graphics backend | Strong references на реально отправленные GPU resources | До сигнала связанного GPU completion query или остановки device |
| GPU device, context, resources | Graphics owner на main thread | Только graphics backend | До явного retirement/recovery |
| In-flight asset payload | IO/decode stage | Один владелец или явная очередь передачи | До publication, cancellation или disposal |

Первый вариант использует последовательные CPU-фазы: fixed ticks завершаются,
затем формируется кадр, затем main thread выполняет graphics submission.
Worker jobs внутри фаз разрешены. GPU при этом может асинхронно исполнять ранее
отправленные команды; запрет относится только к преждевременному усложнению
владения CPU simulation и extracted frames.

Delphi dynamic array не считается immutable snapshot: присваивание может
разделять backing storage. После публикации view запрещены resize и запись через
любой alias. Горячие records и job descriptors не должны содержать `string`,
interfaces, dynamic arrays, anonymous methods и другие managed fields без
отдельно описанного владельца.

Переменные job outputs используют заранее выделенные chunk slices/arenas.
Исчерпание candidates, events или structural commands не приводит к allocation
в worker и не обрезает результат. Chunk сообщает требуемый размер, фаза
завершается без authoritative mutation, run получает fail-fast диагностику.
Capacity изменяется только на безопасной границе до повторного запуска
сценария. Для production Game позднее допустима иная детерминированная политика
budget overflow, но она должна быть явным игровым правилом с тестами.

## 4. Время, ввод и порядок simulation

### 4.1 Fixed step

- Использовать monotonic high-resolution clock и accumulator без округления шага до целых миллисекунд.
- Частота является параметром сессии и входит в replay/benchmark metadata; менять её во время сессии нельзя.
- 60 Hz предлагается как первый baseline для активно управляемого персонажа. 30 Hz сравнивается по отзывчивости, стоимости и поведению быстрых объектов до окончательного выбора.
- Headless runner выполняет заданное число ticks без ожидания wall clock.
- При потере фокуса и pause накопление останавливается; при возврате clock baseline сбрасывается, held input нейтрализуется согласно явной политике.
- Начальная гипотеза catch-up limit: не более четырёх simulation ticks за одну host iteration. При длительной перегрузке wall-time debt отбрасывается с диагностикой, но авторитетные ticks и боевые события не перескакиваются.
- Simulation deadlines первоначально представляются `UInt64` в Q32.32 simulation ticks. Период конвертируется один раз по каноническому правилу округления, затем `next_deadline += period`; повторное вычисление от округлённого `now` запрещено.
- Все due occurrences до границы текущего tick выполняются в стабильном порядке. Невозможное число срабатываний обрабатывается общим fail-fast/budget контрактом, а не скрытым пропуском.

`Engine.Input` определяет action IDs, press/release/held state и tick snapshot
без `HWND`, VK или XInput types. Win32 adapter собирает OS events, а mapping из
physical controls в actions принадлежит client configuration и допускает
rebinding без изменения Game. Press/release edges назначаются ближайшему ещё не
начатому tick по единой политике и потребляются один раз; held state доступен
каждому следующему tick. Headless передаёт тот же tick snapshot напрямую. Replay
хранит tick-indexed actions, решения Game, seed, версии данных и частоту
simulation.

### 4.2 Фазы тика

Foundation sandbox использует следующий минимальный порядок:

1. `BeginTick`: зафиксировать input и команды, разрешённые на границе тика.
2. `ComputeIntent`: jobs читают начальное состояние и создают movement/intention output.
3. `ApplyMovement`: применить движение по определённому порядку.
4. `BuildSpatial`: обновить read-only broadphase для нового положения.
5. `Query`: jobs формируют targeting/collision candidates, но не разрешают gameplay damage.
6. `Resolve`: Game объединяет candidates и события в стабильном порядке.
7. `CommitStructural`: применить spawn, despawn и изменения состава stores.
8. `EndTick`: зафиксировать counters, hash и состояние для interpolation/replay.

Это не определяет место Chain activation относительно движения, действие нового
снаряда в tick его создания, RESET или последствия смерти. Перед G0 Game должен
разбить `Resolve` на собственные причинные подфазы. Engine требует только явных
barriers, владения и стабильного порядка.

Каждый завершённый tick может сформировать отдельный non-authoritative
`PresentationEventBatch` с `(tick, event ordinal)`. Client presentation хранит
cursor последнего потреблённого события и обрабатывает закрытые batches ровно
один раз, в tick order. Несколько catch-up ticks дают несколько batches; frame
без нового tick не повторяет one-shot events. Headless передаёт null sink и не
подключает `Game.Presentation`; authoritative simulation от наличия consumer не
зависит. Длительные gameplay telegraphs извлекаются из текущего состояния, а не
существуют только как потенциально потерянный one-shot event.

`ClientApp` владеет заранее выделенной arena минимум на catch-up limit batches.
После ticks Presentation consume/discard выполняется в той же host iteration
даже при minimize или пропуске render, после чего arena можно переиспользовать.
Simulation никогда не ждёт Presentation. Event capacity ограничена: тестовый
режим сообщает overflow как ошибку, а shipping policy может детерминированно
отбросить только события, помеченные Game как cosmetic, с counter. Важный
длительный telegraph обязан оставаться восстановимым из состояния. Shutdown
закрывает текущий batch и consume/discard его до освобождения arena.

## 5. Entity storage и handles

Начальный storage является custom/hybrid, а не универсальным ECS:

- `EntityHandle` содержит process-local `world token`, `slot` и `generation`; точная ширина полей выбирается после расчёта capacity и lifetime.
- Таблица slots хранит generation, признак занятости, kind/store и dense index.
- Каждый массовый тип имеет плотный массив обычных records и обратную связь `dense index -> slot`.
- `swap-remove` обновляет dense index перемещённого объекта; dense indices и pointers нельзя хранить между structural phases.
- Spawn/despawn workers записывают в command buffers. Coordinator назначает slots и применяет команды в стабильном порядке.
- Capacity резервируется до параллельной фазы. `SetLength` и перемещение store во время jobs запрещены.
- При generation wrap слот выводится из повторного использования либо срабатывает иной заранее протестированный fail-fast контракт.
- Validation всегда сравнивает `world token`; handle другого одновременно или последовательно созданного `World` отклоняется даже при совпадении slot/generation.

`WorldToken` выдаётся process-local `WorldRegistry`, монотонно, без повторного
использования; ноль невалиден, wrap является fail-fast ошибкой. Token служит
только runtime validation и не сериализуется, не входит в authoritative state
или canonical replay hash. Для hash/serialization handle нормализуется в
run-local deterministic world ordinal, slot и generation. Runtime handles не
переживают процесс и не являются save/content IDs.

Сначала используются небольшие AoS records. Холодные definitions и редкое
состояние отделяются от массовых данных. SoA вводится для измеренного горячего
прохода, а sparse-set допустим как локальный store для действительно разреженного
компонента. Слово dense не означает Delphi `packed record`.

### Альтернативы storage

| Вариант | Преимущество | Причина не выбирать сейчас / условие пересмотра |
| --- | --- | --- |
| Типизированные dense stores | Прямые циклы, простой lifetime и churn | Рекомендуемый baseline |
| Sparse-set components | Удобны для независимо добавляемых разреженных данных | Использовать локально, когда join и индексы оправданы реальным доступом |
| Archetype ECS | Плотные проходы по устойчивым наборам компонентов | Пересмотреть при большом числе часто запрашиваемых сочетаний и доказанной цене ручных stores |
| Object-per-entity | Простая объектная модель | Не подходит массовому churn и locality; допустим для немногих сложных controllers |

## 6. Jobs, merge и RNG

Начальный Job System: небольшой постоянный pool на `TThread`, явный shutdown,
`FreeOnTerminate = False`, phase batch и completion barrier. Lock-free deques,
fibers, вложенные jobs и универсальный dependency graph не входят в baseline.

- Работа делится на логические chunks, не зависящие от числа workers.
- Input chunk неизменяем; output и scratch принадлежат chunk, а не worker.
- Serial mode запускает те же kernels, chunks и merge без создания второго алгоритма.
- Atomic выдача следующего chunk может влиять на исполнителя, но не на output layout или итоговый порядок.
- Merge использует стабильный ключ, заданный системой Game, например `(phase, source, ordinal, target)`.
- Hash-table iteration, completion order и общий atomic append не являются авторитетным порядком.
- Variable outputs не теряются при переполнении: применяется контракт fail-fast из раздела владения, до начала `Resolve` или structural commit.
- Floating-point reductions выполняются в фиксированном порядке; coordinator, serial executor и все workers получают и проверяют одинаковую rounding/FTZ/DAZ environment. Между разными CPU/компиляторами bitwise identity пока не обещается.
- Shared gameplay RNG и `RandSeed` запрещены. Потоки RNG выводятся из run seed, стабильного owner ID и domain tag; один state изменяет один владелец.
- Runtime `world token` не участвует в RNG, gameplay ordering или canonical hash; для них используется нормализованный run-local entity identity.
- Gameplay и cosmetic randomness разделяются. Конкретный integer PRNG выбирается с test vectors до deterministic stress в F2.

Worker boundary перехватывает исключение, копирует безопасную диагностику и в
`finally` завершает completion accounting. Ошибка делает текущий tick
невалидным: simulation останавливается, а не продолжает частично изменённый
мир. Shutdown прекращает submission, будит workers, запрашивает cooperative
stop, дожидается jobs и только затем освобождает их inputs и synchronization
objects. `TerminateThread`, `TThread.Synchronize` и UI callbacks из jobs
запрещены.

Worker pool пересматривается, если измерения показывают заметную потерю на
нерегулярном графе задач, которую нельзя устранить размером chunks и
упрощением фаз. Само наличие более сложного scheduler не считается выгодой.

## 7. Spatial broadphase

Для динамических XZ-объектов предлагается uniform grid с настраиваемым размером
ячейки. Index строится после movement и остаётся read-only до следующего build.
Записи внутри ячеек и результаты queries получают стабильный tie-break по
handle/ID.

Начальные queries: radius, AABB, nearest-N, cone/sector и neighbors. Большие
объекты могут занимать несколько ячеек; query обязан детерминированно устранять
дубликаты. Высокоскоростной projectile требует swept test, а не только overlap
в конечной точке.

На малых наборах каждый query сравнивается с brute-force oracle. Stress cases
включают одну плотную ячейку, большой AoE, объекты разного размера и частые
перемещения. Нельзя молча обрезать gameplay candidates ради времени кадра.

Loose grid/quadtree пересматривается при большой неоднородности размеров или
пространственно разреженном мире. BVH подходит будущей преимущественно статичной
геометрии. Navigation и LOS являются отдельными структурами и не должны
превращать dynamic broadphase в универсальную систему.

## 8. Renderer и extracted frame

### 8.1 D3D11 baseline

Предлагаемый минимальный hardware profile AP-07: D3D11 feature level 11_0 и
Shader Model 5.0. Это отдельное compatibility requirement, которое владелец
должен согласовать; одна только поддержка Windows 10/11 его не устанавливает.
WARP остается явным diagnostic mode и не скрывает несовместимый hardware.

- DXGI flip-discard swap chain и offline DXBC являются частью предлагаемого baseline.
- Windowed/borderless и `Present(1, 0)` являются стартовой конфигурацией F3, а не неизменяемым API-контрактом.
- Device, immediate context, swap chain и GPU objects принадлежат main thread.
- Небольшой фиксированный набор passes: opaque, alpha-test, sorted transparent, debug и atlas text/overlay.
- Static meshes, instancing, billboards/atlas, perspective/orthographic cameras и depth входят в F3.
- Runtime Release загружает заранее собранный SM5 DXBC. Runtime shader compilation остается development/cooker path.
- Render graph, deferred contexts, MSAA, exclusive fullscreen, shadows, skinning и универсальная material graph не входят в первый renderer.

D3D11 выбран из-за соответствия требуемому масштабу и уже пройденной узкой
toolchain-пробы. Это не доказательство hardware renderer, swap chain, ABI всех
bindings или производительности.

### 8.2 Контракт кадра

`Game.Presentation` читает только завершённое simulation-состояние, применяет
interpolation и формирует generic packets: camera, transforms, mesh/material
asset IDs, instances, sprites, debug primitives и text. Оно также решает, какие
VFX и indicators несут gameplay-опасность. Renderer не знает Skills, Chain,
элиток или правил отключения важных telegraphs.

Extracted frame содержит значения и typed resource handles, но не pointers на
изменяемые stores. На первом этапе один переиспользуемый frame arena достаточно:
после freeze он неизменяем до возврата synchronous `RenderFrame`. GPU не должен
ссылаться на эту CPU arena после копирования данных в upload path.

Успешно загруженная GPU revision становится active только на frame boundary.
Во время `RenderFrame` backend разрешает `AssetId` в текущую active GPU revision
и переносит strong reference в `GPU submission batch`.
После последнего draw batch связывается с `D3D11_QUERY_EVENT`. Возврат
`RenderFrame` освобождает только CPU frame pins; GPU resource references живут
в submission batch до успешного неблокирующего query или прекращения работы
device. Таким образом reload/unload после возврата не освобождает ресурс,
который ещё читает GPU. Retirement ведётся batches, а не обязательно отдельным
query на каждый resource.

Dynamic instance/constant buffers сначала используют `WRITE_DISCARD`.
`NO_OVERWRITE` и сложные ring allocators добавляются только с точным учетом
занятых диапазонов. Двойной swap chain сам по себе не доказывает, что GPU уже
закончил использовать произвольный resource. Удаляемые/replaced resources
проходят retirement, подтверждённый GPU query; `Present` и `Flush` не являются
таким подтверждением.

Отдельный render thread и simulation/render overlap пересматриваются, если
профиль показывает значимый CPU bottleneck, а ожидаемая выгода превышает цену
нескольких immutable frames, resource pinning, bounded queue, backpressure и
дополнительной input latency.

### 8.3 Resize и device removal

Resize выполняется в безопасной точке после снятия backbuffer bindings. При
нулевом размере обычный render/resize path не запускается. Minimized/occluded
client не должен busy-spin.

Device removal в foundation останавливает submission, записывает HRESULT и
`GetDeviceRemovedReason`, меняет device epoch и инвалидирует GPU handles. Run
завершается controlled shutdown без ожидания queries старого device. Это
AP-13: не пытаться продолжать частично восстановленную сессию до появления
конкретного product requirement и fault-injection coverage. CPU asset identity
не теряется, поэтому позднее можно добавить пересоздание backend и повторные
uploads без изменения Game или CPU asset contracts.

## 9. Assets и IO

CPU asset identity разделяется на стабильный `AssetId`, generational runtime
handle и content revision. Эти types находятся в `Engine.Assets.Contracts` и не
зависят от graphics. Backend отдельно добавляет GPU resource handle и graphics
device epoch. Headless использует только CPU identity/loading и не подключает
GPU upload, COM или graphics initialization.

Начальный pipeline:

```text
request
  -> background read
  -> bounded decode and validation
  -> CPU-ready payload
  -> CPU revision publication

client-only branch
  -> main-thread GPU upload
  -> publish as active GPU revision at frame boundary only on success
```

- IO выполняет отдельный worker; decode использует небольшой pool, отдельный от simulation jobs.
- Очереди ограничиваются по числу запросов и байтам. Hot-path request использует неблокирующий `TryEnqueue` и получает status/fallback; он не ждёт IO/decode или свободного места. Producer вне hot path может ждать только по явно названному API.
- Renderer при cache miss возвращает fallback и не ждёт disk IO.
- Reload может публиковать новую CPU revision независимо. Graphics хранит `pending GPU revision` отдельно от `active GPU revision`; только успешный upload атомарно меняет active на frame boundary. При ошибке upload новые кадры продолжают использовать предыдущую рабочую active revision, а не fallback. `RenderFrame` переносит её pin в submission batch.
- Каждый request получает монотонную generation для конкретного `AssetId`. CPU и GPU publication проверяют, что результат всё ещё соответствует latest requested generation и не старше active revision; superseded или пришедший от старого device epoch результат освобождается без публикации.
- Gameplay definitions валидируются до запуска сценария. Их hot reload во время replay первоначально запрещён.
- Logging, shader cache и hot reload не выполняют synchronous disk IO в simulation/render paths.

Предлагаемые source candidates: ограниченный glTF 2.x/GLB для static mesh,
PNG для исходных textures, HLSL и validated JSON definitions. Предлагаемые
cooked resources: versioned mesh blobs, DDS с mip levels, DXBC, atlas metadata
и manifest. До первого реального импорта фиксируются axes, handedness, winding,
units, UV, sRGB/linear и alpha conventions.

F3 может использовать procedural resources. Полный importer/cooker не блокирует
renderer sandbox. Любая parser/image/font dependency принимается только после
фиксации версии, лицензии, назначения и deployment.

## 10. Audio contract

`Engine.Audio.Contracts` содержит только нейтральные `AudioEvent`: stable sound
asset ID, category, priority, position, gain/pitch и aggregation key. В нём нет
XAudio2 types, Skills или правил Game. `Game.Presentation` преобразует gameplay
events в audio events и определяет, какие массовые попадания агрегируются.

Client владеет bounded command queue и будущим backend/mixer. Presentation
преобразует каждый tick-tagged event batch ровно один раз. Hot-path enqueue не
блокируется; при переполнении применяется явная политика приоритетов и counters,
а gameplay state не зависит от воспроизведения звука. Headless использует null
presentation sink и не подключает audio contracts/backend; mapping проверяется
отдельными unit/client integration tests.

Voice limits, категории и агрегация входят в будущую проверку backend. Выбор
XAudio2 или альтернативы отложен до отдельной пробы bindings, deployment и
shutdown. Audio backend не блокирует F1-F3, но граница уже не позволяет Game
обратиться к platform API напрямую.

## 11. Ошибки, диагностика и shutdown

- Ожидаемые ошибки загрузки и invalid handles возвращают typed result/status; exceptions не используются как обычный hot-loop control flow.
- Неисправимая ошибка worker, world invariant или graphics initialization останавливает соответствующий run с контекстной диагностикой.
- COM references живут только в backend; GPU objects освобождаются graphics owner-ом.
- `Move` и `FillChar` применяются только к доказанно unmanaged records.
- Hot counters и trace events записываются в заранее выделенные buffers. Запись файла выполняется вне simulation/render hot path.
- Переполнение diagnostic queue может потерять необязательное сообщение с counter, но не gameplay command/event.

Рекомендуемый порядок shutdown:

1. Запретить новые input, asset и job submissions.
2. Отменить/завершить IO и разбудить ожидающие очереди.
3. Дождаться simulation/decode workers без main-thread callback dependency.
4. Освободить world, frames и CPU payloads после завершения пользователей.
5. Завершить GPU retirement с ограниченным ожиданием; при removal не ждать query старого device бесконечно.
6. Освободить graphics objects на main thread, затем окно и diagnostics.

## 12. Tests и measurements

DUnitX уже присутствует в установке Delphi, но runner, CLI build и deployment
ещё не проверены. Рекомендуется использовать его для unit tests только после
минимальной пробы. Headless scenarios и benchmarks должны оставаться обычными
console executables с ненулевым exit code при ошибке, чтобы не зависеть от
возможностей одного test framework.

Минимальная матрица проверок:

| Область | Проверка |
| --- | --- |
| Time/input | Одинаковый tick input при разных render rates; pause/focus/catch-up; timer drift |
| Handles/stores | Stale handles, generation mismatch, churn, swap-remove, cross-run world token и canonical normalization |
| Jobs | Serial/1/N workers, randomized scheduling delay, worker exception, shutdown in flight |
| Determinism | Canonical hash авторитетных полей, RNG и pending events; не hash сырой памяти |
| Spatial | Сравнение с brute-force, cell boundaries, dense cell, large radius, swept projectile |
| Extraction | Renderer не получает store pointers; frame arena не переиспользуется до consumption; resource pin передаётся в GPU submission batch |
| Graphics | Hardware/WARP, resize/minimize, shader failure, debug layer, device-removal controlled-shutdown fault injection |
| Assets | Missing/corrupt asset, bounded queues, reload revision, shutdown на каждой стадии |
| Audio | Aggregation, voice limits, nonblocking queue overflow и отсутствие backend в headless |
| Dependencies | Headless unit/import graph без graphics; client без VCL/FMX/BPL runtime |

Benchmarks фиксируют environment, revision/dirty state, build flags, seed,
scenario, workers, warmup, duration, P50/P95/P99, phase times, allocations и
counters. Первые результаты создают baseline, но не превращаются автоматически
в абсолютную гарантию для другой машины.

## 13. Условия пересмотра

| Решение | Пересматривать, когда |
| --- | --- |
| Dense typed stores | Реальные Game queries требуют многих динамических component combinations или ручные joins доминируют в сложности/времени |
| Фазовый worker pool | Измеренный irregular workload теряет существенное время из-за отсутствия work stealing/dependencies |
| Uniform grid | Большой разброс размеров, разреженный мир или плотные клетки стабильно доминируют в broadphase |
| D3D11 | CPU submission является измеренным bottleneck либо требуемая graphics feature плохо реализуема в D3D11 |
| Один graphics owner/main thread | Профиль доказывает выгоду overlap после учета latency, копирования и lifetime |
| Один CPU frame arena | Вводится render overlap или другой асинхронный CPU consumer |
| Узкий cooked pipeline | Реальный production content требует автоматизации, которой нет в минимальном cooker |
| Controlled shutdown при device removal | Появляется product requirement продолжать сессию и есть проверяемый recovery plan для всех GPU resources |

Не являются достаточной причиной пересмотра: популярность технологии,
абстрактная современность API или возможность гипотетического второго проекта
без конкретного сценария.

## 14. Вопросы для согласования

Предлагается согласовать пакет AP-01 - AP-14 со следующими явными оговорками:

1. 60 Hz, catch-up limit 4, `Present(1, 0)` и DUnitX остаются проверяемыми гипотезами, а не окончательными константами.
2. Управление направлением атаки, manual aim/dash и причинность Chain решаются в Game до G0, а не в Engine scheduler.
3. Reference hardware и абсолютные budgets фиксируются после первого работающего sandbox.
4. Audio backend и controller path не выбраны: Delphi bindings XAudio2 и XInput пока не найдены. AP-14 принимает только нейтральную audio-границу; keyboard/mouse input не зависит от XInput.
5. glTF, PNG, DDS и JSON пока являются направлениями pipeline; сторонние библиотеки не приняты.
6. AP-07 предлагает feature level 11_0/SM5 как минимальную hardware-совместимость; это нужно принять или изменить отдельно от будущих performance budgets.

После согласования предлагается создать ADR для boundaries/headless, storage и
jobs/determinism, D3D11/render extraction/device-removal policy. Asset pipeline
можно утвердить отдельно перед F4, когда появится минимальный реальный ресурс.
