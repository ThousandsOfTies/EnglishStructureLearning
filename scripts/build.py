"""Embed lesson data and illustrations into a standalone HTML file."""

import base64
import json
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[1]
    lessons = json.loads((root / "data/lessons.json").read_text(encoding="utf-8"))
    for lesson in lessons:
        image = (root / "assets/images" / (lesson["id"] + ".jpg")).read_bytes()
        lesson["image"] = "data:image/jpeg;base64," + base64.b64encode(image).decode()

    template = (root / "src/practice-template.html").read_text(encoding="utf-8")
    if template.count("__LESSON_DATA__") != 1:
        raise ValueError("The template must contain exactly one lesson-data placeholder.")
    data = json.dumps(lessons, ensure_ascii=False).replace("</", "<\\/")
    output = template.replace("__LESSON_DATA__", data)
    (root / "index.html").write_text(output, encoding="utf-8")
    print(f"Built index.html: {len(lessons)} lessons, images embedded.")


if __name__ == "__main__":
    main()
