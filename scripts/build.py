"""Build the shared 640-lesson HTML, with an optional standalone export."""

import argparse
import base64
import json
from pathlib import Path
from compile_lessons import compile_lessons


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--standalone', type=Path, help='Export a single HTML file with embedded illustrations.')
    parser.add_argument('--allow-pending', action='store_true', help='Development preview only: show pending illustrations honestly.')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    compile_lessons()
    lessons = json.loads((root / "data/lessons.json").read_text(encoding="utf-8"))
    pending = [lesson['id'] for lesson in lessons if lesson['illustration']['status'] == 'pending']
    if pending and not args.allow_pending:
        raise RuntimeError(f'{len(pending)} illustrations are still pending. Complete them before building the final edition.')
    for lesson in lessons:
        if lesson['illustration']['status'] == 'ready':
            image_path = root / "assets/images" / lesson['illustration']['file']
            lesson["image"] = "data:image/jpeg;base64," + base64.b64encode(image_path.read_bytes()).decode() if args.standalone else f"assets/images/{lesson['illustration']['file']}"
        else:
            lesson["image"] = ''

    template = (root / "src/practice-template.html").read_text(encoding="utf-8")
    if template.count("__LESSON_DATA__") != 1:
        raise ValueError("The template must contain exactly one lesson-data placeholder.")
    data = json.dumps(lessons, ensure_ascii=False).replace("</", "<\\/")
    output = template.replace("__LESSON_DATA__", data)
    destination = args.standalone or root / "index.html"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(output, encoding="utf-8")
    print(f"Built {destination.name}: {len(lessons)} lessons, {len(pending)} pending illustrations.")


if __name__ == "__main__":
    main()
