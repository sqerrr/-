# Аудит пространства упорядоченных цепочек

Каталог: **24 Skills**; выборка **20 000** случайных наборов по шесть Skills; seed `1337`.

> Аудит оптимизирует только *порядок* каждого случайного набора из шести Skills. Он измеряет структуру взаимодействий, а не реальный DPS. Высокий балл означает, что набор можно расположить так, чтобы получить несколько осмысленных направленных соседств; это не доказывает, что билд сбалансирован или интересен.

## Сводка

- Балл лучшего порядка: P10 **1.86**, P50 **3.23**, P90 **4.73**, P99 **5.35**.
- Осмысленные соседние связи (максимум 5): P10 **2.0**, P50 **4.0**, P90 **5.0**.
- Наборы из шести Skills без единой системной направленной связи даже после оптимальной перестановки: **0.08%**.
- Порог верхнего дециля: **4.73** эвристических балла.

### Критерии приёмки

- Медианная (P50) лучшая перестановка должна иметь **>=3 осмысленных связей** ещё до катализаторов.
- P10 обычно должен иметь **>=2**; иначе в обычных случайных ранах слишком много инертных раскладок.
- Ни один Skill не должен входить в **>45% наборов верхнего дециля** только потому, что граф требует его как универсальный мост.
- После фиксации пула vertical slice доля наборов без синергии должна оставаться **<2%**.

## Степень узлов графа / концентрация в сильных наборах

| Skill | Исходящих | Входящих | Доля в верхнем дециле* |
|---|---:|---:|---:|
| Boundary Saw | 3 | 5 | 33.5% |
| False Moon | 6 | 2 | 39.9% |
| Fold | 1 | 7 | 29.6% |
| Debt Orb | 1 | 6 | 30.8% |
| Mass Driver | 2 | 5 | 35.8% |
| Toxic Mist | 3 | 4 | 35.0% |
| Chain Arc | 3 | 3 | 30.1% |
| Choir | 3 | 3 | 34.7% |
| Cleaver | 3 | 3 | 27.2% |
| Glass Harrow | 3 | 3 | 32.0% |
| Mortar Bloom | 2 | 4 | 21.8% |
| Sentry | 4 | 2 | 26.0% |
| Ember Lance | 4 | 1 | 23.4% |
| Frost Ring | 3 | 2 | 23.2% |
| Orbit Blades | 2 | 3 | 27.6% |
| Pressure Membrane | 3 | 2 | 22.4% |
| Rail Spear | 3 | 2 | 21.8% |
| Stitching Needle | 3 | 2 | 25.9% |
| Vacuum Bloom | 5 | 0 | 21.3% |
| Iron Rain | 2 | 2 | 16.6% |
| Repulse Halo | 1 | 2 | 18.8% |
| Afterimage | 1 | 0 | 8.9% |
| Recorder | 1 | 0 | 7.3% |
| Seed Mine | 1 | 0 | 6.5% |

\*Один набор верхнего дециля содержит шесть Skills, поэтому проценты не обязаны суммироваться до 100%. Метрика нужна для поиска зависимости от универсальных хабов, а не для составления tier list.

## Центральность состояний

| Состояние | Направленных связей |
|---|---:|
| `wound` | 11 |
| `field` | 10 |
| `compressed` | 8 |
| `mark` | 6 |
| `charge` | 6 |
| `embed` | 6 |
| `displaced` | 3 |
| `echo` | 3 |
| `construct` | 2 |
| `exposed` | 2 |
| `stored` | 2 |
| `ignite` | 1 |
| `chill` | 1 |
| `toxin` | 1 |
| `tether` | 1 |

## Примеры наборов с высокой связностью

- **6.35 / 5 связей:** Frost Ring → Ember Lance → Stitching Needle → Chain Arc → False Moon → Mortar Bloom  _(баллы связей: 1.25, 1.00, 1.25, 1.00, 1.25)_
- **6.35 / 5 связей:** Stitching Needle → Mass Driver → Glass Harrow → Toxic Mist → Boundary Saw → Debt Orb  _(1.25, 1.25, 1.00, 1.25, 1.00)_
- **6.10 / 5 связей:** Iron Rain → Chain Arc → Sentry → Stitching Needle → Mass Driver → Glass Harrow  _(1.00, 1.00, 1.00, 1.25, 1.25)_
- **6.10 / 5 связей:** Afterimage → Choir → Sentry → Stitching Needle → Mass Driver → Glass Harrow  _(1.00, 1.00, 1.00, 1.25, 1.25)_
- **6.10 / 5 связей:** Stitching Needle → Chain Arc → False Moon → Pressure Membrane → Glass Harrow → Toxic Mist  _(1.25, 1.00, 1.00, 1.25, 1.00)_
- **6.10 / 5 связей:** Frost Ring → Ember Lance → Debt Orb → Mass Driver → Glass Harrow → Toxic Mist  _(1.25, 1.00, 1.00, 1.25, 1.00)_

## Примеры наборов с низкой связностью

- **0.00 / 0 связей:** Recorder → Chain Arc → Boundary Saw → Fold → Glass Harrow → Cleaver
- **0.00 / 0 связей:** Recorder → Glass Harrow → Chain Arc → Cleaver → Mortar Bloom → Seed Mine
- **0.00 / 0 связей:** Afterimage → Cleaver → Seed Mine → Recorder → Chain Arc → Boundary Saw
- **0.00 / 0 связей:** Chain Arc → Afterimage → Mortar Bloom → Seed Mine → Glass Harrow → Recorder
- **0.00 / 0 связей:** Recorder → Ember Lance → Fold → Glass Harrow → Cleaver → Boundary Saw
- **0.00 / 0 связей:** Chain Arc → Recorder → Boundary Saw → Ember Lance → Glass Harrow → Afterimage
- **0.00 / 0 связей:** Glass Harrow → Sentry → Afterimage → Recorder → Seed Mine → Cleaver
- **0.00 / 0 связей:** Afterimage → Iron Rain → Cleaver → Fold → Glass Harrow → Boundary Saw

## Правило интерпретации

**Не исправлять каждый слабый набор добавлением уникальной реакции.** Слабые или случайные шестёрки допустимы. Каталог следует менять только тогда, когда Skill систематически оказывается структурно изолированным, одно состояние становится обязательным или обычные выборки не способны образовать 2–3 осмысленных соседства. Несовершенные наборы должны спасаться катализаторами, мутациями и самостоятельной базовой ценностью Skills.
