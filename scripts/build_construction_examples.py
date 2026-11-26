"""Build the curriculum with the English sentence parts used in practice.

This is a learning representation, not a claim that its slots are traditional
syntactic constituents. Empty slots are meaningful and remain empty.
"""
import json
import re
from pathlib import Path

from compile_original import SUBJECTS, pair, third_person
from refine_curriculum import SLOTS as SOURCE_SLOTS, annotate_scene, japanese_sentence, past, refine, third
from refine_curriculum import pair as slot
from advanced_variants import PER_CELL, card, derive

ROOT = Path(__file__).resolve().parents[1]
SLOTS = ('S', 'support', *SOURCE_SLOTS[1:])
BE_FORMS = {'am', 'is', 'are', 'was', 'were', 'be', 'being', 'been'}
# Lesson list headings. Level 2 follows tense x support, Level 3 the question part.
UNITS = {
    'degree': 'できる・かもしれない・必要・おすすめ',
    'not-routine': 'ふだん〜しない',
    'not-past': '〜しなかった',
    'not-ongoing': '今〜していない',
    'not-state': '〜ではない・〜ではなかった',
    'not-experience': '〜したことがない',
    'frequency': 'いつも・よく・ときどき・たいてい',
    'whether': 'かどうか（はい・いいえで答える）',
    'what': 'なに（何）',
    'who': 'だれ（誰）',
    'where': 'どこ（何処）',
    'when': 'いつ（何時）',
    'which': 'どれ・どの',
    'why': 'なぜ（何故）',
    'how': 'どうやって',
    'there': 'ほら、〜がいる（There）',
}


def level2_unit(q):
    roles = {role: en for role, en, _ in q['blocks']}
    if '頻度' in roles:
        return 'frequency'
    if q['blocks'][1][0] == '助動詞':
        return 'degree'
    negation = roles.get('否定', '')
    if negation in {'do not', 'does not'}:
        return 'not-routine'
    if negation == 'did not':
        return 'not-past'
    if negation == 'have not':
        return 'not-experience'
    return 'not-ongoing' if roles.get('述語', '').endswith('ing') else 'not-state'

# Keep the connectors used by the teaching model with the predicate. A
# setting can stay together in the place slot, such as 'run in the park'.
CONNECTORS = {
    'go': ('to ',), 'come': ('to ',),
    'walk': ('to ', 'through '), 'jump': ('over ',),
    'wait': ('for ',), 'listen': ('to ',), 'look': ('at ',),
    'talk': ('with ',), 'call': (), 'pay': ('for ',),
    'dance': ('to ',),
}
SETTING_VERBS = {'run', 'swim', 'sit', 'stand', 'sleep', 'rest'}
SCHOOL_VERBS = {'write', 'draw', 'color', 'count', 'study', 'learn', 'spell',
                'answer', 'ask', 'thank', 'join', 'teach'}
OUTDOOR_VERBS = {'jump', 'fly', 'ride', 'climb', 'find'}
NO_DEFAULTS = {'go', 'come', 'walk', 'stay', 'live', 'like', 'love', 'want',
               'need', 'see', 'hear', 'feel', 'visit', 'meet', 'call', 'save'}


# Scene wording applied after the default place and time. Variant keys use
# the one-based number in the exercise ID.
SCENE_CONTEXTS = {
    'bring': {'place': ('学校に', 'to school'), 'time': ('毎日', 'every day')},
    'put': {'time': ('放課後に', 'after school')},
    'wake': {'place': ('家で', 'at home')},
    'eat': {'place': ('家で', 'at home')},
    'wait': {'time': ('放課後に', 'after school')},
    'play': {'place': ('公園で', 'in the park')},
    'hold': {'place': ('外で', 'outside')},
    'take': {'place': ('通りで', 'on the street')},
    'invite': {'place': ('家で', 'at home'), 'time': ('放課後に', 'after school')},
    'teach': {'place': ('家で', 'at home'), 'time': ('放課後に', 'after school')},
    'follow': {'place': ('公園で', 'in the park')},
    'try': {'place': ('学校で', 'at school')},
    'wear': {'place': ('公園で', 'in the park'), 'time': ('日曜日に', 'on Sundays')},
    'buy': {'place': ('お店で', 'at a shop')},
    'pay': {'place': ('お店で', 'at a shop')},
}
VARIANT_CONTEXTS = {
    ('count', 1): {'place': ('庭で', 'in the garden'), 'time': ('夜に', 'at night')},
    ('look', 1): {'place': ('庭で', 'in the garden'), 'time': ('夜に', 'at night')},
    ('play', 3): {'place': ('家で', 'at home')},
    ('open', 1): {'place': ('学校で', 'at school'), 'time': ('昼食のときに', 'at lunchtime')},
    ('ask', 2): {'place': ('家で', 'at home'), 'time': ('夕食のあとに', 'after dinner')},
    ('thank', 2): {'place': ('家で', 'at home'), 'time': ('夕食のあとに', 'after dinner')},
    ('build', 1): {'place': ('浜辺で', 'on the beach')},
    ('clean', 3): {'place': ('学校で', 'at school'), 'time': ('放課後に', 'after school')},
    ('pay', 1): {'place': ('駅で', 'at the station')},
}


def own(text, variant):
    return re.sub(r'\bmy\b', ('my', 'her', 'our')[variant], text)


def make_example(key, group, number, values):
    values['P1'] = values.pop('P', slot())
    values.setdefault('P2', slot())
    double = {
        'give': [('弟に', 'my brother', 'シールを', 'a sticker'), ('友だちに', 'her friend', 'カードを', 'a card'), ('妹に', 'our sister', '花を', 'a flower')],
        'send': [('おばあちゃんに', 'Grandma', 'カードを', 'a card'), ('友だちに', 'her friend', '手紙を', 'a letter'), ('お父さんに', 'Dad', '写真を', 'a photo')],
        'show': [('お母さんに', 'Mom', '絵を', 'my picture'), ('友だちに', 'her friend', '地図を', 'a map'), ('弟に', 'our brother', 'ロボットを', 'a robot')],
        'tell': [('妹に', 'my sister', '予定を', 'the plan'), ('友だちに', 'her friend', '答えを', 'the answer'), ('お父さんに', 'Dad', '時刻を', 'the time')],
        'ask': [('先生に', 'the teacher', '質問を', 'a question'), ('お父さんに', 'Dad', '質問を', 'a question'), ('友だちに', 'our friend', '名前を', 'their name')],
        'teach': [('弟に', 'my brother', '新しいゲームを', 'a new game'), ('友だちに', 'her friend', '歌を', 'a song'), ('妹に', 'our sister', 'ダンスを', 'a dance')],
    }
    frame = 'one-parameter' if values['P1']['en'] else 'no-parameter'
    if group == 'invite':
        frame = 'object-location'
    if group == 'bake' and values['P2']['en']:
        frame = 'object-companion'
    if group in double:
        j1, e1, j2, e2 = double[group][number - 1]
        values['P1'], values['P2'] = slot(j1, e1), slot(j2, e2)
        frame = 'recipient-thing'
    if group == 'call' and number == 3:
        values['predicate'] = slot('呼びます', 'call')
        values['P1'], values['P2'] = slot('うちの犬を', 'our dog'), slot('ポチと', 'Pochi')
        values['time'] = slot()
        frame = 'object-description'
    if group == 'keep' and number == 1:
        values['predicate'] = slot('保ちます', 'keep')
        values['P1'], values['P2'] = slot('自分の部屋を', 'my room'), slot('きれいに', 'clean')
        values['place'], values['time'] = slot(), slot('毎日', 'every day')
        frame = 'object-description'
    if group == 'make' and number == 3:
        values['predicate'] = slot('します', 'make')
        values['P1'], values['P2'] = slot('妹を', 'our sister'), slot('うれしい気持ちに', 'happy')
        frame = 'object-description'
    if group in {'put', 'pour', 'bring'} or (group == 'keep' and number != 1):
        values['P2'], values['place'] = values['place'], slot()
        frame = 'object-location'
    en = ' '.join(values[k]['en'] for k in SOURCE_SLOTS if values[k]['en']) + '.'
    ja = japanese_sentence(values, frame)
    return {'id': key, 'group': group, 'variant': number, 'slots': values,
            'ja': ja, 'en': en, 'frame': frame, 'authorship': 'original-six-slots-v1'}


def tense_picture_examples():
    # Forms match the four approved illustrations for each activity.
    actions = [
        ('bicycle', '自転車に', 'a bike', ('乗る', '乗った', '乗っている'), ('ride', 'rode', 'riding', 'ridden')),
        ('pony', 'ポニーに', 'a pony', ('乗る', '乗った', '乗っている'), ('ride', 'rode', 'riding', 'ridden')),
        ('kite', 'たこを', 'a kite', ('あげる', 'あげた', 'あげている'), ('fly', 'flew', 'flying', 'flown')),
        ('rope', 'ロープを', 'rope', ('跳ぶ', '跳んだ', '跳んでいる'), ('jump', 'jumped', 'jumping', 'jumped')),
        ('violin', 'バイオリンを', 'the violin', ('弾く', '弾いた', '弾いている'), ('play', 'played', 'playing', 'played')),
        ('ball', 'ボールを', 'a ball', ('ける', 'けった', 'けっている'), ('kick', 'kicked', 'kicking', 'kicked')),
        ('piano', 'ピアノを', 'the piano', ('弾く', '弾いた', '弾いている'), ('play', 'played', 'playing', 'played')),
        ('flowers', '花に', 'the flowers', ('水をやる', '水をやった', '水をやっている'), ('water', 'watered', 'watering', 'watered')),
        ('paint', '絵を', 'a picture', ('描く', '描いた', '描いている'), ('paint', 'painted', 'painting', 'painted')),
        ('sushi', 'のり巻きを', 'sushi rolls', ('作る', '作った', '作っている'), ('make', 'made', 'making', 'made')),
    ]
    themes = {
        'bicycle': 'theme-go', 'pony': 'theme-go', 'kite': 'theme-play', 'rope': 'theme-play',
        'violin': 'theme-like', 'ball': 'theme-play', 'piano': 'theme-like',
        'flowers': 'theme-stand', 'paint': 'theme-like', 'sushi': 'theme-eat',
    }
    for number, (key, ja_object, en_object, ja, en) in enumerate(actions, 1):
        family = 'tense-' + key
        forms = [('routine', ja[0], en[0]), ('past', ja[1], en[1]),
                 ('ongoing', ja[2], 'am ' + en[2]), ('experience', ja[1] + 'ことがある', 'have ' + en[3])]
        for meaning, verb_ja, verb_en in forms:
            example_id = family if meaning == 'routine' else family + '-' + meaning
            q = make_example(example_id, 'tense-pictures', number, {
                'S': slot('私が', 'I'), 'predicate': slot(verb_ja, verb_en),
                'P': slot(ja_object, en_object), 'place': slot(), 'time': slot()})
            q.update(contrastFamily=family, meaning=meaning, theme=themes[key])
            if key == 'rope':
                action = {'routine': 'する', 'past': 'した', 'ongoing': 'している', 'experience': 'したことがある'}
                q['ja'] = f"私がなわとびを{action[meaning]}。"
            yield q


def additional_be_examples():
    scenes = [
        ('be-noun', 4, ('私は', 'I'), ('クラスの当番です', 'am the class helper'), ('クラスの当番でした', 'was the class helper')),
        ('be-adjective', 4, ('彼女は', 'She'), ('眠いです', 'is sleepy'), ('眠かったです', 'was sleepy')),
        ('be-adjective', 5, ('彼らは', 'They'), ('準備万端です', 'are ready'), ('準備万端でした', 'were ready')),
    ]
    for group, number, subject, current, past in scenes:
        family = f'build-{group}-{number}'
        for suffix, meaning, predicate, time in (
            ('', 'state', current, slot()),
            ('-past', 'past', past, slot('昨日', 'yesterday')),
        ):
            q = make_example(family + suffix, group, number, {
                'S': slot(*subject), 'predicate': slot(*predicate),
                'place': slot(), 'time': time,
            })
            q.update(contrastFamily=family, meaning=meaning)
            if meaning == 'past':
                q['statePredicate'] = True
            annotate_scene(q)
            yield q


def set_predicate_support(q, predicate_labels):
    values = q['slots']
    english = values['predicate']['en']
    be, _, rest = english.partition(' ')
    if q['meaning'] == 'experience':
        assert be == 'have' and values['predicate']['ja'].endswith('ことがある'), q['id']
        values['support'] = slot('ことがある', be)
        values['predicate'] = slot(values['predicate']['ja'].removesuffix('ことがある'), rest)
        return
    if be not in BE_FORMS:
        if q['meaning'] == 'past':
            values['support'] = slot('した')
            values['predicate'] = slot(predicate_labels[q['contrastFamily']], english)
        else:
            values['support'] = slot('する')
        return

    japanese = values['predicate']['ja']
    if q['meaning'] == 'ongoing':
        support = 'である'
        rest_ja = re.sub(r'います$', 'いる', japanese.removesuffix('です'))
        assert rest_ja.endswith(('いる', '途中')), q['id']
    elif q['meaning'] == 'past':
        support = 'であった'
        rest_ja = re.sub(r'かったです$', 'い', japanese).removesuffix('でした')
    else:
        support, rest_ja = 'である', japanese.removesuffix('です')

    assert rest and rest_ja and (q['meaning'] == 'ongoing' or rest_ja != japanese), q['id']
    values['support'] = slot(support, be)
    values['predicate'] = slot(rest_ja, rest)


# The full sentence can use する or describe a continuing state. The card
# names the action and follows the form of the English predicate.
SIMPLE_PREDICATE_LABELS = {
    'play': {'する': '遊ぶ'}, 'ask': {'する': 'たずねる'}, 'make': {'する': 'させる'},
    'live': {'住んでいる': '住む'}, 'wear': {'かぶっている': 'かぶる', '着ている': '着る'},
}
PREDICATE_LABELS = {form: labels for verb, labels in SIMPLE_PREDICATE_LABELS.items()
                    for form in (verb, third(verb), past(verb))}
PREDICATE_LABELS.update({
    'playing': {'している': '遊んでいる'}, 'asking': {'している': 'たずねている'},
    'making': {'している': 'させている'}, 'coming': {'来る途中': '来ている'},
})

# In "talk with | Mom" the second card is just お母さん. In "bread | with Mom"
# the preposition belongs to the second card, so its label is お母さんと.
PREPOSITION_PREFIXES = ('after ', 'at ', 'before ', 'by ', 'for ', 'from ', 'in ', 'inside ', 'into ',
                        'near ', 'next to ', 'on ', 'over ', 'through ', 'to ', 'under ', 'with ')


def japanese_card_label(role, english, japanese):
    word = english.lower().partition(' ')[0]
    if role in {'predicate', '述語', '述語の残り'}:
        if english.lower() in ('walk through', 'walks through', 'walked through'):
            return '歩いて通る'
        if english.lower() == 'walking through':
            return '歩いて通っている'
        label = card(japanese) if japanese.endswith(('ます', 'です')) else japanese
        return PREDICATE_LABELS.get(word, {}).get(label, label)
    if role == 'S':
        return re.sub(r'[はが]$', '', japanese)
    if role in {'P1', 'P2'} and not english.lower().startswith(PREPOSITION_PREFIXES):
        if english == 'happy' and japanese == 'うれしい気持ちに':
            return 'うれしい'
        return re.sub(r'(?:に合わせて|まで|[をにがとの])$', '', japanese)
    if role in {'place', '場所'}:
        if word in {'here', 'outside'}:
            return japanese.removesuffix('で')
        return japanese.removesuffix('は').removesuffix('を')
    if role == '頻度' and word == 'ever':
        return japanese.removesuffix('に')
    return japanese


def build_level2_choices(advanced):
    meanings = advanced['level2ModalMeanings']
    choices = {}

    def label(role, english, japanese):
        if role in {'助動詞', '助動詞＋否定'}:
            return f'{japanese}（{meanings[english]}）'
        return japanese

    for q in advanced['level2']:
        q['blocks'] = [[role, en, label(role, en, ja)] for role, en, ja in q['blocks']]
        for role, en, ja in q['blocks']:
            choices.setdefault(role, {}).setdefault(en, ja)
    for role, alternatives in advanced['level2ExtraChoices'].items():
        for en, ja in alternatives.items():
            choices.setdefault(role, {}).setdefault(en, label(role, en, japanese_card_label(role, en, ja)))
    return choices


def build_examples():
    rows, groups = [], []
    themes = []
    theme = None
    for line in (ROOT / 'data/original-curriculum.txt').read_text(encoding='utf-8').splitlines():
        if line.startswith('@'):
            theme = {'id': '', 'label': line[1:].strip()}
            themes.append(theme)
            continue
        if not line or line.startswith('#'):
            continue
        verb, ja_v, objects, *extra = line.split('|')
        # Keep 98 everyday lexical verbs plus two kinds of be predicates.
        if verb in {'greet', 'tidy'}:
            continue
        if not theme['id']:
            theme['id'] = 'theme-' + verb
        groups.append({'key': verb, 'label': 'wake up' if verb == 'wake' else verb,
                       'ja': ja_v, 'theme': theme['id']})
        objects = [pair(t) for t in objects.split(';')]
        modifiers = [pair(t) for t in extra[0].split(';')] if extra else [('', '')]
        for i, ((ja_s, en_s), (ja_p, en_p)) in enumerate(zip(SUBJECTS, objects)):
            values = {k: slot() for k in ('S', 'predicate', 'P', 'place', 'time')}
            en_v = third_person(verb) if i == 1 else verb
            if verb == 'wake':
                en_v += ' up'
            values['S'] = slot(ja_s, en_s)
            values['predicate'] = slot(ja_v, en_v)
            en_p = own(en_p, i)
            if verb == 'play' and i == 0:
                ja_p, en_p = 'サッカーを', 'soccer'
            if verb == 'walk' and en_p.startswith('through '):
                values['predicate']['ja'] = '歩いていきます'
            ja_m, en_m = modifiers[i if len(modifiers) == 3 else 0]
            en_m = own(en_m, i)

            if verb in SETTING_VERBS or (verb == 'walk' and en_p.startswith('by ')) or (verb == 'dance' and not en_p.startswith('to ')):
                values['place'] = slot(ja_p, en_p)
                ja_p = en_p = ''
            else:
                for connector in CONNECTORS.get(verb, ()):
                    if en_p.startswith(connector):
                        values['predicate']['en'] += ' ' + connector.strip()
                        en_p = en_p[len(connector):]
                        break

            if en_m:
                if verb == 'bake' and en_m.startswith('with '):
                    values['P2'] = slot(ja_m, en_m)
                elif en_m.startswith(('with ', 'for a new ', 'for a bike', 'for a game')) and not (verb == 'wash' and en_m == 'with water'):
                    # P may be a phrase, including another participant or a
                    # purpose. It need not be one noun or a direct object.
                    ja_p = ja_m + ja_p
                    en_p = ' '.join(t for t in (en_p, en_m) if t)
                elif en_m in {'slowly', 'carefully'} or (verb == 'wash' and en_m == 'with water'):
                    # The requested five slots have no manner column. Keep
                    # this draft focused rather than hiding manner in time.
                    pass
                elif en_m == 'here' or en_m.startswith(('in ', 'on the ', 'into ', 'at the ')) and en_m not in {'in the morning', 'in summer'}:
                    values['place'] = slot(ja_m, en_m)
                else:
                    values['time'] = slot(ja_m, en_m)

            values['P'] = slot(ja_p, en_p)
            if verb not in NO_DEFAULTS:
                if not values['place']['en']:
                    if verb in SCHOOL_VERBS:
                        values['place'] = slot('学校で', 'at school')
                    elif verb in OUTDOOR_VERBS:
                        values['place'] = slot('公園で', 'in the park')
                    else:
                        values['place'] = slot('家で', 'at home')
                if not values['time']['en']:
                    values['time'] = slot('授業中に', 'in class') if verb in SCHOOL_VERBS else slot('放課後に', 'after school')

            context = SCENE_CONTEXTS.get(verb, {}) | VARIANT_CONTEXTS.get((verb, i + 1), {})
            values.update({role: slot(*text) for role, text in context.items()})
            if verb == 'ask' and i < 2:
                values['predicate']['ja'] = 'します'
            if verb == 'invite':
                values['P2'] = slot(ja_m, en_m)
            if verb == 'wear':
                values['predicate']['ja'] = 'かぶっています' if i == 0 else '着ています'
            if verb == 'change' and i == 1:
                values['predicate']['ja'] = 'はきかえます'
            rows.append(make_example(f'build-{verb}-{i+1}', verb, i+1, values))

    be_examples = [
        ('be-noun', 'be＋名詞', [
            ('私は', 'I', '生徒です', 'am a student', '', '', '', ''),
            ('姉は', 'My sister', 'お手伝い係です', 'is a helper', '図書館で', 'at the library', '土曜日には', 'on Saturdays'),
            ('私たちは', 'We', 'チームメイトです', 'are teammates', '学校では', 'at school', '', ''),
        ]),
        ('be-adjective', 'be＋形容詞', [
            ('私は', 'I', 'うれしいです', 'am happy', '家で', 'at home', '今日', 'today'),
            ('姉は', 'My sister', 'いそがしいです', 'is busy', '学校で', 'at school', '今日', 'today'),
            ('私たちは', 'We', '静かです', 'are quiet', '図書館で', 'in the library', '放課後は', 'after school'),
        ]),
    ]
    for key, label, examples in be_examples:
        groups.append({'key': key, 'label': label, 'ja': label, 'theme': 'theme-read'})
        for i, (sj, se, rj, re_, lj, le, tj, te) in enumerate(examples, 1):
            rows.append(make_example(f'build-{key}-{i}', key, i, {
                'S': slot(sj, se), 'predicate': slot(rj, re_), 'P': slot(),
                'place': slot(lj, le), 'time': slot(tj, te)}))

    assert len(groups) == 100 and len(rows) == 300
    assert len({q['en'] for q in rows}) == len(rows)
    assert len({q['id'] for q in rows}) == len(rows)
    for q in rows:
        assert q['slots']['S']['en'] and q['slots']['predicate']['en']
        assert all(bool(p['ja']) == bool(p['en']) for p in q['slots'].values()), q['id']
        assert q['en'] == ' '.join(q['slots'][k]['en'] for k in SOURCE_SLOTS if q['slots'][k]['en']) + '.'
        assert q['slots']['time']['en'] not in {'slowly', 'carefully'}
        if q['group'].startswith('be-'):
            assert q['slots']['P1'] == q['slots']['P2'] == slot()

    rows, groups = refine(rows, groups)
    themes.append({'id': 'nature', 'label': '動物と自然'})
    theme_ids = {theme['id'] for theme in themes}
    group_themes = {group['key']: group['theme'] for group in groups if 'theme' in group}
    group_themes.update({
        'pronouns-subject': 'theme-play',
        'pronouns-object': 'theme-play',
        'pronouns-possessive': 'theme-clean',
        'pronouns-independent': 'theme-clean',
        'pronouns-reflexive': 'theme-like',
    })
    scene_themes = {
        'build-be-adjective-1': 'theme-stand',
        'build-be-adjective-4': 'theme-stand',
        'build-like-1': 'theme-eat',
        'build-like-3': 'nature',
        'build-love-1': 'nature',
        'build-love-3': 'nature',
        'build-make-2': 'theme-eat',
        'build-make-3': 'theme-help',
        'build-take-2': 'nature',
    }
    groups.insert(0, {'key': 'tense-pictures', 'label': '10の動作', 'ja': '時制の絵くらべ'})
    rows.extend(tense_picture_examples())
    rows.extend(additional_be_examples())
    predicate_labels = {q['id']: q['slots']['predicate']['ja'] for q in rows}
    for q in rows:
        q['level'] = 1
        if 'theme' not in q:
            q['theme'] = scene_themes.get(q.get('contrastFamily'), group_themes[q['group']])
        set_predicate_support(q, predicate_labels)
        q['blocks'] = [[k, q['slots'][k]['en']] for k in SLOTS if q['slots'][k]['en']]
        assert ' '.join(text for _, text in q['blocks']) + '.' == q['en'], q['id']
    advanced = json.loads((ROOT / 'data/advanced-examples.json').read_text(encoding='utf-8'))
    replacements = advanced.get('derivedReplacements', {})
    derived2, derived3 = derive(rows, advanced['level2ModalMeanings'], advanced['level2'] + advanced['level3'] + list(replacements.values()))
    # Replace individual awkward examples after selection, so revising one scene
    # does not reshuffle the other illustrated exercises.
    assert replacements.keys() <= {q['id'] for q in derived2 + derived3}, 'Unknown derived exercise replacement'
    advanced['level2'] += [replacements.get(q['id'], q) for q in derived2]
    advanced['level3'] += [replacements.get(q['id'], q) for q in derived3]
    # Derivation uses the particles in the full Japanese sentence. Convert to
    # stand-alone cards only after every exercise and its translation exist.
    for q in rows:
        for role, part in q['slots'].items():
            part['ja'] = japanese_card_label(role, part['en'], part['ja'])
    for q in advanced['level2'] + advanced['level3']:
        q['blocks'] = [[role, en, japanese_card_label(role, en, ja)] for role, en, ja in q['blocks']]
    level2_choices = build_level2_choices(advanced)
    for q in advanced['level2']:
        q.setdefault('unit', level2_unit(q))
    for q in advanced['level3']:
        q.setdefault('unit', q['question']['token'] if q.get('question') else 'there')
    for level in (2, 3):
        advanced[f'level{level}'].sort(key=lambda q: tuple(UNITS).index(q['unit']))
    silent_question = {'token': 'whether', 'meaning': 'かどうか', 'spoken': False, 'written': False}
    for level in (2, 3):
        examples = advanced[f'level{level}']
        assert examples
        for q in examples:
            assert q['level'] == level and q['ja'] and q['focus']
            question = q.get('question')
            punctuation = '?' if question else '.'
            if question and not question['spoken']:
                q['blocks'].insert(0, ['question-marker', '', silent_question['meaning']])
            assert ' '.join(text for _, text, _ in q['blocks'] if text) + punctuation == q['en'], q['id']
            japanese_parts = [japanese for _, _, japanese in q['blocks']]
            assert all(japanese_parts) and len(set(japanese_parts)) == len(japanese_parts), q['id']
            if question:
                assert question['spoken'] == (question['token'] != 'whether'), q['id']
                assert 'whether' not in q['en'].lower()
    all_examples = rows + advanced['level2'] + advanced['level3']
    assert len(all_examples) == len({q['id'] for q in all_examples})
    for q in all_examples:
        assert q['theme'] in theme_ids, q['id']

    result = {
        'edition': 'original-six-slots-v2',
        'status': 'draft-for-content-review',
        'audience': '10歳ごろ。基本の単語で英文を組み立てる練習。',
        'roles': {'S': 'だれ・何が', 'support': '助述部', 'predicate': 'どうする・どんな・何である',
                  'P1': '述語につなぐ一つ目', 'P2': '述語につなぐ二つ目',
                  'place': '場所', 'time': '時'},
        'rules': [
            '使わない欄は空欄にする。',
            'go to / look at / listen to などは、つなぎ方まで述語に含める。',
            '一般動詞の助述部は現在の「する」と過去の「した」。過去の肯定文では ate など、述語に過去形を使う。',
            '全レベルの日本語の動詞カードは現在・過去とも辞書形。進行形は「食べている」、現在完了の経験は「食べた」の形にする。',
            '主語と対象のカードでは日本語の文をつなぐ助詞を外す。with Mom の「お母さんと」のように、同じカードの英語が表す関係は残す。',
            '状態や進行形の be は「である」、過去の状態は「であった」を助述部に置く。「食べている」などは述語に入れる。',
            'PはParameter。P1・P2の役割は述語の部品ごとに決まる。',
            '場所は動作や状態の舞台。移動先・置き先・滞在先など、述語が表す意味を補う場所はP1・P2に入れる。',
            '場所・時は基本として文の後ろ。ほかの自然な語順を誤りとはしない。',
            '述語は主語に合わせた形で渡す。三単現やbeの活用を推測させない。',
            '動作の現在形は「いつもの動き」。今している動作はbe＋動作ingという「今の状態」で扱う。',
            'like・want・needなどは現在形で状態を表す。何でも進行形に変えない。',
            'いつも・今・昨日の例は同じcontrastFamilyで対応させ、話し手の今を基準に場面を描く。',
        ],
        'levels': [
            {'id': 1, 'label': 'レベル1：基本の文', 'modals': False, 'negation': False, 'frequency': False, 'questions': False},
            {'id': 2, 'label': 'レベル2：助動詞・否定・頻度', 'modals': True, 'negation': True, 'frequency': True, 'questions': False},
            {'id': 3, 'label': 'レベル3：疑問文と倒置', 'modals': True, 'negation': True, 'frequency': True, 'questions': True},
        ],
        'silentQuestionWord': silent_question,
        'level2Choices': level2_choices,
        'units': UNITS,
        'counts': {'level1': len(rows), 'level2': len(advanced['level2']), 'level3': len(advanced['level3']), 'total': len(all_examples),
                   'core': sum(q.get('contrastFamily') == q['id'] for q in rows), 'pronounPractice': 39,
                   'ongoing': sum(q['meaning'] == 'ongoing' and not q.get('pronounFocus') for q in rows),
                   'past': sum(q['meaning'] == 'past' for q in rows)},
        'themes': themes, 'groups': groups, 'examples': all_examples,
    }
    (ROOT / 'data/construction-examples.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    lines = [f'# レベル1：英文を組み立てる{len(rows)}文', '',
             '基本動詞98種類と「be＋名詞」「be＋形容詞」の原型300文を土台に、いつもの動き・今の動き・昨日の動きを対比し、代名詞の39文も加えました。', '',
             f"内訳：基本{result['counts']['core']}文＋今の動き{result['counts']['ongoing']}文＋過去{result['counts']['past']}文＋経験10文＋代名詞39文。レベル2は{result['counts']['level2']}文、レベル3は{result['counts']['level3']}文です。", '',
             '全部を一度に練習する必要はありません。まず「いつもの動き／状態」の原型を使い、同じcontrastFamilyの「今」「昨日」と比べます。再帰代名詞8文は発展扱いです。', '',
             'S → 助述部 → 述語 → P1 → P2 → 場所 → 時。使わない欄は「—」。これは英文を作るための教材上の区切りです。', '',
             '一般動詞の文は、助述部で現在の「する」か過去の「した」を選びます。どちらも日本語の述語は「食べる」のような辞書形で、英文では eat / ate と変わります。現在進行形の述語は「食べている」、現在完了の経験は「乗った」の形です。状態や進行形の be は「である」、過去の状態は「であった」を助述部で選びます。', '',
             'PはParameter（引数）の教材独自の呼び名です。go to の to は述語側、school はP1側。give は「だれに→何を」、keep は「何を→どんな状態に」をP1・P2に入れます。be＋名詞・形容詞の文ではP1・P2を空欄にします。', '',
             '場面全体の場所は［場所］へ入れます。come の行き先や live の居住先は［対象１］、put の置き先は［対象２］へ入れます。', '',
             '場所と時の両方を常に付ける必要はありません。主語に合う述語の形をそのまま練習します。', '',
             '例文は本教材用に新しく作成したものです。画像の更新は行っていません。', '',
             'レベル1：基本の文。レベル2：助動詞・否定・頻度。レベル3：疑問文と倒置。', '',
             '「かどうか」は疑問文の先頭に置く教材上の目印（黙疑問主部）です。英文では書かず、発音もしません。S以外をたずねる直接疑問文では助動詞・be・doを主語の前に出します。SをたずねるwhoはSの位置に入ります。', '',
             f"追加例文：[レベル2・{result['counts']['level2']}文](level2-examples.md) / [レベル3・{result['counts']['level3']}文](level3-examples.md)", '']
    for group in groups:
        lines.extend([f"## {group['label']}：{group['ja']}", '',
                      '| 捉え方 | S | 助述部 | 述語 | P1 | P2 | 場所 | 時 |', '| --- | --- | --- | --- | --- | --- | --- | --- |'])
        examples = [q for q in rows if q['group'] == group['key']]
        for q in examples:
            label = {'routine': 'いつもの動き', 'ongoing': '今している', 'past': '過去の動き' if q['group'] == 'tense-pictures' else '昨日した', 'experience': 'したことがある', 'state': '状態'}[q['meaning']]
            parts = [q['slots'][k]['en'] or q['slots'][k]['ja'] or '—' for k in SLOTS]
            lines.append('| ' + label + ' | ' + ' | '.join(parts) + ' |')
        lines.append('')
        for q in examples:
            lines.append(f"- {q['en']} — {q['ja']}")
            if q.get('note'):
                lines.append('  補足：' + q['note'])
            if q.get('pronounFocus'):
                lines.append('  場面：' + q['scene']['viewpoint'])
        lines.append('')
    (ROOT / 'docs/construction-examples.md').write_text('\n'.join(lines), encoding='utf-8')
    for level in (2, 3):
        title = '助動詞・否定・頻度' if level == 2 else '疑問文と倒置'
        exercises = advanced[f'level{level}']
        lines = [f'# レベル{level}：{title}・{len(exercises)}文', '',
                 '日本語のカードを、できあがる英文の順に並べます。', '',
                 f'「元の文」がある例の多くは、レベル1の場面から組み合わせごとに{PER_CELL}文ずつ自動で作りました。これらにはまだ絵がありません。', '']
        if level == 2:
            lines.extend(['can・might・must・should のグループから始め、そのあとで「ふだん・過去・今・状態・経験」の否定と、頻度を練習します。', '',
                          '助動詞は、場面に合う日本語に、その助動詞に共通する意味を括弧で添えます。', ''])
        else:
            lines.extend(['疑問文の練習では、先頭に「なに（何）」「だれ（誰）」「かどうか」などの疑問主部を置きます。主語以外をたずねる文では、その次に最初の助述部を置きます。', '',
                          '前へ出るのは助述部１だけです。画面では主語のあとに元の席を「空席」の枠として残し、「いつも」や助述部２（Can you always be happy? の always と be）はその空席のところに残します。', '',
                          '「かどうか」（黙疑問主部 whether）は練習用の目印です。完成英文や読み上げには含めません。', '',
                          'Who が主語で一般動詞が続く文では、練習で黙助述部の「する」を置きます。完成英文は Who gives … のように続きます。Who can ride a bike? の can は声に出します。', '',
                          'There で始まる文では、主部（仮）の「ほら」、助述部の「いる」、続いて見つけたものを置きます。There は疑問主部と同じく、先頭で主語の場所をふさぐ部品です。', ''])
        active_unit = None
        for number, q in enumerate(exercises, 1):
            if q['unit'] != active_unit:
                active_unit = q['unit']
                lines.extend([f"## {UNITS[active_unit]}", ''])
            heading = '###'
            review_mark = ' ［要見直し］' if q.get('needsReview') else ''
            lines.extend([f"{heading} {number:02}　{q['focus']}{review_mark}", '', q['ja'], '', f"**{q['en']}**", ''])
            if q.get('base'):
                lines.extend([f"元の文：{q['base']}", ''])
            labels = {'question-marker': '疑問主部', 'support': '助述部', 'there': '主部（仮）'}
            lines.extend(['| ' + ' | '.join(labels.get(role, role) for role, _, _ in q['blocks']) + ' |',
                          '| ' + ' | '.join('---' for _ in q['blocks']) + ' |',
                          '| ' + ' | '.join(japanese for _, _, japanese in q['blocks']) + ' |',
                          '| ' + ' | '.join(text or '（発音なし）' for _, text, _ in q['blocks']) + ' |', ''])
            if q.get('note'):
                lines.extend([q['note'], ''])
        (ROOT / f'docs/level{level}-examples.md').write_text('\n'.join(lines), encoding='utf-8')
    comparison = ['# いつもの動き・今の動き・昨日の動き', '',
                  '話し手の「今」を基準にします。現在形をすべて「今の動作」と解釈せず、動作と状態を分けます。', '',
                  '| いつもの動き | 今の動き（今の状態） | 昨日の動き |', '| --- | --- | --- |']
    for key in ('go', 'swim', 'read', 'write', 'give', 'make'):
        family = next(q['contrastFamily'] for q in rows if q['group'] == key and q['meaning'] == 'routine')
        trio = {q['meaning']: q for q in rows if q.get('contrastFamily') == family}
        comparison.append('| ' + ' | '.join(trio[mode]['en'] for mode in ('routine', 'ongoing', 'past')) + ' |')
    comparison.extend(['', '## 状態を述べる文', '',
                       'like・love・want・need・liveなどの文や、be＋名詞・形容詞の文は、そのまま現在の状態を述べます。今回は機械的に進行形にしません。', '',
                       '## 絵の共通ルール', '',
                       '- 吹き出しの外は原則として話し手一人。you や your などで相手を指すときは、星の髪飾りの女の子が聞き手になる。「あなたたち」では紫の服の女の子も聞き手に加わる。',
                       '- 話し手を吹き出しの外に置き、中の人物と同じ服・目印で結ぶとIになる。',
                       '- 聞き手ならyou。話し手を含むグループならwe、含まない第三者のグループならthey。',
                       '- 吹き出しは直角の四隅と三角の突起を保つ。枠線と背景の色は変更可。現在は話し手の右、過去は左。進行は左に同じ高さ・濃さの4本線、話し手は真下からやや上を見る。経験は左の場面から話し手に向けて4本線が低く薄くなる。',
                       '- 単語だけで一意に決まらない関係は、話し手・聞き手・指さし・持ち主の名札で補う。',
                       '- 所有を表すitsは名詞とセットにする。独立した「それのもの」にitsを使う練習は作らない。', '',
                       '各例文のsceneに描画用の人物関係・時間の目印を保存しています。', ''])
    (ROOT / 'docs/action-state-contrasts.md').write_text('\n'.join(comparison), encoding='utf-8')
    print(f"Wrote level 1: {len(rows)} examples; level 2: {result['counts']['level2']}; level 3: {result['counts']['level3']}. Total: {len(all_examples)}.")
    print(json.dumps(result['counts'], ensure_ascii=False))


if __name__ == '__main__':
    build_examples()
