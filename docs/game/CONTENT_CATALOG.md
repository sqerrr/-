# Каталог контента v0.2 (design sandbox)

> Каталог стадии дизайна. Все числа — стартовые точки калибровки, а не обещание финального баланса. Названия рабочие; code ID считаются стабильными кандидатами.

## Правило состава контента

Стартовый пул не должен делать каждый Skill экзотическим. v0.1 намеренно смешивает понятные якоря, гибриды и странные элементы, чтобы новизна имела контраст.

Текущая смесь из 24 Skills: **10 classic / 4 hybrid / 10 unusual**.

## Системные states

`mark`, `ignite`, `chill`, `wound`, `toxin`, `embed`, `tether`, `charge`, `stored`, `field`, `displaced`, `corpse`, `echo`, `construct`, `exposed`, `compressed`.

States — системный словарь взаимодействий. Именованные reactions обычно должны быть понятными названиями поверх этих общих правил, а не скрытыми одноразовыми исключениями.

## Активные Skills

> Для всех Mutations действует v0.2 acceptance: крупная Mutation обязана заметно менять geometry/time/role/positioning на экране. Если изменение читается только как `+N%`, это roll/breakpoint, а не полноценная Mutation.


### Ember Lance (`ember_lance`)

- **Тип:** classic; **роли:** focus, clear; **доставка:** projectile, line.
- **Targeting/timing:** nearest / instant; **proc:** 1.0; **сложность:** 1/4.
- **States:** создаёт `ignite`, `mark`; потребляет `chill`.
- **Пул улучшений:** power, projectile_speed, projectile_count, status_potency, crit.
- **Direct-output anchor:** 1.00.
- **Мутации — показывать 2 из 5:**
  - **Volley** · *clear* — выпускает 3 более узких копья, каждое наносит 55% базового урона; будущие роллы сильнее смещены к Projectile Count и Speed.
  - **Brand** · *bridge* — попадание оставляет Brand; следующий **другой** Skill, потребивший Brand, получает +35% Amplification.
  - **Furnace** · *convert* — снаряд становится медленнее и крупнее, оставляет короткий горящий след; будущие роллы смещаются к Coverage/Duration.
  - **Impaler** · *focus* — Count фиксируется на 1; сильный Pierce и +70% damage по первой задетой Elite.
  - **Backdraft** · *control* — убийство сначала слегка стягивает врагов, затем происходит огненный burst; ниже direct power, выше grouping.

### Chain Arc (`chain_arc`)

- **Тип:** classic; **роль:** clear; **доставка:** projectile, chain.
- **Targeting/timing:** nearest_cluster / instant; **proc:** 0.55; **сложность:** 2/4.
- **States:** создаёт `charge`; потребляет `embed`.
- **Пул улучшений:** power, targets, range, status_potency, crit.
- **Anchor:** 0.95.
- **Мутации:**
  - **Forked Grid** · *clear* — больше прыжков, каждый следующий теряет 18% силы; роллы сильнее смещены к Targets.
  - **Capacitive Arc** · *bridge* — неиспользованные jumps превращаются в Charge; следующий Pulse/Area Skill может потребить Charge ради Amplification.
  - **Ground Wire** · *focus* — Embedded/Tethered цели становятся приоритетными relay и получают +45% урона дуги.
  - **Arc Cage** · *convert* — при повторном входе в уже поражённый cluster создаёт короткий electric Field вместо очередного jump.
  - **Static Relay** · *construct* — Constructs могут быть relay-точками; каждый relay увеличивает range, но снижает последующий damage.

### Cleaver (`cleaver`)

- **Тип:** classic; **роли:** clear, close; **доставка:** sweep, contact.
- **Targeting/timing:** self_front / instant; **proc:** 1.0; **сложность:** 1/4.
- **States:** создаёт `wound`; потребляет `exposed`, `tether`.
- **Пул:** power, coverage, control, crit, status_potency.
- **Anchor:** 1.05.
- **Мутации:**
  - **Guillotine** · *focus* — резко усиливает удары по целям ниже 25% HP; sweep уже.
  - **Roundhouse** · *clear* — превращается в 360° sweep с меньшим damage на цель.
  - **Hooked Edge** · *control* — Wounded/Tethered враги перед ударом подтягиваются к центру взмаха.
  - **Butcher Rhythm** · *tempo* — убийства накапливают Repeat Chance следующей активации; промах сбрасывает stacks.
  - **Deep Cut** · *bridge* — меньше direct damage, гораздо сильнее Wound, рассчитанный на потребление последующими Skills.

### Frost Ring (`frost_ring`)

- **Тип:** classic; **роли:** control, clear; **доставка:** pulse, area.
- **Targeting/timing:** self_area / instant; **proc:** 0.45; **сложность:** 1/4.
- **States:** создаёт `chill`, `field`; потребляет `compressed`.
- **Пул:** coverage, status_potency, duration, power, control.
- **Anchor:** 0.65.
- **Мутации:**
  - **Snap Freeze** · *burst* — повторный Chill по той же цели вызывает shatter-burst и очищает Chill.
  - **Rim Ice** · *geometry* — основная сила переносится на внешний край: центр слабее, boundary damage ×2.
  - **Cold Front** · *convert* — вместо мгновенного pulse кольцо медленно расширяется как persistent Field.
  - **Crystal Skin** · *defense* — убийство сильно Chilled врага даёт небольшой barrier с internal cooldown.
  - **Brittle** · *bridge* — Chilled цель становится Exposed для следующего Strike/Line Skill, после чего Chill потребляется.

### Orbit Blades (`orbit_blades`)

- **Тип:** classic; **роли:** clear, defense; **доставка:** orbit, contact.
- **Targeting/timing:** self_orbit / persistent; **proc:** 0.35; **сложность:** 2/4.
- **States:** создаёт и может потреблять `wound`.
- **Пул:** power, count, coverage, tempo_local, crit.
- **Anchor:** 0.90.
- **Мутации:**
  - **Many Knives** · *clear* — больше blades, меньше power каждого; роллы предпочитают Coverage и count.
  - **Saw Crown** · *focus* — меньше, крупнее и ближе к игроку; многократно режут nearby Elites.
  - **Outbound Cut** · *convert* — при активации blades разлетаются наружу и возвращаются, затем снова вращаются.
  - **Guard Ring** · *defense* — ниже damage, зато blades могут перехватывать enemy projectiles.
  - **Blood Orbit** · *scaling* — каждый Wounded враг рядом временно ускоряет вращение до cap.

### Mortar Bloom (`mortar_bloom`)

- **Тип:** classic; **роли:** clear, burst; **доставка:** projectile, delayed, area.
- **Targeting/timing:** largest_cluster / delayed; **proc:** 1.0; **сложность:** 2/4.
- **States:** создаёт `field`; потребляет `mark`, `compressed`.
- **Пул:** power, coverage, count, delay_efficiency, crit.
- **Anchor:** 1.15.
- **Мутации:**
  - **Cluster Bloom** · *clear* — основной shell после попадания распадается на малые bomblets.
  - **Long Fuse** · *risk* — удар позже, зато damage и Coverage растут вместе с задержкой.
  - **Spotter** · *focus* — предпочитает Marked Elites и быстрее падает на Marked targets.
  - **Crater** · *control* — после попадания остаётся slowing Field, доступный другим Field-interactions.
  - **Airburst** · *convert* — мгновенный взрыв над целью: шире coverage, нет ground Field, слабее центр.

### Sentry (`sentry`)

- **Тип:** classic; **роли:** focus, construct; **доставка:** construct, projectile.
- **Targeting/timing:** construct_auto / persistent; **proc:** 0.45; **сложность:** 2/4.
- **States:** создаёт `construct`, `mark`; потребляет `charge`.
- **Пул:** power, tempo_local, targets, projectile_speed, construct_duration.
- **Anchor:** 0.80.
- **Мутации:**
  - **Gatling Rig** · *tempo* — множество low-proc shots; роллы предпочитают fire rate и target switching.
  - **Rail Rig** · *focus* — медленные piercing shots с высоким Effect Coefficient и Elite priority.
  - **Relay Tower** · *bridge* — становится relay-точкой для Chain/Beam и наследует Mark targeting.
  - **Crawler** · *convert* — мобильный drone, следующий за игроком; ниже damage, лучше uptime.
  - **Salvager** · *economy* — Elite kills с участием Sentry дают дополнительный Elite-Core progress; base damage ниже.

### Toxic Mist (`toxic_mist`)

- **Тип:** classic; **роли:** clear, dot, control; **доставка:** field, area.
- **Targeting/timing:** self_area / persistent; **proc:** 0.2; **сложность:** 2/4.
- **States:** создаёт `toxin`, `field`; потребляет `wound`.
- **Пул:** power, duration, coverage, status_potency, tick_rate.
- **Anchor:** 0.75.
- **Мутации:**
  - **Corrosive** · *support* — Toxin сильнее снижает Armor вместо собственного damage scaling.
  - **Contagion** · *clear* — смерть сильно Toxined врага передаёт часть stacks соседям.
  - **Distilled** · *focus* — Field намного меньше, зато potency и application rate резко выше.
  - **Plume** · *convert* — туман остаётся trail позади движения игрока.
  - **Reactive Solvent** · *bridge* — потребляет Wound или Ignite ради burst и refresh Duration Toxin.

### Rail Spear (`rail_spear`)

- **Тип:** classic; **роли:** focus, line; **доставка:** projectile, line, pierce.
- **Targeting/timing:** nearest_elite_bias / instant; **proc:** 1.0; **сложность:** 1/4.
- **States:** создаёт `embed`, `exposed`; потребляет `mark`.
- **Пул:** power, pierce, projectile_speed, crit, elite_damage.
- **Anchor:** 1.10.
- **Мутации:**
  - **Impaler Rack** · *setup* — Spear оставляет дополнительные Embeds; direct damage ниже.
  - **Railgun** · *focus* — один огромный shot каждые 2 cycles с очень высоким Effect Coefficient и Pierce.
  - **Fan Spear** · *clear* — три копья под небольшим углом; каждое слабее и имеет меньше Pierce.
  - **Harpoon** · *control* — первая крупная цель слегка подтягивается к игроку.
  - **Spot Lance** · *bridge* — Marked цели приоритетны и становятся Exposed после пробития.

### Repulse Halo (`repulse_halo`)

- **Тип:** classic; **роли:** control, defense; **доставка:** pulse, area.
- **Targeting/timing:** self_area / instant; **proc:** 0.3; **сложность:** 1/4.
- **States:** создаёт `displaced`; потребляет `charge`.
- **Пул:** control, coverage, power, barrier, status_potency.
- **Anchor:** 0.50.
- **Мутации:**
  - **Gravity Halo** · *control* — Push превращается в Pull; damage ниже, grouping выше.
  - **Shock Front** · *burst* — намного сильнее damage на границе pulse, но слабее displacement.
  - **Aegis Pulse** · *defense* — за каждого displaced врага даёт короткий barrier до cap за активацию.
  - **Kinetic Relay** · *bridge* — величина displacement генерирует Charge следующему Skill.
  - **Compression Rings** · *convert* — два меньших чередующихся кольца вместо одного полного halo.

### Stitching Needle (`stitching_needle`)

- **Тип:** hybrid; **роли:** setup, control; **доставка:** projectile, tether.
- **Targeting/timing:** nearest_then_spread / persistent_state; **proc:** 0.65; **сложность:** 3/4.
- **States:** создаёт `embed`, `tether`; потребляет `mark`.
- **Пул:** targets, duration, power, projectile_speed, tether_potency.
- **Anchor:** 0.55.
- **Мутации:**
  - **Network** · *setup* — иглы формируют multi-target Tether network; damage одной связи ниже.
  - **Snapline** · *movement* — Tethers накапливают tension от относительного движения и рвутся при threshold.
  - **Suture** · *defense* — разрыв Tether даёт barrier/healing вместо большей части rupture damage.
  - **Puppet Stitch** · *control* — связанные враги постепенно тянут друг друга.
  - **Hemline** · *convert* — сами Tethers становятся тонкими damaging boundaries.

### Debt Orb (`debt_orb`)

- **Тип:** unusual; **роли:** burst, store; **доставка:** orbit, store.
- **Targeting/timing:** self_orbit / stored; **proc:** 0.0; **сложность:** 3/4.
- **States:** создаёт `stored`; потребляет `wound`, `ignite`, `toxin`.
- **Пул:** capacity, release_power, orbit_speed, duration, store_rate.
- **Anchor:** 0.45.
- **Мутации:**
  - **Usury** · *scaling* — Stored damage растёт пока хранится, но Orb медленнее выводит накопленное.
  - **Default** · *burst* — автоматически cash-out на cap большим burst; без переноса остатка.
  - **Redistribution** · *clear* — cash-out делит Stored damage между Marked targets вместо одной цели.
  - **Mortgage** · *risk* — «занимает» часть base damage следующего Skill сейчас, затем ослабляет его следующую активацию.
  - **Insurance** · *pivot* — хранит часть damage, полученного игроком, вместо нанесённого.

### False Moon (`false_moon`)

- **Тип:** unusual; **роли:** control, clear; **доставка:** orbit, area.
- **Targeting/timing:** self_orbit / persistent; **proc:** 0.3; **сложность:** 3/4.
- **States:** создаёт `compressed`, `field`; потребляет `charge`.
- **Пул:** control, coverage, orbit_speed, power, mass.
- **Anchor:** 0.55.
- **Мутации:**
  - **Eclipse** · *defense* — поглощает ограниченное число enemy projectiles; absorbed mass усиливает следующее collision.
  - **Tidal** · *movement* — Pull зависит от скорости движения игрока и смены направления.
  - **Roche Limit** · *clear* — при столкновении с Elite временно раскалывается на малые луны.
  - **Fixed Orbit** · *convert* — постоянный orbiting Construct: слабее pull, зато постоянное присутствие.
  - **Slingshot** · *burst* — периодически выбрасывает собранных minor enemies наружу как damaging projectiles.

### Recorder (`recorder`)

- **Тип:** unusual; **роли:** repeat, support; **доставка:** echo, delayed.
- **Targeting/timing:** previous_skill / delayed; **proc:** 0.0; **сложность:** 3/4.
- **States:** создаёт `echo`; ничего базово не потребляет.
- **Пул:** replay_power, delay_efficiency, duration, repeat_chance, compatibility.
- **Anchor:** 0.25.
- **Мутации:**
  - **Loop** · *repeat* — повторяет записанную активацию дважды с затухающей силой.
  - **Reverse** · *geometry* — воспроизводит из зеркального origin/direction, если geometry допускает.
  - **Sample State** · *bridge* — записывает produced states вместо geometry и повторно накладывает их.
  - **Overdub** · *combo* — записывает два предыдущих совместимых Skills с уменьшенной силой.
  - **Mute Track** · *support* — replay damage исчезает; вместо этого следующая естественная активация записанного Skill получает Amplification.

### Pressure Membrane (`pressure_membrane`)

- **Тип:** unusual; **роли:** control, burst; **доставка:** area, pulse, boundary.
- **Targeting/timing:** self_area / delayed_pulse; **proc:** 0.4; **сложность:** 3/4.
- **States:** создаёт `field`, `displaced`; потребляет `compressed`.
- **Пул:** coverage, control, power, duration, boundary_potency.
- **Anchor:** 0.65.
- **Мутации:**
  - **Vacuum Skin** · *control* — расширение Pull, схлопывание Push.
  - **Barrier Skin** · *defense* — enemy projectiles извне наносят меньше damage через membrane; own damage ниже.
  - **Resonance** · *scaling* — каждый враг, пересёкший boundary, усиливает collapse damage до cap.
  - **Oscillation** · *clear* — несколько inward/outward pulses с меньшим damage.
  - **Rupture** · *burst* — при достаточном числе врагов внутри немедленно рвётся с сильным damage и уничтожает Field.

### Afterimage (`afterimage`)

- **Тип:** unusual; **роли:** movement, clear; **доставка:** movement, echo, trail.
- **Targeting/timing:** player_path / delayed_trail; **proc:** 0.25; **сложность:** 3/4.
- **States:** создаёт `echo`.
- **Пул:** duration, power, trail_width, movement_scaling, repeat_chance.
- **Anchor:** 0.70.
- **Мутации:**
  - **Long Exposure** · *clear* — trail живёт дольше и может перекрываться сам с собой; damage сегмента ниже.
  - **Cutback** · *skill* — резкая смена направления мгновенно триггерит недавние trail segments.
  - **Echo Step** · *bridge* — Afterimage кастует слабую копию предыдущего Skill из старой позиции игрока.
  - **Mirror Runner** · *convert* — второй ghost зеркально движется вокруг игрока; power каждого ghost делится пополам.
  - **Momentum** · *scaling* — damage растёт с дистанцией, пройденной с предыдущей активации, до cap.

### Seed Mine (`seed_mine`)

- **Тип:** unusual; **роли:** construct, clear; **доставка:** construct, delayed.
- **Targeting/timing:** ground_or_corpse / delayed_construct; **proc:** 0.35; **сложность:** 3/4.
- **States:** создаёт `construct`; потребляет `corpse`.
- **Пул:** count, growth_speed, power, duration, trigger_radius.
- **Anchor:** 0.75.
- **Мутации:**
  - **Carrion Garden** · *scaling* — seeds на Corpses растут быстрее/сильнее; ground-planted seeds слабее.
  - **Pollination** · *bridge* — player projectiles, прошедшие через растение, один раз разделяются с уменьшенным proc coefficient.
  - **Perennial** · *construct* — растения живут до population cap, но каждое слабее.
  - **Thorn Trap** · *control* — растения Root'ят nearby minor enemies вместо максимального damage.
  - **Harvest** · *economy* — зрелое растение при окончании жизни выдаёт bonus XP; direct damage ниже.

### Iron Rain (`iron_rain`)

- **Тип:** hybrid; **роли:** setup, burst; **доставка:** projectile, area.
- **Targeting/timing:** cluster / instant_state; **proc:** 0.55; **сложность:** 2/4.
- **States:** создаёт `embed`; потребляет `compressed`.
- **Пул:** count, embed_cap, power, coverage, projectile_speed.
- **Anchor:** 0.85.
- **Мутации:**
  - **Magnetic Recall** · *burst* — все Embeds возвращаются к игроку, нанося damage вдоль обратных траекторий.
  - **Pinning** · *control* — достаточное число Embeds на одной цели ненадолго Root'ит её; Elites требуют больше.
  - **Conduction** · *bridge* — Embedded targets становятся high-priority relay для Chain Arc.
  - **Quiver** · *focus* — следующий projectile Skill потребляет Embeds цели ради bonus damage.
  - **Shrapnel Garden** · *clear* — враг, умерший с Embeds, разбрасывает low-proc fragments по соседям.

### Fold (`fold`)

- **Тип:** unusual; **роли:** support, space; **доставка:** space, echo.
- **Targeting/timing:** world_space / support; **proc:** 0.0; **сложность:** 4/4.
- **States:** создаёт `echo`; потребляет `field`, `construct`.
- **Пул:** copy_power, range, duration, coverage, repeat_chance.
- **Anchor:** 0.20.
- **Мутации:**
  - **Mirror Field** · *space* — следующий Field справа копируется в зеркальную позицию с меньшей силой.
  - **Double Origin** · *space* — следующий Projectile Skill исходит одновременно из игрока и Fold anchor.
  - **Crease** · *control* — ненадолго сближает две отмеченные ground regions, стягивая врагов к шву.
  - **Pocket** · *utility* — сохраняет один временный Construct/Field и разворачивает его в следующем cycle.
  - **Tear** · *damage* — создаёт damaging line между исходной и folded positions.

### Boundary Saw (`boundary_saw`)

- **Тип:** unusual; **роли:** clear, payoff; **доставка:** boundary, contact.
- **Targeting/timing:** field_boundary / persistent; **proc:** 0.3; **сложность:** 3/4.
- **States:** создаёт `wound`; потребляет `field`.
- **Пул:** power, boundary_width, duration, crit, status_potency.
- **Anchor:** 0.70.
- **Мутации:**
  - **Double Edge** · *clear* — наносит damage и чуть внутри, и чуть снаружи boundary Field.
  - **Serrated** · *dot* — повторные boundary hits сильно стакают Wound.
  - **Moving Fence** · *convert* — прикрепляется к newest Field и движется вместе с ним, если возможно.
  - **Closed Circuit** · *burst* — closed-loop Fields получают мощный periodic burst; open/trail Fields — нет.
  - **Reaper Edge** · *economy* — kills точно на boundary дают небольшой XP bonus с cap за активацию.

### Mass Driver (`mass_driver`)

- **Тип:** hybrid; **роли:** burst, line, control; **доставка:** projectile, line, charge.
- **Targeting/timing:** line_cluster / instant; **proc:** 1.0; **сложность:** 2/4.
- **States:** создаёт `displaced`, `exposed`; потребляет `stored`, `embed`.
- **Пул:** power, pierce, control, projectile_speed, capacity.
- **Anchor:** 1.15.
- **Мутации:**
  - **Rail Mass** · *focus* — более медленный и узкий shot с огромным damage и Pierce.
  - **Snowball** · *scaling* — набирает mass/damage за каждого minor enemy, задетого в одном запуске.
  - **Recoil** · *risk* — сильный damage boost, но активация отбрасывает самого игрока.
  - **Cargo** · *combo* — может запустить nearby Construct/Corpse; payload определяет effect impact.
  - **Terminal Velocity** · *bridge* — потребляет Stored damage/Charge ради speed и damage вместо плоского бонуса.

### Choir (`choir`)

- **Тип:** unusual; **роли:** repeat, clear; **доставка:** pulse, echo, construct.
- **Targeting/timing:** self_area / pattern; **proc:** 0.25; **сложность:** 3/4.
- **States:** создаёт `echo`, `charge`; потребляет `echo`.
- **Пул:** power, pulse_count, coverage, resonance, repeat_chance.
- **Anchor:** 0.60.
- **Мутации:**
  - **Harmony** · *pattern* — повтор одного delivery tag в соседних Skills увеличивает число Choir pulses.
  - **Dissonance** · *pattern* — наоборот, разные delivery tags соседей увеличивают pulses.
  - **Canon** · *repeat* — планирует слабый delayed replay предыдущего Skill.
  - **Crescendo** · *scaling* — каждый завершённый chain cycle усиливает Choir, пока игрок не получает hit.
  - **Silence** · *support* — Choir перестаёт наносить damage и раз за cycle сильно Amplify следующий Skill.

### Glass Harrow (`glass_harrow`)

- **Тип:** hybrid; **роли:** clear, return; **доставка:** projectile, return, line.
- **Targeting/timing:** directional / return; **proc:** 0.7; **сложность:** 2/4.
- **States:** создаёт `wound`; потребляет `displaced`.
- **Пул:** power, coverage, projectile_speed, return_power, crit.
- **Anchor:** 0.90.
- **Мутации:**
  - **Boomerang** · *return* — outbound и return passes оба наносят полный damage; движение медленнее.
  - **Shatter** · *burst* — после достаточного числа collisions Harrow взрывается fragments и должен реформироваться к следующему cycle.
  - **Pane** · *control* — широкая движущаяся стена, толкающая minor enemies ценой меньшего damage.
  - **Mirror Cut** · *defense* — на обратном проходе отражает ограниченное число enemy projectiles.
  - **Razor Track** · *field* — оставляет короткоживущую режущую линию вдоль траектории.

### Vacuum Bloom (`vacuum_bloom`)

- **Тип:** unusual; **роли:** economy, burst, control; **доставка:** area, store, pickup.
- **Targeting/timing:** self_area / stored; **proc:** 0.0; **сложность:** 3/4.
- **States:** создаёт `stored`, `compressed`; потребляет `corpse`.
- **Пул:** capacity, control, pickup, release_power, store_rate.
- **Anchor:** 0.40.
- **Мутации:**
  - **Collector** · *economy* — растут pickup radius и storage; stored XP до сбора даёт небольшой временный Power buff.
  - **Detonation** · *risk* — можно сжечь ограниченное количество несобранного XP ради большого burst; XP теряется.
  - **Compression** · *control* — перестаёт работать с XP, зато резко усиливает Pull/grouping enemies.
  - **Composter** · *corpse* — превращает nearby Corpses в Stored power вместо pickups.
  - **Overflow** · *burst* — автоматически срабатывает на cap; excess storage превращается в repeat chance.

## Камни-катализаторы

> **Playtest correction v0.2:** таблица ниже — sandbox кандидатов, а не доказанный support pool. v0.8 показал, что слишком многие камни читаются как разновидности “усиль соседа справа”. Следующий slice должен реализовать меньший набор, но сбалансированный по scopes: direct modifier, bridge/transfer, payload/trigger, bilateral, feedback, storage/cash-out, conversion/sustain/economy, spatial, cycle/pattern. Не принимать каталог, где >~50% эффектов можно честно пересказать как “правый Skill +X%”.
>
> Player-facing описание — на русском и на конкретных соседях. В Planning желательно показывать пример: `что пришло слева → что изменил камень → что сделает справа`.

| Catalyst | Scope | Совместимость | Базовый эффект |
|---|---|---|---|
| **Amplifier** | directional | universal | Правый Skill получает +35% Amplification; его proc coefficient −15%. |
| **Accelerator** | directional | universal | Правый Skill получает +25% эквивалента Tempo в repeat chance, но −18% Power. |
| **Echo Shard** | directional | universal | Правый Skill повторяет 35% совместимого payload левого Skill. Echo не может создать новое Echo. |
| **Splitter** | directional | projectile | Если правый Skill выпускает projectiles: +1 projectile, но −22% damage каждого. |
| **Lens** | directional | area | Правый Area/Field получает −30% Coverage и +45% локальной intensity/damage. |
| **Diffuser** | directional | area | Правый Area/Field получает +45% Coverage и −18% damage/control potency. |
| **Anchor** | bridge | universal | Правый Skill предпочитает цели, недавно задетые/Marked левым; +15% Amplification по ним. |
| **Detonator** | bridge | state | Правый Skill потребляет одно DoT/control-state, созданное левым, ради мгновенного burst; state заканчивается. |
| **Relay** | bridge | universal | Убийства левым дают следующей активации правого до +30% repeat chance; после срабатывания сброс. |
| **Capacitor** | bridge | universal | Хранит 12% damage левого Skill до cap и добавляет его как flat payload к правой активации. |
| **Conduit** | bridge | state | Один переносимый state левого копируется на цели правого с 60% potency. |
| **Fuse** | bilateral | universal | Каждый третий cycle оба соседних Skills срабатывают на одном beat; оба на таком trigger на 20% слабее. |
| **Backflow** | bilateral | universal | Если правый попал хотя бы в одну цель, левый на следующем cycle получает +25% Amplification; при miss бонуса нет. |
| **Symmetry** | bilateral | pattern | Если соседние Skills делят delivery tag, оба получают +18% Power. |
| **Dissonance** | bilateral | pattern | Если у соседей нет общих delivery tags, оба получают +22% Power. |
| **Hunter** | directional | universal | Правый Skill предпочитает Elites: +35% Elite damage, −15% damage по обычным врагам. |
| **Executioner** | directional | universal | Правый Skill получает до +45% Amplification по мере падения HP цели от 40% к 0%; −10% base Power. |
| **Reservoir** | directional | persistent | Duration правого Field/Construct/Orbit +45%; initial damage −15%. |
| **Gyroscope** | directional | universal | Правый Skill получает до +30% Power от недавнего движения игрока; стояние на месте сбрасывает bonus. |
| **Brake** | directional | universal | Правый Skill получает до +35% Power при низкой скорости игрока; быстрое движение убирает bonus. |
| **Grave Thread** | bridge | corpse | Kills левым создают временные Corpse tokens; совместимый правый Skill потребляет их ради +25% effect. |
| **Overflow** | bridge | universal | До 35% overkill damage левого переносится на первую валидную цель правого. |
| **Aegis Relay** | bridge | universal | Overkill или control левым копит barrier charge; активация правого превращает заряд в Barrier игрока. |
| **Prism** | bridge | state | Копирует один elemental/state tag слева направо с меньшей potency; hard CC не копируется. |
| **Sequence Lock** | bridge | universal | Если левый попал, правый получает идеальную помощь в targeting/aim и +10% Power; если левый промахнулся — правый теряет 10% Power. |
| **Inverter** | directional | control | Меняет Push↔Pull правого Skill, где это имеет смысл, и даёт +20% control potency. |
| **Reserve Tap** | directional | reserve | Правый Skill получает +7% Power за каждый Skill в Reserve с общим role tag, cap +28%. |
| **Null Gap** | structural | universal | Слот Catalyst намеренно пуст; следующий Skill получает +12% Power, Chain +3% Tempo. |

Catalysts имеют собственные random upgrade pools, обычно Potency / Efficiency / secondary condition. В v0.1 у них **нет Skill Mutations** — это сознательное ограничение сложности.

## Легендарные Законы

Laws не занимают Skill/Catalyst slots. Цель обычного рана: примерно 1–3 Laws. Только меньшая часть напрямую меняет topology Chain.

### Топология

- **Ouroboros** — добавляет шестое Catalyst-edge между Skill 6 и Skill 1; end-of-cycle context сбрасывается не полностью, но copied/echo events всё равно не могут рекурсировать.
- **Möbius Timing** — каждый второй cycle идёт в обратном порядке; directional Catalysts разворачиваются вместе с cursor.
- **Parallel Resonance** — выбрать два несоседних Skill slots; при активации одного второй имеет 35% шанс сработать на 50% power.
- **Black Socket** — пожертвовать одним active Skill slot; два соседних Catalysts становятся соседями друг с другом и оба получают +60% potency.

### Инвентарь

- **Living Reserve** — Reserve Skills передают 12% своих глобальных/stat properties активным Skills с общим role tag; в остальном Reserve неактивен.

### Тело

- **Glass Law** — outgoing damage ×1.8; Max HP становится 35% нормы и не может подняться выше cap.
- **Momentum Engine** — движение генерирует Momentum; высокий Momentum даёт Tempo и Coverage, стояние быстро их снимает.
- **Redline** — ниже 40% HP: +45% Tempo и +30% Power; лечение выше 70% снимает bonus на 8 секунд.

### Время

- **Second Hand** — каждые 12 секунд повторяет offensive events игрока из момента 1.0 с назад с 45% power; replay proc coefficient = 0.

### Мир

- **Conservation of Violence** — 50% валидного overkill damage сохраняется и прыгает к ближайшему врагу в range; transfer не может породить себя сам.

### Пространство

- **Past Shadow** — совместимые атаки дополнительно исходят из позиции игрока 2.5 секунды назад с 35% power.
- **Compressed World** — range игрока и врагов −20%, movement speed не меняется; player AoE intensity +35%.

### Враги

- **Predator's Charter** — adaptive Elites роллят на один tier выше, когда это допустимо; Elite reward score +35%.
- **Natural Selection** — победа над adaptation family повышает её будущий tier weight и одновременно награду; постоянно фармить один «удобный ответ» становится всё труднее.
- **Usurpation** — первая убитая Epic+ adaptive Elite позволяет украсть ослабленную версию её affix как global boon.
- **Broken Command** — убийство Elite Commander на 5 секунд переворачивает его текущий Order на сторону игрока: nearby enemies исполняют выгодную игроку версию.

### Экономика

- **Compound Interest** — каждый неиспользованный level-up Skip даёт +3% magnitude будущих upgrades; взятие Legendary offer тратит весь накопленный interest.
- **Scarcity Dividend** — каждый пустой Reserve slot: +10% Fortune и +6% Elite reward score; заполнение slot убирает bonus.
- **Debt Ceiling** — после каждого boss немедленно получить дополнительный level; у следующих трёх level-up на один offer меньше.
- **Elite Dividend** — XP обычных врагов −15%; Elite XP/Core rewards +55%.

### Карта

- **Wandering Shrines** — major POIs медленно перемещаются и оставляют видимый trail; завершение даёт усиленную награду, но привлекает Elite wave.
- **Pilgrim's Measure** — quality награды POI растёт с дистанцией от предыдущего POI до cap; stationary farming хуже.
- **Null Pilgrimage** — следующий завершённый POI навсегда отключает один случайный базовый pickup-type мира, но даёт Legendary Opportunity.

### Выживание

- **Continuity** — lethal hit вместо смерти уничтожает самый высокоуровневый active Skill и ставит HP на 35%. Один раз за ран.

## Шасси элиток

> **Presentation rule после v0.8:** chassis/affix/adaptation считается реализованным только если его влияние видно всё время действия: links/auras/formation/hazard markers на затронутых сущностях, persistent compact explanation и явное прекращение эффекта после смерти Elite. Один короткий текстовый popup не проходит acceptance. Редкость должна отличаться не только цветом текста, но и формой/масштабом presentation.

| Chassis | HP multiplier | Функция | Разрешённые orders |
|---|---:|---|---|
| **Marshal** | 5.0× | Отдаёт tactical Orders nearby normals; средний HP, низкий direct damage. | Spread, Screen, Surge, Encircle |
| **Bulwark** | 7.0× | Медленная тяжёлая Elite, проецирующая directional protection соседям. | Screen, Hold, Escort |
| **Shepherd** | 5.5× | Перестраивает nearby swarms в formations; хрупок в изоляции. | Spread, Regroup, Encircle, Funnel |
| **Hunter** | 4.5× | Быстрый прямой pursuer, давящий движение игрока. | Pursue, Intercept, Surge |
| **Architect** | 6.0× | Создаёт временные terrain/hazard constructs и lanes. | Hold, Funnel, Bombard |
| **Broodmaker** | 6.0× | Порождает дешёвых minions и использует их как материал formations. | Screen, Sacrifice, Spread |
| **Harvester** | 6.5× | Потребляет corpses/loose pickups ради усиления себя или nearby enemies. | Regroup, Escort, Sacrifice |
| **Archivist** | 5.5× | Копирует роль одного nearby normal enemy и усиливает его tactical behavior. | зависит от скопированной роли |

## Обычные Elite-affixes

| Affix | Rarity | Threat | Эффект |
|---|---|---:|---|
| **Swift** | Common | 1 | +22% move speed; −10% HP. |
| **Dense** | Common | 1 | +25% HP; −12% move speed. |
| **Volatile** | Common | 1 | Небольшой хорошо телеграфируемый death burst, который также повреждает врагов. |
| **Regenerating** | Rare | 2 | Regeneration после 3 с без damage; любой hit останавливает regen. |
| **Phasing** | Rare | 2 | Периодически проходит сквозь normals/soft terrain; после phasing ненадолго останавливается. |
| **Shielded** | Rare | 2 | Directional shield с видимой слабой стороной; без универсального damage reduction. |
| **Splitting** | Rare | 2 | На 50% HP создаёт две более слабые копии, делящие оставшуюся reward. |
| **Vanguard** | Epic | 4 | Nearby normals ускоряются при движении к игроку; сама Elite менее защищена. |
| **Brood** | Epic | 4 | Периодически создаёт небольшую formation biome-specific fodder. |
| **Temporal** | Epic | 4 | Чередует fast/slow phases на явном ритме; defensive stats слегка инвертируются между фазами. |
| **Parasite** | Epic | 4 | Прикрепляет видимого parasite к одному nearby strong mob, разделяя часть damage и поведения. |
| **Crowned** | Legendary | 8 | Добавляет второй совместимый tactical Order и повышает награду до Legendary Opportunity. |

## Семейства адаптивных affix'ов

### Против плотности / AoE

- **Rare — Spacing:** nearby mobs держат больше дистанции; пока растянуты, −10% move speed.
- **Epic — Dispersion:** Elite периодически делит cohort на 3 рыхлые группы; группы быстрее, но имеют ниже armor.
- **Legendary — Fracture:** command radius распадается на несколько flanking cohorts с независимыми vectors; каждый cohort особенно уязвим к line/pierce.

### Против дальнего боя

- **Rare — Screening:** fodder старается закрывать projectile lanes; screening units получают больше melee/contact damage.
- **Epic — Interception:** rotating screen cohort пересекает прогнозируемые projectile lanes; у screen units ниже HP.
- **Legendary — Parallax Guard:** несколько escort groups вращаются между игроком и Elite, периодически открывая явные gaps; в эти окна Elite Exposed.

### Против ближнего боя / ауры

- **Rare — Repulsor:** короткий периодический push вокруг Elite; после pulse элитка ненадолго замедлена.
- **Epic — Empty Center:** nearby mobs формируют рыхлое кольцо вместо схлопывания в melee; кольцо слабо против line attacks.
- **Legendary — Exclusion Zone:** мобильная hollow formation; центр опасно занимать, зато края получают больше boundary/pierce damage.

### Против постоянных полей

- **Rare — Burrow:** часть commanded mobs может пересекать Field под землёй; после выхода короткая пауза.
- **Epic — Relocation:** Elite периодически переносит cohort из long-lived Fields; перенос имеет телеграфируемый windup.
- **Legendary — Migration:** создаёт видимый migration lane через Fields; mobs на lane устойчивее к Field effects, но получают больше direct-hit damage.

### Против цепей / связей

- **Rare — Insulated:** первый transferred state/chain hop к каждому nearby mob ослаблен; direct damage не меняется.
- **Epic — Severance:** pulse элитки ломает часть Tethers/transfer links; во время pulse Elite Exposed.
- **Legendary — Grounded Network:** nearby mobs делятся transferred states между собой, но propagation имеет cap; shared-state clusters уязвимее к burst.

### Против высокой частоты попаданий

- **Rare — Retort:** каждые N полученных hits заряжают небольшой retaliatory shot; тяжёлые медленные hits заряжают реже.
- **Epic — Chargeback:** nearby mobs коллективно копят hit-count charge и выпускают телеграфируемый pulse; убийство Elite отменяет накопление.
- **Legendary — Saturation:** после high-hit-rate threshold cohort входит в короткие hardened windows, после которых следуют более длинные Exposed windows.

### Против burst

- **Rare — Phase Shell:** очень большой одиночный hit даёт короткий phase-step; sustained damage не затрагивается.
- **Epic — Segmented Carapace:** крупные куски health откалываются как уязвимые fragments вместо простого исчезновения; fragments легко чистятся.
- **Legendary — Metamorph:** на health thresholds Elite меняет tactical form и становится Exposed во время transition.

### Против DoT

- **Rare — Shedding:** heavily afflicted nearby mobs сбрасывают один status в слабую disposable husk.
- **Epic — Cleansing Pulse:** периодически снимает часть statuses с allies, но ради этого жертвует собственной armor.
- **Legendary — Molt:** один раз за жизнь сбрасывает покрытый statuses shell; core теряет defenses и становится быстрее.

### Против контроля

- **Rare — Anchored:** nearby mobs лучше сопротивляются displacement, но медленнее двигаются.
- **Epic — Rally:** периодически очищает soft CC с allies; cast можно прервать burst damage.
- **Legendary — Unstoppable March:** создаёт медленную плотную колонну, устойчивую к CC; её alignment делает её крайне уязвимой к pierce/line.

### Против summon / construct

- **Rare — Predator:** часть mobs приоритизирует Constructs; эти mobs игнорируют игрока, поэтому их легко bait'ить.
- **Epic — Saboteur:** Elite создаёт временные interference zones, ослабляющие Constructs; для поддержания зоны Elite должна оставаться рядом.
- **Legendary — Hijack:** Elite channel'ит временный захват одного Construct; channel оставляет её stationary и сильно уязвимой.

### Против kite / движения

- **Rare — Intercept:** часть units целится в прогнозируемую позицию по траектории игрока вместо прямого chase.
- **Epic — Pincer:** две группы идут с прогнозируемых боковых углов; давление из центра ниже.
- **Legendary — Encirclement:** медленно подготавливает multi-group surround; уничтожение одной группы открывает большое escape gap.

### Против стационарного билда

- **Rare — Artillery Call:** delayed shots падают в недавно занятые позиции игрока.
- **Epic — Grid Fire:** несколько telegraphed zones постепенно делают область опасной, сохраняя между ними safe lanes.
- **Legendary — Forced Migration:** медленный hazard front проходит по арене, вынуждая перемещаться, но открывая rear cohort элитки.

### Против использования трупов

- **Rare — Scavenger:** nearby mobs съедают Corpses ради небольшого healing до того, как их использует игрок.
- **Epic — Cremation:** периодически сжигает corpse cluster, лишая игрока ресурса, но создавая temporary hazard, который повреждает и врагов.
- **Legendary — Ossuary:** прессует Corpses в destructible node, усиливающий nearby mobs; разрушение node возвращает stored corpse value и stun'ит cohort.

### Против crit

- **Rare — Faceted:** crits накапливают crack meter; при заполнении shell ломается и Elite ненадолго Exposed.
- **Epic — Mirror Plating:** каждый crit временно повышает aggression Elite, но снижает armor; non-crits не запускают эффект.
- **Legendary — Prism Crown:** crits могут создавать слабые mirror decoys, копирующие движение, но не attacks; decoys очень уязвимы к AoE.

### Против фокуса элиток

- **Rare — Bodyguard:** Elite получает двух прочных guards, перехватывающих targeted projectiles; guards дают extra XP.
- **Epic — Decoy Signal:** nearby normals получают похожие на health bar decoys; настоящая Elite сохраняет отдельный silhouette/marker.
- **Legendary — Relay Shield:** видимый shield вращается между Elite и cohort members; одновременно защищён только один target, между transfers есть gap.

### Против sustain

- **Rare — Wound:** атаки Elite накладывают короткий capped healing-reduction debuff; отсутствие новых hits естественно очищает его.
- **Epic — Blood Ledger:** healing игрока заряжает следующую атаку Elite, но одновременно повышает reward meter, если убить её до discharge.
- **Legendary — Red Audit:** периодически превращает nearby enemy healing в offense; при смерти оставляет сильный healing pulse для игрока.

## Бестиарий обычных монстров

### Black Archive

| Enemy | Роль | Threat | HP | Поведение |
|---|---|---:|---:|---|
| **Footnote** | ranged | 2.0 | 1.00× | Малый ranged unit стреляет под смещёнными углами, а не прямо в игрока. |
| **Bookmark** | charger | 2.5 | 1.50× | Рывок по видимой прямой «строке», затем пауза. |
| **Binder** | support | 4.0 | 2.40× | Связывает двух врагов, заставляя их делить часть damage; смерть Binder рвёт связь. |
| **Redactor** | anti-field | 4.0 | 2.20× | Временно стирает небольшой участок persistent Field; низкая прямая угроза. |
| **Palimpsest** | reviver | 3.5 | 2.00× | Один раз воскресает в более слабой, но быстрой изменённой форме. |
| **Indexer** | controller | 4.0 | 2.30× | Отмечает прогнозируемую ground point; nearby mobs смещают движение к ней. |
| **Inkblot** | hazard | 2.5 | 1.30× | После смерти оставляет короткоживущую опасную кляксу. |
| **Marginwalker** | flanker | 3.0 | 1.80× | Предпочитает края obstacles и подходит со screen margins. |

### Salt Garden

| Enemy | Роль | Threat | HP | Поведение |
|---|---|---:|---:|---|
| **Saltling** | swarm | 1.0 | 0.75× | Малый хрупкий crystal organism; смерть может отколоть nearby crystal armor. |
| **Brine Bladder** | exploder | 2.0 | 1.20× | Медленный мешок, лопающийся в push wave и короткую brine puddle. |
| **Geode Roller** | bruiser | 5.0 | 3.00× | Бронирован спереди во время rolling; после столкновения с terrain открывает слабый rear. |
| **Capillary Spire** | artillery | 4.5 | 2.70× | Укореняется и выпускает delayed brine shots; выдёргивается, если игрок ушёл из range. |
| **Karst Borer** | burrower | 3.0 | 1.70× | Уходит под землю и выходит впереди прогнозируемого движения; на emergence Exposed. |
| **Precipitator** | builder | 4.0 | 2.40× | Потребляет corpses и выращивает destructible crystal cover, меняющий pathing. |
| **Prismite** | support | 3.5 | 2.00× | Слегка преломляет траектории nearby projectiles; пока refracting, хрупок и stationary. |
| **Salt Shepherd** | formation | 4.0 | 2.10× | Собирает nearby Saltlings в движущуюся crescent formation. |

### Threadworks

| Enemy | Роль | Threat | HP | Поведение |
|---|---|---:|---:|---|
| **Thread Looper** | swarm | 1.0 | 0.70× | Движется связанными цепями по 3–5 тел; разрыв цепи ненадолго замедляет остальных. |
| **Shuttle** | charger | 2.0 | 1.40× | Телеграфирует прямой dash сквозь игрока, проскакивает дальше и останавливается. |
| **Bobbin** | hazard | 2.5 | 1.80× | Прокатывается мимо, оставляя короткий slowing thread trail. |
| **Ripper** | ranged | 3.0 | 1.60× | Держит среднюю дистанцию и стреляет хорошо телеграфируемой needle line. |
| **Knotter** | utility | 2.0 | 1.00× | При смерти слегка стягивает nearby enemies внутрь; иногда помогает AoE-билду. |
| **Hemmer** | terrain | 4.0 | 2.50× | Создаёт короткоживущий soft-wall segment, который обе стороны обходят. |
| **Mothcutter** | flanker | 3.5 | 1.50× | Летит через terrain и ослабляет/удаляет small persistent Fields на пути. |
| **Carrier** | support | 4.0 | 2.20× | Пытается утащить раненого сильного ally из опасности; во время переноски уязвим. |

## POI карты

- **Resonator** — удерживать зону 8 с в бою. Выбрать active component: следующие 3 upgrade-roll получают +1 ступень minimum rarity, максимум Epic.
- **Mutation Chamber** — выбрать ещё не мутировавший Skill. На milestone вместо 2 показать 3 Mutation; World Adaptation Pressure +15%.
- **Hunter Beacon** — выбрать одно из 2 показанных Adaptation families и вызвать Epic Elite этого family; reward score +25%.
- **Apex Beacon** — вызывает Elite с +1 generic affix и высоким шансом Epic/Legendary adaptation; всё видно до активации.
- **Black Forge** — пожертвовать одним Reserve component, чтобы немедленно дать weighted upgrade active component с общим tag.
- **Echo Archive** — показывает 3 недавно отклонённых/skipped normal upgrades; выбрать один с его исходной rarity.
- **Fault Altar** — на весь ран +10% world spawn pressure; +12% Elite reward score и +10% Fortune.
- **Null Gate** — навсегда заблокировать один active Skill slot на этот ран; немедленно получить Legendary Opportunity.
- **Survey Spire** — короткий defense event; открывает nearby POIs/Elite nests и даёт movement/pickup utility.
- **Moving Relay** — 20 с сражаться рядом с движущимся objective; reward смещён к Tempo/Movement/Control rolls.

## Фирменные взаимодействия, которые стоит именовать в UI

Это labels/feedback поверх системных state-rules, а не отдельная скрытая recipe-system:

- **Thermal Shock** — Chill потребляется Ember/heat payload ради burst; Chill очищается или уменьшается.
- **Live Wire** — Embed/Tether становится предпочтительным relay для Chain Arc.
- **Sever** — Strike/Cleaver потребляет Tether и повреждает связанные endpoints.
- **Septic Cut** — Wound внутри Toxic Mist потребляется ради короткого toxin burst.
- **Ballistic Solution** — недавно Displaced targets получают улучшенное prediction/impact Mortar.
- **Boundary Feed** — любой persistent Field разрешает geometry Boundary Saw.
- **Cash Out** — Stored payload Debt Orb/Vacuum Bloom питает Mass Driver или другой Store consumer.
- **Conductive Rig** — Constructs после нужной mutation/catalyst становятся relay для Chain Arc.
- **Echo Chorus** — state Echo от Recorder/Fold/Afterimage питает Choir routes.
- **Carrion Growth** — corpse-producing world states питают Seed Mine/Vacuum Bloom routes.

## Контракт приёмки нового контента

Новый Skill не принимается только потому, что у него новые VFX. Он должен пройти linter и ручные gates:

1. Добавляет новое решение, interaction edge, решение роли или meaningful alternative, а не только reskin.
2. По возможности использует existing primitives; новый engine primitive требует минимум 3 запланированных content uses.
3. Base complexity ≤4/6; mutation может добавить максимум +1–2 complexity points.
4. Имеет минимум пять mutation routes, покрывающих минимум четыре разных mutation archetypes.
5. После каждой mutation остаётся полезный growth pool; mutation перенастраивает future rolls в сторону выбранной версии.
6. Читается при целевой плотности мобов одновременно с пятью другими active Skills.
7. Имеет явный performance budget: entities, queries, particles, audio events и proc generation.
8. Familiar anchor Skills имеют право быть механически простыми. «Уникальность» сама по себе не является целью дизайна.
