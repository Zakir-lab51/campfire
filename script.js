/* Campfire: search (Fuse.js), map (Leaflet CRS.Simple) and browse, all driven by data.json. */
(() => {
  'use strict';

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('campfire:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('campfire:' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  // Side panel + map together on wide screens and on any iPad (portrait too); one view at a time on phones.
  const desktop = window.matchMedia('(min-width: 960px), (min-width: 740px) and (min-height: 600px)');
  const touch = navigator.maxTouchPoints > 0;
  // iPadOS Safari reports itself as a Mac, so check for touch too.
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

  /* ---------- look of each place type: pin colour + picture ---------- */
  const TYPES = {
    town:            { label: 'Town',              color: '#5b3e29', glyph: 'house',    named: true },
    camp:            { label: 'Gang camp',         color: '#c4592a', glyph: 'tent',     named: true },
    landmark:        { label: 'Landmark',          color: '#7c6a4e', glyph: 'peak',     named: true },
    area:            { label: 'Region',            color: '#8b7760', glyph: 'map',      named: true },
    water:           { label: 'Lake or river',     color: '#3f7f8c', glyph: 'wave',     named: true },
    legendary:       { label: 'Legendary animal',  color: '#a9332a', glyph: 'paw',      named: true },
    'legendary-fish':{ label: 'Legendary fish',    color: '#2f6b87', glyph: 'fish',     named: true },
    hideout:         { label: 'Gang hideout',      color: '#7e2a20', glyph: 'skull',    named: true },
    stranger:        { label: 'Stranger',          color: '#6b4884', glyph: 'question', named: true },
    special:         { label: 'Special character', color: '#ad4d6c', glyph: 'star',     named: true },
    bounty:          { label: 'Bounty target',     color: '#9c402a', glyph: 'poster',   named: true },
    treasure:        { label: 'Treasure',          color: '#c08a22', glyph: 'gem',      named: true },
    shop:            { label: 'Trapper / fence',   color: '#4c7042', glyph: 'pelt',     named: true },
    poi:             { label: 'Point of interest', color: '#3c8890', glyph: 'excl',     named: true },
    shack:           { label: 'Shack',             color: '#86573a', glyph: 'cabin',    named: true },
    card:            { label: 'Cigarette card',    color: '#b3862a', glyph: 'card' },
    bone:            { label: 'Dinosaur bone',     color: '#8a7860', glyph: 'bone' },
    carving:         { label: 'Rock carving',      color: '#6f6150', glyph: 'spiral' },
    dreamcatcher:    { label: 'Dreamcatcher',      color: '#76509a', glyph: 'web' },
    chest:           { label: 'Chest / lock box',  color: '#cc6428', glyph: 'chest' },
    tonic:           { label: 'Special tonic',     color: '#3a8862', glyph: 'bottle' },
    unique:          { label: 'Unique item',       color: '#9d4658', glyph: 'key' },
    request:         { label: 'Item request',      color: '#33406a', glyph: 'letter' },
    orchid:          { label: 'Orchid',            color: '#bd5480', glyph: 'flower' },
    'gator-egg':     { label: 'Gator eggs',        color: '#66803a', glyph: 'egg' },
  };
  // White pictures drawn inside the pins (24x24 grid; class "f" = filled).
  const GLYPHS = {
    house: '<path d="M4 11l8-6 8 6v9H4z"/><path d="M10 20v-5h4v5"/>',
    tent: '<path d="M2.5 20h19M12 4L4 20M12 4l8 16"/><path d="M12 12l-3 8M12 12l3 8"/>',
    peak: '<path d="M2.5 19l6.5-11 4 6 3-4 5.5 9z"/>',
    map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
    wave: '<path d="M3 10c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0"/>',
    paw: '<ellipse class="f" cx="12" cy="16" rx="4.3" ry="3.5"/><circle class="f" cx="5.8" cy="10.6" r="2"/><circle class="f" cx="9.6" cy="6.5" r="2"/><circle class="f" cx="14.4" cy="6.5" r="2"/><circle class="f" cx="18.2" cy="10.6" r="2"/>',
    fish: '<path d="M2.5 12c3-4 8.5-5 12.5-3l5.5-3.2v12.4L15 15c-4 2-9.5 1-12.5-3z"/><circle class="f" cx="7.6" cy="11" r="1.1"/>',
    skull: '<path d="M12 3a7 7 0 0 0-7 7c0 2.6 1.3 4.1 3 5v3.5h8V15c1.7-.9 3-2.4 3-5a7 7 0 0 0-7-7z"/><circle class="f" cx="9.2" cy="10.6" r="1.7"/><circle class="f" cx="14.8" cy="10.6" r="1.7"/>',
    question: '<path d="M8.7 9a3.3 3.3 0 1 1 4.9 2.9c-1 .6-1.6 1.3-1.6 2.6"/><circle class="f" cx="12" cy="18.6" r="1.5"/>',
    star: '<path class="f" d="M12 2.8l2.7 5.7 6.2.8-4.6 4.3 1.2 6.2L12 16.7l-5.5 3.1 1.2-6.2-4.6-4.3 6.2-.8z"/>',
    poster: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    gem: '<path d="M6 4h12l3.5 5L12 20.5 2.5 9z"/><path d="M2.5 9h19M9 4l3 16.5L15 4"/>',
    pelt: '<path d="M7 3.5c1.2 2 3 2.2 5 2.2s3.8-.2 5-2.2l1.5 4.5-2.2 2.2v7.6l2 2.4H5.7l2-2.4v-7.6L5.5 8z"/>',
    excl: '<path d="M12 4v10"/><circle class="f" cx="12" cy="19" r="1.7"/>',
    cabin: '<path d="M3 20V10l9-6 9 6v10z"/><path d="M3 13.5h18M3 17h18"/>',
    card: '<rect x="6" y="2.8" width="12" height="18.4" rx="1.6"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    bone: '<path d="M8.4 5.6a2.3 2.3 0 1 0-2.8 2.8l10 10a2.3 2.3 0 1 0 2.8-2.8z"/>',
    spiral: '<path d="M12 12a1.6 1.6 0 1 1 1.6-1.6 3.6 3.6 0 1 1-4.8 3.4 5.8 5.8 0 1 1 9-4.9"/>',
    web: '<circle cx="12" cy="9" r="6"/><path d="M12 3v12M6 9h12M7.8 4.8l8.4 8.4M16.2 4.8l-8.4 8.4"/><path d="M9 15l-1.2 6M15 15l1.2 6"/>',
    chest: '<rect x="3" y="9" width="18" height="11" rx="1"/><path d="M3 9.5C3 6.5 5 5 8 5h8c3 0 5 1.5 5 4.5M3 13h18"/><rect class="f" x="10.4" y="12" width="3.2" height="4.2" rx=".6"/>',
    bottle: '<path d="M10 2.8h4V7l2.2 3.2v10H7.8V10.2L10 7z"/><path d="M7.8 14.2h8.4"/>',
    key: '<circle cx="7.6" cy="12" r="4.2"/><path d="M11.8 12h9.4M18 12v3.2M21.2 12v2.4"/>',
    letter: '<rect x="3" y="6" width="18" height="12.5" rx="1"/><path d="M3 7l9 6.2L21 7"/>',
    flower: '<circle cx="12" cy="6.6" r="2.7"/><circle cx="7.4" cy="10.2" r="2.7"/><circle cx="16.6" cy="10.2" r="2.7"/><circle cx="9.2" cy="15.6" r="2.7"/><circle cx="14.8" cy="15.6" r="2.7"/><circle class="f" cx="12" cy="11.2" r="1.9"/>',
    egg: '<path d="M12 3c3.5 0 6 5.6 6 10.2a6 6 0 0 1-12 0C6 8.6 8.5 3 12 3z"/>',
    grid: '<path d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>',
    leaf: '<path d="M5 19.5C4.6 11 9.6 4.8 20 4c.4 10.2-5.6 15.6-15 15.5z"/><path d="M5 19.5l8.6-8.6"/>',
  };
  const glyph = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[name] || GLYPHS.excl}</svg>`;
  const PIN = 'M14 35C12.6 29.5 2 22.5 2 13a12 12 0 0 1 24 0c0 9.5-10.6 16.5-12 22z';
  const pinHtml = (color, g, extra = '') => `<span class="pin" style="--c:${color}"><svg class="body" viewBox="-1 -1 31 39" aria-hidden="true"><path class="sh" d="${PIN}" transform="translate(1.4 2.2)"/><path d="${PIN}"/></svg><span class="glyph">${glyph(g)}</span>${extra}</span>`;
  const typePin = (type, extra) => { const t = TYPES[type] || TYPES.landmark; return pinHtml(t.color, t.glyph, extra); };
  const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  // Regions, rivers and lakes get no pin: the base map already names them (they stay searchable).
  const NAME_ONLY = new Set(['area', 'water']);
  const CAT_GROUPS = [
    ['Places', ['town', 'camp', 'landmark', 'hideout', 'shack', 'poi', 'shop']],
    ['People & jobs', ['stranger', 'special', 'bounty', 'request']],
    ['Hunting & gathering', ['legendary', 'legendary-fish', ':ranges', ':plants']],
    ['Collectibles', ['card', 'bone', 'carving', 'dreamcatcher', 'treasure', 'chest', 'tonic', 'unique', 'orchid', 'gator-egg']],
    ['On the map', [':grid']],
  ];
  const ICONS = {
    topic: '<svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5z"/><path d="M8 10h8M8 14h8M8 18h5"/></svg>',
    place: '<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',
    map: '<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    leaf: '<svg viewBox="0 0 24 24"><path d="M5 19.5C4.6 11 9.6 4.8 20 4c.4 10.2-5.6 15.6-15 15.5z"/><path d="M5 19.5l8.6-8.6"/></svg>',
    paw: '<svg viewBox="0 0 24 24"><path d="M12 13.5c-2.6 0-5 2.6-5 4.6 0 1.4 1.2 2.1 2.5 2.1 1 0 1.6-.5 2.5-.5s1.5.5 2.5.5c1.3 0 2.5-.7 2.5-2.1 0-2-2.4-4.6-5-4.6z"/><ellipse cx="5.5" cy="10.6" rx="1.7" ry="2.1"/><ellipse cx="9.3" cy="6.6" rx="1.7" ry="2.2"/><ellipse cx="14.7" cy="6.6" rx="1.7" ry="2.2"/><ellipse cx="18.5" cy="10.6" rx="1.7" ry="2.1"/></svg>',
  };

  const S = {
    data: null, fuse: null,
    topics: new Map(), places: new Map(), sectionOf: new Map(), catColor: new Map(),
    activeCats: new Set(),
    map: null, H: 0, W: 0, layerGroups: new Map(), markerOf: new Map(), selected: null,
    hitLayer: null, gridLayer: null, mapReady: false, view: 'map',
    results: [], activeResult: -1,
    ranges: null, range: null, rangeLayer: null, lastRange: { animal: 'all', plant: 'plants' }, panelKind: null,
    found: new Set(store.get('found', [])), hideFound: store.get('hideFound', false),
    done: new Set(store.get('done', [])), hundred: null,                 // 100% checklist ticks (task ids)
  };

  /* ---------- boot ---------- */
  if ('serviceWorker' in navigator && /^https:|^http:\/\/localhost/.test(location.href)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  fetch('data.json', { cache: 'no-cache' })            // revalidate, so content edits show up straight away
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(init)
    .catch((err) => {
      console.error(err);
      $('#sections').innerHTML = `<div class="empty glass">Couldn't load <span class="mono">data.json</span>. If you opened this file straight from disk, run a local server instead (see README) and open <span class="mono">http://localhost:8000</span>.</div>`;
    });

  function init(data) {
    S.data = data;
    for (const c of data.categories) S.catColor.set(c.id, c.color);
    for (const sec of data.sections) for (const t of sec.topics) { S.topics.set(t.id, t); S.sectionOf.set(t.id, sec); }
    for (const p of data.places) S.places.set(p.id, p);

    observeHeader();
    renderIntro();
    renderQuick();
    renderToc();
    renderCats();
    renderSections();
    buildSearch();
    bindSearch();
    bindViews();
    initMap();
    route();
    window.addEventListener('hashchange', route);
  }

  function observeHeader() {
    const bar = $('#topbar');
    const set = () => document.documentElement.style.setProperty('--header-h', bar.offsetHeight + 'px');
    set();
    if ('ResizeObserver' in window) new ResizeObserver(set).observe(bar);
  }

  /* ---------- intro, toc, categories ---------- */
  function renderIntro() {
    const d = S.data;
    const topicCount = d.sections.reduce((n, s) => n + s.topics.length, 0);
    const mapped = d.places.filter((p) => p.x != null).length;
    $('#stats').innerHTML = [
      ['Topics', topicCount], ['Places', d.places.length], ['On the map', mapped],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v.toLocaleString()}</dd></div>`).join('');
    $('#disclaimer').textContent = d.meta.disclaimer;
    $('#sourceLine').textContent = `Source: ${d.meta.source} · data v${d.meta.version}, updated ${d.meta.updated}`;
  }

  function renderQuick() {
    const box = $('#quick');
    box.innerHTML = S.data.quickSearch.map((q) => `<button class="chip" type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-q]'); if (!b) return;
      const input = $('#q'); input.value = b.dataset.q; input.focus(); runSearch();
    });
  }

  function renderToc() {
    $('#toc').innerHTML = S.data.sections.map((s) => `
      <li><button type="button" data-sec="${esc(s.id)}">
        <span class="t">${esc(s.title)}</span>
        <span class="m">pp. ${esc(s.pages.replace('-', '–'))} · ${s.topics.length} topics</span>
      </button></li>`).join('');
    $('#toc').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sec]'); if (!b) return;
      const sec = $(`#sec-${b.dataset.sec}`);
      sec.classList.add('instant');
      setSectionOpen(sec, true);
      void sec.offsetHeight;
      requestAnimationFrame(() => sec.classList.remove('instant'));
      scrollToEl(sec);
    });
  }

  function renderCats() {
    const counts = new Map();
    for (const t of S.topics.values()) counts.set(t.category, (counts.get(t.category) || 0) + 1);
    const chips = [`<button class="chip" type="button" data-cat="" aria-pressed="true">All <span class="n">${S.topics.size}</span></button>`]
      .concat(S.data.categories.filter((c) => counts.get(c.id)).map((c) =>
        `<button class="chip" type="button" data-cat="${esc(c.id)}" aria-pressed="false" style="--c:${c.color}"><span class="dot"></span>${esc(c.id)} <span class="n">${counts.get(c.id)}</span></button>`));
    $('#cats').innerHTML = chips.join('');
    $('#cats').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      const id = b.dataset.cat;
      if (!id) S.activeCats.clear();
      else if (S.activeCats.has(id)) S.activeCats.delete(id);
      else S.activeCats.add(id);
      applyFilter();
    });
  }

  function applyFilter() {
    const all = S.activeCats.size === 0;
    $$('#cats .chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat ? S.activeCats.has(c.dataset.cat) : all)));
    let shown = 0;
    for (const sec of $$('.sec')) {
      let n = 0;
      for (const el of $$('.topic', sec)) {
        const ok = all || S.activeCats.has(el.dataset.cat);
        el.hidden = !ok; if (ok) n++;
      }
      sec.hidden = n === 0;
      $('.sec-count', sec).textContent = n;
      if (!all && n) setSectionOpen(sec, true);
      shown += n;
    }
    $('#filterCount').textContent = all ? '' : `${shown} topics shown`;
  }

  /* ---------- sections & topics ---------- */
  function renderSections() {
    const html = S.data.sections.map((s, i) => `
      <section class="sec glass" id="sec-${esc(s.id)}" data-open="${i === 0}">
        <button class="sec-head" type="button" aria-expanded="${i === 0}" aria-controls="secb-${esc(s.id)}">
          <span class="sec-title">${esc(s.title)}</span>
          <span class="sec-meta">pp. ${esc(s.pages.replace('-', '–'))} · <span class="sec-count">${s.topics.length}</span> topics</span>
          <span class="sec-chev">${ICONS.chev}</span>
        </button>
        <div class="sec-body" id="secb-${esc(s.id)}"><div>
          <p class="sec-intro">${esc(s.intro || '')}</p>
          <div class="sec-tools"><button class="textbtn" type="button" data-expand>Expand all</button><button class="textbtn" type="button" data-collapse>Collapse all</button></div>
          <div class="topics">${s.topics.map(topicCard).join('')}</div>
        </div></div>
      </section>`).join('');
    const box = $('#sections');
    box.innerHTML = html;
    box.addEventListener('click', onSectionsClick);
  }

  function pageLabel(t) {
    return t.page_end && t.page_end !== t.page ? `pp. ${t.page}–${t.page_end}` : `p. ${t.page}`;
  }

  function topicCard(t) {
    const c = S.catColor.get(t.category) || '#e07a2e';
    return `<article class="topic" id="topic-${esc(t.id)}" data-id="${esc(t.id)}" data-cat="${esc(t.category)}" data-open="false">
      <button class="topic-head" type="button" aria-expanded="false">
        <span class="topic-title">${esc(t.title)}</span>
        <span class="page">${pageLabel(t)}</span>
        <span class="topic-tags"><span class="tag" style="--c:${c}"><span class="dot"></span>${esc(t.category)}</span></span>
      </button>
      <div class="topic-body"><div></div></div>
    </article>`;
  }

  function onSectionsClick(e) {
    const head = e.target.closest('.sec-head');
    if (head) { const sec = head.closest('.sec'); setSectionOpen(sec, sec.dataset.open !== 'true'); return; }
    const exp = e.target.closest('[data-expand],[data-collapse]');
    if (exp) {
      const open = exp.hasAttribute('data-expand');
      $$('.topic', exp.closest('.sec')).forEach((el) => { if (!el.hidden) setTopicOpen(el, open); });
      return;
    }
    const th = e.target.closest('.topic-head');
    if (th) { const el = th.closest('.topic'); setTopicOpen(el, el.dataset.open !== 'true'); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      const id = act.closest('.topic').dataset.id;
      if (act.dataset.act === 'map') { const loc = S.topics.get(id).location; showPlace(loc, true); }
      if (act.dataset.act === 'range') showRange(id, { fit: true });
      if (act.dataset.act === 'copy') copyLink('topic', id, act);
    }
  }

  function setSectionOpen(sec, open) {
    sec.dataset.open = String(open);
    $('.sec-head', sec).setAttribute('aria-expanded', String(open));
  }

  function setTopicOpen(el, open) {
    const body = $('.topic-body > div', el);
    if (open && !body.dataset.ready) { body.innerHTML = topicBody(S.topics.get(el.dataset.id)); body.dataset.ready = '1'; }
    el.dataset.open = String(open);
    $('.topic-head', el).setAttribute('aria-expanded', String(open));
  }

  function topicBody(t) {
    const place = t.location && S.places.get(t.location);
    const canMap = place && place.x != null;
    const pages = t.page_end && t.page_end !== t.page ? `pages <b>${t.page}–${t.page_end}</b>` : `page <b>${t.page}</b>`;
    return `<div class="prose">${formatText(t.text)}</div>
      <div class="topic-foot">
        <span class="src">Source: ${pages}</span>
        ${canMap ? `<button class="actbtn" type="button" data-act="map">${ICONS.map}Show on map</button>` : ''}
        ${S.ranges?.has(t.id) ? `<button class="actbtn" type="button" data-act="range">${ICONS.paw}Range on map</button>` : ''}
        <button class="actbtn" type="button" data-act="copy">${ICONS.link}Copy link</button>
      </div>`;
  }

  // Plain-text topic bodies → light HTML: "- " bullets, "1. " steps, short "Heading:" lines, "Tip:" callouts.
  function formatText(text) {
    const out = []; let list = null;
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const raw of String(text).split('\n')) {
      const line = raw.trim(); if (!line) { close(); continue; }
      let m;
      if ((m = line.match(/^- (.*)$/))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
      if ((m = line.match(/^\d{1,2}\. (.*)$/)) && list !== 'ul') { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
      close();
      if (/^Tip:/i.test(line)) out.push(`<p class="tip">${inline(line)}</p>`);
      else if (line.length <= 60 && /:$/.test(line)) out.push(`<p class="label">${esc(line.slice(0, -1))}</p>`);
      else out.push(`<p>${inline(line)}</p>`);
    }
    close();
    return out.join('');
  }
  const inline = (s) => esc(s).replace(/^(Tip:)/i, '<b>$1</b>');

  /* ---------- search ---------- */
  function buildSearch() {
    const docs = [];
    for (const [id, t] of S.topics) {
      docs.push({ kind: 't', id, title: t.title, keywords: (t.keywords || []).join(' · '), text: t.text, category: t.category, section: S.sectionOf.get(id).title });
    }
    for (const [id, p] of S.places) {
      const type = (TYPES[p.type] || {}).label || p.type;
      docs.push({ kind: 'p', id, title: p.name, keywords: [type, p.num ? 'no ' + p.num : '', p.cell || ''].join(' '), text: p.description || '', category: type, section: '' });
    }
    S.fuse = new Fuse(docs, {
      keys: [{ name: 'title', weight: 3 }, { name: 'keywords', weight: 1.6 }, { name: 'text', weight: 1 }, { name: 'category', weight: 0.4 }, { name: 'section', weight: 0.3 }],
      includeMatches: true, includeScore: true, ignoreLocation: true,
      threshold: 0.32, minMatchCharLength: 2, useExtendedSearch: true, fieldNormWeight: 0.5,
    });
  }

  let debounceT;
  function bindSearch() {
    const input = $('#q');
    input.addEventListener('input', () => { clearTimeout(debounceT); debounceT = setTimeout(runSearch, 110); $('#clear').hidden = !input.value; });
    input.addEventListener('focus', () => { if (input.value.trim().length >= 2) showResults(true); });
    input.addEventListener('keydown', onSearchKey);
    $('#clear').addEventListener('click', () => { input.value = ''; $('#clear').hidden = true; runSearch(); input.focus(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== input && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); input.select(); }
      if (e.key === 'Escape') { if (!$('#results').hidden) showResults(false); else if ($('#layout').classList.contains('drawer-open')) setDrawer(false); else closePlace(); }
    });
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#results') && !e.target.closest('.search')) showResults(false);
    });
    $('#results').addEventListener('click', (e) => {
      const fit = e.target.closest('[data-fit]'); if (fit) { showResults(false); fitHits(); return; }
      const r = e.target.closest('.result'); if (r) activateResult(r);
    });
  }

  function cleanQuery(q) {
    // Fuse extended search treats ' ! ^ = $ | as operators; keep the words, drop the operators.
    return q.replace(/[|!^=$"'`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 64);
  }

  function runSearch() {
    const raw = $('#q').value;
    const q = cleanQuery(raw);
    if (q.length < 2) { S.results = []; showResults(false); setHits([]); return; }
    const found = S.fuse.search(q, { limit: 160 });
    const topics = found.filter((r) => r.item.kind === 't');
    const places = found.filter((r) => r.item.kind === 'p');
    S.results = found;
    renderResults(q, topics, places);
    setHits(places.map((r) => S.places.get(r.item.id)).filter((p) => p.x != null).slice(0, 80));
    showResults(true);
  }

  function renderResults(q, topics, places) {
    const box = $('#results');
    const tokens = queryTokens();
    const plants = S.ranges && tokens.length ? S.data.ranges.species.filter((sp) => sp.kind === 'plant'
      && tokens.every((t) => wordRanges(sp.name, [t]).length)).slice(0, 3) : [];
    if (!topics.length && !places.length && !plants.length) {
      box.innerHTML = `<div class="results-empty">No matches for “${esc(q)}”. Try fewer words, or one of the quick searches.</div>`;
      return;
    }
    const tHtml = topics.slice(0, 10).map((r, i) => resultRow(r, i)).join('');
    const pHtml = places.slice(0, 8).map((r, i) => resultRow(r, i)).join('');
    const mapped = places.filter((r) => S.places.get(r.item.id).x != null).length;
    const tGroup = topics.length ? `<div class="results-group"><h3>Guide topics · ${topics.length}</h3></div>${tHtml}` : '';
    const pGroup = places.length ? `<div class="results-group"><h3>Places · ${places.length}</h3>${mapped ? `<button class="chip" type="button" data-fit>${ICONS.map.replace('<svg', '<svg width="14" height="14"')}Show ${Math.min(mapped, 80)} on map</button>` : ''}</div>${pHtml}` : '';
    // A place whose name is (nearly) what was typed beats topics that merely mention it.
    const ql = q.toLowerCase();
    const nameHit = places.slice(0, 8).some((r) => {
      const n = r.item.title.toLowerCase();
      return n.startsWith(ql) || lev(n, ql) <= Math.max(1, Math.floor(ql.length / 5));
    });
    const placesFirst = places.length && (!topics.length || nameHit || places[0].score < topics[0].score - 0.05);
    // A species named in the query gets its range map offered first.
    const species = S.ranges && tokens.length ? topics.slice(0, 8).filter((r) => S.ranges.has(r.item.id)
      && tokens.every((t) => wordRanges(r.item.title, [t]).length)).slice(0, 3) : [];
    const rGroup = (species.length ? `<div class="results-group"><h3>Animal ranges</h3></div>${species.map((r, i) => rangeRow(r.item.id, i)).join('')}` : '')
      + (plants.length ? `<div class="results-group"><h3>Where plants grow</h3></div>${plants.map((sp, i) => rangeRow(sp.topic, i)).join('')}` : '');
    box.innerHTML = rGroup + (placesFirst ? pGroup + tGroup : tGroup + pGroup);
    S.activeResult = -1;
  }

  /* Whole-word, typo-tolerant highlighting: a word is marked when it contains a query
     token or is within a small edit distance of it, so "legendery" marks "Legendary". */
  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  function wordRanges(str, tokens) {
    const out = [];
    if (!tokens.length) return out;
    const re = /[\p{L}\p{N}][\p{L}\p{N}'’]*/gu; let m;
    while ((m = re.exec(str))) {
      const w = m[0].toLowerCase();
      for (const t of tokens) {
        const tol = t.length <= 4 ? 0 : t.length <= 7 ? 1 : 2;
        const at = t.length >= 3 ? w.indexOf(t) : (w.startsWith(t) ? 0 : -1);
        if (at >= 0) { out.push([m.index + at, m.index + at + t.length - 1]); break; }
        if (tol && (lev(w, t) <= tol || (w.length > t.length && lev(w.slice(0, t.length), t) <= tol - (t.length <= 6 ? 0 : 1)))) {
          out.push([m.index, m.index + w.length - 1]); break;
        }
      }
    }
    return out;
  }
  const queryTokens = () => cleanQuery($('#q').value).toLowerCase().split(' ').filter((t) => t.length >= 2);

  function resultRow(r, i) {
    const it = r.item;
    const isTopic = it.kind === 't';
    const color = isTopic ? (S.catColor.get(it.category) || '#e07a2e') : (TYPES[S.places.get(it.id).type] || {}).color;
    const tokens = queryTokens();
    const title = highlight(it.title, wordRanges(it.title, tokens));
    const snip = snippet(it, r.matches, tokens);
    let meta;
    if (isTopic) meta = pageLabel(S.topics.get(it.id));
    else { const p = S.places.get(it.id); meta = p.atlasPage ? `atlas p. ${p.atlasPage}` : (TYPES[p.type] || {}).label; }
    const found = !isTopic && S.found.has(it.id);
    if (found) meta = `✓ found · ${meta}`;
    return `<button class="result${found ? ' is-found' : ''}" type="button" role="option" data-kind="${it.kind}" data-id="${esc(it.id)}" style="--c:${color};animation-delay:${Math.min(i, 8) * 18}ms">
      <span class="result-ico">${isTopic ? ICONS.topic : glyph((TYPES[S.places.get(it.id).type] || TYPES.landmark).glyph)}</span>
      <span><span class="result-title">${title}</span><span class="result-snip">${snip}</span></span>
      <span class="result-meta">${esc(meta)}</span>
    </button>`;
  }

  function rangeRow(id, i) {
    const sp = S.ranges.get(id);
    if (sp.kind === 'plant') {
      return `<button class="result" type="button" role="option" data-kind="r" data-id="${esc(id)}" style="--c:#3f8a3a;animation-delay:${i * 18}ms">
      <span class="result-ico">${ICONS.leaf}</span>
      <span><span class="result-title">${highlight(sp.name, wordRanges(sp.name, queryTokens()))}: where it grows</span><span class="result-snip">${esc(sp.where)}</span></span>
      <span class="result-meta">p. ${sp.page}</span>
    </button>`;
    }
    const t = S.topics.get(id);
    const snip = sp.cells ? `Red dots where the guide marks it on its habitat map${sp.guarma ? ' (also on Guarma)' : ''}` : "Only found on Guarma, which isn't on this map";
    return `<button class="result" type="button" role="option" data-kind="r" data-id="${esc(id)}" style="--c:#b5332a;animation-delay:${i * 18}ms">
      <span class="result-ico">${ICONS.paw}</span>
      <span><span class="result-title">${highlight(t.title, wordRanges(t.title, queryTokens()))} range</span><span class="result-snip">${esc(snip)}</span></span>
      <span class="result-meta">p. ${sp.page}</span>
    </button>`;
  }

  function snippet(it, matches, tokens) {
    // "\n- " and "\n" both flatten to separators of equal length, so offsets line up.
    const text = it.text.replace(/\n- /g, ' · ').replace(/\n/g, ' ');
    const hits = wordRanges(text, tokens);
    if (!hits.length) {
      const kwHits = wordRanges(it.keywords, tokens);
      if (kwHits.length) return `${esc(it.category)} · ${highlight(it.keywords, kwHits)}`;
      return esc(text.slice(0, 150)) + (text.length > 150 ? '…' : '');
    }
    // Centre the window on the densest early cluster of hits.
    const a0 = hits[0][0];
    let start = Math.max(0, a0 - 55);
    if (start) { const sp = text.lastIndexOf(' ', start); start = sp > 0 ? sp + 1 : start; }
    const end = Math.min(text.length, start + 175);
    const inWin = hits.filter(([a, b]) => a >= start && b < end).map(([a, b]) => [a - start, b - start]);
    return (start ? '…' : '') + highlight(text.slice(start, end), inWin) + (end < text.length ? '…' : '');
  }

  function highlight(str, indices) {
    if (!indices || !indices.length) return esc(str);
    const ranges = indices.filter(([a, b]) => b - a >= 1).map(([a, b]) => [a, b]).sort((x, y) => x[0] - y[0]);
    const merged = [];
    for (const r of ranges) { const last = merged[merged.length - 1]; if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]); else merged.push(r); }
    let out = ''; let pos = 0;
    for (const [a, b] of merged) { if (a < pos) continue; out += esc(str.slice(pos, a)) + '<mark>' + esc(str.slice(a, b + 1)) + '</mark>'; pos = b + 1; }
    return out + esc(str.slice(pos));
  }

  function showResults(on) {
    const box = $('#results');
    box.hidden = !on || !box.innerHTML;
    $('#q').setAttribute('aria-expanded', String(!box.hidden));
  }

  function onSearchKey(e) {
    const items = $$('#results .result');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      S.activeResult = (S.activeResult + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((el, i) => el.classList.toggle('is-active', i === S.activeResult));
      items[S.activeResult].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      const pick = items[S.activeResult] || items[0];
      if (pick) { e.preventDefault(); activateResult(pick); }
    }
  }

  function activateResult(el) {
    showResults(false);
    $('#q').blur();
    if (el.dataset.kind === 't') openTopic(el.dataset.id, true);
    else if (el.dataset.kind === 'r') { setHits([]); showRange(el.dataset.id, { fit: true }); }   // the range dots, not search rings
    else showPlace(el.dataset.id, true);
  }

  /* ---------- views (phones switch, desktop shows both) ---------- */
  function bindViews() {
    $$('.viewtabs [data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $$('.sb-tabs [data-panel]').forEach((b) => b.addEventListener('click', () => setPanel(b.dataset.panel)));
    $('#layersBtn').addEventListener('click', () => setDrawer(true));
    $('#drawerClose').addEventListener('click', () => setDrawer(false));
    $('#scrim').addEventListener('click', () => setDrawer(false));
    $('#panelToggle').addEventListener('click', () => setPanelOpen($('#layout').classList.contains('panel-collapsed'), true));
    if (store.get('panel', 'open') === 'collapsed') setPanelOpen(false, false);
    desktop.addEventListener?.('change', () => { setDrawer(false); S.map && setTimeout(() => S.map.invalidateSize(), 50); });
    S.mapShown = true;
  }

  // Phones show one view at a time: the map (categories in a drawer) or the guide.
  function setView(v) {
    S.view = v;
    $('#layout').dataset.view = v;
    $$('.viewtabs [data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    setDrawer(false);
    setPanel(v === 'map' ? 'map' : v);
    if (v !== 'map') window.scrollTo(0, 0);
    if (v === 'map' && S.map) requestAnimationFrame(() => {
      if (!S.mapShown) { S.mapShown = true; if (!S.selected) { homeView(); return; } }
      ensureView();
    });
  }

  // The sidebar shows the map categories or the guide (tabs on wide screens).
  function setPanel(panel) {
    $('#sidebar').dataset.panel = panel;
    $$('.sb-tabs [data-panel]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.panel === panel)));
    if (panel === 'hundred') loadHundred();
  }

  // Wide screens: fold the side panel away for a full-screen map (remembered per browser).
  function setPanelOpen(open, save) {
    const app = $('#layout'), btn = $('#panelToggle');
    if (open === !app.classList.contains('panel-collapsed')) return;
    app.classList.toggle('panel-collapsed', !open);
    const label = open ? 'Hide the side panel' : 'Show the side panel';
    btn.setAttribute('aria-expanded', String(open)); btn.setAttribute('aria-label', label); btn.title = label;
    if (save) store.set('panel', open ? 'open' : 'collapsed');
    // Keep the map centred while the panel slides (about 0.3 s).
    if (!S.map) return;
    const until = performance.now() + 340;
    const step = () => { S.map.invalidateSize(); if (performance.now() < until) requestAnimationFrame(step); };
    requestAnimationFrame(step);
    setTimeout(() => S.map.invalidateSize(), 360);
  }

  function setDrawer(open) {
    const app = $('#layout');
    if (open) setPanel('map');
    app.classList.toggle('drawer-open', open && !desktop.matches);
    $('#scrim').hidden = !(open && !desktop.matches);
    $('#layersBtn').setAttribute('aria-expanded', String(open));
  }

  /* ---------- map ---------- */
  function initMap() {
    const m = S.data.map; S.H = m.height; S.W = m.width;
    const bounds = [[-S.H, 0], [0, S.W]];
    const map = L.map('map', {
      crs: L.CRS.Simple, minZoom: -3, maxZoom: m.maxZoom ?? 3, zoomSnap: 0.25, zoomDelta: 0.5,
      wheelPxPerZoomLevel: 80, wheelDebounceTime: 20,
      attributionControl: false, zoomControl: false, preferCanvas: true, renderer: L.canvas({ tolerance: 9 }),
      tapHold: touch,                                  // press and hold a pin = right-click (iPad Safari included)
      maxBounds: L.latLngBounds(bounds), maxBoundsViscosity: 1,     // panning stops at the map's edges
    });
    S.map = map;
    map.createPane('base').style.zIndex = 250;      // base map < animal ranges (350) < pins
    const ver = (url, v) => (v ? `${url}${url.includes('?') ? '&' : '?'}v=${v}` : url);
    if (m.tiles) {
      // A small picture of the whole map sits under the tiles, so moving and zooming never
      // show blank paper while sharper tiles arrive.
      if (m.backdrop) L.imageOverlay(ver(m.backdrop, m.v), bounds, { pane: 'base', className: 'base-backdrop', zIndex: 0 }).addTo(map);
      S.tileUrl = ver(m.tiles, m.v);
      S.tiles = L.tileLayer(S.tileUrl, {
        pane: 'base', className: 'base-map', tileSize: 256, noWrap: true, bounds: L.latLngBounds(bounds), zIndex: 1,
        minZoom: -3, maxZoom: m.maxZoom ?? 3, minNativeZoom: m.minNativeZoom ?? -2, maxNativeZoom: m.maxNativeZoom ?? 2,
        keepBuffer: 6,                 // keep a wide ring of tiles around the view for quick panning
        updateWhenIdle: false,         // load tiles while dragging, not only after
        updateWhenZooming: false,      // skip in-between levels during a zoom animation
      }).addTo(map);
      map.on('moveend', prefetchTiles);
    } else {
      L.imageOverlay(m.image, bounds, { className: 'base-map', pane: 'base' }).addTo(map);
    }
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    if (m.credit) L.control.attribution({ position: 'topright', prefix: false }).addAttribution(esc(m.credit)).addTo(map);
    S.homeBounds = bounds;
    homeView();
    // The container may get its final size after fonts/header settle; refit once it has.
    requestAnimationFrame(() => { map.invalidateSize(); homeView(); });
    map.on('zoomend', zoomClass); zoomClass();
    map.on('resize', fitMinZoom);
    map.on('click', () => closePlace());

    const visible = new Set(store.get('layers', null) || S.data.layers.filter((l) => l.default).map((l) => l.id));
    for (const l of S.data.layers) S.layerGroups.set(l.id, L.layerGroup());
    for (const p of S.data.places) {
      if (p.x == null || NAME_ONLY.has(p.type)) continue;
      const mk = makeMarker(p);
      S.markerOf.set(p.id, mk);
      if (!(S.hideFound && S.found.has(p.id))) groupOf(p).addLayer(mk);
    }
    for (const [id, g] of S.layerGroups) if (visible.has(id)) g.addTo(map);
    S.hitLayer = L.layerGroup().addTo(map);
    S.gridLayer = buildGrid();
    renderCategories(visible);
    initRanges();
    S.mapReady = true;
  }

  const ll = (p) => [-p.y, p.x];

  // After the map settles, quietly fetch the tiles for the next zoom level in (and the one out)
  // over the current view, so the next zoom shows sharp tiles straight away. Skipped when the
  // browser asks to save data.
  let prefetchT;
  function prefetchTiles() {
    clearTimeout(prefetchT);
    prefetchT = setTimeout(() => {
      const c = navigator.connection;
      if (!S.tiles || (c && (c.saveData || /2g/.test(c.effectiveType || '')))) return;
      const m = S.data.map, z = Math.round(S.map.getZoom()), seen = S.prefetched || (S.prefetched = new Set());
      const b = S.map.getBounds();
      for (const zz of [z + 1, z - 1]) {
        if (zz < (m.minNativeZoom ?? -2) || zz > (m.maxNativeZoom ?? 3)) continue;
        const nw = S.map.project(b.getNorthWest(), zz), se = S.map.project(b.getSouthEast(), zz);
        const s2 = 2 ** zz, maxX = Math.ceil(S.W * s2 / 256) - 1, maxY = Math.ceil(S.H * s2 / 256) - 1;
        const x0 = Math.max(0, Math.floor(nw.x / 256)), x1 = Math.min(maxX, Math.floor(se.x / 256));
        const y0 = Math.max(0, Math.floor(nw.y / 256)), y1 = Math.min(maxY, Math.floor(se.y / 256));
        if ((x1 - x0 + 1) * (y1 - y0 + 1) > 80) continue;
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
          const url = L.Util.template(S.tileUrl, { z: zz, x, y });
          if (seen.has(url)) continue;
          seen.add(url); const img = new Image(); img.decoding = 'async'; img.src = url;
        }
      }
    }, 350);
  }

  // Make sure the map has a view and an up-to-date size before moving it.
  function ensureView() {
    try { S.map.getCenter(); S.map.invalidateSize(); } catch { homeView(); }
  }

  // Zooming out stops where the map fills the whole map area (no shrunken map with empty
  // margins). Re-worked out whenever the map area changes size, e.g. turning a phone.
  function fitMinZoom() {
    const size = S.map.getSize();
    if (!size.x || !size.y) return;
    S.map.options.minZoom = -6;                                // let the measurement go below the old limit
    S.map.setMinZoom(S.map.getBoundsZoom(S.homeBounds, true));  // true = the map covers the view
  }

  // Wide screens open on the whole map, filling the screen; narrow/portrait screens start on
  // the main landmass (the Heartlands and Lemoyne), big enough to tap, with New Austin a swipe away.
  function homeView() {
    const el = S.map.getContainer();
    if (!el.clientWidth || !el.clientHeight) return;          // still hidden (phone, guide tab)
    // A map created while hidden has no view and a cached 0×0 size: give it one, then re-measure.
    try { S.map.getCenter(); } catch { S.map.setView([-S.H / 2, S.W / 2], -2, { animate: false }); }
    S.map.invalidateSize({ pan: false });
    fitMinZoom();
    const size = S.map.getSize(), min = S.map.getMinZoom();
    if (size.x >= 700) { S.map.setView([-S.H / 2, S.W / 2], min, { animate: false }); return; }
    const z = Math.max(min, Math.min(0, Math.log2(Math.min(size.x / 1150, size.y / 900))));
    S.map.setView([-720, 1420], Math.ceil(z * 4) / 4, { animate: false });
  }

  // Every place is a teardrop pin with its type's picture; the tip marks the spot.
  // Found places get a faded pin with a green tick. Leaflet rebuilds the icon element whenever a
  // marker is re-added, so "found" lives in the icon itself (one shared icon per type and state).
  const icons = new Map();
  function pinIcon(type, found) {
    const key = type + (found ? ':f' : '');
    if (!icons.has(key)) icons.set(key, L.divIcon({
      className: `mk mk-${type}${found ? ' is-found' : ''}`, iconSize: [28, 36], iconAnchor: [14, 35],
      html: typePin(type, found ? `<span class="tick">${TICK}</span>` : ''),
    }));
    return icons.get(key);
  }
  const groupOf = (p) => S.layerGroups.get(p.type) || S.layerGroups.get('landmark');

  function makeMarker(p) {
    const t = TYPES[p.type] || TYPES.landmark;
    const mk = L.marker(ll(p), { icon: pinIcon(p.type, S.found.has(p.id)), title: p.name, keyboard: !!t.named, riseOnHover: true });
    mk.on('click', (e) => { L.DomEvent.stop(e); onMarker(p); });
    // Right-click (or press and hold on a phone) ticks a place off without opening its card.
    mk.on('contextmenu', (e) => { L.DomEvent.stop(e); e.originalEvent?.preventDefault(); toggleFound(p.id); });
    return mk;
  }

  // Tapping a marker opens its card; pan only if the card would cover it.
  function onMarker(p) {
    openPlace(p.id);
    const card = $('#placeCard');
    const pt = S.map.latLngToContainerPoint(ll(p));
    const size = S.map.getSize();
    const covered = desktop.matches ? pt.x > size.x - card.offsetWidth - 30 : pt.y > size.y - card.offsetHeight - 30;
    if (covered) centerBesideCard(p, S.map.getZoom(), true);
  }

  // far / mid / near / close: pins shrink as you zoom out.
  function zoomClass() {
    const z = S.map.getZoom();
    const el = S.map.getContainer();
    const band = z < -1.6 ? 'far' : z < -0.25 ? 'mid' : z < 0.75 ? 'near' : 'close';
    if (el.dataset.z !== band) el.dataset.z = band;
  }

  function renderCategories(visible) {
    const counts = new Map();
    for (const p of S.data.places) if (p.x != null) counts.set(p.type, (counts.get(p.type) || 0) + 1);
    const names = new Map(S.data.layers.map((l) => [l.id, l.label]));
    const row = (attrs, pin, name, n, on) => `<button class="cat" type="button" ${attrs} aria-pressed="${on}">
        <span class="cat-ico">${pin}</span><span class="cat-name">${esc(name)}</span>${n != null ? `<span class="n">${n}</span>` : ''}</button>`;
    const html = CAT_GROUPS.map(([title, ids]) => {
      const rows = ids.map((id) => {
        if (id === ':ranges') return S.data.ranges ? row('data-ranges', pinHtml('#b5332a', 'paw'), 'Animal ranges', S.data.ranges.species.filter((sp) => sp.cells && sp.kind !== 'plant').length, false) : '';
        if (id === ':plants') return S.data.ranges?.species.some((sp) => sp.kind === 'plant') ? row('data-plants', pinHtml('#3f8a3a', 'leaf'), 'Plants & herbs', S.data.ranges.species.filter((sp) => sp.kind === 'plant').length, false) : '';
        if (id === ':grid') return row('data-grid', pinHtml('#8b7760', 'grid'), 'Atlas grid', null, false);
        if (!counts.get(id)) return '';
        return row(`data-layer="${id}"`, typePin(id), names.get(id) || TYPES[id].label, counts.get(id), visible.has(id));
      }).join('');
      return rows ? `<div class="cat-group"><h3>${esc(title)}</h3><div class="cat-grid">${rows}</div></div>` : '';
    }).join('');
    const list = $('#catList');
    list.innerHTML = html;
    const save = () => store.set('layers', $$('#catList [data-layer][aria-pressed="true"]').map((x) => x.dataset.layer));
    const setLayer = (b, on) => {
      b.setAttribute('aria-pressed', String(on));
      const grp = S.layerGroups.get(b.dataset.layer);
      on ? grp.addTo(S.map) : grp.remove();
    };
    list.addEventListener('click', (e) => {
      const hr = e.target.closest('[data-ranges]');
      const hp = e.target.closest('[data-plants]');
      if (hr || hp) {
        const kind = hp ? 'plant' : 'animal';
        S.range && kindOf(S.range) === kind ? hideRange() : showRange(S.lastRange[kind]);
        setDrawer(false); return;
      }
      const g = e.target.closest('[data-grid]');
      if (g) { const on = g.getAttribute('aria-pressed') !== 'true'; g.setAttribute('aria-pressed', String(on)); on ? S.gridLayer.addTo(S.map) : S.gridLayer.remove(); return; }
      const b = e.target.closest('[data-layer]'); if (!b) return;
      setLayer(b, b.getAttribute('aria-pressed') !== 'true'); save();
    });
    $('#showAll').addEventListener('click', () => { $$('#catList [data-layer]').forEach((b) => setLayer(b, true)); save(); });
    $('#hideAll').addEventListener('click', () => { $$('#catList [data-layer]').forEach((b) => setLayer(b, false)); save(); });
    initProgress();
  }

  /* ---------- progress: places ticked off as found (kept in this browser) ---------- */
  const trackable = (p) => p && p.x != null && !NAME_ONLY.has(p.type);

  function saveFound() { store.set('found', [...S.found]); keepStorage(); }

  // Ask the browser to keep Campfire's saved progress rather than clearing it to free space.
  function keepStorage() {
    if (S.askedPersist) return;
    S.askedPersist = true;
    navigator.storage?.persist?.().catch(() => {});
  }

  function toggleFound(id, on = !S.found.has(id)) {
    const p = S.places.get(id); if (!trackable(p)) return;
    on ? S.found.add(id) : S.found.delete(id);
    saveFound();
    refreshMarker(p);
    renderProgress();
    syncHundred();
    if (S.selected === id && !$('#placeCard').hidden) renderFoundBtn(p);
  }

  // Swap the pin's icon for the found / not-found one, and hide it when "Hide found" is on.
  function refreshMarker(p) {
    const mk = S.markerOf.get(p.id); if (!mk) return;
    const found = S.found.has(p.id), grp = groupOf(p);
    mk.setIcon(pinIcon(p.type, found));
    if (S.hideFound && found && S.selected !== p.id) grp.removeLayer(mk);
    else if (!grp.hasLayer(mk)) grp.addLayer(mk);
    if (S.selected === p.id && mk._icon) mk._icon.classList.add('is-sel');
  }

  function renderProgress() {
    const tot = new Map(), got = new Map();
    let all = 0, done = 0;
    for (const p of S.data.places) {
      if (!trackable(p)) continue;
      const f = S.found.has(p.id) ? 1 : 0;
      tot.set(p.type, (tot.get(p.type) || 0) + 1); got.set(p.type, (got.get(p.type) || 0) + f);
      all++; done += f;
    }
    const pct = all ? (done / all) * 100 : 0;
    $('#pgNum').textContent = `${done} / ${all}`;
    $('#pgPct').textContent = `${pct < 1 && done ? pct.toFixed(1) : Math.floor(pct)}%`;
    $('#pgBar').style.width = `${pct}%`;
    for (const b of $$('#catList [data-layer]')) {
      const t = b.dataset.layer, n = tot.get(t) || 0, g = got.get(t) || 0;
      const el = $('.n', b); if (!el) continue;
      el.textContent = g ? `${g}/${n}` : String(n);
      b.classList.toggle('is-done', !!n && g === n);
      b.style.setProperty('--pct', `${n ? (g / n) * 100 : 0}%`);
    }
    $('#pgReset').disabled = !done;
  }

  function initProgress() {
    const hide = $('#hideFound');
    hide.checked = S.hideFound;
    hide.addEventListener('change', () => {
      S.hideFound = hide.checked; store.set('hideFound', S.hideFound);
      for (const id of S.found) { const p = S.places.get(id); if (trackable(p)) refreshMarker(p); }
    });
    $('#pgExport').addEventListener('click', async () => {
      const json = JSON.stringify({ app: 'campfire', saved: new Date().toISOString(), found: [...S.found], done: [...S.done] }, null, 1);
      const name = 'campfire-progress.json';
      // On iPad/iPhone (and in the home-screen app) the share sheet is the reliable way to save a file.
      if (touch && navigator.canShare) {
        const f = new File([json], name, { type: 'application/json' });
        if (navigator.canShare({ files: [f] })) {
          try { await navigator.share({ files: [f], title: 'Campfire progress' }); return; } catch (e) { if (e.name === 'AbortError') return; }
        }
      }
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    const file = $('#pgFile');
    $('#pgImport').addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files[0]; file.value = ''; if (!f) return;
      let ids, done = [];
      try { const j = JSON.parse(await f.text()); ids = Array.isArray(j) ? j : j.found; done = Array.isArray(j.done) ? j.done : []; } catch { ids = null; }
      if (!Array.isArray(ids)) { alert("That file doesn't look like a Campfire progress file."); return; }
      const fresh = ids.filter((id) => trackable(S.places.get(id)) && !S.found.has(id));
      for (const id of fresh) S.found.add(id);
      const ticks = done.filter((id) => typeof id === 'string' && !S.done.has(id));
      for (const id of ticks) S.done.add(id);
      saveFound(); store.set('done', [...S.done]);
      fresh.forEach((id) => refreshMarker(S.places.get(id))); renderProgress(); syncHundred();
      const parts = [fresh.length && `${fresh.length} found place${fresh.length === 1 ? '' : 's'}`, ticks.length && `${ticks.length} checklist tick${ticks.length === 1 ? '' : 's'}`].filter(Boolean);
      alert(parts.length ? `Added ${parts.join(' and ')}.` : 'Nothing new: all of that was already marked.');
    });
    $('#pgReset').addEventListener('click', () => {
      if (!S.found.size || !confirm(`Clear all ${S.found.size} found places? (Export first if you want a copy.)`)) return;
      const was = [...S.found]; S.found.clear(); saveFound();
      was.forEach((id) => { const p = S.places.get(id); if (trackable(p)) refreshMarker(p); });
      renderProgress(); syncHundred();
      if (S.selected && !$('#placeCard').hidden) renderFoundBtn(S.places.get(S.selected));
    });
    // Another tab marked something: pick it up.
    window.addEventListener('storage', (e) => {
      if (e.key === 'campfire:done') { S.done = new Set(store.get('done', [])); syncHundred(); return; }
      if (e.key !== 'campfire:found') return;
      const next = new Set(store.get('found', []));
      const changed = [...new Set([...S.found, ...next])].filter((id) => S.found.has(id) !== next.has(id));
      S.found = next;
      changed.forEach((id) => { const p = S.places.get(id); if (trackable(p)) refreshMarker(p); });
      renderProgress(); syncHundred();
    });
    renderProgress();
  }

  /* ---------- 100% checklist ----------
     Tasks in route order from Jimbatron's "RDR2 100% Completion Strategy Guide" (GTAForums), loaded
     from hundred.json the first time the tab opens. A task tied to a map pin (a legendary animal or
     fish, a bounty, a hideout) is done exactly when that pin is marked found, so the two stay in step. */
  const KIND_LABEL = { story: 'Story', side: 'Side quests', challenge: 'Challenges', collect: 'Collectibles', prep: 'Prep & optional' };
  const isDone = (t) => (t.p ? S.found.has(t.p) : S.done.has(t.id));

  function loadHundred() {
    if (!S.hundredLoad) {
      S.hundredLoad = fetch('hundred.json', { cache: 'no-cache' })
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then((h) => {
          S.hundred = h; S.hTasks = new Map();
          for (const c of h.chapters) for (const part of c.parts) for (const t of part.tasks) { t.ch = c.id; S.hTasks.set(t.id, t); }
          renderHundred();
        })
        .catch(() => { $('#hd').innerHTML = '<p class="hd-loading">Couldn\'t load the checklist. Check your connection and try again.</p>'; S.hundredLoad = null; });
    }
    return S.hundredLoad;
  }

  function openHundred(taskId) {
    if (desktop.matches) { setPanelOpen(true, false); setPanel('hundred'); } else setView('hundred');
    loadHundred().then(() => { if (taskId && S.hTasks?.has(taskId)) jumpToTask(taskId); });
  }

  function renderHundred() {
    const h = S.hundred, src = h.source;
    const filter = store.get('hundredFilter', 'all'), hide = store.get('hundredHideDone', false);
    const box = $('#hd');
    box.dataset.filter = filter;
    box.classList.toggle('hide-done', hide);
    const li = (a) => a.map((x) => `<li>${esc(x)}</li>`).join('');
    box.innerHTML = `
      <header class="hd-head">
        <h2>100% checklist</h2>
        <p class="hd-src">Every task for 100% completion, in an order that saves backtracking. The route and its video guides are by
          <a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.author)} on ${esc(src.site)}</a>; the summaries and tips are written for Campfire.
          Ticks are saved on this device, and the progress Export on the map tab includes them.</p>
        <div class="hd-prog">
          <div class="pg-head"><span class="pg-title">Completion</span><span class="pg-num"><span id="hdNum"></span> · <b id="hdPct"></b></span></div>
          <div class="pg-bar" aria-hidden="true"><span id="hdBar"></span></div>
          <p class="hd-next" id="hdNext"></p>
        </div>
        <div class="hd-tools" role="group" aria-label="Show tasks">
          ${[['all', 'All'], ...Object.entries(KIND_LABEL)].map(([k, l]) => `<button type="button" class="chip" data-filter="${k}" aria-pressed="${k === filter}">${l}</button>`).join('')}
          <label class="pg-hide"><input type="checkbox" id="hdHide" ${hide ? 'checked' : ''}> Hide done</label>
        </div>
      </header>
      <details class="hd-info"><summary>What 100% needs</summary><div class="hd-info-body">
        <div class="hd-req">${h.requirements.map((g) => `<div><h4>${esc(g.group)}</h4><ul>${li(g.items)}</ul></div>`).join('')}</div>
        <h4>Ticked off by other tasks</h4><ul>${h.covered.map((c) => `<li>${esc(c.item)}: by ${esc(c.by)}</li>`).join('')}</ul>
        <h4>Happen anyway as you play</h4><ul>${li(h.natural)}</ul>
        <h4>Worth knowing before you start</h4><ul>${li(h.tips)}</ul>
      </div></details>
      ${h.chapters.map((c) => `<details class="hd-ch" data-ch="${esc(c.id)}"><summary><span class="hd-ch-title">${esc(c.title)}</span><span class="hd-ch-n"></span><span class="hd-ch-bar"><span></span></span></summary><div class="hd-ch-body"></div></details>`).join('')}
      <p class="hd-src" style="margin-top:18px"><button type="button" class="textbtn" id="hdReset">Clear checklist ticks</button></p>`;
    $$('.hd-ch', box).forEach((d) => d.addEventListener('toggle', () => { if (d.open) renderChapter(d); }));
    box.onclick = (e) => {
      const chk = e.target.closest('.hd-check'); if (chk) { toggleTask(chk.closest('.hd-task').dataset.id); return; }
      const f = e.target.closest('[data-filter]');
      if (f) {
        box.dataset.filter = f.dataset.filter; store.set('hundredFilter', f.dataset.filter);
        $$('.hd-tools [data-filter]', box).forEach((b) => b.setAttribute('aria-pressed', String(b === f))); return;
      }
      const j = e.target.closest('[data-jump]'); if (j) { jumpToTask(j.dataset.jump); return; }
      const tp = e.target.closest('[data-topic]'); if (tp) { openTopic(tp.dataset.topic, true); return; }
      const pl = e.target.closest('[data-place]'); if (pl) { showPlace(pl.dataset.place, true); return; }
      if (e.target.closest('#hdReset')) {
        if (!S.done.size || !confirm(`Clear all ${S.done.size} checklist ticks? Places marked found on the map stay as they are.`)) return;
        S.done.clear(); store.set('done', []); syncHundred();
      }
    };
    $('#hdHide', box).addEventListener('change', (e) => { box.classList.toggle('hide-done', e.target.checked); store.set('hundredHideDone', e.target.checked); });
    // open the chapter you're in
    const next = nextTask();
    const open = $(`.hd-ch[data-ch="${next ? next.ch : h.chapters[0].id}"]`, box);
    if (open) open.open = true;
    syncHundred();
  }

  function renderChapter(d) {
    if (d.dataset.ready) return;
    d.dataset.ready = '1';
    const c = S.hundred.chapters.find((x) => x.id === d.dataset.ch);
    $('.hd-ch-body', d).innerHTML = c.parts.map((part) => `<section class="hd-part">
      ${part.title ? `<h3>${esc(part.title)}</h3>` : ''}<p class="hd-sum">${esc(part.summary)}</p>
      <ol class="hd-tasks">${part.tasks.map(taskHtml).join('')}</ol></section>`).join('');
    syncHundred();
  }

  function taskHtml(t) {
    const links = (t.v || []).map((v, i, all) => `<a href="${esc(v)}" target="_blank" rel="noopener">${all.length > 1 ? `Video ${i + 1}` : 'Video'}</a>`);
    if (t.tp && S.topics.has(t.tp)) links.push(`<button type="button" data-topic="${esc(t.tp)}">In the guide</button>`);
    if (t.p && S.places.get(t.p)?.x != null) links.push(`<button type="button" data-place="${esc(t.p)}">On the map</button>`);
    return `<li class="hd-task k-${t.k}" data-id="${esc(t.id)}">
      <button type="button" class="hd-check" aria-pressed="false" aria-label="Done: ${esc(t.n)}">${TICK}</button>
      <div><div class="hd-line"><span class="hd-type">${esc(t.t)}</span><span class="hd-name">${esc(t.n)}</span>${t.c ? `<span class="hd-count" data-count="${esc(t.c)}"></span>` : ''}${t.w ? `<span class="hd-where">${esc(t.w)}</span>` : ''}</div>
      ${t.tip ? `<p class="hd-tip">${esc(t.tip)}</p>` : ''}${links.length ? `<div class="hd-links">${links.join('')}</div>` : ''}</div></li>`;
  }

  function toggleTask(id) {
    const t = S.hTasks.get(id); if (!t) return;
    if (t.p) { toggleFound(t.p); return; }                     // also updates the map and calls syncHundred
    S.done.has(id) ? S.done.delete(id) : S.done.add(id);
    store.set('done', [...S.done]); keepStorage();
    syncHundred();
  }

  const nextTask = () => { for (const t of S.hTasks.values()) if (t.k !== 'optional' && !isDone(t)) return t; return null; };

  function jumpToTask(id) {
    const t = S.hTasks.get(id); if (!t) return;
    const box = $('#hd');
    if (box.dataset.filter !== 'all' && !box.classList.contains('hide-done')) { /* keep the filter */ }
    const d = $(`.hd-ch[data-ch="${t.ch}"]`, box); d.open = true; renderChapter(d);
    const el = $(`.hd-task[data-id="${CSS.escape(id)}"]`, box); if (!el) return;
    scrollToEl(el);
    el.classList.remove('is-flash'); void el.offsetWidth; el.classList.add('is-flash');
  }

  // Bring every rendered tick, count and progress figure in line with S.done / S.found.
  function syncHundred() {
    if (!S.hundred) return;
    const box = $('#hd');
    for (const el of $$('.hd-task', box)) {
      const done = isDone(S.hTasks.get(el.dataset.id));
      el.classList.toggle('is-done', done);
      $('.hd-check', el).setAttribute('aria-pressed', String(done));
    }
    const found = new Map(), total = new Map();
    for (const p of S.data.places) {
      if (!trackable(p)) continue;
      total.set(p.type, (total.get(p.type) || 0) + 1);
      if (S.found.has(p.id)) found.set(p.type, (found.get(p.type) || 0) + 1);
    }
    for (const el of $$('[data-count]', box)) el.textContent = `map: ${found.get(el.dataset.count) || 0}/${total.get(el.dataset.count) || 0} found`;
    let all = 0, done = 0;
    for (const c of S.hundred.chapters) {
      let ca = 0, cd = 0;
      for (const part of c.parts) for (const t of part.tasks) if (t.k !== 'optional') { ca++; if (isDone(t)) cd++; }
      all += ca; done += cd;
      const d = $(`.hd-ch[data-ch="${c.id}"]`, box);
      if (!d) continue;
      const n = $('.hd-ch-n', d); n.textContent = `${cd}/${ca}`; n.classList.toggle('is-done', cd === ca);
      $('.hd-ch-bar span', d).style.width = `${ca ? (cd / ca) * 100 : 0}%`;
    }
    const pct = all ? (done / all) * 100 : 0;
    $('#hdNum').textContent = `${done} / ${all} tasks`;
    $('#hdPct').textContent = `${pct < 1 && done ? pct.toFixed(1) : Math.floor(pct)}%`;
    $('#hdBar').style.width = `${pct}%`;
    const next = nextTask();
    const chTitle = (id) => S.hundred.chapters.find((c) => c.id === id)?.title || '';
    $('#hdNext').innerHTML = next
      ? `<span>Next up:</span><button type="button" class="textbtn" data-jump="${esc(next.id)}">${esc(next.t)}: ${esc(next.n)}</button><span>(${esc(chTitle(next.ch))})</span>`
      : '<span>Every task is ticked. Best in the West!</span>';
  }

  function renderFoundBtn(p) {
    const b = $('#placeCard .pc-found'); if (!b) return;
    const on = S.found.has(p.id);
    b.setAttribute('aria-pressed', String(on));
    b.innerHTML = `<span class="pf-box">${TICK}</span><span>${on ? 'Found' : 'Mark as found'}</span>`;
  }

  function ensureLayer(type) {
    const grp = S.layerGroups.get(type);
    if (grp && !S.map.hasLayer(grp)) {
      grp.addTo(S.map);
      $(`#catList [data-layer="${type}"]`)?.setAttribute('aria-pressed', 'true');
    }
  }

  function buildGrid() {
    const m = S.data.map; const g = L.layerGroup();
    const style = { color: '#3a2c1e', weight: 1, opacity: 0.35, interactive: false, dashArray: '4 6' };
    for (let c = 0; c <= m.cols; c++) g.addLayer(L.polyline([[0, c * m.cellW], [-S.H, c * m.cellW]], style));
    for (let r = 0; r <= m.rows; r++) g.addLayer(L.polyline([[-r * m.cellH, 0], [-r * m.cellH, S.W]], style));
    for (const [cell, page] of Object.entries(m.atlasPages)) {
      const r = m.rowLabels.indexOf(cell[0]); const c = Number(cell.slice(1)) - 1;
      g.addLayer(L.marker([-(r * m.cellH) - 14, c * m.cellW + 8], {
        interactive: false, keyboard: false,
        icon: L.divIcon({ className: 'grid-label', iconSize: [90, 14], iconAnchor: [0, 0], html: `${cell} · p.${page}` }),
      }));
    }
    return g;
  }

  /* ---------- animal ranges: red dots from the guide's habitat maps ---------- */
  const RANGE_RED = '#f2553f';
  // Animals are coral with a dusky glow; plants green with a dark green one.
  const KIND = {
    animal: { fill: RANGE_RED, glow: '92, 40, 118', label: 'Animal range', icon: 'paw', hide: 'Hide animal ranges' },
    plant: { fill: '#5cb547', glow: '20, 66, 28', label: 'Where it grows', icon: 'leaf', hide: 'Hide plant areas' },
  };
  // Range keys: "all", "g:<group>" or "animal-<slug>" for animals; "plants" or "plant-<slug>" for plants.
  const kindOf = (key) => (key === 'plants' || key.startsWith('plant-') ? 'plant' : 'animal');
  const isMulti = (key) => key === 'all' || key === 'plants' || key.startsWith('g:');
  const spName = (sp) => sp.name || S.topics.get(sp.topic)?.title || sp.topic;                      // coral; soft edge and glow are baked into the range image

  function initRanges() {
    if (!S.data.ranges) return;
    S.ranges = new Map(S.data.ranges.species.map((sp) => [sp.topic, sp]));
    S.rangeCache = new Map();
    const pane = S.map.createPane('ranges');
    pane.style.zIndex = 350;                        // above the base map, below every pin
    pane.style.pointerEvents = 'none';
    S.rangeLayer = L.layerGroup();
    $('#rangePanel').addEventListener('click', (e) => { const b = e.target.closest('[data-topic]'); if (b) openTopic(b.dataset.topic, true); });
  }

  // The detailed ranges (outlines + 4-unit grids) live in their own file, fetched the first
  // time a range is opened; data.json only lists the species.
  function loadRanges() {
    if (!S.rangeFull) {
      const f = S.data.ranges.file || 'ranges.json', v = S.data.map.rangesV;
      S.rangeFull = fetch(v ? `${f}?v=${v}` : f, v ? {} : { cache: 'no-cache' })
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then((full) => { for (const sp of full.species) Object.assign(S.ranges.get(sp.topic) || {}, sp); S.rangeGrid = full; return full; });
    }
    return S.rangeFull;
  }

  // Grid: run-length encoded (off/on runs, row by row, LEB128 varints, base64), 4-unit cells.
  function rangeCells(sp) {
    if (!sp.bits) {
      const { cols, rows } = S.rangeGrid; const bin = atob(sp.rle || '');
      sp.bits = new Uint8Array(cols * rows);
      const on = [];
      let pos = 0, val = 0, v = 0, sh = 0;
      for (let i = 0; i < bin.length; i++) {
        const x = bin.charCodeAt(i); v |= (x & 0x7f) << sh; sh += 7;
        if (x & 0x80) continue;
        if (val) { sp.bits.fill(1, pos, pos + v); on.push(pos, v); }
        pos += v; val ^= 1; v = 0; sh = 0;
      }
      sp.onRuns = on;
    }
    return sp.bits;
  }

  // Outline rings, delta-encoded in half map units: [x0, y0, dx1, dy1, ...] -> Leaflet latlngs.
  function rangeRings(sp) {
    if (!sp.latlngs) {
      sp.latlngs = (sp.rings || []).map((r) => {
        const out = []; let x = 0, y = 0;
        for (let i = 0; i < r.length; i += 2) { x += r[i]; y += r[i + 1]; out.push([-y / 2, x / 2]); }
        return out;
      });
    }
    return sp.latlngs;
  }

  // A range key is one species ("animal-wolf", "plant-yarrow"), a group ("g:Birds") or every
  // animal ("all") / every plant ("plants").
  function rangeSet(key) {
    const all = S.data.ranges.species;
    if (key === 'all') return all.filter((sp) => sp.kind !== 'plant');
    if (key === 'plants') return all.filter((sp) => sp.kind === 'plant');
    if (key.startsWith('g:')) return all.filter((sp) => sp.group === key.slice(2));
    return S.ranges.has(key) ? [S.ranges.get(key)] : [];
  }

  // One species: its outline. Several: species counted per 16-unit spot (a spot counts for a
  // species when at least 3 of its 16 grid cells are in that species' range).
  function rangeDots(key) {
    if (S.rangeCache.has(key)) { const r = S.rangeCache.get(key); S.rangeCache.delete(key); S.rangeCache.set(key, r); return r; }
    const multi = isMulti(key);
    const set = rangeSet(key).filter((sp) => sp.cells);
    let res;
    if (!multi) {
      const rings = set.length ? rangeRings(set[0]) : [];
      const bounds = rings.length ? L.latLngBounds(rings.flat()) : null;
      res = { rings, bounds, empty: !rings.length };
    } else {
      const { cols, rows, cell } = S.rangeGrid; const F = 4;        // grid cells per spot side
      const cc = cols / F, cr = rows / F, count = new Uint8Array(cc * cr);
      const n = new Uint8Array(cc * cr);
      for (const sp of set) {
        rangeCells(sp); n.fill(0);
        const runs = sp.onRuns;
        for (let j = 0; j < runs.length; j += 2) {
          for (let i = runs[j], e = i + runs[j + 1]; i < e; i++) n[((i / cols / F) | 0) * cc + (((i % cols) / F) | 0)]++;
        }
        for (let k = 0; k < n.length; k++) if (n[k] >= 3) count[k]++;
      }
      const dots = []; let peak = 0, c0 = cc, c1 = -1, r0 = cr, r1 = -1;
      for (let i = 0; i < count.length; i++) {
        if (!count[i]) continue;
        const c = i % cc, r = (i / cc) | 0;
        dots.push([c, r, count[i]]); peak = Math.max(peak, count[i]);
        c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r);
      }
      const sz = cell * F;
      res = { dots, peak, size: sz, empty: !dots.length,
        bounds: dots.length ? L.latLngBounds([-(r1 + 1) * sz, c0 * sz], [-r0 * sz, (c1 + 1) * sz]) : null };
    }
    S.rangeCache.set(key, res);
    // keep only the most recent ranges' drawings in memory
    // (fewer on iPad/iPhone, where Safari caps total canvas memory; shrinking a canvas frees it at once)
    if (S.rangeCache.size > (ios ? 4 : 8)) {
      const old = S.rangeCache.keys().next().value, r = S.rangeCache.get(old);
      if (r?.img?.el && S.range !== old) { r.img.el.width = r.img.el.height = 0; }
      S.rangeCache.delete(old);
    }
    return res;
  }

  // Ranges are drawn once into an image (soft edge and dusky glow baked in) and shown as an image
  // overlay, which the browser simply scales while you pan and zoom: no per-frame redrawing.
  // Like L.imageOverlay, but shows a canvas element directly (no image encoding).
  const CanvasOverlay = L.ImageOverlay.extend({
    _initImage() {
      const el = (this._image = this._url);
      L.DomUtil.addClass(el, 'leaflet-image-layer');
      if (this._zoomAnimated) L.DomUtil.addClass(el, 'leaflet-zoom-animated');
      if (this.options.className) L.DomUtil.addClass(el, this.options.className);
      el.onselectstart = L.Util.falseFn; el.onmousemove = L.Util.falseFn;
    },
  });
  function drawRange(key, res, multi) {
    S.rangeLayer.clearLayers();
    if (!res.empty) {
      const { el, bounds } = rangeImage(key, res, multi);
      S.rangeLayer.addLayer(new CanvasOverlay(el, bounds, { pane: 'ranges', interactive: false, className: `range-img range-${kindOf(key)}` }));
    }
    S.rangeLayer.addTo(S.map);
  }

  function rangeImage(key, res, multi) {
    if (res.img) return res.img;
    const pad = 14;                                                  // map units of room for the glow
    let x0, y0, x1, y1;
    if (multi) { x0 = 0; y0 = 0; x1 = S.W; y1 = S.H; }
    else {
      const b = res.bounds; x0 = Math.max(0, b.getWest() - pad); x1 = Math.min(S.W, b.getEast() + pad);
      y0 = Math.max(0, -b.getNorth() - pad); y1 = Math.min(S.H, -b.getSouth() + pad);
    }
    // pixels per map unit: sharp enough up close, but never a huge canvas (phones)
    const cap = ios ? 1600 : desktop.matches ? 2048 : 1400;          // largest canvas side, px (iOS caps canvas memory)
    const k = Math.max(0.4, Math.min(multi ? (desktop.matches ? 0.9 : 0.6) : 2.5, cap / Math.max(x1 - x0, y1 - y0)));
    const w = Math.ceil((x1 - x0) * k), h = Math.ceil((y1 - y0) * k);
    const shape = document.createElement('canvas'); shape.width = w; shape.height = h;
    const g = shape.getContext('2d');
    g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    const K = KIND[kindOf(key)];
    g.fillStyle = K.fill;
    if (!multi) {
      g.beginPath();
      for (const ring of res.rings) {
        ring.forEach(([lat, lng], i) => (i ? g.lineTo(lng, -lat) : g.moveTo(lng, -lat)));
        g.closePath();
      }
      g.fill('evenodd');
    } else {
      for (const [c, r, n] of res.dots) {
        const t = n / res.peak;
        g.globalAlpha = 0.35 + 0.65 * t;
        g.beginPath(); g.arc((c + 0.5) * res.size, (r + 0.5) * res.size, res.size * (0.12 + 0.4 * t), 0, 2 * Math.PI); g.fill();
      }
      g.globalAlpha = 1;
    }
    // glow behind, then a light feather on the edge
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const o = out.getContext('2d');
    o.shadowColor = `rgba(${K.glow}, 0.9)`; o.shadowBlur = Math.max(4, 3.5 * k * (multi ? 1 : 1.2));
    o.drawImage(shape, 0, 0);
    o.shadowBlur = Math.max(10, 9 * k); o.shadowColor = `rgba(${K.glow}, 0.4)`; o.globalCompositeOperation = 'destination-over';
    o.drawImage(shape, 0, 0);
    let final = out;
    if ('filter' in o) {
      const soft = document.createElement('canvas'); soft.width = w; soft.height = h;
      const sc = soft.getContext('2d'); sc.filter = `blur(${Math.max(1, 1.2 * k).toFixed(1)}px)`; sc.drawImage(out, 0, 0);
      final = soft;
    }
    res.img = { el: final, bounds: L.latLngBounds([-y1, x0], [-y0, x1]) };
    return res.img;
  }

  // The picker under the map lists either the animals or the plants, whichever is showing.
  function renderRangePanel(kind) {
    S.panelKind = kind;
    const all = S.data.ranges.species;
    const opt = (v, label) => `<option value="${esc(v)}">${esc(label)}</option>`;
    const byName = (a, b) => spName(a).localeCompare(spName(b));
    let options;
    if (kind === 'plant') {
      const plants = all.filter((sp) => sp.kind === 'plant');
      const list = (ref) => plants.filter((sp) => sp.ref === ref).sort(byName)
        .map((sp) => opt(sp.topic, spName(sp) + (sp.cells ? '' : ' (almost everywhere)'))).join('');
      options = `<optgroup label="Together">${opt('plants', `All plants (${plants.filter((sp) => sp.cells).length} mapped)`)}</optgroup>`
        + `<optgroup label="Herbs">${list('herbs')}</optgroup><optgroup label="Berries &amp; mushrooms">${list('provisions')}</optgroup>`;
    } else {
      const animals = all.filter((sp) => sp.kind !== 'plant');
      const ORDER = ['Mammals', 'Birds', 'Reptiles & amphibians', 'Livestock'];
      const rank = (g) => (ORDER.includes(g) ? ORDER.indexOf(g) : ORDER.length);
      const groups = [...new Set(animals.map((sp) => sp.group))].sort((a, b) => rank(a) - rank(b));
      const mapped = (g) => animals.filter((sp) => sp.cells && (!g || sp.group === g)).length;
      const together = [opt('all', `All animals (${mapped()} species)`)]
        .concat(groups.filter((g) => mapped(g) > 1).map((g) => opt('g:' + g, `All ${g.toLowerCase()} (${mapped(g)})`)));
      options = `<optgroup label="Groups">${together.join('')}</optgroup>` + groups.map((g) => `<optgroup label="${esc(g)}">${animals.filter((sp) => sp.group === g)
        .sort(byName).map((sp) => opt(sp.topic, spName(sp) + (sp.cells ? '' : ' (Guarma only)'))).join('')}</optgroup>`).join('');
    }
    const K = KIND[kind];
    const panel = $('#rangePanel');
    panel.dataset.kind = kind;
    panel.innerHTML = `
      <div class="rp-head">
        <span class="rp-ico">${ICONS[K.icon]}</span>
        <div class="rp-pick">
          <label class="rp-label" for="rangeSel">${K.label}</label>
          <select id="rangeSel">${options}</select>
        </div>
        <button class="rp-close" type="button" aria-label="${K.hide}">${ICONS.close}</button>
      </div>
      <div class="rp-legend"></div>
      <p class="rp-note" id="rpNote" aria-live="polite"></p>`;
    $('#rangeSel').addEventListener('change', (e) => showRange(e.target.value, { fit: true }));
    $('.rp-close', panel).addEventListener('click', hideRange);
  }

  function showRange(key, opts = {}) {
    if (!S.ranges || !(isMulti(key) || S.ranges.has(key))) return;
    const kind = kindOf(key);
    S.range = S.lastRange[kind] = key;
    if (S.panelKind !== kind) renderRangePanel(kind);
    if (!desktop.matches) setView('map');
    if (!S.rangeGrid) {                                  // first range: fetch the detailed file
      $('#rangePanel').hidden = false; $('#rangeSel').value = key;
      $('.rp-legend').hidden = true; $('#rpNote').textContent = 'Loading the range…';
      loadRanges().then(() => { if (S.range === key) showRange(key, opts); })
        .catch(() => { $('#rpNote').textContent = "Couldn't load the ranges. Check your connection and try again."; S.rangeFull = null; });
      return;
    }
    const multi = isMulti(key);
    const res = rangeDots(key);
    drawRange(key, res, multi);

    $('#rangePanel').hidden = false;
    $('#catList [data-ranges]')?.setAttribute('aria-pressed', String(kind === 'animal'));
    $('#catList [data-plants]')?.setAttribute('aria-pressed', String(kind === 'plant'));
    $('#rangeSel').value = key;
    const dot = (t) => `<i class="rdot" style="--s:${(3 + 10 * t).toFixed(1)}px;opacity:${(0.35 + 0.65 * t).toFixed(2)}"></i>`;
    const legend = $('.rp-legend');
    legend.hidden = res.empty;
    const unit = kind === 'plant' ? ['plant', 'plants'] : ['species', 'species'];
    legend.innerHTML = multi
      ? `<span>1 ${unit[0]}</span><span class="rp-dots">${[0.25, 0.5, 0.75, 1].map(dot).join('')}</span><span>${res.peak} ${res.peak === 1 ? unit[0] : unit[1]}</span>`
      : `<span class="rp-dots">${dot(1)}</span><span>${kind === 'plant' ? 'Where the guide says it grows' : 'Where the guide marks it'}</span>`;
    let note;
    if (kind === 'plant') {
      const APPROX = "The guide has no plant maps, so these areas follow its written descriptions and are approximate.";
      if (multi) {
        const everywhere = rangeSet('plants').filter((sp) => !sp.cells).length;
        note = `Bigger, stronger dots mean more kinds of plant grow there (pp. 305–306). ${everywhere} more grow almost everywhere. ${APPROX}`;
      } else {
        const sp = S.ranges.get(key);
        note = `<b>${esc(spName(sp))}</b>: ${esc(sp.where)} `
          + (sp.cells ? APPROX : "The guide doesn't narrow it down to one area, so there's nothing to shade.")
          + ` <button class="textbtn" type="button" data-topic="${esc(sp.ref)}">Guide p. ${sp.page}</button>`;
      }
    } else if (multi) note = "Bigger, stronger dots mean more species live there. From the guide's habitat maps, pp. 149–161.";
    else {
      const sp = S.ranges.get(key); const t = S.topics.get(key);
      note = sp.cells ? `${esc(t.title)}: from the guide's habitat map, p. ${sp.page}.${sp.guarma ? ' Also found on Guarma.' : ''}`
        : `The guide only maps the ${esc(t.title)} on Guarma, which isn't part of this map.`;
      note += ` <button class="textbtn" type="button" data-topic="${esc(key)}">Read topic</button>`;
    }
    $('#rpNote').innerHTML = note;
    history.replaceState(null, '', '#range=' + encodeURIComponent(key));
    if (opts.fit && res.bounds) requestAnimationFrame(() => {
      ensureView();
      const bottom = desktop.matches ? 24 : $('#mapBottom').offsetHeight + 24;
      // A range spanning nearly the whole map would shrink to a strip on a phone: start on the main landmass instead.
      if (!desktop.matches && S.map.getBoundsZoom(res.bounds, false, L.point(32, 70 + bottom)) < -1.5) { homeView(); return; }
      S.map.fitBounds(res.bounds, { paddingTopLeft: [16, 70], paddingBottomRight: [16, bottom], maxZoom: -0.5 });
    });
  }

  function hideRange() {
    S.range = null;
    S.rangeLayer.clearLayers(); S.rangeLayer.remove();
    $('#rangePanel').hidden = true;
    $('#catList [data-ranges]')?.setAttribute('aria-pressed', 'false');
    $('#catList [data-plants]')?.setAttribute('aria-pressed', 'false');
    if (location.hash.startsWith('#range=')) history.replaceState(null, '', location.pathname + location.search);
  }

  function setHits(list) {
    if (!S.hitLayer) return;
    S.hitLayer.clearLayers();
    S.hits = list;
    for (const p of list) {
      S.hitLayer.addLayer(L.marker(ll(p), { interactive: false, keyboard: false, icon: L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 17], html: '<div class="hit-ring"></div>' }) }));
    }
    const bar = $('#mapHits');
    if (list.length) {
      bar.hidden = false;
      bar.innerHTML = `<span><b>${list.length}</b> matching place${list.length === 1 ? '' : 's'} glowing</span><button type="button" data-fit>Fit</button><button type="button" data-clear>Clear</button>`;
      bar.onclick = (e) => {
        if (e.target.closest('[data-fit]')) fitHits();
        if (e.target.closest('[data-clear]')) { setHits([]); }
      };
    } else bar.hidden = true;
  }

  function fitHits() {
    if (!S.hits?.length) return;
    if (!desktop.matches) setView('map');
    for (const p of S.hits) ensureLayer(p.type);
    requestAnimationFrame(() => {
      ensureView();
      if (S.hits.length === 1) S.map.setView(ll(S.hits[0]), 0);
      else S.map.fitBounds(L.latLngBounds(S.hits.map(ll)).pad(0.25), { maxZoom: 0 });
    });
  }

  function showPlace(id, fromSearch) {
    const p = S.places.get(id); if (!p) return;
    if (p.x == null) { openPlace(id); return; }
    if (!desktop.matches) setView('map');
    ensureLayer(p.type);
    requestAnimationFrame(() => {
      ensureView();
      openPlace(id);
      centerBesideCard(p, Math.max(S.map.getZoom(), -0.5), !fromSearch || desktop.matches);
    });
  }

  // Centre the map so the marker isn't hidden under the place card
  // (card sits on the right on desktop, as a bottom sheet on phones).
  function centerBesideCard(p, zoom, animate) {
    const card = $('#placeCard');
    const size = S.map.getSize();
    let dx = 0, dy = 0;
    if (!card.hidden) {
      if (desktop.matches) dx = Math.min(card.offsetWidth + 14, size.x * 0.6) / 2;
      else dy = Math.min(card.offsetHeight + 8, size.y * 0.6) / 2;
    }
    const pt = S.map.project(ll(p), zoom).add([dx, dy]);
    S.map.setView(S.map.unproject(pt, zoom), zoom, { animate });
  }

  function openPlace(id) {
    const p = S.places.get(id); if (!p) return;
    const t = TYPES[p.type] || TYPES.landmark;
    selectMarker(id);
    const related = (p.topics || []).map((tid) => S.topics.get(tid)).filter(Boolean);
    const src = p.atlasPage
      ? `<span class="mono">Atlas page ${p.atlasPage} · grid ${esc(p.cell)}</span>`
      : `<span class="mono">Not on the main map</span>`;
    const card = $('#placeCard');
    card.innerHTML = `<div class="grab"></div>
      <button class="pc-close" type="button" aria-label="Close">${ICONS.close}</button>
      <span class="pc-type" style="--c:${t.color}"><span class="dot"></span>${esc(t.label)}${p.num ? ` · no. ${esc(p.num)}` : ''}</span>
      <h2>${esc(p.name)}</h2>
      ${trackable(p) ? '<button class="pc-found" type="button" aria-pressed="false"></button>' : ''}
      <p>${esc(p.description || '')}</p>
      <div class="pc-src">${src}${p.approx ? '<span class="mono pc-approx">Approximate position</span>' : ''}</div>
      ${related.length ? `<div class="pc-topics"><h3>In the guide</h3>${related.map((tp) => `<button class="pc-link" type="button" data-topic="${esc(tp.id)}"><span>${esc(tp.title)}</span><span>${pageLabel(tp)}</span></button>`).join('')}</div>` : ''}`;
    card.hidden = false;
    card.scrollTop = 0;
    $('.pc-close', card).onclick = closePlace;
    renderFoundBtn(p);
    card.onclick = (e) => {
      if (e.target.closest('.pc-found')) { toggleFound(p.id); return; }
      const b = e.target.closest('[data-topic]'); if (b) openTopic(b.dataset.topic, true);
    };
    history.replaceState(null, '', '#place=' + encodeURIComponent(id));
    if (p.x == null && !desktop.matches) setView('map');
  }

  function selectMarker(id) {
    const prev = S.selected;
    if (prev) {
      const old = S.markerOf.get(prev);
      old?.setZIndexOffset?.(0);
      if (old?._icon) old._icon.classList.remove('is-sel');
    }
    S.selected = id;
    if (prev && prev !== id && S.hideFound && S.found.has(prev)) refreshMarker(S.places.get(prev));   // tuck it away again
    const mk = S.markerOf.get(id);
    if (mk && S.hideFound && S.found.has(id)) refreshMarker(S.places.get(id));                        // show it while open
    if (mk?._icon) { mk._icon.classList.add('is-sel'); mk.setZIndexOffset(1000); }
  }

  function closePlace() {
    const card = $('#placeCard');
    if (card.hidden) return;
    card.hidden = true;
    selectMarker(null);
    if (location.hash.startsWith('#place=')) history.replaceState(null, '', location.pathname + location.search);
  }

  /* ---------- open a topic in the guide ---------- */
  function openTopic(id, scroll) {
    const el = document.getElementById('topic-' + id); if (!el) return;
    if (!desktop.matches) setView('guide'); else { setPanelOpen(true, false); setPanel('guide'); }
    if (el.hidden) { S.activeCats.clear(); applyFilter(); }
    // Open instantly (no height animation) so the scroll target is already in its final place.
    const sec = el.closest('.sec');
    sec.classList.add('instant');
    setSectionOpen(sec, true);
    setTopicOpen(el, true);
    void sec.offsetHeight;
    requestAnimationFrame(() => sec.classList.remove('instant'));
    history.replaceState(null, '', '#topic=' + encodeURIComponent(id));
    if (scroll) {
      requestAnimationFrame(() => {
        scrollToEl(el);
        el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 1600);
      });
    }
  }

  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    const [k, v] = h.split('=');
    if (k === 'topic' && v) openTopic(v, true);
    else if (k === 'place' && v) showPlace(v, false);
    else if (k === 'range' && v) showRange(v, { fit: true });
    else if (k === 'hundred') openHundred(v);
  }

  function copyLink(kind, id, btn) {
    const url = `${location.origin}${location.pathname}#${kind}=${encodeURIComponent(id)}`;
    const done = () => { const old = btn.innerHTML; btn.textContent = 'Copied'; setTimeout(() => { btn.innerHTML = old; }, 1400); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, () => prompt('Copy this link:', url));
    else prompt('Copy this link:', url);
  }

  const smooth = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  // Scroll so the element sits just below the sticky header (phones: the page; wide screens:
  // the sidebar, under its tabs). Long jumps skip the smooth animation.
  function scrollToEl(el) {
    if (desktop.matches) {
      const box = $('#sidebar');
      const target = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - $('.sb-tabs').offsetHeight - 10;
      const far = Math.abs(target - box.scrollTop) > box.clientHeight * 3;
      box.scrollTo({ top: target, behavior: far ? 'auto' : smooth() });
      return;
    }
    const header = $('#topbar').offsetHeight;
    const target = el.getBoundingClientRect().top + window.scrollY - header - 12;
    const far = Math.abs(target - window.scrollY) > window.innerHeight * 3;
    window.scrollTo({ top: target, behavior: far ? 'auto' : smooth() });
  }
})();
