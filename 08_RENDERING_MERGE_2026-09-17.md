# Rendering workstream merge — 2026-09-17 — v0.9A-R

## Решение

Пакет rendering agent изучен и **не применялся как wholesale replacement**. Его workspace основан на более старом gameplay baseline; прямое копирование вернуло бы старую progression/reward логику и старое переключение sprite cast frames. Вместо этого в текущий v0.9A Power & Assembly перенесены только presentation/API additions.

## Что реально было в rendering package

Rendering package не содержит runtime 3D. В нём нет glTF loader, skeletal actors, animation clips/state machine, 3D героя, 3D элиток или 3D окружения. Реализован foundation для дальнейшего Hybrid3D:

- Core-owned canonical combat geometry;
- PresentationBridge;
- sprite/WebGL2 visualization этой geometry;
- hit feedback;
- post-death visual actors;
- visual-only recoil/flash/collapse/fade;
- presentation regression.

## Что перенесено в current

### Core API

Добавлен `CombatShape`:

- `circle`;
- `sector`;
- `ray`.

Simulation публикует shapes из тех же runtime range/width/radius/aim, которые использует gameplay для Ember, Frost, Rail, Cleaver, Orbit mutation, Mortar, Toxic, Repulse и Mass Driver. Renderer не становится источником hit truth.

### Presentation boundary

`src/presentation/bridge.ts` принимает `Snapshot + GameEvent` и создаёт semantic cues. Он кэширует краткоживущий visual state, включая последние hit directions и post-death actors.

### Renderer

Текущий WebGL2 renderer теперь умеет:

- показывать реальные ray/circle/sector формы;
- давать hit ring/flash/recoil/squash на фактической цели;
- показывать collapse/fade после удаления entity из gameplay snapshot;
- сохранять прежние v0.9A skill VFX, runtime growth и Catalyst source→target cue.

### Hero animation

Rendering branch содержал старую 4-frame run/cast схему. Она намеренно не возвращена. В current остаётся v0.9A временный smooth two-pose locomotion blend, а auto-attacks читаются через weapon VFX + canonical geometry.

## Что сознательно НЕ менялось

- Clean Run / Showcase;
- reward lanes;
- Discovery / Elite Cache;
- Resonance;
- Phenomenon/Catalyst progression;
- enemy balance values;
- world curve;
- deterministic gameplay semantics.

## Validation

Техническая проверка после merge:

- `npm test` — PASS;
- baseline 3600-tick deterministic headless hash до merge: `7a32daf1`;
- тот же сценарий после merge: `7a32daf1`;
- `presentation_regression`: `shapes=416`, `hits=1269`, `deaths=202`, `maxDeathVisuals=11`; ray/circle/sector paths все наблюдались;
- local HTTP smoke на отдельном порту — HTTP 200.

Это подтверждает отсутствие наблюдаемого gameplay regression в контрольном deterministic сценарии. Это **не** является оценкой баланса или качества визуального ощущения.

## Следующий фокус

После этого merge rendering считается достаточным техническим baseline для следующего этапа. Приоритет возвращается к **балансу и развитию Clean Run**: power curve, темп получения Phenomena/Catalysts, сила Resonance, читаемость upgrade steps, Elite timing/TTK и ощущение сборки машины.

Новый rendering pass нужен только там, где визуальное представление мешает ответить на gameplay-вопрос.
