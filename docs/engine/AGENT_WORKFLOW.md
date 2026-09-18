# AGENT_WORKFLOW.md — рекомендуемый процесс AI-разработки проекта

> Этот процесс **рекомендательный**. Coding-агенту разрешено предложить более подходящий workflow, если он объяснит, какие проблемы решает лучше и какую цену добавляет.

---

# 1. Цель процесса

Главная проблема длительной AI-разработки — не качество генерации отдельного куска кода, а потеря контекста между сессиями и постепенный drift архитектуры.

Поэтому источник истины должен находиться в repository, а не в истории чата.

Нам нужны четыре типа знаний:

1. **постоянные правила проекта**;
2. **актуальное поведение системы**;
3. **активные изменения**;
4. **история важных архитектурных решений**.

---

# 2. Рекомендуемый набор

Предпочтительная комбинация:

- `AGENTS.md` — постоянные инструкции coding-агентам;
- OpenSpec — current specs + change proposals;
- ADR — архитектурные решения и причины;
- обычные automated tests/benchmarks — исполняемые инварианты;
- `/docs/research` — исследования и альтернативы, не являющиеся обязательной спецификацией.

OpenSpec — рекомендация, не обязательное технологическое требование.

Если coding-agent считает, что Spec Kit, собственная markdown-система или другой инструмент лучше подходит его рабочей среде, пусть сначала сравнит варианты и предложит замену.

---

# 3. Почему OpenSpec подходит этому проекту

У проекта будут часто меняться:

- архитектура движка;
- системы боя;
- содержимое Chain;
- баланс;
- AI;
- content pipeline.

У OpenSpec удобно разделены:

- текущая спецификация системы;
- предлагаемое изменение;
- design конкретного изменения;
- tasks реализации;
- archive завершённых изменений.

Это снижает вероятность того, что в `GAME_SPEC.md` останутся одновременно три несовместимые версии одной механики.

---

# 4. Установка OpenSpec — рекомендуемый вариант

На момент подготовки документа официальный OpenSpec требует Node.js 20.19.0+.

Рекомендуемый ручной путь:

```powershell
node --version
npm install -g @fission-ai/openspec@latest
openspec --version
cd <project-root>
openspec init
```

После `init` выбрать используемый coding tool.

Не надо устанавливать OpenSpec, если:

- coding-agent уже использует более подходящий spec-driven workflow;
- дополнительный CLI создаёт больше трения, чем пользы;
- проектная среда не позволяет Node tooling.

В таком случае сохранить саму модель процесса вручную.

---

# 5. Не смешивать две тяжёлые SDD-системы без причины

GitHub Spec Kit также является сильным современным вариантом и предоставляет более формализованный pipeline:

```text
constitution
→ specify
→ clarify
→ plan
→ checklist
→ tasks
→ analyze
→ implement
→ converge
```

Для нашего небольшого/среднего проекта это может оказаться полезным позже, особенно если появится несколько агентов или команда.

Но **не рекомендуется одновременно навязывать полный OpenSpec workflow и полный Spec Kit workflow**.

Начальный выбор:

- OpenSpec — если нужен лёгкий change/spec lifecycle;
- Spec Kit — если агенту/команде нужен более формальный end-to-end delivery process;
- plain AGENTS + ADR + specs — если сильный агент успешно поддерживает дисциплину без отдельного CLI.

Пусть основной coding-agent оценит эти варианты перед инициализацией.

---

# 6. AGENTS.md

В корне репозитория нужен компактный `AGENTS.md`.

Он должен быть похож на README для агента, а не на копию всех спецификаций.

Пример содержания:

```markdown
# Project rules

- Delphi / Win64 runtime.
- Read relevant OpenSpec/current specs before architectural changes.
- Engine layer must not depend on Game layer.
- Do not add dependency without documenting license and rationale.
- Use data-oriented storage for mass transient entities.
- No synchronous IO in simulation/render hot path.
- Gameplay simulation uses fixed timestep.
- Respect current threading ownership rules.
- Add/adjust tests with behavioral changes.
- Run relevant tests and benchmark before finishing performance-sensitive work.
- Significant architectural changes require ADR.
- If a requirement appears wrong, propose a spec change; do not silently work around it.
```

Не помещать туда каталог всех скиллов или историю исследований.

---

# 7. ADR

Рекомендуемая папка:

```text
/docs/adr/
```

Пример:

```text
ADR-0001-d3d11-primary-render-backend.md
ADR-0002-fixed-step-simulation.md
ADR-0003-job-system-model.md
ADR-0004-entity-storage.md
ADR-0005-game-engine-boundary.md
```

ADR создаётся для решений, смена которых будет дорогой.

Структура простая:

```text
Status
Context
Decision
Alternatives considered
Consequences
Revisit conditions
```

Последний пункт особенно важен: решение не превращается в вечную религию.

---

# 8. Research не равно Spec

Хранить отдельно:

```text
/docs/research/
```

Например:

```text
d3d11-vs-d3d12.md
entity-storage-options.md
spatial-grid-benchmarks.md
job-system-options.md
openspec-vs-speckit.md
```

Research отвечает «что мы узнали».

ADR отвечает «что решили и почему».

Spec отвечает «как система должна вести себя сейчас».

Это должны быть разные документы.

---

# 9. Рекомендуемая структура repository

```text
/AGENTS.md
/README.md

/openspec/
    /specs/
    /changes/

/docs/
    /architecture/
    /adr/
    /research/
    /game-design/

/src/
    /engine/
    /game/
    /tools/

/tests/
    /unit/
    /integration/
    /performance/

/benchmarks/

/assets_source/
/assets_cooked/
```

Конкретная структура OpenSpec после `init` определяется установленной версией инструмента; не надо вручную ломать его ожидаемый layout.

---

# 10. Как начинать новую крупную задачу

Не писать coding-agent'у:

> Сделай многопоточность.

Лучше:

> Нужна многопоточная обработка simulation jobs. Прочитай AGENTS.md, текущую threading spec, соответствующие ADR и benchmarks. Сначала оцени текущее состояние и подготовь change proposal. Сравни минимум два варианта. Не начинай реализацию до фиксации acceptance criteria.

Для небольшого очевидного bugfix полный design document не нужен.

Процесс должен быть пропорционален риску изменения.

---

# 11. Минимальный lifecycle значимого изменения

```text
1. Explore current code/spec
2. Define problem
3. Proposal
4. Acceptance criteria
5. Architecture/design if needed
6. Tasks
7. Implementation
8. Tests
9. Benchmarks if performance-sensitive
10. Review diff against spec
11. Update current spec
12. ADR if architectural decision changed
13. Archive change
```

---

# 12. Что должен делать агент в начале новой сессии

Для крупной задачи агенту стоит дать короткую установку:

```text
Работай по репозиторию как по source of truth.
Прочитай AGENTS.md.
Найди релевантные current specs/ADR самостоятельно.
Не загружай весь docs каталог без необходимости.
Перед существенным изменением дай краткий impact analysis.
Если спецификация противоречит реальности — предложи поправку.
```

Это эффективнее, чем каждый раз вставлять 30 страниц контекста в prompt.

---

# 13. CONTEXT_INDEX

Опционально полезен небольшой файл:

```text
/docs/CONTEXT_INDEX.md
```

Пример:

```text
Engine overview        -> docs/architecture/engine.md
Threading              -> openspec/specs/engine/threading/...
Rendering              -> openspec/specs/engine/rendering/...
Entity model           -> openspec/specs/engine/entities/...
Spatial                -> openspec/specs/engine/spatial/...
Assets                 -> openspec/specs/engine/assets/...
Combat model           -> docs/game-design/...
Elite adaptation       -> openspec/specs/game/elites/...
AI/MCP                 -> openspec/specs/game/ai-integration/...
```

Он нужен только если repository становится достаточно большим, что агенту трудно быстро находить релевантные документы.

---

# 14. Использовать тесты как часть спецификации

Проза устаревает.

Поэтому критические требования желательно превращать в automated checks.

Примеры:

```text
Requirement:
Stale EntityId не должен обращаться к новой entity.

Executable contract:
Unit test на generation mismatch.
```

```text
Requirement:
Game layer не зависит от D3D11.

Executable contract:
Static dependency/lint check.
```

```text
Requirement:
Spatial query не деградирует квадратично.

Executable contract:
Performance benchmark + regression threshold.
```

---

# 15. Performance budgets тоже живут в repository

Не писать просто:

> должно быть быстро.

Завести baseline benchmark output.

После появления reference machine можно ввести budgets вроде:

```text
500-agent simulation P95 < X ms
50k spatial queries < Y ms
2000 instanced visible actors CPU submission < Z ms
```

До измерения hardware не придумывать ложную точность.

Главное — отслеживать regression относительно baseline.

---

# 16. Правило для AI-generated кода

Для каждой нетривиальной реализации агент должен по возможности оставить систему **проще, чем она была до задачи**.

Если для фичи добавлены:

- 7 interfaces;
- 4 factories;
- generic provider;
- abstract service layer;

а имеется только одна реализация — агент должен отдельно обосновать такую сложность.

AI часто переабстрагирует. Это следует считать отдельным code-review smell.

---

# 17. Рекомендуемая работа с coding-agent в реальности

## В начале проекта

Попросить агента:

1. прочитать `ENGINE_AGENT_BRIEF.md`;
2. проанализировать существующие игровые спеки;
3. самостоятельно исследовать Delphi/D3D11/tooling;
4. предложить architecture plan;
5. отдельно оценить OpenSpec/Spec Kit/plain workflow;
6. создать initial ADR/spec structure;
7. только затем начать foundation implementation.

## На каждой следующей крупной фиче

Работать change-by-change.

Например:

```text
Добавляем Spatial v1.
Сначала оцени требования игры и текущий engine state.
Предложи структуру и benchmark.
После согласования реализуй и зафиксируй результаты.
```

## После нескольких недель

Периодически просить агента провести architecture audit:

- что стало сложнее без необходимости;
- где появились дубли;
- какие interfaces имеют одну реализацию и не дают ценности;
- что протекло между Game/Engine;
- какие specs устарели;
- какие benchmarks больше не отражают игру.

---

# 18. Что не нужно делать

Не надо:

- создавать новый чат для каждого файла;
- каждый раз пересказывать весь дизайн игры;
- заставлять модель перечитывать весь repository;
- писать гигантский immutable master-spec;
- хранить решения только в истории чата;
- формализовать маленький bugfix как десятистраничную RFC;
- применять SDD ради SDD.

Инструмент существует ради сохранения контекста и качества, а не ради бюрократии.

---

# 19. Стартовый prompt агенту

Можно начать примерно так:

> Ты главный инженер собственного Delphi/Win64 игрового движка. Прочитай `ENGINE_AGENT_BRIEF.md`, `AGENTS.md` (если уже существует), текущие game specs и исследования. Первая игра — изометрический 3D/2.5D autobattler/survivors-like с массовыми дешёвыми мобами, частыми адаптивными элитками, большим количеством projectile/effect событий и data-driven контентом. Gameplay simulation в основном XZ/2D, renderer — настоящий 3D.
>
> Бриф содержит baseline-рекомендации, а не обязательные implementation patterns. Я ожидаю, что ты сам исследуешь лучшие варианты, особенно для entity storage, multithreading/job system, D3D11 rendering, spatial partitioning, asset pipeline и test/benchmark infrastructure. Если видишь решение лучше — предложи его и аргументируй.
>
> Движок должен быть достаточно независимым от этой конкретной игры, чтобы в будущем использовать его для других Windows-проектов, но не переусложняй архитектуру ради гипотетической универсальности.
>
> До основной реализации подготовь архитектурное предложение, risk register, benchmark plan и recommendation по spec-driven workflow. Мы рассматриваем OpenSpec как предпочтительный лёгкий вариант; если считаешь Spec Kit или другой процесс лучше — объясни почему. После согласования зафиксируй решения в specs/ADR и реализуй первый engine stress sandbox.

---

# 20. Итоговая рекомендация владельцу проекта

Для текущего проекта разумный default:

**OpenSpec + AGENTS.md + ADR + automated tests/benchmarks.**

Но важнее конкретного инструмента следующая дисциплина:

> Chat — рабочий разговор. Repository — память проекта. Specs — текущее обещание. ADR — причины дорогих решений. Tests/benchmarks — доказательство того, что обещание выполняется.
