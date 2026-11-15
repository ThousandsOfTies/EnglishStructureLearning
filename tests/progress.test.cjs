'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const lessons = JSON.parse(fs.readFileSync(path.join(root, 'data/lessons.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'src/practice-template.html'), 'utf8');
const start = html.indexOf('function implicitKey(');
const end = html.indexOf('\nlet state=fresh()', start);
assert.ok(start >= 0 && end > start, 'Locate the actual progress functions in the app source');
assert.equal(lessons.length, 640, 'Exercise the shipped 640-lesson dataset');

// Evaluate only the real pure functions; no DOM or browser state is simulated.
const context = vm.createContext({ DATA: lessons, ROLES: { S: true, V: true, P: true, M: true } });
vm.runInContext(
  html.slice(start, end) + '\nthis.progressFunctions = { fresh, restoreProgress };',
  context,
  { timeout: 1000 },
);
// Normalize cross-context prototypes while preserving the persisted JSON values.
const plain = value => JSON.parse(JSON.stringify(value));
const fresh = () => plain(context.progressFunctions.fresh());
const restore = value => plain(context.progressFunctions.restoreProgress(value));

function legacyCompletedProgress() {
  const intro = lessons.slice(0, 10);
  return {
    version: 1,
    index: 8,
    mode: 'picture',
    answers: intro.map(lesson => lesson.chunks.map(([, role]) => role)),
    subjects: intro.map(lesson => lesson.implicit ? (lesson.implicitAnswer || 'you') : ''),
    choices: intro.map(lesson => ({ ...lesson.parts })),
    markDone: intro.map(() => true),
    pictureDone: intro.map(() => true),
    unlocked: intro.map(() => 4),
  };
}

test('legacy ten-lesson progress survives expansion and new lessons start untouched', () => {
  const old = legacyCompletedProgress();
  // The original O label was renamed to the combined O/P role.
  const argumentIndex = old.answers[0].indexOf('P');
  old.answers[0][argumentIndex] = 'O';
  const state = restore(old);

  for (const key of ['answers', 'subjects', 'choices', 'markDone', 'pictureDone', 'unlocked']) {
    assert.equal(state[key].length, 640, key);
  }
  assert.equal(state.index, old.index);
  assert.equal(state.mode, old.mode);
  assert.equal(state.answers[0][argumentIndex], 'P');
  assert.deepEqual(state.answers.slice(1, 10), old.answers.slice(1));
  assert.deepEqual(state.subjects.slice(0, 10), old.subjects);
  assert.deepEqual(state.choices.slice(0, 10), old.choices);
  assert.ok(state.markDone.slice(0, 10).every(Boolean));
  assert.ok(state.pictureDone.slice(0, 10).every(Boolean));

  for (let i = 10; i < lessons.length; i++) {
    assert.deepEqual(state.answers[i], lessons[i].chunks.map(() => ''), `new answers ${i}`);
    assert.equal(state.subjects[i], '');
    assert.deepEqual(state.choices[i], {});
    assert.equal(state.markDone[i], false);
    assert.equal(state.pictureDone[i], false);
    assert.equal(state.unlocked[i], 1);
  }
});

test('completion requires both saved completion and answers that are still correct', () => {
  const old = legacyCompletedProgress();
  old.markDone[0] = false; // Correct-looking selections alone are not an earned completion.
  old.answers[1][0] = '';
  old.choices[2].M = 'incorrect';
  old.subjects[8] = 'me'; // The imperative's hidden subject must still be correct.
  const state = restore(old);

  for (const i of [0, 1, 8]) {
    assert.equal(state.markDone[i], false, `mark completion ${i}`);
    assert.equal(state.pictureDone[i], false, `picture completion ${i}`);
  }
  assert.equal(state.markDone[2], true);
  assert.equal(state.pictureDone[2], false);
  assert.equal(state.markDone[3], true);
  assert.equal(state.pictureDone[3], true);
});

test('malformed saved values cannot grant lesson completion', () => {
  const old = legacyCompletedProgress();
  old.answers[0] = {};
  old.answers[1] = [];
  old.answers[2][0] = 'unknown-role';
  old.choices[3] = [];
  old.choices[4].V = { value: lessons[4].parts.V };
  old.markDone[5] = 'true';
  old.pictureDone[6] = 1;
  old.subjects[8] = { value: 'you' };
  const state = restore(old);

  for (const i of [0, 1, 2]) {
    assert.deepEqual(state.answers[i], lessons[i].chunks.map(() => ''));
    assert.equal(state.markDone[i], false);
    assert.equal(state.pictureDone[i], false);
  }
  assert.deepEqual(state.choices[3], {});
  assert.equal(state.pictureDone[3], false);
  assert.equal(state.choices[4].V, undefined);
  assert.equal(state.pictureDone[4], false);
  assert.equal(state.markDone[5], false);
  assert.equal(state.pictureDone[5], false);
  assert.equal(state.pictureDone[6], false);
  assert.equal(state.subjects[8], '');
  assert.equal(state.markDone[8], false);
  assert.equal(state.pictureDone[8], false);
});

test('old three-answer completions gain M only when those three answers match', () => {
  const old = legacyCompletedProgress();
  for (const i of [0, 1, 2, 3]) delete old.choices[i].M;
  old.choices[1].V = 'incorrect';
  old.pictureDone[2] = false;
  old.markDone[3] = false;
  old.choices[4].M = 'explicitly incorrect';
  const state = restore(old);

  assert.equal(state.choices[0].M, lessons[0].parts.M);
  assert.equal(state.pictureDone[0], true);
  assert.equal(state.choices[1].M, undefined);
  assert.equal(state.pictureDone[1], false);
  assert.equal(state.choices[2].M, undefined);
  assert.equal(state.pictureDone[2], false);
  assert.equal(state.pictureDone[3], false, 'M compatibility must not bypass unfinished marks');
  assert.equal(state.choices[4].M, 'explicitly incorrect');
  assert.equal(state.pictureDone[4], false);
});

test('invalid indices are reset and sequential area unlock counts stay bounded', () => {
  for (const index of [-1, 640, 1.5, '8', null]) {
    const old = legacyCompletedProgress();
    old.index = index;
    assert.equal(restore(old).index, 0, `invalid index ${index}`);
  }
  const old = legacyCompletedProgress();
  old.index = 639;
  old.unlocked = [-1, 0, 1, 2, 4, 999, '4', false, null, 1.5];
  const state = restore(old);
  assert.equal(state.index, 639);
  assert.deepEqual(state.unlocked.slice(0, 10), [1, 1, 1, 2, 4, 4, 1, 1, 1, 1]);
  assert.ok(state.unlocked.slice(10).every(value => value === 1));
  // Previously opened areas intentionally stay open even if a card was later removed.
});

test('unrecognized saved records fall back to a fresh state', () => {
  for (const value of [
    undefined, null, [], {},
    { version: 2, answers: [] },
    { version: 1, answers: 42 },
  ]) assert.deepEqual(restore(value), fresh());
});
