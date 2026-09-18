# Отчёт валидации

Режим: **quick**.

| Проверка | Результат | Секунды |
|---|---|---:|
| Генерация каталога | PASS | 1.33 |
| Линтер контента | PASS | 1.32 |
| Граф взаимодействий | PASS | 0.92 |
| Аудит упорядоченной Chain | PASS | 2.56 |
| Матрица контента | PASS | 0.85 |
| Балансовый Monte-Carlo | PASS | 5.96 |
| Авторские пробы билдов | PASS | 2.68 |

## Консольные результаты

### Генерация каталога

```text
wrote /mnt/data/roguelike_spec/CONTENT_CATALOG.md lines 658
```

### Линтер контента

```text
CONTENT LINTER
Errors: 0  Warnings: 0
NOTE : Familiarity mix: {'classic': 10, 'hybrid': 4, 'unusual': 10} (classic=41.7%).
NOTE : Near-duplicate pairs >=0.72: 0.
NOTE : Systemic directed Skill→Skill state edges: 63.
```

Интерпретация: **0 ошибок / 0 предупреждений**; смесь familiarity — 10 classic / 4 hybrid / 10 unusual; пар с механической похожестью >=0.72 не найдено; системных направленных связей — 63.

### Граф взаимодействий

```text
wrote /mnt/data/roguelike_spec/INTERACTIONS.generated.md (63 edges)
```

### Аудит Chain

```text
wrote /mnt/data/roguelike_spec/CHAIN_SPACE.generated.md
```

### Матрица контента

```text
wrote /mnt/data/roguelike_spec/CONTENT_MATRIX.generated.md
```

### Балансовый Monte-Carlo

```text
WORLD {'hp': 5.373, 'damage': 1.806, 'spawn': 3.645, 'composition': 2.44, 'throughput_requirement': 47.782}
RARITY [46.99, 28.47, 15.2, 7.13, 2.21]
RANDOM {'p10': 0.81, 'p50': 1.11, 'p90': 1.536, 'p99': 2.614} mean 1.164
COHERENT {'p10': 1.195, 'p50': 1.708, 'p90': 2.57, 'p99': 4.852} mean 1.848
P10 ratio= 1.2 seed= 6175 edges= 4 laws= 1 jackpot= 1.0 build= ['Vacuum Bloom', 'Toxic Mist', 'Fold', 'Repulse Halo', 'False Moon', 'Mortar Bloom']
P50 ratio= 1.71 seed= 6520 edges= 4 laws= 2 jackpot= 1.0 build= ['Pressure Membrane', 'Fold', 'Mass Driver', 'Glass Harrow', 'Orbit Blades', 'Debt Orb']
P90 ratio= 2.57 seed= 6966 edges= 3 laws= 3 jackpot= 1.0 build= ['Recorder', 'Mass Driver', 'Frost Ring', 'Boundary Saw', 'Rail Spear', 'Chain Arc']
P99 ratio= 4.85 seed= 6585 edges= 4 laws= 3 jackpot= 1.49 build= ['Repulse Halo', 'Rail Spear', 'Mass Driver', 'Cleaver', 'Vacuum Bloom', 'Pressure Membrane']
```

### Авторские пробы

```text
wrote /mnt/data/roguelike_spec/RUN_PROBES.generated.md
```

## Интерпретация

- PASS всего набора означает только соблюдение **текущих структурных контрактов**. Это не доказательство веселья, честности или визуальной читаемости.
- Любой high-roll tail из генератора нужно проверять: это намеренная авторская причина или случайная рекурсия/proc-loop.
- Чистый lint не является разрешением добавлять новый контент; обязательны плейтест/телеметрия и anti-bloat review gate.
- Билды риска из `RUN_PROBES.generated.md` намеренно остаются отрицательными контрольными примерами.
