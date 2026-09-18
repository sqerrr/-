# Контракт переносимости игровой логики

## Цель

Web reference, Delphi/D3D11 и любой будущий runtime не должны переносить друг у друга renderer/platform код. Они должны реализовывать одну и ту же **игровую спецификацию**.

## Переносится концептуально

- entity identity и lifetime rules;
- fixed tick semantics;
- RNG domains;
- order of simulation phases;
- spatial query semantics;
- damage/armor/control formulas;
- Chain order;
- Catalyst semantics;
- Mutation generation/selection rules;
- Elite affix/adaptation rules;
- Spawn/Adaptation Director rules;
- reward generation;
- POI rules;
- meta progression data.

## Не переносится

- WebGL2/D3D11 renderer;
- DOM/Win32 input;
- WebAudio/XAudio2;
- IndexedDB/filesystem;
- browser worker implementation/Delphi thread scheduler;
- platform asset upload details.

## Общие данные

По возможности content definitions должны иметь schema, которую можно валидировать одинаково в разных реализациях. Не завязывать definition format на особенности TypeScript или Delphi RTTI.

## Референс

До появления production native implementation web/headless simulator может считаться reference по gameplay semantics. После стабилизации native версии source of truth должен стать spec + tests, а не одна конкретная реализация.
