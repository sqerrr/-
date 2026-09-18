# Спецификация метапрогрессии и реиграбельности v0.1

> Эта система намеренно **не требуется для первого боевого прототипа**, но её data model нужно предусмотреть заранее, чтобы поздняя прогрессия не заставила переделывать save-schema.

---

# 1. Цели

Прогрессия между ранами должна давать:

- чувство открытия и долгосрочные цели;
- контролируемое расширение пула контента;
- причины пробовать редко используемые механики;
- лестницу сложности, меняющую *правила*, а не только HP врагов;
- умеренный контроль над характером будущего рана без предварительной сборки точного решения;
- постоянную запись интересных interactions и встреч с элитками.

Она **не должна** превращать roguelite в grind, где ранние раны специально слабы из-за отсутствующих permanent stats.

Целевое постоянное сырое combat advantage после обычной прогрессии: **~10–15%**; если оно превышает 20%, требуется отдельный design review.

---

# 2. Слои меты

Профиль содержит четыре основные системы:

```text
ARCHIVE      — открывает контент
RESEARCH     — мягко меняет веса предложений / задаёт discovery goals
INSTABILITY  — лестница сложности и rule modifiers
RECORD       — codex, discoveries, achievements, run history
```

Опциональный AI Observer/contracts располагается поверх и не обязателен.

---

# 3. Archive — горизонтальная система unlocks

Archive открывает:

- Skills;
- Catalysts;
- варианты Mutations;
- Legendary Laws;
- characters;
- POIs;
- biome variants;
- Elite chassis/adaptation families;
- challenge modifiers.

Открытый контент добавляется в будущие eligible pools только при выполнении собственных prerequisites.

## 3.1 Философия unlocks

Хорошее условие:

> Consume `Tether` 100 раз за несколько ранов → открыть Skill, использующий Tether по-другому.

Плохое условие:

> Играть 14 часов → открыть случайный Skill.

Хорошие unlocks обучают системе или создают новую цель.

## 3.2 Без обязательного currency grind для основного контента

Общий Archive-resource допустим для pacing/QoL, но важный боевой контент обычно должен требовать **понятного feat/challenge**, а не только накопления ресурса.

Если валюта используется:

- зарабатывается обычной игрой;
- нет экспоненциальной лестницы цен;
- после демонстрации mastery не требуется повторный тривиальный farm.

---

# 4. Поэтапное раскрытие пула новичку

Не показывать весь каталог в первом ране.

Цель — обучать грамматике и при этом быстро показать необычность игры.

### Этап профиля 0 — первый ран

Eligible:

- ~7 Skills: 4 familiar, 2 hybrid, 1 unusual;
- ~6 Catalysts: в основном направленные и легко читаемые;
- ограниченный набор generic Elite affixes;
- 2 adaptation families;
- только базовые POI.

Если ран не закончился совсем рано, игрок обязан встретить хотя бы один non-classic Skill.

### Этап 1 — раны 2–3

Добавить:

- несколько state-based Skills;
- первый Skill, использующий world input (Corpse/Construct и т. п.);
- первый topology Catalyst;
- полный доступ к Mutations;
- больше Elite families.

### Этап 2 — раннее освоение

Добавить:

- spatial/echo/economy Skills;
- более сильные risk/reward POI;
- первые глобальные Legendary Laws за пределами topology Chain;
- Instability 1–2.

### Этап 3 — открытый каталог

Игрок получает широкий доступ, а прогрессия становится challenge/discovery-based, а не tutorial-gated.

Цель: опытный жанровый игрок приходит к широкому доступу примерно за **2–4 часа**, а не за 20.

---

# 5. Research Focus — мягкое управление будущим раном

До рана выбрать не более **1 major + 1 minor Research Focus**.

Примеры:

```text
Tether Research
Construct Research
Persistent Geometry Research
Elite Hunter Research
High Tempo Research
Corpse Systems Research
```

Research Focus меняет **относительный вес предложений**, а не membership пула.

Стартовый ориентир:

```text
major focus: +18% relative weight
minor focus: +10% relative weight
```

Это повышает шанс увидеть направление, но не гарантирует его.

По умолчанию запрещено:

- удалять 70% пула;
- фиксировать точные стартовые Skills;
- гарантировать нужную Mutation;
- заранее выбирать полный билд из шести Skills.

Такое допустимо только в специальных challenge/custom modes вне стандартной прогрессии.

---

# 6. Instability — лестница сложности

Каждый уровень Instability должен в первую очередь добавлять хотя бы одно **механическое** изменение, прежде чем значительно увеличивать числа.

Пример:

### Instability 0

Базовый спроектированный опыт.

### Instability 1

- дополнительная роль обычных врагов появляется раньше;
- +5% enemy HP.

### Instability 2

- Rare adaptive Elites могут появляться раньше;
- один новый POI hazard;
- +5% spawn budget.

### Instability 3

- элитки чаще могут иметь один generic + один adaptive affix;
- босс получает дополнительную механику.

### Instability 4

- первая Epic adaptation escalation начинается раньше;
- отдельные biome formations начинают реагировать на commands.

### Instability 5

- World Events / сложные версии POI;
- умеренное числовое усиление.

### Instability 6+

Продолжать наращивать комбинации/правила, а не бесконечно повторять `+20% HP`.

Награды:

- cosmetic/profile prestige;
- Archive challenge unlocks;
- доступ к опциональному редкому контенту;
- score/rank, если появится такая система.

Не делать главным смыслом высокой сложности «валюта в минуту».

---

# 7. Открытия взаимодействий

Codex фиксирует значимые **открытые reactions**, а не показывает все edges графа заранее.

При первом срабатывании именованной связки:

> `THERMAL SHOCK discovered`

Record хранит:

- source Skill/state;
- consuming Skill;
- первый run/date открытия;
- максимальную наблюдавшуюся magnitude, если уместно;
- связанные Mutations/Catalysts, открытые позже.

Так системная грамматика превращается в коллекционную ценность без сокрытия необходимых базовых правил.

Правила:

- базовые state-tooltips должны позволять рассуждать без codex;
- секретные авторские reactions могут быть скрыты до открытия;
- ни одна combat-essential формула не должна требовать fan wiki.

---

# 8. Открытие персонажей

Character открывается за демонстрацию стиля, связанного с его rule change.

Примеры:

- **Minimalist:** победить с <=4 active Skills.
- **Hunter:** убить заданное число Epic/Legendary adaptive Elites.
- **Pendulum:** завершить ран, активно используя reverse/echo topology.
- **Hoarder:** победить после значимого использования Reserve swaps, а не просто сбора предметов.

Characters должны менять правила/ограничения, а не быть очевидными permanent upgrades.

---

# 9. Permanent upgrade board

Если система появится, она должна быть маленькой и конечной.

Кандидаты:

```text
+5% max HP
+5% pickup range
+5% starting movement speed
+1 ordinary reroll (expensive capstone)
slightly faster Archive challenge progress
one extra codex tracking slot / QoL
```

Избегать permanent:

```text
+100% damage
+50% XP
+20% legendary chance
multiple mutation rerolls
```

Они навсегда схлопывают распределение силы ранов, которое ядро игры должно создавать заново каждый раз.

---

# 10. История ранов

Хранить минимум последние 20–50 summaries:

```text
seed
character
instability
end_time/result
final_chain
final_catalysts
mutations
laws
top damage skills
elite families encountered
legendary opportunities chosen
cause of death
major POIs
```

В player-facing UI можно показывать компактную «карточку билда».

Эти данные также подходят для optional AI Observer, не требуя передачи внешних приватных данных.

---

# 11. Daily/seeded challenges — поздний backlog

Полезно для реиграбельности после стабилизации базы:

- одинаковый seed/content offers для всех;
- fixed character или starting rule;
- leaderboard только если оправданы требования deterministic/anti-cheat;
- AI/MCP combat control по умолчанию выключен для competitive seeded modes.

Challenge modifiers должны раскрывать систему:

> Catalysts сильнее, но доступно только четыре Skill slots.

а не:

> враги имеют +300% HP.

---

# 12. Опциональные Observer contracts

Если будет AI integration, Observer может выбирать из **авторских** шаблонов unlock/challenge на основе истории ранов.

Пример:

> Последние раны слишком часто используют Fields. Contract: дойти до 12-й минуты без persistent Field Skill. Unlock: non-Field control Catalyst.

AI может персонализировать формулировку и выбрать валидный шаблон. Он не может придумывать reward values/content IDs.

Функционально эквивалентный deterministic non-AI contract generator обязателен.

---

# 13. Метрики реиграбельности

Отслеживать:

- unlock rate по часам/profile stage;
- процент открытых Skills, которые реально выбираются;
- контент, который после unlock никогда не берут;
- разнообразие финальных шестёрок;
- частоту точного повторения билдов;
- Mutation diversity по каждому Skill;
- использование Research Focus и его реальное влияние;
- completion rate Instability;
- долю ранов, законченных abandon против death/win;
- время до первого unusual interaction discovery.

Красные флаги:

- >40% игроков постоянно держат один Research Focus, потому что он строго лучше;
- новые unlocks снижают diversity из-за dilution, не добавляя связей;
- оптимальная прогрессия требует фармить низкую сложность;
- ранний профиль численно намного слабее зрелого;
- большая доля открытого контента постоянно избегается.

---

# 14. Приоритет backlog

### Архитектурно предусмотреть сейчас

- stable unlock IDs;
- profile versioning/migration;
- challenge-condition event hooks;
- run summary storage;
- Research Focus weight hooks;
- Instability modifier hooks.

### Реализовать после доказательства vertical-slice combat

- Archive UI;
- challenge unlock tree;
- codex interaction discovery;
- первые 3–5 уровней Instability.

### Позже / опционально

- daily seeded runs;
- AI Observer;
- extensive cosmetic progression;
- social/leaderboard systems.
