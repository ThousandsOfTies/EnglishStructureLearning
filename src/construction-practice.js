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
    when: 'いつ（何時）', why: 'なぜ（何故）', which: 'どれ・どの', how: 'どうやって'
  };
  const subjectChoices = ['私', 'あなた', '彼', '彼女', '私たち', 'あなたたち', '彼ら', 'それ'];
  const preferredChoiceOrder = new Map([
    ...basicSupportChoices, 'ことがある', ...Object.values(questionChoices),
    ...subjectChoices, '彼女たち',
  ].map((label, index) => [label, index]));
  const japaneseOrder = new Intl.Collator('ja');
  function distinctAlternatives(correct, values) {
    return [...new Set(values)].filter(text => text && text !== correct);
  }
  // Each line lists labels that can describe the same picture. A label can belong
  // to several lines: both a cartoon and a soccer match can be TV programs.
  const overlappingPictureLabels = {
    P1: [
      '友だち 彼 おとなりさん 新しいクラスメート 男の人',
      '友だち 彼女 おとなりさん 新しいクラスメート 女の人',
      '彼 先生 お父さん 男の人', '彼女 先生 お母さん 女の人',
      '彼 おじいちゃん 男の人', '彼女 おばあちゃん 女の人',
      '彼のところ 友だちのところ', 'おばあちゃんのところ 友だちのところ',
      'ここ この部屋', 'ここ 公園', 'ここ 学校',
      'テレビ番組 アニメ', 'テレビ番組 サッカーの試合',
      '本 まんが 絵本 動物の本 短いお話 お気に入りの本',
      '歌 好きな歌 新しい歌 楽しい歌 誕生日の歌',
      '先生の質問 かんたんな質問 最後の質問',
      '宿題 英語の単語 名前 新しい単語 短い手紙', '英語 英語の単語 新しい単語',
      '宿題 本 ノート',
      'サッカー サッカーの試合 友だちとサッカー 新しいスポーツ',
      'ゲーム 新しいゲーム 友だちとカードゲーム', 'ダンス 新しいダンス',
      '紙 白い紙', 'カード 青いカード', '水 冷たい水',
      'ボール 小さなボール 青いボール', 'ボール 小さなボール 赤いボール',
      'かさ 傘', 'ポニー 小さな馬', '紙飛行機 紙ひこうき', 'たこ 青いたこ', 'たこ 赤いたこ',
      '帽子 ぼうし 赤いぼうし 紙のぼうし', '鉛筆 新しい鉛筆 緑の鉛筆',
      '毛布 やわらかい毛布', '箱 小さな箱', '石 小さな石', '机 小さな机',
      'ノート 新しいノート お母さんとノート', 'パン お母さんと小さなパン',
      'シャツ 青いシャツ', 'コート 上着 黄色いコート', 'りんご 小さなりんご',
      '木の葉 赤い葉っぱ', 'スープ お父さんとスープ', 'カレー お父さんとカレー',
      'シール 友だちとシール', 'クッキー 友だちとクッキー', 'おもちゃの車 お父さんとおもちゃの車',
    ],
    P2: [
      '絵 地図 写真', 'カード 手紙 写真', 'カード シール',
      '質問 名前', '予定 時刻 答え',
    ],
    place: [
      '家で 部屋で ソファで ベッドで ふとんで', '家で 庭で',
      '学校で 校庭で', '学校で 先生のとなりに',
      'ここ 外 バス停で 通りで', 'ここ 外 公園で 校庭で 庭で',
      '公園で ベンチで ベンチに 木の下で 木の下に 芝生に 外',
      '庭で 木の下で 木の下に 芝生に 外', '公園で 川のそば 外',
      '海で 浜辺で 外', '湖で 浜辺で 外', 'テントで 外',
    ],
    time: ['朝ごはんに 朝食のときに 朝に', '今 今日', '新学期に 登校初日に'],
    頻度: ['よく たいてい'],
    predicate: [
      '行く 行きます 向かっている 来る 来ます 来ている 来る途中 歩く 歩きます 歩いている 歩いて通る 歩いて通っている 遊びに行く 遊びに行きます 遊びに行っている',
      '遊ぶ 遊んでいる 遊びに行く 遊びに行っている',
      '持つ 持ちます 持っている 運ぶ 運びます 運んでいる 持ってくる 持ってきます 持ってきている 持っていく 持ち上げる 持ち上げます 持ち上げている',
      '持つ 持ちます 持っている 使う 使います 使っている', '持つ 持ちます 持っている 読む 読みます 読んでいる',
      '持つ 持ちます 持っている 作る 作ります 作っている',
      '勉強する 勉強します 勉強している 書く 書きます 書いている 読む 読みます 読んでいる 覚える 覚えます 覚えている',
      '見せる 見せます 見せている 見る 見ます 見ている 教える 教えます 教えている 伝える 伝えます 伝えている',
      '閉じる 閉じます 閉じている 見る 見ます 見ている',
      '開ける 開けます 開けている 閉じる 閉じます 閉じている 持ち上げる 持ち上げます 持ち上げている',
      '始める 始めます 始めている 書く 書きます 書いている 座る 座ります 座っている',
      '休む 休みます 休んでいる 座る 座ります 座っている ねる ねます ねている',
      '味見する 味見します 味見している 食べる 食べます 食べている 飲む 飲みます 飲んでいる',
      '作る 作ります 作っている 切る 切ります 切っている 混ぜる 混ぜます 混ぜている 焼く 焼きます 焼いている',
      '練習する 練習します 練習している 覚える 覚えます 覚えている おどる おどります おどっている', '覚える 覚えます 覚えている 歌う 歌います 歌っている',
      '買う 買います 買っている お金を払う お金を払います お金を払っている',
      '好き 好きです 大好き 大好きです ほしい ほしいです 要る 要ります',
      '見る 見ます 見ている 見かける 見かけます', '聞く 聞きます 聞いている 聞こえます',
      'かく かきます かいている 描く 描いている 書く 書きます 書いている 色をぬる 色をぬります 色をぬっている',
      'する します している たずねる たずねます たずねている', '止まる とまる',
    ],
  };
  const pictureConflicts = {};
  for (const [role, groups] of Object.entries(overlappingPictureLabels)) {
    const conflicts = new Map();
    for (const group of groups) {
      const labels = group.split(' ');
      for (const label of labels) {
        if (!conflicts.has(label)) conflicts.set(label, new Set());
        for (const other of labels) conflicts.get(label).add(other);
      }
    }
    pictureConflicts[role] = conflicts;
  }
  function pictureAlternatives(role, correct, ordered, limit) {
    const key = { 場所: 'place', 時: 'time', 述語: 'predicate', 述語の残り: 'predicate' }[role] ?? role;
    const conflicts = pictureConflicts[key];
    if (!conflicts) return ordered.slice(0, limit);
    const blocked = new Set(conflicts.get(correct));
    const selected = [];
    for (const label of ordered) {
      // Without a pointing gesture, "here" can fit any pictured location.
      if (blocked.has(label) || (label === 'ここ' && (key === 'P1' || key === 'place'))) continue;
      selected.push(label);
      if (selected.length === limit) break;
      for (const other of conflicts.get(label) ?? []) blocked.add(other);
    }
    return selected;
  }
  function choiceLabel(q, target, value) {
    // A Which question keeps its full phrase on the answer card and as the
    // selected value. The visible menu names the type of question consistently.
    const block = q.level === 3 && q.blocks[Number(target)];
    return q.question?.token === 'which' && block?.[0].startsWith('疑問主部＝') && value === block[2]
      ? questionChoices.which : value;
  }
  function predicateForm(q, [category, english]) {
    if (q.level === 1) {
      if (q.meaning === 'ongoing' || q.meaning === 'experience') return q.meaning;
      if (q.slots.support.en) return 'complement';
    } else {
      if (category === '述語の残り') return 'complement';
      const supports = q.blocks.filter(([role]) => predicateSupportRoles.includes(role));
      if (supports.some(([, en]) => /^(?:have|has)(?: not)?$/i.test(en))) return 'experience';
      if (supports.some(([, en]) => /^(?:am|is|are|was|were|be)(?: not)?$/i.test(en))) {
        return /^\w+ing(?: |$)/i.test(english) ? 'ongoing' : 'complement';
      }
    }
    return 'simple';
  }
  function advancedPredicateChoices(data, q, target, block) {
    const [category, , correct] = block;
    const form = predicateForm(q, block);
    const alternatives = data.examples.filter(item => item.level === q.level || (q.level === 3 && item.level === 2))
      .flatMap(item => item.blocks.filter(part => part[0] === category && predicateForm(item, part) === form)
        .map(([, , text]) => text))
      .filter(text => text && text !== correct && text !== 'する' && !(correct === 'ほしい' && text === '好き'));
    const seed = q.id + target;
    const ordered = rotateChoices([...new Set(alternatives)], seed);
    return [correct, ...pictureAlternatives(category, correct, ordered, 3)];
  }
  function advancedChoices(data, category, english, correct, seed) {
    const entries = Object.entries(data.level2Choices[category]);
    // Vary the distractors between exercises instead of always taking the first entries.
    const ordered = rotateChoices(distinctAlternatives(correct, entries
      .filter(([en]) => en !== english)
      .map(([, ja]) => ja)), seed);
    const limit = !correct || category === '助動詞' ? 4 : 3;
    const alternatives = pictureAlternatives(category, correct, ordered, limit);
    return correct ? [correct, ...alternatives] : alternatives;
  }
  function choiceCandidates(data, q, role) {
    const block = q.level > 1 && q.blocks[Number(role)];
    if (targetRole(q, role) === 'S') {
      const subject = q.level === 1 ? q.slots.S.ja : block[2];
      return subject && !subjectChoices.includes(subject) ? [...subjectChoices, subject] : [...subjectChoices];
    }
    if (block && (block[0] === '述語' || block[0] === '述語の残り')) {
      return advancedPredicateChoices(data, q, role, block);
    }
    if (q.level === 3) {
      const token = q.question?.token;
      const [category, english, correct] = block ?? [role];
      if (Object.hasOwn(questionChoices, token) && (category === 'question-marker' || category.startsWith('疑問主部＝'))) {
        return Object.values({ ...questionChoices, [token]: correct });
      }
      if (category === 'support' || category === '疑問の支え' || category === 'be') {
        return [...new Set([...basicSupportChoices, correct])];
      }
      if (isSupportRole(category)) return advancedChoices(data, category, english, correct, q.id + role);
      const candidates = data.examples.filter(item => item.level === 3)
        .flatMap(item => item.blocks.filter(([role]) => role === category)
          .map(([, , text]) => text));
      const others = distinctAlternatives(correct, [...candidates, ...Object.values(data.level2Choices[category] ?? {})]);
      const alternatives = pictureAlternatives(category, correct, rotateChoices(others, q.id + role), correct ? 3 : 4);
      return [correct, ...alternatives].filter(Boolean);
    }
    if (q.level === 2) {
      const [category, english, correct] = block ?? [role];
      return advancedChoices(data, category, english, correct, q.id + role);
    }
    if (role === 'support') {
      return q.group === 'tense-pictures' ? [...basicSupportChoices, 'ことがある'] : [...basicSupportChoices];
    }
    const form = role === 'predicate'
      ? predicateForm(q, ['predicate', q.slots.predicate.en]) : null;
    const candidates = [...data.examples.filter(item => item.level === 1 && item.group === q.group),
      ...data.examples.filter(item => item.level === 1)];
    const correct = q.slots[role].ja;
    const labels = candidates.filter(item => {
      const slot = item.slots[role];
      if (q.group === 'tense-pictures' && slot.en === q.slots[role].en) return false;
      return !form || predicateForm(item, [role, slot.en]) === form;
    }).map(item => item.slots[role].ja);
    const ordered = distinctAlternatives(correct, labels);
    const alternatives = pictureAlternatives(role, correct, ordered, 3);
    return [correct, ...alternatives].filter(Boolean);
  }
  function choicesFor(data, q, role) {
    // Order by the displayed labels, including the shared label for Which questions.
    return choiceCandidates(data, q, role).sort((a, b) => {
      const left = choiceLabel(q, role, a);
      const right = choiceLabel(q, role, b);
      const last = preferredChoiceOrder.size;
      const rank = (preferredChoiceOrder.get(left) ?? last) - (preferredChoiceOrder.get(right) ?? last);
      return rank || japaneseOrder.compare(left, right) || (left < right ? -1 : Number(left > right));
    });
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
      (q.level !== 1 || filters.group === 'all' || q.group === filters.group) &&
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
  function practiceCourse(data, filters) {
    const visible = visibleExamples(data, filters);
    const byTheme = new Map([['all', visible]]);
    for (const theme of data.themes) byTheme.set(theme.id, []);
    for (const q of visible) byTheme.get(q.theme).push(q);
    const matching = byTheme.get(filters.sceneTheme);
    const mini = filters.courseView === 'mini';
    return { mini, byTheme, matching, sets: practiceSets(matching), eligible: mini ? matching : visible };
  }
  function coursePosition(course, current) {
    const setIndex = Math.max(0, course.sets.findIndex(set => set.some(q => q.id === current.id)));
    const lessons = course.mini ? (course.sets[setIndex] ?? []) : course.eligible;
    return { lessons, setIndex, index: navigationIndex(lessons, current) };
  }
  function englishReview(q) {
    return {
      id: q.id + '-english', level: 3, review: true,
      blocks: cardsFor(q).filter(card => card.en).map(card => [card.role, card.en, card.en])
    };
  }
  function restore(data, saved) {
    const ids = new Set(data.examples.map(q => q.id));
    const initial = { current: data.examples[0].id, completed: [], seenGuides: [], level: 1, group: 'go', search: '', mode: 'cards' };
    if (!saved || saved.version !== 1) return initial;
    initial.completed = [...new Set(Array.isArray(saved.completed) ? saved.completed.filter(id => ids.has(id)) : [])];
    if (Array.isArray(saved.seenGuides)) initial.seenGuides = data.levels.map(level => level.id).filter(id => saved.seenGuides.includes(id));
    if ([1, 2, 3].includes(saved.level)) initial.level = saved.level;
    if (saved.mode === 'select') initial.mode = 'select';
    if (saved.group === 'all' || data.groups.some(g => g.key === saved.group)) initial.group = saved.group;
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
  return { roles, cardsFor, targetsFor, targetRole, isSupportRole, seatAfter, expectedTarget, wrongCardTargets, isCorrect, choicesFor, choiceLabel, choicesCorrect, choiceMatches, enabledTargets, place, visibleExamples, sceneExamples, practiceSets, practiceCourse, coursePosition, englishReview, restore, shuffledIndices, navigationIndex };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Construction;
