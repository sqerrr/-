import { readFileSync } from 'node:fs';
import {
  activeSkillOrder,
  catalystOrder,
  catalysts,
  doctrines,
  rarityName,
  resonance,
  skills
} from '../content/definitions.js';
import { itemCategoryName, itemCategoryRival, itemOrder, items } from '../content/items.js';

const latinWord = /\b[A-Za-z]{2,}\b/;
const failures: string[] = [];

function check(label: string, value: string | undefined) {
  if (!value) return;
  if (latinWord.test(value)) failures.push(`${label}: latin word in "${value}"`);
}

for (const id of activeSkillOrder) {
  const d = skills[id];
  check(`skill.${id}.name`, d.name);
  check(`skill.${id}.shortName`, d.shortName);
  check(`skill.${id}.description`, d.description);
  check(`skill.${id}.identity`, d.identity);
  check(`skill.${id}.weakness`, d.weakness);
  for (const m of d.mutations) {
    check(`mutation.${m.id}.name`, m.name);
    check(`mutation.${m.id}.tag`, m.tag);
    check(`mutation.${m.id}.description`, m.description);
  }
}

for (const id of catalystOrder) {
  const d = catalysts[id];
  check(`catalyst.${id}.name`, d.name);
  check(`catalyst.${id}.shortName`, d.shortName);
  check(`catalyst.${id}.scope`, d.scope);
  check(`catalyst.${id}.desc`, d.desc);
  if (d.desc.length > 110) failures.push(`catalyst.${id}: description too long (${d.desc.length})`);
}

for (const [id, d] of Object.entries(resonance)) {
  check(`resonance.${id}.name`, d.name);
  check(`resonance.${id}.shortName`, d.shortName);
  check(`resonance.${id}.description`, d.description);
  if (d.description.length > 120) failures.push(`resonance.${id}: description too long (${d.description.length})`);
}

for (const [id, d] of Object.entries(doctrines)) {
  check(`doctrine.${id}.name`, d.name);
  check(`doctrine.${id}.shortName`, d.shortName);
  check(`doctrine.${id}.description`, d.description);
}
for (const [id, name] of Object.entries(rarityName)) check(`rarity.${id}`, name);

for (const id of itemOrder) {
  const d = items[id];
  check(`item.${id}.name`, d.name);
  check(`item.${id}.short`, d.short);
  check(`item.${id}.description`, d.description);
}
for (const [id, name] of Object.entries(itemCategoryName)) check(`itemCategory.${id}`, name);
for (const [id, name] of Object.entries(itemCategoryRival)) check(`itemCategoryRival.${id}`, name);

const sourceFiles = [
  'src/content/definitions.ts',
  'src/core/simulation.ts',
  'src/platform/main.ts',
  'public/index.html'
];
const banned = [
  'Присутствие',
  'Множественность',
  'Проводимость',
  'ХОРЕОГРАФИЯ',
  'Перероллить',
  'перероллить',
  'Токен отказа',
  'ОБЩИЙ СТАТ',
  'Паттерны',
  'BLACK ARCHIVE',
  'Black Archive',
  'CHOICE DEBUG',
  'UI/choice'
];
for (const path of sourceFiles) {
  const source = readFileSync(path, 'utf8');
  for (const word of banned) {
    if (source.includes(word)) failures.push(`${path}: banned player-facing wording "${word}"`);
  }
}

if (failures.length) {
  throw new Error('user-text-regression failed:\n' + failures.join('\n'));
}

console.log('user-text-regression OK', {
  skills: activeSkillOrder.length,
  catalysts: catalystOrder.length,
  items: itemOrder.length,
  rule: 'short, concrete, Russian player-facing copy'
});
