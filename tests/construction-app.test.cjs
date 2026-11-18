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
    const spoken = q.level === 1 ? app.roles.map(role => q.slots[role].en).filter(Boolean) : q.blocks.map(([, text]) => text);
    assert.equal(spoken.join(' ') + (q.level === 3 ? '?' : '.'), q.en, q.id);
  }
});

test('unused slots stay empty and misplaced cards cannot pass', () => {
  const q = get('build-go-1');
  const correct = app.cardsFor(q).map((_, i) => app.expectedTarget(q, i));
  assert.equal(app.isCorrect(q, correct), true);
  assert.ok(!correct.includes('P2'));
  const wrong = app.place(q, correct, 0, 'P2');
  assert.equal(app.isCorrect(q, wrong), false);
  assert.equal(app.isCorrect(q, app.place(q, wrong, 0, 'S')), true);
});

test('subject unlocks predicate and both unlock every remaining slot', () => {
  assert.deepEqual(app.enabledRoles(false, false), ['S']);
  assert.deepEqual(app.enabledRoles(true, false), ['S', 'predicate']);
  assert.deepEqual(app.enabledRoles(true, true), app.roles);
  assert.deepEqual(app.enabledRoles(false, true), ['S']);
  assert.deepEqual(app.enabledRoles(Boolean(''), Boolean('行きます')), ['S']);
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
  assert.deepEqual(app.cardsFor(get('level3-06')).slice(0, 2).map(c => c.text), ['Who', 'gives']);
  assert.deepEqual(app.cardsFor(get('level3-09')).slice(0, 3).map(c => c.text), ['Who', 'do', 'you']);
  for (const q of data.examples.filter(q => q.level === 3)) {
    assert.ok(app.cardsFor(q).every(c => !/whether/i.test(c.text)));
    assert.equal(new Set(app.shuffledIndices(q)).size, q.blocks.length);
  }
});

test('basic-first navigation separates contrasts, pronouns, and advanced reflexives', () => {
  const filters = { level: 1, group: 'all', scope: 'core', search: '' };
  assert.equal(app.visibleExamples(data, filters).length, 310);
  assert.equal(app.visibleExamples(data, { ...filters, scope: 'all' }).length, 918);
  assert.equal(app.visibleExamples(data, { ...filters, scope: 'pronouns' }).length, 31);
  assert.equal(app.visibleExamples(data, { ...filters, scope: 'extension' }).length, 8);
  assert.equal(app.visibleExamples(data, { ...filters, level: 2 }).length, 10);
  assert.equal(app.visibleExamples(data, { ...filters, level: 3 }).length, 10);
  assert.equal(app.visibleExamples(data, { ...filters, group: 'go' }).length, 3);
  assert.equal(app.visibleExamples(data, { ...filters, search: 'not-a-real-sentence' }).length, 0);
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

test('the next-scene navigation stays in the core list after opening a contrast', () => {
  const visible = app.visibleExamples(data, { level: 1, group: 'go', scope: 'core', search: '' });
  const index = app.navigationIndex(visible, get('build-go-1-past'));
  assert.equal(visible[index].id, 'build-go-1');
  assert.equal(visible[index + 1].id, 'build-go-2');
  assert.equal(app.navigationIndex([], get('build-go-1')), -1);
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
    assert.ok(illustration.alt && illustration.clue);
    const bytes = fs.readFileSync(path.join(__dirname, '..', illustration.file));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.ok(bytes.readUInt32BE(16) >= 512);
    assert.ok(bytes.readUInt32BE(20) >= 512);
  }
});
