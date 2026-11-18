"""Compile the independently authored, child-friendly verb curriculum."""
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROLES = ('S', 'V', 'P', 'M')
SUBJECTS = [('私は', 'I'), ('姉は', 'My sister'), ('私たちは', 'We')]
THIRD = {'go': 'goes', 'fly': 'flies', 'study': 'studies', 'try': 'tries',
         'carry': 'carries', 'tidy': 'tidies'}
# These existing AI illustrations were visually checked against these specific
# new scenes. Unmatched scenes deliberately use text rather than a wrong image.
IMAGES = {
    ('walk', 1): '081-2.jpg',
    ('run', 3): '139-1.jpg',
    ('ride', 1): '058-4.jpg',
    ('sleep', 1): '088-1.jpg',
    ('take', 1): '035-1.jpg',
    ('clean', 1): '111-3.jpg',
}


def pair(text):
    ja, en = text.split('=', 1)
    return ('', '') if ja == '~' else (ja, en)


def third_person(verb):
    if verb in THIRD:
        return THIRD[verb]
    return verb + ('es' if verb.endswith(('s', 'sh', 'ch', 'x', 'o')) else 's')


def compile_original():
    topics, lessons, verbs = [], [], []
    for line in (ROOT / 'data/original-curriculum.txt').read_text(encoding='utf-8').splitlines():
        if not line or line.startswith('#'):
            continue
        if line.startswith('@'):
            topics.append(line[1:])
            continue
        fields = line.split('|')
        verb, ja_verb, raw_objects = fields[:3]
        verbs.append(verb)
        objects = [pair(x) for x in raw_objects.split(';')]
        modifiers = [pair(x) for x in fields[3].split(';')] if len(fields) > 3 else [('', '')]
        assert len(objects) == 3 and len(modifiers) in (1, 3), verb
        for variant, ((ja_s, en_s), (ja_p, en_p)) in enumerate(zip(SUBJECTS, objects), 1):
            ja_m, en_m = modifiers[(variant - 1) if len(modifiers) == 3 else 0]
            # Possessives describe the subject's own belongings and relations.
            possessive = ('my', 'her', 'our')[variant - 1]
            en_p = re.sub(r'\bmy\b', possessive, en_p)
            en_m = re.sub(r'\bmy\b', possessive, en_m)
            en_v = third_person(verb) if variant == 2 else verb
            if verb == 'wake':
                en_v += ' up'
            english = [[en_s, 'S'], [en_v, 'V']]
            chunks = [[ja_s, 'S']]
            if ja_p:
                chunks.append([ja_p, 'P'])
                english.append([en_p, 'P'])
            if ja_m:
                chunks.append([ja_m, 'M'])
                english.append([en_m, 'M'])
            chunks.append([ja_verb, 'V'])
            english = [[text if i == 0 else ' ' + text, role] for i, (text, role) in enumerate(english)]
            english[-1][0] += '.'
            ja = ''.join(text for text, _ in chunks) + '。'
            en = ''.join(text for text, _ in english)
            key = f'verb-{verb}-{variant}'
            filename = IMAGES.get((verb, variant))
            illustration = {'status': 'ready', 'file': filename} if filename else {
                'status': 'skipped',
                'reason': 'この文は、ことばを手がかりに練習します。',
            }
            lesson = {
                'id': key, 'index': len(lessons) + 1, 'chapter': len(topics),
                'chapterTitle': topics[-1], 'pattern': len(verbs), 'example': variant,
                'verb': 'wake up' if verb == 'wake' else verb, 'verbJa': ja_verb,
                'title': f'{verb} {variant}：{ja_p or ja_m}',
                'ja': ja, 'en': en, 'chunks': chunks, 'english': english,
                'parts': {'S': ja_s, 'V': ja_verb, 'P': ja_p or 'なし', 'M': ja_m or 'なし'},
                'clue': ja,
                'sceneCaption': '絵は場面のヒント。だれのことか・いつのことかは、文を見てね。',
                'illustration': illustration,
                'note': '', 'imperative': False,
                'tips': {'S': 'だれがするのかな？', 'V': '何をするのかな？',
                         'P': '何を？ どこに？ だれに？', 'M': 'いつ？ どうやって？ だれと？'},
                'authorship': 'original-child-verbs-v1',
            }
            # In this exercise the source Japanese is authoritative, since a
            # picture cannot uniquely determine pronouns, tense or all nouns.
            lessons.append(lesson)
    assert len(topics) == 10 and len(verbs) == len(set(verbs)) == 100
    assert len(lessons) == 300
    for lesson in lessons:
        lesson['distractors'] = {}
        for role in ROLES:
            candidates = sorted(lessons, key=lambda p: (
                p['chapter'] != lesson['chapter'],
                abs(p['pattern'] - lesson['pattern']), p['index']))
            alternatives = []
            for peer in candidates:
                value = peer['parts'][role]
                if value != lesson['parts'][role] and value not in alternatives:
                    alternatives.append(value)
                if len(alternatives) == 2:
                    break
            assert len(alternatives) == 2, (lesson['id'], role)
            lesson['distractors'][role] = alternatives
    metadata = {
        'edition': 'original-child-verbs-v1', 'title': 'ことばのならべかた',
        'description': '10歳ごろから。100の動詞を、身近な300の文で練習。',
        'sentenceAuthorship': '本教材用に新しく作成。書籍の例文・章立ては使用していません。',
        'license': 'CC0-1.0',
        'licenseScope': 'original-curriculum.txt に記述したオリジナル例文データ。既存イラスト・アプリのコードは対象外。',
        'topics': topics, 'verbs': ['wake up' if v == 'wake' else v for v in verbs],
    }
    (ROOT / 'data/curriculum.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    source = [{k: q[k] for k in ('id', 'index', 'chapter', 'chapterTitle', 'pattern', 'example', 'verb', 'ja', 'en')} for q in lessons]
    (ROOT / 'data/source.json').write_text(json.dumps(source, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'data/lessons.json').write_text(json.dumps(lessons, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    counts = Counter(q['illustration']['status'] for q in lessons)
    (ROOT / 'data/generation-status.json').write_text(json.dumps({'total': len(lessons), **counts, 'pending': 0}, indent=2) + '\n', encoding='utf-8')
    print(f'Compiled {len(lessons)} original examples, {len(verbs)} verbs: {dict(counts)}')


if __name__ == '__main__':
    compile_original()
