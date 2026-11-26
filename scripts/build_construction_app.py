"""Build the original curriculum app; never run the legacy 640-lesson builder."""
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
ART_ROOT = (ROOT / 'assets/construction').resolve()


def check_image(key, filename):
    image = (ROOT / filename).resolve()
    if not image.is_relative_to(ART_ROOT) or not image.is_file():
        raise ValueError(f'Invalid illustration asset for {key}: {filename}')


def main():
    subprocess.run([sys.executable, str(ROOT / 'scripts/build_construction_examples.py')], check=True)
    curriculum = json.loads((ROOT / 'data/construction-examples.json').read_text(encoding='utf-8'))
    illustrations = json.loads((ROOT / 'data/construction-illustrations.json').read_text(encoding='utf-8'))
    examples = {q['id']: q for q in curriculum['examples']}
    # Keep sentence hints in the illustration authoring data only.
    for q in examples.values():
        q.pop('pictureHint', None)
    details = illustrations['details']
    for key, detail in details.items():
        if 'file' in detail:
            check_image(key, detail['file'])
    for key, illustration in illustrations['images'].items():
        if key not in examples:
            raise ValueError(f'Unknown illustration example: {key}')
        check_image(key, illustration['file'])
        if 'detail' in illustration and illustration['detail'] not in details:
            raise ValueError(f'Unknown illustration detail for {key}: {illustration["detail"]}')
        illustration.pop('clue', None)
    src = ROOT / 'src'
    template = (src / 'construction-template.html').read_text(encoding='utf-8')
    sections = {
        '__CONSTRUCTION_CSS__': (src / 'construction.css').read_text(encoding='utf-8'),
        '__CONSTRUCTION_DATA__': json.dumps(curriculum, ensure_ascii=False).replace('</', '<\\/'),
        '__ILLUSTRATION_DATA__': json.dumps(illustrations, ensure_ascii=False).replace('</', '<\\/'),
        '__CONSTRUCTION_SCRIPT__': '\n'.join((src / filename).read_text(encoding='utf-8')
                                             for filename in ('construction-practice.js', 'construction-ui.js')),
    }
    for marker in sections:
        if template.count(marker) != 1:
            raise ValueError(f'Expected one {marker}')
    output = re.sub('|'.join(sections), lambda match: sections[match[0]], template)
    (ROOT / 'index.html').write_text(output, encoding='utf-8')
    print(f'Built original curriculum app: {len(curriculum["examples"])} examples, {len(illustrations["images"])} illustrated.')


if __name__ == '__main__':
    main()
