# Handoff note для текущего executable v0.8

Этот каталог — последний запускаемый web build, проверенный перед упаковкой handoff 2026-09-17.

## Проверено

```text
npm test       PASS
npm calibrate  PASS
```

Последний headless hash (`seed=12345`, 7200 ticks): `e36e13af`.

## Не считать design baseline

После ручного плейтеста известны системные проблемы:

- progression воспринимается слишком плоской;
- обычный reward pool слишком размазан;
- Chain/Catalyst перестановки математически работают, но недостаточно меняют ощущение;
- Mutations/geometry меняются недостаточно сильно;
- Elite influence/reward недостаточно читаемы/значимы;
- important pickups теряются;
- enemy projectile pressure всё ещё надо снижать;
- opening density можно сделать мягче.

Перед продолжением читать корневые `01_PROJECT_HANDOFF.md`, `02_DECISIONS_AND_OPEN_QUESTIONS.md`, `04_PLAYTEST_FINDINGS_2026-09-17.md`, `05_CORE_REDIRECT_RESEARCH.md`.

## Для следующей версии

Рекомендуется ветвиться от `src/`, сохраняя deterministic core/test harness/WebGL2. Не добавлять контент просто поверх текущей reward/progression модели.
