"""Build the original curriculum app; never run the legacy 640-lesson builder."""
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    subprocess.run([sys.executable, str(ROOT / 'scripts/build_construction_examples.py')], check=True)
    curriculum = json.loads((ROOT / 'data/construction-examples.json').read_text(encoding='utf-8'))
    illustrations = json.loads((ROOT / 'data/construction-illustrations.json').read_text(encoding='utf-8'))
    examples = {q['id']: q for q in curriculum['examples']}
    for key, illustration in illustrations['images'].items():
        if key not in examples:
            raise ValueError(f'Unknown illustration example: {key}')
        image = (ROOT / illustration['file']).resolve()
        if not image.is_relative_to((ROOT / 'assets/construction').resolve()) or not image.is_file():
            raise ValueError(f'Invalid illustration asset: {key}')
    template = (ROOT / 'src/construction-template.html').read_text(encoding='utf-8')
    script = (ROOT / 'src/construction-practice.js').read_text(encoding='utf-8')
    for marker in ('__CONSTRUCTION_DATA__', '__ILLUSTRATION_DATA__', '__CONSTRUCTION_SCRIPT__'):
        if template.count(marker) != 1:
            raise ValueError(f'Expected one {marker}')
    output = template.replace('__CONSTRUCTION_DATA__', json.dumps(curriculum, ensure_ascii=False).replace('</', '<\\/'))
    output = output.replace('__ILLUSTRATION_DATA__', json.dumps(illustrations, ensure_ascii=False).replace('</', '<\\/'))
    output = output.replace('__CONSTRUCTION_SCRIPT__', script)
    (ROOT / 'index.html').write_text(output, encoding='utf-8')
    print(f'Built original curriculum app: {len(curriculum["examples"])} examples, {len(illustrations["images"])} illustrated.')


if __name__ == '__main__':
    main()
