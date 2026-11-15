# EnglishStructureLearning

子供が日本語と絵を使い、英語の大きな枠組みに慣れるための教材「ことばのならべかた」です。全10章・640例文を共通の画面で練習できます。

内蔵の画像生成で582例文を作画しています。画像化が難しい58例文も、日本語の文から同じ操作で練習できます。[例文別の作画指示と状況](data/illustrations.json) を保存しています。

## 使い方

[`index.html`](index.html) をブラウザーで開いてください。`assets` フォルダーと一緒に置くと、インストールやサーバーの起動なしで使えます。GitHubからはリポジトリ全体をダウンロードしてください。

1. 日本語のカードを S・V・O/P・M のエリアに運びます。
2. 絵を見ながら、各欄のリストから日本語を選びます。
3. 「たしかめる」で正解すると、それぞれの欄の真下に対応する英語を表示します。
4. 「英語を聞く」で英文を聞けます。「音声設定」では英語音声を選択・試聴・保存できます。
5. 章の選択と章内検索で例文を探せます。

![640文版：日本語の選択欄と英文の対応](docs/preview-640.jpg)

進み具合と音声設定はブラウザー内に保存します。使える音声は端末・ブラウザーによって異なります。旧10例版の保存データは、同じ保存領域で開いた場合に引き継ぎます。

絵にしにくい抽象的な例文は、理由を示して日本語から組み立てる練習にします。作画の状況は `data/generation-status.json` と `data/illustrations.json` で確認できます。

詳しい操作は [使い方](docs/usage.md) を参照してください。

## この教材の枠組み

| 箱 | 見つけるもの |
| --- | --- |
| S | だれが・何が |
| V | どうする・どうだ |
| O/P | 何を・どこへ・だれに |
| M | いつ・どうやって、など |

O/P は、目的語や動作の相手・行き先、状態を説明する部分を大まかにまとめる教材用の箱です。正式な五文型の分類より、英語の文を組み立てる感覚をつかむことを目的としています。疑問文・縮約形・複数の節では、役割別の箱と実際に書く語順が異なるため、正確な英文も併記します。日本語と英語で主語や表現が変わる文には注記を付けています。

原著の本文とチャンク解説で表記が異なる箇所は、元の和文を保持したうえで練習用の表記を分けています。[修正理由](data/source-corrections.json) も保存しています。

## 編集と再生成

Python 3 の標準ライブラリーだけで生成できます。

```sh
python scripts/build.py
```

画像も埋め込んだ1ファイル版を作る場合：

```sh
python scripts/build.py --standalone ../EnglishStructureLearning-640.html
python scripts/validate_standalone.py ../EnglishStructureLearning-640.html
```

作画と検証には Pillow を使います。

```sh
python -m pip install -r requirements-authoring.txt
python scripts/validate.py
node --test tests/progress.test.cjs
```

作画途中の開発確認に限り、生成・検証コマンドに `--allow-pending` を付けられます。通常の生成・検証は未作画の例文が残っていると失敗します。

| ファイル | 内容 |
| --- | --- |
| `src/practice-template.html` | 画面・操作・音声設定の編集用ソース |
| `data/source.json` | 元の640例文と章・パターン・掲載ページ |
| `data/annotations/` | 個別に確認した文の区切り・役割・注記 |
| `data/japanese-frame-overrides.json` | 日本語の自然な役割と英語への組み替えが異なる文の設定 |
| `data/lessons.json` | 生成した640例文の日本語・英語・選択肢・役割 |
| `data/illustrations.json` | 例文別の作画プロンプトと作画状況 |
| `data/image-replacements.json` | 視覚確認後に差し替えた画像の対応表 |
| `data/image-review-summary.json` | 全582画像の確認記録と画像のハッシュ |
| `assets/images/` | 各例文のイラスト |
| `scripts/compile_lessons.py` | 注釈・補正・作画状況から共通の例文データを生成 |
| `scripts/build.py` | `index.html` または画像を埋め込んだ1ファイル版を生成 |
| `scripts/validate.py` | 原文保持・640文の網羅・選択肢・画像ファイルを検証 |
| `scripts/validate_standalone.py` | 1ファイル版の例文と埋め込み画像を検証 |
| `index.html` | ブラウザーで開く完成版 |

例文：『ネイティブのパターン英作文』全640例。場面イラスト：AI生成。
