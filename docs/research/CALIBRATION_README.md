# Последний снимок калибровки

Ниже сохранён исторический baseline прежнего `balance_calibrator.py`. Сам старый `CALIBRATION.latest.txt` и его генератор не входят в этот handoff; для продолжения разработки использовать прежде всего исполняемые probes из `prototype/current/src/tools/` и отчёты `prototype/current/reports/`.

Исторический baseline:

- мир к 24-й минуте: HP `×5.373`, damage `×1.806`, spawn pressure `×3.645`, composition complexity `×2.44`;
- расчётный `throughput_requirement`: **47.782**;
- случайные билды: P10 **0.814×**, P50 **1.111×**, P90 **1.541×**, P99 **2.647×** относительно требования мира;
- осмысленно собираемые (`COHERENT`) билды: P10 **1.191×**, P50 **1.707×**, P90 **2.585×**, P99 **4.984×**;
- эти числа не являются целевым балансом релиза: это baseline упрощённого симулятора до появления настоящего combat prototype.

Главный вывод: текущая модель позволяет заметный high-roll tail, но связный low-roll, вероятно, пока слишком прощающий. В плейтесте сначала следует проверять давление состава врагов/элиток и только затем менять HP-кривую.


## Поправка после web v0.8

Приведённый выше старый Monte Carlo baseline полезен только как историческая проверка tails. Текущий executable имеет собственные `prototype/current/reports/WORLD_PROBE_v0_8.json` и `BUILD_MATRIX_v0_8.json`.

Важный вывод ручного плейтеста: даже когда build matrix показывает ~1.4–1.6× spread по kills/damage и разные source shares, игрок может **не ощущать** достаточно разных билдов. Поэтому acceptance калибратора расширяется: нужны power-curve snapshots, geometry/coverage metrics, topology signatures и reward concentration.

Автосимуляция не имеет права “опровергать” ручное наблюдение flat progression; она должна помочь найти его математическую причину.
