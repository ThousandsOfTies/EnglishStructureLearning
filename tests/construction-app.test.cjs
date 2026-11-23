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

test('advanced exercises unlock by grammatical role and relock after clearing a prerequisite', () => {
  const cases = [
    ['level2-01', '0', ['1', '2']],
    ['level2-06', '0', ['1', '2']],
    ['level2-07', '0', ['2']],
    ['level2-10', '0', ['1', '3', '4']],
    ['level3-03', '1', ['0', '2']],
    ['level3-06', '0', ['1']],
    ['level3-07', '2', ['1', '3']],
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
  for (const id of ['build-go-1', 'build-go-1-past', 'tense-bicycle-experience']) {
    const q = get(id);
    const cards = app.cardsFor(q);
    const support = cards.findIndex(card => card.role === 'support');
    assert.deepEqual(cards[support], { role: 'support', text: 'する', en: '' }, id);
    assert.ok(!q.blocks.some(([role]) => role === 'support'), id);
    const placements = cards.map((_, i) => app.expectedTarget(q, i));
    assert.equal(app.isCorrect(q, app.place(q, placements, support, '')), false, id);
    const withoutSupport = Object.fromEntries(app.roles.filter(role => role !== 'support' && q.slots[role].ja).map(role => [role, q.slots[role].ja]));
    assert.equal(app.choicesCorrect(q, withoutSupport), false, id);
    assert.ok(app.choicesCorrect(q, { ...withoutSupport, support: 'する' }), id);
  }
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
      } else if (q.blocks[index][0].startsWith('疑問詞＝')) {
        const questionWords = {
          what: '何を', who: 'だれが', where: 'どこで', when: 'いつ',
          why: 'なぜ', which: 'どれを', how: 'どうやって'
        };
        questionWords[q.question.token] = answer[target];
        assert.deepEqual(new Set(options), new Set(Object.values(questionWords)), q.id);
        const distractor = options.find(option => option !== answer[target]);
        assert.equal(app.choicesCorrect(q, { ...answer, [target]: distractor }), false, q.id);
      } else {
        const remaining = q.blocks.filter(([role]) => !role.startsWith('疑問詞＝')).map(([, , text]) => text);
        assert.deepEqual(new Set(options), new Set(remaining), q.id);
      }
      assert.equal(options.length, new Set(options).size, q.id);
      assert.ok(options.every(text => /[\u3040-\u30ff\u3400-\u9fff]/u.test(text) && !/[a-z]/i.test(text)), q.id);
    }
    assert.ok(app.choicesCorrect(q, answer), q.id);
    assert.equal(app.choicesCorrect(q, { ...answer, 0: answer[1] }), false, q.id);
    delete answer[0];
    assert.equal(app.choicesCorrect(q, answer), false, q.id);
  }
});

test('every level two exercise has one second object slot, which is empty when unused', () => {
  for (const q of data.examples.filter(q => q.level === 2)) {
    const targets = app.targetsFor(q);
    const secondObjects = targets.filter(id => app.targetRole(q, id) === 'P2');
    assert.equal(secondObjects.length, 1, q.id);
    const [secondObject] = secondObjects;
    const firstObject = targets.find(id => app.targetRole(q, id) === 'P1');
    if (firstObject) assert.equal(targets.indexOf(secondObject), targets.indexOf(firstObject) + 1, q.id);

    const placements = q.blocks.map((_, index) => app.expectedTarget(q, index));
    const answer = Object.fromEntries(q.blocks.map(([, , text], i) => [placements[i], text]));
    assert.ok(app.choicesCorrect(q, answer), q.id);
    assert.ok(app.isCorrect(q, placements), q.id);
    if (secondObject === 'P2') {
      const options = app.choicesFor(data, q, secondObject);
      assert.deepEqual(new Set(options), new Set(Object.values(data.level2Choices.P2)), q.id);
      assert.equal(app.choicesCorrect(q, { ...answer, P2: options[0] }), false, q.id);
      assert.equal(app.isCorrect(q, app.place(q, placements, 0, secondObject)), false, q.id);
    } else {
      assert.equal(answer[secondObject], '花を', q.id);
      delete answer[secondObject];
      assert.equal(app.choicesCorrect(q, answer), false, q.id);
      assert.equal(app.isCorrect(q, app.place(q, placements, Number(secondObject), '')), false, q.id);
    }
  }
});

test('level two modal choices include the meaning labels and exclude other parts of the sentence', () => {
  const q = get('level2-01');
  assert.deepEqual(new Set(app.choicesFor(data, q, '1')), new Set([
    '〜できる（可能だと言える）', '〜するつもり（そうなると言い切る）',
    '〜しなければならない（必要だと言える）', '〜したほうがいい（そう考えるのが自然）',
    '〜するかもしれない（言い切れないが、ありえる）',
  ]));
  assert.ok(!app.choicesFor(data, q, '1').includes('自転車に'));
  assert.ok(app.choicesFor(data, get('level2-07'), '1').includes('よく'));
  assert.ok(app.choicesFor(data, get('level2-07'), '1').includes('ときどき'));

  const conditional = { ...q, blocks: q.blocks.map(block => [...block]) };
  conditional.blocks[1][2] = '条件しだいで大丈夫（可能だと言える）';
  const conditionalChoices = app.choicesFor(data, conditional, '1');
  assert.ok(conditionalChoices.includes(conditional.blocks[1][2]));
  assert.ok(!conditionalChoices.includes(q.blocks[1][2]));
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

test('subject and object who retain their order and silent whether is never a card', () => {
  assert.deepEqual(app.cardsFor(get('level3-06')).slice(0, 2).map(c => [c.text, c.en]), [['だれが', 'Who'], ['くれますか', 'gives']]);
  assert.deepEqual(app.cardsFor(get('level3-09')).slice(0, 3).map(c => [c.text, c.en]), [['だれに', 'Who'], ['〜しますか', 'do'], ['あなたは', 'you']]);
  for (const q of data.examples.filter(q => q.level === 3)) {
    assert.ok(app.cardsFor(q).every(c => !/whether/i.test(c.en)));
    assert.equal(new Set(app.shuffledIndices(q)).size, q.blocks.length);
  }
});

test('level three negative questions keep one contracted support before the subject', () => {
  const examples = [
    ['level3-11', ["Don't", 'you', 'know', 'it']],
    ['level3-12', ["Doesn't", 'she', 'like', 'strawberries']],
    ['level3-13', ["Isn't", 'he', 'tired']],
    ['level3-14', ["Can't", 'you', 'ride', 'a bike']],
  ];
  for (const [id, words] of examples) {
    const q = get(id);
    const cards = app.cardsFor(q);
    assert.equal(q.en, words.join(' ') + '?', id);
    assert.deepEqual(cards.filter(card => app.isSupportRole(card.role)).map(card => card.en), [words[0]], id);
    assert.deepEqual(cards.map(card => card.en), words, id);
    assert.deepEqual(app.enabledTargets(q, []), ['1'], id);
    const choices = Object.fromEntries(cards.map((card, index) => [String(index), card.text]));
    assert.ok(app.choicesCorrect(q, choices), id);
    assert.equal(app.isCorrect(q, ['1', '0', ...Object.keys(choices).slice(2)]), false, id);
  }
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
    assert.deepEqual(app.enabledTargets(q, []), ['2'], id);
    const answer = Object.fromEntries(cards.map((card, index) => [String(index), card.text]));
    assert.equal(app.choicesCorrect(q, { ...answer, 0: answer[1] }), false, id);
    assert.ok(app.choicesCorrect(q, answer), id);
  }
});

test('Level 3 statements unlock There first and put be before the thing introduced', () => {
  const exercises = [
    ['level3-18', ['There', 'is', 'a cat']],
    ['level3-19', ['There', 'are', 'two birds', 'in the tree']],
  ];
  for (const [id, parts] of exercises) {
    const q = get(id);
    const cards = app.cardsFor(q);
    assert.equal(q.question, undefined, id);
    assert.deepEqual(cards.map(card => card.en), parts, id);
    assert.deepEqual(app.enabledTargets(q, []), ['0'], id);
    assert.deepEqual(app.enabledTargets(q, ['0']), ['0', '1'], id);
    assert.deepEqual(app.enabledTargets(q, ['0', '1']), app.targetsFor(q), id);
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
  assert.equal(app.visibleExamples(data, { ...filters, level: 2 }).length, 10);
  assert.equal(app.visibleExamples(data, { ...filters, level: 3 }).length, 19);
  assert.equal(app.visibleExamples(data, { ...filters, group: 'go' }).length, 3);
  assert.equal(app.visibleExamples(data, { ...filters, search: 'not-a-real-sentence' }).length, 0);
});

test('selected levels are combined and the scope applies only to level 1', () => {
  const filters = { levels: [1, 3], group: 'all', scope: 'pronouns', search: '' };
  const mixed = app.visibleExamples(data, filters);
  assert.equal(mixed.length, 50);
  assert.equal(mixed.filter(q => q.level === 1 && q.pronounFocus).length, 31);
  assert.equal(mixed.filter(q => q.level === 3).length, 19);
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
  assert.deepEqual(foodAtLevel3.map(q => q.id), ['level3-01', 'level3-12']);
  const paperHat = [get('build-make-1'), get('level2-02'), get('level3-17')];
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

test('the local-file page embeds the current curriculum and app source', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const match = html.match(/<script id="curriculum" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match);
  assert.deepEqual(JSON.parse(match[1]), data);
  assert.ok(html.replace(/\r\n/g, '\n').includes(fs.readFileSync(path.join(__dirname, '../src/construction-practice.js'), 'utf8').replace(/\r\n/g, '\n')));
  assert.ok(!html.includes('__CONSTRUCTION_'));
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/construction-illustrations.json'), 'utf8'));
  const embeddedImages = html.match(/<script id="illustrations" type="application\/json">([\s\S]*?)<\/script>/);
  assert.deepEqual(JSON.parse(embeddedImages[1]), manifest);
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
