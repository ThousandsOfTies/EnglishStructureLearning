"""Plan, register, and audit original-curriculum artwork. Generation uses the built-in image tool.

This script never calls an image API and never marks a missing image as ready.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import struct
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'data/construction-illustrations.json'
PLAN = ROOT / 'data/construction-artwork-plan.json'
PROMPTS = ROOT / 'docs/illustration-prompts.json'
STAGED = ROOT / '.review-tmp/construction-artwork'
WEEKDAY_ICONS = {'月曜日': 'crescent moon', '火曜日': 'flame', '水曜日': 'water droplet',
                 '木曜日': 'tree', '金曜日': 'gold coin', '土曜日': 'planet Saturn with a clearly visible ring',
                 '日曜日': 'orange-red sun disk with eight rays'}

STYLE = ('Use case: illustration-story. Single landscape 3:2 wordless educational illustration for a Japanese 10-year-old. '
         'Polished warm children\'s book watercolor/gouache, soft dark outlines, cream background, large readable figures, '
         'cohesive dense composition. Absolutely no text, letters, numerals, signage, logos or watermarks, even on books/buildings. '
         'Main speaker character: chestnut bob-haired girl, yellow star hairclip, coral cardigan, cream shirt, teal skirt. '
         'Use supporting characters ONLY when explicitly required by the viewpoint below. Never add companions to a solo actor. '
         'Use a rectangular speech balloon with four sharp 90-degree corners and a triangular tail to the speaker. Never round the balloon corners. Border and fill colors may vary. '
         'Keep identities/outfits consistent across the scene and temporal variants. ')


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, value):
    # A watcher may briefly hold a JSON file open on Windows. Never truncate it in place.
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, suffix='.tmp', delete=False) as stream:
        stream.write(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
        temporary = Path(stream.name)
    try:
        for attempt in range(5):
            try:
                os.replace(temporary, path)
                break
            except OSError:
                if attempt == 4:
                    raise
                time.sleep(.1)
    finally:
        if temporary.exists():
            temporary.unlink()


def prompt_for(q):
    scene = q.get('scene', {})
    subject = q.get('slots', {}).get('S', {}).get('en', '')
    viewpoint = {
        'I': 'Outside narrator is the main girl; the ONLY event actor inside the balloon is the SAME girl, identical clothes/hairclip.',
        'You': 'EXACTLY TWO outside figures: short-brown-haired blue-hoodie BOY speaking and the main GIRL listening, direct eye contact. Tail points to BOY MOUTH, never girl. INSIDE: ONLY ONE actor, the SAME listener GIRL, not the speaker. No companions inside.',
        'He': 'Outside speaker is the main girl addressing a dark-ponytail lavender-shirt girl. They look/gesture towards a distinct THIRD-PARTY short-brown-haired blue-hoodie BOY, the ONLY actor inside the scene. He is neither the speaker nor the listener.',
        'She': 'Outside speaker is the main girl addressing the blue-hoodie boy. They look/gesture towards a THIRD-PARTY lavender-shirt girl inside the scene. She is neither the speaker nor the listener.',
        'It': 'The subject is a small friendly green toy robot, clearly non-human. Outside main girl talks to the blue-hoodie boy and points to the robot scene.',
        'We': 'Outside speaker is the main girl. The event group INSIDE includes the SAME main girl and the lavender-shirt girl. Include both as actors, so the speaker is part of the group.',
        'They': 'Outside main girl and blue-hoodie boy talk about the event group. INSIDE actors are a lavender-shirt girl and a green-shirt boy. Neither outside speaker nor listener is in that third-party group.',
    }.get(subject, 'Use the exact subject and participants in the brief. ' + scene.get('viewpoint', ''))
    meaning = q.get('meaning', '')
    weekday = next((day for day in WEEKDAY_ICONS if day in q.get('slots', {}).get('time', {}).get('ja', '')), None)
    if meaning == 'past':
        layout = ('Place the NOW narrator(s) at the RIGHT, with body facing right and head looking back LEFT. '
                  'Large balloon on LEFT contains the past event. No bars or timeline. ')
    elif meaning == 'ongoing':
        layout = ('Current action inside the balloon; place the outside speaker directly under its horizontal center, '
                  'head and eyes lifted slightly UP toward the event. Triangle tail points down to this speaker. '
                  'Immediately outside the LEFT edge place exactly four equally tall, equally dark vertical narrow bars. '
                  'No timeline or arrows. ')
    elif meaning == 'experience':
        layout = ('Experience: outside speaker on RIGHT looks LEFT at an earlier event. Four narrow bars outside '
                  'the RIGHT edge of the balloon become shorter and paler toward the speaker. No timeline or arrows. ')
    else:
        layout = ('Small outside present-day speaker/listener on LEFT; one large balloon on RIGHT illustrates the action concept or state. '
                  'Tail points to the outside speaker. Use ONE event scene, no repeated mini-panels, no timeline. '
                  + ('' if weekday else 'No calendar. Exact frequency/day will be supplied outside the picture. '))
    if weekday:
        layout += ('Inside the event balloon, include ONE clear calendar icon: coral-red binding/header, two ring loops, '
                   'cream paper, and in its center one large ' + WEEKDAY_ICONS[weekday] + ' pictogram. '
                   'This pictogram is printed ON the calendar page to communicate the weekday, not weather or a background object. '
                   'No date grid, words, letters or numbers. Keep it away from faces/hands; preserve the large event scene. ')
    if q.get('group') == 'come':
        layout += ('COMING, not going away: show actor(s) APPROACHING the viewer/narrator location, '
                   'entering the room or arriving through the park gate TOWARD the foreground. '
                   'For "here", the arrival point is the speaking location; do not invent a library destination. ')
    if q.get('group') == 'jump' and q.get('slots', {}).get('P1', {}).get('en') == 'a rope':
        layout += ('The rope is a STATIC LOW OBSTACLE tied securely between TWO short wooden posts on the ground. '
                   'Children jump OVER it without holding it. No floating rope, no unsupported handles, no skipping rope. ')
    if q.get('group') == 'swim':
        layout += ('Use appropriate modest swimming rashguards for the actor instead of school clothes: '
                   'coral for star-marker girl, blue for boy, lavender for ponytail girl. Keep identifying hair/face/colors. '
                   'Clearly show a child SWIMMING with arms stroking and legs kicking in shallow calm water, not walking or standing. '
                   'Show the specified pool, sea, or lake distinctly. Outside narrator keeps normal clothes. ')
    content = {'intended_sentence_DO_NOT_WRITE': q['en'], 'Japanese_scene_brief_DO_NOT_WRITE': q['ja']}
    if q.get('slots'):
        content['semantic_parts_DO_NOT_WRITE'] = {r: v['en'] for r, v in q['slots'].items() if v['en']}
    if q.get('pronounFocus'):
        content['pronoun_focus_DO_NOT_WRITE'] = q['pronounFocus']
        content['viewpoint_DO_NOT_WRITE'] = scene.get('viewpoint', '')
    if q.get('level', 1) > 1:
        content['focus_DO_NOT_WRITE'] = q.get('focus', '')
        layout += 'Illustrate the communicative situation; do not turn the English sentence or grammar into visual text. '
    return STYLE + layout + viewpoint + ' Event details: ' + json.dumps(content, ensure_ascii=False) + (
        ' Show exact action/state, destination, objects, recipient and ownership. No unrelated extra actions or objects. '
        'Do not reverse giver/recipient. Use plausible hands, feet and object contact. '
        'For going/coming, show approach to the destination, not walking away. '
        'For states like like/want/need, convey feeling/desire without replacing with an ongoing action. '
        'For negative/modal sentences convey the intended situation without text; UI supplies disambiguating hints. '
        'Fill frame with clear characters and scene; no tiny figures, large empty margins, or decorative collage.')


def prepare():
    data, manifest = read(ROOT / 'data/construction-examples.json'), read(MANIFEST)
    jobs = []
    for q in data['examples']:
        time = q.get('slots', {}).get('time', {}).get('ja', '')
        clue = ('カレンダーの絵も見て、ことばをえらぼう。' if any(day in time for day in WEEKDAY_ICONS)
                else '時間のヒント：' + time + '。' if time else '絵の人物と、していることを見てえらぼう。')
        if q.get('group') == 'come':
            clue += '話し手のいる場所へ近づいてきます。'
        if q['level'] > 1:
            clue = q.get('focus', '')
        if time in ('昨日', '明日') or any(role == '時' and text in ('yesterday', 'tomorrow') for role, text in q.get('blocks', [])):
            clue = 'カレンダーの地球儀が回る向きを見てみよう。' + clue.removeprefix('時間のヒント：' + time + '。')
        if time == '毎日':
            clue = clue.removeprefix('時間のヒント：毎日。')
        registered = manifest['images'].get(q['id'])
        jobs.append({'id': q['id'], 'level': q['level'], 'group': q.get('group', 'level' + str(q['level'])),
                     'family': q.get('contrastFamily', q['id']), 'sentence': q['en'],
                     'file': registered['file'] if registered else 'assets/construction/' + q['id'] + '.png',
                     'alt': q['ja'].rstrip('。') + '場面', 'clue': clue,
                     'status': 'ready' if q['id'] in manifest['images'] else 'generated' if (STAGED / (q['id'] + '.json')).exists() else 'pending', 'prompt': prompt_for(q)})
    plan = {'version': 1, 'generationTool': 'built-in image_gen', 'total': len(jobs),
            'ready': len(manifest['images']), 'pending': len(jobs) - len(manifest['images']), 'jobs': jobs}
    plan['awaitingReview'] = sum(j['status'] == 'generated' for j in jobs)
    write(PLAN, plan)
    groups = list(dict.fromkeys(j['group'] for j in jobs))
    lines = ['# オリジナル教材の作画状況', '',
             f"全{len(jobs)}文 / 作画・登録済み{plan['ready']}文 / 未登録{plan['pending']}文（うち生成済み・確認待ち{plan['awaitingReview']}文）。", '',
             '生成には内蔵の画像生成を使います。この表と予定表の作成だけでは画像は生成されません。',
             '画像を目視で確認してから、対応表に登録して画面を再生成します。'
             + ('全件の作画・登録が完了しました。' if plan['pending'] == 0 else '全件作画は進行中です。'), '',
             '| テーマ | 登録済み | 全文 |', '| --- | ---: | ---: |']
    for group in groups:
        items = [j for j in jobs if j['group'] == group]
        lines.append(f"| {group} | {sum(j['status'] == 'ready' for j in items)} | {len(items)} |")
    (ROOT / 'docs/construction-artwork-status.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    return plan


def register(args):
    plan = prepare()
    job = next((j for j in plan['jobs'] if j['id'] == args.id), None)
    if not job:
        raise ValueError('Unknown example: ' + args.id)
    manifest = read(MANIFEST)
    if args.id in manifest['images']:
        raise ValueError('Already registered; do not overwrite: ' + args.id)
    source = Path(args.source).resolve()
    header = source.read_bytes()[:24]
    if header[:8] != b'\x89PNG\r\n\x1a\n' or min(struct.unpack('>II', header[16:24])) < 512:
        raise ValueError('Expected a full-size generated PNG')
    target = ROOT / job['file']
    if target.exists():
        raise FileExistsError(target)
    target.parent.mkdir(exist_ok=True)
    shutil.copyfile(source, target)
    manifest['status'] = 'in-progress'
    manifest['images'][args.id] = {'file': job['file'], 'alt': args.alt or job['alt'],
                                   'clue': job['clue'], 'review': args.review}
    write(MANIFEST, manifest)
    history = read(PROMPTS)
    history['status'] = 'in-progress'
    staged = STAGED / (args.id + '.json')
    used_prompt = args.prompt or (read(staged)['prompt'] if staged.exists() else job['prompt'])
    history['images'].append({'exampleId': args.id, 'file': job['file'], 'prompt': used_prompt})
    write(PROMPTS, history)
    prepare()
    print(args.id + ': registered')


def review_sheet(args):
    """Show small previews, never the original image payloads, in chat history."""
    from PIL import Image, ImageDraw, ImageOps

    plan = prepare()
    selected = [j for j in plan['jobs'] if j['status'] == 'generated'
                and (not args.group or j['group'] == args.group)][:9]
    if not selected:
        print('No staged images awaiting review.')
        return
    sheet = Image.new('RGB', (1440, 340 * ((len(selected) + 2) // 3)), 'white')
    draw = ImageDraw.Draw(sheet)
    for index, job in enumerate(selected):
        staged = read(STAGED / (job['id'] + '.json'))
        with Image.open(staged['source']) as source:
            preview = ImageOps.contain(source.convert('RGB'), (476, 312))
        x, y = index % 3 * 480, index // 3 * 340
        sheet.paste(preview, (x + (480 - preview.width) // 2, y + 24))
        draw.text((x + 8, y + 5), job['id'], fill='black')
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    # Keep the encoded request small even when many batches are reviewed.
    for quality in (82, 70, 55, 40):
        sheet.save(output, format='JPEG', quality=quality, optimize=True)
        if output.stat().st_size <= 512_000:
            break
    if output.stat().st_size > 512_000:
        raise ValueError('Review sheet exceeds 512 KB; do not embed it in chat.')
    print(json.dumps({'file': str(output), 'bytes': output.stat().st_size,
                      'ids': [j['id'] for j in selected]}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('prepare')
    next_parser = sub.add_parser('next')
    next_parser.add_argument('--limit', type=int, default=4)
    reg = sub.add_parser('register')
    reg.add_argument('--id', required=True)
    reg.add_argument('--source', required=True)
    reg.add_argument('--review', required=True, help='Human/model visual review note; inspect image before registering.')
    reg.add_argument('--alt')
    reg.add_argument('--prompt', help='Exact prompt used, when the plan was revised after generating.')
    stage = sub.add_parser('stage')
    stage.add_argument('--id', required=True)
    stage.add_argument('--source', required=True)
    stage.add_argument('--prompt', required=True)
    review = sub.add_parser('review-sheet', help='Create a JPEG preview of up to nine staged images, capped at 512 KB.')
    review.add_argument('--group')
    review.add_argument('--output', default='.review-tmp/construction-review.jpg')
    args = parser.parse_args()
    if args.command == 'review-sheet':
        review_sheet(args)
    elif args.command == 'stage':
        if not any(q['id'] == args.id for q in read(ROOT / 'data/construction-examples.json')['examples']):
            raise ValueError('Unknown example')
        if not Path(args.source).is_file():
            raise FileNotFoundError(args.source)
        STAGED.mkdir(parents=True, exist_ok=True)
        write(STAGED / (args.id + '.json'), {'id': args.id, 'source': args.source, 'prompt': args.prompt})
        print(args.id + ': staged for review')
    elif args.command == 'register':
        register(args)
    else:
        plan = prepare()
        if args.command == 'next':
            print(json.dumps([j for j in plan['jobs'] if j['status'] == 'pending'][:args.limit], ensure_ascii=True))
        else:
            print(json.dumps({k: plan[k] for k in ('total', 'ready', 'pending')}))


if __name__ == '__main__':
    main()
