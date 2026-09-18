# Исследовательские ориентиры и дизайнерские выводы v0.2

> Цель: зафиксировать внешние игровые прецеденты, повлиявшие на спецификацию, включая то, что **не нужно копировать вслепую**.

## 1. Noita — комбинаторная грамматика

**Полезный прецедент**

- Упорядоченные spells/modifiers и trigger payloads создают огромное пространство взаимодействий из переиспользуемых частей.
- Порядок сильно важен: modifier меняет следующий контент, а не просто добавляет глобальный stat.
- «Количество контента» можно умножать грамматикой, а не brute-force производством сотен уникальных оружий.

**Предупреждение для проекта**

- Та же глубина легко становится syntax-heavy и зависимой от гайдов.
- Chain обязана визуально объяснять причинность, а foundational vocabulary должен быть небольшим.
- Поэтому используем шесть фиксированных Skill-beats, пять явных Catalyst-edges и ограниченный словарь states вместо произвольных вложенных spell-blocks.

Reference: https://noita.wiki.gg/wiki/Guide%3A_Wand_Mechanics

## 2. Megabonk — случайный рост конкретного оружия

**Полезный прецедент**

- У оружий собственные stat-upgrade pools.
- Качество улучшения зависит от rarity, поэтому одно оружие может развиться по-разному без talent-tree UI.
- Luck/rarity создаёт эмоциональные high-rolls при простых обычных уровнях.

**Что берём**

- skill-specific random roll pools;
- rarity меняет magnitude/quality ролла;
- milestones могут давать крупные behavioural changes, обычные levels остаются быстрыми выборами.

**Что меняем**

- Mutation намного более структурная, чем очередной stat roll;
- Chain/Catalyst order делает улучшение ценным из-за отношений, а не только чисел;
- late Legendary reward должна улучшать уже готовый билд, а не только добавлять предмет.

References:
- https://megabonk.wiki/wiki/Weapons
- https://megabonk.wiki/wiki/Charge_Shrine
- https://megabonk.wiki/wiki/Tomes

## 3. Brotato — ограниченная толпа и biased RNG

**Полезный прецедент**

- Shop смещает часть роллов к уже имеющимся weapons/classes, не гарантируя нужный результат.
- Horde-game может работать при сравнительно низком simultaneous-enemy cap; ощущение давления зависит от размера арены, replacement rate и role composition.

**Что берём**

- build-aware weighting вместо полной детерминированности;
- связный билд встречается чаще, но bad/good-run variance сохраняется;
- enemy count — readability budget, а не prestige number.

**Что меняем**

- continuous map вместо дискретных shop waves;
- exploration/POIs дают targeted control над RNG.

References:
- https://brotato.wiki.spellsandguns.com/Shop
- https://brotato.wiki.spellsandguns.com/Enemies

## 4. Risk of Rain 2 — Directors, proc coefficients, функции стакинга

**Полезный прецедент**

- Combat Directors расходуют credits на монстров вместо только ручных wave tables.
- Разные item-effects используют разные stacking functions; hyperbolic stacking не даёт defensive percentages прийти к тривиальному иммунитету.
- Proc coefficients мешают быстрым multi-hit атакам автоматически доминировать во всех on-hit системах.

**Что берём**

- credit-based spawn budget;
- разные формулы для linear stats и bounded defensive stats;
- per-Skill proc coefficient;
- явные simulation budgets для proc chains.

References:
- https://riskofrain2.wiki.gg/wiki/Directors
- https://riskofrain2.wiki.gg/wiki/Item_Stacking
- https://riskofrain2.wiki.gg/wiki/Proc_Coefficient

## 5. Last Epoch — skill-specific effectiveness

**Полезный прецедент**

- Added-damage effectiveness задаётся на Skill и позволяет медленным тяжёлым и быстрым атакам делить одну экосистему added damage без злоупотреблений.

**Что берём**

- если появится flat added-damage, он использует Skill-specific coefficient;
- дискретные stats вроде projectile count тоже имеют Skill-specific rarity/value.

References:
- https://support.lastepoch.com/hc/en-us/articles/46361870761883-Damage-Effectiveness
- https://support.lastepoch.com/hc/en-us/articles/46361875625115-Base-Damage

## 6. Path of Exile — ясность additive vs multiplicative

**Полезный прецедент**

- Разделение additive `increased` и multiplicative `more` делает scaling системно понятным.

**Предупреждение**

- Большие ARPG накапливают много независимых buckets и conditional modifiers, превращая расчёт в калькулятор.

**Что берём**

- один общий additive Power bucket;
- один общий conditional Amplification bucket;
- только редкие Legendary Laws получают реальные независимые final multipliers.

Reference: https://www.poewiki.net/wiki/Damage

## 7. Balatro — понятная арифметика и редкие множители

**Полезный прецедент**

- Небольшое арифметическое ядро становится захватывающим, когда редкие эффекты его умножают или меняют порядок применения.
- Activation order может быть стратегически важен без десятков типов статов.

**Что берём**

- обычная математика должна объясняться tooltip'ом;
- настоящие multiplicative «вау»-эффекты резервируются для очевидных Laws/major effects.

References:
- https://balatrogame.fandom.com/wiki/Mult
- https://balatrogame.fandom.com/wiki/Guide%3A_Activation_Sequence

## 8. Hades — build-aware редкие награды

**Полезный прецедент**

- Eligibility Duo/Legendary Boons зависит от уже имеющихся prerequisites.

**Что берём**

- Legendary Law pools могут использовать prerequisites, повышая релевантность high-rarity reward;
- eligibility не означает guarantee: игрок по-прежнему получает случайный поднабор валидных вариантов.

Reference: https://hades.fandom.com/wiki/Boons

## 9. Backpack Battles — активная топология против storage

**Полезный прецедент**

- Adjacency/spatial relationships создают глубину.
- Storage явно неактивен: «несу с собой» не означает «тайно работает».

**Что берём**

- Active Chain и Reserve визуально разделены;
- drag-and-drop — основной язык менеджмента;
- adjacency должна оцениваться прямо на board.

Reference: https://backpackbattles.wiki.gg/wiki/Game_Mechanics

## 10. Halls of Torment — сложность мира по нескольким осям

**Полезный прецедент**

- Torment повышает несколько параметров мира и давление champions, а не просто damage.

**Что берём**

- world growth разделяет HP, damage, spawn pressure и composition/adaptation complexity;
- difficulty ladder добавляет mechanics и affix combinations вместе с числами.

Reference: https://hot.fandom.com/wiki/Torment

## 11. Deep Rock Galactic: Survivor — производительность и читаемость

**Полезный прецедент**

- Большая орда мотивирует data-oriented optimization.
- Команда экспериментировала с ECS/data-oriented rewrite и получила очень высокую synthetic performance, но полный rewrite оказался настолько дорогим, что был отложен; incremental optimization всё равно имела смысл.
- Enemy projectile visibility при сотнях врагов иногда требует намеренно агрессивных цветов/эффектов.

**Что берём**

- data-driven combat/events с начала;
- spatial queries, pooling, compact enemy state;
- без преждевременного требования «переписать всё в ECS»;
- telegraph опасности важнее тематической чистоты цвета.

Reference: https://steamdb.info/patchnotes/17967150/

## 12. Soulstone Survivors — предупреждение о числе эффектов и late-game stagnation

**Полезный прецедент / предупреждение**

- Очень высокий attack/effect rate создаёт огромную simulation/VFX стоимость.
- Даже невидимые эффекты остаются дорогими, если полностью симулируются.
- Endgame, полностью залитый атаками, может схлопнуть build diversity в постоянное уклонение или пассивную стагнацию.

**Что берём**

- явные budgets на projectiles, persistent world objects и generated events;
- cosmetic VFX controls по возможности должны реально экономить simulation/render work;
- рост сложности должен добавлять tactical composition, а не только overlapping danger circles.

## 13. Vampire Survivors — якорь доступности

**Полезный прецедент**

- Малый лимит активных weapons, автоматические атаки и простые level-up choices делают жанр читаемым.

**Что берём**

- шесть active Skill slots — знакомый cognitive budget;
- новизна идёт из упорядоченного взаимодействия, а не драматического увеличения slots.

## 14. Dead Cells / Risk of Rain 2 — горизонтальная долгосрочная прогрессия

**Полезный прецедент**

- Новые blueprints/items/characters/challenges добавляют разнообразие между ранами без огромных permanent multipliers.

**Что берём**

- Archive открывает контент и difficulty rules;
- permanent raw power намеренно умеренный.

## 15. Прецеденты squad AI

### Days Gone / тактическая координация группы

Видимый высокоуровневый coordinator создаёт групповое поведение, пока отдельные агенты используют дешёвую local logic.

### F.E.A.R. / GOAP

Авторские goals/actions создают убедительную tactical variety без generative model, придумывающей механику.

**Что берём**

- Elite commander выбирает авторский Order;
- normal mobs исполняют его детерминированно локальной логикой;
- optional LLM/MCP выбирает только из валидных Orders.

References:
- https://www.gdcvault.com/play/1027066/AI-Summit-Squad-Coordination-in
- https://www.gamedeveloper.com/design/building-the-ai-of-f-e-a-r-with-goal-oriented-action-planning

## 16. Направление MCP 2026

Текущий MCP здесь наиболее полезен как безопасный мост state/actions для внешних tools/agents, а не как обязательный транспорт inference самой игры.

**Следствие для дизайна**

- давать компактные валидированные tactical resources;
- выставлять небольшой whitelist actions;
- сохранять deterministic fallback;
- никогда не давать модели raw authority над stats/spawns/rewards.

Reference: https://blog.modelcontextprotocol.io/posts/2026-07-28/

---

# Межигровые выводы

## A. Глубина должна идти из грамматики, а не из 300 несвязанных Skills

Сначала десятки сильно взаимодействующих Skills/Catalysts, а не сотни независимых.

## B. Случайности нужен слой управления, а не суверенитет бесконечного reroll

Build-aware weighting + ограниченные rerolls + рискованные targeted POI лучше, чем «форсировать точный билд каждый ран».

## C. Математика должна быть проще графа взаимодействий

Игрок и так рассуждает о порядке, targeting, geometry и states; ему не нужен spreadsheet для семи multiplicative buckets.

## D. Размер орды должен служить читаемости

Проект хочет частых важных Elites и различимые роли обычных мобов, поэтому maximum enemy count не является маркетинговым KPI.

## E. Legendary-контент должен менять правила и вне Chain

Нужны Laws мира, врагов, экономики, карты, survival, времени и тела, иначе каждая интересная награда станет ещё одним modifier секвенсора.

## F. AI наиболее убедителен, когда имеет видимый внутриигровой источник

Командный интеллект, привязанный к элитке, воспринимается понятнее и честнее, чем невидимый всезнающий world counterplay.


## 17. Поправка после ручного плейтеста v0.8 — progression/reward assembly

### Megabonk: не только random rolls, но geometry/count scaling

В старом выводе мы переоценили сам факт skill-specific random pool и недооценили **масштабируемые оси**: Size напрямую увеличивает размер атак/AoE, Quantity добавляет attack/projectile instances, а конкретные weapons имеют разные доступные axes. Именно сочетание damage/speed/size/count создаёт заметный snowball.

Дополнительные references:

- https://megabonk.wiki/wiki/Stats
- https://megabonk.wiki/wiki/Size_Tome
- https://megabonk.wiki/wiki/Quantity_Tome

**Коррекция для проекта:** `+4% + small roll` недостаточно. Geometry/count breakpoints становятся обязательным экспериментом.

### Noita: scope/payload важнее процента

Trigger-механика показывает, что modifier может задавать **где и когда исполняется payload**, а не только усиливать соседний spell. Это лучше соответствует желаемой роли Catalyst.

Дополнительные references:

- https://noita.wiki.gg/wiki/Trigger
- https://noita.wiki.gg/wiki/Add_Trigger
- https://noita.wiki.gg/wiki/Expert_Guide:_Draw

### 20 Minutes Till Dawn: деревья, conditional synergies и отдельные Elite rewards

Upgrade trees последовательно сужают развитие после первого выбора; Synergies появляются только после prerequisites; character upgrades выпадают из Elite chests, а не смешиваются с каждым обычным level-up.

References:

- https://20minutestilldawn.wiki.gg/wiki/Upgrades
- https://20minutestilldawn.wiki.gg/wiki/Synergies
- https://20minutestilldawn.wiki.gg/wiki/Character_Upgrades

**Коррекция:** build coherence можно создавать не только weighting'ом, но и **структурой eligibility/reward channels**.

### Brotato: важнее оказалось разделение level-up и shop

Ранний документ делал акцент на same-weapon/class bias. После v0.8 ещё важнее другой принцип: level-up stat choices и acquisition оружия/items находятся в разных каналах. Это уменьшает конкуренцию разнотипных решений в одном окне.

**Коррекция:** следующий prototype должен сравнить раздельные reward domains, а не просто сильнее bias'ить нынешний единый pool.

Подробный redesign research: корневой `05_CORE_REDIRECT_RESEARCH.md`.
