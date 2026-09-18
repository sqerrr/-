# Спецификация реализации v0.2

> Связанный документ к `GAME_SPEC.md` и `BALANCE_SPEC.md`. Здесь определяется **первая исполняемая архитектура**, контракты и обязательные тесты. Документ намеренно не привязан к Unity/Godot/Unreal. Имена нейтральны к движку.

> **v0.2 playtest correction:** текущий web v0.8 доказал deterministic/core architecture, но не доказал build-feel. Следующая реализация должна поддержать раздельные reward channels, nonlinear `LevelScalar`, geometry/count breakpoints, richer Catalyst scopes и presentation causality. Реализованный v0.8 не считается design authority.

---

# 1. Инженерные цели

Первая реализация должна до расширения контента доказать четыре вещи:

1. на шестишаговую упорядоченную autobattle-цепочку приятно смотреть;
2. Catalysts делают **позицию/порядок** значимыми без постоянного менеджмента;
3. Mutations могут менять роль Skill, не обесценивая уже вложенную прокачку;
4. частые Elites/adaptations остаются читаемыми при целевой плотности орды.

Архитектура также должна поддерживать AI-assisted производство контента без превращения каждого Skill в отдельный кастомный скрипт.

Жёсткое правило:

> **Обычный новый Skill по умолчанию должен описываться данными + переиспользуемыми combat primitives.**

Новый primitive — это изменение движка и требует тестов/проверки производительности. Новый Skill — это контент.

---

# 2. Порядок runtime-систем

Для авторитетной боевой логики использовать детерминированный фиксированный simulation step. Render interpolation может быть переменной.

Рекомендуемая стартовая частота симуляции: **30 Hz**. Движение игрока может интерполироваться/рендериться на 60+ Hz.

На каждом simulation tick:

```text
1. Считать player input / navigation intent
2. Продвинуть авторитетное движение игрока
3. Обновить те buckets steering ближайших врагов, чей tick наступил
4. Разрешить состояние Elite commander/order
5. Продвинуть Chain clock
6. Создать due SkillActivation requests
7. Разрешить Catalyst pre-activation transforms
8. Разрешить targeting Skill
9. Создать логические attack/effect events
10. Spatial queries / contacts
11. Разрешить damage + применение states
12. Разрешить on-hit/on-kill/on-state-consume reactions
13. Breadth-first разрешить generated events в пределах recursion budget
14. Обновить persistent Fields / Constructs / DoTs
15. Обработать deaths / corpse/world resources
16. Обновить XP и reward queues
17. Обновить Directors на их более редкой частоте
18. Flush visual/audio presentation events
19. Записать агрегаты телеметрии
```

Render/VFX callbacks никогда не создают authoritative combat events.

---

# 3. Детерминированные RNG streams

У рана один `run_seed`, от него независимо производятся именованные streams.

Обязательные streams:

```text
RNG_OFFER
RNG_UPGRADE_RARITY
RNG_SKILL_ROLL
RNG_MUTATION
RNG_CATALYST
RNG_SPAWN
RNG_ELITE_AFFIX
RNG_ADAPTATION
RNG_POI
RNG_LOOT
RNG_COSMETIC
RNG_AI_FALLBACK
```

Правило:

> Добавление одного случайного cosmetic-вызова никогда не должно менять боевые награды или состав врагов.

Пример derivation:

```text
stream_seed = Hash64(run_seed, stable_stream_id)
```

Каждый reproducibility bug report сохраняет `run_seed`, версию каталога контента и build version.

---

# 4. Основные структуры данных

Это концептуальные схемы. Фактическая сериализация может быть JSON/resources/data assets.

## 4.1 SkillDefinition

```text
id: stable string
name_key
familiarity: classic | hybrid | unusual
roles[]
delivery_tags[]
targeting_rule
base_timing_rule
base_damage
base_radius?
base_duration?
level_scalar_table?       # nonlinear per-level scalar; v0.1 +4% is only one candidate
geometry_upgrade_axes[]   # size/count/targets/duration/repeat/etc allowed for this Skill
major_breakpoints[]       # visible discrete behavior/geometry milestones
proc_coefficient
produces_states[]
consumes_states[]
upgrade_pool[]
mutation_ids[]
base_score_design_only
complexity_budget
performance_budget {
  logical_projectiles
  persistent_objects
  spatial_queries
  generated_events
}
primitive_graph[]
```

`primitive_graph` описывает переиспользуемое поведение: emitter, movement, contact и payload. Не хранить arbitrary executable code в контентных данных.

## 4.2 SkillInstance

```text
instance_id
skill_id
level
rolled_modifiers[]
mutation_id?
mutation_ascension?
temporary_modifiers[]
legendary_imprint?
statistics_runtime
```

Все rolled modifiers должны либо восстанавливаться из seed + записанных решений по предложениям, либо явно сохраняться в save/replay.

## 4.3 CatalystDefinition / CatalystInstance

Definition:

```text
id
scope: modifier | directional | bridge | payload | bilateral | feedback | storage | conversion | spatial | cycle | economy | reserve | structural
compatibility_rule
effect_operations[]
upgrade_pool[]
complexity
```

Instance:

```text
catalyst_id
level
rolled_modifiers[]
legendary_imprint?
```

## 4.4 MutationDefinition

```text
id
skill_id
archetype
behavior_operations[]
future_roll_weight_changes{}
new_tags[]
removed_tags[]
performance_delta
ui_summary_key
```

Где возможно Mutation должна быть **data transformation** pipeline'а Skill.

## 4.5 EliteDefinition

```text
chassis_id
base_threat
movement_model
attack_model
command_capability
compatible_generic_affixes[]
compatible_adaptation_families[]
visual_signature
```

Runtime Elite:

```text
entity_id
chassis_id
generic_affixes[]
adaptive_affix { family, tier }
current_order?
order_cooldowns{}
active_influence_set_or_region
adaptation_presentation_state
threat_score
reward_state
```

---

# 5. Runtime-модель Chain

Активная раскладка:

```text
S1 — C1 — S2 — C2 — S3 — C3 — S4 — C4 — S5 — C5 — S6 — RESET
```

Все шесть тактов существуют всегда. Пустой Skill slot = на этом такте нет активации.

Catalyst-edge вычисляется только если необходимые соседние slots существуют и удовлетворяют compatibility.

## 5.1 ChainContext

Короткоживущий контекст, передаваемый слева→направо внутри текущего цикла:

```text
cycle_id
beat_index
previous_skill_instance_id?
previous_primary_target_id?
previous_payload_summary
pending_echo_payload?
stored_edge_values{}
edge_flags{}
```

На `RESET` весь ChainContext очищается, если только Legendary Law явно не сохраняет конкретное именованное поле.

States мира на врагах не очищаются.

## 5.2 Swap operation

Drag active↔active:

- одна атомарная операция;
- topology пересчитывается немедленно;
- без confirm dialog.

Drag reserve↔active:

- атомарный swap;
- входящий компонент по умолчанию получает `sync_delay_cycles = 1`;
- не активируется на своей первой due beat;
- outgoing component полностью сохраняется в Reserve.

Это базовая цена против микроменеджмента: нет валюты и постоянной потери.

Параметр должен калиброваться; до фиксации протестировать `0`, `1 cycle` и `2 beats`.

---

# 6. Pipeline активации Skill

Каждая активация проходит фиксированные стадии, чтобы tooltip и тесты могли объяснить причинность.

```text
A. Создать ActivationContext
B. Прочитать transform левого Catalyst
C. Применить transform Mutation Skill
D. Выбрать target set / origin
E. Построить payload(s)
F. Применить outgoing Catalyst effects, меняющие right-context memory
G. Создать logical effect(s)
H. Разрешать hits/fields/construct updates во времени
```

Не применять modifiers в произвольном порядке регистрации.

Рекомендуемые operation stages:

```text
TARGETING
GEOMETRY
COUNT
POWER
STATUS
CONTROL
TIMING_LOCAL
PROC
POST_HIT
POST_KILL
CONTEXT_EXPORT
```

Каждая операция Catalyst/Mutation декларирует stage. Внутри stage используется стабильный priority + content ID как tie-breaker.

Так patch, меняющий load order, не меняет урон билда.

---

# 7. Модель боевых событий

Минимальные authoritative events:

```text
SkillActivated
HitCandidate
DamageApplied
StateApplied
StateConsumed
TargetDisplaced
EntityKilled
CorpseCreated
ConstructCreated
FieldCreated
GeneratedAttackRequested
EliteOrderIssued
RewardQueued
```

Каждая сгенерированная атака/событие несёт:

```text
root_activation_id
origin_skill_instance_id
generation_depth
proc_coefficient
created_by_effect_id?
```

Recursion guards из `BALANCE_SPEC.md` применяются централизованно, а не реализуются отдельно в каждом Skill.

---

# 8. Хранение states

Не создавать bespoke component для каждого state, если его поведение действительно этого не требует.

Target может хранить компактные записи:

```text
state_id
source_entity_id
source_skill_instance_id
stacks
magnitude
expires_at
payload_bits
```

States со специальными world objects (`Tether`, `Field`, `Construct`) ссылаются на внешние записи.

Операции над state:

```text
APPLY
REFRESH
STACK
CONSUME_ONE
CONSUME_ALL
TRANSFER
COPY_REDUCED
```

UI может показывать авторские названия реакций, но underlying logic остаётся state-based.

Пример:

```text
Frost Ring applies CHILL
Ember Lance consumes CHILL
UI reaction label: THERMAL SHOCK
```

Reaction label — presentation. Контракт states — authoritative.

---

# 9. Targeting primitives

Стартовые reusable primitives:

```text
Nearest
NearestCluster
RandomVisible
HighestHP
LowestHP
NearestElite
MarkedPriority
StatePriority(state_id)
ForwardSector
AroundSelf
GroundAtPredictedPosition
ConstructAnchor
CorpseCluster
PreviousChainTarget
```

Targeting возвращает IDs/positions и сам не создаёт effects.

Новый targeting primitive требует:

- deterministic tie-breaking;
- max query radius;
- spatial-query budget;
- unit tests.

---

# 10. Geometry / emitter primitives

Стартовая библиотека emitter/geometry:

```text
SingleProjectile
BurstProjectile
RadialProjectile
LineRay
SweepArc
PulseCircle
PersistentField
OrbitingObject
ReturningObject
TetherSegment
BoundaryTrace
GroundMarkerDelayed
ConstructSpawn
CloneOrigin
TransformOrigin
```

Movement primitives:

```text
Straight
HomingLimitedTurn
BallisticArc
ReturnToOrigin
Orbit
SeekMarked
Stationary
FollowPlayerOffset
FollowConstruct
```

Payload primitives:

```text
Damage
ApplyState
ConsumeStateForAmp
DisplacePush
DisplacePull
Expose
StoreDamage
ReleaseStored
SpawnField
SpawnConstruct
GenerateAttack
```

Эта библиотека — реальный implementation backbone каталога контента.

---

# 11. Reward / progression services

После v0.8 один универсальный `GenerateLevelOffer` признан слишком широким design surface. Архитектура должна разделять **reward domain** от механизма генерации карточек.

Концепт API:

```text
GenerateRewardOffer(run_state, player_state, RewardContext) -> cards

RewardContext.domain =
  XP_ACTIVE_GROWTH | DISCOVERY | ELITE | BODY_GLOBAL | POI | BOSS_LEGENDARY
```

Стартовый эксперимент v0.9:

- `XP_ACTIVE_GROWTH` — только active Phenomena и их mutation-specific growth; Reserve исключён без Focus;
- `DISCOVERY` — новый Phenomenon / Reserve candidate;
- `ELITE` — Catalyst/operator, Catalyst evolution, Ascend/Distort, major geometry/recovery;
- `BODY_GLOBAL` — player stats отдельным milestone/event;
- `POI` — targeted RNG/control;
- `BOSS_LEGENDARY` — Law/Legendary Opportunity.

Pipeline внутри домена:

1. построить eligible sources только разрешённого domain;
2. применить focus/build-aware weights;
3. применить Research Focus/meta bias;
4. выбрать card identities без повторов;
5. зароллить rarity;
6. зароллить source-specific axis/breakpoint;
7. проверить dead/incompatible cards;
8. посчитать authoritative before/after values;
9. добавить presentation preview: geometry/count/targets и конкретные Catalyst-neighbor semantics.

UI-card создаётся **после** расчёта; tooltip не пересчитывает gameplay независимо. Reward-domain split должен быть переключаемым/данными, чтобы A/B тестировать варианты без переписывания combat core.

---

# 12. Mutation service

На milestone мутации:

```text
EligiblePool = skill.mutations - already_invalidated
Offer = sample 2 without replacement
```

Mutation Refusal:

- заменяет одну выбранную карточку одной ранее не показанной Mutation;
- расходует общий на ран token;
- не reroll'ит карту, которую игрок решил оставить.

После выбора:

```text
Apply mutation behavior operations
Update Skill tags if required
Rebuild compatible Catalyst indicators
Apply future roll weight overrides
Invalidate only mutations explicitly incompatible with new state (normally irrelevant after choice)
```

Mutation не должна задним числом стирать ранее заролленные статы, если на карточке нет явного видимого правила конверсии.

Допустимо:

> `Projectile Count rolls become +12% Power each.`

Недопустимо скрыто:

> Count rolls просто перестают работать.

---

# 13. Архитектура Directors

Отдельные сервисы:

```text
SpawnDirector
IntensityDirector
AdaptationDirector
EliteRewardDirector
POIDirector
```

Не создавать одного всезнающего `GameDirector` с сотнями связанных условий.

## 13.1 SpawnDirector

Работает на низкой частоте, например 4–10 Hz.

Владеет:

- threat budget;
- role composition;
- entity-cap throttle;
- legal spawn locations;
- biome cards.

Он **не** анализирует детальные build tags игрока ради hard-counter.

## 13.2 AdaptationDirector

Оценивает поведение примерно каждые 5–10 секунд по rolling aggregates.

Владеет:

- pressure vector;
- weights candidate adaptation families;
- escalation memory;
- power-fantasy suppression timer.

Выбирает **семейства/tier probabilities**, а не raw stat multipliers.

## 13.3 IntensityDirector

Владеет pacing state:

```text
BUILDUP
PEAK
RELEASE
RECOVERY
```

Может откладывать дорогие Elite/spawn events, но не может молча ослабить уже существующую элитку.

---

# 14. Реализация Elite orders

Orders — высокоуровневые intents, которые реализует обычный AI.

Пример `PINCER`:

```text
1. commander selects two legal angular sectors
2. eligible nearby melee units receive FormationIntent(PINCER_LEFT/RIGHT)
3. local steering targets sector waypoint, then player intercept point
4. intent expires after duration or commander death
```

Никаких LLM-call на каждого юнита.

Смерть командира отменяет или деградирует order после короткой видимой задержки.

**Player-facing presentation contract:** пока Order/Adaptation активен, renderer получает persistent state, а не только one-shot popup. Affected mobs/terrain имеют aura/link/marker; UI хранит короткое русское описание эффекта до его окончания. Смерть Elite должна визуально оборвать связь.

У всех Orders есть debug visualization: желаемые sectors, число участников и lifetime.

---

# 15. Представление сущностей и симуляция орды

Горячие данные обычных врагов отделяются от тяжёлых object behaviours.

Hot-path record обычного моба должен быть близок к:

```text
position
velocity
radius
hp
archetype_id
flags
status_index
steering_target
update_bucket
```

Не создавать тяжёлую scene/component hierarchy на каждый fodder, если движок плохо масштабирует это.

Spatial grid/hash должен поддерживать:

- enemies in radius;
- nearest N enemies;
- cluster approximation;
- fields overlapping cells;
- corpse/construct lookup.

Normal-normal collision — дешёвое separation, а не general physics.

---

# 16. Bridge визуального presentation layer

Авторитетная симуляция создаёт presentation events:

```text
PlayHitFX(effect_class, position, intensity)
PlaySound(sound_class, priority)
ShowDamageAggregate(target, amount, crit_tier)
ShowReactionLabel(reaction_id, position)
ShowInteractionTrace { source_skill, catalyst_id, destination_skill, result_type, points/targets }
ShowEliteOrder(order_id, elite_id)
ShowEliteInfluence(elite_id, affected_entities/area, adaptation_id, rarity)
ShowImportantPickup(pickup_id, kind, position, priority)
```

Presentation layer может отбрасывать/coalesce low-priority события под нагрузкой без изменения боя.

Ориентир damage-number aggregation: повторные удары одного source по одной цели собирать в display buckets ~0.15–0.30 s при плотном late-game.

---

# 17. Save / meta data

Разделять:

```text
ProfileSave
RunSave (optional suspend/resume)
CodexSave
SettingsSave
```

Profile хранит unlocked IDs и meta resources, но не сериализованный executable content definition.

При переименовании контента stable ID не меняется.

Каждый save содержит:

```text
save_schema_version
content_catalog_version
build_version
```

Нужны явные migrations.

---

# 18. Debug UI, обязательный до масштабирования контента

Developer overlay показывает:

- текущую Chain и activation cursor;
- active Catalysts + compatibility state;
- вычисленные stats каждого Skill;
- недавнюю глубину combat event / proc source;
- entity counts по archetype;
- projectile/persistent-object counts;
- SpawnDirector budget;
- Intensity state;
- Adaptation pressure vector;
- active Elite orders;
- simulation ms / render ms;
- текущий run seed.

Debug commands:

```text
spawn_enemy(id, count)
spawn_elite(chassis, adaptation_family, tier)
give_skill(id, level)
give_catalyst(id)
set_mutation(skill, mutation)
set_world_time(minutes)
set_chain([...])
set_seed(seed)
freeze_directors(bool)
run_damage_probe(seconds)
```

Позже эти команды естественно отображаются в optional development MCP tools.

---

# 19. Обязательные автоматические тесты

## 19.1 Unit tests

Покрыть:

- каждую формулу `BALANCE_SPEC.md`;
- независимость RNG streams;
- Catalyst compatibility;
- fixed Chain beat timing;
- cycle reset;
- mutation roll reweighting;
- proc coefficient;
- rejection recursion depth;
- armor/crit/coverage math;
- swap sync delay.

## 19.2 Content contract tests

CI запускает:

```bash
python tools/content_linter.py
python tools/combo_audit.py
python tools/chain_space_audit.py
python tools/balance_calibrator.py --runs 10000 --seed 1337
python tools/build_probe.py --runs 2000 --seed 7000
```

После стабилизации vertical slice failure thresholds должны стать машиночитаемыми.

## 19.3 Seeded combat regression tests

Когда появится headless combat harness, определить минимум:

- 10 weak/random builds;
- 10 median coherent builds;
- 5 high-roll builds;
- все авторские paper-only risk builds;
- target Elite-family encounters;
- worst-case performance scenarios.

Outputs задаются percentile ranges, а не одним exact DPS, если входы не полностью детерминированы.

---

# 20. Следующий playable slice после v0.8

Предыдущий vertical-slice план частично реализован web v0.8, но manual playtest выявил flat progression/reward dilution. **Не расширять сразу до прежних 12–14 Skills.** Сначала v0.9 “Power & Assembly”: 6–8 Phenomena, 10–14 разнообразных Catalyst scopes, 4–5 очень читаемых Elite, 5–6 normal roles, два reward-architecture варианта и nonlinear geometry progression.

Ниже сохранён исторический порядок первоначального vertical slice как reference:


Реализовать в порядке:

### Этап 1 — каркас Chain

- player movement;
- fixed six-beat clock;
- 4 простых Skills;
- без Catalysts;
- 3 dummy enemy types;
- damage/XP loop.

Exit criterion: automatic combat отзывчив, beat cadence читается.

### Этап 2 — грамматика взаимодействий

- state records;
- 8 Skills;
- 6 Catalysts;
- drag/drop Chain overlay;
- Reserve;
- generated-event recursion guard.

Exit criterion: другой порядок одного набора даёт наблюдаемую тактическую разницу.

### Этап 3 — случайный рост

- random Skill roll pools;
- rarity;
- сначала 3 Mutations на реализованный Skill;
- offer weighting;
- one Mutation Refusal.

Exit criterion: одинаковые seeds воспроизводятся, два обычных рана заметно различаются.

### Этап 4 — мир / элитки

- 8–10 normal enemy roles;
- 3 Elite chassis;
- 5 adaptation families;
- Spawn/Intensity/Adaptation Directors;
- один boss.

Exit criterion: опасность элитки узнаётся визуально, adaptation не ощущается скрытым resistance.

### Этап 5 — контент настоящего vertical slice

Расширить до:

- 12–14 Skills;
- 14–18 Catalysts;
- >=5 Mutations в definition каждого Skill, даже если не у всех финальный art;
- 4 Elite chassis;
- 6 adaptation families;
- 5–6 POIs;
- один полный biome;
- meta unlock stub.

Только после этого решать, заслуживает ли ядро production-scale контента.

---

# 21. Контракт задач для AI-agent

Когда AI coding agent реализует фичу, задача обязана включать:

1. точные ссылки на разделы spec;
2. затронутые data IDs;
3. deterministic test seed;
4. обязательные unit/integration tests;
5. performance budget;
6. запрещённые cross-system side effects.

Пример:

> Реализовать `Catalyst: Splitter` по catalog v0.1. Он модифицирует только совместимый правый projectile Skill на stage `COUNT`. Добавляет один logical projectile и применяет указанный penalty к power каждого projectile. Не влияет на Fields, Constructs или count payload'ов, созданных Echo, если copied payload явно не сохраняет projectile geometry. Добавить deterministic tests для Ember Lance и negative test для Frost Ring. Не менять offer generation.

Такая конкретика обязательна для надёжной AI-assisted разработки.

---

# 22. Definition of architecture-ready

Кодовая база готова к массовому производству контента, когда:

- простой новый Skill не требует нового authoritative runtime class;
- новый Catalyst обычно требует только operations/data;
- полный ран детерминирован по seed + decisions;
- generated-event recursion не может повесить игру;
- vertical slice из 12 Skills проходит content audits;
- 200+ обычных врагов + 3 Elites + худший текущий player build укладываются в frame budget;
- дизайнер может инспектировать точную damage/state причинность в debug overlay;
- swaps в build UI атомарны и занимают секунды, а не навигацию по меню;
- automated probes регулярно запускаются в CI;
- standard reward domain не смешивает десятки равноправных целей;
- ручной playtest подтверждает кратный perceptual growth сильного рана;
- Catalyst interactions имеют presentation provenance и понятны без event log;
- Elite influence читается как persistent world effect.
