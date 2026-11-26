// Compose separate practice images from the approved Level 1 art and portraits.
// Run after the app build. Pass --ongoing to recompose the current-progressive scenes.
// Pass example IDs to recompose only those scenes, even if already registered.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const output = path.join(root, '.review-tmp', 'advanced-composed');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const curriculum = read('data/construction-examples.json');
const manifest = read('data/construction-illustrations.json').images;
const layouts = read('scripts/advanced_art_layouts.json');
const byId = new Map(curriculum.examples.map(q => [q.id, q]));
// Retain the individually drawn panels and their question marks.
const ongoingPanels = {
  'level3-35': ['assets/construction/level3-35.png', [584, 132, 920, 409]],
  'level3-37': ['assets/construction/level3-37.png', [678, 35, 837, 713]],
  'level3-38': ['assets/construction/level3-38.png', [595, 36, 710, 647]],
  'level3-what-ing-clean-1-ongoing': ['assets/construction/derived/level3-what-ing-clean-1-ongoing.webp', [239, 24, 378, 378]],
};
// The approved What illustrations already mark the unknown object without hiding the action.
const readingPanel = ['assets/construction/level3-what-do-read-3-open-book.webp', [661, 38, 641, 642]];
const reviewedPanels = {
  'level3-what-ing-read-3-ongoing': readingPanel,
  'level3-what-can-read-3': readingPanel,
  'level3-what-did-count-3-past': ['assets/construction/level3-what-do-count-3-counting.webp', [661, 38, 641, 642]],
};
const doorExample = 'level3-32';
const doorArtwork = 'assets/construction/level3-32-door-knob.png';
const ongoingOnly = process.argv.includes('--ongoing');
const selectedIds = new Set(process.argv.slice(2).filter(arg => arg !== '--ongoing'));
const pending = curriculum.examples.filter(q => {
  if (selectedIds.size) return selectedIds.has(q.id) && (q.derivedFrom || ongoingPanels[q.id] || q.id === doorExample);
  return ongoingOnly
    ? ongoingPanels[q.id] || byId.get(q.derivedFrom)?.meaning === 'ongoing'
    : q.derivedFrom && !manifest[q.id];
});

async function drawArtwork({ q, base, sourceBase, file, layout, panelCrop }, portraits) {
  const W = 860, H = 644, paper = '#fcf9f2', inset = '#fff3df', ink = '#a83c2b';
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  window.artImages ??= new Map();
  async function asset(path) {
    if (window.artImages.has(path)) return window.artImages.get(path);
    const image = new Image();
    image.src = '../' + path;
    await image.decode();
    window.artImages.set(path, image);
    return image;
  }
  function poly(points, fill, stroke, lineWidth = 3) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function line(points, color, width) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  function rounded(x, y, w, h, radius, fill, stroke) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function textMark(x, y, size, color) {
    ctx.font = `bold ${size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText('?', x, y + Math.round(size * .06));
  }
  function framedCalendar(x, y, question) {
    rounded(x, y, 69, 72, 8, '#fff4dc', '#895638');
    rounded(x + 1, y + 1, 67, 15, 5, '#ca533c');
    for (const pin of [x + 16, x + 50]) rounded(pin, y - 4, 5, 15, 2, '#fff4dc', '#895638');
    if (question) { textMark(x + 34, y + 44, 47, '#844631'); return; }
    ctx.fillStyle = '#efaa3f';
    ctx.beginPath();
    ctx.arc(x + 34, y + 43, 10, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      line([13, 19].map(r => [x + 34 + Math.cos(angle) * r, y + 43 + Math.sin(angle) * r]), '#bc7434', 2);
    }
  }
  function mapPin(x, y) {
    poly([[x - 49, y + 28], [x - 20, y + 21], [x + 12, y + 28], [x + 41, y + 22],
          [x + 50, y + 51], [x + 16, y + 58], [x - 16, y + 51], [x - 54, y + 56]], '#fff0c4', '#bc9c60', 2);
    line([[x - 46, y + 49], [x - 18, y + 36], [x + 15, y + 49], [x + 46, y + 34]], '#e3bd6c', 3);
    line([[x - 9, y + 24], [x - 2, y + 43], [x + 25, y + 52]], '#85afb9', 4);
    ctx.beginPath();
    ctx.moveTo(x, y + 46);
    ctx.bezierCurveTo(x - 18, y + 22, x - 33, y + 9, x - 33, y - 9);
    ctx.bezierCurveTo(x - 33, y - 52, x + 33, y - 52, x + 33, y - 9);
    ctx.bezierCurveTo(x + 33, y + 9, x + 18, y + 22, x, y + 46);
    ctx.fillStyle = '#32638b';
    ctx.fill();
    textMark(x, y - 10, 44, '#fffbec');
  }
  function frequencies(kind, x, y) {
    const selected = { always: '11111111', usually: '11101111', often: '11010110', sometimes: '01001001' }[kind];
    if (!selected) return;
    for (const [i, value] of [...selected].entries()) {
      const bx = x + i % 4 * 34, by = y + Math.floor(i / 4) * 32;
      rounded(bx, by, 26, 25, 4, value === '1' ? '#e1eed9' : '#f6ebd8', value === '1' ? '#60846c' : '#b3a188');
      if (value === '1') line([[bx + 5, by + 13], [bx + 10, by + 17], [bx + 20, by + 7]], '#30654a', 3);
    }
  }
  function barred(x, y) {
    ctx.fillStyle = '#fff9ec';
    ctx.strokeStyle = '#a74133';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, 33, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    line([[x - 20, y - 20], [x + 20, y + 20]], '#a74133', 6);
  }
  async function portrait(name, center, top, maxHeight, face, anchor = .5) {
    const source = await asset(portraits[name][0]);
    const [sx, sy, sw, sh] = portraits[name][1] ?? [0, 0, source.naturalWidth, source.naturalHeight];
    const height = Math.min(maxHeight, 182 * sh / sw);
    const width = height * sw / sh;
    ctx.save();
    ctx.translate(center, top);
    if (face === 'left') ctx.scale(-1, 1);
    ctx.drawImage(source, sx, sy, sw, sh, -width * anchor, maxHeight - height, width, height);
    ctx.restore();
  }
  async function getScene() {
    const src = await asset(file);
    let crop;
    if (panelCrop) {
      crop = panelCrop;
    } else if (src.naturalWidth === 860) {
      const sourceLeft = ({ past: 70, ongoing: 235 })[sourceBase.meaning] ?? 387;
      crop = [sourceLeft + 5, 24, 379, 378];
    } else if (src.naturalWidth === 700) {
      crop = [42, 29, 371, 343];
    } else {
      const custom = {
        'build-be-noun-4': [412, 47, 1088, 680],
        'build-be-adjective-4': [402, 45, 1095, 628],
        'build-be-adjective-4-past': [35, 43, 955, 590],
        'build-be-adjective-5': [406, 41, 1080, 581],
        'build-be-adjective-5-past': [41, 43, 954, 565],
      };
      crop = custom[sourceBase.id];
    }
    if (!crop) throw Error('No crop for ' + sourceBase.id);
    const scene = document.createElement('canvas');
    scene.width = crop[2];
    scene.height = crop[3];
    const drawing = scene.getContext('2d');
    drawing.drawImage(src, ...crop, 0, 0, ...crop.slice(2));
    if (!panelCrop && ['on Saturdays', 'on Sundays'].includes(sourceBase.slots.time.en)) {
      // The source's weekday calendar is baked into the cream right margin.
      drawing.fillStyle = inset;
      drawing.fillRect(scene.width * .79, 0, scene.width * .21, scene.height * .25);
    }
    return scene;
  }

  if (q.id === 'level3-32') {
    const source = await asset(file);
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    ctx.drawImage(source, 0, 0);
    // Follow the latch edge from the jamb toward the open position.
    ctx.beginPath();
    ctx.moveTo(950, 421);
    ctx.quadraticCurveTo(1016, 451, 1107, 411);
    ctx.lineCap = 'round';
    for (const [width, color] of [[16, '#fff8e8'], [9, '#35677a']]) {
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke();
    }
    poly([[1125, 402], [1105, 432], [1091, 402]], '#35677a', '#fff8e8', 3);
    return { url: canvas.toDataURL('image/webp', .93), image: { questionMarkInArt: true } };
  }

  const token = q.question?.token;
  const time = q.blocks.find(([role]) => role === '時')?.[1];
  const modal = q.blocks.find(([role]) => role === '助動詞')?.[1].toLowerCase();
  const frequency = q.blocks.find(([role]) => role === '頻度')?.[1];
  const negated = q.blocks.some(([role]) => role === '否定');
  const addressed = /\b(?:you|your)\b/i.test(q.en);
  const mode = base.meaning;
  const past = mode === 'past' || mode === 'experience';
  const ongoing = mode === 'ongoing';
  const speakerName = addressed ? (modal && portraits['boy-' + modal] ? 'boy-' + modal : ongoing ? 'boy-up' : 'boy')
    : modal && portraits['girl-' + modal] ? 'girl-' + modal : ongoing ? 'girl-up' : 'girl';
  const x = past ? 58 : ongoing ? 235 : 388;
  const y = 20, size = 386, bottom = y + size;
  const speaker = past ? 652 : ongoing ? x + size / 2 : 224;
  const listener = speaker + (past ? -146 : ongoing ? 170 : 146);
  const face = past ? 'left' : 'right';
  const tip = past ? speaker - 9 : ongoing ? speaker : speaker + 8;
  const heel = ongoing ? speaker : past ? x + size - 42 : x + 50;
  const outline = [[x, y], [x + size, y], [x + size, bottom], [heel + (ongoing ? 24 : 35), bottom],
                   [tip, ongoing ? 433 : 469], [heel - 26, bottom], [x, bottom]];
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  poly(outline, inset);
  if (ongoing) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#b85224';
    ctx.fillStyle = inset;
    for (let i = 0; i < 4; i++) {
      const bx = x - 19 - 20 * i;
      ctx.fillRect(bx, y, 8, size);
      ctx.strokeRect(bx, y, 8, size);
    }
  } else if (mode === 'experience') {
    ['#b75b31', '#c97750', '#d89372', '#e8b19b'].forEach((color, i) => {
      const margin = i * 31;
      ctx.fillStyle = color;
      ctx.fillRect(x + size + 11 + 19 * i, y + margin, 6, size - margin * 2);
    });
  }
  const scene = await getScene();
  const needsSide = ['where', 'when'].includes(token) || time === 'on Sundays';
  let artWidth = needsSide ? 270 : size - 8;
  let artHeight = artWidth * scene.height / scene.width;
  const ax = x + 4, ay = y + (size - artHeight) / 2;
  if (panelCrop) {
    ctx.drawImage(scene, ax, ay, artWidth, artHeight);
  } else if (token === 'why') {
    rounded(x + 10, 148, 88, 117, 0, '#fff3d9', '#8e583b');
    textMark(x + 54, 211, 83, '#89462e');
    line([[x + 110, 207], [x + 148, 207]], '#8e583b', 4);
    poly([[x + 150, 207], [x + 137, 199], [x + 137, 215]], '#8e583b');
    ctx.drawImage(scene, x + 160, 88, 214, 238);
    ctx.strokeStyle = '#8e583b';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 160, 88, 214, 238);
  } else if (token === 'where') {
    const [l, t, r, b] = layout;
    const focus = document.createElement('canvas');
    focus.width = artWidth;
    focus.height = artHeight;
    const paint = focus.getContext('2d');
    const sw = scene.width * (r - l) / 100, sh = scene.height * (b - t) / 100;
    const scale = Math.min(focus.width / sw, focus.height / sh);
    const dw = sw * scale, dh = sh * scale;
    paint.drawImage(scene, scene.width * l / 100, scene.height * t / 100, sw, sh,
                    (focus.width - dw) / 2, (focus.height - dh) / 2, dw, dh);
    paint.globalCompositeOperation = 'destination-in';
    paint.translate(focus.width / 2, focus.height / 2);
    paint.scale(focus.width / 2, focus.height / 2);
    const fade = paint.createRadialGradient(0, 0, .45, 0, 0, 1.18);
    fade.addColorStop(0, '#000');
    fade.addColorStop(1, '#0000');
    paint.fillStyle = fade;
    paint.fillRect(-1, -1, 2, 2);
    ctx.drawImage(focus, ax + 2, ay);
    mapPin(x + 326, y + 201);
  } else {
    if (token === 'what' && !layout.length) {
      artWidth = 260;
      artHeight = artWidth * scene.height / scene.width;
      ctx.drawImage(scene, ax, y + (size - artHeight) / 2, artWidth, artHeight);
      rounded(x + 271, 156, 104, 109, 10, '#fff8e8', '#c4a888');
      textMark(x + 323, 214, 70, '#314b66');
    } else {
      ctx.drawImage(scene, ax, ay, artWidth, artHeight);
    }
    if (token === 'what' || token === 'who') {
      for (const [i, [l, t, r, b]] of layout.entries()) {
        const bx = ax + l * artWidth / 100, by = ay + t * artHeight / 100;
        const w = (r - l) * artWidth / 100, h = (b - t) * artHeight / 100;
        const cx = bx + w / 2, cy = by + h / 2;
        if (token === 'who') {
          rounded(bx, by, w, h, Math.min(w, h) * .32, '#58748f', '#3d5673');
          textMark(cx, cy, Math.min(70, w * .64, h * .79), '#fff8e7');
        } else {
          rounded(bx, by, w, h, Math.min(w, h) * .2, '#fff8e8', '#c4a888');
          if (!i) textMark(cx, cy, Math.min(75, w * .65, h * .85), '#314b66');
        }
      }
    }
    if (token === 'when' || time === 'on Sundays') framedCalendar(x + 299, y + 19, token === 'when');
    if (q.id === 'level3-what-do-check-1') {
      const left = ax + artWidth * .79, top = ay + artHeight * .08;
      rounded(left, top, 61, 64, 6, '#fff9e9', '#9b7654');
      for (const dy of [17, 42]) {
        line([[left + 8, top + dy], [left + 14, top + dy + 5], [left + 23, top + dy - 6]], '#34745b', 4);
        line([[left + 31, top + dy], [left + 51, top + dy]], '#96785f', 3);
      }
    }
  }
  const cueX = mode === 'experience' ? 591 : past ? 503 : ongoing ? x + size + 39 : 316;
  if (negated) barred(cueX, 238);
  if (frequency) frequencies(frequency, past || ongoing ? cueX : cueX - 102, 148);
  poly(outline, null, ink);
  await portrait(speakerName, speaker, ongoing ? 435 : 442, ongoing ? 188 : 177, face, ongoing ? .5 : .44);
  if (addressed) await portrait('listener', listener, 456, 158, past || ongoing ? 'right' : 'left');
  const image = { questionMarkInArt: !!token && token !== 'whether' };
  if (token === 'whether') image.questionMark = [Math.round((speaker - (ongoing ? 66 : 0)) / W * 100), ongoing ? 69 : 64];
  if (time === 'today') image.todayCalendar = [91, 12];
  return { url: canvas.toDataURL('image/webp', .88), image };
}

async function main() {
  const uncomposable = [...selectedIds].filter(id => !pending.some(q => q.id === id));
  if (uncomposable.length) throw Error('Cannot compose artwork for: ' + uncomposable.join(', '));
  if (!pending.length) { console.log('No unregistered derived scenes.'); return; }
  const referenceScenes = new Map();
  for (const q of curriculum.examples.filter(q => q.derivedFrom && layouts[q.question?.token])) {
    const base = byId.get(q.derivedFrom);
    const key = q.question.token + ':' + base.contrastFamily;
    if (!referenceScenes.has(key)) referenceScenes.set(key, base);
  }
  const layoutsByQuestion = pending.map(q => {
    if (ongoingPanels[q.id]) {
      const [file, panelCrop] = ongoingPanels[q.id];
      return { q, base: { meaning: 'ongoing' }, file, panelCrop };
    }
    const base = byId.get(q.derivedFrom);
    if (q.id === doorExample) return { q, file: doorArtwork };
    if (reviewedPanels[q.id]) {
      const [file, panelCrop] = reviewedPanels[q.id];
      return { q, base, file, panelCrop };
    }
    const token = q.question?.token;
    const key = base.contrastFamily.replace(/^build-/, '');
    const layout = layouts[token]?.[q.id] ?? layouts[token]?.[key];
    if (['who', 'what', 'where'].includes(token) && !layout) throw Error('Missing visual focus for ' + q.id);
    // Every tense of a masked scene refers to the same image the coordinates were drawn against.
    const sourceBase = referenceScenes.get(token + ':' + base.contrastFamily) ?? base;
    const file = manifest[sourceBase.id]?.file;
    if (!file) throw Error('Missing source art for ' + q.id);
    return { q, base, sourceBase, file, layout };
  });
  const material = 'assets/character-materials/';
  const pose = material + 'modal-speakers/';
  const girlSheet = pose + 'girl-modal-poses.png';
  const portraits = {
    girl: [material + 'set-01/02-girl-presenting-right.png'],
    'girl-up': [material + 'set-01/10-girl-looking-up.png'],
    listener: [material + 'set-01/05-girl-listening.png'],
    boy: [material + 'set-01/04-boy-speaking.png'],
    'boy-up': [material + 'original-scenes/boyposes.png', [0, 0, 887, 887]],
    'boy-should': [pose + 'boy-should.png'],
    'boy-must': [pose + 'boy-must.png'],
    'boy-can': [pose + 'boy-can.png'],
    'girl-can': [girlSheet, [0, 0, 627, 627]],
    'girl-might': [girlSheet, [627, 0, 627, 627]],
    'girl-must': [girlSheet, [0, 627, 627, 627]],
    'girl-should': [girlSheet, [627, 627, 627, 627]],
  };
  fs.mkdirSync(output, { recursive: true });
  const host = path.join(root, '.review-tmp', 'advanced-composer.html');
  fs.writeFileSync(host, '<!doctype html><title>Artwork composition</title>');
  const profile = fs.mkdtempSync(path.join(output, 'edge-'));
  const executable = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = spawn(executable, [
    '--headless=new', '--no-first-run', '--allow-file-access-from-files', '--remote-debugging-port=0',
    '--user-data-dir=' + profile, 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let tries = 0; !fs.existsSync(portFile) && tries < 100; tries++) await delay(100);
    const port = fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0];
    const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    let sequence = 0;
    function send(method, params) {
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        function receive({ data }) {
          const reply = JSON.parse(data);
          if (reply.id !== id) return;
          socket.removeEventListener('message', receive);
          if (reply.error) reject(Error(reply.error.message));
          else resolve(reply.result);
        }
        socket.addEventListener('message', receive);
        socket.send(JSON.stringify({ id, method, params }));
      });
    }
    await send('Page.enable');
    const loaded = new Promise(resolve => {
      function receive({ data }) {
        if (JSON.parse(data).method !== 'Page.loadEventFired') return;
        socket.removeEventListener('message', receive);
        resolve();
      }
      socket.addEventListener('message', receive);
    });
    await send('Page.navigate', { url: pathToFileURL(host).href });
    await loaded;
    const entries = {};
    for (const [i, item] of layoutsByQuestion.entries()) {
      const { q, file } = item;
      const expression = '(' + drawArtwork + ')(' + JSON.stringify(item) + ',' + JSON.stringify(portraits) + ')';
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw Error(q.id + ': ' + result.exceptionDetails.exception?.description);
      const { url, image } = result.result.value;
      const data = url.match(/^data:image\/webp;base64,(.+)$/);
      if (!data) throw Error('Invalid WebP for ' + q.id);
      fs.writeFileSync(path.join(output, q.id + '.webp'), Buffer.from(data[1], 'base64'));
      if (!image.questionMarkInArt) delete image.questionMarkInArt;
      entries[q.id] = { ...image, source: file };
      if ((i + 1) % 50 === 0 || i + 1 === pending.length) console.log(`Composed ${i + 1}/${pending.length}`);
    }
    fs.writeFileSync(path.join(output, 'entries.json'), JSON.stringify(entries, null, 2));
  } finally {
    socket?.close();
    browser.kill();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
