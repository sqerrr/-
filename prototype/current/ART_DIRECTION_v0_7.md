# ART DIRECTION v0.7 — Black Archive visual pass

Эта версия сознательно не меняет баланс/simulation v0.6. Работа идёт только по presentation layer.

## Что интегрировано

- Более детализированные игровые образы героя, восьми обычных архетипов и восьми elite chassis в единой стилистике Black Archive.
- Elite chassis теперь имеют существенно разные силуэты, размеры и цветовые языки. Affix/adaptation по-прежнему добавляются поверх силуэта через tint/aura/VFX.
- Пол локации заменён на фактурный архивный камень/ковры/бумаги из world-space texture. Он движется вместе с камерой, а не является статичной картинкой экрана.
- Добавлен лёгкий foreground-diorama слой: стеллажи, свечи, ритуальные элементы и архивная архитектура по краям кадра. Он не участвует в collision/simulation.
- Герой получил визуальные idle/run/cast states. Это presentation-only анимация, состояние simulation не меняется.
- Phenomena получили более выраженную buildup/release/impact структуру. После мутации визуал становится крупнее/сложнее.
- Chain и Planner переключают иконку Skill на evolved/mutated artwork после выбора Mutation.

## Ограничение этого прохода

Сейчас один evolved visual используется для любого из пяти Mutations конкретного Skill. Следующий art pass может разделить визуал по веткам Mutation (например Ember Volley != Ember Furnace), не меняя механику.

## Производительность

World по-прежнему WebGL2. Новые персонажи остаются одним instanced sprite batch, ground — один fullscreen shader pass + texture sample. HTML foreground — один статический декоративный слой. Canvas2D не возвращён.
