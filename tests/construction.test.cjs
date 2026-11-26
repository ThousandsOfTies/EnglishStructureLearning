'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const draft = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/construction-examples.json'), 'utf8'));
const basic = draft.examples.filter(q => q.level === 1);
const get = id => basic.find(q => q.id === 'build-' + id);

test('the original 100 groups keep three core scenes each, with contrasts added', () => {
  const core = basic.filter(q => q.contrastFamily === q.id && q.group !== 'tense-pictures' && q.variant <= 3);
  assert.equal(core.length, 300);
  const coreGroups = draft.groups.filter(q => !q.key.startsWith('pronouns-') && q.key !== 'tense-pictures');
  assert.equal(coreGroups.length, 100);
  for (const group of coreGroups) assert.equal(core.filter(q => q.group === group.key).length, 3);
});

test('connectors stay with the predicate and leave the target in P', () => {
  for (const [id, predicate, target] of [
    ['go-1', 'go to', 'the park'], ['look-1', 'look at', 'the moon'],
    ['listen-1', 'listen to', 'music'], ['wait-1', 'wait for', 'the bus'],
  ]) {
    assert.equal(get(id).slots.predicate.en.replace(/^(looks|listens|waits)\b/, word => word.slice(0,-1)), predicate);
    assert.equal(get(id).slots.P1.en, target);
  }
});

test('be goes in the support slot and nouns and adjectives stay in the predicate', () => {
  assert.deepEqual(get('be-noun-1').slots.support, {ja: 'である', en: 'am'});
  assert.deepEqual(get('be-noun-1').slots.predicate, {ja: '生徒', en: 'a student'});
  assert.deepEqual(get('be-adjective-1').slots.support, {ja: 'である', en: 'is'});
  assert.deepEqual(get('be-adjective-1').slots.predicate, {ja: 'うれしい', en: 'happy'});
  for (const q of basic.filter(q => q.group.startsWith('be-'))) {
    assert.deepEqual(q.slots.P1, {ja: '', en: ''});
    assert.deepEqual(q.slots.P2, {ja: '', en: ''});
  }
});

test('the new be scenes pair present and past forms with the same subject and predicate', () => {
  const scenes = [
    ['be-noun-4', 'I', 'am', 'was', 'the class helper'],
    ['be-adjective-4', 'She', 'is', 'was', 'sleepy'],
    ['be-adjective-5', 'They', 'are', 'were', 'ready'],
  ];
  for (const [id, subject, presentBe, pastBe, predicate] of scenes) {
    const present = get(id);
    const past = get(id + '-past');
    assert.equal(present.en, `${subject} ${presentBe} ${predicate}.`);
    assert.equal(past.en, `${subject} ${pastBe} ${predicate} yesterday.`);
    assert.deepEqual(present.slots.S, past.slots.S);
    assert.deepEqual(present.slots.predicate, past.slots.predicate);
    assert.deepEqual(present.slots.support, {ja: 'である', en: presentBe});
    assert.deepEqual(past.slots.support, {ja: 'であった', en: pastBe});
    assert.equal(present.meaning, 'state');
    assert.equal(past.statePredicate, true);
    assert.equal(past.contrastFamily, present.id);
  }
});

test('location and invitation targets cannot leak into the time slot', () => {
  assert.equal(get('wait-1').slots.place.en, 'here');
  assert.equal(get('invite-1').slots.P1.en, 'your friend to your birthday party');
  for (const q of basic) assert.match(q.slots.time.en, /^(?:$|on Sundays|every day|every morning|on Saturdays|today|now|yesterday|last year|once a year|at the start of the school year|on the first day of school)$/);
});

test('verb complements and scene locations use different slots in every tense', () => {
  for (const [id, role, phrase] of [
    ['come-1', 'P1', 'here'], ['come-2', 'P1', 'this room'],
    ['stay-2', 'P1', 'in a tent'], ['live-1', 'P1', 'in a small house'],
    ['put-1', 'P2', 'on the desk'], ['pour-1', 'P2', 'into a cup'],
    ['bring-2', 'P2', 'to school'], ['keep-2', 'P2', 'in a little box'],
    ['run-1', 'place', 'in the park'], ['wait-1', 'place', 'here'],
    ['move-1', 'place', 'at home'], ['sit-1', 'place', 'on a bench'],
  ]) {
    const family = get(id).contrastFamily;
    for (const q of basic.filter(example => example.contrastFamily === family)) {
      assert.equal(q.slots[role].en, phrase, q.id);
      if (role !== 'place') assert.equal(q.slots.place.en, '', q.id);
    }
  }
});

test('filled slots reconstruct the exact complete English sentence', () => {
  for (const q of basic) {
    const slots = ['S', 'support', 'predicate', 'P1', 'P2', 'place', 'time'].map(k => q.slots[k].en).filter(Boolean);
    assert.equal(slots.join(' ') + '.', q.en, q.id);
    const leadingSupport = q.en.slice(q.slots.S.en.length + 1).match(/^(am|is|are|was|were|have)\b/);
    assert.equal(q.slots.support.en, leadingSupport?.[0] ?? '', q.id);
    assert.ok(q.slots.support.ja, q.id);
    if (!leadingSupport) assert.equal(q.slots.support.ja, q.meaning === 'past' ? 'した' : 'する', q.id);
    assert.ok(q.slots.predicate.ja, q.id);
  }
});

test('P1 and P2 distinguish recipient/thing from object/description', () => {
  assert.deepEqual([get('give-1').slots.P1.en, get('give-1').slots.P2.en], ['him', 'a sticker']);
  assert.deepEqual([get('call-3').slots.P1.en, get('call-3').slots.P2.en], ['their dog', 'Pochi']);
  assert.deepEqual([get('keep-1').slots.P1.en, get('keep-1').slots.P2.en], ['our room', 'clean']);
  assert.deepEqual([get('make-3').slots.P1.en, get('make-3').slots.P2.en], ['her', 'happy']);
});

test('each selectable level has its requested number of examples', () => {
  assert.deepEqual([1,2,3].map(level => draft.examples.filter(q => q.level === level).length), [924,144,222]);
  assert.deepEqual(draft.levels.map(q => q.id), [1,2,3]);
  assert.equal(new Set(draft.examples.map(q => q.id)).size, 1290);
});

test('derived practice fills every tense and support combination from the Level 1 scenes', () => {
  const derived = draft.examples.filter(q => q.derivedFrom);
  // Questions with two supports are picked one by one instead of ten per combination.
  const twoSupports = derived.filter(q => q.id.startsWith('level3-two-'));
  assert.equal(twoSupports.length, 10);
  const cells = {};
  for (const q of derived.filter(q => !twoSupports.includes(q))) {
    const cell = q.id.slice(0, q.id.length - q.derivedFrom.replace(/^build-/, '').length - 1);
    (cells[cell] ??= []).push(q);
  }
  const lunchQuestion = draft.examples.find(q => q.id === 'level3-q-do-eat-lunch-at-school');
  assert.equal(lunchQuestion.en, 'Does she eat her lunch at school every day?');
  assert.ok(!draft.examples.some(q => q.id === 'level3-q-do-open-1'));
  cells['level3-q-do'].push(lunchQuestion);
  const readingQuestion = draft.examples.find(q => q.id === 'level3-q-do-read-picture-books-at-home');
  assert.equal(readingQuestion.en, 'Do they read picture books at home every day?');
  assert.ok(!draft.examples.some(q => q.id === 'level3-q-do-lift-3'));
  cells['level3-q-do'].push(readingQuestion);
  assert.deepEqual(Object.keys(cells).sort(), [
    'level2-be-not', 'level2-be-often', 'level2-can', 'level2-did-not', 'level2-have-not', 'level2-might',
    'level2-might-ing', 'level2-must', 'level2-not', 'level2-not-ing', 'level2-often', 'level2-should',
    'level3-q-be', 'level3-q-can', 'level3-q-did', 'level3-q-do', 'level3-q-have', 'level3-q-ing',
    'level3-what-can', 'level3-what-did', 'level3-what-do', 'level3-what-ing', 'level3-when-did', 'level3-when-do',
    'level3-where-did', 'level3-where-do', 'level3-where-ing', 'level3-who-did', 'level3-who-do', 'level3-who-ing',
  ].sort());
  for (const [cell, examples] of Object.entries(cells)) {
    assert.ok(examples.length >= 5 && examples.length <= 10, cell);
    if (!/be-often|when-do|what-can/.test(cell)) assert.equal(examples.length, 10, cell);
  }
  const level1 = new Map(basic.map(q => [q.id, q]));
  const baseForm = new Set(['do', 'does', 'did', 'do not', 'does not', 'did not', 'can', 'might', 'must', 'should']);
  for (const q of derived) {
    const source = level1.get(q.derivedFrom);
    assert.ok(source, q.id);
    assert.equal(q.theme, source.theme, q.id);
    if (!q.en.startsWith('Have ')) assert.equal(q.base, source.en, q.id);
    assert.doesNotMatch(q.ja, /[a-z]/i, q.id);
    assert.match(q.ja, q.question ? /か。$/u : /。$/u, q.id);
    const support = q.blocks.find(([role, text]) => text && ['否定', '助動詞', '疑問の支え'].includes(role));
    const predicate = q.blocks.find(([role]) => role === '述語');
    if (support && baseForm.has(support[1].toLowerCase()) && source.group !== 'tense-pictures') {
      // After do, did and the modals the next verb returns to its base form: eat, or be in might be eating.
      const be = q.blocks.find(([role]) => role === 'be');
      if (be) assert.equal(be[1], 'be', q.id);
      else assert.equal(predicate[1].split(' ')[0], source.group, q.id);
    }
  }
});

test('state verbs stay simple while ongoing actions are be plus ing', () => {
  const states = new Set(['like','love','want','need','hear','see','feel','live']);
  for (const q of basic.filter(q => states.has(q.group))) {
    assert.equal(q.meaning, 'state');
    assert.doesNotMatch(q.slots.predicate.en, /\bing\b/);
  }
  for (const q of basic.filter(q => q.meaning === 'ongoing')) {
    const subject = q.slots.S.en;
    const expectedBe = subject === 'I' ? 'am' : ['You','We','They'].includes(subject) ? 'are' : 'is';
    assert.equal(q.slots.support.en, expectedBe, q.id);
    assert.match(q.slots.predicate.en, /\b\w+ing\b/, q.id);
    assert.equal(q.slots.time.en, q.group === 'tense-pictures' ? '' : 'now');
  }
});

test('contrast families preserve the scene participants and include real irregular past forms', () => {
  for (const [id, verb] of [['go-1','went'],['swim-1','swam'],['write-1','wrote'],['give-1','gave'],['take-1','took'],['build-1','built']]) {
    const current = get(id), previous = get(id + '-past');
    assert.equal(previous.slots.predicate.en.split(' ')[0], verb);
    for (const role of ['S','P1','P2','place']) assert.deepEqual(previous.slots[role], current.slots[role]);
    assert.equal(previous.scene.speakerTime, '今');
    assert.equal(previous.scene.eventTime, '昨日');
  }
  assert.equal(get('read-1-past').note.includes('/red/'), true);
  for (const [id, adjective, be] of [['be-adjective-1-past', 'うれしい', 'was'], ['be-adjective-2-past', 'いそがしい', 'was'], ['be-adjective-3-past', '静か', 'were']]) {
    const q = get(id);
    assert.deepEqual(q.slots.support, {ja: 'であった', en: be});
    assert.equal(q.slots.predicate.ja, adjective);
  }
});

test('personal pronouns cover subject, object, possessive and reflexive forms with explicit viewpoints', () => {
  const expected = {
    subject: ['I','You','He','She','It','We','They'],
    object: ['me','you','him','her','it','us','them'],
    possessive: ['my','your','his','her','its','our','their'],
    independent: ['mine','yours','his','hers','ours','theirs'],
    reflexive: ['myself','yourself','himself','herself','itself','ourselves','yourselves','themselves'],
  };
  for (const [category, forms] of Object.entries(expected)) {
    const examples = basic.filter(q => q.pronounFocus?.category === category);
    assert.deepEqual([...new Set(examples.map(q => q.pronounFocus.form))].sort(), forms.sort());
    for (const q of examples) {
      assert.ok(q.scene.speaker && q.scene.viewpoint, q.id);
      assert.equal(Boolean(q.scene.listener), /\b(?:you|your|yours|yourself|yourselves)\b/i.test(q.en), q.id);
      if (q.scene.listener && q.ja.includes('あなたたち')) assert.match(q.scene.listener, /紫の服/, q.id);
    }
  }
  assert.equal(basic.filter(q => q.pronounFocus?.category === 'independent' && q.pronounFocus.form === 'its').length, 0);
});

test('advanced blocks reconstruct English with silent question and support blocks omitted', () => {
  for (const q of draft.examples.filter(q => q.level > 1)) {
    const silent = q.blocks.filter(([, text]) => !text);
    const expected = q.question?.spoken === false ? [['question-marker', '', 'かどうか']] : [];
    const firstSpokenAfterQuestion = q.blocks.slice(1).find(([, text]) => text);
    const silentSupport = q.blocks.find(([role, text]) => role === 'support' && !text);
    if (silentSupport) {
      // Only the present-tense frequency pattern and Who-as-subject keep the Level 1 support silent.
      const frequency = q.blocks.some(([role]) => role === '頻度') && silentSupport[2] === 'する';
      const subjectQuestion = q.question?.target === 'S' && firstSpokenAfterQuestion?.[0] === '述語';
      assert.ok(frequency || subjectQuestion, q.id);
      assert.ok(['する', 'した'].includes(silentSupport[2]), q.id);
      expected.push(silentSupport);
    }
    assert.deepEqual(silent, expected, q.id);
    assert.equal(q.blocks.map(([, text]) => text).filter(Boolean).join(' ') + (q.question ? '?' : '.'), q.en);
    assert.doesNotMatch(q.en, /\bwhether\b/i);
    if (q.question) assert.equal(q.question.spoken, q.question.token !== 'whether');
  }
});

test('questions about the subject preserve the subject position without do', () => {
  const subjectQuestion = draft.examples.find(q => q.id === 'level3-06');
  assert.equal(subjectQuestion.question.target, 'S');
  assert.equal(subjectQuestion.en, 'Who gives you a sticker at school?');
  assert.doesNotMatch(subjectQuestion.en, /\bdo(?:es)?\b/i);
});

test('derived cutting, keeping and spelling exercises use corrected practice wording', () => {
  for (const q of basic) {
    if (q.group === 'cut' && q.meaning === 'ongoing') assert.equal(q.slots.predicate.en, 'cutting');
    if (q.group === 'keep' && q.meaning === 'ongoing') assert.equal(q.slots.predicate.ja, 'しまっている');
    assert.doesNotMatch(q.ja + Object.values(q.slots).map(slot => slot.ja).join(''), /[a-z]/i, q.id);
  }
});

test('each picture activity has four complete forms using the same participants and object', () => {
  const pictures = basic.filter(q => q.group === 'tense-pictures');
  const families = new Set(pictures.map(q => q.contrastFamily));
  assert.equal(families.size, 10);
  for (const family of families) {
    const variants = pictures.filter(q => q.contrastFamily === family);
    assert.deepEqual(variants.map(q => q.meaning), ['routine', 'past', 'ongoing', 'experience']);
    assert.match(variants[3].en, /^I have /);
    assert.match(variants[3].ja, /ことがある。$/u);
    for (const q of variants) {
      assert.deepEqual(q.slots.P1, variants[0].slots.P1);
      assert.equal(q.slots.S.en, 'I');
    }
  }
});
