'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = require('../src/construction-practice.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/construction-examples.json'), 'utf8'));
const get = id => data.examples.find(q => q.id === id);

test('all curriculum exercises can be completed by moving cards into their intended targets', () => {
  for (const q of data.examples) {
    const cards = app.cardsFor(q);
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

test('subject unlocks predicate and both unlock every remaining slot', () => {
  const q = get('build-go-1');
  assert.deepEqual(app.enabledTargets(q, []), ['S']);
  const core = ['S', 'support', 'predicate'];
  assert.deepEqual(app.enabledTargets(q, ['S']), core);
  assert.deepEqual(app.enabledTargets(q, ['S', 'predicate']), core);
  assert.deepEqual(app.enabledTargets(q, core), app.roles);
  assert.deepEqual(app.enabledTargets(q, ['predicate']), ['S']);
  const be = get('build-be-noun-1');
  assert.deepEqual(app.enabledTargets(be, ['S', 'predicate']), core);
  assert.deepEqual(app.enabledTargets(be, ['S', 'support']), core);
  assert.deepEqual(app.enabledTargets(be, core), app.roles);
});

test('level two unlocks by grammatical role and relocks after clearing a prerequisite', () => {
  const cases = [
    ['level2-01', '0', ['1', '2']],
    ['level2-06', '0', ['1', '2']],
  ];
  for (const [id, subject, predicates] of cases) {
    const q = get(id);
    const core = [subject, ...predicates];
    assert.deepEqual(app.enabledTargets(q, []), [subject], id);
    assert.deepEqual(app.enabledTargets(q, [subject]), core, id);
    assert.deepEqual(app.enabledTargets(q, core.slice(0, -1)), core, id);
    assert.deepEqual(app.enabledTargets(q, core), app.targetsFor(q), id);
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
    assert.deepEqual(app.enabledTargets(q, required), targets, q.id);

    const roles = targets.map(id => app.targetRole(q, id));
    if (!q.question) {
      assert.deepEqual(roles.slice(0, 2), ['there', 'be'], q.id);
    } else if (q.question.target === 'S') {
      assert.equal(roles[0], '疑問主部＝S', q.id);
      assert.ok(!roles.includes('S') && !roles.includes('疑問の支え'), q.id);
      assert.ok(app.isSupportRole(roles[1]), q.id);
      assert.equal(roles[2], '述語', q.id);
    } else {
      if (q.question.spoken) assert.match(roles[0], /^疑問主部＝/u, q.id);
      else assert.equal(roles[0], 'question-marker', q.id);
      assert.ok(app.isSupportRole(roles[1]), q.id);
      assert.equal(roles[2], 'S', q.id);
    }
  }
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
    assert.deepEqual(app.enabledTargets(q, ordered.slice(0, count + 2)), app.targetsFor(q), id);
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
  assert.equal(app.choicesCorrect(q, { ...picks, P2: 'シールを' }), false);
  assert.equal(app.choicesCorrect(q, { ...picks, support: 'である' }), false);
});

test('the level one action support is required in Japanese and silent in English', () => {
  for (const [id, label] of [['build-go-1', 'する'], ['build-go-1-past', 'した'], ['tense-bicycle-experience', 'する']]) {
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
    assert.deepEqual(app.choicesFor(data, q, 'support'), ['する', 'した', 'である', 'であった'], q.id);
  }
  const q = get('build-eat-1-past');
  assert.deepEqual(q.slots.predicate, { ja: '食べます', en: 'ate' });
  assert.equal(q.en, 'He ate a rice ball at home yesterday.');
  assert.equal(get('build-be-noun-1-past').slots.support.en, 'was');
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
    assert.match(q.slots.predicate.ja, /(?:いる|途中)$/, q.id);
  }
  const q = get('build-eat-1-ongoing');
  assert.deepEqual(q.slots.predicate, { ja: '食べている', en: 'eating' });
  assert.ok(app.choicesFor(data, q, 'support').includes('する'));
  assert.ok(!app.choicesFor(data, q, 'support').some(text => text.includes('いる') || text.includes('途中')));
  assert.equal(get('build-come-1-ongoing').slots.predicate.ja, '来る途中');
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
        const roleChoices = Object.values(data.level2Choices[role]);
        assert.ok(options.every(text => text === answer[target] || roleChoices.includes(text)), q.id);
      } else if (q.question && index === 0) {
        const questionWords = {
          whether: 'かどうか', what: 'なに（何）', who: 'だれ（誰）', where: 'どこ（何処）',
          when: 'いつ（何時）', why: 'なぜ（何故）', which: 'どれ', how: 'どうやって'
        };
        if (q.question.token === 'which') {
          const phrases = { 'Which book': 'どの本', 'Which umbrella': 'どの傘', 'Which bus': 'どのバス' };
          questionWords.which = phrases[q.blocks[index][1]] ?? questionWords.which;
        }
        assert.equal(answer[target], questionWords[q.question.token], q.id);
        assert.deepEqual(new Set(options), new Set(Object.values(questionWords)), q.id);
        const distractor = options.find(option => option !== answer[target]);
        assert.equal(app.choicesCorrect(q, { ...answer, [target]: distractor }), false, q.id);
      } else {
        const [role] = q.blocks[index];
        if (role === 'support' || role === '疑問の支え' || role === 'be') {
          const basic = app.choicesFor(data, get('build-go-1'), 'support');
          assert.deepEqual(options, [...new Set([...basic, answer[target]])], q.id);
        } else {
          const sameRole = data.examples.filter(item => item.level === 3).flatMap(item =>
            item.blocks.filter(([category]) => category === role).map(([, , text]) => text));
          const expected = new Set([...sameRole, ...Object.values(data.level2Choices[role] ?? {})]);
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
        assert.ok(options.length > 0, q.id);
        if (q.level === 2) assert.deepEqual(new Set(options), new Set(Object.values(data.level2Choices[role])), q.id);
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
  assert.deepEqual(app.cardsFor(q).map(card => card.text), ['かどうか', 'する', 'あなたは', '好き', 'いちごが']);
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
  assert.ok(!app.choicesFor(data, q, '1').includes('自転車に'));
  assert.ok(app.choicesFor(data, get('level2-07'), '2').includes('ときどき'));

  const conditional = { ...q, blocks: q.blocks.map(block => [...block]) };
  conditional.blocks[1][2] = '条件しだいで大丈夫（可能だと言える）';
  const conditionalChoices = app.choicesFor(data, conditional, '1');
  assert.ok(conditionalChoices.includes(conditional.blocks[1][2]));
  assert.ok(!conditionalChoices.includes(q.blocks[1][2]));
});

test('level two begins with the four degree modals before negative and frequency exercises', () => {
  const lessons = data.examples.filter(q => q.level === 2);
  assert.deepEqual([...new Set(lessons.map(q => q.unit))], ['degree', 'patterns']);
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
  assert.deepEqual(app.cardsFor(get('level3-09')).slice(0, 3).map(c => [c.text, c.en]), [['だれ（誰）', 'Who'], ['する', 'do'], ['あなたは', 'you']]);
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

test('basic-first navigation separates contrasts, pronouns, and advanced reflexives', () => {
  const filters = { level: 1, group: 'all', scope: 'core', search: '' };
  assert.equal(app.visibleExamples(data, filters).length, 313);
  assert.equal(app.visibleExamples(data, { ...filters, scope: 'all' }).length, 924);
  assert.equal(app.visibleExamples(data, { ...filters, scope: 'pronouns' }).length, 31);
  assert.equal(app.visibleExamples(data, { ...filters, scope: 'extension' }).length, 8);
  assert.equal(app.visibleExamples(data, { ...filters, level: 2 }).length, data.counts.level2);
  assert.equal(app.visibleExamples(data, { ...filters, level: 3 }).length, data.counts.level3);
  assert.equal(app.visibleExamples(data, { ...filters, group: 'go' }).length, 3);
  assert.equal(app.visibleExamples(data, { ...filters, search: 'not-a-real-sentence' }).length, 0);
});

test('selected levels are combined and the scope applies only to level 1', () => {
  const filters = { levels: [1, 3], group: 'all', scope: 'pronouns', search: '' };
  const mixed = app.visibleExamples(data, filters);
  assert.equal(mixed.length, 31 + data.counts.level3);
  assert.equal(mixed.filter(q => q.level === 1 && q.pronounFocus).length, 31);
  assert.equal(mixed.filter(q => q.level === 3).length, data.counts.level3);
  assert.deepEqual(app.visibleExamples(data, { ...filters, levels: [] }), []);
});

test('progress uses stable IDs and ignores legacy, stale, and duplicate completions', () => {
  assert.deepEqual(app.restore(data, { version: 1, answers: [], pictureDone: [true] }).completed, []);
  const restored = app.restore(data, { version: 1, current: 'level3-06', level: 3, group: 'invalid', scope: 'invalid', completed: ['level3-06', 'deleted', 'level3-06'] });
  assert.deepEqual(restored.completed, ['level3-06']);
  assert.equal(restored.current, 'level3-06');
  assert.equal(restored.group, 'go');
  assert.equal(restored.scope, 'core');
  assert.equal(app.restore(data, { version: 999 }).completed.length, 0);
});

test('level guides are remembered per level and old saves can start them', () => {
  assert.deepEqual(app.restore(data, { version: 1, completed: ['build-go-1'] }).seenGuides, []);
  assert.deepEqual(app.restore(data, { version: 1, seenGuides: [3, 1, 3, 9, '2'] }).seenGuides, [1, 3]);
});

test('the next-scene navigation stays in the core list after opening a contrast', () => {
  const visible = app.visibleExamples(data, { level: 1, group: 'go', scope: 'core', search: '' });
  const index = app.navigationIndex(visible, get('build-go-1-past'));
  assert.equal(visible[index].id, 'build-go-1');
  assert.equal(visible[index + 1].id, 'build-go-2');
  assert.equal(app.navigationIndex([], get('build-go-1')), -1);
});

test('mini sets partition the selected levels and scene themes into short ordered practices', () => {
  const filters = { levels: [1, 2, 3], group: 'all', scope: 'all', search: '' };
  assert.equal(new Set(data.themes.map(theme => theme.id)).size, data.themes.length);
  assert.ok(data.themes.every(theme => !/代名詞|時制|倒置|助動詞/.test(theme.label)));
  for (const options of [filters, { ...filters, scope: 'core' }, { ...filters, levels: [1], scope: 'extension' }]) {
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
  assert.deepEqual(foodAtLevel3.map(q => q.id), ['level3-01', 'level3-30']);
  const paperHat = [get('build-make-1'), get('level2-12'), get('level3-17')];
  assert.deepEqual(app.sceneExamples(paperHat, 'theme-like'), paperHat);
  assert.equal(get('pronoun-reflexive-1').theme, get('tense-paint').theme);
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

test('the local-file page embeds the current curriculum and app source', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const match = html.match(/<script id="curriculum" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match);
  assert.deepEqual(JSON.parse(match[1]), {
    ...data,
    examples: data.examples.map(({ pictureHint, ...example }) => example),
  });
  assert.ok(html.replace(/\r\n/g, '\n').includes(fs.readFileSync(path.join(__dirname, '../src/construction-practice.js'), 'utf8').replace(/\r\n/g, '\n')));
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
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.ok(bytes.readUInt32BE(16) >= 512);
    assert.ok(bytes.readUInt32BE(20) >= 512);
  }
});
