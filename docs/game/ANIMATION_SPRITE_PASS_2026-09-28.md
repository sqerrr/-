# Animation / sprite pass — 2026-09-28

Работа вынесена в отдельную ветку и намеренно не меняет webgl2.ts, main.ts, simulation и текущие refactor-ветки. Подключение в renderer делается после стабилизации presentation-слоя.

## Что сломано сейчас

### ГГ

Текущие v07_player.png, player_run_0..3.png и player_cast_0..3.png не являются чистым набором кадров одной анимации.

- idle-силуэт занимает примерно 218x235 px внутри 256x256;
- run — около 171x228;
- cast меняется примерно от 184x228 до 218x228;
- в run/cast есть части соседних персонажей, полосы интерфейса и следы исходных скриншотов;
- renderer вырезает alpha-bbox каждого PNG, а затем растягивает каждый bbox в один и тот же quad. Из-за разной ширины bbox ГГ визуально меняет пропорции и размер;
- направление сейчас сводится к горизонтальному flip: фактически два направления вместо изометрического directional набора.

Это нельзя надёжно исправить ещё одним коэффициентом масштаба. Нужен единый fixed-cell sheet со стабильным pivot.

### Топор / Cleaver

Сейчас визуальный удар в основном представлен движущимися линиями внутри sector hitbox. Геометрия читается, но физический объект атаки нет: отсутствуют крупный силуэт топора, явный замах, активная фаза и recovery.

Цель v2: 6 фаз — anticipation, backswing, contact, active sweep, late active, recovery. Hitbox остаётся полностью simulation-authoritative; анимация только объясняет его игроку.

### Предметы

В выборе большинство предметов представлены Unicode-глифами, а лежащий в мире relic — общей формой категории. Категория считывается, конкретный предмет почти нет. Для системы, где предмет может забрать элита, нужен собственный силуэт каждого item.

## Новый контракт

Листы используют 9 логических строк:

C, N, NE, E, SE, S, SW, W, NW

C — только нейтральный fallback нулевого вектора. Физических facing-направлений восемь.

Направление вычисляется после изометрической проекции:

- screen X = world X - world Z
- screen Y = world X + world Z

Поэтому +X визуально идёт в SE, +Z — в SW и т.д.

Кадр героя имеет фиксированный canvas 192x192 и единый pivot ног. Runtime не должен делать per-frame alpha-trim/stretch.

Если исходник был сгенерирован одной большой картинкой, tools/sprite_sheet_normalize.py:
1. делит её на tiles;
2. находит alpha bbox;
3. приводит тело к общей высоте;
4. ставит на единый bottom-center pivot;
5. пишет QA JSON с scale и overflow для каждого кадра.

## Добавлено

- src/presentation/directionalSprite.ts — 9-way quantization, stable facing, fixed-cell UV;
- src/tools/directional_sprite_regression.ts — проверки всех направлений, deadzone и UV;
- tools/sprite_sheet_normalize.py — нормализатор больших сгенерированных sheets;
- tools/build_sprite_assets.py — воспроизводимая сборка текущего v2 baseline;
- public/animation_lab.html — автономный viewer, не запускающий игру;
- generated assets: hero idle/run/cast, cleaver and 20 item icons.

Hero v2 — технический чистый baseline, а не заявка на финальный арт. Его задача — убрать мусор старых кадров, скачки масштаба, неправильные направления и дать стабильный контракт. Более красивый sheet потом заменяется без изменения архитектуры.

## Подключение после текущего рефакторинга

1. renderer хранит lastFacing;
2. facing берётся из aim/movement через stableFacing();
3. hero выбирает clip idle/run/cast и fixed-cell UV;
4. старые player_run_*.png, player_cast_*.png, runtime alpha-bbox packing и flip для ГГ удаляются;
5. cleaver overlay запускается от уже существующего skillCast/combatShape события и не создаёт собственную геометрию;
6. UI item icon берётся из item_icons_v2.json; world relic показывает ту же иконку меньшего размера поверх contested marker.

## Критерии финального арта

- высота силуэта между кадрами одного clip гуляет не более примерно 5–7% до нормализации;
- pivot ног не гуляет больше 2–3 px;
- нет UI-фрагментов, второго персонажа и обрезанных соседних кадров;
- 8 facing-направлений различимы без простого flip;
- anticipation и active frame оружия различаются по силуэту, а не только по свечению;
- топор узнаётся в стоп-кадре при игровом масштабе;
- предмет узнаётся по форме без подписи, а цвет категории остаётся вторичным каналом;
- animation art не определяет hitbox: визуал следует canonical combat geometry.
