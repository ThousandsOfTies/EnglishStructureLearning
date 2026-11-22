/* Shared exercise rules are also used by the Node tests. */
'use strict';
const Construction = (() => {
  const roles = ['S', 'support', 'predicate', 'P1', 'P2', 'place', 'time'];
  const subjectRoles = new Set(['S', '疑問詞＝S']);
  const predicateSupportRoles = ['support', '助動詞', '助動詞＋否定', '否定', 'be', '疑問の支え'];
  const predicateRoles = new Set([...predicateSupportRoles, 'predicate', '述語', '述語の残り']);
  function isSupportRole(role) { return role === '頻度' || predicateSupportRoles.includes(role); }
  function cardsFor(q) {
    return q.level === 1
      ? roles.filter(r => q.slots[r].ja).map(r => ({ text: q.slots[r].ja, role: r, en: q.slots[r].en }))
      : q.blocks.map(([role, en, text]) => ({ text, role, en }));
  }
  function targetsFor(q) {
    if (q.level === 1) return roles;
    const targets = q.blocks.map((_, i) => String(i));
    if (q.level === 2 && !q.blocks.some(([role]) => role === 'P2')) {
      const position = q.blocks.findIndex(([role]) => role === '場所' || role === '時');
      targets.splice(position < 0 ? targets.length : position, 0, 'P2');
    }
    return targets;
  }
  function targetRole(q, id) {
    return q.level === 1 || id === 'P2' ? id : q.blocks[Number(id)][0];
  }
  function expectedTarget(q, i) { return q.level === 1 ? cardsFor(q)[i].role : String(i); }
  function wrongCardTargets(q, placements) {
    const expected = cardsFor(q).map((_, i) => expectedTarget(q, i));
    return targetsFor(q).filter(target => placements.indexOf(target) !== expected.indexOf(target));
  }
  function isCorrect(q, placements) {
    return wrongCardTargets(q, placements).length === 0;
  }
  function rotateChoices(options, seed) {
    const offset = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % options.length;
    return options.slice(offset).concat(options.slice(0, offset));
  }
  function choicesFor(data, q, role) {
    if (q.level === 3) return shuffledIndices(q).map(index => q.blocks[index][2]);
    if (q.level === 2) {
      if (role === 'P2') return rotateChoices(Object.values(data.level2Choices.P2), q.id + role);
      const [category, english, correct] = q.blocks[Number(role)];
      const alternatives = [...new Set(Object.entries(data.level2Choices[category])
        .filter(([en, ja]) => en !== english && ja !== correct).map(([, ja]) => ja))];
      const limit = category === '助動詞' ? 4 : 3;
      return rotateChoices([correct, ...alternatives.slice(0, limit)], q.id + role);
    }
    const family = q.group === 'tense-pictures' && role === 'predicate'
      ? data.examples.filter(item => item.contrastFamily === q.contrastFamily) : [];
    const candidates = [...family, ...data.examples.filter(item => item.level === 1 && item.group === q.group),
      ...data.examples.filter(item => item.level === 1)];
    const correct = q.slots[role].ja;
    const alternatives = [...new Set(candidates.filter(item => q.group !== 'tense-pictures' || item.slots[role].en !== q.slots[role].en).map(item => item.slots[role].ja))].filter(text => text && text !== correct).slice(0, 3);
    const options = [...new Set([correct, ...alternatives])].filter(Boolean);
    // Vary where the correct answer appears instead of always placing it first.
    return rotateChoices(options, q.id + role);
  }
  function choicesCorrect(q, choices) {
    return targetsFor(q).every(role => choiceMatches(q, choices, role));
  }
  function choiceMatches(q, choices, role) {
    if (q.level === 2 && role === 'P2') return !choices[role];
    if (q.level !== 1) return choices[role] === q.blocks[Number(role)][2];
    if (['support', 'P1', 'P2', 'place', 'time'].includes(role) && !q.slots[role].ja) return !choices[role];
    return Object.hasOwn(choices, role) && choices[role] === q.slots[role].ja;
  }
  function enabledTargets(q, filled) {
    const targets = targetsFor(q);
    const subjects = targets.filter(id => subjectRoles.has(targetRole(q, id)));
    if (subjects.some(id => !filled.includes(id))) return subjects;
    const predicates = targets.filter(id => predicateRoles.has(targetRole(q, id)));
    const missingPredicate = predicates.some(id => !filled.includes(id) && (q.level !== 1 || q.slots[id].ja));
    return missingPredicate ? [...subjects, ...predicates] : targets;
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
    const initial = { current: data.examples[0].id, completed: [], seenGuides: [], level: 1, group: 'go', scope: 'core', search: '', mode: 'cards' };
    if (!saved || saved.version !== 1) return initial;
    initial.completed = [...new Set(Array.isArray(saved.completed) ? saved.completed.filter(id => ids.has(id)) : [])];
    if (Array.isArray(saved.seenGuides)) initial.seenGuides = data.levels.map(level => level.id).filter(id => saved.seenGuides.includes(id));
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
  return { roles, cardsFor, targetsFor, targetRole, isSupportRole, expectedTarget, wrongCardTargets, isCorrect, choicesFor, choicesCorrect, choiceMatches, enabledTargets, place, visibleExamples, restore, shuffledIndices, navigationIndex };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Construction;

if (typeof document !== 'undefined') {
  const DATA = JSON.parse(document.getElementById('curriculum').textContent);
  const ILLUSTRATIONS = JSON.parse(document.getElementById('illustrations').textContent).images;
  for (const q of DATA.examples) {
    const illustration = ILLUSTRATIONS[q.id];
    if (illustration) {
      const revision = illustration.revision ? `?v=${encodeURIComponent(illustration.revision)}` : '';
      q.image = illustration.file + revision;
      q.imageAlt = illustration.alt;
      q.imageClue = illustration.clue;
    }
  }
  const KEY = 'construction-workshop-original-v1', VOICE_KEY = 'sentence-workshop-voice-v1';
  const SPEED_KEY = 'construction-workshop-speech-speed-v1';
  const speechRates = { normal: 1, slow: .6 };
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const labels = { S: '主語', support: '助述部', predicate: '述語', P1: '対象１', P2: '対象２', place: '場所', time: '時',
    'question-marker': '声に出さない目印', there: '文頭の there' };
  const levelGuides = {
    1: {
      summary: 'ふだんの動きや、今のようすを伝える文をつくる。',
      examples: [{
        id: 'tense-bicycle',
        heading: '一般動詞で「すること・気持ち」を伝える',
        explanation: '「箱を押す」なら箱に働きかけます。「走る」ならその人自身が動きます。「音楽が好き」の like も、気持ちを表す一般動詞です。',
        practice: '助述部の「する」は文を組み立てる目印です。I run. は「私が走る」だけなので、「対象１」は空欄です。',
      }, {
        id: 'build-be-noun-1',
        heading: 'be で「何者か・どんなようすか」をつなぐ',
        explanation: '「私は生徒です」なら何者か、「彼女は眠いです」ならどんなようすかを、be で主語につなぎます。「私＝生徒」は、私が生徒の一人だというイメージです。',
        practice: 'この例では、助述部で「である」、述語で「生徒」をえらびます。',
      }],
      note: '「今〜している」と伝える文では、助述部で「〜いる」をえらびます。',
    },
    2: {
      summary: 'レベル1の文に「程度」を加えます。',
      introduction: '「自転車に乗る」に「できる」を加えると、「自転車に乗れる」になります。このアプリでは、その「程度」を吹き出しの先にいる話し手の表情やしぐさで表します。話し手の顔と手をよく見て、助述部に入れることばをえらびましょう。',
      examples: [{
        id: 'level2-01',
        heading: '自信のある笑顔 → 〜できる（can）',
        picture: 'speaker',
        explanation: '女の子がにっこり笑って親指を立てています。「大丈夫、私にできるよ」という気持ちです。',
      }, {
        heading: '少し迷った顔 → 〜するかもしれない（might）',
        picture: 'pose',
        image: 'assets/character-materials/modal-speakers/girl-modal-poses.png',
        imageAlt: 'ほおに手を当て、こめかみに汗を一粒浮かべている女の子。',
        explanation: '女の子がほおに手を当て、少し迷った顔をしています。「来る可能性はあるけど、まだ分からない」という気持ちです。',
        en: 'She might come.',
        ja: '彼女は来るかもしれません。',
        parts: [
          { role: 'S', en: 'She', text: '彼女は' },
          { role: 'support', en: 'might', text: '〜するかもしれない' },
          { role: '述語', en: 'come', text: '来る' },
        ],
      }, {
        id: 'level2-03',
        heading: '真剣な顔 → 〜しなければならない（must）',
        picture: 'speaker',
        explanation: '女の子が真剣な顔で人さし指を立てています。「図書館では静かにしようね」と、守るべき決まりを伝えています。',
      }, {
        id: 'level2-04',
        heading: 'やさしい笑顔 → 〜したほうがいい（should）',
        picture: 'speaker',
        explanation: '男の子がやさしく笑って、相手に手のひらを差し出しています。「手を洗っておくといいよ」とすすめています。',
      }],
      note: '「よく」「ときどき」など、どれくらいするかは絵の印も見ましょう。助述部は英語で言う順に上から並べます。',
    },
    3: {
      summary: '疑問文を中心に、ことばを前に出す「倒置」の並びを学びます。',
      introduction: '疑問文は、まず疑問詞を先頭に置くと考えます。次に、最初の助述部（can や are など）を主語の前へ出します。一般動詞だけの文では、必要に応じて do・does・did を使います。',
      examples: [{
        heading: '何を？　疑問詞を先頭へ',
        explanation: '「何を買えるか」を聞くので、what を先頭に出し、その次に can を置きます。',
        startingOrder: 'I can buy [what]',
        en: 'What can I buy?',
        ja: '私は何を買えますか？',
        parts: [
          { role: '疑問詞＝P1', en: 'What', text: '何を' },
          { role: 'support', en: 'can', text: '〜できる' },
          { role: 'S', en: 'I', text: '私は' },
          { role: '述語', en: 'buy', text: '買う' },
        ],
      }, {
        heading: 'はい・いいえで聞くときは (whether)',
        explanation: '「あなたが生徒かどうか」を聞く文です。この教材では「〜かどうか」の目印として (whether) を先頭に置いて考えます。完成英文では書かず、発音もしません。声に出す最初の語は Are です。',
        startingOrder: 'You are a student.',
        en: 'Are you a student?',
        ja: 'あなたは生徒ですか？',
        parts: [
          { role: 'question-marker', en: '(whether)', text: '〜かどうか' },
          { role: 'support', en: 'Are', text: 'である' },
          { role: 'S', en: 'you', text: 'あなたは' },
          { role: '述語', en: 'a student', text: '生徒' },
        ],
      }, {
        heading: '「〜がいる・ある」と伝える There',
        explanation: 'A cat is there. は「あそこに猫がいる」と場所を指します。There is a cat. は「猫がいるよ」と、その存在を伝えます。この文でも is が a cat の前に来ます。',
        startingOrder: 'A cat is there.',
        en: 'There is a cat.',
        ja: '猫がいます。',
        parts: [
          { role: 'there', en: 'There', text: '〜がいる・ある' },
          { role: 'support', en: 'is', text: 'いる' },
          { role: 'いるもの', en: 'a cat', text: '猫' },
        ],
      }, {
        id: 'level3-04',
        heading: '誰が、どんなふうにたずねている？',
        picture: 'scene',
        explanation: '吹き出しの先の男の子が、女の子のほうを見て手を差し出しています。女の子に「乗れる？」とたずねているので、助述部の Can を主語の前に置きます。',
        practice: '驚いた顔で「乗れないの？」と聞く場面なら、Can’t を一つの助述部として主語の前に置きます。',
      }],
      questionWords: [
        ['what', '何を', 'What can I buy?', '私は何を買えますか？'],
        ['who', 'だれが', 'Who found it?', 'だれがそれを見つけましたか？'],
        ['when', 'いつ', 'When do you clean your room?', 'あなたはいつ自分の部屋をそうじしますか？'],
        ['where', 'どこで', 'Where do you play soccer?', 'あなたはどこでサッカーをしますか？'],
        ['why', 'なぜ', 'Why are you happy?', 'あなたはなぜうれしいのですか？'],
        ['which', 'どの', 'Which book do you want?', 'あなたはどの本がほしいですか？'],
        ['how', 'どうやって', 'How do you make a paper hat?', 'あなたは紙のぼうしをどうやって作りますか？'],
      ],
      note: '「だれが」と主語をたずねる Who found it? のような文では、Who が主語になり、そのあとに述語が続きます。',
    },
  };
  const compactChoices = window.matchMedia('(max-width: 720px)');
  function roleLabel(role) {
    const [prefix, target] = role.split('＝');
    return target ? `${prefix}（${labels[target] || target}）` : labels[role] || role;
  }
  function labelParts(parts) {
    const support = parts.filter(part => Construction.isSupportRole(part.role));
    return parts.map(part => {
      const index = support.indexOf(part);
      if (index < 0) return { ...part, label: roleLabel(part.role) };
      const number = support.length > 1 ? (index + 1).toLocaleString('ja-JP-u-nu-fullwide') : '';
      return { ...part, role: 'support', label: labels.support + number };
    });
  }
  function renderPartGroups(parts, renderPart) {
    const groups = [];
    for (const part of parts) {
      const previous = groups.at(-1);
      if (part.role === 'support' && previous?.[0].role === 'support') previous.push(part);
      else groups.push([part]);
    }
    return groups.map(group => group.length === 1 ? renderPart(group[0]) :
      `<div class="support-stack" role="group" aria-label="${labels.support}">${group.map(renderPart).join('')}</div>`
    ).join('');
  }
  function choicePrompt(label) { return compactChoices.matches ? label : `${label}を選んでね`; }
  let saved = null, savedVoice = '', speechSpeed = 'normal', storageOK = true;
  try { saved = JSON.parse(localStorage.getItem(KEY)); savedVoice = JSON.parse(localStorage.getItem(VOICE_KEY))?.voiceURI || ''; }
  catch (error) { if (error.name !== 'SyntaxError') storageOK = false; }
  const restored = Construction.restore(DATA, saved);
  const hasSavedLevels = saved?.version === 1 && Array.isArray(saved.levels);
  const state = {
    current: restored.current, completed: restored.completed, seenGuides: restored.seenGuides,
    levels: hasSavedLevels ? DATA.levels.map(level => level.id).filter(id => saved.levels.includes(id)) : [1],
    group: 'all', scope: hasSavedLevels ? restored.scope : 'all', search: '',
    mode: hasSavedLevels ? restored.mode : 'select',
  };
  const attempts = new Map();
  const selections = new Map();
  let selected = null, answerResult = null, speechRun = 0;
  let drag = null, suppressClickUntil = 0;
  let feedbackAudio, feedbackSoundEnd = 0;
  const hasBasicImages = DATA.examples.some(q => q.level === 1 && q.image);
  function openTensePictures() {
    const first = DATA.examples.find(q => q.group === 'tense-pictures');
    Object.assign(state, { levels: [1], group: first.group, scope: 'all', mode: 'select' });
    choose(first.id);
  }
  try {
    const savedSpeed = localStorage.getItem(SPEED_KEY);
    if (Object.hasOwn(speechRates, savedSpeed)) speechSpeed = savedSpeed;
  }
  catch { storageOK = false; }
  const hasSpeech = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const getQ = () => DATA.examples.find(q => q.id === state.current);
  function visibleExamples() {
    const pictureScope = state.scope === 'all' || state.scope === 'core';
    return Construction.visibleExamples(DATA, state).filter(q => q.level !== 1 || !hasBasicImages || !pictureScope || q.image);
  }
  const usingLists = () => state.mode === 'select';
  function picks() {
    if (!selections.has(state.current)) selections.set(state.current, {});
    return selections.get(state.current);
  }
  function attempt() {
    if (!attempts.has(state.current)) attempts.set(state.current, Construction.cardsFor(getQ()).map(() => ''));
    return attempts.get(state.current);
  }
  function enabledTargets() {
    return Construction.enabledTargets(getQ(), usingLists() ? Object.keys(picks()) : attempt());
  }
  function targetAllowed(target) { return target === '' || enabledTargets().includes(target); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ ...state, version: 1 })); }
    catch { storageOK = false; }
    $('storageStatus').textContent = storageOK ? '' : ' このブラウザーでは保存できません。開いている間は練習できます。';
  }
  function stopSpeech() { speechRun++; if (hasSpeech) speechSynthesis.cancel(); }
  function checkAnswer(q) {
    const wasCorrect = answerResult === true;
    answerResult = usingLists() ? Construction.choicesCorrect(q, picks()) : Construction.isCorrect(q, attempt());
    if (answerResult && !wasCorrect) {
      playSuccessSound();
      if (!state.completed.includes(q.id)) {
        state.completed.push(q.id);
        const lesson = $('lessons').querySelector('[data-lesson][aria-current="true"]');
        if (lesson) lesson.textContent = `✓ ${q.ja}`;
        save();
      }
    }
    renderResult(q);
  }
  async function playSuccessSound() {
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

      const frequencies = [523.25, 659.25];
      const start = now + 0.01;
      const noteSpacing = 0.115;
      const noteLength = 0.108;
      frequencies.forEach((frequency, index) => {
        const onset = start + index * noteSpacing;
        tone.frequency.setValueAtTime(frequency, onset);
        envelope.gain.setValueAtTime(0, onset);
        envelope.gain.linearRampToValueAtTime(0.10, onset + 0.016);
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
    stopSpeech(); state.current = id; selected = null; answerResult = null;
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
  function poolCardHTML(card, i) {
    return `<button class="card ${selected === i ? 'selected' : ''}" data-card="${i}" aria-pressed="${selected === i}" aria-label="${esc(card.text)}：移動するカードをえらぶ">${esc(card.text)}</button>`;
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
    $('sceneClue').textContent = q.imageClue || '';
    if (!q.image) {
      $('pictureScene').innerHTML = `<div class="scene-pending japanese">${esc(q.ja)}</div>`;
      return;
    }
    const time = q.slots?.time.en ?? q.blocks.find(([role]) => role === '時')?.[1];
    $('pictureScene').innerHTML = `
      <div class="scene-visual">
        <img class="scene-illustration" src="${esc(q.image)}" alt="${esc(q.imageAlt)}"${q.imageClue ? ' aria-describedby="sceneClue"' : ''} width="1536" height="1024">
        ${calendarFor(time)}
      </div>`;
  }
  function renderExercise(updateResult = true) {
    cancelDrag();
    const q = getQ(), basic = q.level === 1, cards = Construction.cardsFor(q), placements = attempt();
    const pictureMode = usingLists();
    $('sceneNavigation').classList.toggle('picture-mode', pictureMode);
    $('japanese').textContent = q.ja;
    $('japanese').parentElement.hidden = pictureMode;
    $('modeSwitcher').hidden = false;
    $('cardsMode').setAttribute('aria-pressed', !pictureMode);
    $('selectMode').setAttribute('aria-pressed', pictureMode);
    $('pictureScene').hidden = !pictureMode && !(q.image && q.group === 'tense-pictures');
    $('sceneClue').hidden = $('pictureScene').hidden || !q.imageClue;
    $('pool').hidden = pictureMode;
    const parameters = q.frame === 'object-location' ? ['P2', 'P1'] : ['P1', 'P2'];
    const japaneseOrder = ['S', 'time', 'place', ...parameters, 'predicate', 'support'];
    const order = basic ? japaneseOrder.map(role => cards.findIndex(card => card.role === role)).filter(i => i >= 0) : Construction.shuffledIndices(q);
    const remaining = order.filter(i => !placements[i]);
    $('pool').innerHTML = `<div class="pool-cards">${remaining.map(i => poolCardHTML(cards[i], i)).join('') || '<span class="muted">使わない欄は空欄のまま。</span>'}</div>`;
    const targets = labelParts(Construction.targetsFor(q).map((id, index) => ({
      id, role: Construction.targetRole(q, id), index
    })));
    if (pictureMode) {
      const values = picks();
      $('slots').innerHTML = renderPartGroups(targets, ({ id, role, label }) => `
        <select class="slot list-choice${values[id] ? '' : ' placeholder'}" id="choice-${esc(id)}"
          data-choice="${esc(id)}" data-role="${esc(role)}" data-label="${esc(label)}" aria-label="${esc(label)}を選ぶ" ${!targetAllowed(id) ? 'disabled' : ''}>
          <option value="__unanswered__" ${Object.hasOwn(values, id) ? '' : 'selected'}>${esc(choicePrompt(label))}</option>
          ${Construction.choicesFor(DATA, q, id).map(text => `<option value="${esc(text)}" ${values[id] === text ? 'selected' : ''}>${esc(text)}</option>`).join('')}
        </select>`);
    } else {
      $('slots').innerHTML = renderPartGroups(targets, ({ id: target, role, label, index }) => {
        const i = placements.indexOf(target);
        const slotName = basic || role === 'support' ? label : `${index + 1}. ${label}`;
        const contents = cards[i]?.text;
        const accessibleLabel = contents ? `${slotName}：${contents}` : `${slotName}に置く`;
        const cardState = contents ? ` data-card="${i}" aria-pressed="${selected === i}"` : '';
        return `<button type="button" class="slot card-slot${contents ? ' card' : ''}${selected === i ? ' selected' : ''}"
          data-drop="${esc(target)}" data-target="${esc(target)}" data-role="${esc(role)}"${cardState}
          ${targetAllowed(target) ? '' : 'disabled'} aria-label="${esc(accessibleLabel)}">${esc(contents || slotName)}</button>`;
      });
    }
    if (!$('pictureScene').hidden) renderPicture(q);
    if (updateResult) renderResult(q);
    else renderSlotFeedback(q);
  }
  function renderSlotFeedback(q) {
    let wrong = [];
    if (answerResult === false) {
      if (usingLists()) {
        const choices = picks();
        wrong = Construction.targetsFor(q).filter(target => !Construction.choiceMatches(q, choices, target));
      } else {
        wrong = Construction.wrongCardTargets(q, attempt());
      }
    }
    for (const slot of $('slots').querySelectorAll('.slot')) {
      const invalid = wrong.includes(slot.dataset.choice ?? slot.dataset.target);
      slot.classList.toggle('wrong', invalid);
      if (invalid) slot.setAttribute('aria-invalid', 'true');
      else slot.removeAttribute('aria-invalid');
    }
  }
  function renderResult(q) {
    renderSlotFeedback(q);
    $('feedback').innerHTML = answerResult === false ? '<div class="feedback">もう少し。点線の欄を見直してみよう。</div>' : '';
    const parts = labelParts(Construction.cardsFor(q).map(({ role, en, text }, index) => ({
      role, en, text, index
    })));
    $('result').innerHTML = answerResult ? `
      <div class="result">
        <p class="full-english" lang="en">${esc(q.en)}</p>
        ${q.base ? `<p class="muted">もとの文 <span lang="en">${esc(q.base)}</span></p>` : ''}
        ${q.note ? `<p>${esc(q.note)}</p>` : ''}
        <div class="actions speech-controls" role="group" aria-label="英文の読み上げ">
          <select id="voice" aria-label="読み上げる声"></select>
          <div class="speech-buttons">
            <button id="speakNormal" data-speed="normal" ${hasSpeech ? '' : 'disabled'}>普通に話す</button>
            <button id="speakSlow" data-speed="slow" ${hasSpeech ? '' : 'disabled'}>ゆっくり読む</button>
          </div>
        </div>
        <div class="spoken">${renderPartGroups(parts, ({ role, en, text, index, label }) => {
          const content = `
            <span class="answer-label">${esc(label)}</span>
            <span class="answer-ja">${esc(text)}</span>`;
          return en
            ? `<button type="button" class="answer-part" data-role="${esc(role)}" data-speak-part="${index}" aria-label="${esc(label)}「${esc(en)}」を聞く" ${hasSpeech ? '' : 'disabled'}>${content}<span lang="en">${esc(en)}</span></button>`
            : `<div class="answer-part" data-role="${esc(role)}">${content}</div>`;
        })}</div>
        <p class="muted" id="speechStatus" role="status">${hasSpeech ? '' : 'このブラウザーでは音声を使えません。'}</p>
      </div>` : '';
    if (answerResult) populateVoices();
  }
  function render() {
    const visible = visibleExamples();
    synchronizeFilters();
    renderNav(visible);
    $('emptyPractice').hidden = Boolean(visible.length);
    $('exercise').hidden = !visible.length;
    $('reset').hidden = !visible.length;
    $('openGuide').hidden = !visible.length;
    if (visible.length) {
      renderExercise();
      maybeOpenLevelGuide();
    }
    else $('modeSwitcher').hidden = true;
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
  $('levelChoices').innerHTML = DATA.levels.map(level => `
    <label>
      <input type="checkbox" value="${level.id}" aria-labelledby="levelName-${level.id}" aria-describedby="levelSummary-${level.id}">
      <span>
        <strong class="level-choice-name" id="levelName-${level.id}">${esc(level.label)}</strong>
        <span class="level-choice-summary" id="levelSummary-${level.id}">${esc(levelGuides[level.id].summary)}</span>
      </span>
    </label>`).join('');
  $('levels').addEventListener('change', changeFilters);
  $('scope').addEventListener('change', changeFilters);
  const lessonDrawer = $('lessonDrawer');
  const levelGuide = $('levelGuide');
  let guideLevel = null, guideForFirstVisit = false;
  function maybeOpenLevelGuide() {
    if (lessonDrawer.open || $('exercise').hidden) return;
    const level = getQ().level;
    if (levelGuide.open && guideLevel !== level) levelGuide.close();
    if (!levelGuide.open && !state.seenGuides.includes(level)) openLevelGuide(true);
  }
  function openLevelGuide(firstVisit) {
    const level = DATA.levels.find(level => level.id === getQ().level);
    const guide = levelGuides[level.id];
    guideLevel = level.id;
    guideForFirstVisit = firstVisit;
    $('guideTitle').textContent = level.label;
    $('guideSummary').textContent = guide.summary;
    $('guideIntroduction').textContent = guide.introduction ?? '';
    $('guideIntroduction').hidden = !guide.introduction;
    $('guideNote').textContent = guide.note;
    $('guideQuestionWords').hidden = !guide.questionWords;
    $('guideQuestionExamples').innerHTML = (guide.questionWords ?? []).map(([word, meaning, en, ja]) => `
      <div>
        <dt><strong lang="en">${esc(word)}</strong> <span class="muted">${esc(meaning)}</span></dt>
        <dd><span class="guide-sentence" lang="en">${esc(en)}</span><span class="muted">${esc(ja)}</span></dd>
      </div>`).join('');
    $('guideExamples').innerHTML = guide.examples.map(example => {
      const q = example.id ? DATA.examples.find(q => q.id === example.id) : example;
      const parts = labelParts(q.parts ?? Construction.cardsFor(q));
      const pictureClass = { speaker: ' guide-illustration-speaker', pose: ' guide-illustration-pose' }[example.picture] ?? '';
      return `<figure class="guide-example">
        <figcaption>
          ${example.heading ? `<h3>${esc(example.heading)}</h3>` : ''}
          ${example.picture && q.image ? `
            <div class="guide-illustration${pictureClass}">
              <img src="${esc(q.image)}" alt="${esc(q.imageAlt)}" ${example.picture === 'pose' ? 'width="1254" height="1254"' : 'width="860" height="644"'}>
            </div>` : ''}
          ${example.explanation ? `<p class="guide-explanation">${esc(example.explanation)}</p>` : ''}
          ${example.startingOrder ? `<span class="guide-starting-order">語順の比較 <span lang="en">${esc(example.startingOrder)}</span></span>` : ''}
          <span class="guide-sentence" lang="en">${esc(q.en)}</span><span class="muted">${esc(q.ja)}</span>
        </figcaption>
        <div class="guide-parts">${renderPartGroups(parts, ({ role, label, en, text }) => `
          <div class="answer-part guide-part" data-role="${esc(role)}">
            <span class="answer-label">${esc(label)}</span>
            <span class="answer-ja">${esc(text)}</span>
            ${en ? `<span lang="en">${esc(en)}</span>` : ''}
          </div>`)}</div>
        ${example.practice ? `<p class="guide-practice">${esc(example.practice)}</p>` : ''}
      </figure>`;
    }).join('');
    $('guideContinue').textContent = firstVisit ? 'はじめる' : '練習にもどる';
    levelGuide.setAttribute('closedby', firstVisit ? 'none' : 'closerequest');
    stopSpeech();
    if (!levelGuide.open) levelGuide.showModal();
    $('guideContent').scrollTop = 0;
    $('openGuide').setAttribute('aria-expanded', 'true');
  }
  $('openGuide').addEventListener('click', () => openLevelGuide(false));
  levelGuide.addEventListener('submit', () => {
    if (guideForFirstVisit && !state.seenGuides.includes(guideLevel)) {
      state.seenGuides.push(guideLevel);
      save();
    }
  });
  levelGuide.addEventListener('cancel', event => {
    if (guideForFirstVisit) event.preventDefault();
  });
  levelGuide.addEventListener('keydown', event => {
    if (guideForFirstVisit && event.key === 'Escape') event.preventDefault();
  });
  levelGuide.addEventListener('close', () => {
    if (levelGuide.open) return;
    $('openGuide').setAttribute('aria-expanded', 'false');
    const target = guideForFirstVisit ? $('slots').querySelector('.slot:enabled') : $('openGuide');
    target?.focus({ preventScroll: true });
  });
  $('openMenu').addEventListener('click', event => {
    if (event.detail > 0) event.currentTarget.blur();
    lessonDrawer.showModal();
    $('openMenu').setAttribute('aria-expanded', 'true');
    $('lessons').querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  });
  $('closeMenu').addEventListener('click', () => lessonDrawer.close());
  lessonDrawer.addEventListener('close', () => {
    if (lessonDrawer.open) return;
    $('openMenu').setAttribute('aria-expanded', 'false');
    maybeOpenLevelGuide();
  });
  lessonDrawer.addEventListener('click', event => {
    if (event.target !== lessonDrawer) return;
    const bounds = lessonDrawer.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) lessonDrawer.close();
  });
  compactChoices.addEventListener('change', () => {
    for (const select of $('slots').querySelectorAll('[data-choice]')) {
      select.options[0].textContent = choicePrompt(select.dataset.label);
    }
  });
  $('slots').addEventListener('change', event => {
    const choice = event.target;
    const role = choice.dataset.choice;
    const q = getQ();
    if (!usingLists() || !Construction.targetsFor(q).includes(role) || !targetAllowed(role)) return;
    stopSpeech();
    const values = picks();
    if (choice.value === '__unanswered__') delete values[role];
    else values[role] = choice.value;

    // Keep the native selects in place so Safari can finish dismissing its picker.
    const enabled = enabledTargets();
    for (const select of $('slots').querySelectorAll('[data-choice]')) {
      select.disabled = !enabled.includes(select.dataset.choice);
      select.classList.toggle('placeholder', !values[select.dataset.choice]);
    }
    if (answerResult !== null) {
      answerResult = null;
      renderResult(q);
    }
  });
  function moveCard(index, target, focusSelector = `[data-card="${index}"]`) {
    if (!targetAllowed(target)) return;
    stopSpeech();
    const q = getQ();
    attempts.set(state.current, Construction.place(q, attempt(), index, target));
    selected = null;
    answerResult = null;
    renderExercise();
    document.querySelector(focusSelector)?.focus({ preventScroll: true });
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
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.hasAttribute('data-card') && event.detail !== 0 && Date.now() < suppressClickUntil) {
      event.preventDefault(); return;
    }
    if (button.hasAttribute('data-speak-part')) { speak(Construction.cardsFor(getQ())[Number(button.dataset.speakPart)]?.en); return; }
    if (button.dataset.lesson) { lessonDrawer.close(); choose(button.dataset.lesson); return; }
    const i = Number(button.dataset.card);
    if (button.hasAttribute('data-target') && selected !== null && i !== selected) {
      moveCard(selected, button.dataset.target, `[data-target="${button.dataset.target}"]`);
      return;
    }
    if (button.hasAttribute('data-card')) {
      if (selected === i) { moveCard(i, ''); return; }
      selected = i;
      renderExercise(false);
      document.querySelector(`[data-card="${i}"]`)?.focus({ preventScroll: true }); return;
    }
    switch (button.id) {
      case 'cardsMode': case 'selectMode':
        stopSpeech(); state.mode = button.id === 'selectMode' ? 'select' : 'cards';
        selected = null; answerResult = null; save(); renderExercise(); break;
      case 'check': checkAnswer(getQ()); break;
      case 'reset': stopSpeech(); if (usingLists()) selections.delete(state.current); else attempts.delete(state.current); selected = null; answerResult = null; renderExercise(); break;
      case 'previous': case 'next': {
        const visible = visibleExamples(), i = Construction.navigationIndex(visible, getQ());
        const next = visible[i + (button.id === 'next' ? 1 : -1)]; if (next) choose(next.id); break;
      }
      case 'speakNormal': case 'speakSlow': {
        speechSpeed = button.dataset.speed;
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
    if (!answerResult || !hasSpeech || !text) return;
    stopSpeech(); const run = speechRun, voice = preferredVoice(englishVoices());
    const utterance = new SpeechSynthesisUtterance(text); // Never derive speech from the internal question marker.
    if (voice) utterance.voice = voice;
    utterance.lang = 'en-US'; utterance.rate = speechRates[speechSpeed];
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
