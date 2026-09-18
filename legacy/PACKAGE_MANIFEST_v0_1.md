# Состав пакета — v0.1

## Основные спецификации

- `GAME_SPEC.md` — главная продуктовая, геймплейная и UX-спецификация.
- `BALANCE_SPEC.md` — формулы и правила численной калибровки.
- `IMPLEMENTATION_SPEC.md` — runtime-архитектура и контракты реализации.
- `CONTENT_CATALOG.md` — текущий конкретный каталог контента, построенный из JSON.
- `META_PROGRESSION_SPEC.md` — прогрессия между ранами и backlog реиграбельности.
- `AI_MCP_SPEC.md` — опциональная архитектура управления элитами через AI/MCP.
- `RESEARCH_BENCHMARKS.md` — игровые прецеденты и извлечённые из них принципы.

## Сгенерированные аудиты

- `INTERACTIONS.generated.md`
- `CHAIN_SPACE.generated.md`
- `CONTENT_MATRIX.generated.md`
- `RUN_PROBES.generated.md`
- `VALIDATION_REPORT.generated.md`
- `CALIBRATION.latest.txt`

## Машиночитаемый источник

- `data/catalog_v0_1.json`

## Инструменты

- `tools/content_linter.py`
- `tools/combo_audit.py`
- `tools/chain_space_audit.py`
- `tools/content_matrix.py`
- `tools/balance_calibrator.py`
- `tools/build_probe.py`
- `tools/render_catalog_md.py`
- `tools/run_all_checks.py`

## Текущий структурный baseline

- 24 Skills / 120 Mutations.
- 28 Catalysts.
- 24 Legendary Laws.
- 8 шасси элиток / 12 общих аффиксов / 16 adaptive-семейств.
- 24 обычных монстра / 10 POI.
- 63 направленные системные Skill→Skill-связи до катализаторов.
- Текущий аудит упорядоченной Chain: медианный случайный набор из шести Skills можно переставить в 4/5 осмысленных направленных соседств; около 0,1% выборок не имеют ни одного.
- Текущий lint: 0 ошибок / 0 предупреждений по эвристическому контракту.

## Решения, которые пока не финальны

Все константы считаются гипотезами до играбельного vertical slice. В частности, тестовыми переменными остаются: число активных слотов, штраф синхронизации при swap, уровни milestone мутаций, финальный лимит видимых мобов, потолок постоянной meta-силы, ритм боссов и допустимое число одновременно живых late-game элиток.
