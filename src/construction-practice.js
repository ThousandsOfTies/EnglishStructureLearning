/* Shared exercise rules are also used by the Node tests. */
'use strict';
const Construction = (() => {
  const roles = ['S', 'support', 'predicate', 'P1', 'P2', 'place', 'time'];
  const level2OptionalRoles = ['P1', 'P2', '場所', '時'];
  const openingRoles = new Set(['S', '疑問詞＝S', 'there']);
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
    if (q.level !== 2) return targets;
    const core = targets.filter(id => !level2OptionalRoles.includes(targetRole(q, id)));
    const optional = level2OptionalRoles.map(role => targets.find(id => targetRole(q, id) === role) ?? role);
    return [...core, ...optional];
  }
  function targetRole(q, id) {
    return q.level === 1 || (q.level === 2 && level2OptionalRoles.includes(id)) ? id : q.blocks[Number(id)][0];
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
  const questionChoices = {
    what: '何を', who: 'だれが', where: 'どこで', when: 'いつ',
    why: 'なぜ', which: 'どれを', how: 'どうやって'
  };
  function choicesFor(data, q, role) {
    if (q.level === 3) {
      const token = q.question?.token;
      const [category, , correct] = q.blocks[Number(role)];
      if (Object.hasOwn(questionChoices, token) && category.startsWith('疑問詞＝')) {
        return rotateChoices(Object.values({ ...questionChoices, [token]: correct }), q.id + role);
      }
      return shuffledIndices(q)
        .filter(index => !q.blocks[index][0].startsWith('疑問詞＝'))
        .map(index => q.blocks[index][2]);
    }
    if (q.level === 2) {
      if (level2OptionalRoles.includes(role)) {
        return rotateChoices(Object.values(data.level2Choices[role]), q.id + role);
      }
      const [category, english, correct] = q.blocks[Number(role)];
      const alternatives = [...new Set(Object.entries(data.level2Choices[category])
        .filter(([en, ja]) => en !== english && ja !== correct).map(([, ja]) => ja))];
      const limit = category === '助動詞' ? 4 : 3;
      return rotateChoices([correct, ...alternatives.slice(0, limit)], q.id + role);
    }
    if (role === 'support') return ['する', 'した', 'である', 'であった'];
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
    if (q.level === 2 && level2OptionalRoles.includes(role)) return !choices[role];
    if (q.level !== 1) return choices[role] === q.blocks[Number(role)][2];
    if (['support', 'P1', 'P2', 'place', 'time'].includes(role) && !q.slots[role].ja) return !choices[role];
    return Object.hasOwn(choices, role) && choices[role] === q.slots[role].ja;
  }
  function enabledTargets(q, filled) {
    const targets = targetsFor(q);
    const opening = targets.filter(id => openingRoles.has(targetRole(q, id)));
    if (opening.some(id => !filled.includes(id))) return opening;
    if (q.level === 2) {
      const support = targets.filter(id => isSupportRole(targetRole(q, id)));
      const firstEmpty = support.findIndex(id => !filled.includes(id));
      if (support.length > 1 && firstEmpty >= 0) {
        return [...opening, ...support.slice(0, firstEmpty + 1)];
      }
    }
    const predicates = targets.filter(id => {
      const role = targetRole(q, id);
      return predicateRoles.has(role) || (q.level === 2 && role === '頻度');
    });
    const missingPredicate = predicates.some(id => !filled.includes(id) && (q.level !== 1 || q.slots[id].ja));
    return missingPredicate ? [...opening, ...predicates] : targets;
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
  function sceneExamples(visible, theme) {
    return theme === 'all' ? visible : visible.filter(q => q.theme === theme);
  }
  function practiceSets(lessons) {
    const count = Math.ceil(lessons.length / 10);
    return Array.from({ length: count }, (_, index) =>
      lessons.slice(Math.ceil(index * lessons.length / count), Math.ceil((index + 1) * lessons.length / count)));
  }
  function englishReview(q) {
    return {
      id: q.id + '-english', level: 3,
      blocks: cardsFor(q).filter(card => card.en).map(card => [card.role, card.en, card.en])
    };
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
  return { roles, cardsFor, targetsFor, targetRole, isSupportRole, expectedTarget, wrongCardTargets, isCorrect, choicesFor, choicesCorrect, choiceMatches, enabledTargets, place, visibleExamples, sceneExamples, practiceSets, englishReview, restore, shuffledIndices, navigationIndex };
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
      summary: '英語の文には、大きく分けて、働きかけを表す文と、状態を表す文があります。',
      examples: [{
        id: 'tense-bicycle',
        heading: '働きかけを表す文',
        explanation: '「何をするか」を伝える文です。述語には「乗る（ride）」のような一般動詞を使います。',
        practice: 'ふだんは「する」＋「乗る」で “I ride a bike.” 過去は「した」＋「乗る」で “I rode a bike.” 英語では ride が rode に変わります。',
      }, {
        id: 'build-be-noun-1',
        heading: '状態を表す文',
        explanation: '「何者か」や「どんなようすか」を伝えるときに、am・is・are などの be 動詞を使います。',
        practice: '今は「である」＋「生徒」で “I am a student.” 過去は「であった」＋「生徒」で “I was a student.” 英語では am が was に変わります。',
      }],
      note: '「今、食べている」のような文でも、助述部は「である」です。述語には「食べている」を入れます。まずは、この２つの形を練習していきましょう。',
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
      note: '「よく」「いつも」「ときどき」などは「助述部修飾」です。助述部１の下に欄があるときは、１、修飾、２の順にえらびます。状態を表す be は、レベル1と同じ「である」です。',
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
        id: 'level3-18',
        heading: '「〜がいる・ある」と伝える There',
        explanation: 'A cat is there. は「あそこに猫がいる」と場所を指します。There is a cat. は「猫がいるよ」と、その存在を伝えます。この文でも is が a cat の前に来ます。',
        startingOrder: 'A cat is there.',
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
    const support = parts.filter(part => part.role !== '頻度' && Construction.isSupportRole(part.role));
    return parts.map(part => {
      if (part.role === '頻度') return { ...part, role: 'support', label: '助述部修飾', modifier: true };
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
    return groups.map(group => {
      if (group.length === 1) return renderPart(group[0]);
      const columns = Math.max(1, group.filter(part => !part.modifier).length);
      const cells = group.map(part => part.modifier
        ? `<div class="support-modifier">${renderPart(part)}</div>`
        : renderPart(part)).join('');
      return `<div class="support-group" style="--support-columns:${columns}" role="group" aria-label="${labels.support}">${cells}</div>`;
    }).join('');
  }
  function choicePrompt(label) { return compactChoices.matches ? label : `${label}を選んでね`; }
  let saved = null, savedVoice = '', speechSpeed = 'normal', storageOK = true;
  try { saved = JSON.parse(localStorage.getItem(KEY)); savedVoice = JSON.parse(localStorage.getItem(VOICE_KEY))?.voiceURI || ''; }
  catch (error) { if (error.name !== 'SyntaxError') storageOK = false; }
  const restored = Construction.restore(DATA, saved);
  const hasSavedLevels = saved?.version === 1 && Array.isArray(saved.levels);
  const sceneThemes = [{ id: 'all', label: 'すべての場面' }, ...DATA.themes];
  const state = {
    current: restored.current, completed: restored.completed, seenGuides: restored.seenGuides,
    levels: hasSavedLevels ? DATA.levels.map(level => level.id).filter(id => saved.levels.includes(id)) : [1],
    group: 'all', scope: hasSavedLevels ? restored.scope : 'all', search: '',
    mode: hasSavedLevels ? restored.mode : 'select',
    courseView: saved?.version === 1 && saved.courseView === 'all' ? 'all' : 'mini',
    sceneTheme: saved?.version === 1 && sceneThemes.some(theme => theme.id === saved.sceneTheme)
      ? saved.sceneTheme : DATA.examples.find(q => q.id === restored.current).theme,
    autoSpeak: saved?.version === 1 && saved.autoSpeak === true,
    hideJapanese: saved?.version === 1 && saved.hideJapanese === true,
  };
  const attempts = new Map();
  const selections = new Map();
  let selected = null, answerResult = null, speechRun = 0, review = null;
  let speechStatus = '';
  let drag = null, suppressClickUntil = 0;
  let feedbackAudio, feedbackSoundEnd = 0;
  const hasBasicImages = DATA.examples.some(q => q.level === 1 && q.image);
  function openTensePictures() {
    const first = DATA.examples.find(q => q.group === 'tense-pictures');
    Object.assign(state, { levels: [1], group: first.group, scope: 'all', mode: 'select', courseView: 'all', sceneTheme: 'all' });
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
  const usingLists = () => !review && state.mode === 'select';
  const cardExercise = () => review || getQ();
  function picks() {
    if (!selections.has(state.current)) selections.set(state.current, {});
    return selections.get(state.current);
  }
  function attempt() {
    const q = cardExercise();
    if (!attempts.has(q.id)) attempts.set(q.id, []);
    return attempts.get(q.id);
  }
  function enabledTargets() {
    return Construction.enabledTargets(getQ(), usingLists() ? Object.keys(picks()) : attempt());
  }
  function targetAllowed(target) { return Boolean(review) || target === '' || enabledTargets().includes(target); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ ...state, version: 1 })); }
    catch { storageOK = false; }
    $('storageStatus').textContent = storageOK ? '' : ' このブラウザーでは保存できません。開いている間は練習できます。';
  }
  function setAutoSpeak(checked) {
    state.autoSpeak = checked;
    $('autoSpeak').checked = checked;
    const resultOption = $('resultAutoSpeak');
    if (resultOption) resultOption.checked = checked;
    save();
  }
  function setSpeechStatus(text) {
    speechStatus = text;
    const status = $('speechStatus');
    if (status) status.textContent = text;
  }
  function stopSpeech() {
    speechRun++;
    if (hasSpeech) {
      setSpeechStatus('');
      speechSynthesis.cancel();
    }
  }
  function checkAnswer(q) {
    const wasCorrect = answerResult === true;
    answerResult = usingLists() ? Construction.choicesCorrect(q, picks()) : Construction.isCorrect(cardExercise(), attempt());
    if (answerResult && !wasCorrect) {
      if (!state.completed.includes(q.id)) {
        state.completed.push(q.id);
        const lesson = $('lessons').querySelector('[data-lesson][aria-current="true"]');
        if (lesson) lesson.textContent = `✓ ${q.ja}`;
        renderCourse();
        save();
      }
    }
    renderResult(q);
    if (answerResult && !wasCorrect) {
      if (state.autoSpeak && hasSpeech) speak(q.en);
      else playSuccessSound();
      $('result').scrollIntoView({ block: 'nearest' });
    }
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
    stopSpeech(); state.current = id; review = null; selected = null; answerResult = null;
    save(); render();
    $('practicePane').scrollTop = 0;
  }
  function synchronizeFilters() {
    for (const checkbox of $('levelChoices').querySelectorAll('input')) checkbox.checked = state.levels.includes(Number(checkbox.value));
    $('scope').value = state.scope;
    $('scopeField').hidden = !state.levels.includes(1);
  }
  function miniCourse(visible = visibleExamples()) {
    const matching = Construction.sceneExamples(visible, state.sceneTheme);
    const sets = Construction.practiceSets(matching);
    const setIndex = Math.max(0, sets.findIndex(set => set.some(q => q.id === state.current)));
    return { matching, sets, setIndex, lessons: sets[setIndex] || [] };
  }
  function completionCount(lessons) {
    return lessons.filter(q => state.completed.includes(q.id)).length;
  }
  function firstUnfinished(lessons) {
    return lessons.find(q => !state.completed.includes(q.id));
  }
  function startAtUnfinished(lessons) {
    const q = firstUnfinished(lessons) || lessons[0];
    if (q) choose(q.id);
  }
  function renderCourse(visible = visibleExamples()) {
    const mini = state.courseView === 'mini';
    $('miniView').setAttribute('aria-pressed', mini);
    $('miniViewState').textContent = mini ? 'ON' : 'OFF';
    $('courseFilters').disabled = !mini;
    const { matching, sets, setIndex, lessons } = miniCourse(visible);
    $('courseTheme').replaceChildren(...sceneThemes.map(theme => {
      const items = Construction.sceneExamples(visible, theme.id);
      return new Option(items.length ? `${theme.label}（${completionCount(items)}/${items.length}問）` : `${theme.label}（0問）`, theme.id);
    }));
    $('courseTheme').value = state.sceneTheme;
    const hasMatches = matching.length > 0;
    $('courseSet').disabled = !hasMatches;
    $('courseStatus').setAttribute('aria-hidden', !mini || !hasMatches);
    const total = completionCount(matching);
    $('themeProgress').max = Math.max(1, matching.length);
    $('themeProgress').value = total;
    $('themeProgress').textContent = `${total} / ${matching.length}問`;
    $('themeProgress').setAttribute('aria-valuetext', `${matching.length}問中${total}問クリア`);
    const options = sets.map((set, i) => new Option(`セット ${i + 1}（${completionCount(set)}/${set.length}問）`, i));
    $('courseSet').replaceChildren(...(hasMatches ? options : [new Option('該当するセットなし')]));
    if (hasMatches) $('courseSet').value = setIndex;
    if (!mini || !hasMatches) return;
    const done = completionCount(lessons);
    const number = lessons.findIndex(q => q.id === state.current) + 1;
    const theme = sceneThemes.find(item => item.id === state.sceneTheme);
    $('courseName').textContent = `${theme.label} · セット ${setIndex + 1}`;
    $('coursePosition').textContent = done === lessons.length
      ? `セットクリア！ ${done}/${lessons.length}問`
      : `${number}問目 · ${done}/${lessons.length}問クリア`;
    $('setProgress').max = lessons.length;
    $('setProgress').value = done;
    $('setProgress').textContent = `${done} / ${lessons.length}問`;
    $('setProgress').setAttribute('aria-valuetext', `${lessons.length}問中${done}問クリア`);
  }
  function navigationLessons(visible = visibleExamples()) {
    return state.courseView === 'mini' ? miniCourse(visible).lessons : visible;
  }
  function eligibleExamples() {
    return state.courseView === 'mini'
      ? Construction.sceneExamples(visibleExamples(), state.sceneTheme) : visibleExamples();
  }
  function nextAfterAnswer() {
    const lessons = navigationLessons();
    const currentIndex = Construction.navigationIndex(lessons, getQ());
    const next = currentIndex < 0 ? null : lessons[currentIndex + 1];
    if (next) return { id: next.id, label: '次の場面へ →' };
    if (state.courseView !== 'mini') return null;
    const unfinished = firstUnfinished(lessons);
    if (unfinished) return { id: unfinished.id, label: 'セットの残りの問題へ →' };
    const { sets, setIndex } = miniCourse();
    const nextSet = sets[setIndex + 1];
    if (nextSet) return { id: (firstUnfinished(nextSet) || nextSet[0]).id, label: '次のセットへ →' };
    return { label: 'ミニセットをえらぶ' };
  }
  function renderNav(visible) {
    renderCourse(visible);
    visible = navigationLessons(visible);
    $('artworkProgress').textContent = `絵のある例文 ${Object.keys(ILLUSTRATIONS).length} / ${DATA.examples.length}文`;
    $('filterCount').textContent = `${visible.length}文を表示`;
    const emptyMessage = state.levels.length ? 'この組み合わせの問題はありません。ほかの場面かレベルをえらんでね。' : 'レベルをえらぶと、例文が表示されます。';
    $('lessons').innerHTML = visible.length ? visible.map(q => `<button data-lesson="${esc(q.id)}" aria-current="${state.current === q.id}">${state.completed.includes(q.id) ? '✓ ' : ''}${esc(q.ja)}</button>`).join('') : `<p class="muted">${emptyMessage}</p>`;
    const index = Construction.navigationIndex(visible, getQ());
    $('previous').disabled = index <= 0; $('next').disabled = index < 0 || index >= visible.length - 1;
  }
  function poolCardHTML(card, i) {
    return `<button class="card ${selected === i ? 'selected' : ''}" data-card="${i}" aria-pressed="${selected === i}" ${review ? 'lang="en"' : ''}>${esc(card.text)}</button>`;
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
    const q = getQ(), active = cardExercise(), basic = active.level === 1;
    const cards = Construction.cardsFor(active), placements = attempt();
    const pictureMode = usingLists();
    $('sceneNavigation').classList.toggle('picture-mode', pictureMode);
    $('japanese').textContent = q.ja;
    $('japanese').parentElement.hidden = pictureMode;
    $('modeSwitcher').hidden = false;
    $('cardsMode').setAttribute('aria-pressed', !pictureMode && !review);
    $('selectMode').setAttribute('aria-pressed', pictureMode);
    $('reviewMode').hidden = !review;
    $('pictureScene').hidden = !pictureMode && !(q.image && q.group === 'tense-pictures');
    $('sceneClue').hidden = $('pictureScene').hidden || !q.imageClue;
    $('pool').hidden = pictureMode;
    const parameters = q.frame === 'object-location' ? ['P2', 'P1'] : ['P1', 'P2'];
    const japaneseOrder = ['S', 'time', 'place', ...parameters, 'predicate', 'support'];
    const order = basic ? japaneseOrder.map(role => cards.findIndex(card => card.role === role)).filter(i => i >= 0) : Construction.shuffledIndices(active);
    const remaining = order.filter(i => !placements[i]);
    const emptyPool = review ? 'すべてのカードを置きました。' : '使わない欄は空欄のまま。';
    $('pool').innerHTML = `<div class="pool-cards">${remaining.map(i => poolCardHTML(cards[i], i)).join('') || `<span class="muted">${emptyPool}</span>`}</div>`;
    const targets = labelParts(Construction.targetsFor(active).map((id, index) => ({
      id, role: Construction.targetRole(active, id), index
    })));
    if (pictureMode) {
      const values = picks();
      $('slots').innerHTML = renderPartGroups(targets, ({ id, role, label }) => {
        const prompt = role.startsWith('疑問詞＝') ? '疑問詞' : label;
        return `
        <select class="slot list-choice${values[id] ? '' : ' placeholder'}" id="choice-${esc(id)}"
          data-choice="${esc(id)}" data-role="${esc(role)}" data-label="${esc(prompt)}" aria-label="${esc(prompt)}を選ぶ" ${!targetAllowed(id) ? 'disabled' : ''}>
          <option value="__unanswered__" ${Object.hasOwn(values, id) ? '' : 'selected'}>${esc(choicePrompt(prompt))}</option>
          ${Construction.choicesFor(DATA, q, id).map(text => `<option value="${esc(text)}" ${values[id] === text ? 'selected' : ''}>${esc(text)}</option>`).join('')}
        </select>`;
      });
    } else {
      $('slots').innerHTML = renderPartGroups(targets, ({ id: target, role, label, index }) => {
        const i = placements.indexOf(target);
        const slotName = review ? String(index + 1) : basic || role === 'support' ? label : `${index + 1}. ${label}`;
        const contents = cards[i]?.text;
        const accessibleLabel = contents ? `${slotName}：${contents}` : `${slotName}に置く`;
        const cardState = contents ? ` data-card="${i}" aria-pressed="${selected === i}"` : '';
        return `<button type="button" class="slot card-slot${contents ? ' card' : ''}${selected === i ? ' selected' : ''}"
          data-drop="${esc(target)}" data-target="${esc(target)}" data-role="${esc(role)}"${cardState}
          ${targetAllowed(target) ? '' : 'disabled'} ${review && contents ? 'lang="en"' : ''} aria-label="${esc(accessibleLabel)}">${esc(contents || slotName)}</button>`;
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
        wrong = Construction.wrongCardTargets(cardExercise(), attempt());
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
    if (!answerResult) {
      $('result').replaceChildren();
      return;
    }
    const parts = labelParts(Construction.cardsFor(q).map((card, index) => ({ ...card, index })));
    const next = nextAfterAnswer();
    $('result').innerHTML = `
      <div class="result${state.hideJapanese ? ' hide-japanese' : ''}">
        <p class="full-english" lang="en">${esc(q.en)}</p>
        ${q.base ? `<p class="muted"><span class="result-explanation">もとの文 </span><span lang="en">${esc(q.base)}</span></p>` : ''}
        ${q.note ? `<p class="result-explanation">${esc(q.note)}</p>` : ''}
        <div class="actions speech-controls" role="group" aria-label="英文の読み上げ">
          <select id="voice" aria-label="読み上げる声"></select>
          <div class="speech-buttons">
            <button id="speakNormal" data-speed="normal" ${hasSpeech ? '' : 'disabled'}>普通に読む</button>
            <button id="speakSlow" data-speed="slow" ${hasSpeech ? '' : 'disabled'}>ゆっくり読む</button>
            <span class="speech-status" id="speechStatus" role="status">${hasSpeech ? esc(speechStatus) : '音声非対応'}</span>
          </div>
        </div>
        <div class="spoken" role="group" aria-label="英文の対訳カード">${parts.map(({ role, en, text, index, label }) => {
          const content = `
            <span class="answer-label">${esc(label)}</span>
            <span class="answer-ja">${esc(text)}</span>`;
          return en
            ? `<button type="button" class="answer-part" data-role="${esc(role)}" data-speak-part="${index}" ${hasSpeech ? '' : 'disabled'}>${content}<span lang="en">${esc(en)}</span></button>`
            : `<div class="answer-part japanese-only" data-role="${esc(role)}">${content}</div>`;
        }).join('')}</div>
        <div class="result-actions">
          ${hasSpeech ? `<label class="check-option"><input id="resultAutoSpeak" type="checkbox" ${state.autoSpeak ? 'checked' : ''}> 正解時に自動で読む</label>` : ''}
          <label class="check-option"><input id="hideJapanese" type="checkbox" ${state.hideJapanese ? 'checked' : ''}> 対訳をかくす</label>
          ${review ? '' : '<button type="button" id="startReview">英語カードで復習</button>'}
          ${next ? `<button type="button" id="resultNext" class="result-next"${next.id ? ` data-next-lesson="${esc(next.id)}"` : ''}>${esc(next.label)}</button>` : ''}
        </div>
      </div>`;
    populateVoices();
  }
  function render() {
    const visible = visibleExamples();
    synchronizeFilters();
    renderNav(visible);
    const available = navigationLessons(visible).length > 0;
    $('emptyPractice').hidden = available;
    $('emptyPractice').textContent = state.levels.length && state.courseView === 'mini'
      ? 'この組み合わせの問題はありません。左上のメニューから、場面かレベルをえらんでね。'
      : '左上のメニューから、練習する例文をえらんでね。';
    $('exercise').hidden = !available;
    $('reset').hidden = !available;
    $('openGuide').hidden = !available;
    if (available) {
      renderExercise();
      maybeOpenLevelGuide();
    }
    else $('modeSwitcher').hidden = true;
  }
  function applyFilters() {
    const visible = eligibleExamples();
    if (visible.length && !visible.some(q => q.id === state.current)) startAtUnfinished(visible);
    else {
      if (!visible.length) stopSpeech();
      save(); render();
    }
  }
  function changeFilters() {
    state.levels = [...$('levelChoices').querySelectorAll('input:checked')].map(input => Number(input.value));
    state.scope = $('scope').value;
    state.group = 'all';
    applyFilters();
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
  $('courseTheme').addEventListener('change', event => {
    state.sceneTheme = event.target.value;
    applyFilters();
  });
  $('courseSet').addEventListener('change', event => {
    const set = miniCourse().sets[Number(event.target.value)];
    if (set) startAtUnfinished(set);
  });
  $('autoSpeak').checked = state.autoSpeak;
  $('autoSpeak').disabled = !hasSpeech;
  $('autoSpeak').addEventListener('change', event => setAutoSpeak(event.target.checked));
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
  let menuOpenedByPointer = false;
  $('openMenu').addEventListener('click', event => {
    menuOpenedByPointer = Boolean(event.pointerType) || event.detail > 0;
    if (menuOpenedByPointer) event.currentTarget.blur();
    lessonDrawer.showModal();
    $('openMenu').setAttribute('aria-expanded', 'true');
    $('lessons').querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  });
  $('closeMenu').addEventListener('click', () => lessonDrawer.close());
  lessonDrawer.addEventListener('close', () => {
    if (lessonDrawer.open) return;
    const trigger = $('openMenu');
    trigger.setAttribute('aria-expanded', 'false');
    if (menuOpenedByPointer && document.activeElement === trigger) trigger.blur();
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
    const q = cardExercise();
    attempts.set(q.id, Construction.place(q, attempt(), index, target));
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
        review = null; selected = null; answerResult = null; save(); renderExercise(); break;
      case 'miniView':
        state.courseView = state.courseView === 'mini' ? 'all' : 'mini';
        applyFilters(); break;
      case 'startReview':
        stopSpeech(); review = Construction.englishReview(getQ());
        attempts.delete(review.id);
        selected = null; answerResult = null; renderExercise();
        $('pool').querySelector('[data-card]')?.focus({ preventScroll: true });
        $('practicePane').scrollTop = 0;
        break;
      case 'check': checkAnswer(getQ()); break;
      case 'reset':
        stopSpeech();
        if (usingLists()) selections.delete(state.current);
        else attempts.delete(cardExercise().id);
        selected = null; answerResult = null; renderExercise(); break;
      case 'previous': case 'next': {
        const visible = navigationLessons(), i = Construction.navigationIndex(visible, getQ());
        const next = visible[i + (button.id === 'next' ? 1 : -1)]; if (next) choose(next.id); break;
      }
      case 'resultNext':
        if (button.dataset.nextLesson) {
          choose(button.dataset.nextLesson);
          if (!levelGuide.open) $('slots').querySelector('.slot:enabled')?.focus({ preventScroll: true });
        } else {
          $('openMenu').click();
        }
        break;
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
    if (event.target.id === 'resultAutoSpeak') {
      setAutoSpeak(event.target.checked);
      return;
    }
    if (event.target.id === 'hideJapanese') {
      state.hideJapanese = event.target.checked;
      event.target.closest('.result').classList.toggle('hide-japanese', state.hideJapanese);
      save();
      return;
    }
    if (event.target.id !== 'voice') return;
    stopSpeech();
    savedVoice = event.target.value;
    try { localStorage.setItem(VOICE_KEY, JSON.stringify({ voiceURI: savedVoice })); } catch { storageOK = false; save(); }
  });
  function speak(text) {
    if (!answerResult || !hasSpeech || !text) return;
    stopSpeech(); const run = speechRun, voice = preferredVoice(englishVoices());
    const utterance = new SpeechSynthesisUtterance(text); // Never derive speech from the internal question marker.
    if (voice) utterance.voice = voice;
    utterance.lang = 'en-US'; utterance.rate = speechRates[speechSpeed];
    const report = text => { if (run === speechRun) setSpeechStatus(text); };
    utterance.onstart = () => report('読み上げ中…');
    utterance.onend = () => report('');
    utterance.onerror = event => report(['canceled', 'interrupted'].includes(event.error) ? '' : '音声エラー');
    try { speechSynthesis.speak(utterance); } catch { report('音声エラー'); }
  }
  if (hasSpeech) speechSynthesis.addEventListener('voiceschanged', populateVoices);
  if (location.hash === '#tense-pictures') openTensePictures();
  else applyFilters();
  window.addEventListener('hashchange', () => {
    if (location.hash === '#tense-pictures') openTensePictures();
  });
}
