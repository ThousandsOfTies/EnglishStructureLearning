"""Create the original 300-example draft using five construction slots.

This is a learning representation, not a claim that its slots are traditional
syntactic constituents. Empty slots are meaningful and remain empty.
"""
import json
import re
from pathlib import Path

from compile_original import SUBJECTS, pair, third_person
from refine_curriculum import refine

ROOT = Path(__file__).resolve().parents[1]
SLOTS = ('S', 'predicate', 'P1', 'P2', 'place', 'time')

# Prepositions that belong to the construction being practised. A location
# after a posture/state verb is instead kept together in the place slot.
CONNECTORS = {
    'go': ('to ',), 'come': ('to ',),
    'walk': ('to ', 'through '), 'jump': ('over ',),
    'wait': ('for ',), 'listen': ('to ',), 'look': ('at ',),
    'talk': ('with ',), 'call': (), 'pay': ('for ',),
    'dance': ('to ',),
}
LOCATION_VERBS = {'run', 'swim', 'sit', 'stand', 'sleep', 'rest', 'stay', 'live'}
SCHOOL_VERBS = {'write', 'draw', 'color', 'count', 'study', 'learn', 'spell',
                'answer', 'ask', 'thank', 'join', 'teach'}
OUTDOOR_VERBS = {'jump', 'fly', 'ride', 'climb', 'find'}
NO_DEFAULTS = {'go', 'come', 'walk', 'stay', 'live', 'like', 'love', 'want',
               'need', 'see', 'hear', 'feel', 'visit', 'meet', 'call', 'save'}


def slot(ja='', en=''):
    return {'ja': ja, 'en': en}


def own(text, variant):
    return re.sub(r'\bmy\b', ('my', 'her', 'our')[variant], text)


def make_example(key, group, number, values):
    values['P1'] = values.pop('P', slot())
    values['P2'] = slot()
    double = {
        'give': [('弟に', 'my brother', 'シールを', 'a sticker'), ('友だちに', 'her friend', 'カードを', 'a card'), ('妹に', 'our sister', '花を', 'a flower')],
        'send': [('おばあちゃんに', 'Grandma', 'カードを', 'a card'), ('友だちに', 'her friend', '手紙を', 'a letter'), ('お父さんに', 'Dad', '写真を', 'a photo')],
        'show': [('お母さんに', 'Mom', '絵を', 'my picture'), ('友だちに', 'her friend', '地図を', 'a map'), ('弟に', 'our brother', 'ロボットを', 'a robot')],
        'tell': [('妹に', 'my sister', '予定を', 'the plan'), ('友だちに', 'her friend', '答えを', 'the answer'), ('お父さんに', 'Dad', '時刻を', 'the time')],
        'ask': [('先生に', 'the teacher', '質問を', 'a question'), ('お父さんに', 'Dad', '質問を', 'a question'), ('友だちに', 'our friend', '名前を', 'their name')],
        'teach': [('弟に', 'my brother', '新しいゲームを', 'a new game'), ('友だちに', 'her friend', '歌を', 'a song'), ('妹に', 'our sister', 'ダンスを', 'a dance')],
    }
    frame = 'one-parameter' if values['P1']['en'] else 'no-parameter'
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
    en = ' '.join(values[k]['en'] for k in SLOTS if values[k]['en']) + '.'
    # Japanese phrase order differs from the English construction order.
    ja = ''.join(values[k]['ja'] for k in ('S', 'time', 'place', 'P1', 'P2', 'predicate')) + '。'
    return {'id': key, 'group': group, 'variant': number, 'slots': values,
            'ja': ja, 'en': en, 'frame': frame, 'authorship': 'original-six-slots-v1'}


def tense_picture_examples():
    # Forms match the four approved illustrations for each activity.
    actions = [
        ('bicycle', '自転車に', 'a bike', ('乗る', '乗った', '乗っている'), ('ride', 'rode', 'riding', 'ridden')),
        ('pony', 'ポニーに', 'a pony', ('乗る', '乗った', '乗っている'), ('ride', 'rode', 'riding', 'ridden')),
        ('kite', 'たこを', 'a kite', ('あげる', 'あげた', 'あげている'), ('fly', 'flew', 'flying', 'flown')),
        ('rope', '', '', ('なわとびをする', 'なわとびをした', 'なわとびをしている'), ('jump rope', 'jumped rope', 'jumping rope', 'jumped rope')),
        ('violin', 'バイオリンを', 'the violin', ('弾く', '弾いた', '弾いている'), ('play', 'played', 'playing', 'played')),
        ('ball', 'ボールを', 'a ball', ('ける', 'けった', 'けっている'), ('kick', 'kicked', 'kicking', 'kicked')),
        ('piano', 'ピアノを', 'the piano', ('弾く', '弾いた', '弾いている'), ('play', 'played', 'playing', 'played')),
        ('flowers', '花に', 'the flowers', ('水をやる', '水をやった', '水をやっている'), ('water', 'watered', 'watering', 'watered')),
        ('paint', '絵を', 'a picture', ('描く', '描いた', '描いている'), ('paint', 'painted', 'painting', 'painted')),
        ('sushi', 'のり巻きを', 'sushi rolls', ('作る', '作った', '作っている'), ('make', 'made', 'making', 'made')),
    ]
    for number, (key, ja_object, en_object, ja, en) in enumerate(actions, 1):
        family = 'tense-' + key
        forms = [('routine', ja[0], en[0]), ('past', ja[1], en[1]),
                 ('ongoing', ja[2], 'am ' + en[2]), ('experience', ja[1] + 'ことがある', 'have ' + en[3])]
        for meaning, verb_ja, verb_en in forms:
            example_id = family if meaning == 'routine' else family + '-' + meaning
            q = make_example(example_id, 'tense-pictures', number, {
                'S': slot('私が', 'I'), 'predicate': slot(verb_ja, verb_en),
                'P': slot(ja_object, en_object), 'place': slot(), 'time': slot()})
            q.update(contrastFamily=family, meaning=meaning)
            yield q


def build_examples():
    rows, groups = [], []
    for line in (ROOT / 'data/original-curriculum.txt').read_text(encoding='utf-8').splitlines():
        if not line or line.startswith(('#', '@')):
            continue
        verb, ja_v, objects, *extra = line.split('|')
        # Keep 98 everyday lexical verbs plus two kinds of be predicates.
        if verb in {'greet', 'tidy'}:
            continue
        groups.append({'key': verb, 'label': 'wake up' if verb == 'wake' else verb,
                       'ja': ja_v})
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
            if verb == 'change' and i == 2:
                en_p = 'our jackets'
            ja_m, en_m = modifiers[i if len(modifiers) == 3 else 0]
            en_m = own(en_m, i)

            if verb in LOCATION_VERBS or (verb == 'walk' and en_p.startswith('by ')) or (verb == 'dance' and not en_p.startswith('to ')):
                values['place'] = slot(ja_p, en_p)
                ja_p = en_p = ''
            elif verb == 'come' and en_p == 'here':
                values['place'] = slot(ja_p, en_p)
                ja_p = en_p = ''
            else:
                for connector in CONNECTORS.get(verb, ()):
                    if en_p.startswith(connector):
                        values['predicate']['en'] += ' ' + connector.strip()
                        en_p = en_p[len(connector):]
                        break

            if en_m:
                if en_m.startswith(('with ', 'for a new ', 'for a bike', 'for a game')) and not (verb == 'wash' and en_m == 'with water'):
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

            # Context-specific wording: do not mechanically add a location to
            # a destination, a home, or an already complete time expression.
            if verb == 'bring':
                values['place'] = slot('学校に', 'to school')
                values['time'] = slot('毎日', 'every day')
            if verb == 'put':
                values['time'] = slot('放課後に', 'after school')
            if verb == 'wake':
                values['place'] = slot('家で', 'at home')
            if verb == 'eat':
                values['place'] = slot('家で', 'at home')
            if verb == 'wait':
                values['time'] = slot('放課後に', 'after school')
            if verb == 'count' and i == 0:
                values['place'] = slot('庭で', 'in the garden')
                values['time'] = slot('夜に', 'at night')
            if verb == 'look' and i == 0:
                values['place'] = slot('庭で', 'in the garden')
                values['time'] = slot('夜に', 'at night')
            if verb == 'play':
                values['place'] = slot('公園で', 'in the park') if i < 2 else slot('家で', 'at home')
            if verb == 'open' and i == 0:
                values['place'] = slot('学校で', 'at school')
                values['time'] = slot('昼食のときに', 'at lunchtime')
            if verb == 'hold':
                values['place'] = slot('外で', 'outside')
            if verb == 'take':
                values['place'] = slot('通りで', 'on the street')
            if verb == 'ask':
                if i < 2:
                    values['predicate']['ja'] = 'します'
                if i == 1:
                    values['place'] = slot('家で', 'at home')
                    values['time'] = slot('夕食のあとに', 'after dinner')
            if verb == 'thank' and i == 1:
                values['place'] = slot('家で', 'at home')
                values['time'] = slot('夕食のあとに', 'after dinner')
            if verb == 'invite':
                # 'to my birthday party' is an invitation target, not a time.
                values['P'] = slot(ja_m + ja_p, en_p + ' ' + en_m)
                values['place'] = slot('家で', 'at home')
                values['time'] = slot('放課後に', 'after school')
            if verb == 'teach':
                values['place'] = slot('家で', 'at home')
                values['time'] = slot('放課後に', 'after school')
            if verb == 'follow':
                values['place'] = slot('公園で', 'in the park')
            if verb == 'try':
                values['place'] = slot('学校で', 'at school')
            if verb == 'build' and i == 0:
                values['place'] = slot('浜辺で', 'on the beach')
            if verb == 'clean' and i == 2:
                values['place'] = slot('学校で', 'at school')
                values['time'] = slot('放課後に', 'after school')
            if verb == 'wear':
                values['predicate']['ja'] = 'かぶっています' if i == 0 else '着ています'
                values['place'] = slot('公園で', 'in the park')
                values['time'] = slot('日曜日に', 'on Sundays')
            if verb == 'buy':
                values['place'] = slot('お店で', 'at a shop')
            if verb == 'pay':
                values['place'] = slot('駅で', 'at the station') if i == 0 else slot('お店で', 'at a shop')
            rows.append(make_example(f'build-{verb}-{i+1}', verb, i+1, values))

    be_examples = [
        ('be-noun', 'be＋名詞', [
            ('私は', 'I', '生徒です', 'am a student', '', '', '', ''),
            ('姉は', 'My sister', 'お手伝い係です', 'is a helper', '図書館で', 'at the library', '土曜日には', 'on Saturdays'),
            ('私たちは', 'We', 'チームメイトです', 'are teammates', '学校では', 'at school', '', ''),
        ]),
        ('be-adjective', 'be＋形容詞', [
            ('私は', 'I', 'うれしいです', 'am happy', '家で', 'at home', '今日は', 'today'),
            ('姉は', 'My sister', 'いそがしいです', 'is busy', '学校で', 'at school', '今日は', 'today'),
            ('私たちは', 'We', '静かです', 'are quiet', '図書館で', 'in the library', '放課後は', 'after school'),
        ]),
    ]
    for key, label, examples in be_examples:
        groups.append({'key': key, 'label': label, 'ja': label})
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
        assert q['en'] == ' '.join(q['slots'][k]['en'] for k in SLOTS if q['slots'][k]['en']) + '.'
        assert q['slots']['time']['en'] not in {'slowly', 'carefully'}
        if q['group'].startswith('be-'):
            assert q['slots']['P1'] == q['slots']['P2'] == slot()

    rows, groups = refine(rows, groups)
    groups.insert(0, {'key': 'tense-pictures', 'label': '10の動作', 'ja': '時制の絵くらべ'})
    rows.extend(tense_picture_examples())
    for q in rows:
        q['level'] = 1
        q['blocks'] = [[k, q['slots'][k]['en']] for k in SLOTS if q['slots'][k]['en']]
    advanced = json.loads((ROOT / 'data/advanced-examples.json').read_text(encoding='utf-8'))
    for level in (2, 3):
        examples = advanced[f'level{level}']
        assert len(examples) == 10
        for q in examples:
            assert q['level'] == level and q['ja'] and q['focus']
            punctuation = '?' if level == 3 else '.'
            assert ' '.join(text for _, text in q['blocks']) + punctuation == q['en'], q['id']
            if level == 3:
                assert q['question']['spoken'] == (q['question']['token'] != 'whether')
                assert 'whether' not in q['en'].lower()
    all_examples = rows + advanced['level2'] + advanced['level3']
    assert len(all_examples) == len({q['id'] for q in all_examples}) == len(rows) + 20

    result = {
        'edition': 'original-six-slots-v2',
        'status': 'draft-for-content-review',
        'audience': '10歳ごろ。基本の単語で英文を組み立てる練習。',
        'roles': {'S': 'だれ・何が', 'predicate': 'どうする・どんな・何である',
                  'P1': '述語につなぐ一つ目', 'P2': '述語につなぐ二つ目',
                  'place': '場所', 'time': '時'},
        'rules': [
            '空欄は正しい。六つの欄を無理に埋めない。',
            'go to / look at / listen to などは、つなぎ方まで述語に含める。',
            'be＋名詞・be＋形容詞は、この練習では全体を述語に入れる。',
            'PはParameter。P1・P2の役割は述語の部品ごとに決まる。',
            '場所・時は基本として文の後ろ。ほかの自然な語順を誤りとはしない。',
            '述語は主語に合わせた形で渡す。三単現やbeの活用を推測させない。',
            '動作の現在形は「いつもの動き」。今している動作はbe＋動作ingという「今の状態」で扱う。',
            'like・want・needなどは現在形で状態を表す。何でも進行形に変えない。',
            'いつも・今・昨日の例は同じcontrastFamilyで対応させ、話し手の今を基準に場面を描く。',
        ],
        'levels': [
            {'id': 1, 'label': 'レベル1：基本の文', 'modals': False, 'negation': False, 'frequency': False, 'questions': False},
            {'id': 2, 'label': 'レベル2：助動詞・否定・頻度', 'modals': True, 'negation': True, 'frequency': True, 'questions': False},
            {'id': 3, 'label': 'レベル3：疑問文', 'modals': True, 'negation': True, 'frequency': True, 'questions': True},
        ],
        'silentQuestionWord': {'token': 'whether', 'meaning': '〜かどうか', 'spoken': False, 'written': False},
        'counts': {'level1': len(rows), 'level2': 10, 'level3': 10, 'total': len(all_examples),
                   'core': sum(q.get('contrastFamily') == q['id'] for q in rows), 'pronounPractice': 39,
                   'ongoing': sum(q['meaning'] == 'ongoing' and not q.get('pronounFocus') for q in rows),
                   'past': sum(q['meaning'] == 'past' for q in rows)},
        'groups': groups, 'examples': all_examples,
    }
    (ROOT / 'data/construction-examples.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    lines = [f'# レベル1：英文を組み立てる{len(rows)}文', '',
             '基本動詞98種類と「be＋名詞」「be＋形容詞」の原型300文を土台に、いつもの動き・今の動き・昨日の動きを対比し、代名詞の39文も加えました。', '',
             f"内訳：基本{result['counts']['core']}文＋今の動き{result['counts']['ongoing']}文＋過去{result['counts']['past']}文＋経験10文＋代名詞39文。レベル2・3は別に各10文です。", '',
             '全部を一度に練習する必要はありません。まず「いつもの動き／状態」の原型を使い、同じcontrastFamilyの「今」「昨日」と比べます。再帰代名詞8文は発展扱いです。', '',
             '「doに動作を渡す」は習慣・行為の捉え方を説明する比喩です。肯定文にdoを実際に追加するルールではありません。', '',
             'S → 述語 → P1 → P2 → 場所 → 時。使わない欄は「—」。これは英文を作るための教材上の区切りです。', '',
             'PはParameter（引数）の教材独自の呼び名です。go to の to は述語側、school はP1側。give は「だれに→何を」、keep は「何を→どんな状態に」をP1・P2に入れます。be＋名詞・形容詞の文ではP1・P2を空欄にします。', '',
             '場所と時の両方を常に付ける必要はありません。主語に合う述語の形をそのまま練習します。', '',
             '例文は本教材用に新しく作成したものです。画像の更新は行っていません。', '',
             'レベル1：基本の文。レベル2：助動詞・否定・頻度。レベル3：疑問文。', '',
             'whether は「〜かどうか」を問う内部の目印（黙疑問詞）。英文では書かず、発音もしません。S以外をたずねる直接疑問文では助動詞・be・doを主語の前に出します。SをたずねるwhoはSの位置に入ります。', '',
             '追加例文：[レベル2・10文](level2-examples.md) / [レベル3・10文](level3-examples.md)', '']
    for group in groups:
        lines.extend([f"## {group['label']}：{group['ja']}", '',
                      '| 捉え方 | S | 述語 | P1 | P2 | 場所 | 時 |', '| --- | --- | --- | --- | --- | --- | --- |'])
        examples = [q for q in rows if q['group'] == group['key']]
        for q in examples:
            label = {'routine': 'いつもの動き', 'ongoing': '今している', 'past': '過去の動き' if q['group'] == 'tense-pictures' else '昨日した', 'experience': 'したことがある', 'state': '状態'}[q['meaning']]
            lines.append('| ' + label + ' | ' + ' | '.join(q['slots'][k]['en'] or '—' for k in SLOTS) + ' |')
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
        title = '助動詞・否定・頻度' if level == 2 else '疑問文'
        lines = [f'# レベル{level}：{title}・10文', '',
                 '元の文をどう変えるか、意味のブロックと完成した英文の両方で確かめます。', '',
                 'ブロックは実際に発音する順です。beは主語や助動詞に合わせて変わり、否定・頻度の位置も調整します。', '']
        if level == 3:
            lines.extend(['黙疑問詞 whether は「〜かどうか」を問う内部の目印です。下のブロックや完成英文には表示せず、読み上げもしません。これは本教材独自の構築モデルで、英文法上の省略された語という主張ではありません。', '',
                          'whoがSをたずねる場合は、肯定の文ではdoを足さず、Sと述語の順を入れ替えません。P1をたずねるwhoとは区別します。', ''])
        for number, q in enumerate(advanced[f'level{level}'], 1):
            lines.extend([f"## {number:02}　{q['focus']}", '', q['ja'], '',
                          f"**{q['en']}**", '', f"元の文：{q['base']}", '',
                          '| ' + ' | '.join(role for role, _ in q['blocks']) + ' |',
                          '| ' + ' | '.join('---' for _ in q['blocks']) + ' |',
                          '| ' + ' | '.join(text for _, text in q['blocks']) + ' |', ''])
            if level == 3 and not q['question']['spoken']:
                lines.extend(['内部の問い：whether「〜かどうか」（表示・発音なし）', ''])
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
                       '- 話し手を吹き出しの外に置き、中の人物と同じ服・目印で結ぶとIになる。',
                       '- 聞き手ならyou。話し手を含むグループならwe、含まない第三者のグループならthey。',
                       '- 吹き出しは直角の四隅と三角の突起を保つ。枠線と背景の色は変更可。現在は話し手の右、過去は左。進行は左に同じ高さ・濃さの4本線、話し手は真下からやや上を見る。経験は左の場面から話し手に向けて4本線が低く薄くなる。',
                       '- 単語だけで一意に決まらない関係は、話し手・聞き手・指さし・持ち主の名札で補う。',
                       '- 所有を表すitsは名詞とセットにする。独立した「それのもの」にitsを使う練習は作らない。', '',
                       '各例文のsceneに描画用の人物関係・時間の目印を保存しています。画像自体は生成・差し替えしていません。', ''])
    (ROOT / 'docs/action-state-contrasts.md').write_text('\n'.join(comparison), encoding='utf-8')
    print(f'Wrote level 1: {len(rows)} examples; level 2: 10; level 3: 10. Total: {len(all_examples)}.')
    print(json.dumps(result['counts'], ensure_ascii=False))


if __name__ == '__main__':
    build_examples()
