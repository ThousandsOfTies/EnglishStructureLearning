"""Import a generated illustration at a practical size for browser lessons."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--id', required=True)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--variant', type=int, help='Save a corrected sibling version without overwriting an existing illustration.')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    records = json.loads((root / 'data/source.json').read_text(encoding='utf-8'))
    assert args.id in {r['id'] for r in records}
    if args.variant is not None and args.variant < 2:
        raise ValueError('A corrected variant number must be at least 2.')
    stem = args.id + (f'-v{args.variant}' if args.variant else '')
    target = root / 'assets/images' / (stem + '.jpg')
    if target.exists():
        raise FileExistsError(target)
    with Image.open(args.source) as original:
        image = original.convert('RGB')
        image.thumbnail((1280, 960), Image.Resampling.LANCZOS)
        image.save(target, 'JPEG', quality=82, optimize=True)
        size = image.size
    receipt = {
        'id': args.id, 'status': 'ready', 'tool': 'built-in image_gen',
        'sourceFile': args.source.name, 'file':target.name, 'width': size[0], 'height': size[1],
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
    }
    receipts = root / 'data/image-receipts'
    receipts.mkdir(exist_ok=True)
    (receipts / (stem + '.json')).write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Imported {args.id}: {size[0]}x{size[1]}, {target.stat().st_size:,} bytes")


if __name__ == '__main__':
    main()
