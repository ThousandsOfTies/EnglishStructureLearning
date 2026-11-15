"""Validate source preservation, lesson coverage, answer choices and illustration assets."""
import argparse
import json
import re
from collections import Counter
from pathlib import Path
from PIL import Image
from compile_lessons import choice_key


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--allow-pending', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    source = json.loads((root/'data/source.json').read_text(encoding='utf-8'))
    lessons = json.loads((root/'data/lessons.json').read_text(encoding='utf-8'))
    assert len(source) == len(lessons) == 640
    assert len({q['id'] for q in lessons}) == 640
    assert Counter(q['chapter'] for q in lessons) == {i:64 for i in range(1,11)}
    states = Counter()
    for original,lesson in zip(source,lessons):
        key = lesson['id']
        assert original['id'] == key
        assert (original['ja'],original['en']) == (lesson['ja'],lesson['en']), key
        assert ''.join(t for t,_ in lesson['chunks']) == lesson.get('studyJa',original['ja']).rstrip('。？！?!.'), key
        if lesson.get('studyJa'):
            assert lesson.get('note'), key
        rendered = (' ' if original['index'] <= 10 else '').join(t for t,_ in lesson['english'])
        assert rendered == original['en'], (key,rendered,original['en'])
        for role in ('S','V','P','M'):
            assert lesson['parts'][role], (key,role)
            choices = [lesson['parts'][role],*lesson['distractors'][role]]
            assert len(set(choices)) >= 3 and all(isinstance(t,str) and t for t in choices), (key,role)
            assert len({choice_key(t,role) for t in choices}) >= 3, (key,role,'equivalent choices')
            if not (role == 'S' and lesson.get('englishImplicitSubject')):
                has_english = any(text.strip() and r == role for text,r in lesson['english'])
                assert (choice_key(lesson['parts'][role],role) != 'NONE') == has_english, (key,role,'frame/English mismatch')
        assert all(role in ('S','V','P','M') and t for t,role in lesson['chunks']+lesson['english']), key
        if lesson.get('implicit'):
            assert lesson.get('implicitAnswer') in ('you','implied'), key
        state = lesson['illustration']['status']
        assert state in ('ready','skipped','pending'), key
        states[state] += 1
        if state == 'ready':
            with Image.open(root/'assets/images'/lesson['illustration']['file']) as image:
                assert image.format == 'JPEG' and min(image.size) >= (200 if original['index'] <= 10 else 400), key
                image.verify()
        elif state == 'skipped':
            assert lesson['illustration'].get('reason'), key
    assert args.allow_pending or not states['pending'], states
    html = (root/'index.html').read_text(encoding='utf-8')
    match = re.search(r'<script id="lessonData" type="application/json">(.*?)</script>',html,re.S)
    embedded = json.loads(match[1])
    assert len(embedded) == 640
    for lesson,entry in zip(lessons,embedded):
        assert lesson['id'] == entry['id'] and lesson['en'] == entry['en']
        assert bool(entry['image']) == (lesson['illustration']['status']=='ready'), lesson['id']
    print(f'Validated 640 original sentence pairs, role spans, choices and image files: {dict(states)}')


if __name__ == '__main__':
    main()
