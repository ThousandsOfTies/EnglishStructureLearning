"""Add explicit viewpoints and contrasts of routine, ongoing action and past.

The classroom labels describe meaning. They do not rename the linguistic
present tense or insert a spoken 'do' into affirmative sentences.
"""
from copy import deepcopy
import re

SLOTS = ('S', 'predicate', 'P1', 'P2', 'place', 'time')
SUBJECTS = [('私は', 'I'), ('あなたは', 'You'), ('彼は', 'He'), ('彼女は', 'She'),
            ('それは', 'It'), ('私たちは', 'We'), ('彼らは', 'They')]
POSSESSIVES = ['my', 'your', 'his', 'her', 'its', 'our', 'their']
STATIVE = {'like', 'love', 'want', 'need', 'hear', 'see', 'feel', 'live'}
ROBOT_ACTIONS = {'go', 'come', 'walk', 'run', 'jump', 'move', 'stop', 'start',
                 'wait', 'read', 'write', 'draw', 'color', 'count', 'spell',
                 'answer', 'sing', 'dance', 'watch', 'listen', 'look', 'touch',
                 'open', 'close', 'push', 'pull', 'turn', 'lift', 'carry',
                 'hold', 'put', 'take', 'bring', 'send', 'show', 'tell',
                 'ask', 'talk', 'speak', 'help', 'follow', 'choose', 'make',
                 'build', 'use', 'fix', 'clean', 'keep', 'find', 'check'}
# Finding a single object is an achievement, not a sustained activity scene.
NO_PROGRESSIVE = {'find'}
# Refer to the people visible in the illustration when kinship has no visual cue.
PICTURE_PERSON_REFERENCES = {
    'build-wait-3': ('女の人を', 'the woman'),
    'build-give-1': ('彼に', 'him'),
    'build-give-3': ('彼女に', 'her'),
    'build-show-3': ('彼に', 'him'),
    'build-tell-1': ('私に', 'me'),
    'build-help-3': ('彼女を', 'her'),
    'build-meet-2': ('私に', 'me'),
    'build-visit-2': ('彼のところに', 'him'),
    'build-invite-2': ('誕生日会に男の子を', 'the boy to the birthday party'),
    'build-teach-1': ('彼に', 'him'),
    'build-teach-3': ('彼女に', 'her'),
    'build-follow-2': ('男の人に', 'the man'),
    'build-make-3': ('彼女を', 'her'),
}
IRREGULAR_PAST = dict(zip(
    'go come run swim fly ride sit stand sleep wake eat drink cut read write draw sing hear see feel hold put take give get bring send tell speak meet teach choose make build wear buy pay keep find'.split(),
    'went came ran swam flew rode sat stood slept woke ate drank cut read wrote drew sang heard saw felt held put took gave got brought sent told spoke met taught chose made built wore bought paid kept found'.split()))


def pair(ja='', en=''):
    return {'ja': ja, 'en': en}


def third(verb):
    if verb.endswith('y') and verb[-2] not in 'aeiou':
        return verb[:-1] + 'ies'
    return verb + ('es' if verb.endswith(('s', 'sh', 'ch', 'x', 'o')) else 's')


def past(verb):
    if verb in IRREGULAR_PAST:
        return IRREGULAR_PAST[verb]
    if verb == 'stop':
        return 'stopped'
    if verb.endswith('e'):
        return verb + 'd'
    if verb.endswith('y') and verb[-2] not in 'aeiou':
        return verb[:-1] + 'ied'
    return verb + 'ed'


def ing(verb):
    if verb in {'run', 'swim', 'sit', 'stop', 'get', 'put', 'cut'}:
        return verb + verb[-1] + 'ing'
    if verb.endswith('e') and not verb.endswith('ee'):
        return verb[:-1] + 'ing'
    return verb + 'ing'


def ja_ongoing(text):
    if text.endswith('ています'):
        return text
    for ending, replacement in [
        ('持ってきます', '持ってきています'), ('やってみます', '試しています'),
        ('しまっておきます', 'しまっています'), ('ついていきます', 'ついて行っています'),
        ('行きます', '行っています'), ('いきます', 'いっています'),
        ('来ます', '来ています'), ('起きます', '起きています'),
        ('ぎます', 'いでいます'), ('きます', 'いています'),
        ('びます', 'んでいます'), ('みます', 'んでいます'),
        ('ります', 'っています'), ('ちます', 'っています'),
        ('います', 'っています'), ('します', 'しています'), ('ます', 'ています'),
    ]:
        if text.endswith(ending):
            return text[:-len(ending)] + replacement
    raise ValueError(f'No ongoing form: {text}')


def japanese_sentence(values, frame):
    # Keep words for place before the object in the Japanese prompts.
    parameters = ('P2', 'P1') if frame == 'object-location' else ('P1', 'P2')
    return ''.join(values[k]['ja'] for k in ('S', 'time', 'place', *parameters, 'predicate')) + '。'


def rebuild(q):
    values = q['slots']
    q['en'] = ' '.join(values[k]['en'] for k in SLOTS if values[k]['en']) + '.'
    q['ja'] = japanese_sentence(values, q['frame'])
    q['level'] = 1
    q['blocks'] = [[k, values[k]['en']] for k in SLOTS if values[k]['en']]
    return q


def has_second_person(sentence):
    return re.search(r'\b(?:you|your|yours|yourself|yourselves)\b', sentence, re.IGNORECASE) is not None


def viewpoint(subject):
    explanation = {
        'I': '外の話し手と、吹き出しの中の主人公は同じ人。服・髪型・目印をそろえる。',
        'You': '外の男の子が、主役の女の子に話す。吹き出しの中でも、聞き手には同じ目印を使う。',
        'He': '主役の女の子が話し手。heで指す男の子を吹き出しの中に描く。',
        'She': '主役の女の子が話し手。sheで指す別の女の子を吹き出しの中に描く。',
        'It': '話し手が指す小さなロボットを、吹き出しの中にも同じ目印で描く。人間にはitを使わない。',
        'We': '吹き出しの中のグループに、外の話し手と同じ人物を含める。',
        'They': '吹き出しの中には、外の話し手とは別のグループを描く。',
    }
    result = {'speaker': '吹き出しの外にいる話し手', 'subjectReference': subject, 'viewpoint': explanation[subject]}
    if subject == 'You':
        result['listener'] = '星の髪飾りを付けた主役の女の子'
    return result


def annotate_scene(q):
    q['scene'] = viewpoint(q['slots']['S']['en'])
    mode = q['meaning']
    past_time = q['slots']['time']['ja'] if mode == 'past' else ''
    q['scene'].update({
        'speakerTime': '今', 'eventTime': {'routine': '繰り返す日々', 'ongoing': '今', 'past': past_time, 'state': '今の状態'}[mode],
        'timeCue': {
            'routine': '複数の日の小コマとカレンダーで、同じ動作を繰り返す。今一度だけの動作と混同しない。',
            'ongoing': '吹き出しの外も中も「今」。動作の途中を描く。',
            'past': f'外の話し手は「今日・今」、中の出来事は「{past_time}」。時点の違いを目印で示す。',
            'state': '今の気持ち・関係・身分・持続する状態。無理に動作の途中にしない。',
        }[mode],
    })


def refine(rows, groups):
    refined = []
    for index, original in enumerate(rows):
        q = deepcopy(original)
        subject_index = index % len(SUBJECTS)
        # A robot can perform actions, but cannot have human kinship. Preserve
        # human participants for family references and personal relationships.
        family = re.search(r'\b(?:sister|brother|Mom|Dad|Grandma|Grandpa|cousin|friend|neighbor|birthday)\b', q['en'])
        if subject_index == 4 and (family or q['group'] not in ROBOT_ACTIONS):
            subject_index = 2
        ja_s, en_s = SUBJECTS[subject_index]
        previous_possessive = ['my', 'her', 'our'][q['variant'] - 1]
        possessive = POSSESSIVES[subject_index]
        for role in ('P1', 'P2', 'place'):
            value = q['slots'][role]
            value['en'] = re.sub(r'\b' + previous_possessive + r'\b', possessive, value['en'])
        if q['id'] in PICTURE_PERSON_REFERENCES:
            q['slots']['P1'] = pair(*PICTURE_PERSON_REFERENCES[q['id']])
        if q['group'] == 'wear' and en_s in {'We', 'They'}:
            item = q['slots']['P1']
            item['en'] = item['en'].removeprefix('a ') + 's'
        if q['id'] == 'build-ask-3':
            q['slots']['P1'] = pair('新しいクラスメートに', 'a new classmate')
            q['slots']['place'] = pair()
        # 'our friend' refers to one common friend; do not require plural nouns.
        q['slots']['S'] = pair(ja_s, en_s)
        old_predicate = q['slots']['predicate']['en']
        is_be = q['group'].startswith('be-')
        if is_be:
            rest = old_predicate.split(' ', 1)[1]
            if q['group'] == 'be-noun':
                if en_s in {'We', 'They', 'You'}:
                    rest = {'a student': 'students', 'a helper': 'helpers'}.get(rest, rest)
                    # You is singular in these main examples.
                    if en_s == 'You':
                        rest = {'students': 'a student', 'helpers': 'a helper', 'teammates': 'a teammate'}.get(rest, rest)
                else:
                    rest = 'a teammate' if rest == 'teammates' else rest
            be = 'am' if en_s == 'I' else 'are' if en_s in {'You', 'We', 'They'} else 'is'
            q['slots']['predicate']['en'] = be + ' ' + rest
            q['meaning'] = 'state'
        else:
            verb = q['group']
            remainder = old_predicate.partition(' ')[2]
            finite = third(verb) if en_s in {'He', 'She', 'It'} else verb
            q['slots']['predicate']['en'] = ' '.join(x for x in (finite, remainder) if x)
            stative = verb in STATIVE or (verb == 'call' and q['frame'] == 'object-description') or (verb == 'keep' and q['frame'] == 'object-description')
            q['meaning'] = 'state' if stative else 'routine'
            if not stative:
                time = q['slots']['time']
                if verb == 'invite':
                    q['slots']['time'] = pair('年に一度', 'once a year')
                elif verb == 'join' and q['variant'] in {2, 3}:
                    q['slots']['time'] = pair('新学期に', 'at the start of the school year')
                elif q['id'] == 'build-ask-3':
                    q['slots']['time'] = pair('登校初日に', 'on the first day of school')
                elif not re.search(r'\b(?:every|on Sundays|on Saturdays)\b', time['en']):
                    q['slots']['time'] = pair('毎日', 'every day')
        if q['meaning'] == 'state' and q['slots']['time']['en'] not in {'today', ''}:
            q['slots']['time'] = pair()
        if q['group'] == 'call' and q['frame'] == 'object-description':
            q['slots']['P1']['ja'] = '自分たちの犬を' if en_s in {'We', 'They'} else '自分の犬を'
        q['contrastFamily'] = original['id']
        rebuild(q)
        annotate_scene(q)
        refined.append(q)
        if is_be:
            changed = deepcopy(q)
            changed['id'] += '-past'
            changed['meaning'] = 'past'
            changed['statePredicate'] = True
            old_be, rest = changed['slots']['predicate']['en'].split(' ', 1)
            changed['slots']['predicate']['en'] = ('were' if en_s in {'You', 'We', 'They'} else 'was') + ' ' + rest
            ja = changed['slots']['predicate']['ja']
            if ja.endswith('しいです'):
                changed['slots']['predicate']['ja'] = ja[:-4] + 'しかったです'
            else:
                changed['slots']['predicate']['ja'] = ja[:-2] + 'でした' if ja.endswith('です') else ja
            changed['slots']['time'] = (pair('去年', 'last year') if q['id'] == 'build-be-noun-1'
                                        else pair('昨日', 'yesterday'))
            rebuild(changed)
            annotate_scene(changed)
            refined.append(changed)
        if q['meaning'] != 'routine':
            continue
        for mode in ('ongoing', 'past'):
            if mode == 'ongoing' and q['group'] in NO_PROGRESSIVE:
                continue
            changed = deepcopy(q)
            changed['id'] = q['id'] + '-' + mode
            changed['meaning'] = mode
            verb = q['group']
            rest = q['slots']['predicate']['en'].partition(' ')[2]
            if mode == 'ongoing':
                be = 'am' if en_s == 'I' else 'are' if en_s in {'You', 'We', 'They'} else 'is'
                pred = be + ' ' + ing(verb)
                changed['slots']['predicate']['ja'] = ja_ongoing(q['slots']['predicate']['ja'])
                if verb == 'go':
                    changed['slots']['predicate']['ja'] = '向かっています'
                elif verb == 'come':
                    changed['slots']['predicate']['ja'] = '来る途中です'
                elif verb == 'wake':
                    changed['slots']['predicate']['ja'] = '目を覚ましかけています'
                changed['slots']['time'] = pair('今', 'now')
            else:
                pred = past(verb)
                jp = q['slots']['predicate']['ja']
                changed['slots']['predicate']['ja'] = jp.replace('ています', 'ていました')
                # Polite Japanese: 食べます -> 食べました, not 食べした.
                if jp.endswith('ます'):
                    changed['slots']['predicate']['ja'] = jp[:-2] + 'ました'
                changed['slots']['time'] = pair('昨日', 'yesterday')
                if verb == 'read':
                    changed['note'] = '過去のreadは、つづりは同じですが /red/ と読みます。'
            changed['slots']['predicate']['en'] = ' '.join(x for x in (pred, rest) if x)
            rebuild(changed)
            annotate_scene(changed)
            refined.append(changed)
    groups = deepcopy(groups)
    for group in groups:
        group['meaningOrder'] = ['routine', 'ongoing', 'past', 'state']
    pronouns, pronoun_groups = pronoun_examples()
    return refined + pronouns, groups + pronoun_groups


def pronoun_examples():
    rows = []
    subjects = SUBJECTS + [('あなたたちは', 'You')]
    refs = ['話し手本人', '聞き手一人', '第三者の男の子', '第三者の女の子',
            '小さなロボット', '話し手を含む二人', '話し手とは別の二人', '聞き手二人']

    def add(category, n, subject, predicate, p1=('', ''), cue='', form='', meaning='ongoing'):
        values = {k: pair() for k in SLOTS}
        values['S'], values['predicate'], values['P1'] = pair(*subject), pair(*predicate), pair(*p1)
        values['time'] = pair('今', 'now') if meaning == 'ongoing' else pair()
        q = rebuild({'id': f'pronoun-{category}-{n}', 'group': f'pronouns-{category}',
                     'variant': n, 'slots': values, 'frame': 'one-parameter' if p1[1] else 'no-parameter',
                     'meaning': meaning, 'authorship': 'original-six-slots-v2',
                     'pronounFocus': {'category': category, 'form': form},
                     'scene': {'speaker': '吹き出しの外の話し手',
                               'speakerTime': '今', 'eventTime': '今',
                               'viewpoint': cue, 'timeCue': '外も中も「今」。服・色・目印で同じ人物やものを対応させる。'}})
        if has_second_person(q['en']):
            q['scene']['listener'] = ('主役の女の子と紫の服の女の子' if 'あなたたち' in q['ja'] else '星の髪飾りを付けた主役の女の子')
        rows.append(q)

    for i, (subject, reference) in enumerate(zip(subjects, refs), 1):
        en = subject[1]
        be = 'am' if en == 'I' else 'is' if en in {'He', 'She', 'It'} else 'are'
        add('subject', i, subject, ('持っています', be + ' holding'), ('赤いボールを', 'a red ball'),
            f'ボールを持つのは{reference}。人物が分かるよう、服と目印をはっきり描く。', en)

    objects = [('私を', 'me'), ('あなたを', 'you'), ('彼を', 'him'), ('彼女を', 'her'),
               ('それを', 'it'), ('私たちを', 'us'), ('彼らを', 'them'), ('あなたたちを', 'you')]
    object_refs = refs[:4] + ['ボール'] + refs[5:]
    for i, (obj, reference) in enumerate(zip(objects, object_refs), 1):
        add('object', i, ('ミナは', 'Mina'), ('見ています', 'is looking at'), obj,
            f'話し手はミナとは別の人物。ミナが見る相手は{reference}。', obj[1])

    possessives = POSSESSIVES + ['your']
    for i, (subject, owner, reference) in enumerate(zip(subjects, possessives, refs), 1):
        en = subject[1]
        be = 'am' if en == 'I' else 'is' if en in {'He', 'She', 'It'} else 'are'
        plural = i in {6, 7, 8}
        add('possessive', i, subject, ('運んでいます', be + ' carrying'),
            ('自分たちのかばんを' if plural else '自分のかばんを', owner + (' bags' if plural else ' bag')),
            f'かばんの持ち主は{reference}。人物・かばんに同じ色の名札を付け、単なる持ち運びと所有を区別する。', owner)

    independent = [('私のものです', 'mine', '話し手'), ('あなたのものです', 'yours', '聞き手一人'),
                   ('彼のものです', 'his', '第三者の男の子'), ('彼女のものです', 'hers', '第三者の女の子'),
                   ('私たちのものです', 'ours', '話し手を含むグループ'),
                   ('彼らのものです', 'theirs', '話し手とは別のグループ'),
                   ('あなたたちのものです', 'yours', '聞き手二人')]
    for i, (ja, en, owner) in enumerate(independent, 1):
        add('independent', i, ('このかばんは', 'This bag'), (ja, 'is ' + en),
            cue=f'話し手がかばんを指す。持ち主は{owner}。名札と指さしで所有を示す。', form=en, meaning='state')

    reflexives = ['myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'themselves', 'yourselves']
    for i, (subject, reflexive, reference) in enumerate(zip(subjects, reflexives, refs), 1):
        en = subject[1]
        be = 'am' if en == 'I' else 'is' if en in {'He', 'She', 'It'} else 'are'
        add('reflexive', i, subject, ('絵にかいています', be + ' drawing'),
            ('自分たちを' if i in {6, 7, 8} else '自分を', reflexive),
            f'絵をかくのは{reference}。描かれている相手も同じ本人（または同じグループ）。鏡と描きかけの絵で対応を示す。', reflexive)
        rows[-1]['extension'] = True
    assert len(rows) == 39
    groups = [{'key': 'pronouns-' + key, 'label': label, 'ja': label} for key, label in [
        ('subject', '代名詞：だれが'), ('object', '代名詞：だれを・だれに'),
        ('possessive', '代名詞：だれの＋名詞'), ('independent', '代名詞：だれのもの'),
        ('reflexive', '代名詞の発展：自分自身')]]
    return rows, groups
