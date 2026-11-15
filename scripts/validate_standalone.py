"""Check that a portable HTML export contains the original sentences and exact image bytes."""
import argparse
import base64
import hashlib
import json
import re
from pathlib import Path


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('html',type=Path)
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[1]
    text=args.html.read_text(encoding='utf-8')
    match=re.search(r'<script id="lessonData" type="application/json">(.*?)</script>',text,re.S)
    assert match,'Missing lesson data'
    lessons=json.loads(match[1])
    source=json.loads((root/'data/source.json').read_text(encoding='utf-8'))
    assert len(lessons)==len(source)==640
    images=skipped=0
    for original,lesson in zip(source,lessons):
        assert (original['id'],original['ja'],original['en'])==(lesson['id'],lesson['ja'],lesson['en'])
        status=lesson['illustration']['status']
        if status=='ready':
            assert lesson['image'].startswith('data:image/jpeg;base64,'),lesson['id']
            embedded=base64.b64decode(lesson['image'].partition(',')[2],validate=True)
            actual=(root/'assets/images'/lesson['illustration']['file']).read_bytes()
            assert hashlib.sha256(embedded).digest()==hashlib.sha256(actual).digest(),lesson['id']
            images+=1
        else:
            assert status=='skipped' and lesson['image']=='' and lesson['illustration']['reason'],lesson['id']
            skipped+=1
    assert (images,skipped)==(582,58)
    print(f'Portable HTML verified: 640 original pairs, {images} embedded images with matching hashes, {skipped} explicit image skips; {args.html.stat().st_size/1024/1024:.1f} MiB.')


if __name__=='__main__':
    main()
