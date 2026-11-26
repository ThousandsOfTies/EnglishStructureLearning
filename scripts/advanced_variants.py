"""Derive Level 2 and Level 3 practice from the Level 1 scenes.

Level 2 crosses one Level 1 tense with one support: a modal, a negation or a
frequency word. Level 3 adds the question order. Each combination (cell) gets
PER_CELL sentences, about one mini set, spread over different verbs. The
Level 1 sentence is kept as the base so the answer can show what changed.
Questions with two supports are picked one by one from TWO_SUPPORTS instead.
"""
from collections import Counter
import re
import zlib

from refine_curriculum import third

PER_CELL = 10
THIRD_PERSON = {'He', 'She', 'It'}
ASKABLE = {'You', 'He', 'She', 'They', 'It'}
PRONOUNS = {'You', 'He', 'She', 'It', 'We', 'They'}
OPTIONAL = (('P1', 'P1'), ('P2', 'P2'), ('place', '場所'), ('time', '時'))
# These times name one occasion and do not combine with frequency or modals.
OCCASIONS = {'once a year', 'at the start of the school year', 'on the first day of school'}
POSSESSIVE = re.compile(r'\b(?:my|your|his|her|its|our|their)\b')
PERSON = re.compile(r'\b(?:me|you|him|her|us|them|Mom|Dad|Grandma|Grandpa|sister|brother|friends?|teacher|'
                    r'classmates?|man|woman|boy|girl|baby|cousin|neighbor)\b', re.IGNORECASE)
MODALS = {'can': '〜できる', 'might': '〜するかもしれない', 'must': '〜しなければならない', 'should': '〜したほうがいい'}
FREQUENCY = (('always', 'いつも'), ('often', 'よく'), ('sometimes', 'ときどき'), ('usually', 'たいてい'))
QUESTION_WORDS = {'what': 'なに（何）', 'who': 'だれ（誰）', 'where': 'どこ（何処）', 'when': 'いつ（何時）', 'why': 'なぜ（何故）'}
QUESTION_ROLES = {'P1': '疑問主部＝P1', 'S': '疑問主部＝S', 'place': '疑問主部＝場所', 'time': '疑問主部＝時',
                  'reason': '疑問主部＝理由'}
QUESTION_TARGETS = {'whether': 'truth', 'who': 'S', 'where': 'place', 'when': 'time', 'why': 'reason'}
# Natural questions with two supports are almost all 'modal + be + state', and only
# a few be scenes take a modal naturally, so these are chosen one by one.
TWO_SUPPORTS = (
    # (Level 1 scene, question word, modal, frequency, Japanese)
    ('build-be-adjective-3', 'whether', 'must', '', '私たちは図書館で静かにしていなければなりませんか。'),
    ('build-be-adjective-3', 'whether', 'should', '', '私たちは図書館で静かにしたほうがいいですか。'),
    ('build-be-adjective-3', 'whether', 'can', '', '私たちは図書館で静かにしていられますか。'),
    ('build-be-adjective-1', 'whether', 'can', 'always', '彼女は家でいつもうれしい気持ちでいられますか。'),
    ('build-be-adjective-5', 'whether', 'can', 'always', '彼らはいつも準備万端でいられますか。'),
    ('build-be-adjective-3', 'why', 'must', '', '私たちはなぜ図書館で静かにしていなければならないのですか。'),
    ('build-be-adjective-3', 'where', 'must', '', '私たちはどこで静かにしていなければなりませんか。'),
    ('build-be-adjective-5', 'when', 'must', '', '彼らはいつ準備万端でいなければなりませんか。'),
    ('build-be-adjective-3', 'who', 'must', '', 'だれが図書館で静かにしていなければなりませんか。'),
    ('build-be-adjective-1', 'who', 'can', 'always', 'だれが家でいつもうれしい気持ちでいられますか。'),
)
# Unnatural with the modal, negation or question in question.
AVOID = {
    'must': {'sleep', 'rest', 'sit', 'stand', 'jump', 'touch', 'feel', 'play', 'give', 'try', 'ride'},
    'should': {'touch', 'pull', 'push', 'turn', 'jump', 'stand', 'sit', 'get'},
    'might': {'turn', 'touch'},
    'can': {'sit', 'stand', 'rest', 'stay', 'open', 'close', 'push', 'pull', 'turn', 'put', 'hold', 'peel', 'move'},
    'often': {'sleep', 'pull', 'push', 'hold', 'touch'},
    'what': {'see', 'feel', 'turn', 'speak', 'choose', 'try', 'get', 'change', 'pull', 'push', 'lift', 'close',
             'open', 'move', 'peel', 'take', 'stop'},
    'who': {'hear'},
    'where': {'tell', 'thank', 'buy', 'join', 'turn', 'get', 'try', 'close', 'pull'},
    'when': {'stand', 'sit', 'turn'},
}
# At most this many 'like / want / need' sentences in one cell, so actions stay the majority.
MAX_STATES = 4
# Japanese for these scenes does not survive the changes (つづりを言う, 目を覚ましかける).
SKIP_GROUPS = {'spell', 'wake'}
SKIP_SCENES = {'build-be-noun-3-past'}
# Keep Japanese changes predictable: these progressive labels are not plain ている forms.
SPECIAL_ONGOING = {'come', 'wake'}

GODAN = {'き': ('く', 'か', 'いた'), 'ぎ': ('ぐ', 'が', 'いだ'), 'し': ('す', 'さ', 'した'),
         'ち': ('つ', 'た', 'った'), 'り': ('る', 'ら', 'った'), 'い': ('う', 'わ', 'った'),
         'に': ('ぬ', 'な', 'んだ'), 'び': ('ぶ', 'ば', 'んだ'), 'み': ('む', 'ま', 'んだ')}
# Stems ending in an i-row kana that still conjugate like 食べる.
ICHIDAN_I = ('起き', '見', '感じ', '閉じ', 'てみ', 'てい', 'でい')
SURU = ('味見し', '勉強し', '練習し', '電話し', 'そうじし')
E_ROW = set('えけげせぜてでねへべぺめれ')


def verb_forms(polite):
    """Dictionary, negative and plain past forms of a polite verb such as 食べます."""
    assert polite.endswith('ます'), polite
    stem = polite[:-2]
    if stem == 'し' or stem.endswith(SURU):
        return stem[:-1] + 'する', stem[:-1] + 'しない', stem[:-1] + 'した'
    if stem.endswith('来'):
        return stem + 'る', stem + 'ない', stem + 'た'
    if stem.endswith('てき'):
        return stem[:-1] + 'くる', stem[:-1] + 'こない', stem + 'た'
    if stem[-1] in E_ROW or stem.endswith(ICHIDAN_I):
        return stem + 'る', stem + 'ない', stem + 'た'
    dictionary, negative, past = GODAN[stem[-1]]
    if stem.endswith(('行き', 'いき')):
        past = 'った'
    return stem[:-1] + dictionary, stem[:-1] + negative + 'ない', stem[:-1] + past


def card(polite):
    """The predicate card: 食べます -> 食べる, 好きです -> 好き."""
    return polite[:-2] if polite.endswith('です') else verb_forms(polite)[0]


def negative(polite):
    for ending, replacement in (('かったです', 'くありませんでした'), ('いです', 'くありません'),
                                ('でした', 'ではありませんでした'), ('です', 'ではありません'),
                                ('ました', 'ませんでした'), ('ます', 'ません')):
        if polite.endswith(ending):
            return polite[:-len(ending)] + replacement
    raise ValueError(polite)


def japanese(q, predicate, lead='', question=False, **replacements):
    values = {role: q['slots'][role]['ja'] for role in ('S', 'time', 'place', 'P1', 'P2')}
    values.update(replacements)
    parameters = ('P2', 'P1') if q['frame'] == 'object-location' else ('P1', 'P2')
    words = [values['S'], lead, *(values[role] for role in ('time', 'place', *parameters)), predicate]
    return ''.join(words) + ('か' if question else '') + '。'


def polite(q):
    """The predicate of a Level 1 sentence as written, e.g. 食べました."""
    prefix = japanese(q, '')[:-1]
    assert q['ja'].startswith(prefix) and q['ja'].endswith('。'), q['id']
    return q['ja'][len(prefix):-1]


def lowered(subject):
    return subject.lower() if subject in PRONOUNS else subject


def complements(q, *dropped):
    return [[name, q['slots'][role]['en'], q['slots'][role]['ja']]
            for role, name in OPTIONAL if q['slots'][role]['en'] and role not in dropped]


def derive(rows, modal_meanings, existing):
    """Return derived Level 2 and Level 3 examples."""
    order = {q['id']: i for i, q in enumerate(rows)}
    by_id = {q['id']: q for q in rows}
    core = [q for q in rows if not q.get('pronounFocus') and q['group'] != 'tense-pictures'
            and q['group'] not in SKIP_GROUPS and q['id'] not in SKIP_SCENES]
    routine = [q for q in core if q['meaning'] == 'routine']
    states = [q for q in core if q['meaning'] == 'state' and not q['group'].startswith('be-')]
    ongoing = [q for q in core if q['meaning'] == 'ongoing' and q['group'] not in SPECIAL_ONGOING]
    past = [q for q in core if q['meaning'] == 'past' and not q['group'].startswith('be-')]
    be_now = [q for q in core if q['meaning'] == 'state' and q['group'].startswith('be-')]
    be_past = [q for q in core if q['meaning'] == 'past' and q['group'].startswith('be-')]
    experience = [q for q in rows if q['group'] == 'tense-pictures' and q['meaning'] == 'experience']
    seen = {q['en'].lower() for q in existing}
    used = Counter()

    def modal_label(word):
        return f"{MODALS[word]}（{modal_meanings[word]}）"
    can_label = modal_label('can')

    def root(q):
        return by_id[q['contrastFamily']]

    def subject(q):
        return q['slots']['S']['en']

    def is_third(q):
        return subject(q) in THIRD_PERSON

    def lemma(q):
        rest = root(q)['slots']['predicate']['en'].partition(' ')[2]
        return ' '.join(x for x in (q['group'], rest) if x)

    def third_form(q):
        rest = root(q)['slots']['predicate']['en'].partition(' ')[2]
        return ' '.join(x for x in (third(q['group']), rest) if x)

    def subject_block(q, ask=False):
        return ['S', lowered(subject(q)) if ask else subject(q), q['slots']['S']['ja']]

    def plain_time(q):
        return q['slots']['time']['en'] not in OCCASIONS

    def te_iru(q):
        return polite(root(q)).endswith(('ています', 'でいます'))

    def daily(q):
        # 'every day' already says how often; drop it with frequency, modals and negation.
        return ('time',) if q['slots']['time']['en'] == 'every day' else ()

    def asks_object(q):
        p1 = q['slots']['P1']
        return (p1['ja'].endswith('を') and not q['slots']['P2']['en'] and ' ' not in lemma(q)
                and not PERSON.search(p1['en']) and not re.search(r'\b(?:with|for|to)\b', p1['en'])
                and q['group'] not in AVOID['what'])

    def asks_place(q):
        place = q['slots']['place']
        return place['ja'].endswith('で') and place['en'] != 'here' and q['group'] not in AVOID['where']

    def asks_subject(q):
        return (not any(POSSESSIVE.search(q['slots'][role]['en']) for role in ('P1', 'P2', 'place'))
                and q['group'] not in AVOID['who'])

    def make(level, cell, q, blocks, ja, focus, unit, question=None, base=None):
        en = ' '.join(text for _, text, _ in blocks if text) + ('?' if question else '.')
        labels = [label for _, _, label in blocks]
        # A predicate card such as する must not look like the support card.
        if en.lower() in seen or len(set(labels)) != len(labels):
            return None
        seen.add(en.lower())
        example = {'id': f"level{level}-{cell}-{q['id'].removeprefix('build-')}", 'theme': q['theme'],
                   'level': level, 'focus': focus, 'ja': ja, 'en': en, 'base': base or q['en'],
                   'blocks': blocks, 'unit': unit, 'derivedFrom': q['id']}
        if question:
            example['question'] = {'token': question[0], 'spoken': question[0] != 'whether', 'target': question[1]}
        return example

    def fill(cell, pool, build, balance=None, unique='group'):
        """Build PER_CELL examples from different scenes, preferring verbs used least so far."""
        ranked = sorted(pool, key=lambda q: (used[q['group']], zlib.crc32(f'{cell}:{q["id"]}'.encode())))
        sides = [ranked] if balance is None else [[q for q in ranked if balance(q)], [q for q in ranked if not balance(q)]]
        built, keys = [], set()
        while len(built) < PER_CELL and any(sides):
            for side in sides:
                while side and len(built) < PER_CELL:
                    q = side.pop(0)
                    states = sum(chosen['meaning'] == 'state' and not chosen['group'].startswith('be-') for chosen, _ in built)
                    if q[unique] in keys or (q['meaning'] == 'state' and not q['group'].startswith('be-') and states >= MAX_STATES):
                        continue
                    example = build(q, len(built))
                    if example:
                        built.append((q, example))
                        keys.add(q[unique])
                        used[q['group']] += 1
                        break
        built.sort(key=lambda pair: order[pair[0]['id']])
        return [example for _, example in built]

    level2, level3 = [], []

    # Level 2: tense x support.
    for word, speakers in (('can', {'I', 'We', 'He', 'She', 'They'}), ('might', {'I', 'We', 'He', 'She', 'They'}),
                           ('must', {'You', 'We'}), ('should', {'You'})):
        def build_modal(q, _, word=word):
            dictionary, negative_form, plain_past = verb_forms(polite(q))
            ending = {'can': dictionary + 'ことができます', 'might': dictionary + 'かもしれません',
                      'must': negative_form[:-1] + 'ければなりません', 'should': plain_past + 'ほうがいいです'}[word]
            blocks = [subject_block(q), ['助動詞', word, MODALS[word]], ['述語', lemma(q), dictionary], *complements(q, 'time')]
            return make(2, word, q, blocks, japanese(q, ending, time=''), f'{word}：{MODALS[word][1:]}', 'degree')
        pool = [q for q in routine if subject(q) in speakers and plain_time(q) and not te_iru(q)
                and q['group'] not in AVOID[word]]
        level2 += fill(word, pool, build_modal)

    def build_might_ongoing(q, _):
        predicate = q['slots']['predicate']
        blocks = [subject_block(q), ['助動詞', 'might', '〜かもしれない'], ['be', 'be', 'である'],
                  ['述語', predicate['en'], predicate['ja']], *complements(q)]
        return make(2, 'might-ing', q, blocks, japanese(q, predicate['ja'] + 'かもしれません'),
                    'might＋be＋ing：しているかもしれない', 'degree')
    level2 += fill('might-ing', [q for q in ongoing if subject(q) in {'He', 'She', 'They', 'It'}], build_might_ongoing)

    def build_not(q, _):
        auxiliary = 'does not' if is_third(q) else 'do not'
        blocks = [subject_block(q), ['否定', auxiliary, '〜しない'], ['述語', lemma(q), card(polite(q))],
                  *complements(q, *daily(q))]
        return make(2, 'not', q, blocks, japanese(q, negative(polite(q)), time='' if daily(q) else q['slots']['time']['ja']),
                    'do not・does not：しない', 'not-routine')
    level2 += fill('not', [q for q in routine + states if plain_time(q) and q['group'] != 'love'], build_not, balance=is_third)

    def build_did_not(q, _):
        blocks = [subject_block(q), ['否定', 'did not', '〜しなかった'], ['述語', lemma(q), card(polite(root(q)))], *complements(q)]
        return make(2, 'did-not', q, blocks, japanese(q, negative(polite(q))), 'did not：しなかった', 'not-past')
    level2 += fill('did-not', past, build_did_not)

    def build_not_ongoing(q, _):
        predicate = q['slots']['predicate']
        blocks = [subject_block(q), ['否定', q['slots']['support']['en'] + ' not', '〜ではない'],
                  ['述語', predicate['en'], predicate['ja']], *complements(q)]
        return make(2, 'not-ing', q, blocks, japanese(q, negative(polite(q))), 'be＋not＋ing：していない', 'not-ongoing')
    level2 += fill('not-ing', ongoing, build_not_ongoing)

    def build_be_not(q, _):
        was = q['meaning'] == 'past'
        predicate = q['slots']['predicate']
        blocks = [subject_block(q), ['否定', q['slots']['support']['en'] + ' not', '〜ではなかった' if was else '〜ではない'],
                  ['述語の残り', predicate['en'], predicate['ja']], *complements(q)]
        focus = 'was・were＋not：ではなかった' if was else 'be＋not：ではない'
        return make(2, 'be-not', q, blocks, japanese(q, negative(polite(q))), focus, 'not-state')
    level2 += fill('be-not', be_now + be_past, build_be_not, balance=lambda q: q['meaning'] == 'state', unique='id')

    def build_have_not(q, _):
        predicate = q['slots']['predicate']
        blocks = [['S', 'I', '私は'], ['否定', 'have not', '〜ことがない'], ['述語', predicate['en'], predicate['ja']], *complements(q)]
        return make(2, 'have-not', q, blocks, japanese(q, predicate['ja'] + 'ことがありません', S='私は'),
                    'have not：したことがない', 'not-experience')
    level2 += fill('have-not', experience, build_have_not, unique='id')

    def build_frequency(q, number):
        word, label = FREQUENCY[number % len(FREQUENCY)]
        blocks = [subject_block(q), ['support', '', 'する'], ['頻度', word, label],
                  ['述語', q['slots']['predicate']['en'], card(polite(q))], *complements(q, *daily(q))]
        ja = japanese(q, polite(q), lead=label, time='' if daily(q) else q['slots']['time']['ja'])
        return make(2, 'often', q, blocks, ja, f'{word}：{label}する', 'frequency')
    level2 += fill('often', [q for q in routine if plain_time(q) and not te_iru(q) and q['group'] not in AVOID['often']],
                   build_frequency, balance=is_third)

    def build_be_frequency(q, number):
        word, label = FREQUENCY[number % len(FREQUENCY)]
        predicate = q['slots']['predicate']
        blocks = [subject_block(q), ['be', q['slots']['support']['en'], 'である'], ['頻度', word, label],
                  ['述語の残り', predicate['en'], predicate['ja']], *complements(q, 'time')]
        return make(2, 'be-often', q, blocks, japanese(q, polite(q), lead=label, time=''), f'be＋{word}：{label}〜である', 'frequency')
    level2 += fill('be-often', [q for q in be_now if q['group'] == 'be-adjective'], build_be_frequency, unique='id')

    # Level 3: tense x support x question order.
    def yes_no(cell, support, predicate, q, ja, base=None):
        blocks = [support, subject_block(q, ask=True), predicate, *complements(q)]
        return make(3, cell, q, blocks, ja, f'かどうか＋{support[1]}', 'whether', ('whether', 'truth'), base)

    askable = lambda pool: [q for q in pool if subject(q) in ASKABLE]
    level3 += fill('q-do', askable(routine + states), lambda q, _: yes_no(
        'q-do', ['疑問の支え', 'Does' if is_third(q) else 'Do', 'する'], ['述語', lemma(q), card(polite(q))],
        q, japanese(q, polite(q), question=True)), balance=is_third)
    level3 += fill('q-did', askable(past), lambda q, _: yes_no(
        'q-did', ['疑問の支え', 'Did', 'した'], ['述語', lemma(q), card(polite(root(q)))],
        q, japanese(q, polite(q), question=True)))
    level3 += fill('q-ing', askable(ongoing), lambda q, _: yes_no(
        'q-ing', ['be', q['slots']['support']['en'].capitalize(), 'である'],
        ['述語', q['slots']['predicate']['en'], q['slots']['predicate']['ja']], q, japanese(q, polite(q), question=True)))
    level3 += fill('q-be', askable(be_now + be_past), lambda q, _: yes_no(
        'q-be', ['be', q['slots']['support']['en'].capitalize(), q['slots']['support']['ja']],
        ['述語', q['slots']['predicate']['en'], q['slots']['predicate']['ja']], q, japanese(q, polite(q), question=True)),
        balance=lambda q: q['meaning'] == 'state', unique='id')

    def build_can_question(q, _):
        dictionary = verb_forms(polite(q))[0]
        blocks = [['助動詞', 'Can', can_label], subject_block(q, ask=True), ['述語', lemma(q), dictionary], *complements(q, 'time')]
        return make(3, 'q-can', q, blocks, japanese(q, dictionary + 'ことができます', time='', question=True),
                    'かどうか＋Can', 'whether', ('whether', 'truth'))
    level3 += fill('q-can', [q for q in routine if subject(q) == 'You' and plain_time(q) and not te_iru(q)
                             and q['group'] not in AVOID['can']], build_can_question)

    def build_have_question(q, _):
        predicate = q['slots']['predicate']
        blocks = [['support', 'Have', 'ことがある'], ['S', 'you', 'あなたは'], ['頻度', 'ever', '今までに'],
                  ['述語', predicate['en'], predicate['ja']], *complements(q)]
        ja = japanese(q, predicate['ja'] + 'ことがあります', lead='今までに', question=True, S='あなたは')
        return make(3, 'q-have', q, blocks, ja, 'かどうか＋Have', 'whether', ('whether', 'truth'),
                    q['en'].replace('I have', 'You have', 1))
    level3 += fill('q-have', experience, build_have_question, unique='id')

    def wh(cell, token, target, q, word, support, predicate, ja, dropped):
        blocks = [[QUESTION_ROLES[target], word, QUESTION_WORDS[token]],
                  support, subject_block(q, ask=True), predicate, *complements(q, *dropped)]
        return make(3, cell, q, blocks, ja, f'{token}＋{support[1]}', token, (token, target))

    def present_support(q):
        return ['疑問の支え', 'does' if is_third(q) else 'do', 'する']

    for token, target, word, filter_, replacement in (
            ('what', 'P1', 'What', asks_object, {'P1': '何を'}),
            ('where', 'place', 'Where', asks_place, {'place': 'どこで'})):
        level3 += fill(f'{token}-do', [q for q in askable(routine + states) if filter_(q)], lambda q, _, t=token, g=target, w=word, r=replacement: wh(
            f'{t}-do', t, g, q, w, present_support(q), ['述語', lemma(q), card(polite(q))],
            japanese(q, polite(q), question=True, **r), (g,)), balance=is_third)
        level3 += fill(f'{token}-did', [q for q in askable(past) if filter_(q)], lambda q, _, t=token, g=target, w=word, r=replacement: wh(
            f'{t}-did', t, g, q, w, ['疑問の支え', 'did', 'した'], ['述語', lemma(q), card(polite(root(q)))],
            japanese(q, polite(q), question=True, **r), (g,)))
        level3 += fill(f'{token}-ing', [q for q in askable(ongoing) if filter_(q)], lambda q, _, t=token, g=target, w=word, r=replacement: wh(
            f'{t}-ing', t, g, q, w, ['be', q['slots']['support']['en'], 'である'],
            ['述語', q['slots']['predicate']['en'], q['slots']['predicate']['ja']],
            japanese(q, polite(q), question=True, **r), (g,)))

    def build_what_can(q, _):
        dictionary = verb_forms(polite(q))[0]
        return wh('what-can', 'what', 'P1', q, 'What', ['助動詞', 'can', can_label], ['述語', lemma(q), dictionary],
                  japanese(q, dictionary + 'ことができます', question=True, P1='何を', time=''), ('P1', 'time'))
    level3 += fill('what-can', [q for q in routine if subject(q) == 'You' and asks_object(q) and plain_time(q)
                                and not te_iru(q) and q['group'] not in AVOID['can']], build_what_can)

    weekly = {'on Sundays', 'on Saturdays'}
    level3 += fill('when-do', [q for q in askable(routine) if q['slots']['time']['en'] in weekly
                               and q['group'] not in AVOID['when']], lambda q, _: wh(
        'when-do', 'when', 'time', q, 'When', present_support(q), ['述語', lemma(q), card(polite(q))],
        japanese(q, polite(q), question=True, time='いつ'), ('time',)), balance=is_third)
    level3 += fill('when-did', [q for q in askable(past) if q['group'] not in AVOID['when']], lambda q, _: wh(
        'when-did', 'when', 'time', q, 'When', ['疑問の支え', 'did', 'した'], ['述語', lemma(q), card(polite(root(q)))],
        japanese(q, polite(q), question=True, time='いつ'), ('time',)))

    def who(cell, q, support, predicate):
        blocks = [[QUESTION_ROLES['S'], 'Who', QUESTION_WORDS['who']], support, predicate, *complements(q)]
        return make(3, cell, q, blocks, japanese(q, polite(q), question=True, S='だれが'),
                    f"who＋{support[1] or support[2]}", 'who', ('who', 'S'))
    level3 += fill('who-do', [q for q in routine + states if asks_subject(q)], lambda q, _: who(
        'who-do', q, ['support', '', 'する'], ['述語', third_form(q), card(polite(q))]))
    level3 += fill('who-did', [q for q in past if asks_subject(q)], lambda q, _: who(
        'who-did', q, ['support', '', 'した'], ['述語', q['slots']['predicate']['en'], card(polite(root(q)))]))
    level3 += fill('who-ing', [q for q in ongoing if asks_subject(q)], lambda q, _: who(
        'who-ing', q, ['be', 'is', 'である'], ['述語', q['slots']['predicate']['en'], q['slots']['predicate']['ja']]))

    def build_two_supports(scene, token, word, frequency, ja):
        """A modal, then be: only the modal moves in front of the subject."""
        q = by_id[scene]
        target = QUESTION_TARGETS[token]
        modal = word.capitalize() if token == 'whether' else word
        blocks = [] if token == 'whether' else [[QUESTION_ROLES[target], token.capitalize(), QUESTION_WORDS[token]]]
        blocks.append(['助動詞', modal, modal_label(word)])
        if token != 'who':
            blocks.append(subject_block(q, ask=True))
        if frequency:
            blocks.append(['頻度', frequency, dict(FREQUENCY)[frequency]])
        # The asked part leaves the sentence, and 'always' does not go with 'today'.
        dropped = [role for role in ('place', 'time') if role == target or (role == 'time' and frequency)]
        predicate = q['slots']['predicate']
        blocks += [['be', 'be', 'である'], ['述語', predicate['en'], predicate['ja']], *complements(q, *dropped)]
        focus = '＋'.join(x for x in ('かどうか' if token == 'whether' else token, modal, frequency, 'be') if x)
        cell = '-'.join(x for x in ('two', token, word, frequency) if x)
        return make(3, cell, q, blocks, ja, focus, token, (token, target))
    for row in TWO_SUPPORTS:
        example = build_two_supports(*row)
        assert example, row
        level3.append(example)

    return level2, level3
