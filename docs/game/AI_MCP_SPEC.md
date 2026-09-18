# Опциональная спецификация Elite AI и MCP v0.1

> Игра обязана быть полностью играбельной, сбалансированной и детерминированной **без** внешнего AI. Этот слой — опциональный и добавочный.

## 1. Цель

Использовать AI, чтобы командиры-элитки ощущались менее скриптовыми, **не давая языковой модели прямого контроля над числами, спавном или скрытыми правилами**.

Предпочтительная фантазия:

> Обычные враги работают на дешёвой детерминированной логике. Видимая элитка может координировать соседние группы. Опциональный внешний AI выбирает из авторского списка тактических приказов этой элитки.

Интеллект остаётся читаемым: убил командира — координация исчезла.

## 2. Базовая система до любого LLM

Сначала обязан существовать детерминированный `EliteOrderSelector`.

Каждые 4–7 секунд элитка, способная командовать, оценивает компактное тактическое состояние и выбирает один валидный order.

Входы могут включать:

- Elite chassis / affixes;
- состояние HP элитки;
- позицию и скорость игрока;
- число врагов в 8 угловых секторах;
- локальное ranged/melee соотношение;
- terrain/choke descriptors;
- поведенческие оси игрока от Adaptation Director;
- cooldowns текущих orders;
- nearby high-value allies;
- текущий POI/objective context.

Выход:

```text
order_id
optional target_sector / target_point category
priority
lifetime
```

Произвольный script text никогда не исполняется.

## 3. Авторский whitelist приказов

Стартовый whitelist:

- SPREAD
- SURGE
- SCREEN
- ESCORT
- PINCER
- ENCIRCLE
- HOLD
- FUNNEL
- INTERCEPT
- BOMBARD
- REGROUP
- SACRIFICE

У каждого order есть:

- compatible chassis;
- minimum local unit count;
- cooldown;
- duration;
- visible telegraph;
- deterministic implementation;
- cancellation conditions;
- threat cost/score contribution, где уместно.

AI выбирает приказ; **точное выполнение всегда принадлежит game code**.

## 4. Почему не прямое LLM-управление юнитами

Per-unit model control отклоняется, потому что создаёт:

- latency и cost, пропорциональные числу мобов;
- плохую determinism/replayability;
- сложность balance testing;
- нечитаемые тактики без видимого источника;
- риск попыток модели вызвать невалидное действие;
- зависимость от online inference.

Исследования tactical LLM также показывают, что модель может зациклиться на одной «разумной» стратегии и стать контрпродуктивной против конкретной ситуации. Поэтому её решения должны быть ограничены и измеримы, а не автоматически считаться «умными».

## 5. Роль MCP

### 5.1 Важное примечание по состоянию протокола 2026

Направление MCP 2026-07-28 делает акцент на серверах, предоставляющих **tools/resources/prompts**. Legacy sampling/roots/logging в ходе эволюции протокола были deprecated; если самой игре нужно вызвать provider model, следует использовать API провайдера или одобренный local-model interface, а не считать MCP универсальным transport для inference.

Рекомендуемая архитектура:

- **Игра предоставляет валидированное состояние и действия через MCP** внешнему agent/developer tool/player-connected model.
- Внешний agent читает только разрешённые компактные resources.
- Внешний agent вызывает только разрешённые tactical tools.
- Базовая игра не требует MCP для вызова модели.

## 6. Предлагаемые MCP resources

Read-only примеры:

```text
run://summary
run://build/chain
run://adaptation/pressure
elite://{elite_id}/state
elite://{elite_id}/local_tactical_map
world://nearby_poi
codex://known_orders
```

`local_tactical_map` — компактная абстракция, а не raw positions сотен мобов.

Пример:

```json
{
  "player": {"sector": 0, "speed_band": "high", "trend": "clockwise"},
  "elite": {"hp_band": "mid", "chassis": "marshal"},
  "sectors": [
    {"id":0,"friends":6,"ranged":1,"blocked":false},
    {"id":1,"friends":18,"ranged":4,"blocked":false},
    {"id":2,"friends":11,"ranged":0,"blocked":true}
  ],
  "dominant_player_axes": ["movement", "range"],
  "valid_orders": ["PINCER", "INTERCEPT", "REGROUP"]
}
```

## 7. Предлагаемые MCP tools

Только валидируемые tools:

```text
issue_elite_order(elite_id, order_id, optional_sector)
set_elite_focus(elite_id, focus_class)
propose_contract(contract_template_id, risk_tier)
name_elite(elite_id, style_token)
comment_on_build(comment_template_id, optional_short_text)
```

Runtime проверяет:

- элитка жива;
- приказ совместим;
- cooldown готов;
- target sector существует;
- приказ сейчас разрешён;
- rate limit не превышен.

Невалидный tool call отвергается, после чего heuristic AI продолжает работу.

## 8. Ограничение полномочий модели

Модель никогда напрямую не задаёт:

- HP;
- damage;
- immunity/resistance values;
- drop rarity;
- spawn count;
- mutation choice;
- hidden player debuffs;
- world difficulty coefficient;
- arbitrary coordinates вне валидированных target categories.

Она выбирает **авторские действия**, а не придумывает механику.

## 9. Runtime cadence и fallback

Рекомендуемая частота model decision: **не чаще примерно одного раза в 5 секунд на релевантного командира**, а предпочтительно через общий queue, а не отдельный model call на каждую элитку.

Если ответ модели не пришёл к deadline:

1. поздний output для этого decision tick отбрасывается;
2. deterministic selector выбирает order;
3. ран продолжается без штрафа.

Сбой внешнего AI должен отличаться от «AI option off» только меньшей вариативностью/персональностью, но не работоспособностью игры.

## 10. Replay и логирование баланса

Каждое внешнее решение сохраняет:

```text
run_seed
time
elite_id
compact_state_hash
valid_order_set
chosen_order
fallback_used
model/provider identifier if user opted in
```

Это нужно для сравнения:

- ценности heuristic order;
- ценности AI order;
- repeat rate;
- контрпродуктивных приказов;
- изменения player damage/TTK.

## 11. Anti-repetition policy

AI получает recent order history и мягкий repetition penalty.

Он не должен использовать один order более N раз подряд, если валидных вариантов больше одного.

Это закрывает типичный failure mode, когда LLM находит одну универсально разумную тактику и спамит её.

## 12. Player-facing presentation

Игроку не нужно знать, какой конкретно приказ выбрала эвристика, а какой LLM.

Он видит:

> `MARSHAL — ENCIRCLE`

с formation arrows и коротким telegraph.

В настройках можно показать:

- AI Commander mode on/off;
- статус подключённого provider/agent;
- privacy/data summary;
- сохраняется ли leaderboard validity, если такая система есть.

## 13. Опциональный “Observer” вне боя

Более безопасная и, вероятно, более ценная ранняя AI-фича — персонализация между ранами, а не combat control.

Observer выбирает из авторских challenge templates по истории ранов:

> «Последние раны вы часто строили Tether. Contract: дожить до 12-й минуты без Tether Skill. Reward: unlock X.»

Он также может:

- объяснять, почему билд сработал;
- показывать редко используемый открытый контент;
- давать имена запоминающимся Elites;
- генерировать flavor вокруг валидированного contract.

Числа наград и механика challenge всегда берутся из авторских templates.

## 14. Development/debug MCP

Даже если player-facing AI будет вырезан, MCP остаётся полезным интерфейсом разработки.

Возможные tools/resources:

- inspect current Chain state;
- dump damage breakdown;
- spawn named test Elite;
- advance world clock;
- run seeded combat scenario;
- query content metadata;
- collect last N combat events;
- request linter/calibrator result.

Это особенно полезно при AI-assisted разработке: агент работает через узкую валидируемую поверхность tools, а не произвольно редактирует runtime state.

## 15. Критерии допуска player-facing AI

Не выпускать AI commander feature, пока:

1. отключение AI оставляет игру полностью законченной;
2. AI никогда не отдаёт invalid/hidden-stat commands;
3. средняя повторяемость orders не хуже heuristic baseline;
4. смерти игрока объясняются видимыми механиками;
5. внешняя latency не может остановить simulation;
6. replay сохраняет decision stream;
7. privacy/consent явно оформлены;
8. blind playtest показывает рост вариативности/правдоподобия, а не только субъективное впечатление разработчика.

## 16. References

- MCP 2026-07-28 protocol evolution: https://blog.modelcontextprotocol.io/posts/2026-07-28/
- MCP TypeScript SDK / tools-resources-prompts model: https://github.com/modelcontextprotocol/typescript-sdk
- GDC Vault, squad coordination in Days Gone: https://www.gdcvault.com/play/1027066/AI-Summit-Squad-Coordination-in
- Game Developer, F.E.A.R. GOAP overview: https://www.gamedeveloper.com/design/building-the-ai-of-f-e-a-r-with-goal-oriented-action-planning
