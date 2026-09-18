# Roguelike v0.10 — текущие Phenomena, Catalysts и прогрессия

**Дата снимка:** 2026-09-18  
**Версия:** `v0.10 Core Rebuild` из `roguelike_project_handoff_v0_10_core_rebuild_2026-09-17.zip`  
**Назначение документа:** фактический снимок текущей реализации для внешнего геймдизайнерского анализа. Это **не предложение новой системы** и не попытка защищать текущие решения.

## 0. Что считать источником истины

Для этого снимка главным источником являются текущие файлы runtime:

- `prototype/current/src/content/definitions.ts`
- `prototype/current/src/core/simulation.ts`
- `prototype/current/src/core/types.ts`

В коде осталось наследие v0.9/v0.9C. Поэтому ниже специально разделены:

1. **актуальный игровой пул** — то, что реально предлагается/используется в обычном v0.10 run;
2. **объявленные, но неактивные/наследованные сущности** — они ещё есть в definitions/runtime, но не входят в текущий основной discovery-flow;
3. **данные, оставшиеся от старой персональной прокачки оружия**, которые сейчас не являются нормальной частью progression.

---

# 1. Текущая структура билда

## 1.1. Chain

- Максимум активных Phenomena: **4**.
- Между ними максимум **3 активных Catalyst**.
- В `clean` run игра начинается с **1 Phenomenon**, остальные active slots пустые.
- В `clean` run Archive Phenomena имеет **3 ячейки**.
- Archive Catalyst имеет **4 ячейки**.
- В showcase-конфигурации definitions всё ещё содержат предзаполненные 4 Phenomena + 3 Phenomena в reserve и 3 Catalyst + 4 Catalyst в reserve.

### Ритм Chain

В v0.10 длительность фиксируется для **полного цикла**, а не для каждого слота:

```text
cycleDuration = max(0.58, 1.22 / (1 + effectiveTempo))
effectiveTempo = baseTempo + TempoAxis * 0.12
```

В clean run `baseTempo = 0`.

Каждый занятый Phenomenon получает один естественный такт за цикл. Поэтому добавление второго/третьего/четвёртого Phenomenon **не уменьшает частоту уже существующего Phenomenon**; оно делает события внутри того же цикла более частыми.

Пример без Tempo:

| Активных Phenomena | Длина цикла | Интервал между соседними тактами | Частота каждого Phenomenon |
|---:|---:|---:|---:|
| 1 | 1.22 с | 1.22 с | 1 раз / 1.22 с |
| 2 | 1.22 с | 0.61 с | 1 раз / 1.22 с |
| 3 | 1.22 с | ~0.407 с | 1 раз / 1.22 с |
| 4 | 1.22 с | 0.305 с | 1 раз / 1.22 с |

---

# 2. Базовая вертикальная прогрессия: Core Rank / уровень игрока

У Phenomena в текущей нормальной progression **нет персонального роста базового damage по уровням оружия**.

Каждый уровень игрока автоматически повышает базовую силу всех Phenomena, включая найденные позднее:

```text
CorePower = 1 + (PlayerLevel - 1) * 0.075
```

То есть каждый уровень после первого даёт примерно **+7.5% к общей базовой силе Phenomena**.

| Player Level | CorePower |
|---:|---:|
| 1 | ×1.000 |
| 2 | ×1.075 |
| 4 | ×1.225 |
| 6 | ×1.375 |
| 10 | ×1.675 |
| 11 | ×1.750 |
| 14 | ×1.975 |
| 17 | ×2.200 |
| 20 | ×2.425 |

Базовая формула большинства прямых атак в упрощённом виде:

```text
Damage ≈ PhenomenonBaseDamage * CorePower * (1 + GlobalPower) * situational modifiers
```

В normal clean progression `GlobalPower` обычно не предлагается обычным level-up; поле осталось в runtime/debug-конфигурации.

## XP curve

```text
XPNeed(level) = round(12 + level*1.5 + level^1.25*0.70)
```

Начальное требование: `14 XP`.

## Discovery levels

Новые Phenomena могут быть предложены на уровнях:

```text
2, 4, 7, 10, 14
```

если ещё остались неоткрытые Phenomena из актуального `skillOrder`.

## Mutation Cores

Игрок получает Mutation Core на уровнях:

```text
6, 11, 17
```

Mutation Core тратится на мутацию активного Phenomenon. Если мутированный Phenomenon переносится между active/Archive, текущий runtime **снимает мутацию и возвращает Mutation Core**.

---

# 3. Глобальные Core Axes — текущая основная выбранная прокачка

На обычном level-up (если это не Discovery) игра предлагает **3 случайные оси из 6**. Каждая выбранная карта добавляет `+1` к соответствующей оси.

## 3.1. Темп (`tempo`)

Описание UI: сокращает длительность полного цикла.

Фактически:

```text
effectiveTempo += 0.12 за каждый ранг Tempo
cycleDuration = max(0.58, 1.22 / (1 + effectiveTempo))
```

Примеры:

| Tempo rank | Длина полного цикла |
|---:|---:|
| 0 | 1.220 с |
| 1 | 1.089 с |
| 2 | 0.984 с |
| 3 | 0.897 с |
| 5 | 0.763 с |
| 8 | 0.622 с |
| ~10+ | упирается в cap 0.58 с |

**Работает глобально для всей Chain.**

## 3.2. Множественность (`multiplicity`)

Общий смысл: поддерживаемые Phenomena превращают ранг в дополнительные снаряды/прыжки/instances/constructs.

Текущая реализация неодинакова для разных Phenomena:

- **Игла:** generic projectile count, `+1 instance/ранг`, но глобальная прибавка ограничена максимум `+3`.
- **Цепная дуга:** `+1 jump/ранг`, явного cap оси в формуле нет.
- **Орбитальные лезвия:** `+1 blade/ранг`, явного cap оси в формуле нет.
- **Мортира:** generic projectile count, максимум `+3` от оси.
- **Турель:** `+ceil(rank/2)` constructs, но суммарно максимум 5 активируемых за cast и global construct list тоже обрезается до 5.
- **Ледяной фронт:** ось в `axes` не заявлена, поэтому дополнительные frost-fields через multiplicity сейчас не появляются.
- **Секач:** код умеет создавать дополнительные боковые взмахи, но `multiplicity` **не входит в axes Секача**, поэтому нормальная ось их сейчас не включает.
- **Пронзающий луч:** multiplicity не заявлена в axes и не добавляет лучи.

## 3.3. Точность (`precision`)

Для Phenomena, которые поддерживают Precision:

```text
CritChance += 0.045 за ранг
CritDamage = ×1.75
```

То есть **+4.5 процентных пункта crit chance за ранг**.

Поддерживают в актуальном roster:

- Игла
- Секач
- Орбитальные лезвия
- Турель
- Пронзающий луч

Не поддерживают:

- Ледяной фронт
- Цепная дуга
- Мортира

## 3.4. Присутствие (`persistence`)

Здесь в runtime фактически существуют две разные формулы.

### Persistent manifestations (fields / constructs)

Если Phenomenon заявляет `persistence`:

```text
PersistentDuration *= (1 + PersistenceRank * 0.22)
```

То есть **+22% длительности за ранг**.

Актуально прежде всего для:

- Ледяного фронта при `Холодном фронте`
- Мортиры при `Кратере`
- Турели

### Status memory

Отдельно существует:

```text
memoryFactor = 1 + PersistenceRank * 0.18
```

Этот factor сейчас используется для ряда status durations (Ignite, Chill, Wound, Mark и т.п.) **даже там, где Phenomenon формально не имеет persistence в своём `axes`**.

Это важно для ревью: описание оси и фактический scope сейчас не полностью совпадают.

## 3.5. Проводимость (`conductivity`)

Это общая ось Catalyst, а не персональный уровень камня.

Базовый multiplier там, где нужен scalar:

```text
ConductFactor = 1 + ConductivityRank * 0.16
```

Но большинство активных Catalyst реагируют на Conductivity не только множителем, а изменением threshold/ёмкости. Точные формулы приведены в разделе Catalyst.

## 3.6. Подвижность (`mobility`)

При каждом ранге:

```text
MoveSpeed *= 1.045
```

То есть последовательные ранги мультипликативно дают примерно **+4.5% move speed** каждый.

В definitions Орбитальные лезвия заявляют `mobility` как поддерживаемую ось, но отдельной дополнительной механики от самого значения `resonance.mobility` у них сейчас нет; фактический основной эффект оси — скорость героя.

---

# 4. Вторичные глобальные статы

В коде существует дополнительный пул глобальных наград. В обычном XP level-up v0.10 сейчас основной выбор — Core Axes; эти global rewards чаще появляются как fallback/особые награды.

Редкость использует множители:

| Rarity | Multiplier |
|---|---:|
| Common | ×1.00 |
| Uncommon | ×1.18 |
| Rare | ×1.42 |
| Epic | ×1.75 |
| Legendary | ×2.25 |

## Закалка — Max HP

```text
+18 * rarityMultiplier Max HP
```

При получении текущее HP также поднимается на эту величину, но не выше нового максимума.

## Притяжение осколков — Pickup Radius

```text
PickupRadius *= (1 + 0.15 * rarityMultiplier)
```

## Фортуна

```text
Fortune += 0.08 * rarityMultiplier
```

Точное влияние Fortune на будущую систему случайности в текущем runtime ограничено/незавершено; поле существует как часть прогрессии.

## Архивная броня — Armor

```text
Armor += 10 * rarityMultiplier
```

Митигация входящего урона:

```text
DamageReduction = Armor / (Armor + 100)
FinalIncomingDamage = RawDamage * (1 - DamageReduction)
```

---

# 5. Актуальный playable roster Phenomena

В `skillOrder` текущего v0.10 входят **8 Phenomena**:

```text
Игла
Ледяной фронт
Секач
Цепная дуга
Орбитальные лезвия
Мортирный цветок
Турель
Пронзающий луч
```

Три дополнительных Phenomena (`Рельсовое копьё`, `Токсичный туман`, `Импульс отталкивания`) всё ещё полностью описаны в definitions/runtime, но **не входят в текущий `skillOrder` и обычный Discovery-пул v0.10**.

---

## 5.1. Игла (`ember_lance`)

**Base damage:** 54  
**Range:** 13.5  
**Base crit:** 24%  
**Тип:** directional, узкая одиночная линия  
**Axes:** Tempo, Precision, Multiplicity, Conductivity

**Заявленная identity:** очень частая точная атака с высоким естественным crit.  
**Заявленная weakness:** почти не решает плотную толпу без синергии.

Базовый cast поражает обычно только одну цель на луч. Если Multiplicity создаёт несколько instances, каждый дополнительный луч получает коэффициент примерно `×0.86` damage.

Попадание накладывает Ignite. Если цель уже Chilled, Chill потребляется, прямой hit получает `×1.25`, плюс вокруг цели происходит Thermal Shock на ~35% исходного damage.

### Мутации, реально предлагаемые v0.10

#### Залп (`ember_volley`)

- Минимум 3 луча; фактически `max(3, projectileCount + 2)`.
- Лучи расходятся веером.
- Каждый луч наносит `×0.82` базового damage.
- Это явный переход от narrow single-target к заметно большему coverage/потоку попаданий.

#### Горн (`ember_furnace`)

- Основной луч становится короче (`range 8` вместо 13.5) и намного шире.
- После cast создаётся fire field впереди игрока.
- Field: base radius около 1.5; base duration 2.9 сек; DPS базово `17 * CorePower`.

### Объявлены в definitions, но не входят в curated offer v0.10

- Клеймо (`ember_brand`)
- Пронзатель (`ember_impaler`)
- Обратная тяга (`ember_backdraft`)

Код их поведения всё ещё существует.

---

## 5.2. Ледяной фронт (`frost_ring`)

**Base damage:** 17  
**Radius:** 4.15  
**Base crit:** 2%  
**Тип:** круг вокруг игрока, mass-control  
**Axes:** Tempo, Persistence, Conductivity

**Identity:** массово тормозит и перестраивает поток толпы.  
**Weakness:** низкий прямой урон, особенно по одиночной цели.

Базовый cast задевает всё в радиусе и накладывает Chill примерно на 2.4 сек, модифицируемый status/memory factor.

Если цель Ignited, Ignite снимается, direct damage получает `×1.18`, вокруг происходит Thermal Shock примерно на 42% этого damage.

### Мутации, реально предлагаемые v0.10

#### Холодный фронт (`frost_front`)

После обычной волны создаёт Frost Field:

- radius ≈ `1.12 * основной radius`;
- base duration 1.6 сек;
- базовый DPS `13 * CorePower`.

Persistence увеличивает его длительность.

#### Мгновенная заморозка (`frost_snap`)

Если цель уже Chilled:

- добавляет `18 * CorePower` damage;
- текущий Chill сначала снимается;
- затем обычный hit снова накладывает новый Chill.

### Объявлены, но не предлагаются curated v0.10

- Ледяной обод (`frost_rim`)
- Хрустальная кожа (`frost_skin`)
- Хрупкость (`frost_brittle`)

---

## 5.3. Секач (`cleaver`)

**Base damage:** 132  
**Radius:** 2.35  
**Base crit:** 8%  
**Тип:** directional sector  
**Axes:** Tempo, Precision, Conductivity

**Identity:** очень высокий мгновенный урон в опасной ближней зоне.  
**Weakness:** почти нет дальнего давления.

Базовый сектор имеет half-angle ~1.12 rad (~64° в каждую сторону). Попадания накладывают Wound.

### Мутации, реально предлагаемые v0.10

#### Круговой удар (`cleaver_roundhouse`)

- sector превращается в полный `360°` sweep;
- в текущем коде **нет отдельного штрафа к базовому damage**.

#### Ритм мясника (`cleaver_rhythm`)

- убийства накапливают stacks до 4;
- шанс дополнительного повторного взмаха зависит от stacks: `min(65%, stacks * 16%)`;
- повторный взмах наносит `×0.65` обычного damage.

### Объявлены, но не предлагаются curated v0.10

- Гильотина (`cleaver_guillotine`)
- Крюк (`cleaver_hook`)
- Глубокий порез (`cleaver_deep`)

---

## 5.4. Цепная дуга (`chain_arc`)

**Base damage:** 31  
**Initial target range:** 9.0  
**Base crit:** 4%  
**Тип:** auto-target chaining  
**Axes:** Tempo, Multiplicity, Conductivity

**Identity:** распределяет воздействие между разрозненными целями.  
**Weakness:** резко теряет эффективность, когда целей мало.

Базово:

- до 4 jumps;
- jump range около 4.2;
- damage последующих прыжков умножается примерно на `0.88^jumpIndex`.

Multiplicity прямо добавляет jumps.

### Мутации, реально предлагаемые v0.10

#### Разветвлённая сеть (`arc_forked`)

- base max jumps 4 → 7;
- падение damage между jumps уменьшается: примерно `0.93^jumpIndex` вместо `0.88^jumpIndex`.

#### Дуговая клетка (`arc_cage`)

Если цель повторно получает Arc-hit в течение ~2.2 сек, создаётся Arc Field:

- radius ~1.25;
- duration ~1.7 сек;
- DPS базово `13 * CorePower`.

### Объявлены, но не предлагаются curated v0.10

- Ёмкостная дуга (`arc_capacitive`)
- Заземление (`arc_ground`)
- Статический ретранслятор (`arc_relay`)

---

## 5.5. Орбитальные лезвия (`orbit_blades`)

**Base damage:** 18  
**Orbit radius:** 1.95  
**Base crit:** 5%  
**Тип:** постоянный close-contact orbit  
**Axes:** Multiplicity, Precision, Mobility, Conductivity

**Identity:** постоянная плотность контактов вокруг героя.  
**Weakness:** практически не отвечает угрозам на дистанции.

Это особый Phenomenon: damage идёт не только в момент его Chain-tick. Orbit обновляется отдельным runtime-loop примерно каждые `0.13 сек`, при этом одна и та же цель имеет внутренний hit cooldown около `0.38 сек`.

Базовый damage одного orbit contact примерно:

```text
18 * CorePower * 0.36
```

Multiplicity увеличивает число blades; текущая формула для normal orbit фактически не использует жёсткий +3 cap generic projectile count.

### Мутации, реально предлагаемые v0.10

#### Вылет (`orbit_outbound`)

На естественном Chain-такте дополнительно происходит большой circle-hit вокруг героя:

- radius ~4.6;
- damage по целям внутри: `18 * 2.2 * CorePower` до прочих modifiers.

Обычный постоянный orbit при этом продолжает существовать.

#### Защитное кольцо (`orbit_guard`)

Enemy projectiles, вошедшие примерно в радиус `1.85` от игрока, уничтожаются до попадания.

### Объявлены, но не предлагаются curated v0.10

- Много ножей (`orbit_many`)
- Пильная корона (`orbit_saw`)
- Кровавая орбита (`orbit_blood`)

---

## 5.6. Мортирный цветок (`mortar_bloom`)

**Base damage:** 76  
**Range:** 14.5  
**Explosion radius:** 2.85  
**Base crit:** 3%  
**Тип:** directional artillery/AoE  
**Axes:** Multiplicity, Persistence, Conductivity

**Identity:** большой редкий пакет damage по плотной группе.  
**Weakness:** плохо отвечает на ближнее давление и одиночные быстрые цели.

Без mutation число explosion instances определяется projectile count. Если explosions больше одного, каждый получает коэффициент примерно `×0.86`.

### Мутации, реально предлагаемые v0.10

#### Кластерный цветок (`mortar_cluster`)

- всегда создаёт **3 explosion zones**;
- дополнительные зоны слегка случайно смещены вокруг основной точки;
- каждый explosion при множественном варианте использует `×0.86` damage.

#### Кратер (`mortar_crater`)

После первой explosion zone создаётся slowing Frost Field:

- radius ≈ `0.9 * explosion radius`;
- base duration ~3.3 сек;
- DPS базово `6 * CorePower`.

Persistence увеличивает длительность.

### Объявлены, но не предлагаются curated v0.10

- Длинный фитиль (`mortar_fuse`)
- Наводчик (`mortar_spotter`)
- Воздушный разрыв (`mortar_airburst`)

---

## 5.7. Турель (`sentry`)

**Base shot damage:** 22  
**Range:** 12.5  
**Base crit:** 9%  
**Тип:** autonomous construct  
**Axes:** Persistence, Precision, Multiplicity, Conductivity

**Identity:** создаёт стабильный автономный канал damage и target priority.  
**Weakness:** требует времени присутствия и хуже при постоянной смене зоны.

Обычная turret:

- base lifetime ~7.5 сек;
- base shot interval ~0.62 сек;
- Multiplicity добавляет `ceil(rank/2)` spawned constructs;
- одновременно runtime держит максимум 5 constructs данного типа.

### Мутации, реально предлагаемые v0.10

#### Гатлинг (`sentry_gatling`)

- fire interval ~0.30 сек;
- damage каждого shot `×0.52`.

То есть значительно повышается event rate и target switching.

#### Рельсовая установка (`sentry_rail`)

- fire interval ~1.10 сек;
- damage каждого shot `×1.9`;
- target sorting отдаёт приоритет Elite.

### Объявлены, но не предлагаются curated v0.10

- Ретранслятор (`sentry_relay`)
- Ползун (`sentry_crawler`)
- Утилизатор (`sentry_salvager`)

---

## 5.8. Пронзающий луч (`mass_driver`)

**Base damage:** 24  
**Range:** 22  
**Base crit:** 1%  
**Тип:** длинная пробивающая directional line  
**Axes:** Tempo, Precision, Conductivity

**Identity:** низкий damage на цель, зато прошивает длинную плотную линию насквозь.  
**Weakness:** очень слаб по одной изолированной цели.

Базовый луч может поражать до ~18 целей на линии и слегка отталкивает каждую поражённую цель.

### Мутации, реально предлагаемые v0.10

#### Снежный ком (`mass_snowball`)

Damage растёт по мере прохождения по целям:

```text
DamageMultiplier = 1 + min(0.9, HitIndex * 0.10)
```

То есть поздние цели на плотной линии могут получать до ~`×1.9` базового damage.

#### Рельсовая масса (`mass_rail`)

- range 22 → ~26;
- луч становится уже;
- damage `×1.55`.

### Объявлены, но не предлагаются curated v0.10

- Отдача (`mass_recoil`)
- Груз (`mass_cargo`)
- Предельная скорость (`mass_terminal`)

---

# 6. Phenomena, оставшиеся в runtime, но выключенные из текущего discovery-pool

Эти сущности не входят в `skillOrder` v0.10, но definitions и cast logic присутствуют.

## Рельсовое копьё (`rail_spear`)

- Base damage 58
- Range 18.5
- длинная пробивающая линия
- 5 объявленных мутаций: Стойка пронзателей, Рельсотрон, Веер копий, Гарпун, Точечное копьё

## Токсичный туман (`toxic_mist`)

- Base damage/DPS seed 12
- Radius 4.5
- persistent toxic field
- 5 объявленных мутаций: Коррозия, Заражение, Дистиллят, Шлейф, Реактивный растворитель

## Импульс отталкивания (`repulse_halo`)

- Base damage 16
- Radius 3.0
- mass displacement / defensive control
- 5 объявленных мутаций: Гравитационный колодец, Ударный фронт, Эгида, Кинетический релей, Компрессионные кольца

---

# 7. Mutation system — фактическое состояние

В definitions у каждого Phenomenon обычно объявлено **5 mutations**, но для актуальных восьми Phenomena функция `generateMutationOffer()` жёстко ограничивает pool **двумя curated mutations на Phenomenon**:

| Phenomenon | Сейчас реально предлагаются |
|---|---|
| Игла | Залп / Горн |
| Ледяной фронт | Холодный фронт / Мгновенная заморозка |
| Секач | Круговой удар / Ритм мясника |
| Цепная дуга | Разветвлённая сеть / Дуговая клетка |
| Орбитальные лезвия | Вылет / Защитное кольцо |
| Мортирный цветок | Кластерный цветок / Кратер |
| Турель | Гатлинг / Рельсовая установка |
| Пронзающий луч | Снежный ком / Рельсовая масса |

То есть **фактическое разнообразие мутаций сейчас = 16 доступных вариантов**, несмотря на значительно больший каталог, оставшийся в data/runtime.

Mutation Core выдаётся на player levels 6 / 11 / 17. Offer выбирает до трёх активных немутированных Phenomena, после выбора конкретного Phenomenon показываются его две curated mutations.

---

# 8. Catalyst system — актуальный discovery-pool

В v0.10 Catalyst **не имеют уровней и персонального potency**. Они должны быть готовыми операторами.

В основном `catalystOrder` сейчас **9 Catalyst**:

```text
Реле убийств
Маршрутизатор
Преобразователь массы
Резервуар событий
Сплав
Эхо-отпечаток
Обратная связь
Возврат
Эгида потока
```

Ниже — не только UI-текст, а фактическое runtime-поведение.

---

## 8.1. Реле убийств (`relay`) — Gate

Читает **убийства предыдущего Phenomenon**.

Порог:

```text
NeedKills = max(1, 3 - min(2, Conductivity))
```

То есть:

- Conductivity 0 → 3 убийства;
- 1 → 2 убийства;
- 2+ → 1 убийство.

Если threshold выполнен, правый Phenomenon сразу после своего normal cast получает **ещё одно derived-проявление** с `activationScale = 0.82`.

Это наиболее прямой вариант «A триггерит дополнительный B».

---

## 8.2. Маршрутизатор (`anchor`) — Router

Если левый Phenomenon кого-то задел, перед естественным тактом правого:

- берётся центр масс targets предыдущего события;
- aim правого временно направляется на эту точку.

Это **не создаёт дополнительный cast** и не переносит damage; он перенаводит нормальный такт правого.

Эффект заметен прежде всего у направленных Phenomena; auto/circular Phenomena могут почти не использовать временный aim.

---

## 8.3. Преобразователь массы (`capacitor`) — Converter

Количество targets, задетых слева, превращается в дополнительные instances справа.

```text
Divisor = max(3, 6 - Conductivity)
BonusInstances = min(3, floor(PreviousHitCount / Divisor))
```

Пример:

- Conductivity 0: один bonus instance на каждые 6 targets;
- Conductivity 1: на каждые 5;
- Conductivity 2: на каждые 4;
- Conductivity 3+: на каждые 3;
- максимум `+3 instances` за активацию.

Не переносит прямой damage слева.

---

## 8.4. Резервуар событий (`reservoir`) — Memory

Между циклами накапливает массовые события слева:

```text
Charge += PreviousHitCount + PreviousKills * 2
Threshold = max(7, 12 - Conductivity)
```

При заполнении:

```text
BonusInstances = 2 + min(1, Conductivity)
```

То есть без Conductivity даёт +2, уже с первого ранга Conductivity — +3 instances.

Charge не является damage; это накопитель количества событий.

---

## 8.5. Сплав (`conduit`) — Fusion/state transfer

Если предыдущий Phenomenon произвёл `state`, после normal cast правого этот state накладывается на всех targets, которых правый Phenomenon реально задел.

Сила/длительность передачи масштабируется примерно как:

```text
0.65 * (1 + Conductivity * 0.16)
```

Передаваться могут состояния, которые текущий runtime умеет фиксировать: Ignite, Chill, Wound, Toxin, Mark, Exposed, Embed, Displaced и некоторые служебные типы в зависимости от источника.

---

## 8.6. Эхо-отпечаток (`echo_shard`) — Imprint/proc

После normal cast правого:

- берёт damage предыдущего Phenomenon;
- берёт **центр текущих targets правого**;
- создаёт вокруг этого центра небольшой AoE echo radius ~1.45;
- damage одного echo-hit рассчитывается из `PreviousDamage`, Conductivity и количества предыдущих targets.

Приблизительно:

```text
EchoDamagePerTarget = min(
  160,
  PreviousDamage * 0.48 * (1 + Conductivity*0.16) / clamp(PreviousHitCount, 1..4)
)
```

Фактическая геометрия сейчас использует центр targets **правого**, хотя текст definitions говорит об «отпечатке предыдущего воздействия». Это одно из текущих расхождений описания и реализации.

---

## 8.7. Обратная связь (`backflow`) — Feedback

Если правый Phenomenon задел **3 или больше targets**, то **следующая естественная активация левого Phenomenon** получает:

```text
+1 instance
```

То есть B не повторяет A немедленно; успешный B усиливает следующий проход A через count/instance.

---

## 8.8. Возврат (`overflow`) — Topology

Если предыдущий Phenomenon задел достаточно targets:

```text
Threshold = max(5, 8 - Conductivity)
```

то после normal cast правого выполнение **один раз возвращается к левому Phenomenon**.

Повтор левого:

- происходит немедленно;
- имеет `activationScale = 0.78`;
- помечается как derived;
- recursion guard не позволяет бесконечный цикл.

Это фактически изменение порядка исполнения Chain, а не только numerical amplification.

---

## 8.9. Эгида потока (`aegis_relay`) — Defensive Converter

Читает aggregate control предыдущего Phenomenon и количество задетых targets.

На такте правого выдаёт Barrier:

```text
BarrierGain = min(
  36,
  (PreviousControl * 2.6 + PreviousHitCount * 0.35)
  * (1 + Conductivity * 0.16)
)
```

Сам правый Phenomenon при этом срабатывает обычным образом.

Это Catalyst, который конвертирует результат Chain в защиту, а не в дополнительный damage.

---

# 9. Catalyst, всё ещё объявленные в definitions, но исключённые из текущего discovery-pool

Они существуют как `CatalystId` и имеют definitions; часть старой runtime-логики также сохранена. Но обычный v0.10 `catalystOrder` их не выдаёт.

| Catalyst | Старый смысл |
|---|---|
| Усилитель (`amplifier`) | усилить правый Skill числом |
| Ускоритель (`accelerator`) | ослабить правый, шанс повторной активации |
| Охотник (`hunter`) | усиление против Elite, ослабление по normals |
| Расщепитель (`splitter`) | + projectile с penalty |
| Линза (`lens`) | меньше Area, выше интенсивность |
| Диффузор (`diffuser`) | больше Coverage, меньше сила |
| Палач (`executioner`) | усиление по low-HP target |
| Гироскоп (`gyroscope`) | бонус во время движения |
| Тормоз (`brake`) | бонус во время стояния |
| Детонатор (`detonator`) | потребление state слева для burst справа |

Из них `detonator` всё ещё имеет активную проверку в общем damage runtime, если каким-либо способом окажется установлен, но он **не входит в актуальный discovery order**.

---

# 10. Elite Core / награды за элиток — связь с прогрессией билда

Обычная убитая Elite оставляет Core pickup.

Количество Core зависит от старой `eliteAffixThreat`:

```text
base = 2
+1 если affix threat >= 2
+1 если affix threat >= 4
```

В clean run, пока у игрока вообще нет Catalyst, первая подходящая Elite принудительно даёт минимум **5 Core**, чтобы открыть Catalyst-layer быстрее.

Когда накоплено:

```text
EliteCore >= 5
```

тратится 5 Core и создаётся Elite Cache.

При наличии места и неоткрытых Catalyst он в первую очередь предлагает до 3 новых Catalyst из актуального `catalystOrder`.

Если все Catalyst уже собраны/нет нормального варианта, Elite Cache может предложить Core Axis, поздний Phenomenon или fallback global reward.

---

# 11. Что осталось от старой персональной прокачки оружия, но сейчас фактически не используется нормальным progression

Это важный технический нюанс для внешнего агента.

`SkillRuntime` всё ещё содержит:

```text
level
power
coverage
range
duration
crit
eliteDamage
count
control
statusPotency
mutation
```

`definitions.ts` всё ещё содержит для каждого Phenomenon `upgradePool`, а также старые величины:

```text
power +0.24
coverage +0.38
range +0.30
duration +0.38
crit +0.10
eliteDamage +0.24
count +1
control +0.32
statusPotency +0.34
```

Есть даже функция weightedSkillStat(), которая умеет менять вероятность персональных stat-roll в зависимости от mutation tag.

**Но в текущем v0.10 normal progression эта функция не вызывается и персональные weapon-stat cards игроку не выдаются.**

Новый Phenomenon создаётся примерно так:

```text
level = 1
power = 0
coverage = 0
range = 0
duration = 0
eliteDamage = 0
count = 1
control = 0
statusPotency = 0
crit = его baseCrit
mutation = null
```

И дальше его базовый damage растёт через общий `CorePower`, а не через `skill.level`.

Старые поля сохранены прежде всего ради совместимости runtime/debug/benchmark и ещё используются некоторыми формулами, если задать их извне.

---

# 12. Текущая ёмкость Archive и её последствия — только факт реализации

В clean mode:

```text
Active Phenomena: 4
Phenomenon Archive: 3
Active Catalysts: 3
Catalyst Archive: 4
```

Итого игрок теоретически может одновременно владеть:

- **7 Phenomena** из актуального пула 8;
- **7 Catalyst** одновременно (3 установлены + 4 в Archive) из discovery-пула 9.

Никакой деградации/XP penalty за нахождение в Archive нет.

При active ↔ Archive swap мутированного Phenomenon mutation снимается, а Mutation Core возвращается.

---

# 13. Краткая матрица: какие глобальные оси сейчас реально поддерживают актуальные Phenomena

| Phenomenon | Tempo | Multiplicity | Precision | Persistence | Conductivity | Mobility |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Игла | ✓ | ✓ | ✓ | — | ✓ | — |
| Ледяной фронт | ✓ | — | — | ✓ | ✓ | — |
| Секач | ✓ | — | ✓ | — | ✓ | — |
| Цепная дуга | ✓ | ✓ | — | — | ✓ | — |
| Орбитальные лезвия | —* | ✓ | ✓ | — | ✓ | ✓ |
| Мортирный цветок | —* | ✓ | — | ✓ | ✓ | — |
| Турель | —* | ✓ | ✓ | ✓ | ✓ | — |
| Пронзающий луч | ✓ | — | ✓ | — | ✓ | — |

`*` Tempo технически ускоряет **всю Chain глобально независимо от axes**, поэтому отсутствие Tempo в `axes` не мешает этим Phenomena активироваться чаще. Таблица отражает declarations, а не exclusivity фактического Tempo.

Аналогично Conductivity в runtime в первую очередь улучшает **Catalyst system глобально** и практически не проверяет `supportsAxis()` у соседних Phenomena. Поэтому наличие Conductivity в `axes` сейчас скорее метаданные/намерение дизайна, чем реальное условие работы камней.

---

# 14. Известные расхождения между пользовательским описанием и runtime

Этот раздел нужен только для того, чтобы анализировать **реальную** текущую версию, а не предполагаемую.

1. **В definitions у Phenomena по 5 mutations, но для актуальной восьмёрки доступны только 2 curated mutations каждый.**
2. **`upgradePool` и персональные weapon stats всё ещё лежат в данных, но normal v0.10 их не прокачивает.**
3. **Некоторые старые Catalyst полностью определены, но исключены из discovery.**
4. **Persistence фактически влияет на часть status duration шире, чем можно понять из declared axes.**
5. **Tempo работает глобально на весь cycle вне зависимости от declared `axes`.**
6. **Conductivity тоже является почти полностью глобальной характеристикой Catalyst-system, хотя у Phenomena она указана как supported axis.**
7. **Echo Shard по UI/definition звучит как spatial imprint предыдущего воздействия, но current runtime ставит echo вокруг центра targets правого Phenomenon и использует damage левого как числовой источник.**
8. **Orbit имеет отдельный continuous runtime-loop**, поэтому его фактический attack cadence устроен иначе, чем у остальных Phenomena Chain.
9. **Mutation visuals/animations не документированы как гарантированно соответствующие runtime-механике.** Для ряда mutations assets существуют (`*_mutated.jpg`), но данный снимок описывает именно combat logic, а не подтверждает корректность animation playback.

---

# 15. Сжатый фактический progression flow v0.10

```text
START
  ↓
1 Phenomenon
  ↓
XP → Player Level
  ↓
каждый Player Level автоматически +7.5% CorePower
  ↓
Level 2 / 4 / 7 / 10 / 14 → Discovery нового Phenomenon, если есть неоткрытые
остальные level-up → выбор 1 из 3 Global Core Axes
  ↓
Level 6 / 11 / 17 → Mutation Core
  ↓
Mutation Core → выбрать active Phenomenon → 1 из 2 curated mutations
  ↓
Elite kills → Elite Core
  ↓
5 Elite Core → чаще всего выбор нового Catalyst
  ↓
Catalyst не прокачивается уровнями; сила/threshold системы частично растёт через Conductivity
  ↓
Planning → перестановка active Phenomena / Catalyst и Archive
```

---

# 16. Самое короткое резюме текущей системы для агента

Текущий v0.10 сознательно ушёл от персональных weapon levels:

- **общий уровень игрока** автоматически масштабирует базовую силу всего оружия;
- **6 глобальных Core Axes** — основная выбранная вертикальная прокачка;
- **Phenomena** должны быть заменяемыми горизонтальными модулями;
- **Catalysts** не имеют уровней и являются операторами между соседними Phenomena;
- **Mutation Cores** — редкая качественная эволюция Phenomenon;
- **Archive** не теряет силу со временем;
- текущий playable roster — 8 Phenomena;
- фактически доступно только 16 curated mutations (2 на Phenomenon);
- discovery-pool Catalyst — 9;
- при этом код всё ещё содержит значительный пласт старой v0.9 системы, который не следует ошибочно принимать за активную progression.

