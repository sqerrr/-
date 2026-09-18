# Архитектурные решения, применимые вне Delphi

Документ выделяет переносимые идеи из Delphi-oriented proposal и обсуждений.

## 1. Directed dependencies

Рекомендуемая принципиальная схема:

```text
Client/Host
  -> Game.Simulation
  -> Game.Presentation
  -> Engine contracts/services
  -> Platform/Renderer/Audio/Input backends

Headless
  -> Game.Simulation
  -> CPU-only engine contracts

Engine -X-> Game
```

Game Simulation не знает platform graphics/audio/windowing. Presentation не является authoritative gameplay.

## 2. Отдельный headless executable/режим

Нужен для:

- simulation regression;
- balance Monte-Carlo;
- deterministic seeds;
- benchmark;
- AI training/debug experiments;
- CI.

## 3. Fixed-step authoritative simulation

Simulation time отделён от render time. Render использует interpolation/read views. Частота сессии фиксирована и входит в replay metadata.

## 4. Data ownership

В каждой фазе должно быть ясно:

- кто владеет authoritative world;
- что worker читает;
- куда worker пишет;
- когда разрешена structural mutation;
- как merge становится deterministic.

## 5. Dense storage для массовых сущностей

Не требовать универсальный ECS. Начать с typed dense stores/generational handles и вводить более общий ECS только при подтверждённой пользе.

## 6. Jobs

Постоянный worker pool/job system; логические chunks не зависят от числа workers. Completion order не должен определять authoritative result.

## 7. Spatial

Dynamic XZ broadphase начинается с простого uniform grid/spatial hash и проверяется brute-force oracle на малых сценах. Не превращать одну структуру в physics/navigation/LOS/AI-everything.

## 8. Extracted presentation frame

Renderer получает значения/handles/packets, а не указатели на mutable gameplay stores. Presentation может быть пересоздана без изменения authoritative state.

## 9. Async assets

Disk/network/decode не блокируют simulation/render hot path. CPU asset identity отделена от GPU/backend resource lifetime.

## 10. Наблюдаемость

Counters, traces, seed metadata, versioned content pack, benchmark scenario и frame/tick phase timings являются частью foundation, а не post-release feature.

## 11. Не абстрагировать гипотетический второй проект заранее

Движок должен быть переиспользуемым, но не через универсальный framework на каждый мыслимый жанр. Reuse достигается хорошими boundaries и отсутствием игровых понятий в Engine, а не render graph/fibers/scripting VM «на всякий случай».
