const fs   = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const get  = (flag, def) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : def; };
const dataFile = get('--data', path.join(__dirname, 'data', 'available.json'));
const outFile  = get('--out',  path.join(__dirname, 'docs', 'index.html'));
const outDir   = path.dirname(outFile);
const mapsDir  = path.join(outDir, 'maps');

if (!fs.existsSync(dataFile)) {
    console.error(`Data file not found: ${dataFile}`);
    process.exit(1);
}
const { maps } = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const MODE_CONFIG = {
    ar:    { label: 'Arms Race',   short: 'AR',  color: '#e8a020' },
    cs:    { label: 'Hostage',     short: 'CS',  color: '#3a9bd5' },
    de:    { label: 'Bomb Defuse', short: 'DE',  color: '#e05252' },
    lobby: { label: 'Menu',        short: 'LB',  color: '#7a7a8c' },
};

function getMode(mapKey) {
    const prefix = mapKey.split('_')[0];
    return MODE_CONFIG[prefix] || { label: prefix.toUpperCase(), short: prefix.toUpperCase().slice(0,2), color: '#555' };
}

const sorted = Object.entries(maps).sort(([ka, a], [kb, b]) => {
    const an = a.display_name || '', bn = b.display_name || '';
    if (an && !bn) return -1;
    if (!an && bn) return  1;
    return (an || ka).localeCompare(bn || kb);
});

const totalMaps = sorted.length;
const buildDate = new Date().toUTCString();

const DEFAULT_THUMB = 'https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/default_psd.png';

const sharedHead = `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:      #0d0e10;
      --bg2:     #13151a;
      --bg3:     #1c1f28;
      --surface: #1e2130;
      --border:  #2a2d3a;
      --accent:  #f0b84b;
      --accent2: #e05252;
      --text:    #dde2ee;
      --muted:   #6b7080;
      --radius:  6px;
      --card-w:  280px;
    }
    html { scroll-behavior: smooth; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Barlow', sans-serif;
      font-size: 15px;
      line-height: 1.6;
      background-image:
        repeating-linear-gradient(0deg,   transparent, transparent 39px, #ffffff04 39px, #ffffff04 40px),
        repeating-linear-gradient(90deg,  transparent, transparent 39px, #ffffff04 39px, #ffffff04 40px);
    }
    a { color: inherit; text-decoration: none; }
  </style>`;

function indexCard([mapKey, map]) {
    const mode      = getMode(mapKey);
    const name      = map.display_name || mapKey;
    const imgSrc    = map.path || '';
    const thumbs    = map.thumb_paths || [];
    const hasThumb  = thumbs.length > 0;
    const thumbSrc  = hasThumb ? thumbs[0] : DEFAULT_THUMB;

    const thumbDots = thumbs.length > 1
        ? `<div class="thumb-dots">${thumbs.map((t, i) =>
            `<span class="dot${i === 0 ? ' active' : ''}" data-src="${t}"></span>`
          ).join('')}</div>`
        : '';

    const thumbsAttr = thumbs.length > 1 ? ` data-thumbs='${JSON.stringify(thumbs)}'` : '';

    return `
  <a class="card" href="maps/${mapKey}.html" data-mode="${mode.label}" data-key="${mapKey}" data-name="${name.toLowerCase()}"${thumbsAttr}>
    <div class="card-image-wrap">
      <img class="card-thumb" src="${thumbSrc}" alt="${name} screenshot" loading="lazy">
      ${imgSrc ? `<img class="card-icon" src="${imgSrc}" alt="${name} icon" loading="lazy">` : ''}
      <span class="card-mode-badge" style="--badge-color:${mode.color}">${mode.label}</span>
      ${thumbDots}
    </div>
    <div class="card-body">
      <h2 class="card-name">${name}</h2>
      <code class="card-key">${mapKey}</code>
    </div>
  </a>`;
}

const indexHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  ${sharedHead}
  <title>CS2 Map Icons</title>
  <link rel="icon" type="image/x-icon" href="https://developer.valvesoftware.com/w/images/6/61/Csgo_icon_competitive.png">
  <meta name="description" content="${totalMaps} Counter-Strike 2 maps - icons, radars, screenshots.">
  <style>
    /* HEADER */
    header {
      position: sticky; top: 0; z-index: 100;
      background: rgba(13,14,16,.92);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 0 2rem;
    }
    .header-inner {
      max-width: 1600px; margin: 0 auto;
      display: flex; align-items: center; gap: 1.5rem;
      height: 58px;
    }
    .logo {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900; font-size: 1.4rem;
      letter-spacing: .04em; color: var(--accent);
      white-space: nowrap; flex-shrink: 0;
    }
    .logo span { color: var(--text); }
    .header-count {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: .85rem; color: var(--muted);
      border: 1px solid var(--border);
      padding: 2px 8px; border-radius: 100px; white-space: nowrap;
    }
    .search-wrap { flex: 1; max-width: 400px; position: relative; }
    .search-wrap svg {
      position: absolute; left: 10px; top: 50%;
      transform: translateY(-50%); opacity: .4; pointer-events: none;
    }
    #search {
      width: 100%; padding: 7px 12px 7px 34px;
      background: var(--bg3); border: 1px solid var(--border);
      border-radius: var(--radius); color: var(--text);
      font-family: inherit; font-size: .9rem; outline: none;
      transition: border-color .2s;
    }
    #search:focus { border-color: var(--accent); }
    #search::placeholder { color: var(--muted); }
    .filter-pills { display: flex; gap: .4rem; flex-wrap: wrap; }
    .pill {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: .8rem; font-weight: 600;
      letter-spacing: .05em; text-transform: uppercase;
      padding: 3px 10px; border-radius: 100px;
      border: 1px solid var(--border); background: transparent;
      color: var(--muted); cursor: pointer; transition: all .15s; white-space: nowrap;
    }
    .pill:hover    { border-color: var(--accent); color: var(--accent); }
    .pill.active   { background: var(--accent); border-color: var(--accent); color: #000; }
    .pill[data-mode="Bomb Defuse"].active { background: #e05252; border-color: #e05252; color: #fff; }
    .pill[data-mode="Hostage"].active     { background: #3a9bd5; border-color: #3a9bd5; color: #fff; }
    .pill[data-mode="Arms Race"].active   { background: #e8a020; border-color: #e8a020; color: #000; }
    .pill[data-mode="Menu"].active        { background: #7a7a8c; border-color: #7a7a8c; color: #fff; }
    .header-right {
      margin-left: auto; font-size: .75rem; color: var(--muted); white-space: nowrap;
    }
    .header-right a { color: var(--accent); }
    .header-right a:hover { text-decoration: underline; }

    /* HERO */
    .hero {
      max-width: 1600px; margin: 0 auto; padding: 3rem 2rem 1.5rem;
    }
    .hero h1 {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900; font-size: clamp(2.5rem, 5vw, 4.5rem);
      line-height: 1; letter-spacing: -.01em; margin-bottom: .5rem;
    }
    .hero h1 em { font-style: normal; color: var(--accent); }
    .hero p { color: var(--muted); max-width: 560px; font-size: .95rem; }

    /* GRID */
    .grid-wrap { max-width: 1600px; margin: 0 auto; padding: 1rem 2rem 4rem; }
    .results-info { font-size: .82rem; color: var(--muted); margin-bottom: 1rem; height: 1.2em; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(var(--card-w), 1fr));
      gap: 1px; background: var(--border);
      border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
    }

    /* CARD */
    .card {
      background: var(--surface);
      display: flex; flex-direction: column;
      transition: background .15s;
      animation: fadeIn .3s ease both;
    }
    .card:hover { background: var(--bg3); }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .card-image-wrap {
      position: relative; aspect-ratio: 16/9;
      background: var(--bg2); overflow: hidden;
    }
    .card-thumb {
      width: 100%; height: 100%; object-fit: cover; display: block;
      transition: opacity .4s, transform .35s;
    }
    .card:hover .card-thumb { transform: scale(1.03); }
    .card-icon {
      position: absolute; bottom: 8px; right: 8px;
      width: 48px; height: 48px; object-fit: contain;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,.8));
      transition: transform .2s;
    }
    .card:hover .card-icon { transform: scale(1.12); }
    .card-mode-badge {
      position: absolute; top: 8px; left: 8px;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 700; font-size: .65rem;
      letter-spacing: .1em; text-transform: uppercase;
      color: #000; background: var(--badge-color, #888);
      padding: 2px 7px; border-radius: 3px;
    }
    .thumb-dots {
      position: absolute; bottom: 6px; left: 50%;
      transform: translateX(-50%); display: flex; gap: 4px;
    }
    .dot {
      width: 5px; height: 5px; border-radius: 50%;
      background: rgba(255,255,255,.35);
      cursor: pointer; transition: background .15s;
    }
    .dot.active, .dot:hover { background: #fff; }
    .card-body { padding: .75rem 1rem .9rem; display: flex; flex-direction: column; gap: .3rem; flex: 1; }
    .card-name {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 700; font-size: 1.15rem;
      letter-spacing: .02em; color: var(--text); line-height: 1.2;
    }
    .card-key {
      font-family: 'JetBrains Mono', monospace;
      font-size: .7rem; color: var(--muted); letter-spacing: .03em;
    }

    /* NO RESULTS */
    .no-results {
      display: none; padding: 4rem 2rem; text-align: center;
      color: var(--muted); font-family: 'Barlow Condensed', sans-serif;
      font-size: 1.3rem; letter-spacing: .05em; text-transform: uppercase;
    }

    /* FOOTER */
    footer {
      border-top: 1px solid var(--border);
      padding: 1.2rem 2rem; text-align: center;
      font-size: .78rem; color: var(--muted);
    }
    footer a { color: var(--accent); }
    footer a:hover { text-decoration: underline; }

    @media (max-width: 700px) {
      .header-inner { flex-wrap: wrap; height: auto; padding: .6rem 0; gap: .5rem; }
      .header-right { display: none; }
      .hero { padding: 1.5rem 1rem .8rem; }
      .grid-wrap { padding: .5rem 1rem 3rem; }
      :root { --card-w: 260px; }
    }
  </style>
</head>
<body>

<header>
  <div class="header-inner">
    <div class="logo">CS2 <span>MAP ICONS</span></div>
    <span class="header-count">${totalMaps} maps</span>

    <div class="search-wrap">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input id="search" type="search" placeholder="Search maps…" autocomplete="off" spellcheck="false">
    </div>

    <div class="filter-pills">
      <button class="pill active" data-mode="all">All</button>
      <button class="pill" data-mode="Bomb Defuse">Defuse</button>
      <button class="pill" data-mode="Hostage">Hostage</button>
      <button class="pill" data-mode="Arms Race">Arms Race</button>
      <button class="pill" data-mode="Menu">Menu</button>
    </div>

    <div class="header-right">
      Built ${buildDate} &nbsp;·&nbsp;
      <a href="https://github.com/MurkyYT/cs2-map-icons" target="_blank" rel="noopener">GitHub ↗</a>
    </div>
  </div>
</header>

<section class="hero">
  <h1>Counter-Strike 2<br><em>Map Icons</em></h1>
  <p>All ${totalMaps} maps auto-extracted from the game VPK on every update. Icons, radars and screenshots available as raw PNGs.</p>
</section>

<main class="grid-wrap">
  <div class="results-info" id="results-info"></div>
  <div class="grid" id="grid">
    ${sorted.map(indexCard).join('\n')}
  </div>
  <div class="no-results" id="no-results">No maps found</div>
</main>

<footer>
  Auto-generated from <a href="https://github.com/MurkyYT/cs2-map-icons">MurkyYT/cs2-map-icons</a> ·
  Data sourced from Counter-Strike 2 game files · Not affiliated with Valve Corporation
</footer>

<script>
  document.querySelectorAll('.card-image-wrap').forEach(wrap => {
    const thumb = wrap.querySelector('.card-thumb');
    const dots  = wrap.querySelectorAll('.dot');
    if (!thumb || !dots.length) return;
    dots.forEach(dot => {
      dot.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        thumb.src = dot.dataset.src;
        dots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
      });
    });
  });

  document.querySelectorAll('.card[data-thumbs]').forEach(card => {
    const wrap  = card.querySelector('.card-image-wrap');
    const thumb = card.querySelector('.card-thumb');
    const dots  = Array.from(card.querySelectorAll('.dot'));
    const thumbs = JSON.parse(card.dataset.thumbs);
    let idx = 0, timer = null;

    function advance() {
      idx = (idx + 1) % thumbs.length;
      thumb.src = thumbs[idx];
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    }

    wrap.addEventListener('mouseenter', () => {
      timer = setInterval(advance, 1400);
    });
    wrap.addEventListener('mouseleave', () => {
      clearInterval(timer);
      idx = 0;
      thumb.src = thumbs[0];
      dots.forEach((d, i) => d.classList.toggle('active', i === 0));
    });
  });

  const cards       = Array.from(document.querySelectorAll('.card'));
  const grid        = document.getElementById('grid');
  const noResults   = document.getElementById('no-results');
  const resultsInfo = document.getElementById('results-info');
  const searchEl    = document.getElementById('search');
  let activeMode    = 'all';

  function update() {
    const q = searchEl.value.trim().toLowerCase();
    let visible = 0;
    cards.forEach(card => {
      const matchMode = activeMode === 'all' || card.dataset.mode === activeMode;
      const matchQ    = !q || card.dataset.name.includes(q) || card.dataset.key.includes(q);
      const show      = matchMode && matchQ;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    noResults.style.display = visible === 0 ? 'block' : 'none';
    grid.style.display      = visible === 0 ? 'none'  : '';
    resultsInfo.textContent = (q || activeMode !== 'all')
      ? \`Showing \${visible} of ${totalMaps} maps\`
      : '';
  }

  searchEl.addEventListener('input', update);
  document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeMode = pill.dataset.mode;
      update();
    });
  });
</script>
</body>
</html>`;

function mapPage([mapKey, map]) {
    const mode       = getMode(mapKey);
    const name       = map.display_name || mapKey;
    const imgSrc     = map.path || '';
    const thumbs     = map.thumb_paths || [];
    const radars     = map.radar_paths || [];
    const hasThumb   = thumbs.length > 0;
    const hasRadar   = radars.length > 0;

    const idx   = sorted.findIndex(([k]) => k === mapKey);
    const prev  = sorted[idx - 1];
    const next  = sorted[idx + 1];
    const prevLink = prev ? `<a class="nav-arrow nav-prev" href="${prev[0]}.html">← ${prev[1].display_name || prev[0]}</a>` : '<span></span>';
    const nextLink = next ? `<a class="nav-arrow nav-next" href="${next[0]}.html">${next[1].display_name || next[0]} →</a>` : '<span></span>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  ${sharedHead}
  <title>${name} - CS2 Map Icons</title>
  <link rel="icon" type="image/x-icon" href="${imgSrc}">
  <meta name="description" content="${name} (${mapKey}) - icons, radar and screenshots from Counter-Strike 2.">
  <style>
    /* NAV BAR */
    .topbar {
      position: sticky; top: 0; z-index: 50;
      background: rgba(13,14,16,.92);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 1rem;
      padding: 0 2rem; height: 48px;
      font-size: .7rem; letter-spacing: .08em;
    }
    .topbar-home {
      font-family: 'Barlow Condensed', sans-serif; font-weight: 900;
      color: var(--accent); font-size: .95rem;
      letter-spacing: .06em; text-transform: uppercase;
    }
    .topbar-home:hover { text-decoration: underline; }
    .topbar-sep { color: var(--muted); }
    .topbar-title { color: var(--text); font-family: 'JetBrains Mono', monospace; font-size: .72rem; }
    .topbar-mode {
      margin-left: auto;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: .68rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
      padding: 3px 10px; border-radius: 100px;
      border: 1px solid var(--mode-c, var(--border));
      color: var(--mode-c, var(--muted));
    }

    /* HERO */
    .page-hero {
      display: grid; grid-template-columns: 1fr 340px;
      gap: 0; border-bottom: 1px solid var(--border); min-height: 360px;
    }
    @media (max-width: 820px) { .page-hero { grid-template-columns: 1fr; } }

    /* SLIDESHOW */
    .slideshow { position: relative; background: #000; overflow: hidden; }
    .slide {
      position: absolute; inset: 0;
      background-size: cover; background-position: center;
      opacity: 0; transition: opacity .8s ease;
    }
    .slide.active { opacity: 1; }
    .slide-count {
      position: absolute; bottom: 10px; right: 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: .6rem; letter-spacing: .12em;
      color: rgba(255,255,255,.5); z-index: 2;
    }
    .slide-progress {
      position: absolute; bottom: 0; left: 0;
      height: 2px; background: var(--accent);
      transition: width linear; z-index: 3;
    }
    .slide-empty {
      width: 100%; height: 100%; min-height: 300px;
      background: repeating-linear-gradient(
        -45deg, var(--bg3) 0, var(--bg3) 6px, var(--bg2) 6px, var(--bg2) 12px
      );
      display: flex; align-items: center; justify-content: center;
      font-size: .7rem; color: var(--muted); letter-spacing: .1em;
    }

    /* SIDEBAR */
    .sidebar {
      border-left: 1px solid var(--border); padding: 2rem;
      display: flex; flex-direction: column; gap: 1.5rem;
      background: var(--surface);
    }
    @media (max-width: 820px) { .sidebar { border-left: none; border-top: 1px solid var(--border); } }
    .map-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900; font-size: 2.2rem; line-height: 1; letter-spacing: -.01em;
    }
    .map-key-badge {
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      font-size: .65rem; letter-spacing: .1em;
      padding: 3px 8px; background: var(--bg3);
      border: 1px solid var(--border); color: var(--muted); margin-top: .4rem;
      border-radius: 3px;
    }
    .map-icon-wrap { display: flex; align-items: center; gap: 1rem; }
    .map-icon-wrap img {
      width: 72px; height: 72px; object-fit: contain;
      filter: drop-shadow(0 2px 8px rgba(0,0,0,.7));
    }
    .meta-table { width: 100%; border-collapse: collapse; }
    .meta-table tr { border-bottom: 1px solid var(--border); }
    .meta-table tr:last-child { border-bottom: none; }
    .meta-table td { padding: .4rem 0; font-size: .7rem; letter-spacing: .04em; vertical-align: top; }
    .meta-table td:first-child {
      color: var(--muted); width: 100px;
      text-transform: uppercase; letter-spacing: .1em; font-size: .62rem; padding-right: 1rem;
    }
    .meta-table a { color: var(--accent); }
    .meta-table a:hover { text-decoration: underline; }
    .hash-val { font-family: 'JetBrains Mono', monospace; font-size: .6rem; word-break: break-all; color: var(--muted); }

    /* DOWNLOADS */
    .dl-section { border-top: 1px solid var(--border); padding: 2rem; }
    .section-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: .68rem; letter-spacing: .14em; text-transform: uppercase;
      color: var(--muted); margin-bottom: 1rem; font-weight: 700;
    }
    .dl-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px;
    }
    .dl-card {
      border: 1px solid var(--border); background: var(--surface);
      display: flex; flex-direction: column; border-radius: var(--radius);
      overflow: hidden; transition: border-color .15s;
    }
    .dl-card:hover { border-color: var(--accent); }
    .dl-card img {
      width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block;
      border-bottom: 1px solid var(--border); filter: saturate(.7); transition: filter .2s;
    }
    .dl-card:hover img { filter: saturate(1); }
    .dl-card-label {
      padding: .4rem .6rem; font-size: .62rem; letter-spacing: .08em;
      display: flex; justify-content: space-between; align-items: center; color: var(--muted);
    }
    .dl-card-label a { color: var(--accent); font-size: .6rem; }
    .dl-card-label a:hover { text-decoration: underline; }
    .dl-card-square img { aspect-ratio: 1/1; object-fit: contain; background: var(--bg3); padding: 8px; }

    /* NAV PREV/NEXT */
    .map-nav {
      border-top: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
      padding: 1rem 2rem; font-size: .7rem; letter-spacing: .06em;
    }
    .nav-arrow { color: var(--accent); }
    .nav-arrow:hover { text-decoration: underline; }

    /* FOOTER */
    footer {
      border-top: 1px solid var(--border); padding: .8rem 2rem;
      font-size: .62rem; color: var(--muted); letter-spacing: .06em;
      display: flex; justify-content: space-between;
    }
    footer a { color: var(--accent); }
    footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>

<div class="topbar">
  <a class="topbar-home" href="../index.html">CS2</a>
  <span class="topbar-sep">/</span>
  <span class="topbar-title">${mapKey}</span>
  <div class="topbar-mode" style="--mode-c:${mode.color}">${mode.label}</div>
</div>

<div class="page-hero">
  <!-- SLIDESHOW -->
  <div class="slideshow" id="ss">
    ${hasThumb
      ? thumbs.map((t, i) => `<div class="slide${i===0?' active':''}" style="background-image:url('${t}')"></div>`).join('\n    ')
      : `<div class="slide-empty">no screenshots available</div>`}
    ${hasThumb && thumbs.length > 1 ? `
    <div class="slide-count" id="sc">1 / ${thumbs.length}</div>
    <div class="slide-progress" id="sp"></div>` : ''}
  </div>

  <!-- SIDEBAR -->
  <aside class="sidebar">
    <div>
      <h1 class="map-title">${name}</h1>
      <div class="map-key-badge">${mapKey}</div>
    </div>

    ${imgSrc ? `
    <div class="map-icon-wrap">
      <img src="${imgSrc}" alt="${name} icon">
      <span style="font-size:.68rem;color:var(--muted);letter-spacing:.06em;">map icon</span>
    </div>` : ''}

    <table class="meta-table">
      <tr><td>mode</td><td>${mode.label}</td></tr>
      <tr><td>key</td><td>${mapKey}</td></tr>
      <tr><td>screenshots</td><td>${thumbs.length}</td></tr>
      <tr><td>radars</td><td>${radars.length}</td></tr>
      ${map.hash ? `<tr><td>vpk hash</td><td><span class="hash-val">${map.hash}</span></td></tr>` : ''}
      ${imgSrc  ? `<tr><td>icon</td><td><a href="${imgSrc}" target="_blank">icon.png ↗</a></td></tr>` : ''}
      ${hasRadar ? `<tr><td>radar</td><td><a href="${radars[0]}" target="_blank">radar.png ↗</a></td></tr>` : ''}
    </table>
  </aside>
</div>

${(hasThumb || hasRadar || imgSrc) ? `
<section class="dl-section">
  <div class="section-label">Assets</div>
  <div class="dl-grid">
    ${imgSrc ? `
    <div class="dl-card dl-card-square">
      <img src="${imgSrc}" alt="${name} icon" loading="lazy">
      <div class="dl-card-label"><span>Map Icon</span><a href="${imgSrc}" target="_blank" rel="noopener">↗ png</a></div>
    </div>` : ''}
    ${radars.map((r, i) => `
    <div class="dl-card dl-card-square">
      <img src="${r}" alt="radar ${i+1}" loading="lazy">
      <div class="dl-card-label"><span>Radar ${radars.length > 1 ? i+1 : ''}</span><a href="${r}" target="_blank" rel="noopener">↗ png</a></div>
    </div>`).join('')}
    ${thumbs.map((t, i) => `
    <div class="dl-card">
      <img src="${t}" alt="screenshot ${i+1}" loading="lazy">
      <div class="dl-card-label"><span>Screenshot ${thumbs.length > 1 ? i+1 : ''}</span><a href="${t}" target="_blank" rel="noopener">↗ png</a></div>
    </div>`).join('')}
  </div>
</section>` : ''}

<nav class="map-nav">
  ${prevLink}
  <a href="../index.html" style="color:var(--muted);font-size:.65rem;letter-spacing:.1em">ALL MAPS</a>
  ${nextLink}
</nav>

<footer>
  <span><a href="https://github.com/MurkyYT/cs2-map-icons">MurkyYT/cs2-map-icons</a> · not affiliated with valve</span>
  <span>${buildDate}</span>
</footer>

${hasThumb && thumbs.length > 1 ? `
<script>
  (function() {
    const INTERVAL = 4500;
    const slides   = Array.from(document.querySelectorAll('.slide'));
    const countEl  = document.getElementById('sc');
    const progEl   = document.getElementById('sp');
    let cur = 0;

    function goTo(n) {
      slides[cur].classList.remove('active');
      cur = (n + slides.length) % slides.length;
      slides[cur].classList.add('active');
      if (countEl) countEl.textContent = (cur + 1) + ' / ' + slides.length;
      runProgress();
    }

    function runProgress() {
      if (!progEl) return;
      progEl.style.transition = 'none';
      progEl.style.width = '0%';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        progEl.style.transition = 'width ' + INTERVAL + 'ms linear';
        progEl.style.width = '100%';
      }));
    }

    runProgress();
    setInterval(() => goTo(cur + 1), INTERVAL);
  })();
<\/script>` : ''}

</body>
</html>`;
}

[outDir, mapsDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

fs.writeFileSync(outFile, indexHTML, 'utf8');
console.log(`Index written -> ${outFile}  (${sorted.length} maps)`);

let count = 0;
for (const entry of sorted) {
    const [mapKey] = entry;
    const pageFile = path.join(mapsDir, `${mapKey}.html`);
    fs.writeFileSync(pageFile, mapPage(entry), 'utf8');
    count++;
}
console.log(`Map pages written -> ${mapsDir}/  (${count} pages)`);