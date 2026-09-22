import {
  activeSkillOrder,
  catalysts,
  catalystPairCompatible,
  doctrines,
  mutationDef,
  rarityColor,
  rarityName,
  resonance,
  skills
} from '../content/definitions.js';
import { catalystGlyph, itemCategoryColor, itemGlyph, mutationBadge, skillChoiceArt } from '../content/visuals.js';
import { itemCategoryName, items as itemDefs } from '../content/items.js';
import { Simulation } from '../core/simulation.js';
import type {
  CatalystId,
  GameEvent,
  RewardOffer,
  RunMode,
  SkillId,
  Snapshot
} from '../core/types.js';
import { WebGLRenderer } from '../renderer/webgl2.js';
import { PresentationBridge } from '../presentation/bridge.js';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const combatHud = document.getElementById('combatHud') as HTMLCanvasElement;
const minimap = document.getElementById('minimap') as HTMLCanvasElement;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function skillVisualIcon(id: SkillId, mutated = false) {
  const art = skillChoiceArt[id];
  return mutated ? art.mutated : art.normal;
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 12345),
  smoke = params.get('smoke') === '1',
  uiTest = params.get('uitest') === '1',
  debugEnabled = params.get('debug') === '1';
let runMode: RunMode = params.get('mode') === 'showcase' ? 'showcase' : 'clean';
let startingSkill: SkillId = activeSkillOrder.includes(params.get('start') as SkillId)
  ? (params.get('start') as SkillId)
  : 'cleaver';
const newSimulation = () => new Simulation({ seed, hz: 60, mode: runMode, startingSkill });
let sim = newSimulation();
let renderer: WebGLRenderer;
const presentation = new PresentationBridge();
let paused = false,
  planning = false;
let last = performance.now(),
  acc = 0;
const keys = new Set<string>();
let aim = { x: 1, z: -1 };
let chainSignature = '',
  plannerSignature = '';
let eliteAlertToken = 0,
  rareAlertUntil = 0,
  threatFocusId = 0;
const seenCatalystTriggers = new Set<string>();
const seenRivalCasts = new Set<string>();
type CombatFloat = {
  entity: number;
  x: number;
  z: number;
  text: string;
  amount: number;
  start: number;
  ttl: number;
  kind: 'damage' | 'crit' | 'catalyst';
};
const combatFloats: CombatFloat[] = [];
let renderedChoiceSerial = -1,
  choiceLocked = false,
  suppressChoiceUntil = 0;

// Keep the v0.4.4 diagnostics: the old modal bug disappeared only after this code path was introduced.
const debugLines: string[] = [];
let debugSeq = 0,
  lastChoiceUiState = '';
function safeJson(v: unknown) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
function dbg(message: string, data?: unknown) {
  const line = `${String(++debugSeq).padStart(4, '0')} +${(performance.now() / 1000).toFixed(3)}s ${message}${data === undefined ? '' : ' ' + safeJson(data)}`;
  debugLines.push(line);
  if (debugLines.length > 500) debugLines.shift();
  console.log('[ROGUE-DBG]', message, data ?? '');
  const out = document.getElementById('debugLog');
  if (out) {
    out.textContent = debugLines.slice(-120).join('\n');
    out.scrollTop = out.scrollHeight;
  }
}
function targetDesc(t: EventTarget | null) {
  const e = t instanceof HTMLElement ? t : null;
  return e
    ? `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.dataset.choice !== undefined ? '[choice=' + e.dataset.choice + ']' : ''}`
    : String(t);
}
function snapChoice(s: Snapshot) {
  return {
    serial: s.choiceSerial,
    reward: s.rewardOffers?.map((o, i) => `${i}:${o.id}`) ?? null,
    mutation: s.mutationOffer?.choices ?? null,
    tick: s.tick,
    time: +s.time.toFixed(3)
  };
}
function modalState() {
  const w = $<HTMLDivElement>('choice'),
    cs = getComputedStyle(w);
  return {
    hidden: w.hidden,
    display: cs.display,
    serial: w.dataset.choiceSerial ?? null,
    cards: $('cards').children.length
  };
}
async function copyDebugLog() {
  const text = [
    'Чёрный архив · диагностика',
    navigator.userAgent,
    location.href,
    '',
    ...debugLines
  ].join('\n');
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}
function updateDebugState() {
  const s = sim.snapshot(),
    state = `${s.choiceSerial}|${!!s.rewardOffers}|${!!s.mutationOffer}|${modalState().hidden}|${choiceLocked}`;
  if (state !== lastChoiceUiState) {
    lastChoiceUiState = state;
    dbg('CHOICE STATE', {
      sim: snapChoice(s),
      modal: modalState(),
      renderedChoiceSerial,
      choiceLocked
    });
  }
}
window.addEventListener('error', (e) =>
  dbg('WINDOW ERROR', {
    message: e.message,
    file: e.filename,
    line: e.lineno,
    error: String(e.error ?? '')
  })
);
window.addEventListener('unhandledrejection', (e) =>
  dbg('UNHANDLED REJECTION', { reason: String(e.reason), stack: e.reason?.stack ?? null })
);
(window as unknown as { __rogueDebug?: unknown }).__rogueDebug = {
  lines: debugLines,
  snapshot: () => sim.snapshot(),
  copy: copyDebugLog
};

$('seed').textContent = String(seed);
const modeSelect = $<HTMLSelectElement>('modeSelect'),
  startSelect = $<HTMLSelectElement>('startSkill');
modeSelect.value = runMode;
startSelect.innerHTML = activeSkillOrder
  .map((id) => `<option value="${id}">${skills[id].name}</option>`)
  .join('');
startSelect.value = startingSkill;
startSelect.disabled = runMode === 'showcase';
modeSelect.addEventListener('change', () => {
  runMode = modeSelect.value as RunMode;
  startSelect.disabled = runMode === 'showcase';
  pushLog('Режим изменён. Нажмите «Перезапустить», чтобы начать новый забег.');
});
startSelect.addEventListener('change', () => {
  startingSkill = startSelect.value as SkillId;
  pushLog(`Стартовый феномен: ${skills[startingSkill].name}. Применится после перезапуска.`);
});
function esc(s: string) {
  return String(s).replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!
  );
}
function pushLog(t: string) {
  // Former on-screen event log is retired; useful diagnostics remain available through F8.
  dbg('GAME', { text: t });
}
// D17. The dash is edge triggered: holding the key does not keep dashing, and the
// request survives until a simulation step consumes it, so a press between two
// frames is never swallowed.
let dashQueued = false;
function screenMove() {
  const sx =
      (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
      (keys.has('a') || keys.has('arrowleft') ? 1 : 0),
    sy =
      (keys.has('s') || keys.has('arrowdown') ? 1 : 0) -
      (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  if (!sx && !sy) return { x: 0, z: 0 };
  const x = sx + sy,
    z = -sx + sy,
    m = Math.hypot(x, z) || 1;
  return { x: x / m, z: z / m };
}
function keyHandled(k: string) {
  return [
    'w',
    'a',
    's',
    'd',
    'arrowup',
    'arrowdown',
    'arrowleft',
    'arrowright',
    ' ',
    'r',
    'p',
    'tab',
    'shift'
  ].includes(k);
}
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (keyHandled(k)) e.preventDefault();
  if (!e.repeat && e.key === 'F8') {
    $('debugPanel').classList.toggle('debug-hidden');
    return;
  }
  if (!e.repeat && k === 'tab') togglePlanning();
  else if (!e.repeat && (k === ' ' || k === 'p')) togglePause();
  else if (!e.repeat && k === 'r') restart();
  else if (!e.repeat && k === 'shift') dashQueued = true;
  keys.add(k);
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (keyHandled(k)) e.preventDefault();
  keys.delete(k);
});
window.addEventListener('blur', () => keys.clear());
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  if (e.button === 2) {
    e.preventDefault();
    dashQueued = true;
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (renderer) aim = renderer.screenAim(e.clientX, e.clientY);
});
canvas.addEventListener(
  'wheel',
  (e) => {
    if (!renderer) return;
    e.preventDefault();
    renderer.adjustZoom(e.deltaY < 0 ? 0.08 : -0.08);
    pushLog(`Масштаб камеры: ${Math.round(renderer.zoomLevel * 100)}%`);
  },
  { passive: false }
);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
$('pauseBtn').addEventListener('click', togglePause);
$('planBtn').addEventListener('click', togglePlanning);
$('planClose').addEventListener('click', togglePlanning);
$('restartBtn').addEventListener('click', restart);
$('overRestart').addEventListener('click', restart);
$('debugCopy').addEventListener('click', () => void copyDebugLog());
$('debugClear').addEventListener('click', () => {
  debugLines.length = 0;
  debugSeq = 0;
  $('debugLog').textContent = '';
});
$('debugToggle').addEventListener('click', () => $('debugPanel').classList.toggle('collapsed'));
const choiceRoot = $('choice');
for (const type of ['pointerdown', 'pointerup', 'click'] as const)
  choiceRoot.addEventListener(
    type,
    (e) => dbg(`DOM ${type}`, { target: targetDesc(e.target), modal: modalState() }),
    true
  );

function togglePause() {
  const s = sim.snapshot();
  if (planning || s.player.hp <= 0 || s.finished || s.rewardOffers || s.mutationOffer) return;
  paused = !paused;
  $('pause').classList.toggle('visible', paused);
  $('pauseBtn').textContent = paused ? 'Продолжить' : 'Пауза';
  last = performance.now();
  acc = 0;
}
function togglePlanning() {
  const s = sim.snapshot();
  if (s.player.hp <= 0 || s.finished || s.rewardOffers || s.mutationOffer) return;
  planning = !planning;
  $('planner').classList.toggle('visible', planning);
  if (planning) {
    $('pause').classList.remove('visible');
    keys.clear();
    plannerSignature = '';
    updatePlanner(s);
    pushLog('Экран персонажа и сборки открыт: бой полностью остановлен.');
  }
  last = performance.now();
  acc = 0;
}
function restart() {
  runMode = modeSelect.value as RunMode;
  startingSkill = startSelect.value as SkillId;
  sim = newSimulation();
  presentation.reset(sim.snapshot());
  renderer?.reset();
  paused = false;
  planning = false;
  keys.clear();
  aim = { x: 1, z: -1 };
  last = performance.now();
  acc = 0;
  seenCatalystTriggers.clear();
  combatFloats.length = 0;
  chainSignature = '';
  plannerSignature = '';
  renderedChoiceSerial = -1;
  choiceLocked = false;
  suppressChoiceUntil = 0;
  $('pause').classList.remove('visible');
  $('planner').classList.remove('visible');
  $('overlay').classList.remove('visible');
  closeChoiceModal();
  $('eliteAlert').classList.remove('visible');
  $('pauseBtn').textContent = 'Пауза';
  pushLog(
    `${runMode === 'clean' ? 'Чистый забег' : 'Демонстрация'}: исследуйте отмеченные структуры карты; Хранитель приходит в финале.`
  );
}

const chassisName: Record<string, string> = {
  marshal: 'Маршал',
  hunter: 'Хищник',
  bulwark: 'Призма',
  architect: 'Завеса',
  harvester: 'Нуль-ткач',
  shepherd: 'Метаморф',
  broodmaker: 'Репликатор',
  archivist: 'Архивист',
  warden: 'Хранитель'
};
const chassisRole: Record<string, string> = {
  marshal: 'давит строем и ускоряет союзников',
  hunter: 'предсказывает движение и делает перехватывающий рывок',
  bulwark: 'запоминает источник: повтор защищает её, смена источника вскрывает',
  architect: 'создаёт туман, в котором дальний автоматический захват теряет цель',
  harvester: 'поглощает срабатывания катализаторов; прямые такты разбивают заряд',
  shepherd: 'эволюционирует от реальной сигнатуры полученного урона',
  broodmaker: 'частые попадания порождают копии; убийство копии ранит оригинал',
  archivist: 'копирует боевые роли и меняет рисунок боя',
  warden: 'финальный босс: заранее показывает взмах, разлом и таран'
};
const affixName: Record<string, string> = {
  none: 'Без аффикса',
  swift: 'Быстрый',
  dense: 'Плотный',
  volatile: 'Взрывной',
  regenerating: 'Регенерирующий',
  shielded: 'Щитоносец',
  vanguard: 'Авангард',
  temporal: 'Темпоральный',
  brood: 'Роевой',
  crowned: 'Коронованный'
};
const affixRole: Record<string,string> = {
  none:'',
  swift:'движется быстрее',
  dense:'тяжелее сдвигается',
  volatile:'после смерти оставляет красную зону взрыва',
  regenerating:'восстанавливается, если несколько секунд не получать урон',
  shielded:'щит фиксирует направление перед рывком — обходи с фланга или ломай стойкость',
  vanguard:'периодически ускоряет и направляет ближайшую стаю',
  temporal:'заранее отмечает точку скачка и бьёт после перемещения',
  brood:'периодически вызывает подкрепление',
  crowned:'чаще использует собственные механики'
};
const chassisGlyph: Record<string,string> = {
  marshal:'⚑', hunter:'➤', bulwark:'▣', architect:'⌗', harvester:'⌒',
  shepherd:'Ψ', broodmaker:'∴', archivist:'▥', warden:'⬢'
};
const chassisShortRule: Record<string,string> = {
  marshal:'КОМАНДУЕТ СТАЕЙ',
  hunter:'ПЕРЕХВАТЫВАЕТ ТРАЕКТОРИЮ',
  bulwark:'МЕНЯЙ ИСТОЧНИК УРОНА',
  architect:'СТАВИТ ЗАВЕСЫ',
  harvester:'ПОГЛОЩАЕТ ПРОИЗВОДНЫЕ',
  shepherd:'ПЕРЕСТРАИВАЕТ СТАЮ',
  broodmaker:'ПОРОЖДАЕТ КОПИИ',
  archivist:'КОПИРУЕТ РОЛИ',
  warden:'ПАТТЕРНЫ ФИНАЛА'
};
const affixGlyph: Record<string,string> = {
  none:'', swift:'≡', dense:'■', volatile:'▲', regenerating:'✚',
  shielded:'⬟', vanguard:'»', temporal:'⌛', brood:'∴', crowned:'♛'
};
const affixShortRule: Record<string,string> = {
  none:'', swift:'БЫСТРЕЕ', dense:'ТЯЖЁЛЫЙ', volatile:'ВЗРЫВ ПОСЛЕ СМЕРТИ',
  regenerating:'РЕГЕН БЕЗ УРОНА', shielded:'ЩИТ ПО НАПРАВЛЕНИЮ',
  vanguard:'ВЕДЁТ СТАЮ', temporal:'СКАЧОК + УДАР', brood:'ВЫЗЫВАЕТ СТАЮ',
  crowned:'ЧАЩЕ ИСПОЛЬЗУЕТ ПРИЁМЫ'
};
const chassisUiTint: Record<string,string> = {
  marshal:'#ffc36a', hunter:'#ff79b8', bulwark:'#79d6ff', architect:'#9eeaff',
  harvester:'#74ead3', shepherd:'#9bea7d', broodmaker:'#ed82cb',
  archivist:'#8eb5ff', warden:'#f4e7c8'
};
const affixUiTint: Record<string,string> = {
  swift:'#eef5ff', dense:'#aaa4b1', volatile:'#ffad5c', regenerating:'#79ee9b',
  shielded:'#78d8ff', vanguard:'#ffb15e', temporal:'#b69aff', brood:'#f58abd',
  crowned:'#ffe477', none:'#ffffff'
};
const eliteActionLabel: Record<string,string> = {
  predator:'ПЕРЕХВАТ', predator_dash:'ПЕРЕХВАТ', veil:'СМЕЩЕНИЕ',
  replicate:'ВЫБРОС КОПИИ', prism:'ФРОНТАЛЬНЫЙ УДАР',
  null:'ЖАТВА', metamorph:'КОМАНДНЫЙ ИМПУЛЬС'
};
const eliteActionHint: Record<string,string> = {
  predator:'СМЕНИ ТРАЕКТОРИЮ',
  predator_dash:'УЙДИ С ЛИНИИ РЫВКА',
  veil:'НЕ СТОЙ В ТОЧКЕ СМЕЩЕНИЯ',
  replicate:'ВЫЙДИ ИЗ КРУГА',
  prism:'ЗАЙДИ ЗА ФРОНТ ЩИТА',
  null:'ВЫЙДИ ИЗ СЕКТОРА',
  metamorph:'ОТОРВИСЬ ОТ СТАИ'
};
function eventText(e: GameEvent) {
  if (e.type === 'EntitySpawned' && e.kind === 'elite')
    return e.boss
      ? 'ФИНАЛЬНЫЙ БОСС: Хранитель вошёл на карту.'
      : `ЭЛИТА: ${chassisName[e.chassis ?? 'marshal']}.`;
  if (e.type === 'EliteReacquired')
    return 'Элитка вернулась в боевую зону: от неё нельзя просто уйти.';
  if (e.type === 'PoiAwakened')
    return `Узел карты активирован: ${poiLabel(e.kind)}. Здесь карта управляет сборкой, а не создаёт ещё одну элитку.`;
  if (e.type === 'PoiCleared') return `Узел очищен: ${poiLabel(e.kind)}.`;
  if (e.type === 'BossSpawned')
    return e.supports
      ? `ХРАНИТЕЛЬ: финальный бой начался. Неочищенные узлы привели стражей: ${e.supports}.`
      : 'ХРАНИТЕЛЬ: финальный бой начался без поддержки узлов.';
  if (e.type === 'BossPhase') return `ХРАНИТЕЛЬ: фаза ${e.phase}. Атаки ускорились.`;
  if (e.type === 'BossPattern')
    return `Хранитель: ${e.pattern === 'sweep' ? 'СЕКТОРНЫЙ ВЗМАХ' : e.pattern === 'rupture' ? 'РАЗЛОМ ПО ЛИНИИ' : 'ТАРАН'}.`;
  if (e.type === 'EntityDied' && e.boss) return 'Хранитель уничтожен. Забег завершён.';
  if (e.type === 'EntityDied' && e.elite) return 'Элитка уничтожена.';
  if (e.type === 'EliteOrder') {
    const m = {
      surge: 'Маршал: НАТИСК.',
      pack: 'Стая перестраивается.',
      screen: 'Элита ставит заслон.',
      wall: 'Элита формирует стену.',
      harvest: 'Элита начинает сбор.',
      regroup: 'Элита перегруппировывается.',
      brood: 'Элита вызывает выводок.',
      archive: 'Архивист: скопирована роль.',
      predator: 'Хищник зафиксировал траекторию: сейчас будет перехват.',
      veil: `Завеса развернула ${e.count ?? 3} зоны тумана: дальний автоматический захват цели внутри глохнет.`,
      replicate: 'Репликатор породил копию от частых попаданий. Уничтожение копии бьёт оригинал.',
      prism:
        'Призма запомнила источник. Повторять его подряд невыгодно — смена источника вскрывает защиту.',
      null: `Нуль-ткач поглотил производное событие. Заряд: ${e.count ?? 1}; прямые такты разбивают заряды.`,
      metamorph: 'Метаморф сменил форму по сигнатуре последних попаданий.'
    };
    return m[e.order];
  }
  if (e.type === 'LevelUp') return `Уровень ядра ${e.level}: базовая мощность всей цепочки выросла.`;
  if (e.type === 'MutationChosen')
    return `${skills[e.skill].name}: мутация «${mutationDef(e.skill, e.mutation).name}».`;
  if (e.type === 'EnemyRevived') return 'Палимпсест переписал себя и вернулся в бой.';
  if (e.type === 'Reaction') {
    const n = {
      thermal_shock: 'ТЕРМОШОК',
      detonation: 'ДЕТОНАЦИЯ',
      conduit: 'ПРОВОДНИК',
      echo: 'ЭХО',
      aegis: 'ЭГИДА'
    };
    return n[e.reaction];
  }
  // D7: exactly one declined card is conceded, and the hero is told which one.
  if (e.type === 'RewardRefused')
    return `Отвергнуто: «${e.title}». Карта ушла элитам и вернётся против тебя.`;
  if (e.type === 'RivalCast') return `Элита применила отражение отвергнутого феномена: ${skills[e.skill].name}.`;
  if (e.type === 'EliteEchoPhase')
    return `Отражение элиты · ${skills[e.skill].name}: ${e.phase === 'tell' ? 'подготовка' : e.phase === 'active' ? 'удар' : 'окно восстановления'}.`;
  if (e.type === 'RareEvent') return `${e.title}: ${e.detail}`;
  // D14: a relic is a shared source, so losing one to an elite has to be stated as a loss.
  if (e.type === 'RelicAppeared') return `На поле появилась находка: ${e.name}.`;
  if (e.type === 'RelicTaken')
    return e.byHero
      ? `Взято: ${e.name}. ${e.description}`
      : `Находку забрала элита: ${e.name}. Она стала опаснее.`;
  return null;
}
function poiLabel(kind: string) {
  return kind === 'phenomenon'
    ? 'АРХИВ ФЕНОМЕНА'
    : kind === 'catalyst'
      ? 'УЗЕЛ КАТАЛИЗАТОРА'
      : kind === 'resonance'
        ? 'УЗЕЛ ЯДРА'
        : 'ВИТАЛЬНЫЙ УЗЕЛ';
}
function eliteAlert(e: GameEvent): [string, string] | null {
  if (e.type === 'BossSpawned')
    return [
      'ХРАНИТЕЛЬ · ФИНАЛЬНЫЙ БОСС',
      e.supports
        ? `Неочищенные узлы усилили финал: вместе с боссом пришло стражей ${e.supports}. Красная геометрия = атака.`
        : 'Архив зачищен достаточно глубоко: дополнительных стражей узлов нет. Красная геометрия = атака.'
    ];
  if (e.type === 'BossPhase')
    return [
      'ХРАНИТЕЛЬ · ФАЗА 2',
      'Атаки быстрее, появляются подкрепления. После атак Хранитель всё ещё уязвим.'
    ];
  if (e.type === 'BossPattern')
    return [
      e.pattern === 'sweep' ? 'СЕКТОРНЫЙ ВЗМАХ' : e.pattern === 'rupture' ? 'РАЗЛОМ' : 'ТАРАН',
      e.pattern === 'sweep'
        ? 'Выйди из подсвеченного сектора.'
        : e.pattern === 'rupture'
          ? 'Уйди с широкой линии до удара.'
          : 'Сместись поперёк красной линии; после тарана атакуй.'
    ];
  if (e.type === 'PoiAwakened')
    return [poiLabel(e.kind), 'Источник найден — выбери награду этого типа.'];
  if (e.type === 'PoiCleared') return ['УЗЕЛ ОЧИЩЕН', `${poiLabel(e.kind)} теперь безопасен.`];
  if (e.type === 'EntitySpawned' && e.kind === 'elite' && !e.boss) {
    const c = e.chassis ?? 'marshal';
    return [
      `${chassisName[c].toUpperCase()} · ${affixName[e.affix ?? 'none'].toUpperCase()}`,
      `${chassisRole[c]}${e.affix && e.affix !== 'none' ? ` · ${affixRole[e.affix] ?? ''}` : ''}`
    ];
  }
  if (e.type === 'EliteReacquired')
    return [
      'ЭЛИТА ПЕРЕХВАТИЛА ТЕБЯ',
      'Дистанция не сбрасывает бой: элита возвращена рядом с игроком.'
    ];
  if (e.type === 'EliteEchoPhase' && e.phase === 'tell')
    return [`ОТРАЖЕНИЕ · ${skills[e.skill].shortName.toUpperCase()}`, 'ПОДГОТОВКА — красная геометрия показывает опасную область до удара.'];
  if (e.type === 'RareEvent') return [e.title, e.detail];
  // Chassis actions are frequent combat language now. Local red geometry + the threat
  // panel carry them; a full-width banner for every action would recreate the same clutter.
  if (e.type === 'EliteOrder') return null;
  return null;
}
function showEliteAlert(title: string, body: string, duration = 3400, rare = false) {
  const now = performance.now();
  // A frequent Echo tell must never erase a rare structural event before the player can read it.
  if (!rare && now < rareAlertUntil) return;
  if (rare) rareAlertUntil = Math.max(rareAlertUntil, now + duration);
  const token = ++eliteAlertToken,
    el = $('eliteAlert');
  $('eliteAlertTitle').textContent = title;
  $('eliteAlertBody').textContent = body;
  el.classList.toggle('rare', rare);
  el.classList.add('visible');
  setTimeout(() => {
    if (token === eliteAlertToken) {
      el.classList.remove('visible');
      el.classList.remove('rare');
    }
  }, duration);
}
function pushEvents(events: readonly GameEvent[]) {
  for (const e of events) {
    const t = eventText(e);
    if (t) pushLog(t);
    const a = eliteAlert(e);
    if (a) {
      if (e.type === 'EliteEchoPhase') showEliteAlert(a[0], a[1], 1150, false);
      else if (e.type === 'RareEvent') showEliteAlert(a[0], a[1], 2600, true);
      else showEliteAlert(...a);
    }
    if (e.type === 'DamageResolved') {
      const now = sim.time,
        prev = [...combatFloats]
          .reverse()
          .find((f) => f.kind !== 'catalyst' && f.entity === e.entity && now - f.start < 0.11);
      if (prev) {
        prev.amount += e.amount;
        prev.text = String(Math.max(1, Math.round(prev.amount)));
        prev.start = now;
        prev.x = e.x;
        prev.z = e.z;
        prev.kind = e.crit ? 'crit' : prev.kind;
      } else
        combatFloats.push({
          entity: e.entity,
          x: e.x,
          z: e.z,
          text: String(Math.max(1, Math.round(e.amount))),
          amount: e.amount,
          start: now,
          ttl: 0.72,
          kind: e.crit ? 'crit' : 'damage'
        });
    } else if (e.type === 'CatalystTriggered') {
      const snap = sim.snapshot(),
        from = snap.chain.slots[e.fromSlot],
        to = snap.chain.slots[e.toSlot],
        label = catalysts[e.catalyst].shortName.toUpperCase();
      combatFloats.push({
        entity: -1,
        x: (e.sourceX + e.targetX) / 2,
        z: (e.sourceZ + e.targetZ) / 2,
        text: label,
        amount: 0,
        start: sim.time,
        ttl: 0.88,
        kind: 'catalyst'
      });
      const edge = document.querySelector<HTMLElement>(`#chain .edge[data-edge="${e.fromSlot}"]`);
      edge?.classList.add('fired');
      setTimeout(() => edge?.classList.remove('fired'), 520);
      if (!seenCatalystTriggers.has(e.catalyst)) {
        seenCatalystTriggers.add(e.catalyst);
        showEliteAlert(
          'СВЯЗЬ СРАБОТАЛА',
          `${from ? skills[from].name : '?'} → ${catalysts[e.catalyst].shortName} → ${to ? skills[to].name : '?'}. Цветной импульс показывает причинный маршрут.`
        );
      }
    } else if (e.type === 'CatalystChoreography') {
      const snap = sim.snapshot(),
        from = snap.chain.slots[e.fromSlot],
        to = snap.chain.slots[e.toSlot],
        label = catalysts[e.catalyst].shortName.toUpperCase(),
        explanation =
          e.mode === 'source'
            ? 'Правый феномен возник из точки, где закончился левый.'
            : e.mode === 'carrier'
              ? 'Правый феномен разыгрался из физических объектов левого.'
              : e.mode === 'trail'
                ? 'Правый феномен повторил путь, который только что прочертил левый.'
                : e.mode === 'reverse'
                  ? 'Правый феномен стартовал в конце пути левого и пошёл обратно.'
                  : 'Правый феномен использовал область левого и сошёлся к её центру.';
      combatFloats.push({
        entity: -1,
        x: e.centerX,
        z: e.centerZ,
        text: label,
        amount: 0,
        start: sim.time,
        ttl: 0.92,
        kind: 'catalyst'
      });
      const edge = document.querySelector<HTMLElement>(`#chain .edge[data-edge="${e.fromSlot}"]`);
      edge?.classList.add('fired');
      setTimeout(() => edge?.classList.remove('fired'), 620);
      if (!seenCatalystTriggers.has(e.catalyst)) {
        seenCatalystTriggers.add(e.catalyst);
        showEliteAlert(
          `СВЯЗКА · ${label}`,
          `${from ? skills[from].name : '?'} → ${to ? skills[to].name : '?'}. ${explanation}`
        );
      }
    } else if (e.type === 'RivalCast') {
      // The refused card is fired back at the hero: name it on the spot, not only in the log.
      combatFloats.push({
        entity: -1,
        x: e.x,
        z: e.z,
        text: skills[e.skill].shortName.toUpperCase(),
        amount: 0,
        start: sim.time,
        ttl: 1.05,
        kind: 'catalyst'
      });
      if (!seenRivalCasts.has(e.skill)) {
        seenRivalCasts.add(e.skill);
        showEliteAlert(
          'ТВОЙ ОТКАЗ ВЕРНУЛСЯ',
          `${skills[e.skill].name} — способность, которую ты не взял. Теперь её применяет элита. Отказ не исчезает из мира, он меняет сторону.`
        );
      }
    }
  }
  while (combatFloats.length > 90) combatFloats.shift();
}

function updateChain(s: Snapshot) {
  const sig =
    s.chain.slots.join('|') +
    '#' +
    s.chain.catalysts.join('|') +
    '#' +
    s.skills.map((x) => `${x.id}:${x.mutation}:${x.mutationUpgrade}`).join('|') +
    '#' +
    s.chain.catalystRuntime.map((c) => c.id).join('|') +
    '#' +
    s.player.level +
    '#' +
    s.mutationCores;
  if (sig !== chainSignature) {
    chainSignature = sig;
    const rt = new Map(s.skills.map((x) => [x.id, x]));
    const root = $('chain');
    root.innerHTML = '';
    s.chain.slots.forEach((id, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot' + (id ? '' : ' empty');
      slot.dataset.slot = String(i);
      slot.title = 'Для перестановки нажмите ↹.';
      if (id) {
        const st = rt.get(id)!,
          md = st.mutation ? mutationDef(id, st.mutation) : null,
          md2 = st.mutationUpgrade ? mutationDef(id, st.mutationUpgrade) : null;
        slot.innerHTML = `<img src="${skillVisualIcon(id, !!st.mutation)}" alt=""><div style="min-width:0"><div class="slotnum">ТАКТ ${i + 1}</div><div class="slotname">${esc(skills[id].name)}</div><div class="slotlvl">Ядро ${s.player.level}</div><div class="slotmut">${md ? '↳ ' + esc(md.name) + (md2 ? ' → ' + esc(md2.name) : '') : 'базовая форма'}</div></div>`;
      } else
        slot.innerHTML = `<div class="noicon">—</div><div><div class="slotnum">ТАКТ ${i + 1}</div><div class="slotname">Пусто</div><div class="slotlvl">пустой хвост не тратит такт</div></div>`;
      root.append(slot);
      if (i < s.chain.catalysts.length) {
        const cid = s.chain.catalysts[i],
          edge = document.createElement('div');
        edge.className = 'edge';
        edge.dataset.edge = String(i);
        if (cid) {
          const cd = catalysts[cid],
            left = s.chain.slots[i],
            right = s.chain.slots[i + 1],
            compatible = !!left && !!right && catalystPairCompatible(cid, left, right);
          edge.classList.add(compatible ? 'compatible' : 'incompatible');
          edge.title = compatible
            ? `${cd.desc}\nРАБОТАЕТ: ${skills[left!].name} → ${skills[right!].name}`
            : `${cd.desc}\nНЕСОВМЕСТИМО с текущей парой.`;
          edge.style.setProperty('--cat-color', cd.color);
          edge.innerHTML = compatible
            ? `<div class="catdot"></div><b>${esc(cd.shortName)}</b><span>связь работает</span>`
            : `<div class="catdot"></div><b>⚠ ${esc(cd.shortName)}</b><span>не совместим</span>`;
        } else edge.innerHTML = '<b>—</b><span>пусто</span>';
        root.append(edge);
      }
    });
  }
  document
    .querySelectorAll<HTMLElement>('#chain .slot')
    .forEach((x) => x.classList.toggle('active', Number(x.dataset.slot) === s.chain.beat));
  document
    .querySelectorAll<HTMLElement>('#chain .edge')
    .forEach((x) => x.classList.toggle('active', Number(x.dataset.edge) === s.chain.beat - 1));
  $('chainInfo').textContent =
    `цикл ${s.chain.cycle + 1} · темп +${Math.round(s.chain.tempo * 100)}% · ↹ = сборка`;
}
function attachPlannerDnD(el: HTMLElement) {
  el.addEventListener('dragstart', (e) => {
    e.dataTransfer?.setData('text/plain', el.dataset.drag ?? '');
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => el.classList.remove('dragging'));
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.classList.add('drop');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drop');
    const src = e.dataTransfer?.getData('text/plain') ?? '',
      dst = el.dataset.drag ?? '';
    const a = src.split(':'),
      b = dst.split(':');
    if (a.length !== 3 || b.length !== 3 || a[0] !== b[0]) return;
    let ok = false;
    if (a[0] === 'skill')
      ok = sim.swapSkillLocations(
        a[1] as 'active' | 'reserve',
        Number(a[2]),
        b[1] as 'active' | 'reserve',
        Number(b[2])
      );
    else
      ok = sim.swapCatalystLocations(
        a[1] as 'active' | 'reserve',
        Number(a[2]),
        b[1] as 'active' | 'reserve',
        Number(b[2])
      );
    if (ok) {
      chainSignature = '';
      plannerSignature = '';
      const ns = sim.snapshot();
      updatePlanner(ns);
      updateChain(ns);
      pushLog(a[0] === 'skill' ? 'План: феномен переставлен.' : 'План: катализатор переставлен.');
    }
  });
}
function plannerSkillNode(
  id: SkillId | null,
  zone: 'active' | 'reserve',
  idx: number,
  s: Snapshot
) {
  const el = document.createElement('div');
  el.className = 'pnode skill' + (id ? '' : ' empty');
  el.draggable = true;
  el.dataset.drag = `skill:${zone}:${idx}`;
  if (id) {
    const st = s.skills.find((x) => x.id === id)!,
      d = skills[id],
      md = st.mutation ? mutationDef(id, st.mutation) : null,
      md2 = st.mutationUpgrade ? mutationDef(id, st.mutationUpgrade) : null;
    const radius = d.baseRadius ? d.baseRadius.toFixed(1) : '—',
      range = d.baseRange ? d.baseRange.toFixed(1) : '—';
    const md3 = st.mutationApotheosis ? mutationDef(id, st.mutationApotheosis) : null;
    el.innerHTML = `<img src="${skillVisualIcon(id, !!st.mutation)}" alt=""><div class="nm">${esc(d.name)}</div><div class="sm">Уровень ядра ${s.player.level} · дальность ${range} · радиус ${radius}</div><div class="effect"><b>${esc(d.identity ?? '')}</b>${d.weakness ? `<br>Слабость: ${esc(d.weakness)}` : ''}${md ? `<br>Мутация: ${esc(md.name)}${md2 ? ` → ${esc(md2.name)}` : ''}${md3 ? ` → ${esc(md3.name)}` : ''}` : ''}</div>`;
  } else el.innerHTML = '<div>пустой<br>слот</div>';
  attachPlannerDnD(el);
  return el;
}
function plannerCatNode(
  id: CatalystId | null,
  zone: 'active' | 'reserve',
  idx: number,
  s: Snapshot
) {
  const el = document.createElement('div');
  el.className = 'pnode cat' + (id ? '' : ' empty');
  el.draggable = true;
  el.dataset.drag = `cat:${zone}:${idx}`;
  if (id) {
    const d = catalysts[id],
      left = zone === 'active' ? s.chain.slots[idx] : null,
      right = zone === 'active' ? s.chain.slots[idx + 1] : null,
      compatible = zone !== 'active' || (!!left && !!right && catalystPairCompatible(id, left, right));
    el.classList.add(compatible ? 'compatible' : 'incompatible');
    el.style.setProperty('--cat-color', d.color);
    const state =
      zone !== 'active'
        ? 'РЕЗЕРВ · поставьте между совместимой парой'
        : compatible
          ? `СВЯЗЬ РАБОТАЕТ · ${skills[left!].shortName} → ${skills[right!].shortName}`
          : '⚠ НЕСОВМЕСТИМО · переставьте феномены или катализатор';
    el.innerHTML = `<div class="catdot"></div><div class="nm">${esc(d.name)}</div><div class="sm">${esc(state)}</div><div class="effect">${esc(d.desc)}</div>`;
  } else el.innerHTML = '<div>пустой<br>слот</div>';
  attachPlannerDnD(el);
  return el;
}
function updatePlanner(s: Snapshot) {
  if (!planning) return;
  const sig =
    s.chain.slots.join('|') + '#' + s.chain.skillReserve.join('|') + '#' +
    s.chain.catalysts.join('|') + '#' + s.chain.catalystReserve.join('|') + '#' +
    s.skills.map((x) => `${x.id}:${x.mutation}:${x.mutationUpgrade}:${x.mutationApotheosis}`).join('|') + '#' +
    JSON.stringify(s.resonance) + '#' + JSON.stringify(s.doctrines) + '#' +
    s.heldItems.join('|') + '#' + s.mutationCores + '#' + s.player.level + '#' +
    [s.player.hp,s.player.maxHp,s.player.barrier,s.player.armor,s.player.moveSpeed,s.player.pickupRadius,s.player.power,s.player.fortune,s.player.dashCharge].map(x=>Number(x).toFixed(2)).join(':');
  if (sig === plannerSignature) return;
  plannerSignature = sig;
  const chain = $('plannerChain');
  chain.innerHTML = '';
  for (let i = 0; i < s.chain.slots.length; i++) {
    chain.append(plannerSkillNode(s.chain.slots[i], 'active', i, s));
    if (i < s.chain.catalysts.length) chain.append(plannerCatNode(s.chain.catalysts[i], 'active', i, s));
  }
  const reserve = $('plannerReserve');
  reserve.innerHTML = '';
  s.chain.skillReserve.forEach((id, i) => reserve.append(plannerSkillNode(id, 'reserve', i, s)));
  s.chain.catalystReserve.forEach((id, i) => reserve.append(plannerCatNode(id, 'reserve', i, s)));
  $('plannerStats').innerHTML =
    `<span>Уровень ядра <b>${s.player.level}</b></span><span>Темп <b>+${Math.round(s.chain.tempo * 100)}%</b></span>` +
    `<span>Мощность <b>+${Math.round(s.player.power * 100)}%</b></span><span>Скорость <b>${s.player.moveSpeed.toFixed(2)}</b></span>` +
    `<span>Радиус подбора <b>${s.player.pickupRadius.toFixed(1)}</b></span><span>Ядра мутации <b>${s.mutationCores}</b></span>`;

  $('plannerCharacter').innerHTML = [
    ['Здоровье', `${Math.ceil(s.player.hp)} / ${Math.round(s.player.maxHp)}`],
    ['Барьер', `${Math.ceil(s.player.barrier)}`],
    ['Броня', `${Math.round(s.player.armor)}`],
    ['Скорость', s.player.moveSpeed.toFixed(2)],
    ['Рывок', s.player.dashReady ? 'готов' : `${Math.round(s.player.dashCharge * 100)}%`],
    ['Подбор', s.player.pickupRadius.toFixed(1)],
    ['Удача', s.player.fortune.toFixed(2)],
    ['Опыт', `${Math.floor(s.player.xp)} / ${s.player.xpNeed}`]
  ].map(([k,v])=>`<div class="sheet-stat"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');

  const doctrineEntries = Object.entries(s.doctrines).filter(([,n])=>n>0);
  $('plannerDoctrines').innerHTML = doctrineEntries.length ? doctrineEntries.map(([id,n])=>{
    const d=doctrines[id as keyof typeof doctrines];
    return `<div class="sheet-doctrine"><i style="color:${d.color}">${esc(d.glyph)}</i><div><b>${esc(d.name)} · ${n}</b><span>${esc(d.description)}</span></div></div>`;
  }).join('') : '<div class="sheet-empty">Специализации ещё не выбраны.</div>';

  const counts=new Map<string,number>();
  for(const id of s.heldItems) counts.set(id,(counts.get(id)??0)+1);
  $('plannerItems').innerHTML = counts.size ? [...counts].map(([id,n])=>{
    const d=itemDefs[id as keyof typeof itemDefs];
    return `<div class="sheet-item"><i style="color:${itemCategoryColor[d.category]}">${esc(itemGlyph[id as keyof typeof itemGlyph])}</i><div><b>${esc(d.name)}${n>1?` ×${n}`:''}</b><span>${esc(itemCategoryName[d.category])} · ${esc(d.description)}</span></div></div>`;
  }).join('') : '<div class="sheet-empty">Предметов пока нет.</div>';

  const r=s.resonance;
  let itemDamage=1, eliteDamage=1, critAdd=0;
  for(const id of s.heldItems){
    const effect=itemDefs[id].effect;
    if(effect.kind==='damageMul') itemDamage*=effect.amount;
    else if(effect.kind==='eliteDamageMul') eliteDamage*=effect.amount;
    else if(effect.kind==='crit') critAdd+=effect.amount;
  }
  const corePower=1+Math.max(0,s.player.level-1)*0.075,
    might=1+s.doctrines.might*0.11,
    baseDamage=corePower*(1+s.player.power)*might*itemDamage,
    size=1+s.doctrines.size*0.12,
    duration=1+s.doctrines.duration*0.14,
    quantity=Math.min(3,Math.floor(s.doctrines.quantity/2));
  $('plannerDerived').innerHTML = [
    ['Базовый урон', `×${baseDamage.toFixed(2)}`],
    ['Против элит', `×${eliteDamage.toFixed(2)}`],
    ['Крит от предметов', `+${Math.round(critAdd*100)}%`],
    ['Масштаб', `×${size.toFixed(2)}`],
    ['Длительность', `×${duration.toFixed(2)}`],
    ['Доп. сущности', quantity ? `+${quantity}` : '—'],
    ['Темп ядра', r.tempo.toFixed(2)],
    ['Катализаторы', r.conductivity.toFixed(2)]
  ].map(([k,v])=>`<div class="sheet-stat"><span>${esc(String(k))}</span><b>${esc(String(v))}</b></div>`).join('');
}

const eliteRarityName: Record<string, string> = {
  common: '',
  uplifted: 'УСИЛЕННЫЙ',
  legendary: 'ЛЕГЕНДАРНЫЙ'
};
function eliteName(e: Snapshot['entities'][number]) {
  const aff = e.affix ?? 'none';
  // Colour alone is too weak a channel for the three tiers of D9, so the tier is also spelled out.
  const rar = e.boss ? '' : (eliteRarityName[e.eliteRarity ?? 'common'] ?? '');
  return `${rar ? rar + ' ' : ''}${e.boss ? 'ХРАНИТЕЛЬ' : chassisName[e.chassis ?? 'marshal']}${aff !== 'none' ? ' · ' + affixName[aff] : ''}`;
}
function resize2d(c: HTMLCanvasElement) {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
    w = Math.max(1, Math.floor(c.clientWidth * dpr)),
    h = Math.max(1, Math.floor(c.clientHeight * dpr));
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
function drawMinimap(s: Snapshot) {
  const ctx = resize2d(minimap), w=minimap.clientWidth, h=minimap.clientHeight, pad=10;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#071018d9';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#426272';ctx.lineWidth=1;ctx.strokeRect(pad,pad,w-pad*2,h-pad*2);
  const tx=(x:number)=>pad+((x-s.world.minX)/(s.world.maxX-s.world.minX))*(w-pad*2),
    ty=(z:number)=>pad+((z-s.world.minZ)/(s.world.maxZ-s.world.minZ))*(h-pad*2);
  for(const p of s.world.pois){ctx.globalAlpha=p.state==='cleared'?0.18:1;drawMapPoi(ctx,p.kind,tx(p.x),ty(p.z),p.state==='guarded',s.world.bossSpawned&&p.state!=='cleared');}
  ctx.globalAlpha=1;
  for(const r of s.relics){const x=tx(r.x),y=ty(r.z);ctx.fillStyle=relicMinimapTint[r.category]??'#fff';ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+5,y);ctx.lineTo(x,y+5);ctx.lineTo(x-5,y);ctx.closePath();ctx.fill();if(r.contested){ctx.strokeStyle='#ff4b4b';ctx.lineWidth=1.7;ctx.strokeRect(x-7,y-7,14,14);}}
  for(const q of s.pickups){if(q.kind!=='heal'&&q.kind!=='mutation'&&q.kind!=='core')continue;const x=tx(q.x),y=ty(q.z);ctx.strokeStyle=q.kind==='heal'?'#7bffae':q.kind==='mutation'?'#d59cff':'#75e5ff';ctx.lineWidth=2;if(q.kind==='heal'){ctx.beginPath();ctx.moveTo(x-4,y);ctx.lineTo(x+4,y);ctx.moveTo(x,y-4);ctx.lineTo(x,y+4);ctx.stroke();}else{ctx.strokeRect(x-3,y-3,6,6);}}
  for(const e of s.entities){if(!e.elite)continue;const x=tx(e.x),y=ty(e.z);drawEliteMapMarker(ctx,e,x,y,e.boss?7:5);if(e.affix&&e.affix!=='none'){ctx.fillStyle=affixUiTint[e.affix]??'#fff';ctx.fillRect(x+5,y-7,3,3);}}
  // Player is an arrow, not another ambiguous map dot.
  const px=tx(s.player.x),py=ty(s.player.z),a=Math.atan2(s.player.aimZ,s.player.aimX),rr=6;
  ctx.fillStyle='#8ffff0';ctx.beginPath();ctx.moveTo(px+Math.cos(a)*rr,py+Math.sin(a)*rr);ctx.lineTo(px+Math.cos(a+2.5)*4,py+Math.sin(a+2.5)*4);ctx.lineTo(px+Math.cos(a-2.5)*4,py+Math.sin(a-2.5)*4);ctx.closePath();ctx.fill();
}
const hudImageCache = new Map<string, HTMLImageElement>();
function hudImage(src: string): HTMLImageElement | null {
  let img = hudImageCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    hudImageCache.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}
// Three tiers have to separate at a glance in a crowd, so they separate by brightness as well
// as by hue: plain white for the common tier, blue for the uplifted one, and a gold that
// outshines everything else on a floor this dark for the legendary.
const relicMinimapTint: Record<string, string> = {
  guard: '#7fe4ff',
  edge: '#ff7a6b',
  pace: '#9dff7a',
  finding: '#ffd75e',
  elite: '#d98cff'
};
/**
 * What the hero is carrying, as a strip of short codes. Relics stack without slots by D14,
 * so the only way the choice stays legible is to keep the whole haul on screen at once.
 */
function drawHeldItems(ctx: CanvasRenderingContext2D, s: Snapshot) {
  if (!s.heldItems.length) return;
  const counts = new Map<string, number>();
  for (const id of s.heldItems) counts.set(id, (counts.get(id) ?? 0) + 1);
  const entries = [...counts.entries()];
  const w = 46,
    h = 18,
    gap = 4;
  let x = 18;
  const y = ctx.canvas.height / (window.devicePixelRatio || 1) - 30;
  ctx.save();
  ctx.font = '600 10px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [id, n] of entries) {
    const def = itemDefs[id as keyof typeof itemDefs];
    if (!def) continue;
    ctx.fillStyle = 'rgba(8,11,18,0.82)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = relicMinimapTint[def.category] ?? '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    const glyph = itemGlyph[id as keyof typeof itemGlyph] ?? '◇';
    ctx.fillStyle = itemCategoryColor[def.category] ?? '#e8eef8';
    ctx.font = '900 15px system-ui';
    ctx.fillText(glyph, x + (n > 1 ? w * 0.4 : w / 2), y + h / 2 + 0.5);
    if (n > 1) {
      ctx.fillStyle = '#e8eef8';
      ctx.font = '800 9px system-ui';
      ctx.fillText(`×${n}`, x + w * 0.72, y + h / 2 + 0.5);
    }
    x += w + gap;
    if (x > ctx.canvas.width / (window.devicePixelRatio || 1) - w) break;
  }
  ctx.restore();
}
const rarityTint: Record<string, string> = {
  common: '#eef3fa',
  uplifted: '#4fa8ff',
  legendary: '#ffc83d'
};
function eliteTint(e: Snapshot['entities'][number]): string {
  return rarityTint[e.eliteRarity ?? 'common'] ?? rarityTint.common;
}
function drawEliteMapMarker(
  ctx: CanvasRenderingContext2D,
  e: Snapshot['entities'][number],
  x: number,
  y: number,
  r = 7
) {
  const ch=e.chassis??'marshal', c=chassisUiTint[ch]??'#fff';
  ctx.save();
  ctx.strokeStyle=c; ctx.fillStyle=c; ctx.lineWidth=Math.max(1.5,r*0.24);
  ctx.lineCap='round'; ctx.lineJoin='round';
  if(ch==='hunter'){
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x-r*.75,y-r*.72);ctx.lineTo(x-r*.35,y);ctx.lineTo(x-r*.75,y+r*.72);ctx.closePath();ctx.fill();
  } else if(ch==='bulwark'){
    ctx.strokeRect(x-r*.72,y-r*.72,r*1.44,r*1.44);ctx.beginPath();ctx.moveTo(x,y-r*.72);ctx.lineTo(x,y+r*.72);ctx.stroke();
  } else if(ch==='architect'){
    ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();ctx.stroke();
    ctx.strokeRect(x-r*.28,y-r*.28,r*.56,r*.56);
  } else if(ch==='harvester'){
    ctx.beginPath();ctx.arc(x,y,r*.76,-Math.PI*.72,Math.PI*.72);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+r*.55,y-r*.58);ctx.lineTo(x+r*.95,y-r*.9);ctx.stroke();
  } else if(ch==='shepherd'){
    ctx.beginPath();ctx.moveTo(x,y+r);ctx.lineTo(x,y-r);ctx.moveTo(x,y-r*.35);ctx.lineTo(x-r*.7,y-r*.85);ctx.moveTo(x,y-r*.35);ctx.lineTo(x+r*.7,y-r*.85);ctx.stroke();
  } else if(ch==='broodmaker'){
    for(const [dx,dy] of [[0,-.62],[-.58,.45],[.58,.45]] as const){ctx.beginPath();ctx.arc(x+dx*r,y+dy*r,r*.27,0,Math.PI*2);ctx.fill();}
  } else if(ch==='archivist'){
    ctx.strokeRect(x-r*.82,y-r*.72,r*.67,r*1.44);ctx.strokeRect(x+r*.15,y-r*.72,r*.67,r*1.44);
  } else if(ch==='warden'){
    ctx.beginPath();for(let i=0;i<8;i++){const a=-Math.PI/8+i*Math.PI/4,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.stroke();
  } else {
    ctx.beginPath();ctx.moveTo(x-r*.35,y+r);ctx.lineTo(x-r*.35,y-r);ctx.moveTo(x-r*.35,y-r*.82);ctx.lineTo(x+r*.75,y-r*.45);ctx.lineTo(x-r*.35,y-.05*r);ctx.stroke();
  }
  const rarity=e.boss?'legendary':(e.eliteRarity??'common');
  if(rarity!=='common'){
    ctx.strokeStyle=rarity==='legendary'?'#ffe06a':'#67b7ff';
    ctx.lineWidth=Math.max(1.2,r*.18);
    ctx.beginPath();ctx.arc(x,y,r*1.35,-Math.PI*.82,-Math.PI*.18);ctx.stroke();
    ctx.beginPath();ctx.arc(x,y,r*1.35,Math.PI*.18,Math.PI*.82);ctx.stroke();
  }
  ctx.restore();
}
function drawAffixBadge2d(
  ctx: CanvasRenderingContext2D,
  affix: string,
  x: number,
  y: number,
  size = 16
) {
  if(!affix || affix==='none') return;
  ctx.save();
  ctx.fillStyle='rgba(5,9,13,.9)';ctx.strokeStyle=affixUiTint[affix]??'#fff';ctx.lineWidth=1.5;
  ctx.fillRect(x-size/2,y-size/2,size,size);ctx.strokeRect(x-size/2+.5,y-size/2+.5,size-1,size-1);
  ctx.fillStyle=affixUiTint[affix]??'#fff';ctx.font=`900 ${Math.max(10,size*.68)}px system-ui`;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(affixGlyph[affix]??'?',x,y+.5);
  ctx.restore();
}
// D13: the cards an elite took from the hero read on the elite itself.
// A card the hero turned down is only a cost if he can see it being used against him.
// Glyphs alone proved unreadable: six different directions of growth all drew the same
// letter, and an item drew a three-letter code nobody could decode mid-fight. Each held
// card is now a chip with its own colour and its actual name.
const refusalKindTint: Record<string, string> = {
  skill: '#ff8a5c',
  catalyst: '#7fe4ff',
  axis: '#c7a6ff',
  item: '#ffd75e',
  global: '#9dff7a'
};
function drawRefusalRow(
  ctx: CanvasRenderingContext2D,
  icons: string[],
  titles: string[],
  kinds: string[],
  cx: number,
  cy: number,
  tint: string
) {
  // Combat only shows the repertoire as compact pictograms. Full names are inspection-layer
  // information; stacking text over an elite defeats the "recognise, don't read" contract.
  const n=Math.min(icons.length,5);
  if(!n) return;
  const size=18,gap=4,total=n*size+(n-1)*gap,start=cx-total/2+size/2;
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
  for(let i=0;i<n;i++){
    const x=start+i*(size+gap), kindTint=refusalKindTint[kinds[i]]??tint, token=icons[i]??'',
      img=token.indexOf('/')>=0?hudImage(token):null;
    ctx.fillStyle='rgba(5,8,12,.9)';ctx.fillRect(x-size/2,cy-size/2,size,size);
    ctx.strokeStyle=kindTint;ctx.lineWidth=1.2;ctx.strokeRect(x-size/2+.5,cy-size/2+.5,size-1,size-1);
    if(img) ctx.drawImage(img,x-size/2+2,cy-size/2+2,size-4,size-4);
    else {ctx.fillStyle=kindTint;ctx.font='900 9px system-ui';ctx.fillText((token||titles[i]||'•').slice(0,2),x,cy+.5);}
  }
  ctx.restore();
}
// D17 gives the dash one charge with a recovery, so the player has to know when it is back.
// The gauge sits under the hero's feet rather than in a corner: this is a positioning decision
// taken mid-fight, and the eye is on the hero, not on the panel.
function drawDashGauge(ctx: CanvasRenderingContext2D, s: Snapshot) {
  if (s.player.hp <= 0) return;
  const p = renderer.worldToScreen(s.player.x, s.player.z, s),
    cy = p.y + 30,
    r = 15,
    charge = Math.max(0, Math.min(1, s.player.dashCharge));
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0a0f14b0';
  ctx.beginPath();
  ctx.arc(p.x, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  if (charge > 0.001) {
    ctx.strokeStyle = s.player.dashReady ? '#7fe4ff' : '#3d6f86';
    ctx.beginPath();
    ctx.arc(p.x, cy, r, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2);
    ctx.stroke();
  }
  // The invulnerable window is far shorter than the dash itself, so it gets its own mark.
  if (s.player.invulnerable) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 18, 34, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCombatHud(s: Snapshot) {
  const ctx = resize2d(combatHud),
    w = combatHud.clientWidth,
    h = combatHud.clientHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawDashGauge(ctx, s);
  drawHeldItems(ctx, s);
  // Ground items carry their own pictogram at all times. Colour is only the category accent;
  // the symbol is the identity, so two rewards of the same category no longer look identical.
  for (const r of s.relics) {
    const p = renderer.worldToScreen(r.x, r.z, s);
    if (p.x < -26 || p.x > w + 26 || p.y < -26 || p.y > h + 26) continue;
    const d = itemDefs[r.item],
      glyph = itemGlyph[r.item as keyof typeof itemGlyph] ?? '◇',
      tint = itemCategoryColor[d.category] ?? '#fff',
      size = r.contested ? 31 : 27;
    ctx.fillStyle = 'rgba(5,8,12,.9)';
    ctx.fillRect(p.x - size / 2, p.y - 48 - size / 2, size, size);
    ctx.strokeStyle = r.contested ? '#ff3e4f' : tint;
    ctx.lineWidth = r.contested ? 2.5 : 1.5;
    ctx.strokeRect(p.x - size / 2 + .5, p.y - 48 - size / 2 + .5, size - 1, size - 1);
    ctx.fillStyle = tint;
    ctx.font = '900 18px system-ui';
    ctx.fillText(glyph, p.x, p.y - 48);
    if (r.contested) {
      ctx.fillStyle = '#ff3347';
      ctx.beginPath();
      ctx.moveTo(p.x + size / 2 - 7, p.y - 48 - size / 2);
      ctx.lineTo(p.x + size / 2, p.y - 48 - size / 2);
      ctx.lineTo(p.x + size / 2, p.y - 48 - size / 2 + 7);
      ctx.closePath();
      ctx.fill();
    }
  }
  const nearRelic = [...s.relics].sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0];
  if (nearRelic && Math.hypot(nearRelic.x-s.player.x,nearRelic.z-s.player.z) < 5.5) {
    const d=itemDefs[nearRelic.item], p=renderer.worldToScreen(nearRelic.x,nearRelic.z,s), text=`${d.name} · ${d.description}`;
    ctx.font='800 11px system-ui';const tw=Math.min(360,ctx.measureText(text).width+18);ctx.fillStyle='rgba(5,9,13,.88)';ctx.fillRect(p.x-tw/2,p.y-78,tw,24);ctx.strokeStyle=nearRelic.contested?'#ff5b63':(relicMinimapTint[d.category]??'#fff');ctx.strokeRect(p.x-tw/2,p.y-78,tw,24);ctx.fillStyle='#eef7fa';ctx.fillText(text.length>62?text.slice(0,59)+'…':text,p.x,p.y-66);
  }
  const nearPoi=[...s.world.pois].filter(p=>p.state!=='cleared').sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0];
  if(nearPoi && Math.hypot(nearPoi.x-s.player.x,nearPoi.z-s.player.z)<7){const p=renderer.worldToScreen(nearPoi.x,nearPoi.z,s), promise=nearPoi.kind==='phenomenon'?'ВЫБОР НОВОГО ФЕНОМЕНА':nearPoi.kind==='catalyst'?'ВЫБОР КАТАЛИЗАТОРА':nearPoi.kind==='resonance'?'УСИЛЕНИЕ ЯДРА':'ВОССТАНОВЛЕНИЕ';ctx.font='900 11px system-ui';ctx.fillStyle='rgba(5,9,13,.9)';ctx.fillRect(p.x-88,p.y-118,176,22);ctx.strokeStyle='#8ba7b5';ctx.strokeRect(p.x-88,p.y-118,176,22);ctx.fillStyle='#fff';ctx.fillText(promise,p.x,p.y-107);}
  for (const e of s.entities) {
    const p = renderer.worldToScreen(e.x, e.z, s),
      margin = 34,
      off = p.x < margin || p.x > w - margin || p.y < margin || p.y > h - margin;
    if (off) {
      if (e.elite) {
        const x = Math.max(margin, Math.min(w - margin, p.x)),
          y = Math.max(margin, Math.min(h - margin, p.y)),
          r = e.boss ? 11 : 8;
        drawEliteMapMarker(ctx,e,x,y,r);
        if(e.affix&&e.affix!=='none') drawAffixBadge2d(ctx,e.affix,x+r+7,y-r-2,12);
      }
      continue;
    }
    const show = e.elite || e.hp < e.maxHp * 0.995;
    if (!show) continue;
    const bw = e.boss ? 180 : e.elite ? 106 : 44,
      bh = e.boss ? 10 : e.elite ? 7 : 4,
      y = p.y - (e.boss ? 142 : e.elite ? 98 : 54);
    ctx.fillStyle = '#05080bd9';
    ctx.fillRect(p.x - bw / 2, y, bw, bh);
    const tint = e.boss ? '#f4e7c8' : e.elite ? (chassisUiTint[e.chassis??'marshal']??eliteTint(e)) : '#df5262';
    ctx.fillStyle = tint;
    ctx.fillRect(p.x - bw / 2 + 1, y + 1, (bw - 2) * Math.max(0, e.hp / e.maxHp), bh - 2);
    if(e.elite){
      const rarity=e.boss?'legendary':(e.eliteRarity??'common'),
        rc=rarity==='legendary'?'#ffe06a':rarity==='uplifted'?'#67b7ff':'#6d7f8c';
      ctx.strokeStyle=rc;ctx.lineWidth=rarity==='legendary'?2.3:1;
      ctx.strokeRect(p.x-bw/2-.5,y-.5,bw+1,bh+1);
      if(rarity!=='common'){
        const cap=rarity==='legendary'?12:8;
        ctx.beginPath();ctx.moveTo(p.x-bw/2,y-4);ctx.lineTo(p.x-bw/2+cap,y-4);
        ctx.moveTo(p.x+bw/2-cap,y-4);ctx.lineTo(p.x+bw/2,y-4);ctx.stroke();
      }
      drawEliteMapMarker(ctx,e,p.x-bw/2-15,y+bh/2,e.boss?9:7);
      if(e.affix&&e.affix!=='none') drawAffixBadge2d(ctx,e.affix,p.x+bw/2+14,y+bh/2,e.boss?18:15);
      drawRefusalRow(ctx,e.refusalIcons??[],e.refusalTitles??[],e.refusalKinds??[],p.x,y-15,tint);
    }
    if (e.elite && e.affix === 'shielded') {
      const sy=y+bh+4, st=e.shieldState==='broken'?'#9fa9b6':e.shieldState==='commit'?'#ffc261':'#73d9ff';
      ctx.fillStyle='#05080bd9';ctx.fillRect(p.x-bw/2,sy,bw,4);
      ctx.fillStyle=st;ctx.fillRect(p.x-bw/2+1,sy+1,(bw-2)*Math.max(0,Math.min(1,e.shieldStability/100)),2);
    }
    if(e.boss){
      ctx.font='900 12px system-ui';ctx.fillStyle='#fff';ctx.fillText('ХРАНИТЕЛЬ',p.x,y-28);
    }
  }
  const now = s.time;
  for (let i = combatFloats.length - 1; i >= 0; i--) {
    const f = combatFloats[i],
      t = (now - f.start) / f.ttl;
    if (t >= 1) {
      combatFloats.splice(i, 1);
      continue;
    }
    if (t < 0) continue;
    const p = renderer.worldToScreen(f.x, f.z, s),
      rise = 22 * t;
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.font =
      f.kind === 'catalyst'
        ? '800 12px system-ui'
        : f.kind === 'crit'
          ? '900 17px system-ui'
          : '800 13px system-ui';
    ctx.fillStyle = f.kind === 'catalyst' ? '#e2b7ff' : f.kind === 'crit' ? '#fff2a3' : '#fff';
    ctx.strokeStyle = '#05080b';
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, p.x, p.y - 62 - rise);
    ctx.fillText(f.text, p.x, p.y - 62 - rise);
  }
  ctx.globalAlpha = 1;
}
const elitePatternLabel: Record<string,string> = {
  hunter:'ПЕРЕХВАТ', architect:'СМЕЩЕНИЕ И ЗАВЕСА', broodmaker:'ВЫБРОС КОПИИ',
  bulwark:'ФРОНТАЛЬНЫЙ УДАР', harvester:'ЖАТВА', shepherd:'КОМАНДНЫЙ ИМПУЛЬС',
  warden:'АТАКА ХРАНИТЕЛЯ'
};
function eliteIsDangerous(e: Snapshot['entities'][number]) {
  const preparing=e.echoPhase==='tell'||e.telegraph>0|| (!!e.eliteAction&&e.eliteAction!=='predator_dash'),
    active=e.echoPhase==='active'||e.eliteAction==='predator_dash'||(e.boss&&!!e.bossPattern&&e.adaptationStage===1);
  return {preparing,active,dangerous:preparing||active};
}
function updateThreatPanel(s: Snapshot) {
  const box=$('threatPanel'),
    boss=s.entities.find(e=>e.boss),
    elites=s.entities.filter(e=>e.elite&&!e.boss),
    byDistance=(a:typeof elites[number],b:typeof elites[number])=>
      Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z),
    dangerous=[...elites].filter(e=>eliteIsDangerous(e).dangerous).sort(byDistance),
    current=elites.find(e=>e.id===threatFocusId),
    currentDistance=current?Math.hypot(current.x-s.player.x,current.z-s.player.z):Infinity,
    nearest=[...elites].sort(byDistance)[0];

  // Focus is sticky in calm combat so the panel does not become an unreadable ticker. An
  // imminent attack may pre-empt it, and the boss always owns the panel.
  const e=boss??dangerous[0]??(current&&currentDistance<44?current:nearest);
  if(!e){threatFocusId=0;box.classList.remove('visible','danger');return;}
  threatFocusId=e.id;
  box.classList.add('visible');

  const state=eliteIsDangerous(e),
    ch=e.chassis??'marshal',
    aff=e.affix??'none',
    echoTell=e.echoPhase==='tell',
    pattern=echoTell
      ? `ОТРАЖЕНИЕ · ${e.echoSkill?skills[e.echoSkill].name.toUpperCase():'АТАКА'}`
      : e.eliteAction
        ? (eliteActionLabel[e.eliteAction]??elitePatternLabel[ch]??'ОПАСНЫЙ ПРИЁМ')
        : elitePatternLabel[ch]??'ОПАСНЫЙ ПРИЁМ',
    hint=echoTell
      ? 'ВЫЙДИ ИЗ КРАСНОЙ ГЕОМЕТРИИ'
      : e.eliteAction
        ? (eliteActionHint[e.eliteAction]??'ВЫЙДИ ИЗ КРАСНОЙ ГЕОМЕТРИИ')
        : e.boss
          ? 'СМОТРИ НА ФОРМУ КРАСНОЙ АТАКИ'
          : 'ВЫЙДИ ИЗ КРАСНОЙ ГЕОМЕТРИИ';

  box.classList.toggle('danger',state.dangerous);
  $('threatChassisGlyph').textContent=chassisGlyph[ch]??'◆';
  $('threatChassisGlyph').style.color=chassisUiTint[ch]??'#fff';
  $('threatAffixGlyph').textContent=affixGlyph[aff]??'';
  $('threatAffixGlyph').style.color=affixUiTint[aff]??'#fff';
  $('threatTitle').textContent=state.dangerous
    ? `${state.preparing?'ГОТОВИТ':'АТАКУЕТ'} · ${pattern}`
    : e.boss?`ХРАНИТЕЛЬ · ФАЗА ${e.bossPhase}`:chassisName[ch].toUpperCase();
  $('threatRule').textContent=state.dangerous?'КРАСНЫЙ = НЕМЕДЛЕННАЯ ОПАСНОСТЬ':chassisShortRule[ch]??'';
  $('threatBody').textContent=state.dangerous
    ? hint
    : aff!=='none'
      ? `${affixGlyph[aff]??'◇'} ${affixShortRule[aff]??affixName[aff]}`
      : e.refusalIcons?.length
        ? `УСВОЕНО ОТ ТЕБЯ: ${e.refusalIcons.length}`
        : 'БЕЗ ДОПОЛНИТЕЛЬНОГО АФФИКСА';
  $('threatHp').style.width=`${Math.max(0,(e.hp/e.maxHp)*100)}%`;
}
function updateUi(s: Snapshot) {
  const mm = Math.floor(s.time / 60),
    ss = Math.floor(s.time % 60)
      .toString()
      .padStart(2, '0'),
    rm = Math.floor(s.runDuration / 60),
    rs = Math.floor(s.runDuration % 60)
      .toString()
      .padStart(2, '0');
  $('time').textContent = `${mm}:${ss} / ${rm}:${rs}`;
  $('level').textContent = `УРОВЕНЬ ${s.player.level}`;
  $('hpbar').style.width = `${Math.max(0, (s.player.hp / s.player.maxHp) * 100)}%`;
  $('hptext').textContent =
    `ЗДОРОВЬЕ ${Math.ceil(s.player.hp)} / ${Math.round(s.player.maxHp)}${s.player.barrier > 0 ? ` + ${Math.ceil(s.player.barrier)} барьер` : ''}`;
  $('xpbar').style.width = `${Math.max(0, Math.min(100, (s.player.xp / s.player.xpNeed) * 100))}%`;
  $('xptext').textContent = `ОПЫТ ${Math.floor(s.player.xp)} / ${s.player.xpNeed}`;
  const cleared = s.world.pois.filter((p) => p.state === 'cleared').length,
    remaining = Math.max(0, s.runDuration * 0.875 - s.time),
    bossSupport = s.entities.filter((e) => e.elite && !e.boss && e.guardianPoi !== 0).length,
    progress = Math.min(1,s.time/s.runDuration),
    phase = progress < .25 ? 'РАЗГОН' : progress < .55 ? 'НАРАСТАНИЕ' : progress < .85 ? 'ДАВЛЕНИЕ' : 'ФИНАЛ',
    nearestPoi = s.world.pois.filter(p=>p.state!=='cleared').sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0],
    route = nearestPoi ? `${poiLabel(nearestPoi.kind)} ${Math.round(Math.hypot(nearestPoi.x-s.player.x,nearestPoi.z-s.player.z))}м` : 'узлы очищены';
  if(s.world.bossSpawned){
    $('phaseBadge').textContent=s.world.bossDefeated?'ЗАВЕРШЕНО':'ФИНАЛ';
    $('routeBadge').textContent=s.world.bossDefeated?'ХРАНИТЕЛЬ УНИЧТОЖЕН':'ХРАНИТЕЛЬ';
    $('finalBadge').textContent=s.world.bossDefeated?'':(bossSupport?`СТРАЖЕЙ ${bossSupport}`:'БЕЗ СТРАЖЕЙ');
  } else {
    $('phaseBadge').textContent=`${phase} · ${cleared}/${s.world.pois.length}`;
    $('routeBadge').textContent=route;
    $('finalBadge').textContent=`ФИНАЛ ${Math.floor(remaining/60)}:${Math.floor(remaining%60).toString().padStart(2,'0')}`;
  }
  updateThreatPanel(s);
  drawMinimap(s);
  drawCombatHud(s);
  updateChain(s);
  updatePlanner(s);
  syncChoiceUI(s);
  if ((s.player.hp <= 0 || s.finished) && !$('overlay').classList.contains('visible')) {
    $('overlay').classList.add('visible');
    $('overTitle').textContent = s.player.hp <= 0 ? 'Забег окончен' : 'Хранитель уничтожен';
    $('overText').textContent =
      `Уровень ${s.player.level} · убийств ${s.metrics.killed} · элит ${s.metrics.eliteKilled} · очищено узлов ${cleared}/${s.world.pois.length}.`;
  }
}

function closeChoiceModal(clear = true) {
  const wrap = $<HTMLDivElement>('choice');
  wrap.classList.remove('visible');
  wrap.hidden = true;
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.setProperty('display', 'none', 'important');
  wrap.style.pointerEvents = 'none';
  if (clear) {
    $('cards').innerHTML = '';
    $('choiceActions').innerHTML = '';
  }
  dbg('MODAL CLOSE', modalState());
}
function openChoiceModal() {
  const wrap = $<HTMLDivElement>('choice');
  wrap.hidden = false;
  wrap.removeAttribute('hidden');
  wrap.setAttribute('aria-hidden', 'false');
  wrap.style.removeProperty('display');
  wrap.style.pointerEvents = 'auto';
  wrap.classList.add('visible');
  dbg('MODAL OPEN', modalState());
}
function consumeChoiceEvents() {
  try {
    const snap = sim.snapshot(),
      cues = presentation.consume(sim.events, sim.time, snap);
    if (renderer) renderer.consume(cues, snap);
    pushEvents(sim.events);
  } catch (err) {
    console.error(err);
  }
}
function finishChoiceAction(label: string, action: () => boolean) {
  const before = sim.snapshot();
  dbg('CHOICE ACTION', { label, before: snapChoice(before) });
  if (choiceLocked) return;
  choiceLocked = true;
  closeChoiceModal();
  let ok = false;
  try {
    ok = action();
  } catch (err) {
    dbg('CHOICE THROW', { label, error: String(err) });
    pushLog(`Ошибка выбора: ${String(err)}`);
  }
  consumeChoiceEvents();
  const after = sim.snapshot();
  last = performance.now();
  acc = 0;
  if (!ok) {
    renderedChoiceSerial = -1;
    choiceLocked = false;
    suppressChoiceUntil = 0;
    syncChoiceUI(after, true);
    return;
  }
  renderedChoiceSerial = -1;
  suppressChoiceUntil = after.rewardOffers || after.mutationOffer ? performance.now() + 320 : 0;
  choiceLocked = false;
  syncChoiceUI(after);
  setTimeout(
    () => dbg('CHOICE +400ms', { sim: snapChoice(sim.snapshot()), modal: modalState() }),
    400
  );
}
function refreshChoiceAction(label: string, action: () => boolean) {
  if (choiceLocked) return;
  let ok = false;
  try {
    ok = action();
  } catch (err) {
    dbg('CHOICE REFRESH THROW', { label, error: String(err) });
  }
  if (ok) {
    renderedChoiceSerial = -1;
    syncChoiceUI(sim.snapshot(), true);
  }
}
function offerKind(o: RewardOffer) {
  return o.kind === 'skill_add'
    ? 'НОВЫЙ ФЕНОМЕН'
    : o.kind === 'skill_swap'
      ? 'ЗАМЕНА ФЕНОМЕНА'
      : o.kind === 'item_grant'
        ? 'НАХОДКА'
        : o.kind === 'catalyst_add'
          ? 'НОВЫЙ КАТАЛИЗАТОР'
          : o.kind === 'mutation_target'
            ? 'ЯДРО МУТАЦИИ'
            : o.kind === 'resonance'
              ? 'УСИЛЕНИЕ ЯДРА'
              : o.kind === 'elite'
                ? 'ТАЙНИК ЭЛИТЫ'
                : o.kind === 'doctrine'
                  ? 'СПЕЦИАЛИЗАЦИЯ'
                  : 'ОБЩЕЕ УСИЛЕНИЕ';
}
function offerCategory(o: RewardOffer) {
  if (o.kind === 'skill_add' || o.kind === 'skill_swap') return 'phenomenon';
  if (o.kind === 'catalyst_add') return 'catalyst';
  if (o.kind === 'item_grant' || o.kind === 'elite') return 'item';
  if (o.kind === 'resonance') return 'resonance';
  if (o.kind === 'doctrine') return 'doctrine';
  if (o.kind === 'mutation_target') return 'mutation';
  return 'global';
}

function offerIcon(o: RewardOffer): string {
  if (o.skill) return `<img class="choice-icon-img" src="${skillVisualIcon(o.skill, false)}" alt="">`;
  if (o.doctrine) { const d=doctrines[o.doctrine]; return `<span class="choice-glyph" style="color:${d.color}">${esc(d.glyph)}</span>`; }
  if (o.catalyst) return `<span class="choice-glyph catalyst-glyph" style="color:${catalysts[o.catalyst].color}">${esc(catalystGlyph[o.catalyst])}</span>`;
  if (o.item) { const d=itemDefs[o.item]; return `<span class="choice-glyph item-glyph" style="color:${itemCategoryColor[d.category]}">${esc(itemGlyph[o.item])}</span>`; }
  return `<span class="choice-glyph">◆</span>`;
}
function shortPromise(text: string) {
  const first = text.split(/(?<=[.!?])\s/)[0] || text;
  return first.length > 112 ? first.slice(0,109) + '…' : first;
}
function categoryLabel(cat: string) {
  return ({phenomenon:'ФЕНОМЕН',catalyst:'КАТАЛИЗАТОР',item:'ПРЕДМЕТ',resonance:'УСИЛЕНИЕ ЯДРА',doctrine:'СПЕЦИАЛИЗАЦИЯ',mutation:'МУТАЦИЯ',global:'ЯДРО'} as Record<string,string>)[cat] ?? cat.toUpperCase();
}
function syncChoiceUI(s: Snapshot, force = false) {
  const has = !!s.mutationOffer || !!s.rewardOffers,
    wrap = $<HTMLDivElement>('choice'),
    cards = $('cards'),
    actions = $('choiceActions');
  if (!has) {
    if (!wrap.hidden || wrap.classList.contains('visible')) closeChoiceModal();
    renderedChoiceSerial = -1;
    return;
  }
  if (planning) {
    planning = false;
    $('planner').classList.remove('visible');
  }
  if (choiceLocked || (!force && performance.now() < suppressChoiceUntil)) {
    closeChoiceModal(false);
    return;
  }
  if (
    !force &&
    renderedChoiceSerial === s.choiceSerial &&
    !wrap.hidden &&
    wrap.classList.contains('visible')
  )
    return;
  renderedChoiceSerial = s.choiceSerial;
  actions.innerHTML = '';
  cards.innerHTML = '';
  openChoiceModal();
  wrap.dataset.choiceSerial = String(s.choiceSerial);
  const choiceBox = wrap.querySelector<HTMLElement>('.choicebox')!;
  choiceBox.className = 'choicebox';
  if (s.mutationOffer) {
    const m = s.mutationOffer;
    choiceBox.classList.add('cat-mutation');
    if (m.tier === 3) choiceBox.classList.add('apotheosis');
    const tierName = m.tier === 3 ? 'АПОФЕОЗ III' : `МУТАЦИЯ ${m.tier === 1 ? 'I' : 'II'}`;
    $('choiceTitle').textContent = `${m.tier === 3 ? '✦' : '◆'} ${tierName} · ${skills[m.skill].name}`;
    $('choiceSub').textContent = m.tier === 3
      ? 'Финальная трансформация: выбирай новое поведение, а не процент.'
      : 'Выбор ветки меняет поведение феномена; подробности можно открыть без спешки.';
    $('choiceFoot').textContent = m.refusalAvailable
      ? 'Один раз за забег можно заменить один из предложенных вариантов.'
      : 'Замена варианта уже использована.';
    cards.className = m.choices.length > 2 ? 'cards three' : 'cards two';
    m.choices.forEach((id, i) => {
      const d = mutationDef(m.skill, id),
        badge = mutationBadge(m.skill, id),
        card = document.createElement('div');
      card.className = `card cat-mutation branch-${badge.branch} tier-${badge.tier} ${m.tier === 3 ? 'apotheosis' : ''}`;
      card.dataset.choice = String(i);
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.style.setProperty('--rarity', m.tier === 3 ? '#ffd36b' : '#c27aff');
      card.innerHTML = `<span class="choice-key">${i + 1}</span><div class="card-head"><div class="choice-icon"><img class="choice-icon-img" src="${skillVisualIcon(m.skill, true)}" alt=""><span class="mutation-branch branch-${badge.branch}" style="--branch:${badge.tone}"></span><span class="mutation-glyph" style="--branch:${badge.tone}">${esc(badge.glyph)}<i>${badge.tier}</i></span></div><div><div class="tag">${m.tier === 3 ? 'АПОФЕОЗ' : 'МУТАЦИЯ'} · ${esc(d.tag)}</div><h3>${esc(d.name)}</h3></div></div><div class="promise">${esc(shortPromise(d.description))}</div><details><summary>Подробнее</summary><p>${esc(d.description)}</p></details><button class="refuse" ${m.refusalAvailable ? '' : 'disabled'}>Заменить этот вариант</button>`;
      const choose = () =>
        finishChoiceAction(`mutation:${m.skill}:${i}:${id}`, () => sim.chooseMutation(i));
      card.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.refuse')) return;
        choose();
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          choose();
        }
      });
      (card.querySelector('.refuse') as HTMLButtonElement).addEventListener('click', (e) => {
        e.stopPropagation();
        if (m.refusalAvailable) refreshChoiceAction(`refuse:${i}`, () => sim.refuseMutation(i));
      });
      cards.append(card);
    });
  } else if (s.rewardOffers) {
    const elite = s.rewardOffers.some((o) => o.kind === 'elite'),
      discovery =
        !elite && s.rewardOffers.length > 0 && s.rewardOffers.every((o) => o.kind === 'skill_add');
    const categories = [...new Set(s.rewardOffers.map(offerCategory))];
    choiceBox.classList.add(categories.length === 1 ? `cat-${categories[0]}` : 'cat-mixed');
    $('choiceTitle').textContent = elite
      ? '★ ТАЙНИК ЭЛИТЫ'
      : discovery
        ? '◈ ОТКРЫТИЕ · ФЕНОМЕН'
        : categories.length === 1 && categories[0] === 'doctrine'
          ? `◇ УРОВЕНЬ ${s.player.level} · СПЕЦИАЛИЗАЦИЯ`
          : `Уровень ${s.player.level}`;
    $('choiceSub').textContent = elite
      ? 'Элита оставила особую награду: катализатор должен сразу менять работу связки.'
      : discovery
        ? 'Новый феномен сразу использует текущий уровень ядра: поздняя находка не отстаёт по силе.'
        : categories.length === 1 && categories[0] === 'doctrine'
          ? 'Один слой, один вопрос: какую специализацию строить дальше? Иконка и короткое обещание читаются до полного текста.'
          : 'Выберите награду текущего канала прогрессии.';
    $('choiceFoot').textContent =
      elite || discovery
        ? 'Этот выбор нельзя пропустить или обновить.'
        : `Обновления: ${s.rerolls} · Пропуск сохраняет ~30% требования опыта.`;
    cards.className = `cards ${s.rewardOffers.length === 2 ? 'two' : ''}`;
    s.rewardOffers.forEach((o, i) => {
      const card = document.createElement('div'),
        rar = o.rarity;
      const cat = offerCategory(o);
      card.className = `card cat-${cat}`;
      card.dataset.choice = String(i);
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.style.setProperty('--rarity', rar ? rarityColor[rar] : '#365064');
      if (o.marked) card.classList.add('marked');
      card.innerHTML = `${o.marked ? '<div class="claimtag">ЭТО ЗАБЕРУТ ЭЛИТЫ, ЕСЛИ ОСТАВИШЬ</div>' : ''}<span class="choice-key">${i + 1}</span><div class="card-head"><div class="choice-icon">${offerIcon(o)}</div><div><div class="tag">${categoryLabel(cat)}${rar ? ' · ' + esc(rarityName[rar]) : ''}</div><h3>${esc(o.title)}</h3></div></div><div class="sub">${esc(o.subtitle)}</div><div class="promise">${esc(shortPromise(o.description))}</div>${o.before && o.after ? `<div class="beforeafter">${esc(o.before)} → <b>${esc(o.after)}</b></div>` : ''}<details><summary>Подробнее</summary><p>${esc(o.description)}</p></details>`;
      const choose = () => finishChoiceAction(`reward:${i}:${o.id}`, () => sim.chooseReward(i));
      card.addEventListener('click', choose);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          choose();
        }
      });
      cards.append(card);
    });
    if (!elite && !discovery) {
      const rr = document.createElement('button');
      rr.textContent = `Обновить варианты (${s.rerolls})`;
      rr.disabled = s.rerolls <= 0;
      rr.addEventListener('click', () => refreshChoiceAction('reroll', () => sim.rerollRewards()));
      const skip = document.createElement('button');
      skip.textContent = 'Пропустить';
      skip.addEventListener('click', () => finishChoiceAction('skip', () => sim.skipReward()));
      actions.append(rr, skip);
    }
  }
}

function frame(now: number) {
  const mv = screenMove();
  if (!paused && !planning && !sim.hasChoice && sim.php > 0 && !sim.finished) {
    acc = Math.min(0.25, acc + (now - last) / 1000);
    while (acc >= sim.dt) {
      sim.step({ moveX: mv.x, moveZ: mv.z, aimX: aim.x, aimZ: aim.z, dash: dashQueued });
      dashQueued = false;
      const snap = sim.snapshot(),
        cues = presentation.consume(sim.events, sim.time, snap);
      renderer.consume(cues, snap);
      pushEvents(sim.events);
      acc -= sim.dt;
      if (sim.hasChoice || sim.php <= 0 || sim.finished) break;
    }
  }
  last = now;
  const s = sim.snapshot();
  renderer.draw(s, aim, presentation.frame(s.time));
  updateUi(s);
  updateDebugState();
  requestAnimationFrame(frame);
}

async function start() {
  if (debugEnabled) $('debugPanel').classList.remove('debug-hidden');
  dbg('START', {
    version: '0.11.4-crowd-elite',
    mode: runMode,
    startingSkill,
    seed,
    href: location.href,
    userAgent: navigator.userAgent
  });
  try {
    if (uiTest) {
      let guard = 0;
      while (!sim.hasChoice && guard++ < 30000) sim.step({ moveX: 0, moveZ: 0, aimX: 1, aimZ: -1 });
      $('loading').classList.add('hidden');
      updateUi(sim.snapshot());
      document.body.dataset.ready = 'choice';
      return;
    }
    renderer = new WebGLRenderer(canvas);
    await renderer.load();
    $('loading').classList.add('hidden');
    pushLog(
      'Опыт развивает специализации; феномены, катализаторы, предметы и ядра мутаций приходят из отдельных источников.'
    );
    pushLog(
      runMode === 'clean'
        ? `Чистый старт: только «${skills[startingSkill].name}», без камней и Архива.`
        : 'Демонстрация: заполненная цепочка для быстрой проверки взаимодействий.'
    );
    const s = sim.snapshot();
    presentation.reset(s);
    renderer.draw(s, aim, presentation.frame(s.time));
    updateUi(s);
    if (smoke) {
      document.body.dataset.ready = '1';
      document.body.dataset.renderer = renderer.rendererName;
      return;
    }
    updateDebugState();
    requestAnimationFrame(frame);
  } catch (err) {
    $('loading').innerHTML =
      `<div class="loadbox"><b>Не удалось запустить графику.</b><span>${esc(String(err))}</span></div>`;
    console.error(err);
  }
}
start();


function drawMapPoi(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, guarded: boolean, danger: boolean) {
  const color = kind === 'phenomenon' ? '#ffb06a' : kind === 'catalyst' ? '#d0a0ff' : kind === 'resonance' ? '#76e1ff' : '#75f0a9';
  ctx.save(); ctx.translate(x,y); ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=1.7;
  if (kind === 'phenomenon') {
    ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(-6,-7);ctx.lineTo(-5,5);ctx.lineTo(0,7);ctx.lineTo(5,5);ctx.lineTo(6,-7);ctx.closePath();ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(0,7);ctx.stroke();
  } else if (kind === 'catalyst') {
    ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(-4,-4);ctx.lineTo(0,0);ctx.lineTo(-4,4);ctx.closePath();ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(4,-4);ctx.lineTo(8,0);ctx.lineTo(4,4);ctx.closePath();ctx.stroke();
  } else if (kind === 'resonance') {
    ctx.beginPath();for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI/3,px=Math.cos(a)*6,py=Math.sin(a)*6;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.stroke();
    ctx.beginPath();ctx.moveTo(-5,0);ctx.lineTo(5,0);ctx.moveTo(0,-5);ctx.lineTo(0,5);ctx.stroke();
  } else {
    ctx.fillRect(-2,-7,4,14);ctx.fillRect(-7,-2,14,4);
  }
  if (guarded || danger) { ctx.strokeStyle=danger?'#ff5962':'#fff';ctx.lineWidth=danger?2:1;ctx.strokeRect(-10,-10,20,20); }
  ctx.restore();
}
