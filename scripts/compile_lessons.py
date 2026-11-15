"""Compile individually reviewed sentence annotations into the common lesson schema."""
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROLES = ('S', 'V', 'P', 'M')


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def choice_key(text, role):
    text = unicodedata.normalize('NFKC', text)
    text = re.sub(r'\([^)]*\)', '', text).strip()
    if text in ('なし', 'この文では選ばない', 'この文では使わない'):
        return 'NONE'
    if role == 'S':
        text = re.sub(r'[はが]$', '', text)
    return text


def compile_lessons():
    source = read(ROOT / 'data/source.json')
    original = read(ROOT / 'data/intro-lessons.json')
    annotations = [row for path in sorted((ROOT / 'data/annotations').glob('*.json')) for row in read(path)]
    by_id = {row['id']: row for row in annotations}
    frame_path = ROOT / 'data/frame-overrides.json'
    for key,override in (read(frame_path) if frame_path.exists() else {}).items():
        by_id[key].update(override)
    japanese_frame_path = ROOT / 'data/japanese-frame-overrides.json'
    for key,override in (read(japanese_frame_path) if japanese_frame_path.exists() else {}).items():
        by_id[key].update(override)
    english_parts_path = ROOT / 'data/english-parts-overrides.json'
    for key,override in (read(english_parts_path) if english_parts_path.exists() else {}).items():
        entry = by_id[key]
        entry['englishFrameParts'] = {**entry.get('englishFrameParts',{}), **override.get('englishFrameParts',{})}
        entry['note'] = (entry.get('note','')+'\n'+override.get('note','')).strip()
        entry['translationShift'] = True
        for field,value in override.items():
            if field not in ('englishFrameParts','note'):
                entry[field] = value
    illustration_path = ROOT / 'data/illustration-overrides.json'
    illustration_overrides = read(illustration_path) if illustration_path.exists() else {}
    replacements_path = ROOT / 'data/image-replacements.json'
    replacements = read(replacements_path) if replacements_path.exists() else {}
    corrections_path = ROOT / 'data/source-corrections.json'
    corrections = read(corrections_path) if corrections_path.exists() else {}
    hints_path = ROOT / 'data/lesson-hints.json'
    hints = read(hints_path) if hints_path.exists() else {}
    assert len(by_id) == len(annotations) == len(source) - len(original)
    assert len(source) == 640
    lessons = []
    for row in source:
        if row['index'] <= len(original):
            item = dict(original[row['index'] - 1])
            item.update({k: row[k] for k in ('index', 'chapter', 'pattern', 'example', 'page')})
            item['title'] = ['バスで学校へ','仕事で海外へ','妹と買いもの','ハワイの休暇','長野から大学へ','病院へ会いに','夜遅くの帰宅','シカゴの旅行','戸棚の上の時計','黄色い帽子の人'][row['index']-1]
            item['imperative'] = bool(item.get('implicit'))
            item['implicitAnswer'] = 'you'
            item['illustration'] = {'status': 'ready'}
            # Preserve the original, individually authored first ten lessons.
            assert item['ja'] == row['ja'] and item['en'] == row['en']
        else:
            annotation = by_id[row['id']]
            assert annotation['index'] == row['index']
            correction = corrections.get(row['id'], {})
            assert ''.join(c[0] for c in annotation['chunks']) == correction.get('studyJa',row['ja']).rstrip('。？！?!.')
            assert ''.join(c[0] for c in annotation['english']) == row['en']
            assert all(role in ROLES for _,role in annotation['chunks'] + annotation['english'])
            item = {**row, **{k: v for k,v in annotation.items() if k != 'index'}}
            if correction:
                assert correction['originalJa'] == row['ja']
                item['studyJa'] = correction['studyJa']
                item['note'] = (item.get('note','') + '\n' + correction['reason']).strip()
            item['parts'] = {role: '／'.join(t for t,r in item['chunks'] if r == role) or 'なし' for role in ROLES}
            item['parts'].update(item.get('implicitParts', {}))
            if item.get('implicit'):
                assert item.get('implicitSubject'), item['id']
                item['parts']['S'] = item['implicitSubject']
                item['implicitAnswer'] = 'implied'
            item['parts'].update(item.get('englishFrameParts', {}))
            item['imperative'] = bool(item.get('implicit') and not any(r=='S' for _,r in item['english']))
            order = [ROLES.index(r) for text,r in item['english'] if text.strip()]
            if order != sorted(order) or re.search(r"\b(?:I|you|he|she|it|we|they|that|there|what)'(?:m|re|s|ll|ve|d)\b", row['en'], re.I):
                item['englishOrderNote'] = '下の英文で実際の語順も確かめよう。疑問文・縮約形・複数の節では、箱の順と書く順が変わることがあります。'
            item['clue'] = '絵は場面の手がかりです。時制・人称・地名などは「日本語の文も見る」で確認できます。'
            item['distractors'] = {}
            if item.get('translationShift'):
                item['englishOrderNote'] = '日本語と英語では表現の組み立て方が変わる例です。下の英文と大人向けの説明も確かめよう。'
        if re.match(r"^Let's\b",item['en'],re.I):
            item['imperative'] = False
            item['invitation'] = True
            item['englishImplicitSubject'] = 'we'
            item['englishOrderNote'] = "Let's ... は「いっしょに〜しよう」という誘いです。この教材では、いっしょに動く「私たち」をSの箱で考えます。英文は下の形で書きます。"
        elif item.get('imperative'):
            item['englishImplicitSubject'] = 'you'
        illustration = dict(item.get('illustration', {}))
        if row['id'] in illustration_overrides:
            illustration.update(illustration_overrides[row['id']])
        filename = replacements.get(row['id'], row['id'] + '.jpg')
        assert re.fullmatch(re.escape(row['id']) + r'(?:-v\d+)?\.jpg',filename), filename
        image_file = ROOT / 'assets/images' / filename
        illustration['file'] = filename
        if image_file.exists():
            illustration['status'] = 'ready'
            illustration.pop('reason', None)
        elif illustration.get('status') != 'skipped':
            illustration['status'] = 'pending'
        item['illustration'] = illustration
        if illustration['status'] != 'ready':
            item['clue'] = '上の日本語の文を手がかりに、人・動きや状態・相手・時間などを確かめよう。'
        if row['id'] in hints:
            item['clue'] = hints[row['id']]
        if row['ja'].startswith(item['title']) and len(item['title']) < len(row['ja'].rstrip('。？！?!.')):
            item['title'] += '…'
        lessons.append(item)

    for i,item in enumerate(lessons):
        for role in ROLES:
            if role in item['distractors']:
                continue
            peers = sorted((p for p in lessons if p['id'] != item['id']), key=lambda p: (p['pattern'] != item['pattern'], p['chapter'] != item['chapter'], abs(p['index']-item['index'])))
            candidates = []
            seen = {choice_key(item['parts'][role],role)}
            for peer in peers:
                candidate = peer['parts'][role]
                normalized = choice_key(candidate,role)
                if normalized not in seen:
                    candidates.append(candidate)
                    seen.add(normalized)
                if len(candidates) == 2:
                    break
            assert len(candidates) >= 2
            item['distractors'][role] = candidates[:2]
        assert all(len(set([item['parts'][r], *item['distractors'][r]])) >= 3 for r in ROLES)
        assert all(len({choice_key(t,r) for t in [item['parts'][r], *item['distractors'][r]]}) >= 3 for r in ROLES), item['id']

    (ROOT/'data/lessons.json').write_text(json.dumps(lessons,ensure_ascii=False,indent=2),encoding='utf-8')
    jobs = read(ROOT/'data/illustrations.json')
    prompt_path = ROOT / 'data/illustration-prompt-overrides.json'
    prompt_overrides = read(prompt_path) if prompt_path.exists() else {}
    for item,job in zip(lessons,jobs):
        assert item['id'] == job['id']
        job['status'] = 'planned' if item['illustration']['status'] == 'pending' else item['illustration']['status']
        job['file'] = item['illustration']['file'] if job['status'] == 'ready' else None
        if item['illustration'].get('reason'):
            job['reason'] = item['illustration']['reason']
        if item['illustration'].get('scene'):
            job['prompt'] = job['prompt'].split('\nConcrete scene:')[0] + '\nConcrete scene: ' + item['illustration']['scene']
        if item['id'] in prompt_overrides:
            job['prompt'] = prompt_overrides[item['id']]
    (ROOT/'data/illustrations.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2),encoding='utf-8')
    counts = Counter(item['illustration']['status'] for item in lessons)
    summary = {'total': len(lessons), 'reviewed': len(lessons), **{status:counts[status] for status in ('ready','skipped','pending')}}
    (ROOT/'data/generation-status.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps(summary))


if __name__ == '__main__':
    compile_lessons()
