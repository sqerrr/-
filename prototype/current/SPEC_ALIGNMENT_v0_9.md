# SPEC alignment — web prototype v0.9B WORLD / THREAT / READABILITY

## Реализовано непосредственно

| Направление | v0.9B |
|---|---|
| Clean progression from zero | Да: 1 Phenomenon, no Catalyst/Reserve/Resonance |
| Max active Phenomena | 4 |
| Standard XP | 3 offers, только active Phenomenon growth |
| Discovery / Catalyst / Resonance reward lanes | Разведены |
| Finite world | Да: X [-48,48], Z [-36,36] |
| POI exploration | 6 typed nodes + guardian Elite + reward |
| Minimap | Player / POI / Elite / Boss / Heal |
| Kiting prevention | Far normals recycle; Elite reacquire |
| Exploration affects finale | 4+ POI = 0 support, 2–3 = 1, 0–1 = 2 |
| Final boss | Warden: Sweep / Rupture / Charge, phase 2, exposure windows |
| Normal projectile restraint | Да; Archivist Elite — rare exception |
| Elite identity | Chassis + behavioral Affix + Adaptation |
| Persistent adaptation readability | Rings / lines / shields / links + threat panel |
| Elite/Boss HP bars | Да |
| Floating damage values | Да, с short-window aggregation |
| Heal salience | World pulse + beacon + minimap + |
| Catalyst causal explanation | First trigger alert + edge flash + world route |
| Debug/stat HUD | Hidden by default; F8 technical panel |
| Canonical combat geometry | Core owns circle / sector / ray |
| PresentationBridge | Snapshot + Event → visual-only cues |
| Runtime 3D / skeletal hero / 3D elites | Нет, future Hybrid3D workstream |
| Universal physical Chain cells | Нет; candidate documented separately |
| Terrain obstacles / rooms / pathing | Нет; objective topology only |
| Automated balance acceptance | Намеренно не используется |

## Намеренно parked / deferred

- Rail Spear;
- Mass Driver;
- Repulse Halo;
- global/body stat cards in standard XP;
- normal bullet-soup;
- universal-slot Chain until separate topology experiment;
- hard terrain obstacles until crowd navigation is trustworthy;
- build-matrix/world calibration as design judge.

## Временные implementation numbers

Не считать design law:

- exact world size / fixed POI coordinates;
- POI clear thresholds 4+/2–3/0–1;
- Warden spawn at 87.5% timer;
- current population/density curve;
- Elite cadence / HP scaling;
- exact adaptation timings and exposure windows;
- current Phenomenon/Catalyst percentages.

## Главный acceptance теперь ручной

1. есть понятная причина идти в конкретную часть карты;
2. движение меняет бой, но не позволяет бесплатно удалить threat;
3. Elite Chassis/Affix/Adaptation различимы без чтения event log;
4. Heal видим и при необходимости входит в route decision;
5. normal density создаёт pressure без projectile soup;
6. Catalyst читается как source → operator → target;
7. Warden telegraphs совпадают с реальной damage geometry;
8. зачистка карты заметно меняет финал;
9. Phenomenon growth ощущается как основной level-up value;
10. после этого уже имеет смысл разбирать survival/density/balance curve.
