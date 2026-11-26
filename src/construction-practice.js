/* Shared exercise rules are also used by the Node tests. */
'use strict';
const Construction = (() => {
  const roles = ['S', 'support', 'predicate', 'P1', 'P2', 'place', 'time'];
  const basicSupportChoices = ['する', 'した', 'である', 'であった'];
  const advancedOptionalRoles = ['P1', 'P2', '場所', '時'];
  const predicateSupportRoles = ['support', '助動詞', '助動詞＋否定', '否定', 'be', '疑問の支え'];
  const predicateRoles = new Set([...predicateSupportRoles, 'predicate', '述語', '述語の残り']);
  function isSupportRole(role) { return role === '頻度' || predicateSupportRoles.includes(role); }
  // A question moves the first support in front of the subject. Its seat stays right
  // after the subject, and いつも or a second support stay with that seat.
  function seatAfter(roles) {
    const subject = roles.indexOf('S');
    return subject > 0 && roles.slice(0, subject).some(role => role !== '頻度' && isSupportRole(role)) ? subject : -1;
  }
  function cardsFor(q) {
    return q.level === 1
      ? roles.filter(r => q.slots[r].ja).map(r => ({ text: q.slots[r].ja, role: r, en: q.slots[r].en }))
      : q.blocks.map(([role, en, text]) => ({ text, role, en }));
  }
  function targetsFor(q) {
    if (q.level === 1) return roles;
    const targets = q.blocks.map((_, i) => String(i));
    if (q.review) return targets;
    const core = targets.filter(id => !advancedOptionalRoles.includes(targetRole(q, id)));
    const optional = advancedOptionalRoles.map(role => targets.find(id => targetRole(q, id) === role) ?? role);
    return [...core, ...optional];
  }
  function targetRole(q, id) {
    return q.level === 1 || advancedOptionalRoles.includes(id) ? id : q.blocks[Number(id)][0];
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
    whether: 'かどうか', what: 'なに（何）', who: 'だれ（誰）', where: 'どこ（何処）',
    when: 'いつ（何時）', why: 'なぜ（何故）', which: 'どれ', how: 'どうやって'
  };
  function advancedChoices(data, category, english, correct, seed) {
    const entries = Object.entries(data.level2Choices[category]);
    // Vary the distractors between exercises instead of always taking the first entries.
    const alternatives = rotateChoices([...new Set(entries
      .filter(([en, ja]) => en !== english && ja !== correct)
      .map(([, ja]) => ja))], seed);
    if (!correct) return alternatives.slice(0, 4);
    const limit = category === '助動詞' ? 4 : 3;
    return rotateChoices([correct, ...alternatives.slice(0, limit)], seed);
  }
  function choicesFor(data, q, role) {
    if (q.level === 3) {
      const token = q.question?.token;
      const [category, english, correct] = q.blocks[Number(role)] ?? [role];
      if (Object.hasOwn(questionChoices, token) && (category === 'question-marker' || category.startsWith('疑問主部＝'))) {
        return rotateChoices(Object.values({ ...questionChoices, [token]: correct }), q.id + role);
      }
      if (category === 'support' || category === '疑問の支え' || category === 'be') {
        return [...new Set([...basicSupportChoices, correct])];
      }
      if (isSupportRole(category)) return advancedChoices(data, category, english, correct, q.id + role);
      const candidates = data.examples.filter(item => item.level === 3)
        .flatMap(item => item.blocks.filter(([role]) => role === category)
          .map(([, , text]) => text));
      const others = [...new Set([...candidates, ...Object.values(data.level2Choices[category] ?? {})])]
        .filter(text => text && text !== correct && !(category === '述語' && correct === 'ほしい' && text === '好き'));
      return rotateChoices([correct, ...rotateChoices(others, q.id + role)].filter(Boolean).slice(0, 4), q.id + role);
    }
    if (q.level === 2) {
      const [category, english, correct] = q.blocks[Number(role)] ?? [role];
      return advancedChoices(data, category, english, correct, q.id + role);
    }
    if (role === 'support') {
      return q.group === 'tense-pictures' ? [...basicSupportChoices, 'ことがある'] : [...basicSupportChoices];
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
    if (q.level !== 1 && advancedOptionalRoles.includes(role)) return !choices[role];
    if (q.level !== 1) return choices[role] === q.blocks[Number(role)][2];
    if (['support', 'P1', 'P2', 'place', 'time'].includes(role) && !q.slots[role].ja) return !choices[role];
    return Object.hasOwn(choices, role) && choices[role] === q.slots[role].ja;
  }
  function enabledTargets(q, filled) {
    const targets = targetsFor(q).filter(id => q.level === 1 ? q.slots[id].ja : !advancedOptionalRoles.includes(id));
    if (q.level === 3) {
      const firstEmpty = targets.findIndex(id => !filled.includes(id));
      return firstEmpty < 0 ? targets : targets.slice(0, firstEmpty + 1);
    }
    const opening = targets.filter(id => targetRole(q, id) === 'S');
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
    const missingPredicate = predicates.some(id => !filled.includes(id));
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
      id: q.id + '-english', level: 3, review: true,
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
  return { roles, cardsFor, targetsFor, targetRole, isSupportRole, seatAfter, expectedTarget, wrongCardTargets, isCorrect, choicesFor, choicesCorrect, choiceMatches, enabledTargets, place, visibleExamples, sceneExamples, practiceSets, englishReview, restore, shuffledIndices, navigationIndex };
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
      q.imageQuestionMark = illustration.questionMark;
      q.imageTodayCalendar = illustration.todayCalendar;
      q.imageSpeakerPose = illustration.speakerPose;
      q.imageSpeakerPlacement = illustration.speakerPlacement;
    }
  }
  const KEY = 'construction-workshop-original-v1', VOICE_KEY = 'sentence-workshop-voice-v1';
  const SPEED_KEY = 'construction-workshop-speech-speed-v1';
  const speechRates = { normal: 1, slow: .6 };
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const labels = { S: '主語', support: '助述部', predicate: '述語', P1: '対象１', P2: '対象２', place: '場所', time: '時',
    'question-marker': '疑問主部', there: '主部（仮）' };
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
        practice: '今は「である」＋「生徒」で “I am a student.” 去年なら「であった」＋「生徒」で “I was a student last year.” 英語では am が was に変わります。',
      }],
      note: '「今、食べている」のような文でも、助述部は「である」です。述語には「食べている」を入れます。時制の絵くらべの「乗ったことがある」では、助述部が「ことがある」（have）、述語が「乗った」（ridden）です。まずは、この２つの形を練習していきましょう。',
    },
    2: {
      summary: '話し手の気持ちや判断、打ち消し、回数を助述部に加えます。',
      introduction: '「自転車に乗る」に「できる」を加えると、「自転車に乗れる」になります。このアプリでは、その「程度」を吹き出しの先にいる話し手の表情やしぐさで表します。話し手の顔と手をよく見て、助述部に入れることばをえらびましょう。',
      examples: [{
        id: 'level2-01',
        heading: '自信のある笑顔 → 〜できる（can）',
        picture: 'speaker',
        explanation: '女の子がにっこり笑って親指を立てています。「大丈夫、私にできるよ」という気持ちです。',
      }, {
        id: 'level2-11',
        heading: '少し迷った顔 → 〜するかもしれない（might）',
        explanation: '女の子がほおに手を当て、少し迷った顔をしています。「自転車に乗るかもしれないけど、まだ分からない」という気持ちです。',
        picture: 'scene',
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
      }, {
        heading: '打ち消し → 〜しなかった（did not）',
        explanation: 'レベル１で声に出さなかった「した」が、not と組んで did として現れます。そのため述語は ate ではなく eat の形にもどります。「〜していない」の is not や「〜したことがない」の have not も、同じ助述部の欄に入ります。',
        en: 'He did not eat a rice ball.',
        ja: '彼はおにぎりを食べませんでした。',
        parts: [
          { role: 'S', en: 'He', text: '彼は' },
          { role: '否定', en: 'did not', text: '〜しなかった' },
          { role: '述語', en: 'eat', text: '食べる' },
          { role: 'P1', en: 'a rice ball', text: 'おにぎりを' },
        ],
      }],
      note: '「よく読む」などの文では、助述部１に「する」、その下の助述部修飾に「よく」を入れます。この「する」は英文では声に出しません。助述部が２つあるときは、助述部１、修飾、助述部２の順にえらびます。must be のような文では、助述部２の be は「である」です。',
    },
    3: {
      summary: '疑問文と、There で始まる「いる・ある」の文を作ります。',
      introduction: '話し手のそばの「？」は「かどうか」の合図です。吹き出しの中に「？」があれば、その場所や人、物などをたずねます。疑問主部の欄で聞き方を選び、左からことばを入れます。疑問文では助述部１が主語の前へ出ます。元の席は「空席」として残ります。使わない欄は空けておきましょう。',
      examples: [{
        heading: '「何を？」と聞く文の作り方',
        explanation: '「何を？」を表す what を先頭へ。そのすぐあと、２番目が最初の助述部（助述部１）の位置です。この文では can が入ります。do・does（「する」）や did（「した」）もここに入ります。',
        startingOrder: 'I can buy [what]',
        en: 'What can I buy?',
        ja: '私は何を買えますか？',
        parts: [
          { role: '疑問主部＝P1', en: 'What', text: 'なに（何）' },
          { role: 'support', en: 'can', text: '〜できる' },
          { role: 'S', en: 'I', text: '私は' },
          { role: '述語', en: 'buy', text: '買う' },
        ],
      }, {
        heading: '「はい・いいえ」で答えられる文',
        explanation: 'はい・いいえで答える質問は、先頭で「かどうか」を選びます。このカードは練習用の目印です。英文では次の助述部 Are から書き、Are から読みます。',
        en: 'Are you a student?',
        ja: 'あなたは生徒ですか？',
        parts: [
          { role: 'question-marker', en: '(whether)', text: 'かどうか' },
          { role: 'support', en: 'Are', text: 'である' },
          { role: 'S', en: 'you', text: 'あなたは' },
          { role: '述語', en: 'a student', text: '生徒' },
        ],
      }, {
        heading: '助述部が２つあるとき',
        explanation: '主語の前へ出るのは助述部１の can だけです。「いつも」と助述部２の be は、主語のあとの空席のところに残ります。',
        startingOrder: 'You can always be happy.',
        en: 'Can you always be happy?',
        ja: 'あなたはいつもうれしい気持ちでいられますか？',
        parts: [
          { role: 'question-marker', en: '(whether)', text: 'かどうか' },
          { role: '助動詞', en: 'Can', text: '〜できる' },
          { role: 'S', en: 'you', text: 'あなたは' },
          { role: '頻度', en: 'always', text: 'いつも' },
          { role: 'be', en: 'be', text: 'である' },
          { role: '述語', en: 'happy', text: 'うれしい' },
        ],
      }, {
        id: 'level3-04',
        heading: '誰が、どんなふうにたずねている？',
        picture: 'scene',
        explanation: '話し手の男の子が親指を立てています。レベル２と同じ「できる」の合図です。そばに「？」があるので、「かどうか」のあとに Can を置きます。',
      }, {
        id: 'level3-18',
        heading: '見つけたものを知らせる文',
        explanation: '「ほら、猫がいるよ」と伝える文です。主部（仮）の「ほら」に There、助述部の「いる」に is が入ります。There は疑問主部と同じように、先頭で主語の場所に入ります。',
      }],
      questionWords: [
        ['what', 'なに（何）', 'What can I buy?', '私は何を買えますか？'],
        ['who', 'だれ（誰）', 'Who gives you a sticker at school?', '学校で、だれがあなたにシールをくれますか？'],
        ['when', 'いつ（何時）', 'When do you clean your room?', 'あなたはいつ自分の部屋をそうじしますか？'],
        ['where', 'どこ（何処）', 'Where do you play soccer?', 'あなたはどこでサッカーをしますか？'],
        ['why', 'なぜ（何故）', 'Why are you happy?', 'あなたはなぜうれしいのですか？'],
        ['which', 'どの本', 'Which book do you want?', 'あなたはどの本がほしいですか？'],
        ['how', 'どうやって', 'How do you make a paper hat?', 'あなたは紙のぼうしをどうやって作りますか？'],
      ],
      note: '「だれが」と聞くときは Who が主語です。Who gives … では、練習で黙助述部の「する」を入れます。英文では Who の次に gives が来ます。Who can ride a bike? の can は声に出します。Who が主語の文では助述部が前へ出ないので、空席はできません。',
    },
  };
  const compactChoices = window.matchMedia('(max-width: 720px)');
  function roleLabel(role) {
    const [prefix, target] = role.split('＝');
    return target ? `${prefix}（${labels[target] || target}）` : labels[role] || role;
  }
  function labelParts(parts) {
    const support = parts.filter(part => part.role !== '頻度' && Construction.isSupportRole(part.role));
    const numberedSupport = support.length > 1 || parts.some(part => part.role === '頻度');
    return parts.map(part => {
      if (part.role === '頻度') return { ...part, role: 'support', label: '助述部修飾', modifier: true };
      const index = support.indexOf(part);
      if (index < 0) return { ...part, label: roleLabel(part.role) };
      const number = numberedSupport ? (index + 1).toLocaleString('ja-JP-u-nu-fullwide') : '';
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
  const seatTitle = '助述部１が主語の前へ出たあとの、元の席';
  // The seat joins the support group after it, so いつも hangs below the seat.
  function withSeat(parts, roles) {
    const subject = Construction.seatAfter(roles);
    if (subject >= 0) parts.splice(subject + 1, 0, { seat: true, role: 'support', label: '空席' });
    return parts;
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
        lesson?.prepend('✓ ');
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
    if (state.courseView !== 'mini') return { label: '次の場面へ →' };
    const unfinished = firstUnfinished(lessons);
    if (unfinished) return { id: unfinished.id, label: 'セットの残りの問題へ →' };
    const { sets, setIndex } = miniCourse();
    const nextSet = sets[setIndex + 1];
    if (nextSet) return { id: (firstUnfinished(nextSet) || nextSet[0]).id, label: '次のセットへ →' };
    return { label: '次の場面へ →' };
  }
  function renderNav(visible) {
    renderCourse(visible);
    visible = navigationLessons(visible);
    $('artworkProgress').textContent = `絵のある例文 ${Object.keys(ILLUSTRATIONS).length} / ${DATA.examples.length}文`;
    $('filterCount').textContent = `${visible.length}文を表示`;
    const emptyMessage = state.levels.length ? 'この組み合わせの問題はありません。ほかの場面かレベルをえらんでね。' : 'レベルをえらぶと、例文が表示されます。';
    $('lessons').innerHTML = visible.length ? visible.map((q, index) => {
      const heading = q.unit && q.unit !== visible[index - 1]?.unit
        ? `<h3 class="lesson-unit">${esc(DATA.units[q.unit])}</h3>` : '';
      const reviewMark = q.needsReview ? ' <span class="muted">［要見直し］</span>' : '';
      return `${heading}<button data-lesson="${esc(q.id)}" aria-current="${state.current === q.id}">${state.completed.includes(q.id) ? '✓ ' : ''}${esc(q.ja)}${reviewMark}</button>`;
    }).join('') : `<p class="muted">${emptyMessage}</p>`;
    const index = Construction.navigationIndex(visible, getQ());
    $('previous').disabled = index <= 0; $('next').disabled = index < 0 || index >= visible.length - 1;
  }
  function poolCardHTML(card, i) {
    return `<button class="card ${selected === i ? 'selected' : ''}" data-card="${i}" aria-pressed="${selected === i}" ${review ? 'lang="en"' : ''}>${esc(card.text)}</button>`;
  }
  function calendarFor(time, position) {
    if (time === 'every day') {
      return `
        <span class="day-calendar daily-calendar" role="img" aria-label="二週間分の全ての日にチェックが付いたカレンダー">
          <span class="daily-checks">${'<span></span>'.repeat(14)}</span>
        </span>`;
    }
    if (time !== 'yesterday' && time !== 'tomorrow' && !(time === 'today' && position)) return '';
    const label = time === 'today' ? '地球儀の真ん中を矢印で指す、今日のカレンダー'
      : `地球儀を${time === 'yesterday' ? '左' : '右'}向きに一周するカレンダー`;
    const placement = position ? ` style="--today-x:${esc(position[0])}%;--today-y:${esc(position[1])}%"` : '';
    return `
      <span class="day-calendar ${time}"${placement} role="img" aria-label="${label}">
        <span class="${time === 'today' ? 'day-pointer' : 'day-orbit'}" aria-hidden="true"></span>
        <img src="assets/calendar/earth.png" alt="">
      </span>`;
  }
  function sceneArtwork(img, q) {
    if (!q.imageQuestionMark && !q.imageSpeakerPose && !q.imageTodayCalendar) return img;
    const [x, y] = q.imageQuestionMark ?? [];
    return `<div class="marked-illustration">
      ${img}
      ${q.imageQuestionMark ? `<span class="scene-question-mark" style="--question-x:${esc(x)}%;--question-y:${esc(y)}%" aria-hidden="true">?</span>` : ''}
      ${q.imageTodayCalendar ? calendarFor('today', q.imageTodayCalendar) : ''}
      ${q.imageSpeakerPose ? `<span class="scene-speaker" data-pose="${esc(q.imageSpeakerPose)}" data-placement="${esc(q.imageSpeakerPlacement ?? '')}" aria-hidden="true"></span>` : ''}
    </div>`;
  }
  function renderPicture(q) {
    if (!q.image) {
      $('pictureScene').innerHTML = `<div class="scene-pending japanese">${esc(q.ja)}</div>`;
      return;
    }
    const time = q.slots?.time.en ?? q.blocks.find(([role]) => role === '時')?.[1];
    const img = `<img class="scene-illustration" src="${esc(q.image)}" alt="${esc(q.imageAlt)}" width="1536" height="1024">`;
    $('pictureScene').innerHTML = `
      <div class="scene-visual">
        ${sceneArtwork(img, q)}
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
    $('pool').hidden = pictureMode;
    const parameters = q.frame === 'object-location' ? ['P2', 'P1'] : ['P1', 'P2'];
    const japaneseOrder = ['S', 'time', 'place', ...parameters, 'predicate', 'support'];
    const order = basic ? japaneseOrder.map(role => cards.findIndex(card => card.role === role)).filter(i => i >= 0) : Construction.shuffledIndices(active);
    const remaining = order.filter(i => !placements[i]);
    const emptyPool = review ? 'すべてのカードを置きました。' : '使わない欄は空欄のまま。';
    $('pool').innerHTML = `<div class="pool-cards">${remaining.map(i => poolCardHTML(cards[i], i)).join('') || `<span class="muted">${emptyPool}</span>`}</div>`;
    const roles = Construction.targetsFor(active).map(id => Construction.targetRole(active, id));
    const targets = labelParts(Construction.targetsFor(active).map((id, index) => ({ id, role: roles[index], index })));
    // English review practices the spoken order only, without the seat.
    if (!review) withSeat(targets, roles);
    const seatSlot = `<div class="slot seat" title="${seatTitle}">空席</div>`;
    if (pictureMode) {
      const values = picks();
      $('slots').innerHTML = renderPartGroups(targets, ({ id, role, label, seat }) => {
        if (seat) return seatSlot;
        const prompt = role.startsWith('疑問主部＝') ? '疑問主部' : label;
        return `
        <select class="slot list-choice${values[id] ? '' : ' placeholder'}" id="choice-${esc(id)}"
          data-choice="${esc(id)}" data-role="${esc(role)}" data-label="${esc(prompt)}" aria-label="${esc(prompt)}を選ぶ" ${!targetAllowed(id) ? 'disabled' : ''}>
          <option value="__unanswered__" ${Object.hasOwn(values, id) ? '' : 'selected'}>${esc(choicePrompt(prompt))}</option>
          ${Construction.choicesFor(DATA, q, id).map(text => `<option value="${esc(text)}" ${values[id] === text ? 'selected' : ''}>${esc(text)}</option>`).join('')}
        </select>`;
      });
    } else {
      $('slots').innerHTML = renderPartGroups(targets, ({ id: target, role, label, index, seat }) => {
        if (seat) return seatSlot;
        const i = placements.indexOf(target);
        const slotName = review ? String(index + 1) : active.level === 2 && role !== 'support' ? `${index + 1}. ${label}` : label;
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
        ${q.base && q.level !== 3 ? `<p class="muted"><span class="result-explanation">もとの文 </span><span lang="en">${esc(q.base)}</span></p>` : ''}
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
          <button type="button" id="resultNext" class="result-next"${next.id ? ` data-next-lesson="${esc(next.id)}"` : ' disabled'}>${esc(next.label)}</button>
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
      const source = q.parts ?? Construction.cardsFor(q);
      const parts = withSeat(labelParts(source), source.map(part => part.role));
      const pictureClass = example.picture === 'speaker' ? ' guide-illustration-speaker' : '';
      return `<figure class="guide-example">
        <figcaption>
          ${example.heading ? `<h3>${esc(example.heading)}</h3>` : ''}
          ${example.picture && q.image ? `
            <div class="guide-illustration${pictureClass}">
              ${sceneArtwork(`<img src="${esc(q.image)}" alt="${esc(q.imageAlt)}" width="860" height="644">`, q)}
            </div>` : ''}
          ${example.explanation ? `<p class="guide-explanation">${esc(example.explanation)}</p>` : ''}
          ${example.startingOrder ? `<span class="guide-starting-order"><span lang="en">${esc(example.startingOrder)}</span> →</span>` : ''}
          <span class="guide-sentence" lang="en">${esc(q.en)}</span><span class="muted">${esc(q.ja)}</span>
        </figcaption>
        <div class="guide-parts">${renderPartGroups(parts, ({ role, label, en, text, seat }) => seat ? `
          <div class="answer-part guide-part guide-seat" title="${seatTitle}"><span class="answer-label">空席</span></div>` : `
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
        choose(button.dataset.nextLesson);
        if (!levelGuide.open) $('slots').querySelector('.slot:enabled')?.focus({ preventScroll: true });
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
