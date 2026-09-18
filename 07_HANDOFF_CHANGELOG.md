# 2026-09-17 — v0.9C DESIGN RESET / INVESTIGATION HANDOFF

No executable gameplay changes. v0.9B code is frozen inside the package as the last runnable reference.

Added:

- `11_CORE_PILLARS_INVESTIGATION_2026-09-17.md` — owner observations, code-root-cause analysis, external reference research, revised pillars, Elite/Catalyst/progression/mutation redesign direction;
- `12_V09C_DESIGN_TARGET.md` — minimal next-slice target.

Reopened after owner playtest:

- Elite cadence and reward economy;
- adaptation logic;
- XP/horizontal progression;
- Resonance/general stats;
- mutations;
- Catalysts and eventual Chain topology.

Preserved:

- v0.9B world/minimap/POI/boss infrastructure;
- v0.9A-R presentation architecture;
- threat readability and reduced normal projectile direction.

---

# HANDOFF CHANGELOG

## 2026-09-17 — v0.9B WORLD / THREAT / READABILITY

- Added finite world bounds, six typed POIs and always-visible minimap.
- POIs now awaken guardian Elites and gate category-specific rewards.
- Added enemy recycling / Elite reacquire so movement cannot permanently delete pressure.
- Added final Warden boss with three telegraphed patterns, phase 2 and exposure windows.
- Exploration now visibly affects final encounter: insufficient POI clear adds guardian support Elites.
- Normal projectile pressure removed; Archivist Elite remains rare projectile exception.
- Elite Affix layer refocused on behavior: Vanguard coordinated surge, Temporal phase-shift, Shielded directional defense, Brood reinforcement.
- Elite Adaptations strengthened visually/behaviorally: Screening, Repulsor, Intercept, Anchored.
- Added off-screen threat markers, threat panel, Elite/Boss HP bars and floating damage values.
- Heal pickup now has world pulse/beacon and minimap marker.
- Standard XP pool now contains only active Phenomenon upgrades; Resonance moved to structural/map lane.
- Active Phenomena capped at 4 for the current slice.
- First Catalyst trigger now surfaces explicit `source → operator → target` causality and Chain-edge feedback.
- Debug/stat HUD hidden by default; ambiguous decorative corner/frame UI hidden.
- Researched universal-slot Chain candidate but deliberately did not mix it into this milestone.
- Added `09_WORLD_THREAT_READABILITY_RESEARCH.md` and `10_CHAIN_TOPOLOGY_EXPERIMENT.md`.
- Technical tests remain technical only; no balance claims are derived from them.

# Handoff changelog — 2026-09-17 — v0.9A-R POWER & ASSEMBLY + PRESENTATION

Этот пакет продолжает handoff v0.8 того же дня и включает уже реализованный первый Power & Assembly slice.

## Главное изменение направления

Вместо дальнейшей автоматической калибровки готовых loadout'ов prototype теперь в первую очередь проверяет **как билд собирается с нуля**.

Default flow:

`1 Phenomenon → Discovery второго → первая Elite → первый Catalyst → связка → Phenomenon/Resonance growth`.

## Реализовано

- Clean Run и отдельный Showcase mode;
- выбор стартового Phenomenon;
- dynamic active Chain span без мёртвого пустого хвоста;
- разделённые reward lanes: XP / Discovery / Elite Cache;
- Resonance: Amplitude / Scale / Multiplicity / Tempo / Memory / Conductivity;
- standard XP = 2 active Phenomenon cards + 1 Resonance;
- крупнее individual growth steps + geometry/impact breakpoints;
- discoverable slice сокращён до 8 Phenomena;
- Rail Spear / Mass Driver / Repulse Halo parked из-за визуального overlap;
- discoverable Catalyst pool сокращён до 12 structural operators;
- первый Catalyst после Elite спроектирован как заметный structural spike;
- VFX сильнее отображают runtime geometry/count/range;
- visible Catalyst source→target traversal cue;
- player locomotion больше не перезапускает dirty 4-frame cast strip на каждом auto-attack; используется smooth two-pose blend;
- `npm test` переведён на technical-only regression suite;
- старые world/build calibration команды сохранены под `npm run legacy:calibrate` и временно исключены из дизайн-процесса.

## Обновлены спеки

- `01_PROJECT_HANDOFF.md` — добавлен приоритетный v0.9A update;
- `02_DECISIONS_AND_OPEN_QUESTIONS.md` — переписан под текущие решения/реальные открытые вопросы;
- `06_NEXT_PROTOTYPE_BRIEF_v0_9.md` — из будущего плана превращён в точную спецификацию реализованного v0.9A;
- `prototype/current/PLAYTEST_CHECKLIST.md` — qualitative Clean Run checklist;
- `prototype/current/README.md` — актуальный запуск/архитектура наград.

## Что намеренно не делалось

- не принимались выводы о balance по DPS/kills;
- не подбирался финальный enemy HP;
- не фиксировался Elite TTK/cadence;
- не расширялся каталог;
- не создавался финальный animation art set.

Следующее решение должно исходить из ручного Clean Run.


## Rendering workstream merge — v0.9A-R

Rendering agent package был изучен и перенесён **выборочно**, согласно его собственному merge guide: gameplay branch не заменялась целиком.

Перенесено:

- canonical `CombatShape` events из Core;
- `PresentationBridge` и semantic cue boundary;
- hit feedback по реальной цели/radius;
- post-death visual actors;
- visual-only recoil/flash/collapse/fade;
- combat shape rendering;
- presentation regression.

Сохранено из актуального v0.9A:

- Clean Run / Showcase;
- Resonance и reward lanes;
- current 8-Phenomenon discovery slice;
- runtime count/range/coverage VFX;
- Catalyst source→target causality cue;
- smooth two-pose hero locomotion вместо старого auto-cast strip.

Не переносилось как готовая функция, потому что её нет в rendering package: настоящий runtime 3D, glTF loader, skeletal animation, 3D hero/elite actors.

Gameplay baseline проверен: deterministic headless hash до/после merge — `7a32daf1`.
