const fs   = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const get  = (flag, def) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : def; };
const dataFile  = get('--data',  path.join(__dirname, 'data', 'available.json'));
const outFile   = get('--out',   path.join(__dirname, 'docs', 'index.html'));
const langsDir  = get('--langs', path.join(__dirname, 'languages'));
const outDir    = path.dirname(outFile);
const mapsDir   = path.join(outDir, 'maps');

function loadLanguages(dir) {
    if (!fs.existsSync(dir)) {
        console.error(`Languages folder not found: ${dir}`);
        process.exit(1);
    }
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
    if (files.length === 0) {
        console.error(`No .json files found in ${dir}`);
        process.exit(1);
    }
    const langs = {};
    for (const file of files) {
        const code = path.basename(file, '.json');
        try {
            langs[code] = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        } catch (e) {
            console.error(`Failed to parse ${file}: ${e.message}`);
            process.exit(1);
        }
        if (langs[code].script === 'rtl') langs[code].dir = 'rtl';
        if (!langs[code].dir) langs[code].dir = 'ltr';
    }
    return langs;
}

const LANGUAGES   = loadLanguages(langsDir);
const LANG_CODES  = Object.keys(LANGUAGES);
const DEFAULT_LANG = LANG_CODES.includes('en') ? 'en' : LANG_CODES[0];

console.log(`Loaded languages: ${LANG_CODES.join(', ')}`);

if (!fs.existsSync(dataFile)) {
    console.error(`Data file not found: ${dataFile}`);
    process.exit(1);
}
const { maps } = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

const MODE_CONFIG = {
    ar:    { label: 'Arms Race',   color: '#e8a020' },
    cs:    { label: 'Hostage',     color: '#3a9bd5' },
    de:    { label: 'Bomb Defuse', color: '#e05252' },
    lobby: { label: 'Menu',        color: '#7a7a8c' },
};

function getMode(mapKey) {
    const prefix = mapKey.split('_')[0];
    return MODE_CONFIG[prefix] || { label: prefix.toUpperCase(), color: '#555' };
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

function serializeLanguages() {
    return JSON.stringify(LANGUAGES);
}

const sharedHead = `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@400;500&family=JetBrains+Mono:wght@400;500&family=Noto+Sans:wght@400;500;700;900&family=Noto+Sans+SC:wght@400;500;700;900&family=Noto+Sans+Hebrew:wght@400;500;700;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    
    
    html.lang-cyr body, html.lang-cyr .pill, html.lang-cyr .card-name,
    html.lang-cyr .no-results, html.lang-cyr .logo, html.lang-cyr .section-label,
    html.lang-cyr .map-title, html.lang-cyr .lang-btn, html.lang-cyr .lang-option,
    html.lang-cyr header, html.lang-cyr .hero h1, html.lang-cyr .hero p,
    html.lang-cyr .card-mode-badge, html.lang-cyr .topbar-mode
    { font-family: 'Noto Sans', sans-serif !important; letter-spacing: 0 !important; }

    
    html.lang-cjk body, html.lang-cjk .pill, html.lang-cjk .card-name,
    html.lang-cjk .no-results, html.lang-cjk .logo, html.lang-cjk .section-label,
    html.lang-cjk .map-title, html.lang-cjk .lang-btn, html.lang-cjk .lang-option,
    html.lang-cjk header, html.lang-cjk .hero h1, html.lang-cjk .hero p,
    html.lang-cjk .card-mode-badge, html.lang-cjk .topbar-mode
    { font-family: 'Noto Sans SC', sans-serif !important; letter-spacing: 0 !important; }

    
    html.lang-rtl body, html.lang-rtl .pill, html.lang-rtl .card-name,
    html.lang-rtl .no-results, html.lang-rtl .logo, html.lang-rtl .section-label,
    html.lang-rtl .map-title, html.lang-rtl .lang-btn, html.lang-rtl .lang-option,
    html.lang-rtl header, html.lang-rtl .hero h1, html.lang-rtl .hero p,
    html.lang-rtl .card-mode-badge, html.lang-rtl .topbar-mode
    { font-family: 'Noto Sans Hebrew', sans-serif !important; letter-spacing: 0 !important; }

    
    html[dir="rtl"] body            { direction: rtl; }
    html[dir="rtl"] .header-inner   { flex-direction: row-reverse; }
    html[dir="rtl"] .card-mode-badge{ left: auto; right: 8px; }
    html[dir="rtl"] .card-icon      { right: auto; left: 8px; }
    html[dir="rtl"] .topbar         { flex-direction: row-reverse; }
    html[dir="rtl"] .topbar-right   { margin-left: 0; margin-right: auto; }
    html[dir="rtl"] .sidebar        { border-left: none; border-right: 1px solid var(--border); }
    html[dir="rtl"] .dl-card-label  { flex-direction: row-reverse; }
    html[dir="rtl"] .map-nav        { flex-direction: row-reverse; }
    html[dir="rtl"] footer          { flex-direction: row-reverse; }
    html[dir="rtl"] .meta-table td:first-child { padding-right: 0; padding-left: 1rem; }
    html[dir="rtl"] .search-wrap svg { left: auto; right: 10px; }
    html[dir="rtl"] #search         { padding: 7px 34px 7px 12px; }

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

    
    .lang-switcher { position: relative; flex-shrink: 0; }
    .lang-btn {
      display: flex; align-items: center; gap: 5px;
      background: var(--bg3); border: 1px solid var(--border);
      border-radius: var(--radius); color: var(--text);
      font-family: 'Barlow Condensed', sans-serif;
      font-size: .75rem; font-weight: 600; letter-spacing: .06em;
      padding: 5px 10px; cursor: pointer; transition: border-color .15s;
    }
    .lang-btn:hover { border-color: var(--accent); }
    .lang-btn svg { opacity: .5; }
    .lang-dropdown {
      display: none; position: absolute; top: calc(100% + 6px); right: 0;
      background: var(--bg2); border: 1px solid var(--border);
      border-radius: var(--radius); overflow: hidden;
      min-width: 150px; z-index: 200;
      box-shadow: 0 8px 24px rgba(0,0,0,.5);
    }
    html[dir="rtl"] .lang-dropdown { right: auto; left: 0; }
    .lang-dropdown.open { display: block; }
    .lang-option {
      display: flex; align-items: center; justify-content: space-between;
      padding: 7px 12px; font-size: .8rem; cursor: pointer;
      transition: background .12s; white-space: nowrap;
    }
    .lang-option:hover { background: var(--bg3); }
    .lang-option.active { color: var(--accent); }
    .lang-option .lang-code {
      font-family: 'JetBrains Mono', monospace;
      font-size: .6rem; color: var(--muted); margin-left: 8px;
    }
  </style>`;

function i18nScript(isMapPage = false) {
    return `
<script>
(function() {
  const LANG_DATA   = ${serializeLanguages()};
  const LANG_KEYS   = ${JSON.stringify(LANG_CODES)};
  const DEFAULT     = '${DEFAULT_LANG}';
  const STORAGE_KEY = 'cs2mi_lang';
  const IS_MAP_PAGE = ${isMapPage};

  
  function interp(str, vars) {
    return str.replace(/\\{\\{(\\w+)\\}\\}/g, (_, k) => vars[k] !== undefined ? vars[k] : '');
  }

  function t(lang, key, vars) {
    const val = (LANG_DATA[lang] && LANG_DATA[lang][key] !== undefined)
      ? LANG_DATA[lang][key]
      : (LANG_DATA[DEFAULT][key] || key);
    return vars ? interp(val, vars) : val;
  }

  function detectLang() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LANG_KEYS.includes(stored)) return stored;
    const browser = (navigator.language || '').slice(0, 2).toLowerCase();
    return LANG_KEYS.includes(browser) ? browser : DEFAULT;
  }

  
  const SCRIPT_CLASS = { cyr: 'lang-cyr', cjk: 'lang-cjk', rtl: 'lang-rtl' };

  function applyLang(lang) {
    const data = LANG_DATA[lang] || LANG_DATA[DEFAULT];

    
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key  = el.dataset.i18n;
      const vars = el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : undefined;
      el.textContent = t(lang, key, vars);
    });

    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(lang, el.dataset.i18nPlaceholder);
    });

    
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key  = el.dataset.i18nHtml;
      const vars = el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : undefined;
      const val  = (LANG_DATA[lang] && LANG_DATA[lang][key]) || (LANG_DATA[DEFAULT][key] || '');
      el.innerHTML = vars ? interp(val, vars) : val;
    });

    
    if (!IS_MAP_PAGE) {
      const pillMap = {
        'all':         'filterAll',
        'Bomb Defuse': 'filterDefuse',
        'Hostage':     'filterHostage',
        'Arms Race':   'filterArms',
        'Menu':        'filterMenu',
      };
      document.querySelectorAll('.pill').forEach(pill => {
        const key = pillMap[pill.dataset.mode];
        if (key) pill.textContent = t(lang, key);
      });
    }

    
    const badgeMap = {
      'Bomb Defuse': t(lang, 'filterDefuse'),
      'Hostage':     t(lang, 'filterHostage'),
      'Arms Race':   t(lang, 'filterArms'),
      'Menu':        t(lang, 'filterMenu'),
    };
    document.querySelectorAll('[data-badge-mode]').forEach(badge => {
      const translated = badgeMap[badge.dataset.badgeMode];
      if (translated) badge.textContent = translated;
    });

    
    document.querySelectorAll('.lang-option').forEach(opt =>
      opt.classList.toggle('active', opt.dataset.lang === lang));
    const btnLabel = document.getElementById('lang-btn-label');
    if (btnLabel) btnLabel.textContent = lang.toUpperCase();

    
    document.documentElement.lang = lang;
    document.documentElement.classList.remove('lang-cyr', 'lang-cjk', 'lang-rtl');
    const script = data.script || 'latin';
    if (SCRIPT_CLASS[script]) document.documentElement.classList.add(SCRIPT_CLASS[script]);
    const dir = data.dir || 'ltr';
    document.documentElement.setAttribute('dir', dir);
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    applyLang(lang);
  }

  window.toggleLangDropdown = function(e) {
    e.stopPropagation();
    document.getElementById('lang-dropdown').classList.toggle('open');
  };
  window.chooseLang = function(lang) {
    setLang(lang);
    document.getElementById('lang-dropdown').classList.remove('open');
  };
  document.addEventListener('click', () =>
    document.getElementById('lang-dropdown')?.classList.remove('open'));

  const currentLang = detectLang();
  document.addEventListener('DOMContentLoaded', () => applyLang(currentLang));
})();
<\/script>`;
}

function langSwitcherWidget() {
    const opts = LANG_CODES.map(code =>
        `<div class="lang-option" data-lang="${code}" onclick="chooseLang('${code}')">
          ${LANGUAGES[code].nativeName || code}<span class="lang-code">${code.toUpperCase()}</span>
        </div>`
    ).join('\n        ');

    return `
    <div class="lang-switcher">
      <button class="lang-btn" onclick="toggleLangDropdown(event)" aria-label="Select language">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span id="lang-btn-label">EN</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      <div class="lang-dropdown" id="lang-dropdown">
        ${opts}
      </div>
    </div>`;
}

function indexCard([mapKey, map]) {
    const mode     = getMode(mapKey);
    const name     = map.display_name || mapKey;
    const imgSrc   = map.path || '';
    const thumbs   = map.thumb_paths || [];
    const thumbSrc = thumbs.length > 0 ? thumbs[0] : DEFAULT_THUMB;

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
      <span class="card-mode-badge" style="--badge-color:${mode.color}" data-badge-mode="${mode.label}">${mode.label}</span>
      ${thumbDots}
    </div>
    <div class="card-body">
      <h2 class="card-name">${name}</h2>
      <code class="card-key">${mapKey}</code>
    </div>
  </a>`;
}

const indexHTML = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  ${sharedHead}
  <title>CS2 Map Icons</title>
  <link rel="icon" type="image/x-icon" href="https://developer.valvesoftware.com/w/images/6/61/Csgo_icon_competitive.png">
  <meta name="description" content="${totalMaps} Counter-Strike 2 maps - icons, radars, screenshots.">
  <style>
    header {
      position: sticky; top: 0; z-index: 100;
      background: rgba(13,14,16,.92); backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border); padding: 0 2rem;
    }
    .header-inner {
      max-width: 1600px; margin: 0 auto;
      display: flex; align-items: center; gap: 1.5rem; height: 58px;
    }
    .logo {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900; font-size: 1.4rem; letter-spacing: .04em;
      color: var(--accent); white-space: nowrap; flex-shrink: 0;
    }
    .logo span { color: var(--text); }
    .header-count {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: .85rem; color: var(--muted);
      border: 1px solid var(--border); padding: 2px 8px; border-radius: 100px; white-space: nowrap;
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
      font-family: inherit; font-size: .9rem; outline: none; transition: border-color .2s;
    }
    #search:focus { border-color: var(--accent); }
    #search::placeholder { color: var(--muted); }
    .filter-pills { display: flex; gap: .4rem; flex-wrap: wrap; }
    .pill {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: .8rem; font-weight: 600; letter-spacing: .05em; text-transform: uppercase;
      padding: 3px 10px; border-radius: 100px;
      border: 1px solid var(--border); background: transparent;
      color: var(--muted); cursor: pointer; transition: all .15s; white-space: nowrap;
    }
    .pill:hover  { border-color: var(--accent); color: var(--accent); }
    .pill.active { background: var(--accent); border-color: var(--accent); color: #000; }
    .pill[data-mode="Bomb Defuse"].active { background: #e05252; border-color: #e05252; color: #fff; }
    .pill[data-mode="Hostage"].active     { background: #3a9bd5; border-color: #3a9bd5; color: #fff; }
    .pill[data-mode="Arms Race"].active   { background: #e8a020; border-color: #e8a020; color: #000; }
    .pill[data-mode="Menu"].active        { background: #7a7a8c; border-color: #7a7a8c; color: #fff; }
    .header-right { margin-left: auto; font-size: .75rem; color: var(--muted); white-space: nowrap; }
    .header-right a { color: var(--accent); }
    .header-right a:hover { text-decoration: underline; }
    .hero { max-width: 1600px; margin: 0 auto; padding: 3rem 2rem 1.5rem; }
    .hero h1 {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900; font-size: clamp(2.5rem, 5vw, 4.5rem);
      line-height: 1; letter-spacing: -.01em; margin-bottom: .5rem;
    }
    .hero h1 em { font-style: normal; color: var(--accent); }
    .hero p { color: var(--muted); max-width: 560px; font-size: .95rem; }
    .grid-wrap { max-width: 1600px; margin: 0 auto; padding: 1rem 2rem 4rem; }
    .results-info { font-size: .82rem; color: var(--muted); margin-bottom: 1rem; height: 1.2em; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(var(--card-w), 1fr));
      gap: 1px; background: var(--border);
      border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
    }
    .card {
      background: var(--surface); display: flex; flex-direction: column;
      transition: background .15s; animation: fadeIn .3s ease both;
    }
    .card:hover { background: var(--bg3); }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .card-image-wrap {
      position: relative; aspect-ratio: 16/9; background: var(--bg2); overflow: hidden;
    }
    .card-thumb {
      width: 100%; height: 100%; object-fit: cover; display: block;
      transition: opacity .4s, transform .35s;
    }
    .card:hover .card-thumb { transform: scale(1.03); }
    .card-icon {
      position: absolute; bottom: 8px; right: 8px;
      width: 48px; height: 48px; object-fit: contain;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,.8)); transition: transform .2s;
    }
    .card:hover .card-icon { transform: scale(1.12); }
    .card-mode-badge {
      position: absolute; top: 8px; left: 8px;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 700; font-size: .65rem; letter-spacing: .1em; text-transform: uppercase;
      color: #000; background: var(--badge-color, #888); padding: 2px 7px; border-radius: 3px;
    }
    .thumb-dots {
      position: absolute; bottom: 6px; left: 50%;
      transform: translateX(-50%); display: flex; gap: 4px;
    }
    .dot {
      width: 5px; height: 5px; border-radius: 50%;
      background: rgba(255,255,255,.35); cursor: pointer; transition: background .15s;
    }
    .dot.active, .dot:hover { background: #fff; }
    .card-body { padding: .75rem 1rem .9rem; display: flex; flex-direction: column; gap: .3rem; flex: 1; }
    .card-name {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 700; font-size: 1.15rem; letter-spacing: .02em;
      color: var(--text); line-height: 1.2;
    }
    .card-key { font-family: 'JetBrains Mono', monospace; font-size: .7rem; color: var(--muted); }
    .no-results {
      display: none; padding: 4rem 2rem; text-align: center;
      color: var(--muted); font-family: 'Barlow Condensed', sans-serif;
      font-size: 1.3rem; letter-spacing: .05em; text-transform: uppercase;
    }
    footer {
      border-top: 1px solid var(--border); padding: 1.2rem 2rem;
      text-align: center; font-size: .78rem; color: var(--muted);
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
    <span class="header-count">${totalMaps} <span data-i18n="maps">maps</span></span>

    <div class="search-wrap">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input id="search" type="search" data-i18n-placeholder="searchPlaceholder"
             placeholder="Search maps…" autocomplete="off" spellcheck="false">
    </div>

    <div class="filter-pills">
      <button class="pill active" data-mode="all">All</button>
      <button class="pill" data-mode="Bomb Defuse">Defuse</button>
      <button class="pill" data-mode="Hostage">Hostage</button>
      <button class="pill" data-mode="Arms Race">Arms Race</button>
      <button class="pill" data-mode="Menu">Menu</button>
    </div>

    <div class="header-right">
      <span data-i18n="builtOn">Built</span> ${buildDate} &nbsp;·&nbsp;
      <a href="https://github.com/MurkyYT/cs2-map-icons" target="_blank" rel="noopener">GitHub ↗</a>
    </div>

    ${langSwitcherWidget()}
  </div>
</header>

<section class="hero">
  <h1>Counter-Strike 2<br><em data-i18n="heroTitle2">Map Icons</em></h1>
  <p data-i18n="heroDesc" data-i18n-vars='{"n":${totalMaps}}'>All ${totalMaps} maps auto-extracted from the game VPK on every update.</p>
</section>

<main class="grid-wrap">
  <div class="results-info" id="results-info"></div>
  <div class="grid" id="grid">
    ${sorted.map(indexCard).join('\n')}
  </div>
  <div class="no-results" id="no-results" data-i18n="noMaps">No maps found</div>
</main>

<footer>
  <span data-i18n-html="footer">Auto-generated from <a href="https://github.com/MurkyYT/cs2-map-icons">MurkyYT/cs2-map-icons</a> · Not affiliated with Valve Corporation</span>
</footer>

${i18nScript(false)}

<script>
  
  document.querySelectorAll('.card-image-wrap').forEach(wrap => {
    const thumb = wrap.querySelector('.card-thumb');
    const dots  = wrap.querySelectorAll('.dot');
    if (!thumb || !dots.length) return;
    dots.forEach(dot => {
      dot.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        thumb.src = dot.dataset.src;
        dots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
      });
    });
  });

  document.querySelectorAll('.card[data-thumbs]').forEach(card => {
    const wrap   = card.querySelector('.card-image-wrap');
    const thumb  = card.querySelector('.card-thumb');
    const dots   = Array.from(card.querySelectorAll('.dot'));
    const thumbs = JSON.parse(card.dataset.thumbs);
    let idx = 0, timer = null;
    const advance = () => {
      idx = (idx + 1) % thumbs.length;
      thumb.src = thumbs[idx];
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    };
    wrap.addEventListener('mouseenter', () => { timer = setInterval(advance, 1400); });
    wrap.addEventListener('mouseleave', () => {
      clearInterval(timer); idx = 0;
      thumb.src = thumbs[0];
      dots.forEach((d, i) => d.classList.toggle('active', i === 0));
    });
  });

  
  const TOTAL       = ${totalMaps};
  const cards       = Array.from(document.querySelectorAll('.card'));
  const grid        = document.getElementById('grid');
  const noResults   = document.getElementById('no-results');
  const resultsInfo = document.getElementById('results-info');
  const searchEl    = document.getElementById('search');
  let activeMode    = 'all';

  function getShowingText(vis) {
    const lang     = localStorage.getItem('cs2mi_lang') || '${DEFAULT_LANG}';
    const LANG_DATA = ${serializeLanguages()};
    const tpl = (LANG_DATA[lang] && LANG_DATA[lang].showingOf) || LANG_DATA['${DEFAULT_LANG}'].showingOf || '';
    return tpl.replace(/\\{\\{vis\\}\\}/g, vis).replace(/\\{\\{tot\\}\\}/g, TOTAL);
  }

  function update() {
    const q = searchEl.value.trim().toLowerCase();
    let visible = 0;
    cards.forEach(card => {
      const ok = (activeMode === 'all' || card.dataset.mode === activeMode)
              && (!q || card.dataset.name.includes(q) || card.dataset.key.includes(q));
      card.style.display = ok ? '' : 'none';
      if (ok) visible++;
    });
    noResults.style.display = visible === 0 ? 'block' : 'none';
    grid.style.display      = visible === 0 ? 'none'  : '';
    resultsInfo.textContent = (q || activeMode !== 'all') ? getShowingText(visible) : '';
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

  
  const _orig = window.chooseLang;
  window.chooseLang = lang => { _orig(lang); update(); };
</script>
</body>
</html>`;

function mapPage([mapKey, map]) {
    const mode     = getMode(mapKey);
    const name     = map.display_name || mapKey;
    const imgSrc   = map.path || '';
    const thumbs   = map.thumb_paths || [];
    const radars   = map.radar_paths || [];
    const hasThumb = thumbs.length > 0;
    const hasRadar = radars.length > 0;

    const idx      = sorted.findIndex(([k]) => k === mapKey);
    const prev     = sorted[idx - 1];
    const next     = sorted[idx + 1];
    const prevLink = prev ? `<a class="nav-arrow" href="${prev[0]}.html">← ${prev[1].display_name || prev[0]}</a>` : '<span></span>';
    const nextLink = next ? `<a class="nav-arrow" href="${next[0]}.html">${next[1].display_name || next[0]} →</a>` : '<span></span>';

    return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  ${sharedHead}
  <title>${name} - CS2 Map Icons</title>
  <link rel="icon" type="image/x-icon" href="${imgSrc}">
  <meta name="description" content="${name} (${mapKey}) - icons, radar and screenshots from Counter-Strike 2.">
  <style>
    .topbar {
      position: sticky; top: 0; z-index: 50;
      background: rgba(13,14,16,.92); backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 1rem;
      padding: 0 2rem; height: 48px;
    }
    .topbar-home {
      font-family: 'Barlow Condensed', sans-serif; font-weight: 900;
      color: var(--accent); font-size: .95rem; letter-spacing: .06em; text-transform: uppercase;
    }
    .topbar-home:hover { text-decoration: underline; }
    .topbar-sep { color: var(--muted); }
    .topbar-title { color: var(--text); font-family: 'JetBrains Mono', monospace; font-size: .72rem; }
    .topbar-mode {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: .68rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
      padding: 3px 10px; border-radius: 100px;
      border: 1px solid var(--mode-c, var(--border)); color: var(--mode-c, var(--muted));
    }
    .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 1rem; }
    .page-hero {
      display: grid; grid-template-columns: 1fr 340px;
      gap: 0; border-bottom: 1px solid var(--border); min-height: 360px;
    }
    @media (max-width: 820px) { .page-hero { grid-template-columns: 1fr; } }
    .slideshow { position: relative; background: #000; overflow: hidden; }
    .slide {
      position: absolute; inset: 0;
      background-size: cover; background-position: center;
      opacity: 0; transition: opacity .8s ease;
    }
    .slide.active { opacity: 1; }
    .slide-count {
      position: absolute; bottom: 10px; right: 12px;
      font-family: 'JetBrains Mono', monospace; font-size: .6rem;
      letter-spacing: .12em; color: rgba(255,255,255,.5); z-index: 2;
    }
    .slide-progress {
      position: absolute; bottom: 0; left: 0;
      height: 2px; background: var(--accent); transition: width linear; z-index: 3;
    }
    .slide-empty {
      width: 100%; height: 100%; min-height: 300px;
      background: repeating-linear-gradient(
        -45deg, var(--bg3) 0, var(--bg3) 6px, var(--bg2) 6px, var(--bg2) 12px
      );
      display: flex; align-items: center; justify-content: center;
      font-size: .7rem; color: var(--muted); letter-spacing: .1em;
    }
    .sidebar {
      border-left: 1px solid var(--border); padding: 2rem;
      display: flex; flex-direction: column; gap: 1.5rem; background: var(--surface);
    }
    @media (max-width: 820px) { .sidebar { border-left: none; border-top: 1px solid var(--border); } }
    .map-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900; font-size: 2.2rem; line-height: 1; letter-spacing: -.01em;
    }
    .map-key-badge {
      display: inline-block; font-family: 'JetBrains Mono', monospace;
      font-size: .65rem; letter-spacing: .1em; padding: 3px 8px;
      background: var(--bg3); border: 1px solid var(--border);
      color: var(--muted); margin-top: .4rem; border-radius: 3px;
    }
    .map-icon-wrap { display: flex; align-items: center; gap: 1rem; }
    .map-icon-wrap img { width: 72px; height: 72px; object-fit: contain; filter: drop-shadow(0 2px 8px rgba(0,0,0,.7)); }
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
    .dl-section { border-top: 1px solid var(--border); padding: 2rem; }
    .section-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: .68rem; letter-spacing: .14em; text-transform: uppercase;
      color: var(--muted); margin-bottom: 1rem; font-weight: 700;
    }
    .dl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
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
    .dl-actions { display: flex; align-items: center; gap: 6px; }
    .copy-btn {
      background: transparent; border: 1px solid var(--border); color: var(--muted);
      font-family: inherit; font-size: .6rem; line-height: 1; padding: 2px 5px;
      border-radius: 3px; cursor: pointer; transition: border-color .15s, color .15s;
    }
    .copy-btn:hover { border-color: var(--accent); color: var(--accent); }
    .copy-btn.copied { border-color: #6bbf6b; color: #6bbf6b; }
    .map-nav {
      border-top: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
      padding: 1rem 2rem; font-size: .7rem; letter-spacing: .06em;
    }
    .nav-arrow { color: var(--accent); }
    .nav-arrow:hover { text-decoration: underline; }
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
  <div class="topbar-right">${langSwitcherWidget()}</div>
</div>

<div class="page-hero">
  <div class="slideshow" id="ss">
    ${hasThumb
      ? thumbs.map((t, i) => `<div class="slide${i===0?' active':''}" style="background-image:url('${t}')"></div>`).join('\n    ')
      : `<div class="slide-empty"><span data-i18n="noScreenshots">no screenshots available</span></div>`}
    ${hasThumb && thumbs.length > 1 ? `
    <div class="slide-count" id="sc">1 / ${thumbs.length}</div>
    <div class="slide-progress" id="sp"></div>` : ''}
  </div>

  <aside class="sidebar">
    <div>
      <h1 class="map-title">${name}</h1>
      <div class="map-key-badge">${mapKey}</div>
    </div>

    ${imgSrc ? `
    <div class="map-icon-wrap">
      <img src="${imgSrc}" alt="${name} icon">
      <span style="font-size:.68rem;color:var(--muted);letter-spacing:.06em;" data-i18n="iconLabel">map icon</span>
    </div>` : ''}

    <table class="meta-table">
      <tr><td data-i18n="modeLabel">Mode</td><td>${mode.label}</td></tr>
      <tr><td data-i18n="keyLabel">Key</td><td>${mapKey}</td></tr>
      <tr><td data-i18n="screenshotsLabel">Screenshots</td><td>${thumbs.length}</td></tr>
      <tr><td data-i18n="radarsLabel">Radars</td><td>${radars.length}</td></tr>
      ${map.hash  ? `<tr><td data-i18n="vpkHashLabel">VPK Hash</td><td><span class="hash-val">${map.hash}</span></td></tr>` : ''}
      ${imgSrc    ? `<tr><td data-i18n="iconLabel">Icon</td><td><a href="${imgSrc}" target="_blank">icon.png ↗</a></td></tr>` : ''}
      ${hasRadar  ? `<tr><td data-i18n="radarLabel">Radar</td><td><a href="${radars[0]}" target="_blank">radar.png ↗</a></td></tr>` : ''}
    </table>
  </aside>
</div>

${(hasThumb || hasRadar || imgSrc) ? `
<section class="dl-section">
  <div class="section-label" data-i18n="assetsSection">Assets</div>
  <div class="dl-grid">
    ${imgSrc ? `
    <div class="dl-card dl-card-square">
      <img src="${imgSrc}" alt="${name} icon" loading="lazy">
      <div class="dl-card-label">
        <span data-i18n="mapIcon">Map Icon</span>
        <span class="dl-actions">
          <button type="button" class="copy-btn" data-url="${imgSrc}" title="Copy URL" aria-label="Copy URL">⧉</button>
          <a href="${imgSrc}" target="_blank" rel="noopener">↗ png</a>
        </span>
      </div>
    </div>` : ''}
    ${radars.map((r, i) => `
    <div class="dl-card dl-card-square">
      <img src="${r}" alt="radar ${i+1}" loading="lazy">
      <div class="dl-card-label">
        <span><span data-i18n="radarLabel">Radar</span>${radars.length > 1 ? ` ${i+1}` : ''}</span>
        <span class="dl-actions">
          <button type="button" class="copy-btn" data-url="${r}" title="Copy URL" aria-label="Copy URL">⧉</button>
          <a href="${r}" target="_blank" rel="noopener">↗ png</a>
        </span>
      </div>
    </div>`).join('')}
    ${thumbs.map((t, i) => `
    <div class="dl-card">
      <img src="${t}" alt="screenshot ${i+1}" loading="lazy">
      <div class="dl-card-label">
        <span><span data-i18n="screenshot">Screenshot</span>${thumbs.length > 1 ? ` ${i+1}` : ''}</span>
        <span class="dl-actions">
          <button type="button" class="copy-btn" data-url="${t}" title="Copy URL" aria-label="Copy URL">⧉</button>
          <a href="${t}" target="_blank" rel="noopener">↗ png</a>
        </span>
      </div>
    </div>`).join('')}
  </div>
</section>` : ''}

<nav class="map-nav">
  ${prevLink}
  <a href="../index.html" style="color:var(--muted);font-size:.65rem;letter-spacing:.1em" data-i18n="allMaps">ALL MAPS</a>
  ${nextLink}
</nav>

<footer>
  <span><a href="https://github.com/MurkyYT/cs2-map-icons">MurkyYT/cs2-map-icons</a> · <span data-i18n="notAffiliated">not affiliated with valve</span></span>
  <span>${buildDate}</span>
</footer>

${i18nScript(true)}

<script>
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const url = btn.dataset.url;
      try {
        await navigator.clipboard.writeText(url);
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e2) {}
        document.body.removeChild(ta);
      }
      const original = btn.textContent;
      btn.textContent = '✓';
      btn.classList.add('copied');
      clearTimeout(btn._copyTimer);
      btn._copyTimer = setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1200);
    });
  });
</script>

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
      progEl.style.transition = 'none'; progEl.style.width = '0%';
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

fs.rmSync(outDir, { recursive: true, force: true });

[outDir, mapsDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

fs.writeFileSync(outFile, indexHTML, 'utf8');
console.log(`Index written -> ${outFile}  (${sorted.length} maps)`);

let count = 0;
for (const entry of sorted) {
    const [mapKey] = entry;
    fs.writeFileSync(path.join(mapsDir, `${mapKey}.html`), mapPage(entry), 'utf8');
    count++;
}
console.log(`Map pages written -> ${mapsDir}/  (${count} pages)`);