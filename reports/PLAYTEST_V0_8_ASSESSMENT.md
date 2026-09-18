# Assessment of web prototype v0.8 after manual playtest

## Что доказал executable

- deterministic fixed-step core и seeded reproducibility работают;
- browser/WebGL2 reference пригоден для быстрых gameplay experiments;
- Planning/Reserve UX технически работает;
- Chain reorder и Catalyst state/context operations реально меняют authoritative outcome;
- Black Archive normal/Elite content может жить в одном runtime;
- world/build probes полезны как regression diagnostics.

## Что executable НЕ доказал

- что Chain уже ощущается центральной механикой;
- что текущая progression даёт survivors-like power fantasy;
- что текущая reward generator позволяет целенаправленно собирать билд;
- что v0.8 Mutations достаточно поведенческие;
- что текущий Elite cadence/TTK/reward правильны;
- что 1.44–1.56× spread между curated build metrics означает perceptually distinct builds.

## Почему старый simulation report нельзя трактовать оптимистично

`BUILD_MATRIX_v0_8` проверяет фиксированные mid/late loadouts, а не реальный путь их сборки. Он не моделирует frustration от diluted offers и почти не измеряет geometry. Кроме того, survival/movement policy упрощены; curated bots не испытывают экран так, как игрок.

Следовательно, вывод “ни один билд не мёртв и они различаются” остаётся верным только на узком статистическом уровне. Он **не закрывает** design acceptance.

## Обязательные новые метрики

- progression curve: kills/sec, normal/Elite TTK по времени;
- geometry: reach, area covered, targets/activation, simultaneous instances;
- acquisition: доля reward offers, относящихся к top invested Phenomena; dead offers; Reserve noise;
- topology: same components / different order signature по states/origins/geometry/sustain;
- Elite clarity: affected entity count/region + presentation lifetime;
- sustain: recovery availability и pickup collection/visibility proxy;
- enemy projectile pressure отдельно от player projectile count.

## Решение

Не делать balance polish v0.8. Использовать его как baseline executable и переписать progression/reward/Catalyst presentation в v0.9 experiment.
