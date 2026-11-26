'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = require('../src/construction-practice.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/construction-examples.json'), 'utf8'));
const get = id => data.examples.find(q => q.id === id);
const basicSubjects = ['私', 'あなた', '彼', '彼女', '私たち', 'あなたたち', '彼ら', 'それ'];

test('all curriculum exercises can be completed by moving cards into their intended targets', () => {
  for (const q of data.examples) {
    const cards = app.cardsFor(q);
    assert.equal(new Set(cards.map(card => card.text)).size, cards.length, q.id);
    assert.equal(app.isCorrect(q, []), false, q.id);
    let placements = [];
    for (const i of app.shuffledIndices(q)) {
      assert.ok(cards[i].text, q.id);
      placements = app.place(q, placements, i, app.expectedTarget(q, i));
    }
    assert.ok(app.isCorrect(q, placements), q.id);
    const spoken = cards.map(card => card.en).filter(Boolean);
    assert.equal(spoken.join(' ') + (q.question ? '?' : '.'), q.en, q.id);
  }
});

test('unused slots stay empty and misplaced cards cannot pass', () => {
  const q = get('build-go-1');
  const correct = app.cardsFor(q).map((_, i) => app.expectedTarget(q, i));
  assert.equal(app.isCorrect(q, correct), true);
  assert.ok(!correct.includes('P2'));
  const wrong = app.place(q, correct, 0, 'P2');
  assert.equal(app.isCorrect(q, wrong), false);
  assert.deepEqual(app.wrongCardTargets(q, wrong), ['S', 'P2']);
  assert.equal(app.isCorrect(q, app.place(q, wrong, 0, 'S')), true);
});

test('cards keep the relation expressed inside each English phrase and drop Japanese sentence particles', () => {
  for (const [id, role, english, label] of [
    ['tense-bicycle', 'S', 'I', '私'], ['build-talk-2', 'P1', 'Mom', 'お母さん'],
    ['level3-q-can-bake-3', 'P2', 'with Mom', 'お母さんと'], ['build-teach-2', 'P2', 'a song', '歌'],
    ['level3-q-ing-touch-3-ongoing', 'P1', 'a leaf', '木の葉'], ['build-keep-1', 'P2', 'clean', 'きれい'],
    ['build-call-3', 'P2', 'Pochi', 'ポチ'], ['build-make-3', 'P2', 'happy', 'うれしい'],
    ['build-pay-1', 'P1', 'a ticket', '切符'], ['build-walk-2', 'P1', 'school', '学校'],
    ['build-dance-1', 'P1', 'the music', '音楽'], ['build-live-1', 'P1', 'in a small house', '小さな家に'],
    ['build-read-3', 'P1', 'a comic', 'まんが'], ['level3-01', 'P1', 'strawberries', 'いちご'],
    ['level2-01', '場所', 'in the park', '公園で'], ['build-wait-2', 'place', 'here', 'ここ'],
    ['level3-q-ing-play-2-ongoing', 'P1', 'hide-and-seek with friends', '友だちとかくれんぼ'],
    ['pronoun-independent-1', 'predicate', 'mine', '私のもの'], ['level3-19', 'いるもの', 'two birds', '二羽の鳥'],
  ]) {
    assert.deepEqual(app.cardsFor(get(id)).find(card => card.role === role), { role, en: english, text: label }, id);
  }
  assert.match(get('level3-q-ing-touch-3-ongoing').ja, /木の葉にさわって/);
  assert.match(get('build-teach-2').ja, /友だちに歌を教え/);
  for (const q of data.examples) {
    for (const target of app.targetsFor(q)) {
      const role = app.targetRole(q, target);
      if (!['S', 'P1', 'P2', 'place', '場所'].includes(role)) continue;
      const labels = app.choicesFor(data, q, target).map(value => app.choiceLabel(q, target, value));
      assert.equal(new Set(labels).size, labels.length, q.id);
      if (role === 'S') assert.ok(labels.every(text => !/[はが]$/u.test(text)), q.id);
      if (role === 'P1' || role === 'P2') assert.ok(labels.every(text => !text.endsWith('を')), q.id);
      const correct = app.cardsFor(q).find(card => card.role === role);
      if (correct) assert.ok(labels.includes(correct.text), q.id);
    }
  }
});

test('all subject menus share the basic pronouns and include the subject of the sentence', () => {
  for (const q of data.examples) {
    for (const target of app.targetsFor(q).filter(id => app.targetRole(q, id) === 'S')) {
      const correct = q.level === 1 ? q.slots.S.ja : q.blocks[Number(target)][2];
      const expected = basicSubjects.includes(correct) ? basicSubjects : [...basicSubjects, correct];
      assert.deepEqual(app.choicesFor(data, q, target), expected, q.id);
      for (const subject of expected) {
        assert.equal(app.choiceMatches(q, { [target]: subject }, target), subject === correct, q.id);
      }
    }
  }
});

test('identical visible choices keep the same order across exercises and levels', () => {
  const menus = new Map();
  for (const q of data.examples) {
    for (const target of app.targetsFor(q)) {
      const labels = app.choicesFor(data, q, target).map(value => app.choiceLabel(q, target, value));
      const key = JSON.stringify([...labels].sort());
      if (menus.has(key)) assert.deepEqual(labels, menus.get(key), q.id + ' ' + target);
      else menus.set(key, labels);
    }
  }
});

test('place menus retain the correct location and avoid visually overlapping choices', () => {
  for (const q of data.examples) {
    const target = app.targetsFor(q).find(id => ['place', '場所'].includes(app.targetRole(q, id)));
    const options = app.choicesFor(data, q, target);
    const correct = app.cardsFor(q).find(card => ['place', '場所'].includes(card.role));
    if (correct) assert.ok(options.includes(correct.text), q.id);
    assert.ok(!(options.includes('家で') && options.includes('部屋で')), q.id);
    assert.ok(!(options.includes('バス停で') && options.includes('ここ')), q.id);
  }
});

test('picture choices distinguish the same person, object, location, and action across all levels', () => {
  const pairs = {
    P1: [
      ['友だち', '彼'], ['友だち', '彼女'], ['友だち', 'おとなりさん'],
      ['先生の質問', 'かんたんな質問'], ['まんが', '動物の本'], ['アニメ', 'テレビ番組'],
      ['サッカーの試合', 'テレビ番組'], ['楽しい歌', '好きな歌'],
      ['彼', 'おじいちゃん'], ['友だちのところ', 'おばあちゃんのところ'],
    ],
    P2: [
      ['地図', '絵'], ['カード', '手紙'], ['カード', 'シール'],
      ['名前', '質問'], ['予定', '時刻'],
    ],
    place: [['学校で', '校庭で'], ['木の下で', 'ベンチで'], ['外', '公園で']],
    predicate: [
      ['開ける', '閉じる'], ['教えている', '見せている'], ['見せている', '見ている'],
      ['使う', '持つ'], ['持つ', '持ってくる'], ['勉強する', '書く'],
      ['行く', '歩く'], ['来ている', '歩いている'], ['向かっている', '歩いている'],
    ],
    time: [['朝食のときに', '朝に']],
    頻度: [['よく', 'たいてい']],
  };
  for (const q of data.examples) {
    for (const [index, card] of app.cardsFor(q).entries()) {
      const target = app.expectedTarget(q, index);
      const role = { 場所: 'place', 時: 'time', 述語: 'predicate' }[card.role] ?? card.role;
      if (!pairs[role]) continue;
      const options = app.choicesFor(data, q, target);
      const labels = options.map(value => app.choiceLabel(q, target, value));
      assert.ok(options.includes(card.text), q.id);
      for (const [first, second] of pairs[role]) {
        assert.ok(!(labels.includes(first) && labels.includes(second)), q.id + ': ' + first + ' / ' + second);
      }
    }
  }
});

test('subject unlocks predicate and both unlock the remaining slots used by the sentence', () => {
  const q = get('build-go-1');
  assert.deepEqual(app.enabledTargets(q, []), ['S']);
  const core = ['S', 'support', 'predicate'];
  assert.deepEqual(app.enabledTargets(q, ['S']), core);
  assert.deepEqual(app.enabledTargets(q, ['S', 'predicate']), core);
  assert.deepEqual(app.enabledTargets(q, core), [...core, 'P1', 'time']);
  assert.deepEqual(app.enabledTargets(q, ['predicate']), ['S']);
  const be = get('build-be-noun-1');
  assert.deepEqual(app.enabledTargets(be, ['S', 'predicate']), core);
  assert.deepEqual(app.enabledTargets(be, ['S', 'support']), core);
  assert.deepEqual(app.enabledTargets(be, core), core);
});

test('level two unlocks by grammatical role and relocks after clearing a prerequisite', () => {
  const cases = [
    ['level2-01', ['3', '4']],
    ['level2-06', ['3']],
  ];
  for (const [id, complements] of cases) {
    const q = get(id);
    const subject = '0', predicates = ['1', '2'];
    const core = [subject, ...predicates];
    assert.deepEqual(app.enabledTargets(q, []), [subject], id);
    assert.deepEqual(app.enabledTargets(q, [subject]), core, id);
    assert.deepEqual(app.enabledTargets(q, core.slice(0, -1)), core, id);
    assert.deepEqual(app.enabledTargets(q, core), [...core, ...complements], id);
    assert.deepEqual(app.enabledTargets(q, predicates), [subject], id);
  }
});

test('level three starts with the first spoken block and unlocks the rest in English order', () => {
  const q3 = data.examples.filter(q => q.level === 3);
  for (const q of q3) {
    const targets = app.targetsFor(q);
    const required = q.blocks.map((_, index) => app.expectedTarget(q, index));
    for (let i = 0; i < required.length; i++) {
      assert.deepEqual(app.enabledTargets(q, required.slice(0, i)), required.slice(0, i + 1), q.id);
      assert.deepEqual(app.enabledTargets(q, targets.filter(id => id !== required[i])), required.slice(0, i + 1), q.id);
    }
    assert.deepEqual(app.enabledTargets(q, required), required, q.id);

    const roles = targets.map(id => app.targetRole(q, id));
    if (!q.question) {
      assert.deepEqual(roles.slice(0, 2), ['there', 'be'], q.id);
    } else if (q.question.target === 'S') {
      assert.equal(roles[0], '疑問主部＝S', q.id);
      assert.ok(!roles.includes('S') && !roles.includes('疑問の支え'), q.id);
      assert.ok(app.isSupportRole(roles[1]), q.id);
      // Who keeps the statement order: supports (and いつも) first, then the predicate.
      assert.equal(roles.find((role, i) => i > 0 && !app.isSupportRole(role)), '述語', q.id);
    } else {
      if (q.question.spoken) assert.match(roles[0], /^疑問主部＝/u, q.id);
      else assert.equal(roles[0], 'question-marker', q.id);
      assert.ok(app.isSupportRole(roles[1]), q.id);
      assert.equal(roles[2], 'S', q.id);
    }
  }
});

test('only slots with cards can be enabled across the whole curriculum', () => {
  for (const q of data.examples) {
    const required = app.cardsFor(q).map((_, index) => app.expectedTarget(q, index));
    const filled = [];
    while (filled.length < required.length) {
      const enabled = app.enabledTargets(q, filled);
      assert.ok(enabled.every(id => required.includes(id)), q.id);
      const next = enabled.find(id => !filled.includes(id));
      assert.notEqual(next, undefined, q.id);
      filled.push(next);
    }
    assert.deepEqual(new Set(app.enabledTargets(q, app.targetsFor(q))), new Set(required), q.id);
  }
});

test('questions leave the seat of the moved support right after the subject', () => {
  const roles = q => app.targetsFor(q).map(target => app.targetRole(q, target));
  for (const q of data.examples) {
    const order = roles(q);
    const seat = app.seatAfter(order);
    if (q.level === 3 && q.question && q.question.target !== 'S') {
      assert.equal(order[seat], 'S', q.id);
      assert.ok(app.isSupportRole(order[seat - 1]), q.id);
    } else {
      // Statements, There and Who as the subject keep every support in place.
      assert.equal(seat, -1, q.id);
    }
  }
});

test('level three questions with two supports move only the first one', () => {
  const twoSupports = data.examples.filter(q => q.level === 3 &&
    q.blocks.filter(([role, en]) => en && ['助動詞', 'be'].includes(role)).length === 2);
  assert.equal(twoSupports.length, 10);
  assert.deepEqual(new Set(twoSupports.map(q => q.question.token)), new Set(['whether', 'why', 'where', 'when', 'who']));
  for (const q of twoSupports) {
    const order = app.targetsFor(q).map(target => app.targetRole(q, target));
    assert.deepEqual(q.blocks.find(([role]) => role === 'be'), ['be', 'be', 'である'], q.id);
    const be = order.indexOf('be');
    const start = q.question.target === 'S' ? order.indexOf('助動詞') : app.seatAfter(order);
    // Only いつも may come between the seat (or the unmoved modal) and be.
    assert.ok(order.slice(start + 1, be).every(role => role === '頻度'), q.id);
  }
  assert.ok(twoSupports.some(q => q.en === 'Can she always be happy at home?'));
});

test('multiple level two supports unlock in order and use the Level 1 label for be', () => {
  for (const [id, count] of [['level2-03', 2], ['level2-10', 3]]) {
    const q = get(id);
    const ordered = q.blocks.map((_, index) => String(index));
    assert.deepEqual(app.enabledTargets(q, []), ['0'], id);
    for (let i = 1; i <= count + 1; i++) {
      assert.deepEqual(app.enabledTargets(q, ordered.slice(0, i)), ordered.slice(0, i + 1), id);
    }
    assert.deepEqual(app.enabledTargets(q, ['0', ...ordered.slice(2)]), ['0', '1'], id);
    assert.deepEqual(app.enabledTargets(q, ordered.slice(0, count + 2)), ordered, id);
    assert.deepEqual(app.choicesFor(data, q, String(count)), ['である'], id);
    assert.deepEqual(q.blocks[count], ['be', 'be', 'である'], id);
  }
});

test('level two simple frequency sentences require silent support before the modifier', () => {
  for (const [id, frequency] of [['level2-07', 'よく'], ['level2-08', 'いつも'], ['level2-09', 'ときどき']]) {
    const q = get(id);
    assert.deepEqual(q.blocks[1], ['support', '', 'する'], id);
    assert.ok(app.choicesFor(data, q, '2').includes(frequency), id);
    assert.deepEqual(new Set(app.choicesFor(data, q, '1')), new Set(['する', 'した', 'です', 'だった']), id);
    assert.deepEqual(app.enabledTargets(q, ['0']), ['0', '1'], id);
    assert.deepEqual(app.enabledTargets(q, ['0', '1']), ['0', '1', '2'], id);
    assert.deepEqual(app.enabledTargets(q, ['0', '1', '2']), ['0', '1', '2', '3'], id);
    const answer = Object.fromEntries(q.blocks.map(([, , japanese], index) => [String(index), japanese]));
    assert.ok(app.choicesCorrect(q, answer), id);
    for (const alternative of ['', 'した', 'です', 'だった']) {
      assert.equal(app.choicesCorrect(q, { ...answer, 1: alternative }), false, id);
    }
  }
});

test('list practice accepts untouched unused slots while requiring every filled slot', () => {
  for (const q of data.examples.filter(q => q.level === 1)) {
    const picks = {};
    assert.equal(app.choicesCorrect(q, picks), false, q.id);
    for (const role of app.roles) {
      const options = app.choicesFor(data, q, role);
      if (q.slots[role].ja) assert.ok(options.includes(q.slots[role].ja), q.id + ' ' + role);
      assert.ok(!options.includes(''), q.id + ' no explicit empty option');
      assert.equal(new Set(options).size, options.length);
      if (q.slots[role].ja) picks[role] = q.slots[role].ja;
    }
    assert.equal(app.choicesCorrect(q, picks), true, q.id);
    const required = app.roles.find(role => q.slots[role].ja);
    delete picks[required];
    assert.equal(app.choicesCorrect(q, picks), false, q.id + ' unanswered required slot');
  }
  const q = get('build-go-1');
  const picks = Object.fromEntries(app.roles.filter(role => q.slots[role].ja).map(role => [role, q.slots[role].ja]));
  assert.equal(app.choicesCorrect(q, { ...picks, P2: 'シール' }), false);
  assert.equal(app.choicesCorrect(q, { ...picks, support: 'である' }), false);
});

test('the level one action support is required in Japanese and silent in English', () => {
  for (const [id, label] of [['build-go-1', 'する'], ['build-go-1-past', 'した']]) {
    const q = get(id);
    const cards = app.cardsFor(q);
    const support = cards.findIndex(card => card.role === 'support');
    assert.deepEqual(cards[support], { role: 'support', text: label, en: '' }, id);
    assert.ok(!q.blocks.some(([role]) => role === 'support'), id);
    const placements = cards.map((_, i) => app.expectedTarget(q, i));
    assert.equal(app.isCorrect(q, app.place(q, placements, support, '')), false, id);
    const withoutSupport = Object.fromEntries(app.roles.filter(role => role !== 'support' && q.slots[role].ja).map(role => [role, q.slots[role].ja]));
    assert.equal(app.choicesCorrect(q, withoutSupport), false, id);
    assert.ok(app.choicesCorrect(q, { ...withoutSupport, support: label }), id);
  }
});

test('level one past actions keep their Japanese predicate and use the natural English past form', () => {
  for (const q of data.examples.filter(q => q.level === 1 && q.meaning === 'past' && !q.slots.support.en)) {
    assert.deepEqual(q.slots.support, { ja: 'した', en: '' }, q.id);
    assert.equal(q.slots.predicate.ja, get(q.contrastFamily).slots.predicate.ja, q.id);
    const support = q.group === 'tense-pictures' ? ['する', 'した', 'である', 'であった', 'ことがある'] : ['する', 'した', 'である', 'であった'];
    assert.deepEqual(app.choicesFor(data, q, 'support'), support, q.id);
  }
  const q = get('build-eat-1-past');
  assert.deepEqual(q.slots.predicate, { ja: '食べる', en: 'ate' });
  assert.equal(q.en, 'He ate a rice ball at home yesterday.');
  assert.equal(get('build-be-noun-1-past').slots.support.en, 'was');
});

test('level one experience puts have in the support slot like be in the progressive', () => {
  const experiences = data.examples.filter(q => q.level === 1 && q.meaning === 'experience');
  assert.equal(experiences.length, 10);
  for (const q of experiences) {
    assert.deepEqual(q.slots.support, { ja: 'ことがある', en: 'have' }, q.id);
    assert.doesNotMatch(q.slots.predicate.ja, /ことがある$/u, q.id);
    assert.doesNotMatch(q.slots.predicate.en, /^have /, q.id);
    assert.ok(app.choicesFor(data, q, 'support').includes('ことがある'), q.id);
  }
  const q = get('tense-bicycle-experience');
  assert.deepEqual(q.slots.predicate, { ja: '乗った', en: 'ridden' });
  const picks = Object.fromEntries(app.roles.filter(role => q.slots[role].ja).map(role => [role, q.slots[role].ja]));
  assert.ok(app.choicesCorrect(q, picks));
  assert.equal(app.choicesCorrect(q, { ...picks, support: 'した' }), false);
  assert.ok(!app.choicesFor(data, get('build-go-1'), 'support').includes('ことがある'));
});

test('level one grades be in the support slot and rejects exchanging it with the predicate', () => {
  for (const id of ['build-be-noun-1', 'build-be-adjective-1-past', 'pronoun-independent-1', 'tense-bicycle-ongoing', 'build-come-1-ongoing']) {
    const q = get(id);
    const picks = Object.fromEntries(app.roles.filter(role => q.slots[role].ja).map(role => [role, q.slots[role].ja]));
    const cards = app.cardsFor(q);
    const targets = cards.map((_, i) => app.expectedTarget(q, i));
    assert.ok(app.choicesCorrect(q, picks), id);
    assert.equal(app.choicesCorrect(q, { ...picks, support: picks.predicate, predicate: picks.support }), false, id);
    assert.equal(app.choicesCorrect(q, { ...picks, support: '' }), false, id);
    assert.ok(app.isCorrect(q, targets), id);
    const beCard = cards.findIndex(card => card.role === 'support');
    assert.equal(app.isCorrect(q, app.place(q, targets, beCard, 'predicate')), false, id);
  }
});

test('level one progressive predicates keep the full Japanese expression with be in support', () => {
  for (const q of data.examples.filter(q => q.level === 1 && q.meaning === 'ongoing')) {
    assert.equal(q.slots.support.ja, 'である', q.id);
    assert.match(q.slots.support.en, /^(am|is|are)$/);
    assert.match(q.slots.predicate.ja, /[てで]いる$/u, q.id);
  }
  const q = get('build-eat-1-ongoing');
  assert.deepEqual(q.slots.predicate, { ja: '食べている', en: 'eating' });
  assert.ok(app.choicesFor(data, q, 'support').includes('する'));
  assert.ok(!app.choicesFor(data, q, 'support').some(text => text.includes('いる') || text.includes('途中')));
  assert.equal(get('build-come-1-ongoing').slots.predicate.ja, '来ている');
});

test('all level one predicate options use the form for that lesson, including the tense pictures', () => {
  for (const q of data.examples.filter(q => q.level === 1)) {
    const options = app.choicesFor(data, q, 'predicate');
    const card = app.cardsFor(q).find(part => part.role === 'predicate');
    assert.equal(options.length, 4, q.id);
    assert.equal(new Set(options).size, options.length, q.id);
    assert.ok(options.includes(card.text), q.id);
    assert.ok(!options.includes(q.slots.support.ja), q.id);
    for (const text of options) {
      assert.doesNotMatch(text, /(?:ます|です|ました|でした|ません|途中|ことがある|[。．.])$/u, q.id);
      if (q.meaning === 'ongoing') assert.match(text, /[てで]いる$/u, q.id);
      else if (q.meaning === 'experience') assert.match(text, /[ただ]$/u, q.id);
      else {
        assert.doesNotMatch(text, /(?:[てで]いる|[ただ])$/u, q.id);
        if (!q.slots.support.en) assert.match(text, /(?:[うくぐすつぬぶむる]|好き|ほしい)$/u, q.id);
      }
    }
  }
  for (const [id, label] of [
    ['build-go-1', '行く'], ['build-go-1-past', '行く'], ['build-study-1', '勉強する'],
    ['build-live-1', '住む'], ['build-wear-1', 'かぶる'], ['build-wear-2', '着る'],
    ['build-play-1', '遊ぶ'], ['build-play-1-ongoing', '遊んでいる'],
    ['build-ask-1', 'たずねる'], ['build-make-3', 'させる'],
    ['tense-rope-ongoing', '跳んでいる'], ['tense-rope-experience', '跳んだ'],
  ]) assert.equal(get(id).slots.predicate.ja, label, id);
});

test('advanced picture choices and cards use Japanese with an English counterpart', () => {
  for (const q of data.examples.filter(q => q.level > 1)) {
    const targets = q.blocks.map((_, index) => app.expectedTarget(q, index));
    const answer = Object.fromEntries(targets.map((target, i) => [target, q.blocks[i][2]]));
    assert.deepEqual(app.cardsFor(q).map(card => card.text), Object.values(answer), q.id);
    assert.deepEqual(app.cardsFor(q).map(card => card.en), q.blocks.map(([, en]) => en), q.id);
    for (const [index, target] of targets.entries()) {
      const options = app.choicesFor(data, q, target);
      assert.ok(options.includes(answer[target]), q.id);
      if (q.level === 2) {
        const [role] = q.blocks[index];
        const roleChoices = ['述語', '述語の残り'].includes(role)
          ? data.examples.filter(item => item.level === 2).flatMap(item =>
            item.blocks.filter(([category]) => role === category).map(([, , text]) => text))
          : Object.values(data.level2Choices[role]);
        const allowed = role === 'S' ? basicSubjects : roleChoices;
        assert.ok(options.every(text => text === answer[target] || allowed.includes(text)), q.id);
      } else if (q.question && index === 0) {
        const questionWords = {
          whether: 'かどうか', what: 'なに（何）', who: 'だれ（誰）', where: 'どこ（何処）',
          when: 'いつ（何時）', why: 'なぜ（何故）', which: 'どれ・どの', how: 'どうやって'
        };
        assert.equal(app.choiceLabel(q, target, answer[target]), questionWords[q.question.token], q.id);
        assert.deepEqual(options.map(value => app.choiceLabel(q, target, value)), Object.values(questionWords), q.id);
        const distractor = options.find(option => option !== answer[target]);
        assert.equal(app.choicesCorrect(q, { ...answer, [target]: distractor }), false, q.id);
      } else {
        const [role] = q.blocks[index];
        if (role === 'support' || role === '疑問の支え' || role === 'be') {
          const basic = app.choicesFor(data, get('build-go-1'), 'support');
          assert.deepEqual(options, [...new Set([...basic, answer[target]])], q.id);
        } else {
          const predicate = ['述語', '述語の残り'].includes(role);
          const sameRole = data.examples.filter(item => item.level === 3 || (predicate && item.level === 2)).flatMap(item =>
            item.blocks.filter(([category]) => category === role).map(([, , text]) => text));
          const expected = new Set([...sameRole, ...Object.values(data.level2Choices[role] ?? {})]);
          if (role === 'S') basicSubjects.forEach(text => expected.add(text));
          assert.ok(options.every(text => expected.has(text)), q.id);
        }
      }
      assert.equal(options.length, new Set(options).size, q.id);
      assert.ok(options.every(text => /[\u3040-\u30ff\u3400-\u9fff]/u.test(text) && !/[a-z]/i.test(text)), q.id);
      if (['述語', '述語の残り'].includes(q.blocks[index][0])) {
        assert.ok(options.every(text => !/[?？]|(?:です|ます|ません|でした|ました|でしょう)か$/u.test(text)), q.id);
      }
    }
    assert.ok(app.choicesCorrect(q, answer), q.id);
    assert.equal(app.choicesCorrect(q, { ...answer, 0: answer[1] }), false, q.id);
    delete answer[0];
    assert.equal(app.choicesCorrect(q, answer), false, q.id);
  }
});

test('regular predicate menus keep progressive, simple, and experience forms separate', () => {
  const predicateOptions = id => {
    const q = get(id);
    const target = q.level === 1 ? 'predicate' : String(q.blocks.findIndex(([role]) => role === '述語'));
    return app.choicesFor(data, q, target);
  };
  for (const id of ['build-eat-1', 'level2-04', 'level3-q-did-stay-3-past', 'level3-q-do-need-3']) {
    assert.ok(predicateOptions(id).every(text => !/[てで]い(?:る|ます)$/u.test(text)), id);
  }
  for (const id of ['level3-37', 'level2-might-ing-wash-1-ongoing']) {
    assert.ok(predicateOptions(id).every(text => /[てで]いる$/u.test(text)), id);
  }
  assert.ok(predicateOptions('level3-q-have-tense-bicycle-experience').every(text => /[ただ]$/u.test(text)));
  assert.ok(predicateOptions('level3-q-do-need-3').includes('要る'));
  assert.equal(get('level3-who-do-need-3').ja, '水が要るのはだれですか。');
});

test('every level two and three predicate choice follows the English construction', () => {
  for (const q of data.examples.filter(example => example.level > 1)) {
    const index = q.blocks.findIndex(([role]) => role === '述語' || role === '述語の残り');
    if (index < 0) {
      assert.equal(q.unit, 'there', q.id);
      continue;
    }
    const [role, english, correct] = q.blocks[index];
    const options = app.choicesFor(data, q, String(index));
    assert.equal(options.length, 4, q.id);
    assert.ok(options.includes(correct), q.id);
    const supports = q.blocks.filter(([r]) => app.isSupportRole(r)).map(([, en]) => en.toLowerCase());
    const perfect = supports.some(en => /^(?:have|has)(?: not)?$/.test(en));
    const be = supports.some(en => /^(?:am|is|are|was|were|be)(?: not)?$/.test(en));
    for (const label of options) {
      assert.doesNotMatch(label, /(?:です|ます|でした|ました|ません|途中|ことがある|[。．.])$|^(?:する|している)$/u, q.id);
      if (perfect) assert.match(label, /[ただ]$/u, q.id);
      else if (be && /^\w+ing\b/i.test(english)) assert.match(label, /[てで]いる$/u, q.id);
      else if (be || role === '述語の残り') assert.doesNotMatch(label, /[てで]いる$/u, q.id);
      else {
        assert.doesNotMatch(label, /[てで]いる$/u, q.id);
        assert.match(label, /(?:[うくぐすつぬぶむる]|好き|ほしい)$/u, q.id);
      }
    }
  }
  for (const [id, label] of [
    ['level2-not-live-2', '住む'], ['level2-not-wear-3', '着る'], ['level2-might-ing-ask-1-ongoing', 'たずねている'],
    ['level3-what-did-wear-3-past', '着る'], ['level3-when-do-wear-1', 'かぶる'],
    ['level3-where-did-ask-1-past', 'たずねる'], ['level3-q-ing-play-2-ongoing', '遊んでいる'],
  ]) assert.equal(get(id).blocks.find(([role]) => role === '述語')[2], label, id);
});

test('levels two and three keep all four complement slots and grade unused slots as empty', () => {
  const optionalRoles = ['P1', 'P2', '場所', '時'];
  for (const q of data.examples.filter(q => q.level > 1)) {
    const targets = app.targetsFor(q);
    assert.deepEqual(targets.slice(-4).map(id => app.targetRole(q, id)), optionalRoles, q.id);
    assert.equal(new Set(targets).size, targets.length, q.id);

    const placements = q.blocks.map((_, index) => app.expectedTarget(q, index));
    const answer = Object.fromEntries(q.blocks.map(([, , text], i) => [placements[i], text]));
    assert.ok(app.choicesCorrect(q, answer), q.id);
    assert.ok(app.isCorrect(q, placements), q.id);
    for (const [index, target] of targets.slice(-4).entries()) {
      const role = optionalRoles[index];
      if (target === role) {
        const options = app.choicesFor(data, q, target);
        assert.ok(options.length > 0 && options.length <= 4, q.id);
        if (q.level === 2) assert.ok(options.every(text => Object.values(data.level2Choices[role]).includes(text)), q.id);
        assert.equal(app.choicesCorrect(q, { ...answer, [target]: options[0] }), false, q.id);
        assert.equal(app.isCorrect(q, app.place(q, placements, 0, target)), false, q.id);
      } else {
        assert.equal(app.choicesCorrect(q, { ...answer, [target]: '' }), false, q.id);
        assert.equal(app.isCorrect(q, app.place(q, placements, Number(target), '')), false, q.id);
      }
    }
  }
});

test('the strawberry question starts with a silent question block followed by do support', () => {
  const q = get('level3-01');
  assert.deepEqual(app.cardsFor(q).map(card => card.text), ['かどうか', 'する', 'あなた', '好き', 'いちご']);
  assert.deepEqual(app.targetsFor(q), ['0', '1', '2', '3', '4', 'P2', '場所', '時']);
  assert.deepEqual(app.choicesFor(data, q, '1'), ['する', 'した', 'である', 'であった']);
});

test('level three modal questions use the same choices and labels as level two', () => {
  for (const q of data.examples.filter(q => q.level === 3 && q.blocks[1][0] === '助動詞')) {
    const [, english, correct] = q.blocks[1];
    const choices = data.level2Choices['助動詞'];
    assert.equal(correct, choices[english.toLowerCase()], q.id);
    assert.deepEqual(new Set(app.choicesFor(data, q, '1')), new Set(Object.values(choices)), q.id);
  }
});

test('level two modal choices include the meaning labels and exclude other parts of the sentence', () => {
  const q = get('level2-01');
  assert.deepEqual(new Set(app.choicesFor(data, q, '1')), new Set([
    '〜できる（可能だと言える）',
    '〜しなければならない（必要だと言える）', '〜したほうがいい（そう考えるのが自然）',
    '〜するかもしれない（言い切れないが、ありえる）',
  ]));
  assert.ok(!app.choicesFor(data, q, '1').includes('自転車'));
  assert.ok(app.choicesFor(data, get('level2-07'), '2').includes('ときどき'));

  const conditional = { ...q, blocks: q.blocks.map(block => [...block]) };
  conditional.blocks[1][2] = '条件しだいで大丈夫（可能だと言える）';
  const conditionalChoices = app.choicesFor(data, conditional, '1');
  assert.ok(conditionalChoices.includes(conditional.blocks[1][2]));
  assert.ok(!conditionalChoices.includes(q.blocks[1][2]));
});

test('level two begins with the four degree modals before negative and frequency exercises', () => {
  const lessons = data.examples.filter(q => q.level === 2);
  assert.deepEqual([...new Set(lessons.map(q => q.unit))],
    ['degree', 'not-routine', 'not-past', 'not-ongoing', 'not-state', 'not-experience', 'frequency']);
  assert.deepEqual([...new Set(data.examples.filter(q => q.level === 3).map(q => q.unit))],
    ['whether', 'what', 'who', 'where', 'when', 'which', 'why', 'how', 'there']);
  assert.ok(Object.keys(data.units).every(unit => data.units[unit]));
  assert.deepEqual(new Set(lessons.filter(q => q.unit === 'degree').map(q => q.blocks[1][1])),
    new Set(['can', 'might', 'must', 'should']));
  assert.deepEqual(Object.keys(data.level2Choices['助動詞']).sort(), ['can', 'might', 'must', 'should']);
  assert.deepEqual(Object.keys(data.level2Choices['助動詞＋否定']).sort(), ['cannot', 'might not']);
});

test('placing onto an occupied slot returns the previous card to the pool', () => {
  const q = get('build-give-1');
  let placements = app.place(q, [], 0, 'S');
  placements = app.place(q, placements, 1, 'S');
  assert.equal(placements[0], '');
  assert.equal(placements[1], 'S');
  assert.equal(app.place(q, placements, 1, '')[1], '');
  assert.deepEqual(app.place(q, placements, 99, 'S'), placements);
});

test('subject and object who use the same starting label and retain their different order', () => {
  assert.deepEqual(app.cardsFor(get('level3-06')).slice(0, 3).map(c => [c.text, c.en]), [['だれ（誰）', 'Who'], ['する', ''], ['くれる', 'gives']]);
  assert.deepEqual(app.cardsFor(get('level3-09')).slice(0, 3).map(c => [c.text, c.en]), [['だれ（誰）', 'Who'], ['する', 'do'], ['あなた', 'you']]);
  for (const q of data.examples.filter(q => q.level === 3)) {
    assert.ok(app.cardsFor(q).every(c => !/whether/i.test(c.en)));
    assert.equal(new Set(app.shuffledIndices(q)).size, q.blocks.length);
  }
});

test('removed negative questions are absent and their saved progress is safely ignored', () => {
  const removed = ['level3-11', 'level3-12', 'level3-13', 'level3-14'];
  assert.ok(removed.every(id => !get(id)));
  const restored = app.restore(data, { version: 1, current: removed[0], level: 3, completed: [...removed, 'level3-06'] });
  assert.ok(get(restored.current));
  assert.deepEqual(restored.completed, ['level3-06']);
});

test('why, which and how questions place the full question phrase before the support', () => {
  const exercises = [
    ['level3-15', 'why', ['Why', 'are', 'you', 'happy']],
    ['level3-16', 'which', ['Which book', 'do', 'you', 'want']],
    ['level3-17', 'how', ['How', 'do', 'you', 'make', 'a paper hat']],
  ];
  for (const [id, token, parts] of exercises) {
    const q = get(id);
    const cards = app.cardsFor(q);
    assert.equal(q.question.token, token, id);
    assert.deepEqual(cards.map(card => card.en), parts, id);
    assert.ok(app.isSupportRole(cards[1].role), id);
    const answer = Object.fromEntries(cards.map((card, index) => [String(index), card.text]));
    assert.equal(app.choicesCorrect(q, { ...answer, 0: answer[1] }), false, id);
    assert.ok(app.choicesCorrect(q, answer), id);
  }
});

test('level three picture choices keep likes distinct from wanting something', () => {
  for (const id of ['level3-16', 'level3-33', 'level3-01']) {
    const q = get(id);
    const index = q.blocks.findIndex(([role]) => role === '述語');
    const correct = q.blocks[index][2];
    const options = app.choicesFor(data, q, String(index));
    assert.equal(options.length, 4, id);
    assert.ok(options.includes(correct), id);
    assert.equal(options.includes('好き'), correct === '好き', id);
  }
});

test('level three statements put There first and be before the thing introduced', () => {
  const exercises = [
    ['level3-18', ['There', 'is', 'a cat']],
    ['level3-19', ['There', 'are', 'two birds', 'in the tree']],
  ];
  for (const [id, parts] of exercises) {
    const q = get(id);
    const cards = app.cardsFor(q);
    assert.equal(q.question, undefined, id);
    assert.deepEqual(cards.map(card => card.en), parts, id);
    assert.deepEqual(cards.slice(0, 2).map(card => card.text), ['ほら', 'いる'], id);
    const picks = Object.fromEntries(cards.map((card, index) => [String(index), card.text]));
    assert.ok(app.choicesCorrect(q, picks), id);
    assert.deepEqual(app.wrongCardTargets(q, ['2', '1', '0', ...Object.keys(picks).slice(3)]), ['0', '2'], id);
  }
});

test('navigation includes all examples from the selected level', () => {
  const filters = { level: 1, group: 'all', search: '' };
  assert.equal(app.visibleExamples(data, filters).length, data.counts.level1);
  assert.equal(app.visibleExamples(data, { ...filters, level: 2 }).length, data.counts.level2);
  assert.equal(app.visibleExamples(data, { ...filters, level: 3 }).length, data.counts.level3);
  assert.equal(app.visibleExamples(data, { ...filters, group: 'go' }).length, 9);
  assert.equal(app.visibleExamples(data, { ...filters, search: 'not-a-real-sentence' }).length, 0);
});

test('selected levels are combined even with a legacy pronoun filter', () => {
  const filters = { levels: [1, 3], group: 'all', scope: 'pronouns', search: '' };
  const mixed = app.visibleExamples(data, filters);
  assert.equal(mixed.filter(q => q.level === 1).length, data.counts.level1);
  assert.equal(mixed.filter(q => q.level === 3).length, data.counts.level3);
  assert.deepEqual(app.visibleExamples(data, { ...filters, levels: [] }), []);
});

test('progress uses stable IDs and ignores legacy, stale, and duplicate completions', () => {
  assert.deepEqual(app.restore(data, { version: 1, answers: [], pictureDone: [true] }).completed, []);
  const restored = app.restore(data, { version: 1, current: 'level3-06', level: 3, group: 'invalid', scope: 'extension', completed: ['level3-06', 'deleted', 'level3-06'] });
  assert.deepEqual(restored.completed, ['level3-06']);
  assert.equal(restored.current, 'level3-06');
  assert.equal(restored.group, 'go');
  assert.ok(!Object.hasOwn(restored, 'scope'));
  assert.equal(app.restore(data, { version: 999 }).completed.length, 0);
});

test('level guides are remembered per level and old saves can start them', () => {
  assert.deepEqual(app.restore(data, { version: 1, completed: ['build-go-1'] }).seenGuides, []);
  assert.deepEqual(app.restore(data, { version: 1, seenGuides: [3, 1, 3, 9, '2'] }).seenGuides, [1, 3]);
});

test('next-scene navigation starts from the current tense variant', () => {
  const visible = app.visibleExamples(data, { level: 1, group: 'go', search: '' });
  const index = app.navigationIndex(visible, get('build-go-1-past'));
  assert.equal(visible[index].id, 'build-go-1-past');
  assert.equal(visible[index + 1].id, 'build-go-2');
  assert.equal(app.navigationIndex([], get('build-go-1')), -1);
});

test('mini sets partition the selected levels and scene themes into short ordered practices', () => {
  const filters = { levels: [1, 2, 3], group: 'all', search: '' };
  assert.equal(new Set(data.themes.map(theme => theme.id)).size, data.themes.length);
  assert.ok(data.themes.every(theme => !/代名詞|時制|倒置|助動詞/.test(theme.label)));
  for (const options of [filters, { ...filters, levels: [1] }]) {
    const visible = app.visibleExamples(data, options);
    const themes = data.themes.map(theme => app.sceneExamples(visible, theme.id));
    assert.deepEqual(themes.flat().map(q => q.id).sort(), visible.map(q => q.id).sort());
    for (const lessons of [...themes, app.sceneExamples(visible, 'all')]) {
      const sets = app.practiceSets(lessons);
      assert.deepEqual(sets.flat(), lessons);
      assert.ok(sets.every(set => set.length >= Math.min(5, lessons.length) && set.length <= 10));
    }
  }
  const foodAtLevel3 = app.sceneExamples(app.visibleExamples(data, { ...filters, levels: [3] }), 'theme-eat');
  assert.ok(['level3-01', 'level3-30'].every(id => foodAtLevel3.some(q => q.id === id)));
  assert.ok(foodAtLevel3.every(q => q.level === 3 && q.theme === 'theme-eat'));
  const paperHat = [get('build-make-1'), get('level2-12'), get('level3-17')];
  assert.deepEqual(app.sceneExamples(paperHat, 'theme-like'), paperHat);
  assert.equal(get('pronoun-reflexive-1').theme, get('tense-paint').theme);
});

test('the position bar and lesson list follow the same filters across set boundaries', () => {
  const filters = { levels: [1, 3], group: 'all', search: '', sceneTheme: 'theme-eat', courseView: 'mini' };
  const mini = app.practiceCourse(data, filters);
  const current = mini.sets[1][0];
  const visible = app.visibleExamples(data, filters);
  assert.deepEqual(mini.eligible, app.sceneExamples(visible, filters.sceneTheme));
  assert.deepEqual(app.coursePosition(mini, current), { lessons: mini.sets[1], setIndex: 1, index: 0 });

  const all = app.practiceCourse(data, { ...filters, courseView: 'all' });
  assert.deepEqual(app.coursePosition(all, current), { lessons: visible, setIndex: 1, index: visible.indexOf(current) });
  const empty = app.practiceCourse(data, { ...filters, levels: [] });
  assert.deepEqual(app.coursePosition(empty, current), { lessons: [], setIndex: 0, index: -1 });
});

test('English review uses only spoken blocks and grades their sentence order', () => {
  for (const q of data.examples) {
    const review = app.englishReview(q);
    const cards = app.cardsFor(review);
    assert.notEqual(q.id, review.id);
    assert.ok(cards.every(card => card.en && card.en === card.text), q.id);
    assert.equal(cards.map(card => card.en).join(' ') + (q.question ? '?' : '.'), q.en, q.id);
    const correct = app.targetsFor(review);
    assert.ok(app.isCorrect(review, correct), q.id);
    assert.equal(app.isCorrect(review, correct.slice(1)), false, q.id);
    assert.equal(app.isCorrect(review, correct.slice().reverse()), false, q.id);
  }
});

test('yes-or-no questions mark the speaker and other questions mark the unknown in the art', () => {
  const { images } = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/construction-illustrations.json'), 'utf8'));
  for (const q of data.examples) {
    assert.ok(images[q.id], q.id);
    const { questionMark: mark, questionMarkInArt } = images[q.id] ?? {};
    if (q.question?.token === 'whether') {
      assert.equal(mark?.length, 2, q.id);
      assert.ok(mark.every(value => Number.isFinite(value) && value > 0 && value < 100), q.id);
      assert.equal(questionMarkInArt, undefined, q.id);
    } else if (q.question) {
      assert.equal(questionMarkInArt, true, q.id);
      assert.equal(mark, undefined, q.id);
      assert.equal(images[q.id].clue, '', q.id);
      assert.ok(!q.pictureHint, q.id);
    } else {
      assert.equal(mark, undefined, q.id);
      assert.equal(questionMarkInArt, undefined, q.id);
    }
  }
});

test('picture details distinguish opposing actions and preserve the unknown in questions', () => {
  const { images, details } = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/construction-illustrations.json'), 'utf8'));
  for (const [id, entry] of Object.entries(images)) {
    if (!entry.detail) continue;
    const detail = details[entry.detail];
    assert.ok(detail?.label && detail.alt, id);
    assert.ok(detail.file ? fs.existsSync(path.join(__dirname, '..', detail.file)) : detail.text, id);
    assert.ok(!entry.detailSide || ['left', 'right'].includes(entry.detailSide), id);
  }
  for (const suffix of ['', '-past', '-ongoing']) {
    assert.equal(images['build-open-2' + suffix].detail, 'open-book');
    assert.equal(images['build-close-1' + suffix].detail, 'close-book');
  }
  assert.equal(images['level3-what-did-start-2-past'].detail, 'first-step');
  assert.equal(images['level3-what-ing-taste-1-ongoing'].detail, 'taste-unknown');
  assert.equal(images['level3-who-ing-teach-1-ongoing'].detail, 'teach-game-hands');
  assert.notEqual(images['level2-17'].file, images['level2-05'].file);
  assert.equal(images['level2-17'].speakerPose, undefined);
  for (const [id, count] of [['level2-07', 5], ['level2-08', 8], ['level2-09', 3]]) {
    assert.match(images[id].frequencyPattern, /^[01]{8}$/);
    assert.equal([...images[id].frequencyPattern].filter(cell => cell === '1').length, count);
  }
});

test('the local-file page embeds the current curriculum and app source', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const match = html.match(/<script id="curriculum" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match);
  assert.deepEqual(JSON.parse(match[1]), {
    ...data,
    examples: data.examples.map(({ pictureHint, ...example }) => example),
  });
  const page = html.replace(/\r\n/g, '\n');
  for (const file of ['construction-practice.js', 'construction-ui.js', 'construction.css']) {
    const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
    assert.ok(page.includes(source.replace(/\r\n/g, '\n')), file);
  }
  assert.ok(!html.includes('__CONSTRUCTION_'));
  assert.doesNotMatch(html, /sceneClue|scene-clue|imageClue/);
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/construction-illustrations.json'), 'utf8'));
  const embeddedImages = html.match(/<script id="illustrations" type="application\/json">([\s\S]*?)<\/script>/);
  assert.deepEqual(JSON.parse(embeddedImages[1]), {
    ...manifest,
    images: Object.fromEntries(Object.entries(manifest.images).map(([id, { clue, ...image }]) => [id, image])),
  });
  assert.ok(Object.keys(manifest.images).length >= 4);
  for (const [id, illustration] of Object.entries(manifest.images)) {
    assert.ok(get(id), id);
    assert.ok(illustration.alt);
    assert.equal(typeof illustration.clue, 'string');
    const bytes = fs.readFileSync(path.join(__dirname, '..', illustration.file));
    let width, height;
    if (illustration.file.endsWith('.webp')) {
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', id);
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', id);
      const encoding = bytes.toString('ascii', 12, 16);
      if (encoding === 'VP8X') {
        width = 1 + bytes.readUIntLE(24, 3);
        height = 1 + bytes.readUIntLE(27, 3);
      } else {
        assert.equal(encoding, 'VP8 ', id);
        assert.deepEqual([...bytes.subarray(23, 26)], [0x9d, 0x01, 0x2a], id);
        width = bytes.readUInt16LE(26) & 0x3fff;
        height = bytes.readUInt16LE(28) & 0x3fff;
      }
    } else {
      assert.equal(bytes.toString('ascii', 1, 4), 'PNG', id);
      width = bytes.readUInt32BE(16);
      height = bytes.readUInt32BE(20);
    }
    assert.ok(width >= 512 && height >= 512, id);
  }
});
