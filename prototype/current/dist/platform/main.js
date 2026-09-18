import { catalysts, mutationDef, rarityColor, rarityName, skillOrder, skills } from '../content/definitions.js';
import { Simulation } from '../core/simulation.js';
import { WebGLRenderer } from '../renderer/webgl2.js';
import { PresentationBridge } from '../presentation/bridge.js';
const canvas = document.getElementById('game');
const combatHud = document.getElementById('combatHud');
const minimap = document.getElementById('minimap');
const $ = (id) => document.getElementById(id);
const visualIconMap = {
    ember_lance: 'ember_lance', frost_ring: 'frost_ring', rail_spear: 'rail_spear', cleaver: 'cleaver', chain_arc: 'chain_arc', orbit_blades: 'orbit_blades', mortar_bloom: 'mortar_bloom', sentry: 'sentry', toxic_mist: 'toxic_mist', repulse_halo: 'repulse_halo', mass_driver: 'mass_driver'
};
function skillVisualIcon(id, mutated = false) { return `/assets/${visualIconMap[id]}_${mutated ? 'mutated' : 'normal'}.jpg`; }
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 12345), smoke = params.get('smoke') === '1', uiTest = params.get('uitest') === '1', debugEnabled = params.get('debug') === '1';
let runMode = params.get('mode') === 'showcase' ? 'showcase' : 'clean';
let startingSkill = skillOrder.includes(params.get('start')) ? params.get('start') : 'ember_lance';
const newSimulation = () => new Simulation({ seed, hz: 60, mode: runMode, startingSkill });
let sim = newSimulation();
let renderer;
const presentation = new PresentationBridge();
let paused = false, planning = false;
let last = performance.now(), acc = 0;
const keys = new Set();
let aim = { x: 1, z: -1 };
let chainSignature = '', plannerSignature = '';
const log = [];
let fps = 60, fpsFrames = 0, fpsLast = performance.now();
let eliteAlertToken = 0;
const seenCatalystTriggers = new Set();
const combatFloats = [];
let renderedChoiceSerial = -1, choiceLocked = false, suppressChoiceUntil = 0;
// Keep the v0.4.4 diagnostics: the old modal bug disappeared only after this code path was introduced.
const debugLines = [];
let debugSeq = 0, lastChoiceUiState = '';
function safeJson(v) { try {
    return JSON.stringify(v);
}
catch {
    return String(v);
} }
function dbg(message, data) { const line = `${String(++debugSeq).padStart(4, '0')} +${(performance.now() / 1000).toFixed(3)}s ${message}${data === undefined ? '' : ' ' + safeJson(data)}`; debugLines.push(line); if (debugLines.length > 500)
    debugLines.shift(); console.log('[ROGUE-DBG]', message, data ?? ''); const out = document.getElementById('debugLog'); if (out) {
    out.textContent = debugLines.slice(-120).join('\n');
    out.scrollTop = out.scrollHeight;
} }
function targetDesc(t) { const e = t instanceof HTMLElement ? t : null; return e ? `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.dataset.choice !== undefined ? '[choice=' + e.dataset.choice + ']' : ''}` : String(t); }
function snapChoice(s) { return { serial: s.choiceSerial, reward: s.rewardOffers?.map((o, i) => `${i}:${o.id}`) ?? null, mutation: s.mutationOffer?.choices ?? null, tick: s.tick, time: +s.time.toFixed(3) }; }
function modalState() { const w = $('choice'), cs = getComputedStyle(w); return { hidden: w.hidden, display: cs.display, serial: w.dataset.choiceSerial ?? null, cards: $('cards').children.length }; }
async function copyDebugLog() { const text = ['Roguelike v0.9 POWER & ASSEMBLY DEBUG', navigator.userAgent, location.href, '', ...debugLines].join('\n'); try {
    await navigator.clipboard.writeText(text);
}
catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
} }
function updateDebugState() { const s = sim.snapshot(), state = `${s.choiceSerial}|${!!s.rewardOffers}|${!!s.mutationOffer}|${modalState().hidden}|${choiceLocked}`; if (state !== lastChoiceUiState) {
    lastChoiceUiState = state;
    dbg('CHOICE STATE', { sim: snapChoice(s), modal: modalState(), renderedChoiceSerial, choiceLocked });
} }
window.addEventListener('error', e => dbg('WINDOW ERROR', { message: e.message, file: e.filename, line: e.lineno, error: String(e.error ?? '') }));
window.addEventListener('unhandledrejection', e => dbg('UNHANDLED REJECTION', { reason: String(e.reason), stack: e.reason?.stack ?? null }));
window.__rogueDebug = { lines: debugLines, snapshot: () => sim.snapshot(), copy: copyDebugLog };
$('seed').textContent = String(seed);
const modeSelect = $('modeSelect'), startSelect = $('startSkill');
modeSelect.value = runMode;
startSelect.innerHTML = skillOrder.map(id => `<option value="${id}">${skills[id].name}</option>`).join('');
startSelect.value = startingSkill;
startSelect.disabled = runMode === 'showcase';
modeSelect.addEventListener('change', () => { runMode = modeSelect.value; startSelect.disabled = runMode === 'showcase'; pushLog('Режим изменён. Нажмите «Рестарт», чтобы начать новый забег.'); });
startSelect.addEventListener('change', () => { startingSkill = startSelect.value; pushLog(`Стартовый Phenomenon: ${skills[startingSkill].name}. Применится после рестарта.`); });
function esc(s) { return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function pushLog(t) { log.unshift(t); if (log.length > 6)
    log.pop(); $('eventLog').innerHTML = log.map(x => `<div class="event">${esc(x)}</div>`).join(''); }
function screenMove() { const sx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0), sy = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0); if (!sx && !sy)
    return { x: 0, z: 0 }; const x = sx + sy, z = -sx + sy, m = Math.hypot(x, z) || 1; return { x: x / m, z: z / m }; }
function keyHandled(k) { return ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'r', 'p', 'tab'].includes(k); }
window.addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (keyHandled(k))
    e.preventDefault(); if (!e.repeat && e.key === 'F8') {
    $('debugPanel').classList.toggle('debug-hidden');
    return;
} if (!e.repeat && k === 'tab')
    togglePlanning();
else if (!e.repeat && (k === ' ' || k === 'p'))
    togglePause();
else if (!e.repeat && k === 'r')
    restart(); keys.add(k); });
window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (keyHandled(k))
    e.preventDefault(); keys.delete(k); });
window.addEventListener('blur', () => keys.clear());
canvas.addEventListener('pointermove', e => { if (renderer)
    aim = renderer.screenAim(e.clientX, e.clientY); });
canvas.addEventListener('wheel', e => { if (!renderer)
    return; e.preventDefault(); renderer.adjustZoom(e.deltaY < 0 ? .08 : -.08); pushLog(`Масштаб камеры: ${Math.round(renderer.zoomLevel * 100)}%`); }, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());
$('pauseBtn').addEventListener('click', togglePause);
$('planBtn').addEventListener('click', togglePlanning);
$('planClose').addEventListener('click', togglePlanning);
$('restartBtn').addEventListener('click', restart);
$('overRestart').addEventListener('click', restart);
$('debugCopy').addEventListener('click', () => void copyDebugLog());
$('debugClear').addEventListener('click', () => { debugLines.length = 0; debugSeq = 0; $('debugLog').textContent = ''; });
$('debugToggle').addEventListener('click', () => $('debugPanel').classList.toggle('collapsed'));
const choiceRoot = $('choice');
for (const type of ['pointerdown', 'pointerup', 'click'])
    choiceRoot.addEventListener(type, e => dbg(`DOM ${type}`, { target: targetDesc(e.target), modal: modalState() }), true);
function togglePause() { const s = sim.snapshot(); if (planning || s.player.hp <= 0 || s.finished || s.rewardOffers || s.mutationOffer)
    return; paused = !paused; $('pause').classList.toggle('visible', paused); $('pauseBtn').textContent = paused ? 'Продолжить' : 'Пауза'; last = performance.now(); acc = 0; }
function togglePlanning() { const s = sim.snapshot(); if (s.player.hp <= 0 || s.finished || s.rewardOffers || s.mutationOffer)
    return; planning = !planning; $('planner').classList.toggle('visible', planning); if (planning) {
    $('pause').classList.remove('visible');
    keys.clear();
    plannerSignature = '';
    updatePlanner(s);
    pushLog('Режим планирования: бой полностью остановлен.');
} last = performance.now(); acc = 0; }
function restart() { runMode = modeSelect.value; startingSkill = startSelect.value; sim = newSimulation(); presentation.reset(sim.snapshot()); renderer?.reset(); paused = false; planning = false; keys.clear(); aim = { x: 1, z: -1 }; last = performance.now(); acc = 0; log.length = 0; seenCatalystTriggers.clear(); combatFloats.length = 0; chainSignature = ''; plannerSignature = ''; renderedChoiceSerial = -1; choiceLocked = false; suppressChoiceUntil = 0; $('pause').classList.remove('visible'); $('planner').classList.remove('visible'); $('overlay').classList.remove('visible'); closeChoiceModal(); $('eliteAlert').classList.remove('visible'); $('pauseBtn').textContent = 'Пауза'; pushLog(`${runMode === 'clean' ? 'Чистый ран' : 'Showcase'}: исследуйте отмеченные узлы карты; Хранитель приходит в финале.`); }
const chassisName = { marshal: 'Маршал', hunter: 'Хищник', bulwark: 'Призма', architect: 'Завеса', harvester: 'Нуль-ткач', shepherd: 'Метаморф', broodmaker: 'Репликатор', archivist: 'Архивист', warden: 'Хранитель' };
const chassisRole = { marshal: 'legacy', hunter: 'предсказывает движение и делает перехватывающий рывок', bulwark: 'запоминает источник: повтор защищает её, смена источника вскрывает', architect: 'создаёт туман, в котором дальний auto-lock теряет цель', harvester: 'поглощает Catalyst-derived события; прямые такты разбивают заряд', shepherd: 'эволюционирует от реальной сигнатуры полученного урона', broodmaker: 'частые попадания порождают копии; убийство копии ранит оригинал', archivist: 'экспериментальный legacy', warden: 'финальный босс: читаемые sweep / rupture / charge паттерны' };
const affixName = { none: 'Без аффикса', swift: 'Быстрый', dense: 'Плотный', volatile: 'Взрывной', regenerating: 'Регенерирующий', shielded: 'Щитоносец', vanguard: 'Авангард', temporal: 'Темпоральный', brood: 'Роевой', crowned: 'Коронованный' };
const adaptName = { none: 'адаптация ещё не раскрыта', screening: 'ЗЕРКАЛЬНЫЙ ЭКРАН: фронт почти закрыт; обходи и бей с тыла', repulsor: 'УДАРНАЯ ВОЛНА: большое кольцо отбрасывает; после импульса окно уязвимости', intercept: 'ПЕРЕХВАТ: линия предсказывает рывок по траектории движения; после рывка окно уязвимости', anchored: 'ПУРГАЦИЯ: элита съедает твоё поле и отвечает опасной зоной в той же точке' };
function eventText(e) {
    if (e.type === 'EntitySpawned' && e.kind === 'elite')
        return e.boss ? 'ФИНАЛЬНЫЙ БОСС: Хранитель вошёл на карту.' : `ЭЛИТА: ${chassisName[e.chassis ?? 'marshal']}.`;
    if (e.type === 'EliteAdapted')
        return `АДАПТАЦИЯ: ${adaptName[e.adaptation]}.`;
    if (e.type === 'EliteReacquired')
        return 'Элитка вернулась в боевую зону: от неё нельзя просто уйти.';
    if (e.type === 'PoiAwakened')
        return `Узел карты активирован: ${poiLabel(e.kind)}. Здесь карта управляет сборкой, а не создаёт ещё одну элитку.`;
    if (e.type === 'PoiCleared')
        return `Узел очищен: ${poiLabel(e.kind)}.`;
    if (e.type === 'BossSpawned')
        return e.supports ? `ХРАНИТЕЛЬ: финальный бой начался. Неочищенные узлы привели стражей: ${e.supports}.` : 'ХРАНИТЕЛЬ: финальный бой начался без поддержки узлов.';
    if (e.type === 'BossPhase')
        return `ХРАНИТЕЛЬ: фаза ${e.phase}. Паттерны ускорились.`;
    if (e.type === 'BossPattern')
        return `Хранитель: ${e.pattern === 'sweep' ? 'СЕКТОРНЫЙ ВЗМАХ' : e.pattern === 'rupture' ? 'РАЗЛОМ ПО ЛИНИИ' : 'ТАРАН'}.`;
    if (e.type === 'EntityDied' && e.boss)
        return 'Хранитель уничтожен. Забег завершён.';
    if (e.type === 'EntityDied' && e.elite)
        return 'Элитка уничтожена.';
    if (e.type === 'EliteOrder') {
        const m = { surge: 'Маршал: SURGE.', pack: 'Legacy pack.', screen: 'Legacy screen.', wall: 'Legacy wall.', harvest: 'Legacy harvest.', regroup: 'Legacy regroup.', brood: 'Legacy brood.', archive: 'Архивист: скопирована роль.', predator: 'Хищник зафиксировал траекторию: сейчас будет перехват.', veil: `Завеса развернула ${e.count ?? 3} зоны тумана: дальний auto-lock внутри глохнет.`, replicate: 'Репликатор породил копию от частых попаданий. Уничтожение копии бьёт оригинал.', prism: 'Призма запомнила источник. Повторять его подряд невыгодно — смена источника вскрывает защиту.', null: `Нуль-ткач поглотил производное событие. Заряд: ${e.count ?? 1}; прямые такты разбивают заряды.`, metamorph: 'Метаморф сменил форму по сигнатуре последних попаданий.' };
        return m[e.order];
    }
    if (e.type === 'LevelUp')
        return `Core Rank ${e.level}: базовая мощность всей Chain выросла.`;
    if (e.type === 'MutationChosen')
        return `${skills[e.skill].name}: мутация «${mutationDef(e.skill, e.mutation).name}».`;
    if (e.type === 'EnemyRevived')
        return 'Палимпсест переписал себя и вернулся в бой.';
    if (e.type === 'Reaction') {
        const n = { thermal_shock: 'THERMAL SHOCK', detonation: 'ДЕТОНАЦИЯ', conduit: 'ПРОВОДНИК', echo: 'ЭХО', aegis: 'ЭГИДА' };
        return n[e.reaction];
    }
    return null;
}
function poiLabel(kind) { return kind === 'phenomenon' ? 'АРХИВ ФЕНОМЕНА' : kind === 'catalyst' ? 'УЗЕЛ КАТАЛИЗАТОРА' : kind === 'resonance' ? 'УЗЕЛ ЯДРА' : 'ВИТАЛЬНЫЙ УЗЕЛ'; }
function eliteAlert(e) {
    if (e.type === 'BossSpawned')
        return ['ХРАНИТЕЛЬ · ФИНАЛЬНЫЙ БОСС', e.supports ? `Неочищенные узлы усилили финал: вместе с боссом пришло стражей ${e.supports}. Красная геометрия = атака.` : 'Архив зачищен достаточно глубоко: дополнительных стражей узлов нет. Красная геометрия = атака.'];
    if (e.type === 'BossPhase')
        return ['ХРАНИТЕЛЬ · ФАЗА 2', 'Паттерны быстрее, появляются подкрепления. Окна после атак всё ещё уязвимы.'];
    if (e.type === 'BossPattern')
        return [e.pattern === 'sweep' ? 'СЕКТОРНЫЙ ВЗМАХ' : e.pattern === 'rupture' ? 'РАЗЛОМ' : 'ТАРАН', e.pattern === 'sweep' ? 'Выйди из подсвеченного сектора.' : e.pattern === 'rupture' ? 'Уйди с широкой линии до удара.' : 'Сместись поперёк красной линии; после тарана атакуй.'];
    if (e.type === 'PoiAwakened')
        return [poiLabel(e.kind), `Страж активирован. Убей его, чтобы забрать награду узла.`];
    if (e.type === 'PoiCleared')
        return ['УЗЕЛ ОЧИЩЕН', `${poiLabel(e.kind)} теперь безопасен.`];
    if (e.type === 'EntitySpawned' && e.kind === 'elite' && !e.boss) {
        const c = e.chassis ?? 'marshal';
        return [`${chassisName[c].toUpperCase()} · ${affixName[e.affix ?? 'none'].toUpperCase()}`, chassisRole[c]];
    }
    if (e.type === 'EliteAdapted')
        return ['АДАПТАЦИЯ ЭЛИТЫ', adaptName[e.adaptation]];
    if (e.type === 'EliteReacquired')
        return ['ЭЛИТА ПЕРЕХВАТИЛА ТЕБЯ', 'Дистанция не сбрасывает бой: элита возвращена рядом с игроком.'];
    if (e.type === 'EliteOrder') {
        const t = eventText(e);
        return t ? ['МЕХАНИКА ЭЛИТЫ', t] : null;
    }
    return null;
}
function showEliteAlert(title, body) { const token = ++eliteAlertToken, el = $('eliteAlert'); $('eliteAlertTitle').textContent = title; $('eliteAlertBody').textContent = body; el.classList.add('visible'); setTimeout(() => { if (token === eliteAlertToken)
    el.classList.remove('visible'); }, 3400); }
function pushEvents(events) { for (const e of events) {
    const t = eventText(e);
    if (t)
        pushLog(t);
    const a = eliteAlert(e);
    if (a)
        showEliteAlert(...a);
    if (e.type === 'DamageResolved') {
        const now = sim.time, prev = [...combatFloats].reverse().find(f => f.kind !== 'catalyst' && f.entity === e.entity && now - f.start < .11);
        if (prev) {
            prev.amount += e.amount;
            prev.text = String(Math.max(1, Math.round(prev.amount)));
            prev.start = now;
            prev.x = e.x;
            prev.z = e.z;
            prev.kind = e.crit ? 'crit' : prev.kind;
        }
        else
            combatFloats.push({ entity: e.entity, x: e.x, z: e.z, text: String(Math.max(1, Math.round(e.amount))), amount: e.amount, start: now, ttl: .72, kind: e.crit ? 'crit' : 'damage' });
    }
    else if (e.type === 'CatalystTriggered') {
        const snap = sim.snapshot(), from = snap.chain.slots[e.fromSlot], to = snap.chain.slots[e.toSlot], label = catalysts[e.catalyst].shortName.toUpperCase();
        combatFloats.push({ entity: -1, x: (e.sourceX + e.targetX) / 2, z: (e.sourceZ + e.targetZ) / 2, text: label, amount: 0, start: sim.time, ttl: .88, kind: 'catalyst' });
        const edge = document.querySelector(`#chain .edge[data-edge="${e.fromSlot}"]`);
        edge?.classList.add('fired');
        setTimeout(() => edge?.classList.remove('fired'), 520);
        if (!seenCatalystTriggers.has(e.catalyst)) {
            seenCatalystTriggers.add(e.catalyst);
            showEliteAlert('СВЯЗЬ СРАБОТАЛА', `${from ? skills[from].name : '?'} → ${catalysts[e.catalyst].shortName} → ${to ? skills[to].name : '?'}. Цветной импульс показывает причинный маршрут.`);
        }
    }
} while (combatFloats.length > 90)
    combatFloats.shift(); }
function updateChain(s) {
    const sig = s.chain.slots.join('|') + '#' + s.chain.catalysts.join('|') + '#' + s.skills.map(x => `${x.id}:${x.mutation}:${x.cold}`).join('|') + '#' + s.chain.catalystRuntime.map(c => c.id).join('|') + '#' + s.player.level + '#' + s.mutationCores;
    if (sig !== chainSignature) {
        chainSignature = sig;
        const rt = new Map(s.skills.map(x => [x.id, x]));
        const root = $('chain');
        root.innerHTML = '';
        s.chain.slots.forEach((id, i) => {
            const slot = document.createElement('div');
            slot.className = 'slot' + (id ? '' : ' empty');
            slot.dataset.slot = String(i);
            slot.title = 'Для перестановки нажмите Tab.';
            if (id) {
                const st = rt.get(id), md = st.mutation ? mutationDef(id, st.mutation) : null;
                slot.innerHTML = `<img src="${skillVisualIcon(id, !!st.mutation)}" alt=""><div style="min-width:0"><div class="slotnum">ТАКТ ${i + 1}</div><div class="slotname">${esc(skills[id].name)}</div><div class="slotlvl ${st.cold ? 'cold' : ''}">Core ${s.player.level}${st.cold ? ' · COLD' : ''}</div><div class="slotmut">${md ? '↳ ' + esc(md.name) : 'базовая форма'}</div></div>`;
            }
            else
                slot.innerHTML = `<div class="noicon">—</div><div><div class="slotnum">ТАКТ ${i + 1}</div><div class="slotname">Пусто</div><div class="slotlvl">пустой хвост не тратит такт</div></div>`;
            root.append(slot);
            if (i < s.chain.catalysts.length) {
                const cid = s.chain.catalysts[i], edge = document.createElement('div');
                edge.className = 'edge';
                edge.dataset.edge = String(i);
                if (cid) {
                    const cd = catalysts[cid];
                    edge.title = cd.desc;
                    edge.style.setProperty('--cat-color', cd.color);
                    edge.innerHTML = `<div class="catdot"></div><b>${esc(cd.shortName)}</b><span>${esc(cd.scope)}</span>`;
                }
                else
                    edge.innerHTML = '<b>—</b><span>пусто</span>';
                root.append(edge);
            }
        });
    }
    document.querySelectorAll('#chain .slot').forEach(x => x.classList.toggle('active', Number(x.dataset.slot) === s.chain.beat));
    document.querySelectorAll('#chain .edge').forEach(x => x.classList.toggle('active', Number(x.dataset.edge) === s.chain.beat - 1));
    $('chainInfo').textContent = `цикл ${s.chain.cycle + 1} · Tempo +${Math.round(s.chain.tempo * 100)}% · Tab = планирование`;
}
function attachPlannerDnD(el) { el.addEventListener('dragstart', e => { e.dataTransfer?.setData('text/plain', el.dataset.drag ?? ''); el.classList.add('dragging'); }); el.addEventListener('dragend', () => el.classList.remove('dragging')); el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drop'); }); el.addEventListener('dragleave', () => el.classList.remove('drop')); el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('drop'); const src = e.dataTransfer?.getData('text/plain') ?? '', dst = el.dataset.drag ?? ''; const a = src.split(':'), b = dst.split(':'); if (a.length !== 3 || b.length !== 3 || a[0] !== b[0])
    return; let ok = false; if (a[0] === 'skill')
    ok = sim.swapSkillLocations(a[1], Number(a[2]), b[1], Number(b[2]));
else
    ok = sim.swapCatalystLocations(a[1], Number(a[2]), b[1], Number(b[2])); if (ok) {
    chainSignature = '';
    plannerSignature = '';
    const ns = sim.snapshot();
    updatePlanner(ns);
    updateChain(ns);
    pushLog(a[0] === 'skill' ? 'План: Phenomenon переставлен.' : 'План: Catalyst переставлен.');
} }); }
function plannerSkillNode(id, zone, idx, s) { const el = document.createElement('div'); el.className = 'pnode skill' + (id ? '' : ' empty'); el.draggable = true; el.dataset.drag = `skill:${zone}:${idx}`; if (id) {
    const st = s.skills.find(x => x.id === id), d = skills[id], md = st.mutation ? mutationDef(id, st.mutation) : null;
    const radius = d.baseRadius ? d.baseRadius.toFixed(1) : '—', range = d.baseRange ? d.baseRange.toFixed(1) : '—';
    el.innerHTML = `<img src="${skillVisualIcon(id, !!st.mutation)}" alt=""><div class="nm">${esc(d.name)}</div><div class="sm">Core ${s.player.level} · дальн. ${range} · радиус ${radius}</div><div class="effect"><b>${esc(d.identity ?? '')}</b>${d.weakness ? `<br>Слабость: ${esc(d.weakness)}` : ''}${md ? `<br>Мутация: ${esc(md.name)}` : ''}</div>`;
}
else
    el.innerHTML = '<div>пустой<br>слот</div>'; attachPlannerDnD(el); return el; }
function plannerCatNode(id, zone, idx, s) { const el = document.createElement('div'); el.className = 'pnode cat' + (id ? '' : ' empty'); el.draggable = true; el.dataset.drag = `cat:${zone}:${idx}`; if (id) {
    const d = catalysts[id];
    el.style.setProperty('--cat-color', d.color);
    el.innerHTML = `<div class="catdot"></div><div class="nm">${esc(d.name)}</div><div class="sm">${esc(d.scope)} · готовый оператор</div><div class="effect">${esc(d.desc)}</div>`;
}
else
    el.innerHTML = '<div>пустой<br>slot</div>'; attachPlannerDnD(el); return el; }
function updatePlanner(s) { if (!planning)
    return; const sig = s.chain.slots.join('|') + '#' + s.chain.skillReserve.join('|') + '#' + s.chain.catalysts.join('|') + '#' + s.chain.catalystReserve.join('|') + '#' + s.skills.map(x => `${x.id}:${x.mutation}:${x.cold}`).join('|') + '#' + s.chain.catalystRuntime.map(x => x.id).join('|') + '#' + JSON.stringify(s.resonance) + '#' + s.mutationCores + '#' + s.player.level; if (sig === plannerSignature)
    return; plannerSignature = sig; const chain = $('plannerChain'); chain.innerHTML = ''; for (let i = 0; i < s.chain.slots.length; i++) {
    chain.append(plannerSkillNode(s.chain.slots[i], 'active', i, s));
    if (i < s.chain.catalysts.length)
        chain.append(plannerCatNode(s.chain.catalysts[i], 'active', i, s));
} const reserve = $('plannerReserve'); reserve.innerHTML = ''; s.chain.skillReserve.forEach((id, i) => reserve.append(plannerSkillNode(id, 'reserve', i, s))); s.chain.catalystReserve.forEach((id, i) => reserve.append(plannerCatNode(id, 'reserve', i, s))); $('plannerStats').innerHTML = `<span>Core Rank <b>${s.player.level}</b></span><span>Темп <b>${s.resonance.tempo}</b></span><span>Количество <b>${s.resonance.multiplicity}</b></span><span>Точность <b>${s.resonance.precision}</b></span><span>Длительность <b>${s.resonance.persistence}</b></span><span>Проводимость <b>${s.resonance.conductivity}</b></span><span>Подвижность <b>${s.resonance.mobility}</b></span><span>Ядра мутации <b>${s.mutationCores}</b></span>`; }
function eliteName(e) { const aff = e.affix ?? 'none'; return `${e.boss ? 'ХРАНИТЕЛЬ' : chassisName[e.chassis ?? 'marshal']}${aff !== 'none' ? ' · ' + affixName[aff] : ''}${e.adaptation !== 'none' ? ' · ' + adaptName[e.adaptation].split(':')[0] : ''}`; }
function resize2d(c) { const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1)), w = Math.max(1, Math.floor(c.clientWidth * dpr)), h = Math.max(1, Math.floor(c.clientHeight * dpr)); if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
} const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return ctx; }
function drawMinimap(s) { const ctx = resize2d(minimap), w = minimap.clientWidth, h = minimap.clientHeight, pad = 10; ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#071018d9'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#426272'; ctx.lineWidth = 1; ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2); const tx = (x) => pad + (x - s.world.minX) / (s.world.maxX - s.world.minX) * (w - pad * 2), ty = (z) => pad + (z - s.world.minZ) / (s.world.maxZ - s.world.minZ) * (h - pad * 2); for (const p of s.world.pois) {
    ctx.globalAlpha = p.state === 'cleared' ? .22 : 1;
    ctx.fillStyle = p.kind === 'phenomenon' ? '#ff9b4a' : p.kind === 'catalyst' ? '#c27aff' : p.kind === 'resonance' ? '#67d9ff' : '#63f0a5';
    ctx.beginPath();
    ctx.arc(tx(p.x), ty(p.z), p.state === 'guarded' ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
    if (p.state === 'guarded' || (s.world.bossSpawned && p.state !== 'cleared')) {
        ctx.strokeStyle = s.world.bossSpawned ? '#ff5b63' : '#fff';
        ctx.lineWidth = s.world.bossSpawned ? 2 : 1;
        ctx.stroke();
    }
} ctx.globalAlpha = 1; for (const q of s.pickups) {
    if (q.kind !== 'heal')
        continue;
    const x = tx(q.x), y = ty(q.z);
    ctx.strokeStyle = '#7bffae';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 3, y);
    ctx.lineTo(x + 3, y);
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x, y + 3);
    ctx.stroke();
} for (const e of s.entities) {
    if (!e.elite)
        continue;
    ctx.fillStyle = e.boss ? '#ff344c' : e.guardianPoi !== 0 ? '#fff06c' : '#ffd75a';
    const x = tx(e.x), y = ty(e.z), r = e.boss ? 7 : 5;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fill();
} ctx.fillStyle = '#8ffff0'; ctx.beginPath(); ctx.arc(tx(s.player.x), ty(s.player.z), 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#8ffff0'; ctx.beginPath(); ctx.moveTo(tx(s.player.x), ty(s.player.z)); ctx.lineTo(tx(s.player.x + s.player.aimX * 3), ty(s.player.z + s.player.aimZ * 3)); ctx.stroke(); }
function drawCombatHud(s) {
    const ctx = resize2d(combatHud), w = combatHud.clientWidth, h = combatHud.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const e of s.entities) {
        const p = renderer.worldToScreen(e.x, e.z, s), margin = 34, off = p.x < margin || p.x > w - margin || p.y < margin || p.y > h - margin;
        if (off) {
            if (e.elite) {
                const x = Math.max(margin, Math.min(w - margin, p.x)), y = Math.max(margin, Math.min(h - margin, p.y)), r = e.boss ? 10 : 7;
                ctx.fillStyle = e.boss ? '#ff4057' : '#ffd65c';
                ctx.beginPath();
                ctx.moveTo(x, y - r);
                ctx.lineTo(x + r, y);
                ctx.lineTo(x, y + r);
                ctx.lineTo(x - r, y);
                ctx.closePath();
                ctx.fill();
                ctx.font = e.boss ? '900 11px system-ui' : '800 9px system-ui';
                ctx.fillStyle = '#fff';
                ctx.fillText(e.boss ? 'BOSS' : chassisName[e.chassis ?? 'marshal'].toUpperCase(), x, y + r + 10);
            }
            continue;
        }
        const show = e.elite || e.hp < e.maxHp * .995;
        if (!show)
            continue;
        const bw = e.boss ? 170 : e.elite ? 92 : 44, bh = e.boss ? 9 : e.elite ? 6 : 4, y = p.y - (e.boss ? 142 : e.elite ? 95 : 54);
        ctx.fillStyle = '#05080bd9';
        ctx.fillRect(p.x - bw / 2, y, bw, bh);
        ctx.fillStyle = e.boss ? '#ff3c50' : e.elite ? '#e7b94c' : '#df5262';
        ctx.fillRect(p.x - bw / 2 + 1, y + 1, (bw - 2) * Math.max(0, e.hp / e.maxHp), bh - 2);
        if (e.elite) {
            ctx.font = e.boss ? '800 14px system-ui' : '700 11px system-ui';
            ctx.fillStyle = '#fff';
            ctx.fillText(e.boss ? 'ХРАНИТЕЛЬ' : eliteName(e), p.x, y - 9);
            if (e.adaptation !== 'none' && !e.boss) {
                ctx.font = '700 9px system-ui';
                ctx.fillStyle = '#9eeaff';
                ctx.fillText(adaptName[e.adaptation].split(':')[0], p.x, y + 15);
            }
        }
    }
    const now = s.time;
    for (let i = combatFloats.length - 1; i >= 0; i--) {
        const f = combatFloats[i], t = (now - f.start) / f.ttl;
        if (t >= 1) {
            combatFloats.splice(i, 1);
            continue;
        }
        if (t < 0)
            continue;
        const p = renderer.worldToScreen(f.x, f.z, s), rise = 22 * t;
        ctx.globalAlpha = Math.max(0, 1 - t);
        ctx.font = f.kind === 'catalyst' ? '800 12px system-ui' : f.kind === 'crit' ? '900 17px system-ui' : '800 13px system-ui';
        ctx.fillStyle = f.kind === 'catalyst' ? '#e2b7ff' : f.kind === 'crit' ? '#fff2a3' : '#fff';
        ctx.strokeStyle = '#05080b';
        ctx.lineWidth = 3;
        ctx.strokeText(f.text, p.x, p.y - 62 - rise);
        ctx.fillText(f.text, p.x, p.y - 62 - rise);
    }
    ctx.globalAlpha = 1;
}
function updateThreatPanel(s) { const box = $('threatPanel'), boss = s.entities.find(e => e.boss), elites = s.entities.filter(e => e.elite && !e.boss); const e = boss ?? elites.sort((a, b) => Math.hypot(a.x - s.player.x, a.z - s.player.z) - Math.hypot(b.x - s.player.x, b.z - s.player.z))[0]; if (!e) {
    box.classList.remove('visible');
    return;
} box.classList.add('visible'); const title = e.boss ? `ХРАНИТЕЛЬ · ФАЗА ${e.bossPhase}` : eliteName(e), body = e.boss ? 'Красная геометрия = реальный паттерн атаки. После тарана/разрыва есть окно уязвимости.' : `${chassisRole[e.chassis ?? 'marshal']} · ${adaptName[e.adaptation]}`; $('threatTitle').textContent = title; $('threatBody').textContent = body; $('threatHp').style.width = `${Math.max(0, e.hp / e.maxHp * 100)}%`; }
function updateUi(s) { const mm = Math.floor(s.time / 60), ss = Math.floor(s.time % 60).toString().padStart(2, '0'), rm = Math.floor(s.runDuration / 60), rs = Math.floor(s.runDuration % 60).toString().padStart(2, '0'); $('time').textContent = `${mm}:${ss} / ${rm}:${rs}`; $('level').textContent = `CORE ${s.player.level}`; $('hpbar').style.width = `${Math.max(0, s.player.hp / s.player.maxHp * 100)}%`; $('hptext').textContent = `HP ${Math.ceil(s.player.hp)} / ${Math.round(s.player.maxHp)}${s.player.barrier > 0 ? ` + ${Math.ceil(s.player.barrier)} щит` : ''}`; $('xpbar').style.width = `${Math.max(0, Math.min(100, s.player.xp / s.player.xpNeed * 100))}%`; $('xptext').textContent = `XP ${Math.floor(s.player.xp)} / ${s.player.xpNeed}`; const cleared = s.world.pois.filter(p => p.state === 'cleared').length, remaining = Math.max(0, s.runDuration * .875 - s.time), bossSupport = s.entities.filter(e => e.elite && !e.boss && e.guardianPoi !== 0).length; $('objective').textContent = s.world.bossSpawned ? (s.world.bossDefeated ? 'Хранитель уничтожен' : `ЦЕЛЬ: ХРАНИТЕЛЬ${bossSupport ? ` · поддержка стражей ${bossSupport}` : ''}`) : `Исследование ${cleared}/${s.world.pois.length} · активируй 4+ узла, чтобы ослабить финальную поддержку · ${Math.floor(remaining / 60)}:${Math.floor(remaining % 60).toString().padStart(2, '0')}`; $('mode').textContent = s.mode === 'clean' ? 'Чистый ран' : 'Showcase'; $('perf').textContent = `${Math.round(fps)} · WebGL2`; updateThreatPanel(s); drawMinimap(s); drawCombatHud(s); updateChain(s); updatePlanner(s); syncChoiceUI(s); if ((s.player.hp <= 0 || s.finished) && !$('overlay').classList.contains('visible')) {
    $('overlay').classList.add('visible');
    $('overTitle').textContent = s.player.hp <= 0 ? 'Забег окончен' : 'Хранитель уничтожен';
    $('overText').textContent = `Уровень ${s.player.level} · убийств ${s.metrics.killed} · элит ${s.metrics.eliteKilled} · очищено узлов ${cleared}/${s.world.pois.length}.`;
} }
function closeChoiceModal(clear = true) { const wrap = $('choice'); wrap.classList.remove('visible'); wrap.hidden = true; wrap.setAttribute('aria-hidden', 'true'); wrap.style.setProperty('display', 'none', 'important'); wrap.style.pointerEvents = 'none'; if (clear) {
    $('cards').innerHTML = '';
    $('choiceActions').innerHTML = '';
} dbg('MODAL CLOSE', modalState()); }
function openChoiceModal() { const wrap = $('choice'); wrap.hidden = false; wrap.removeAttribute('hidden'); wrap.setAttribute('aria-hidden', 'false'); wrap.style.removeProperty('display'); wrap.style.pointerEvents = 'auto'; wrap.classList.add('visible'); dbg('MODAL OPEN', modalState()); }
function consumeChoiceEvents() { try {
    const snap = sim.snapshot(), cues = presentation.consume(sim.events, sim.time, snap);
    if (renderer)
        renderer.consume(cues, snap);
    pushEvents(sim.events);
}
catch (err) {
    console.error(err);
} }
function finishChoiceAction(label, action) { const before = sim.snapshot(); dbg('CHOICE ACTION', { label, before: snapChoice(before) }); if (choiceLocked)
    return; choiceLocked = true; closeChoiceModal(); let ok = false; try {
    ok = action();
}
catch (err) {
    dbg('CHOICE THROW', { label, error: String(err) });
    pushLog(`Ошибка выбора: ${String(err)}`);
} consumeChoiceEvents(); const after = sim.snapshot(); last = performance.now(); acc = 0; if (!ok) {
    renderedChoiceSerial = -1;
    choiceLocked = false;
    suppressChoiceUntil = 0;
    syncChoiceUI(after, true);
    return;
} renderedChoiceSerial = -1; suppressChoiceUntil = (after.rewardOffers || after.mutationOffer) ? performance.now() + 320 : 0; choiceLocked = false; syncChoiceUI(after); setTimeout(() => dbg('CHOICE +400ms', { sim: snapChoice(sim.snapshot()), modal: modalState() }), 400); }
function refreshChoiceAction(label, action) { if (choiceLocked)
    return; let ok = false; try {
    ok = action();
}
catch (err) {
    dbg('CHOICE REFRESH THROW', { label, error: String(err) });
} if (ok) {
    renderedChoiceSerial = -1;
    syncChoiceUI(sim.snapshot(), true);
} }
function offerKind(o) { return o.kind === 'skill_add' ? 'НОВЫЙ PHENOMENON' : o.kind === 'catalyst_add' ? 'НОВЫЙ CATALYST' : o.kind === 'mutation_target' ? 'ЯДРО МУТАЦИИ' : o.kind === 'resonance' ? 'ОСЬ ЯДРА' : o.kind === 'elite' ? 'ELITE CACHE' : 'ОБЩИЙ СТАТ'; }
function syncChoiceUI(s, force = false) {
    const has = !!s.mutationOffer || !!s.rewardOffers, wrap = $('choice'), cards = $('cards'), actions = $('choiceActions');
    if (!has) {
        if (!wrap.hidden || wrap.classList.contains('visible'))
            closeChoiceModal();
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
    if (!force && renderedChoiceSerial === s.choiceSerial && !wrap.hidden && wrap.classList.contains('visible'))
        return;
    renderedChoiceSerial = s.choiceSerial;
    actions.innerHTML = '';
    cards.innerHTML = '';
    openChoiceModal();
    wrap.dataset.choiceSerial = String(s.choiceSerial);
    if (s.mutationOffer) {
        const m = s.mutationOffer;
        $('choiceTitle').textContent = `Мутация: ${skills[m.skill].name}`;
        $('choiceSub').textContent = 'Ядро мутации меняет парадигму Phenomenon и остаётся ресурсом рана: при замене его можно назначить заново.';
        $('choiceFoot').textContent = m.refusalAvailable ? 'Один раз за ран можно заменить одну из двух мутаций.' : 'Токен отказа уже использован.';
        cards.className = 'cards two';
        m.choices.forEach((id, i) => { const d = mutationDef(m.skill, id), card = document.createElement('div'); card.className = 'card'; card.dataset.choice = String(i); card.setAttribute('role', 'button'); card.tabIndex = 0; card.style.setProperty('--rarity', '#c27aff'); card.innerHTML = `<div class="tag">МУТАЦИЯ · ${esc(d.tag)}</div><h3>${esc(d.name)}</h3><div class="sub">${esc(skills[m.skill].name)}</div><p>${esc(d.description)}</p><button class="refuse" ${m.refusalAvailable ? '' : 'disabled'}>Заменить этот вариант</button>`; const choose = () => finishChoiceAction(`mutation:${m.skill}:${i}:${id}`, () => sim.chooseMutation(i)); card.addEventListener('click', e => { if (e.target.closest('.refuse'))
            return; choose(); }); card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            choose();
        } }); card.querySelector('.refuse').addEventListener('click', e => { e.stopPropagation(); if (m.refusalAvailable)
            refreshChoiceAction(`refuse:${i}`, () => sim.refuseMutation(i)); }); cards.append(card); });
    }
    else if (s.rewardOffers) {
        const elite = s.rewardOffers.some(o => o.kind === 'elite'), discovery = !elite && s.rewardOffers.length > 0 && s.rewardOffers.every(o => o.kind === 'skill_add');
        $('choiceTitle').textContent = elite ? 'ELITE CACHE' : discovery ? 'DISCOVERY' : `Уровень ${s.player.level}`;
        $('choiceSub').textContent = elite ? 'Элитка дала структурную награду: Catalyst должен сразу менять работу связки.' : discovery ? 'Новый Phenomenon сразу использует текущий Core Rank: поздняя находка не отстаёт по персональным уровням.' : 'Core Rank автоматически поднимает базовую мощность всей Chain. Выберите глобальную ось развития рана.';
        $('choiceFoot').textContent = elite || discovery ? 'Этот выбор нельзя пропустить или перероллить.' : `Reroll: ${s.rerolls} · Skip сохраняет ~30% требования XP.`;
        cards.className = `cards ${s.rewardOffers.length === 2 ? 'two' : ''}`;
        s.rewardOffers.forEach((o, i) => { const card = document.createElement('div'), rar = o.rarity; card.className = 'card'; card.dataset.choice = String(i); card.setAttribute('role', 'button'); card.tabIndex = 0; card.style.setProperty('--rarity', rar ? rarityColor[rar] : '#7c94a4'); card.innerHTML = `<div class="tag">${rar ? esc(rarityName[rar]) + ' · ' : ''}${offerKind(o)}</div><h3>${esc(o.title)}</h3><div class="sub">${esc(o.subtitle)}</div><p>${esc(o.description)}</p>${o.before && o.after ? `<div class="beforeafter">${esc(o.before)} → <b>${esc(o.after)}</b></div>` : ''}`; const choose = () => finishChoiceAction(`reward:${i}:${o.id}`, () => sim.chooseReward(i)); card.addEventListener('click', choose); card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            choose();
        } }); cards.append(card); });
        if (!elite && !discovery) {
            const rr = document.createElement('button');
            rr.textContent = `Перероллить (${s.rerolls})`;
            rr.disabled = s.rerolls <= 0;
            rr.addEventListener('click', () => refreshChoiceAction('reroll', () => sim.rerollRewards()));
            const skip = document.createElement('button');
            skip.textContent = 'Пропустить';
            skip.addEventListener('click', () => finishChoiceAction('skip', () => sim.skipReward()));
            actions.append(rr, skip);
        }
    }
}
function frame(now) { fpsFrames++; if (now - fpsLast > 500) {
    fps = fpsFrames / ((now - fpsLast) / 1000);
    fpsFrames = 0;
    fpsLast = now;
} const mv = screenMove(); if (!paused && !planning && !sim.hasChoice && sim.php > 0 && !sim.finished) {
    acc = Math.min(.25, acc + (now - last) / 1000);
    while (acc >= sim.dt) {
        sim.step({ moveX: mv.x, moveZ: mv.z, aimX: aim.x, aimZ: aim.z });
        const snap = sim.snapshot(), cues = presentation.consume(sim.events, sim.time, snap);
        renderer.consume(cues, snap);
        pushEvents(sim.events);
        acc -= sim.dt;
        if (sim.hasChoice || sim.php <= 0 || sim.finished)
            break;
    }
} last = now; const s = sim.snapshot(); renderer.draw(s, aim, presentation.frame(s.time)); updateUi(s); updateDebugState(); requestAnimationFrame(frame); }
async function start() { if (debugEnabled)
    $('debugPanel').classList.remove('debug-hidden'); dbg('START', { version: '0.10-core-rebuild', mode: runMode, startingSkill, seed, href: location.href, userAgent: navigator.userAgent }); try {
    if (uiTest) {
        let guard = 0;
        while (!sim.hasChoice && guard++ < 30000)
            sim.step({ moveX: 0, moveZ: 0, aimX: 1, aimZ: -1 });
        $('loading').classList.add('hidden');
        $('perf').textContent = 'UI TEST';
        updateUi(sim.snapshot());
        document.body.dataset.ready = 'choice';
        return;
    }
    renderer = new WebGLRenderer(canvas);
    await renderer.load();
    $('gpuName').textContent = renderer.rendererName;
    $('loading').classList.add('hidden');
    pushLog('v0.10 sandbox: Phenomena и Catalysts больше не имеют персональных уровней; XP растит Core Rank и глобальные оси.');
    pushLog(runMode === 'clean' ? `Чистый старт: только «${skills[startingSkill].name}», без камней и Архива.` : 'Showcase: заполненная Chain для быстрой проверки взаимодействий.');
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
}
catch (err) {
    $('loading').innerHTML = `<div class="loadbox"><b>Не удалось запустить WebGL2.</b><span>${esc(String(err))}</span></div>`;
    console.error(err);
} }
start();
