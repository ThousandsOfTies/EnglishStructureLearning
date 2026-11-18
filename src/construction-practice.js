/* Shared exercise rules are also used by the Node tests. */
'use strict';
const Construction = (() => {
  const roles = ['S', 'predicate', 'P1', 'P2', 'place', 'time'];
  function cardsFor(q) {
    return q.level === 1
      ? roles.filter(r => q.slots[r].en).map(r => ({ text: q.slots[r].ja, role: r, en: q.slots[r].en }))
      : q.blocks.map(([role, text]) => ({ text, role, en: text }));
  }
  function targetsFor(q) { return q.level === 1 ? roles : q.blocks.map((_, i) => String(i)); }
  function expectedTarget(q, i) { return q.level === 1 ? cardsFor(q)[i].role : String(i); }
  function isCorrect(q, placements) {
    return cardsFor(q).every((_, i) => placements[i] === expectedTarget(q, i));
  }
  function choicesFor(data, q, role) {
    const candidates = [...data.examples.filter(item => item.level === 1 && item.group === q.group),
      ...data.examples.filter(item => item.level === 1)];
    const correct = q.slots[role].ja;
    const alternatives = [...new Set(candidates.map(item => item.slots[role].ja))].filter(text => text && text !== correct).slice(0, 3);
    const options = [...new Set([correct, ...alternatives])].filter(Boolean);
    // Vary where the correct answer appears instead of always placing it first.
    const offset = [...q.id + role].reduce((n, c) => n + c.charCodeAt(0), 0) % options.length;
    return options.slice(offset).concat(options.slice(0, offset));
  }
  function choicesCorrect(q, choices) {
    return q.level === 1 && roles.every(role => choiceMatches(q, choices, role));
  }
  function choiceMatches(q, choices, role) {
    if (['P1', 'P2', 'place', 'time'].includes(role) && !q.slots[role].ja) return !choices[role];
    return Object.hasOwn(choices, role) && choices[role] === q.slots[role].ja;
  }
  function enabledRoles(subjectFilled, predicateFilled) {
    if (!subjectFilled) return ['S'];
    return predicateFilled ? [...roles] : ['S', 'predicate'];
  }
  function place(q, placements, index, target) {
    const cards = cardsFor(q);
    if (!Number.isInteger(index) || !cards[index] || (target !== '' && !targetsFor(q).includes(target))) return placements;
    const next = cards.map((_, i) => placements[i] || '');
    if (target !== '') next.forEach((value, i) => { if (i !== index && value === target) next[i] = ''; });
    next[index] = target;
    return next;
  }
  function visibleExamples(data, filters) {
    const term = filters.search.trim().toLowerCase();
    return data.examples.filter(q => q.level === filters.level &&
      (q.level !== 1 || ((filters.group === 'all' || q.group === filters.group) &&
        (filters.scope === 'all' || (filters.scope === 'core' && q.contrastFamily === q.id && !q.pronounFocus) ||
         (filters.scope === 'pronouns' && q.pronounFocus && !q.extension) ||
         (filters.scope === 'extension' && q.extension)))) &&
      (!term || [q.ja, q.en, q.focus || '', q.id].some(s => s.toLowerCase().includes(term))));
  }
  function restore(data, saved) {
    const ids = new Set(data.examples.map(q => q.id));
    const initial = { current: data.examples[0].id, completed: [], level: 1, group: 'go', scope: 'core', search: '', mode: 'cards' };
    if (!saved || saved.version !== 1) return initial;
    initial.completed = [...new Set(Array.isArray(saved.completed) ? saved.completed.filter(id => ids.has(id)) : [])];
    if ([1, 2, 3].includes(saved.level)) initial.level = saved.level;
    if (saved.mode === 'select') initial.mode = 'select';
    if (saved.group === 'all' || data.groups.some(g => g.key === saved.group)) initial.group = saved.group;
    if (['core', 'all', 'pronouns', 'extension'].includes(saved.scope)) initial.scope = saved.scope;
    if (typeof saved.search === 'string') initial.search = saved.search.slice(0, 200);
    if (ids.has(saved.current)) initial.current = saved.current;
    return initial;
  }
  function navigationIndex(visible, q) {
    const direct = visible.findIndex(item => item.id === q.id);
    return direct >= 0 ? direct : visible.findIndex(item => item.id === q.contrastFamily);
  }
  // Stable shuffling makes a retry familiar without presenting the answer in order.
  function shuffledIndices(q) {
    const indices = cardsFor(q).map((_, i) => i);
    let seed = [...q.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 17);
    for (let i = indices.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    if (indices.length > 1 && indices.every((value, i) => value === i)) indices.push(indices.shift());
    return indices;
  }
  return { roles, cardsFor, targetsFor, expectedTarget, isCorrect, choicesFor, choicesCorrect, choiceMatches, enabledRoles, place, visibleExamples, restore, shuffledIndices, navigationIndex };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Construction;

if (typeof document !== 'undefined') {
  const DATA = JSON.parse(document.getElementById('curriculum').textContent);
  const ILLUSTRATIONS = JSON.parse(document.getElementById('illustrations').textContent).images;
  for (const q of DATA.examples) {
    const illustration = ILLUSTRATIONS[q.id];
    if (illustration) { q.image = illustration.file; q.imageAlt = illustration.alt; q.imageClue = illustration.clue; }
  }
  const KEY = 'construction-workshop-original-v1', VOICE_KEY = 'sentence-workshop-voice-v1';
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const labels = { S: '主語', predicate: '述語', P1: 'P1', P2: 'P2', place: '場所', time: '時' };
  const hints = { S: 'だれ・何が？', predicate: 'どうする・どんな状態？', P1: '述語につなぐ一つ目', P2: '述語につなぐ二つ目', place: 'どこで？', time: 'いつ？' };
  const meaningLabel = { routine: '基本：いつもの動き', state: '基本：状態', ongoing: '今している', past: '過去の場面' };
  let saved = null, savedVoice = '', storageOK = true;
  try { saved = JSON.parse(localStorage.getItem(KEY)); savedVoice = JSON.parse(localStorage.getItem(VOICE_KEY))?.voiceURI || ''; }
  catch (error) { if (error.name !== 'SyntaxError') storageOK = false; }
  let state = Construction.restore(DATA, saved);
  const attempts = new Map();
  const selections = new Map();
  let selected = null, feedback = null, passed = false, wrong = [], speechRun = 0;
  let drag = null, suppressClickUntil = 0;
  // Start directly in the playable picture set, including when resuming an older save.
  let illustratedOnly = DATA.examples.some(q => q.level === 1 && q.image);
  if (illustratedOnly) {
    Object.assign(state, { level: 1, group: 'all', scope: 'all', search: '', mode: 'select' });
    if (!DATA.examples.some(q => q.id === state.current && q.level === 1 && q.image)) {
      state.current = DATA.examples.find(q => q.level === 1 && q.image).id;
    }
  }
  const hasSpeech = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const getQ = () => DATA.examples.find(q => q.id === state.current);
  function visibleExamples() {
    return Construction.visibleExamples(DATA, state).filter(q => !illustratedOnly || q.image);
  }
  const usingLists = () => getQ().level === 1 && state.mode === 'select';
  function picks() {
    if (!selections.has(state.current)) selections.set(state.current, {});
    return selections.get(state.current);
  }
  function attempt() {
    if (!attempts.has(state.current)) attempts.set(state.current, Construction.cardsFor(getQ()).map(() => ''));
    return attempts.get(state.current);
  }
  function enabledTargets() {
    if (getQ().level !== 1) return Construction.targetsFor(getQ());
    return usingLists()
      ? Construction.enabledRoles(Boolean(picks().S), Boolean(picks().predicate))
      : Construction.enabledRoles(attempt().includes('S'), attempt().includes('predicate'));
  }
  function targetAllowed(target) { return target === '' || enabledTargets().includes(target); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ ...state, version: 1 })); }
    catch { storageOK = false; }
    $('storageStatus').textContent = storageOK ? '' : ' このブラウザーでは保存できません。開いている間は練習できます。';
  }
  function stopSpeech() { speechRun++; if (hasSpeech) speechSynthesis.cancel(); }
  function choose(id) {
    if (!DATA.examples.some(q => q.id === id)) return;
    stopSpeech(); state.current = id; selected = null; feedback = null; passed = false; wrong = [];
    save(); render();
  }
  function synchronizeFilters() {
    $('level').value = state.level; $('group').value = state.group; $('scope').value = state.scope; $('search').value = state.search;
    $('groupField').hidden = $('scopeField').hidden = state.level !== 1;
  }
  function renderNav() {
    const visible = visibleExamples();
    const illustratedCount = DATA.examples.filter(q => q.level === state.level && q.image).length;
    $('showIllustrated').setAttribute('aria-pressed', illustratedOnly);
    $('showIllustrated').textContent = illustratedOnly ? '絵のない例文も見る' : `絵のある${illustratedCount}文で遊ぶ`;
    $('showIllustrated').disabled = !illustratedOnly && illustratedCount === 0;
    $('artworkProgress').textContent = `絵のある例文 ${Object.keys(ILLUSTRATIONS).length} / ${DATA.examples.length}文`;
    $('filterCount').textContent = illustratedOnly ? `${visible.length}文を表示 ／ 絵のある${illustratedCount}文` : `${visible.length}文を表示 ／ 全${DATA.examples.length}文`;
    $('lessons').innerHTML = visible.length ? visible.map(q => `<button data-lesson="${esc(q.id)}" aria-current="${state.current === q.id}">${state.completed.includes(q.id) ? '✓ ' : ''}${esc(q.ja)}</button>`).join('') : '<p class="muted">見つかりません。テーマや検索することばを変えてみよう。</p>';
    const playable = illustratedOnly ? DATA.examples.filter(q => q.level === state.level && q.image) : DATA.examples;
    const completed = playable.filter(q => state.completed.includes(q.id)).length;
    $('progressText').textContent = `できた ${completed} / ${playable.length}`;
    $('progressBar').max = playable.length; $('progressBar').value = completed;
    const index = Construction.navigationIndex(visible, getQ());
    $('previous').disabled = index <= 0; $('next').disabled = index < 0 || index >= visible.length - 1;
  }
  function cardHTML(q, i) {
    const card = Construction.cardsFor(q)[i];
    const locked = attempt()[i] && !targetAllowed(attempt()[i]);
    return `<button class="card ${selected === i ? 'selected' : ''}" data-card="${i}" ${locked ? 'disabled' : ''} aria-pressed="${selected === i}" aria-label="${esc(card.text)}：移動するカードをえらぶ">${esc(card.text)}</button>`;
  }
  function renderExercise() {
    cancelDrag();
    const q = getQ(), basic = q.level === 1, cards = Construction.cardsFor(q), placements = attempt();
    $('main').classList.toggle('advanced', !basic);
    $('exerciseTitle').textContent = basic ? '六つの欄で、文をつくろう。' : '英語の部品を、話す順に並べよう。';
    $('instruction').textContent = basic ? '主語 → 述語の順に入れよう。述語まで入れると、残りの欄も使えるよ。' : '英語のカードをドラッグして、話す順に置こう。カード置き場へ戻すこともできるよ。';
    $('japanese').textContent = q.ja;
    $('japanese').parentElement.hidden = basic;
    $('base').textContent = basic ? '' : `もとの文：${q.base}`;
    $('base').hidden = basic;
    $('modeSwitcher').hidden = !basic;
    $('cardsMode').setAttribute('aria-pressed', !usingLists());
    $('selectMode').setAttribute('aria-pressed', usingLists());
    $('pictureScene').hidden = !usingLists() && !(q.image && !basic);
    $('pool').hidden = $('selectedStatus').hidden = usingLists();
    const family = basic && q.contrastFamily ? DATA.examples.filter(item => item.contrastFamily === q.contrastFamily && (!illustratedOnly || item.image)) : [];
    $('contrasts').innerHTML = family.length > 1 ? family.map(item => `<button data-lesson="${esc(item.id)}" aria-pressed="${item.id === q.id}">${esc(meaningLabel[item.meaning])}</button>`).join('') : '';
    $('selectedStatus').textContent = selected === null ? 'カードを押してから欄の見出しを押す方法でも置けます。' : `「${cards[selected].text}」を、どの欄に置く？（同じカードを押すと元に戻せます）`;
    const japaneseOrder = ['S', 'time', 'place', 'P1', 'P2', 'predicate'];
    const order = basic ? japaneseOrder.map(role => cards.findIndex(card => card.role === role)).filter(i => i >= 0) : Construction.shuffledIndices(q);
    const remaining = order.filter(i => !placements[i]);
    $('pool').innerHTML = `<div class="pool-cards">${remaining.map(i => cardHTML(q, i)).join('') || '<span class="muted">カードを置けたね。使わない欄は、そのまま空欄にしよう。</span>'}</div>`;
    $('slots').innerHTML = Construction.targetsFor(q).map((target, n) => {
      const i = placements.indexOf(target), role = basic ? target : q.blocks[n][0], locked = !targetAllowed(target);
      return `<section class="slot ${locked ? 'locked' : ''} ${wrong.includes(target) ? 'wrong' : ''}" aria-disabled="${locked}" data-drop="${esc(target)}" data-role="${esc(role)}"><button class="target" ${locked ? 'disabled' : ''} data-target="${esc(target)}" aria-label="${esc(basic ? labels[role] : `${n + 1}番 ${labels[role] || role.replace(/\bS\b/g, "主語")}`)}に置く">${esc(basic ? labels[role] : `${n + 1}. ${labels[role] || role.replace(/\bS\b/g, "主語")}`)}<small>${basic ? esc(hints[role]) : '発音する順'}</small></button>${i < 0 ? '<span class="empty">空欄</span>' : cardHTML(q, i)}${passed ? `<div class="english-under">${esc(basic ? q.slots[role].en || '—' : cards[n].en)}</div>` : ''}</section>`;
    }).join('');
    if (usingLists()) {
      $('exerciseTitle').textContent = q.image ? '絵を見ながら、ことばをえらぼう。' : 'ことばをえらんで、文をつくろう。';
      $('instruction').textContent = 'まず主語、次に述語をえらぼう。使わない欄は「えらんでね」のままで大丈夫。';
      $('slots').innerHTML = Construction.roles.map(role => `<section class="slot ${!targetAllowed(role) ? 'locked' : ''} ${wrong.includes(role) ? 'wrong' : ''}" data-role="${role}" aria-disabled="${!targetAllowed(role)}"><label class="target" for="choice-${role}">${labels[role]}<small>${hints[role]}</small></label><select class="${picks()[role] ? 'has-choice' : 'placeholder'}" id="choice-${role}" ${!targetAllowed(role) ? 'disabled' : ''} data-choice="${role}"><option value="__unanswered__" ${Object.hasOwn(picks(), role) ? '' : 'selected'}>えらんでね</option>${Construction.choicesFor(DATA, q, role).map(text => `<option value="${esc(text)}" ${Object.hasOwn(picks(), role) && picks()[role] === text ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>${passed ? `<div class="english-under">${esc(q.slots[role].en || '—')}</div>` : ''}</section>`).join('');
    }
    if (!$('pictureScene').hidden) $('pictureScene').innerHTML = q.image
      ? `<img src="${esc(q.image)}" alt="${esc(q.imageAlt)}" width="1536" height="1024"><figcaption class="scene-clue">${esc(q.imageClue)}</figcaption>`
      : '<div class="scene-pending"><b>この場面の絵は準備中です</b></div>';
    $('feedback').innerHTML = feedback ? `<div class="feedback ${feedback.good ? 'good' : ''}">${esc(feedback.text)}</div>` : '';
    $('result').innerHTML = passed ? `<div class="result"><b>できた！ つなげて読んでみよう。</b><p class="full-english" lang="en">${esc(q.en)}</p>${q.note ? `<p>${esc(q.note)}</p>` : ''}<div class="spoken">${q.blocks.map(([role, text]) => `<span lang="en"><small>${esc(labels[role] || role.replace(/\bS\b/g, "主語"))}</small>${esc(text)}</span>`).join('')}</div><div class="actions"><button id="speak" ${hasSpeech ? '' : 'disabled'}>英語を聞く</button></div><p class="muted" id="speechStatus" role="status">${hasSpeech ? '' : 'このブラウザーでは音声を使えません。'}</p></div>` : '';
  }
  function render() { synchronizeFilters(); renderNav(); renderExercise(); }
  function changeFilters(event) {
    if (event.target.id === 'level' && Number($('level').value) !== 1) illustratedOnly = false;
    state.level = Number($('level').value); state.group = $('group').value; state.scope = $('scope').value; state.search = $('search').value;
    if (state.level === 1 && event.target.id === 'group') {
      if (state.group.startsWith('pronouns-')) state.scope = state.group === 'pronouns-reflexive' ? 'extension' : 'pronouns';
      else if (state.group !== 'all' && ['pronouns', 'extension'].includes(state.scope)) state.scope = 'core';
    }
    if (event.target.id === 'scope' && state.group.startsWith('pronouns-') &&
        (state.scope === 'core' || (state.scope === 'extension') !== (state.group === 'pronouns-reflexive'))) state.group = 'all';
    if (['pronouns', 'extension'].includes(state.scope) && state.level === 1 && !state.group.startsWith('pronouns-')) state.group = 'all';
    const visible = visibleExamples();
    if (visible.length && !visible.some(q => q.id === state.current)) choose(visible[0].id);
    else {
      // An empty search must not leave a different level's exercise on screen.
      if (getQ().level !== state.level) choose(DATA.examples.find(q => q.level === state.level).id);
      else { save(); render(); }
    }
  }
  $('level').innerHTML = DATA.levels.map(l => `<option value="${l.id}">${esc(l.label)}</option>`).join('');
  $('group').innerHTML = '<option value="all">すべてのテーマ</option>' + DATA.groups.map(g => `<option value="${esc(g.key)}">${esc(g.ja)} · ${esc(g.label)}</option>`).join('');
  for (const id of ['level', 'group', 'scope']) $(id).addEventListener('change', changeFilters);
  $('search').addEventListener('input', changeFilters);
  $('slots').addEventListener('change', event => {
    const role = event.target.dataset.choice;
    if (!usingLists() || !Construction.roles.includes(role) || !targetAllowed(role)) return;
    stopSpeech();
    if (event.target.value === '__unanswered__') delete picks()[role];
    else picks()[role] = event.target.value;
    passed = false; feedback = null; wrong = []; renderExercise();
    $('choice-' + role)?.focus({ preventScroll: true });
  });
  function moveCard(index, target) {
    if (!targetAllowed(target)) return;
    stopSpeech();
    attempts.set(state.current, Construction.place(getQ(), attempt(), index, target));
    selected = null; feedback = null; passed = false; wrong = [];
    renderExercise();
    document.querySelector(`[data-card="${index}"]`)?.focus({ preventScroll: true });
  }
  function dropZone(x, y) {
    const zone = document.elementFromPoint(x, y)?.closest('[data-drop]');
    return zone && targetAllowed(zone.dataset.drop) ? zone : null;
  }
  function updateDrag() {
    if (!drag?.moved) return;
    drag.ghost.style.left = `${drag.x}px`; drag.ghost.style.top = `${drag.y}px`;
    const zone = dropZone(drag.x, drag.y);
    if (drag.zone !== zone) {
      drag.zone?.classList.remove('drop-hover'); zone?.classList.add('drop-hover'); drag.zone = zone;
    }
  }
  function scrollWhileDragging() {
    if (!drag?.moved) return;
    // Keep lower rows reachable when dragging with a finger on a small screen.
    const edge = 64, height = window.innerHeight;
    if (drag.y < edge) window.scrollBy(0, -Math.ceil((edge - drag.y) / 5));
    else if (drag.y > height - edge) window.scrollBy(0, Math.ceil((drag.y - height + edge) / 5));
    updateDrag();
    drag.frame = requestAnimationFrame(scrollWhileDragging);
  }
  function cancelDrag() {
    if (!drag) return;
    const previous = drag; drag = null;
    if (previous.moved) suppressClickUntil = Date.now() + 450;
    cancelAnimationFrame(previous.frame);
    previous.ghost?.remove(); previous.source.classList.remove('drag-source'); previous.zone?.classList.remove('drop-hover');
    if (previous.source.hasPointerCapture(previous.pointerId)) previous.source.releasePointerCapture(previous.pointerId);
  }
  document.addEventListener('dragstart', event => { if (event.target.closest('[data-card]')) event.preventDefault(); });
  document.addEventListener('pointerdown', event => {
    if (drag || !event.isPrimary || event.button !== 0) return;
    const source = event.target.closest('[data-card]'); if (!source || source.disabled) return;
    drag = { source, index: Number(source.dataset.card), pointerId: event.pointerId,
      startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false };
    source.setPointerCapture(event.pointerId);
  });
  document.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.x = event.clientX; drag.y = event.clientY;
    if (!drag.moved && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) >= 7) {
      drag.moved = true; stopSpeech();
      drag.ghost = drag.source.cloneNode(true);
      drag.ghost.removeAttribute('data-card'); drag.ghost.removeAttribute('aria-pressed');
      drag.ghost.setAttribute('aria-hidden', 'true'); drag.ghost.tabIndex = -1;
      drag.ghost.className = 'card drag-ghost';
      drag.ghost.style.width = `${drag.source.getBoundingClientRect().width}px`;
      document.body.append(drag.ghost); drag.source.classList.add('drag-source');
      drag.frame = requestAnimationFrame(scrollWhileDragging);
    }
    if (drag.moved) { event.preventDefault(); updateDrag(); }
  }, { passive: false });
  document.addEventListener('pointerup', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const { index, moved } = drag;
    const zone = moved ? dropZone(event.clientX, event.clientY) : null;
    cancelDrag();
    if (moved) { event.preventDefault(); if (zone) moveCard(index, zone.dataset.drop); }
  });
  document.addEventListener('pointercancel', event => { if (drag?.pointerId === event.pointerId) cancelDrag(); });
  document.addEventListener('lostpointercapture', event => { if (drag?.pointerId === event.pointerId) cancelDrag(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') cancelDrag(); });
  window.addEventListener('blur', cancelDrag);
  document.addEventListener('click', event => {
    if (event.detail !== 0 && Date.now() < suppressClickUntil) { event.preventDefault(); return; }
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.lesson) { choose(button.dataset.lesson); return; }
    if (button.hasAttribute('data-card')) {
      const i = Number(button.dataset.card);
      if (selected === i) { attempts.set(state.current, Construction.place(getQ(), attempt(), i, '')); selected = null; }
      else selected = i;
      passed = false; feedback = null; wrong = []; renderExercise();
      document.querySelector(`[data-card="${i}"]`)?.focus({ preventScroll: true }); return;
    }
    if (button.hasAttribute('data-target')) {
      if (!targetAllowed(button.dataset.target)) return;
      if (selected === null) { feedback = { text: 'まず、動かしたいカードをえらぼう。' }; }
      else { attempts.set(state.current, Construction.place(getQ(), attempt(), selected, button.dataset.target)); selected = null; feedback = null; }
      passed = false; wrong = []; renderExercise();
      document.querySelector(`[data-target="${button.dataset.target}"]`)?.focus({ preventScroll: true }); return;
    }
    switch (button.id) {
      case 'showIllustrated': {
        illustratedOnly = !illustratedOnly;
        state.group = 'all'; state.scope = 'all'; state.search = ''; state.mode = state.level === 1 ? 'select' : 'cards';
        const visible = visibleExamples();
        choose(visible.some(q => q.id === state.current) ? state.current : visible[0].id); break;
      }
      case 'cardsMode': case 'selectMode':
        stopSpeech(); state.mode = button.id === 'selectMode' ? 'select' : 'cards';
        selected = null; passed = false; feedback = null; wrong = []; save(); renderExercise(); break;
      case 'check': {
        const q = getQ(); passed = usingLists() ? Construction.choicesCorrect(q, picks()) : Construction.isCorrect(q, attempt()); wrong = [];
        if (passed) {
          if (!state.completed.includes(q.id)) state.completed.push(q.id);
          feedback = { good: true, text: '正解！ ことばがつながったね。' }; save();
        } else {
          const cards = Construction.cardsFor(q);
          if (usingLists()) wrong = Construction.roles.filter(role => !Construction.choiceMatches(q, picks(), role));
          else cards.forEach((_, i) => { if (attempt()[i] !== Construction.expectedTarget(q, i)) wrong.push(Construction.expectedTarget(q, i)); });
          feedback = { text: q.level === 1 ? 'もう少し。「だれが」「どうする」から考えてみよう。点線の欄を見直してね。' : 'もう少し。部品の役割と話す順を確かめてみよう。' };
        }
        renderNav(); renderExercise(); break;
      }
      case 'hint': {
        const q = getQ(), cards = Construction.cardsFor(q);
        if (usingLists()) {
          const role = Construction.roles.find(role => !Construction.choiceMatches(q, picks(), role));
          feedback = { text: role ? q.slots[role].ja ? `${labels[role]}（${hints[role]}）には「${q.slots[role].ja}」をえらぼう。` : `${labels[role]}は使わないよ。「えらんでね」に戻そう。` : '全部えらべたね。「たしかめる」を押してみよう。' };
          renderExercise(); break;
        }
        const i = selected ?? cards.findIndex((_, n) => attempt()[n] !== Construction.expectedTarget(q, n));
        feedback = { text: i < 0 ? '全部置けたね。「たしかめる」を押してみよう。' : q.level === 1 ? `「${cards[i].text}」は ${labels[cards[i].role]}（${hints[cards[i].role]}）へ。${q.note || ''}` : `「${cards[i].text}」は${i + 1}番目。「${cards[i].role}」の部品だよ。${q.note || ''}` };
        renderExercise(); break;
      }
      case 'reset': stopSpeech(); if (usingLists()) selections.delete(state.current); else attempts.delete(state.current); selected = null; passed = false; wrong = []; feedback = null; renderExercise(); break;
      case 'previous': case 'next': {
        const visible = visibleExamples(), i = Construction.navigationIndex(visible, getQ());
        const next = visible[i + (button.id === 'next' ? 1 : -1)]; if (next) choose(next.id); break;
      }
      case 'speak': speak(); break;
      case 'refreshVoices': populateVoices(); break;
    }
  });
  function englishVoices() { return hasSpeech ? speechSynthesis.getVoices().filter(v => /^en(?:[-_]|$)/i.test(v.lang)) : []; }
  function populateVoices() {
    const voices = englishVoices();
    $('voice').innerHTML = '<option value="">自動でえらぶ</option>' + voices.map(v => `<option value="${esc(v.voiceURI)}">${esc(v.name)}（${esc(v.lang)}）</option>`).join('');
    if (savedVoice && !voices.some(v => v.voiceURI === savedVoice)) $('voice').insertAdjacentHTML('beforeend', `<option value="${esc(savedVoice)}">保存した声（現在は見つかりません）</option>`);
    $('voice').value = savedVoice; $('voice').disabled = !hasSpeech;
    $('voiceStatus').textContent = !hasSpeech ? 'このブラウザーでは音声を使えません。' : voices.length ? '聞きやすい声をえらんでね。' : '英語の声が見つかりません。声の一覧を更新するか、端末の音声設定を確認してください。';
  }
  $('voice').addEventListener('change', () => {
    stopSpeech(); savedVoice = $('voice').value;
    try { localStorage.setItem(VOICE_KEY, JSON.stringify({ voiceURI: savedVoice })); } catch { storageOK = false; save(); }
  });
  function speak() {
    if (!passed || !hasSpeech) return;
    stopSpeech(); const run = speechRun, voices = englishVoices();
    const voice = voices.find(v => v.voiceURI === savedVoice) || voices.find(v => v.lang.toLowerCase() === 'en-us') || voices[0];
    const utterance = new SpeechSynthesisUtterance(getQ().en); // Never derive speech from the internal question marker.
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || 'en-US'; utterance.rate = .82;
    const report = text => { if (run === speechRun && $('speechStatus')) $('speechStatus').textContent = text; };
    utterance.onstart = () => report('読み上げ中…'); utterance.onend = () => report('読み上げました。');
    utterance.onerror = event => { if (!['canceled', 'interrupted'].includes(event.error)) report('声を使えませんでした。音声設定で別の声をえらんでください。'); };
    try { speechSynthesis.speak(utterance); } catch { report('声を使えませんでした。端末の音声設定を確認してください。'); }
  }
  if (hasSpeech) speechSynthesis.addEventListener('voiceschanged', populateVoices);
  // A saved comparison can be outside the basic-scene filter; retain it for resuming.
  if (getQ().level !== state.level) state.current = DATA.examples.find(q => q.level === state.level).id;
  populateVoices(); save(); render();
}
