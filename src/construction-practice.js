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
    const family = q.group === 'tense-pictures' && role === 'predicate'
      ? data.examples.filter(item => item.contrastFamily === q.contrastFamily) : [];
    const candidates = [...family, ...data.examples.filter(item => item.level === 1 && item.group === q.group),
      ...data.examples.filter(item => item.level === 1)];
    const correct = q.slots[role].ja;
    const alternatives = [...new Set(candidates.filter(item => q.group !== 'tense-pictures' || item.slots[role].en !== q.slots[role].en).map(item => item.slots[role].ja))].filter(text => text && text !== correct).slice(0, 3);
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
    const levels = filters.levels ?? [filters.level];
    return data.examples.filter(q => levels.includes(q.level) &&
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
  const SPEED_KEY = 'construction-workshop-speech-speed-v1';
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const labels = { S: '主語', predicate: '述語', P1: '対象１', P2: '対象２', place: '場所', time: '時' };
  const hints = { S: 'だれ・何が？', predicate: 'どうする・どんな状態？', P1: '述語につなぐ一つ目', P2: '述語につなぐ二つ目', place: 'どこで？', time: 'いつ？' };
  let saved = null, savedVoice = '', speechSpeed = 'fast', storageOK = true;
  try { saved = JSON.parse(localStorage.getItem(KEY)); savedVoice = JSON.parse(localStorage.getItem(VOICE_KEY))?.voiceURI || ''; }
  catch (error) { if (error.name !== 'SyntaxError') storageOK = false; }
  const restored = Construction.restore(DATA, saved);
  const hasSavedLevels = saved?.version === 1 && Array.isArray(saved.levels);
  const state = {
    current: restored.current, completed: restored.completed,
    levels: hasSavedLevels ? DATA.levels.map(level => level.id).filter(id => saved.levels.includes(id)) : [1],
    group: 'all', scope: hasSavedLevels ? restored.scope : 'all', search: '',
    mode: hasSavedLevels ? restored.mode : 'select',
  };
  const attempts = new Map();
  const selections = new Map();
  let selected = null, feedback = null, passed = false, wrong = [], speechRun = 0;
  let drag = null, suppressClickUntil = 0;
  let feedbackAudio, feedbackSoundEnd = 0;
  const hasBasicImages = DATA.examples.some(q => q.level === 1 && q.image);
  function openTensePictures() {
    const first = DATA.examples.find(q => q.group === 'tense-pictures');
    Object.assign(state, { levels: [1], group: first.group, scope: 'all', mode: 'select' });
    choose(first.id);
  }
  try { if (localStorage.getItem(SPEED_KEY) === 'slow') speechSpeed = 'slow'; }
  catch { storageOK = false; }
  const hasSpeech = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const getQ = () => DATA.examples.find(q => q.id === state.current);
  function visibleExamples() {
    const pictureScope = state.scope === 'all' || state.scope === 'core';
    return Construction.visibleExamples(DATA, state).filter(q => q.level !== 1 || !hasBasicImages || !pictureScope || q.image);
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
  async function playFeedbackSound(correct) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      const audio = feedbackAudio ??= new AudioContext();
      if (audio.state !== 'running') await audio.resume();
      const now = audio.currentTime;
      if (audio.state !== 'running' || now < feedbackSoundEnd) return;

      const tone = audio.createOscillator();
      const envelope = audio.createGain();
      tone.connect(envelope);
      envelope.connect(audio.destination);

      const frequencies = correct ? [523.25, 659.25] : [440, 349.23];
      const volume = correct ? 0.10 : 0.075;
      const start = now + 0.01;
      const noteSpacing = 0.115;
      const noteLength = 0.108;
      frequencies.forEach((frequency, index) => {
        const onset = start + index * noteSpacing;
        tone.frequency.setValueAtTime(frequency, onset);
        envelope.gain.setValueAtTime(0, onset);
        envelope.gain.linearRampToValueAtTime(volume, onset + 0.016);
        envelope.gain.linearRampToValueAtTime(0, onset + noteLength);
      });
      feedbackSoundEnd = start + noteSpacing + noteLength;
      tone.onended = () => {
        tone.disconnect();
        envelope.disconnect();
      };
      tone.start(start);
      tone.stop(feedbackSoundEnd);
    } catch {
      // Grading still works when the browser cannot play audio.
    }
  }
  function choose(id) {
    if (!DATA.examples.some(q => q.id === id)) return;
    stopSpeech(); state.current = id; selected = null; feedback = null; passed = false; wrong = [];
    save(); render();
    $('practicePane').scrollTop = 0;
  }
  function synchronizeFilters() {
    for (const checkbox of $('levelChoices').querySelectorAll('input')) checkbox.checked = state.levels.includes(Number(checkbox.value));
    $('scope').value = state.scope;
    $('scopeField').hidden = !state.levels.includes(1);
  }
  function renderNav(visible) {
    $('artworkProgress').textContent = `絵のある例文 ${Object.keys(ILLUSTRATIONS).length} / ${DATA.examples.length}文`;
    $('filterCount').textContent = `${visible.length}文を表示`;
    const emptyMessage = state.levels.length ? 'この条件の例文はありません。' : 'レベルをえらぶと、例文が表示されます。';
    $('lessons').innerHTML = visible.length ? visible.map(q => `<button data-lesson="${esc(q.id)}" aria-current="${state.current === q.id}">${state.completed.includes(q.id) ? '✓ ' : ''}${esc(q.ja)}</button>`).join('') : `<p class="muted">${emptyMessage}</p>`;
    const index = Construction.navigationIndex(visible, getQ());
    $('previous').disabled = index <= 0; $('next').disabled = index < 0 || index >= visible.length - 1;
  }
  function cardHTML(q, i) {
    const card = Construction.cardsFor(q)[i];
    const locked = attempt()[i] && !targetAllowed(attempt()[i]);
    return `<button class="card ${selected === i ? 'selected' : ''}" data-card="${i}" ${locked ? 'disabled' : ''} aria-pressed="${selected === i}" aria-label="${esc(card.text)}：移動するカードをえらぶ">${esc(card.text)}</button>`;
  }
  function calendarFor(time) {
    if (time === 'every day') {
      return `
        <span class="day-calendar daily-calendar" role="img" aria-label="二週間分の全ての日にチェックが付いたカレンダー">
          <span class="daily-checks">${'<span></span>'.repeat(14)}</span>
        </span>`;
    }
    return time === 'yesterday' || time === 'tomorrow' ? `
      <span class="day-calendar ${time}" role="img" aria-label="地球儀を${time === 'yesterday' ? '左' : '右'}向きに一周するカレンダー">
        <span class="day-orbit"></span>
        <img src="assets/calendar/earth.png" alt="">
      </span>` : '';
  }
  function renderPicture(q) {
    if (!q.image) {
      $('pictureScene').innerHTML = `<div class="scene-pending japanese">${esc(q.ja)}</div>`;
      return;
    }
    const time = q.slots?.time.en ?? q.blocks.find(([role]) => role === '時')?.[1];
    $('pictureScene').innerHTML = `
      <div class="scene-visual">
        <img class="scene-illustration" src="${esc(q.image)}" alt="${esc(q.imageAlt)}" width="1536" height="1024">
        ${calendarFor(time)}
      </div>
      <figcaption class="scene-clue">${esc(q.imageClue)}</figcaption>`;
  }
  function renderExercise() {
    cancelDrag();
    const q = getQ(), basic = q.level === 1, cards = Construction.cardsFor(q), placements = attempt();
    $('main').classList.toggle('advanced', !basic);
    $('advancedInstructions').hidden = basic;
    $('japanese').textContent = q.ja;
    $('japanese').parentElement.hidden = basic;
    $('base').textContent = basic ? '' : `もとの文：${q.base}`;
    $('base').hidden = basic;
    $('modeSwitcher').hidden = !basic;
    $('cardsMode').setAttribute('aria-pressed', !usingLists());
    $('selectMode').setAttribute('aria-pressed', usingLists());
    $('pictureScene').hidden = !usingLists() && !(q.image && (!basic || q.group === 'tense-pictures'));
    $('pool').hidden = usingLists();
    $('selectedStatus').hidden = basic;
    $('selectedStatus').textContent = selected === null ? 'カードを押してから欄の見出しを押す方法でも置けます。' : `「${cards[selected].text}」を、どの欄に置く？（同じカードを押すと元に戻せます）`;
    const japaneseOrder = ['S', 'time', 'place', 'P1', 'P2', 'predicate'];
    const order = basic ? japaneseOrder.map(role => cards.findIndex(card => card.role === role)).filter(i => i >= 0) : Construction.shuffledIndices(q);
    const remaining = order.filter(i => !placements[i]);
    $('pool').innerHTML = `<div class="pool-cards">${remaining.map(i => cardHTML(q, i)).join('') || '<span class="muted">カードを置けたね。使わない欄は、そのまま空欄にしよう。</span>'}</div>`;
    $('slots').innerHTML = Construction.targetsFor(q).map((target, n) => {
      const i = placements.indexOf(target), role = basic ? target : q.blocks[n][0], locked = !targetAllowed(target);
      return `<section class="slot ${locked ? 'locked' : ''} ${wrong.includes(target) ? 'wrong' : ''}" aria-disabled="${locked}" data-drop="${esc(target)}" data-role="${esc(role)}"><button class="target" ${locked ? 'disabled' : ''} data-target="${esc(target)}" aria-label="${esc(basic ? labels[role] : `${n + 1}番 ${labels[role] || role.replace(/\bS\b/g, "主語")}`)}に置く">${esc(basic ? labels[role] : `${n + 1}. ${labels[role] || role.replace(/\bS\b/g, "主語")}`)}${basic ? '' : '<small>発音する順</small>'}</button>${i < 0 ? '<span class="empty">空欄</span>' : cardHTML(q, i)}</section>`;
    }).join('');
    if (usingLists()) {
      $('slots').innerHTML = Construction.roles.map(role => `<section class="slot ${!targetAllowed(role) ? 'locked' : ''} ${wrong.includes(role) ? 'wrong' : ''}" data-role="${role}" aria-disabled="${!targetAllowed(role)}"><label class="target" for="choice-${role}">${labels[role]}</label><select class="${picks()[role] ? 'has-choice' : 'placeholder'}" id="choice-${role}" ${!targetAllowed(role) ? 'disabled' : ''} data-choice="${role}"><option value="__unanswered__" ${Object.hasOwn(picks(), role) ? '' : 'selected'}>えらんでね</option>${Construction.choicesFor(DATA, q, role).map(text => `<option value="${esc(text)}" ${Object.hasOwn(picks(), role) && picks()[role] === text ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></section>`).join('');
    }
    if (!$('pictureScene').hidden) renderPicture(q);
    renderFeedback(q, basic);
  }
  function renderFeedback(q, basic) {
    $('feedback').innerHTML = feedback ? `<div class="feedback ${feedback.good ? 'good' : ''}">${esc(feedback.text)}</div>` : '';
    $('result').innerHTML = passed ? `
      <div class="result">
        <p class="full-english" lang="en">${esc(q.en)}</p>
        ${q.note ? `<p>${esc(q.note)}</p>` : ''}
        <div class="actions speech-controls" role="group" aria-label="英文の読み上げ">
          <select id="voice" aria-label="読み上げる声"></select>
          <div class="speech-buttons">
            <button id="speakFast" ${hasSpeech ? '' : 'disabled'}>はやく読む</button>
            <button id="speakSlow" ${hasSpeech ? '' : 'disabled'}>ゆっくり読む</button>
          </div>
        </div>
        <div class="spoken">${q.blocks.map(([role, text], index) => {
          const label = labels[role] || role.replace(/\bS\b/g, '主語');
          return `<button type="button" class="answer-part" data-role="${esc(role)}" data-speak-part="${index}" aria-label="${esc(label)}「${esc(text)}」を聞く" ${hasSpeech ? '' : 'disabled'}>
            <span class="answer-label">${esc(label)}</span>
            ${basic ? `<span class="answer-ja">${esc(q.slots[role].ja)}</span>` : ''}
            <span lang="en">${esc(text)}</span>
          </button>`;
        }).join('')}</div>
        <p class="muted" id="speechStatus" role="status">${hasSpeech ? '' : 'このブラウザーでは音声を使えません。'}</p>
      </div>` : '';
    if (passed) populateVoices();
  }
  function render() {
    const visible = visibleExamples();
    synchronizeFilters();
    renderNav(visible);
    $('main').hidden = !visible.length;
    if (visible.length) renderExercise();
  }
  function changeFilters() {
    state.levels = [...$('levelChoices').querySelectorAll('input:checked')].map(input => Number(input.value));
    state.scope = $('scope').value;
    state.group = 'all';
    const visible = visibleExamples();
    if (visible.length && !visible.some(q => q.id === state.current)) choose(visible[0].id);
    else {
      if (!visible.length) stopSpeech();
      save(); render();
    }
  }
  $('levelChoices').innerHTML = DATA.levels.map(level => `<label><input type="checkbox" value="${level.id}" aria-label="${esc(level.label)}">${level.id}</label>`).join('');
  $('levels').addEventListener('change', changeFilters);
  $('scope').addEventListener('change', changeFilters);
  $('slots').addEventListener('change', event => {
    const choice = event.target;
    const role = choice.dataset.choice;
    if (!usingLists() || !Construction.roles.includes(role) || !targetAllowed(role)) return;
    stopSpeech();
    const values = picks();
    if (choice.value === '__unanswered__') delete values[role];
    else values[role] = choice.value;

    // Keep the native selects in place so Safari can finish dismissing its picker.
    const enabled = enabledTargets();
    for (const select of $('slots').querySelectorAll('[data-choice]')) {
      const locked = !enabled.includes(select.dataset.choice);
      const hasChoice = Boolean(values[select.dataset.choice]);
      select.disabled = locked;
      select.classList.toggle('has-choice', hasChoice);
      select.classList.toggle('placeholder', !hasChoice);
      const slot = select.parentElement;
      slot.classList.toggle('locked', locked);
      slot.classList.remove('wrong');
      slot.setAttribute('aria-disabled', String(locked));
    }
    passed = false; feedback = null; wrong = [];
    renderFeedback(getQ(), true);
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
    if (button.hasAttribute('data-speak-part')) { speak(getQ().blocks[Number(button.dataset.speakPart)]?.[1]); return; }
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
      case 'cardsMode': case 'selectMode':
        stopSpeech(); state.mode = button.id === 'selectMode' ? 'select' : 'cards';
        selected = null; passed = false; feedback = null; wrong = []; save(); renderExercise(); break;
      case 'check': {
        const q = getQ(); passed = usingLists() ? Construction.choicesCorrect(q, picks()) : Construction.isCorrect(q, attempt()); wrong = [];
        playFeedbackSound(passed);
        if (passed) {
          if (!state.completed.includes(q.id)) state.completed.push(q.id);
          feedback = { good: true, text: '正解！ ことばがつながったね。' }; save();
        } else {
          const cards = Construction.cardsFor(q);
          if (usingLists()) wrong = Construction.roles.filter(role => !Construction.choiceMatches(q, picks(), role));
          else cards.forEach((_, i) => { if (attempt()[i] !== Construction.expectedTarget(q, i)) wrong.push(Construction.expectedTarget(q, i)); });
          feedback = { text: q.level === 1 ? 'もう少し。「だれが」「どうする」から考えてみよう。点線の欄を見直してね。' : 'もう少し。部品の役割と話す順を確かめてみよう。' };
        }
        renderNav(visibleExamples()); renderExercise(); break;
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
      case 'speakFast': case 'speakSlow': {
        speechSpeed = button.id === 'speakSlow' ? 'slow' : 'fast';
        speak(getQ().en);
        try { localStorage.setItem(SPEED_KEY, speechSpeed); } catch { storageOK = false; save(); }
        break;
      }
    }
  });
  function englishVoices() {
    return hasSpeech ? speechSynthesis.getVoices().filter(voice => /^en[-_]us$/i.test(voice.lang)) : [];
  }
  function preferredVoice(voices) {
    return voices.find(voice => voice.voiceURI === savedVoice) || voices.find(voice => voice.default) || voices[0];
  }
  function voiceName(name) {
    return name.split(/\s+[-–—]\s+/)[0]
      .replace(/^(?:Microsoft|Apple|Google)\s+/i, '')
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s+(?:Online|Desktop|Natural|Neural|Enhanced|Premium)\b/gi, '')
      .replace(/^(?:US\s+)?English(?:\s+(?:US|United States))?$/i, '')
      .trim() || '標準';
  }
  function populateVoices() {
    const picker = $('voice');
    if (!picker) return;
    const voices = englishVoices();
    const preferred = preferredVoice(voices);
    const options = new Map();
    for (const voice of voices) {
      const label = voiceName(voice.name);
      if (!options.has(label) || voice === preferred) options.set(label, voice.voiceURI);
    }
    picker.replaceChildren(...(options.size ? [...options].map(([label, uri]) => new Option(label, uri)) : [new Option('自動', '')]));
    picker.disabled = !preferred;
    if (preferred) picker.value = preferred.voiceURI;
  }
  $('result').addEventListener('change', event => {
    if (event.target.id !== 'voice') return;
    stopSpeech();
    $('speechStatus').textContent = '';
    savedVoice = event.target.value;
    try { localStorage.setItem(VOICE_KEY, JSON.stringify({ voiceURI: savedVoice })); } catch { storageOK = false; save(); }
  });
  function speak(text) {
    if (!passed || !hasSpeech || !text) return;
    stopSpeech(); const run = speechRun, voice = preferredVoice(englishVoices());
    const utterance = new SpeechSynthesisUtterance(text); // Never derive speech from the internal question marker.
    if (voice) utterance.voice = voice;
    utterance.lang = 'en-US'; utterance.rate = speechSpeed === 'slow' ? .6 : 1;
    const report = text => { if (run === speechRun && $('speechStatus')) $('speechStatus').textContent = text; };
    utterance.onstart = () => report('読み上げ中…'); utterance.onend = () => report('読み上げました。');
    utterance.onerror = event => { if (!['canceled', 'interrupted'].includes(event.error)) report('声を使えませんでした。別の声をえらぶか、端末の音声設定を確認してください。'); };
    try { speechSynthesis.speak(utterance); } catch { report('声を使えませんでした。端末の音声設定を確認してください。'); }
  }
  if (hasSpeech) speechSynthesis.addEventListener('voiceschanged', populateVoices);
  if (location.hash === '#tense-pictures') openTensePictures();
  else {
    const visible = visibleExamples();
    if (visible.length && !visible.some(q => q.id === state.current)) state.current = visible[0].id;
    save(); render();
  }
  window.addEventListener('hashchange', () => {
    if (location.hash === '#tense-pictures') openTensePictures();
  });
}
