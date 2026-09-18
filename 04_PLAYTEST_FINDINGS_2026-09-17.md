# PLAYTEST UPDATE — v0.9B CORE-PILLAR FAILURE

Latest owner observations after v0.9B:

- the run became noticeably poorer in vertical rhythm; Elites feel like rare events rather than a core loop;
- sparse Phenomenon acquisition plus XP-only active-Phenomenon growth makes a single-weapon carry the obvious strategy;
- this means Chain/Catalyst assembly is not required to finish the run;
- the simplification of randomness overcorrected: one active weapon can receive essentially guaranteed repeated upgrades;
- mutation power is highly uneven; some variants create abrupt “super-weapon” states while other branches are weak or mostly cosmetic;
- Orbit Blades expose the problem clearly: base reach is painful, then an outward/burst mutation can abruptly erase that weakness and massively increase clear;
- Poison / Mortar / Chain Arc also have variants that can dominate;
- expansion/coverage is close to a universal S-tier stat and therefore fails as an interesting decision;
- many Catalyst/Mutation outcomes still collapse to more damage instead of producing new combinatorial behavior;
- Catalysts should not routinely be balanced by guaranteed weakening of the attached Phenomenon;
- the defining pillars — adaptive Elite control and rich visible Chain synergy — remain unresolved and require a dedicated redesign investigation.

Interpretation: **do not react by blindly restoring v0.8.** Preserve the useful world/readability work, but reopen progression, Elite adaptation/cadence, mutations, Resonance and Catalyst semantics. Full analysis: `11_CORE_PILLARS_INVESTIGATION_2026-09-17.md`.

---

# Playtest findings — web prototype v0.8

**Дата:** 2026-09-17.  
**Источник:** ручной тест владельца проекта после v0.8 SYSTEMS и предшествующих v0.4–v0.7 итераций.

Документ фиксирует не “желательные идеи”, а наблюдения, полученные из реально запущенного прототипа. Если они конфликтуют с прежней бумажной моделью, их нельзя игнорировать только потому, что старая формула была аккуратнее.

## 1. Прогрессия ощущается слишком слабой

Даже после добавления breakpoint-уровней и random rolls усиление остаётся гораздо менее заметным, чем требуется для survivors-like power fantasy.

Нужное ощущение сравнивалось с Megabonk: в начале отдельного врага можно разбирать несколько секунд, но через несколько минут хороший билд способен косить пачки. В текущем прототипе рост есть, но он слишком “разумный” и почти линейный.

### Вывод

Следующий prototype должен проверить **нелинейную прогрессию**. Важны не только Damage/Power, но и геометрические оси:

- размер/радиус/ширина;
- число снарядов/волн/зон;
- число целей/переходов/пробитий;
- длительность и uptime;
- repeat/multicast;
- число constructs/orbits;
- propagation states;
- крупные Mutation/Ascension rule changes.

Игрок должен видеть рост без DPS-метра.

## 2. Собирать билд слишком трудно из-за ширины reward pool

В v0.8 одновременно существуют многочисленные Phenomena, их уровни/мутации, Catalyst-компоненты, Catalyst upgrades, Reserve и global/player stats. В обычном reward flow слишком много потенциальных направлений.

Практический эффект: даже когда игрок понимает желаемый билд, большая часть level-up решений даёт маленькое усиление в одном из множества мест. Сила размазывается; вертикальная инвестиция затруднена.

### Вывод

Нужно проектировать **reward architecture**, а не только probabilities. Важно разделить каналы:

- обычное усиление active Phenomena;
- получение новых Phenomena;
- Catalysts и их развитие;
- global/body stats;
- Mutations/Ascensions;
- Elite rewards;
- targeted POI rewards.

Неактивный Reserve не должен автоматически конкурировать за каждый стандартный level-up.

## 3. Chain перестановки пока не дают достаточно сильного ощущения

Автотест `chain_regression` доказывает, что перестановка меняет hash и damage. Ручной тест показал, что этого мало: **кратной или качественно очевидной разницы нет**.

Это ключевой design failure, потому что Chain — центральная идентичность проекта.

### Вывод

Приемлемая перестановка должна менять хотя бы одно из:

- где возникает следующий Phenomenon;
- сколько раз он возникает;
- какие targets/points наследуются;
- какие состояния он получает/потребляет;
- откуда приходит payload;
- что сохраняется в следующий cycle;
- attack→defense/economy conversion;
- geometry/time model.

`+35% правому Skill` полезен как простой кирпич, но не может быть доминирующим типом Catalyst.

## 4. Catalysts нуждаются в более ясном русском языке

В прототипе трудно понять многие камни, особенно когда tooltip опирается на англоязычные системные термины или описывает “передачу контекста”, не показывая результат.

### Требование

Player-facing UI должен использовать простой русский язык и показывать **пример фактической пары**:

> “Когда Огненное копьё поджигает цель, Кольцо мороза переносит поджог на задетых им врагов (60% силы).”

или

> “Урон слева копится. Следующий феномен справа добавляет до 120 накопленного урона в первое попадание.”

Нужны before/after previews в Planning overlay.

## 5. Геометрия оружия/Phenomena меняется недостаточно

В текущей реализации многие Phenomena визуально остаются примерно теми же при росте уровня. Mutation часто не меняет силуэт атаки достаточно сильно.

### Вывод

У каждого Phenomenon должны быть 2–4 “видимые оси”, которые могут вырасти резко. Пример: Frost Ring не просто +damage, а радиус ×1.6, две концентрические волны, moving front, удалённый origin. Mortar — число залпов/радиус/cluster/fields. Orbit — blade count/orbit radius/interception.

## 6. AoE/close builds всё ещё трудно реализовать

Проблема не только в цифрах. Игрок часто не может безопасно войти в рабочую дистанцию, а AoE не растёт достаточно, чтобы компенсировать риск.

### Причины для проверки

- слишком большая стартовая/средняя толпа;
- слишком много ranged pressure;
- слабый sustain;
- слабая геометрическая progression;
- reward dilution;
- close-specific защитные инструменты недостаточно доступны/заметны.

## 7. Замечание о projectile soup относится к монстрам

Не урезать player projectile builds только ради этого feedback.

Проблема — когда обычные враги слишком часто создают массу мелких projectile, и бой начинает требовать bullet-hell dodging вместо позиционирования относительно орды/элиток.

### Следующий target

Меньше вражеских projectile одновременно; больше:

- telegraphed line/sector;
- delayed ground zone;
- dash;
- flank/intercept;
- formation pressure;
- temporary terrain;
- support links.

## 8. Стартовых мобов, вероятно, всё ещё многовато

v0.8 уже снизил early target до ~14 на 15 секунде / ~18 на 30 секунде в автоматическом world probe, но субъективно начало всё ещё не даёт достаточно пространства для слабой стартовой фазы.

### Вывод

Следующий prototype должен тестировать ещё более мягкий opening **вместе с** гораздо сильнее растущей player power curve. Не пытаться решить power fantasy простым увеличением числа врагов.

## 9. Обычные враги различаются недостаточно явно

Projectile-тип заметен, остальные роли часто нет. Разные internal AI/state не имеют значения, если их функция не читается на поле.

### Требование

У каждой normal role должен быть distinct question + visual tell:

- charger — понятный windup/line;
- support — видимые links;
- redactor — заметно стирает/искажает player field;
- palimpsest — явный цикл смерти/возврата;
- indexer — маркировка цели/маршрута;
- inkblot — крупный death zone;
- marginwalker — сильное edge/flank поведение.

## 10. Элиты всё ещё недостаточно значимы

Даже усиленные элитки не всегда дают ощущение отдельного encounter. Главное — не только HP. Недостаточно понятно, **что именно они сейчас делают с миром**.

Текст order/adaptation исчезает слишком быстро.

### Требование

Пока Elite жива, должна существовать постоянная визуальная/UX причинность:

- aura/beam/link к affected mobs;
- рисунок formation/hazard;
- постоянный compact status возле Elite/на правой панели;
- редкость/тип adaptation различим цветом + формой, не только текстом;
- affected mobs получают visual marker;
- после смерти командный эффект очевидно исчезает.

Элитку можно сделать значительно сильнее обычного противника. Если из-за этого cadence надо снизить — это допустимый вопрос плейтеста.

## 11. Elite reward должен быть выше

Убийство Elite должно давать отдельный power spike, а не просто ускорять ещё один маленький level-up.

Приоритетные reward-категории:

- крупный Catalyst/operator;
- Catalyst evolution/upgrade;
- Mutation rewrite/targeted mutation;
- Phenomenon Ascension;
- крупный geometry roll;
- Law/Legendary Opportunity;
- recovery drop как часть encounter payoff.

## 12. Pickups почти не читаются

Healing и другие world entities должны быть видимы в хаосе. Одной маленькой текстуры недостаточно.

Возможные средства:

- pulse/outline;
- вертикальный beam;
- screen-edge indicator для редкого важного pickup;
- magnet trail;
- distinct sound;
- приоритет по размеру/контрасту.

## 13. Sustain должен быть частью билдов

До v0.8 лечение практически отсутствовало, а получение урона ощущалось необратимым. v0.8 добавил heal/barrier, но доступность/читаемость ещё нужно доказать.

Желательные разные routes:

- Barrier за control/overkill/close actions;
- projectile interception;
- temporary damage reduction/guard;
- healing pickup generation;
- state-consume healing;
- corpse/economy conversion;
- редкий heal-on-kill, но не универсальный lifesteal как обязательный stat.

## 14. Взаимодействия Phenomena/Catalysts визуально почти незаметны

Если `Conduit`, `Echo`, `Detonator`, `Backflow` реально срабатывают, игрок часто не может связать эффект со своей перестановкой.

### Требование

Interaction event должен иметь presentation metadata:

- source Phenomenon;
- Catalyst/operator;
- destination Phenomenon;
- result type;
- world positions/targets;
- compact VFX theme.

Renderer должен показывать короткую “нить причинности”, не создавая VFX soup.

## 15. Главный общий вывод

Текущий prototype уже достаточно богат, чтобы больше не обвинять недостаток контента. Проблема — **связность и эскалация**.

Следующий milestone успешен, если один и тот же стартовый набор при удачной вертикальной прокачке и другой Catalyst topology становится на глаз другой машиной и в несколько раз сильнее по effective clear, а не просто +30–50% к telemetry damage.


## 16. Feedback после v0.9A-R — world / threat / readability

Владелец проекта зафиксировал новый приоритетный набор проблем:

1. Карта ощущается бесконечной; нет смысла идти в конкретном направлении, мало позиционных решений. Нужны bounds, minimap, exploration value и связь с Elite.
2. От монстров слишком легко просто уходить.
3. Healing незаметен, survivability почти не давит; нужен хотя бы один явный финальный boss с паттернами.
4. Elite/adaptations отличаются недостаточно заметно; билд проходит почти без реакции на них и без перестройки Catalysts.
5. Общие статы выглядят выгоднее прокачки Phenomena.
6. Мало monster variety; projectiles желательно почти исключить, а роль «просто больше speed/power/defense» пересмотреть.
7. Catalyst usage всё ещё трудно понять визуально.
8. При уменьшении projectile clutter можно эскалировать сложность количеством/составом мобов.
9. Перед решениями нужен широкий game-design research, не копирование одного survivors-like.
10. Нужны HP bars и floating damage numbers.
11. HUD надо очистить от debug/stat noise; адаптации/affixes должны читаться поведением, моделью/shape и уведомлением. Непонятные декоративные угловые элементы убрать.
12. Активных Phenomena пока держать около 3–4; отдельно исследовать universal physical slots, где Phenomenon/Catalyst можно переставлять в одном ordered sequence.

v0.9B является первым ответом на этот feedback.
