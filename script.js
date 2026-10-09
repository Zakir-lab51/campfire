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
  const desktop = window.matchMedia('(min-width: 960px)');

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
    names: '<path d="M5 19L11 5h2l6 14M7.6 13.5h8.8"/>',
    grid: '<path d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>',
  };
  const glyph = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[name] || GLYPHS.excl}</svg>`;
  const PIN = 'M14 35C12.6 29.5 2 22.5 2 13a12 12 0 0 1 24 0c0 9.5-10.6 16.5-12 22z';
  const pinHtml = (color, g) => `<span class="pin" style="--c:${color}"><svg class="body" viewBox="0 0 28 36" aria-hidden="true"><path d="${PIN}"/></svg><span class="glyph">${glyph(g)}</span></span>`;
  const typePin = (type) => { const t = TYPES[type] || TYPES.landmark; return pinHtml(t.color, t.glyph); };
  // Names drawn on the map, by place type (regions, rivers and lakes are names only, no pins).
  const LABELLED = { town: 'town', area: 'area', water: 'water', landmark: 'landmark', camp: 'camp',
    shack: 'minor', poi: 'minor', hideout: 'minor', shop: 'minor' };
  const NAME_ONLY = new Set(['area', 'water']);
  const CAT_GROUPS = [
    ['Places', ['town', 'camp', 'landmark', 'hideout', 'shack', 'poi', 'shop']],
    ['People & jobs', ['stranger', 'special', 'bounty', 'request']],
    ['Hunting & fishing', ['legendary', 'legendary-fish', ':ranges']],
    ['Collectibles', ['card', 'bone', 'carving', 'dreamcatcher', 'treasure', 'chest', 'tonic', 'unique', 'orchid', 'gator-egg']],
    ['On the map', [':labels', ':grid']],
  ];
  const ICONS = {
    topic: '<svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5z"/><path d="M8 10h8M8 14h8M8 18h5"/></svg>',
    place: '<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',
    map: '<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    paw: '<svg viewBox="0 0 24 24"><path d="M12 13.5c-2.6 0-5 2.6-5 4.6 0 1.4 1.2 2.1 2.5 2.1 1 0 1.6-.5 2.5-.5s1.5.5 2.5.5c1.3 0 2.5-.7 2.5-2.1 0-2-2.4-4.6-5-4.6z"/><ellipse cx="5.5" cy="10.6" rx="1.7" ry="2.1"/><ellipse cx="9.3" cy="6.6" rx="1.7" ry="2.2"/><ellipse cx="14.7" cy="6.6" rx="1.7" ry="2.2"/><ellipse cx="18.5" cy="10.6" rx="1.7" ry="2.1"/></svg>',
  };

  const S = {
    data: null, fuse: null,
    topics: new Map(), places: new Map(), sectionOf: new Map(), catColor: new Map(),
    activeCats: new Set(),
    map: null, H: 0, W: 0, layerGroups: new Map(), markerOf: new Map(), selected: null,
    hitLayer: null, gridLayer: null, labelLayer: null, mapReady: false, view: 'map',
    results: [], activeResult: -1,
    ranges: null, range: null, rangeLayer: null,
  };

  /* ---------- boot ---------- */
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
    if (!topics.length && !places.length) {
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
    const tokens = queryTokens();
    const species = S.ranges && tokens.length ? topics.slice(0, 8).filter((r) => S.ranges.has(r.item.id)
      && tokens.every((t) => wordRanges(r.item.title, [t]).length)).slice(0, 3) : [];
    const rGroup = species.length ? `<div class="results-group"><h3>Animal ranges</h3></div>${species.map((r, i) => rangeRow(r.item.id, i)).join('')}` : '';
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
    return `<button class="result" type="button" role="option" data-kind="${it.kind}" data-id="${esc(it.id)}" style="--c:${color};animation-delay:${Math.min(i, 8) * 18}ms">
      <span class="result-ico">${isTopic ? ICONS.topic : glyph((TYPES[S.places.get(it.id).type] || TYPES.landmark).glyph)}</span>
      <span><span class="result-title">${title}</span><span class="result-snip">${snip}</span></span>
      <span class="result-meta">${esc(meta)}</span>
    </button>`;
  }

  function rangeRow(id, i) {
    const sp = S.ranges.get(id); const t = S.topics.get(id);
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
    desktop.addEventListener?.('change', () => { setDrawer(false); S.map && setTimeout(() => S.map.invalidateSize(), 50); });
    S.mapShown = true;
  }

  // Phones show one view at a time: the map (categories in a drawer) or the guide.
  function setView(v) {
    S.view = v;
    $('#layout').dataset.view = v;
    $$('.viewtabs [data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    setDrawer(false);
    setPanel(v === 'guide' ? 'guide' : 'map');
    if (v === 'guide') window.scrollTo(0, 0);
    if (v === 'map' && S.map) requestAnimationFrame(() => {
      if (!S.mapShown) { S.mapShown = true; if (!S.selected) { homeView(); return; } }
      ensureView();
    });
  }

  // The sidebar shows the map categories or the guide (tabs on wide screens).
  function setPanel(panel) {
    $('#sidebar').dataset.panel = panel;
    $$('.sb-tabs [data-panel]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.panel === panel)));
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
      crs: L.CRS.Simple, minZoom: -3, maxZoom: m.maxZoom ?? 3, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 90,
      attributionControl: false, zoomControl: false, preferCanvas: true, renderer: L.canvas({ tolerance: 9 }),
    });
    S.map = map;
    map.createPane('base').style.zIndex = 250;      // base map < animal-range dots (350) < pins
    (m.tiles
      ? L.tileLayer(m.tiles, {
        pane: 'base', className: 'base-map', tileSize: 256, noWrap: true, keepBuffer: 3, bounds: L.latLngBounds(bounds),
        minZoom: -3, maxZoom: m.maxZoom ?? 3, minNativeZoom: m.minNativeZoom ?? -2, maxNativeZoom: m.maxNativeZoom ?? 2,
      })
      : L.imageOverlay(m.image, bounds, { className: 'base-map', pane: 'base' })).addTo(map);
    map.setMaxBounds(L.latLngBounds(bounds).pad(0.2));
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    if (m.credit) L.control.attribution({ position: 'topright', prefix: false }).addAttribution(esc(m.credit)).addTo(map);
    S.homeBounds = bounds;
    homeView();
    // The container may get its final size after fonts/header settle; refit once it has.
    requestAnimationFrame(() => { map.invalidateSize(); homeView(); });
    map.on('zoomend', zoomClass); zoomClass();
    map.on('click', () => closePlace());

    const visible = new Set(store.get('layers', null) || S.data.layers.filter((l) => l.default).map((l) => l.id));
    for (const l of S.data.layers) S.layerGroups.set(l.id, L.layerGroup());
    map.createPane('labels').style.zIndex = 450;     // names sit above the dots, under the pins
    S.labelLayer = buildLabels().addTo(map);
    for (const p of S.data.places) {
      if (p.x == null || NAME_ONLY.has(p.type)) continue;
      const mk = makeMarker(p);
      S.markerOf.set(p.id, mk);
      (S.layerGroups.get(p.type) || S.layerGroups.get('landmark')).addLayer(mk);
    }
    for (const [id, g] of S.layerGroups) if (visible.has(id)) g.addTo(map);
    S.hitLayer = L.layerGroup().addTo(map);
    S.gridLayer = buildGrid();
    renderCategories(visible);
    initRanges();
    S.mapReady = true;
  }

  const ll = (p) => [-p.y, p.x];

  // Make sure the map has a view and an up-to-date size before moving it.
  function ensureView() {
    try { S.map.getCenter(); S.map.invalidateSize(); } catch { homeView(); }
  }

  // Wide screens see the whole map; narrow/portrait screens start on the main landmass
  // (the Heartlands and Lemoyne), big enough to tap, with New Austin a swipe away.
  function homeView() {
    const el = S.map.getContainer();
    if (!el.clientWidth || !el.clientHeight) return;          // still hidden (phone, guide tab)
    // A map created while hidden has no view and a cached 0×0 size: give it one, then re-measure.
    try { S.map.getCenter(); } catch { S.map.setView([-S.H / 2, S.W / 2], -2, { animate: false }); }
    S.map.invalidateSize({ pan: false });
    const size = S.map.getSize();
    if (size.x >= 700) { S.map.fitBounds(S.homeBounds, { padding: [8, 8] }); return; }
    const z = Math.max(-3, Math.min(0, Math.log2(Math.min(size.x / 1150, size.y / 900))));
    S.map.setView([-720, 1420], Math.round(z * 4) / 4, { animate: false });
  }

  // Every place is a teardrop pin with its type's picture; the tip marks the spot.
  function makeMarker(p) {
    const t = TYPES[p.type] || TYPES.landmark;
    const icon = L.divIcon({ className: `mk mk-${p.type}`, iconSize: [28, 36], iconAnchor: [14, 35], html: typePin(p.type) });
    const mk = L.marker(ll(p), { icon, title: p.name, keyboard: !!t.named, riseOnHover: true });
    mk.on('click', (e) => { L.DomEvent.stop(e); onMarker(p); });
    return mk;
  }

  // Names on the map: states, regions, rivers and lakes, towns, camps and landmarks.
  // Which ones show depends on the zoom (see the .lbl rules in style.css).
  function buildLabels() {
    const g = L.layerGroup();
    const add = (kind, name, x, y, id) => {
      const icon = L.divIcon({ className: `lbl lbl-${kind}`, iconSize: [0, 0], html: `<span>${esc(name)}</span>` });
      const mk = L.marker([-y, x], { icon, pane: 'labels', interactive: !!id, keyboard: false });
      if (id) mk.on('click', (e) => { L.DomEvent.stop(e); onMarker(S.places.get(id)); });
      g.addLayer(mk);
    };
    for (const st of S.data.map.states || []) add('state', st.name, st.x, st.y);
    for (const p of S.data.places) if (p.x != null && LABELLED[p.type]) add(LABELLED[p.type], p.name, p.x, p.y, p.id);
    return g;
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

  // far / mid / near / close: pins shrink and fewer names show as you zoom out.
  function zoomClass() {
    const z = S.map.getZoom();
    const el = S.map.getContainer();
    const band = z < -1.6 ? 'far' : z < -0.25 ? 'mid' : z < 0.75 ? 'near' : 'close';
    if (el.dataset.z !== band) el.dataset.z = band;
  }

  const labelsOn = () => store.get('labels', S.data.map.labels !== false);

  function renderCategories(visible) {
    const counts = new Map();
    for (const p of S.data.places) if (p.x != null) counts.set(p.type, (counts.get(p.type) || 0) + 1);
    const names = new Map(S.data.layers.map((l) => [l.id, l.label]));
    const row = (attrs, pin, name, n, on) => `<button class="cat" type="button" ${attrs} aria-pressed="${on}">
        <span class="cat-ico">${pin}</span><span class="cat-name">${esc(name)}</span>${n != null ? `<span class="n">${n}</span>` : ''}</button>`;
    const html = CAT_GROUPS.map(([title, ids]) => {
      const rows = ids.map((id) => {
        if (id === ':ranges') return S.data.ranges ? row('data-ranges', pinHtml('#b5332a', 'paw'), 'Animal ranges', S.data.ranges.species.filter((sp) => sp.cells).length, false) : '';
        if (id === ':labels') return row('data-labels', pinHtml('#5b4a38', 'names'), 'Place names', null, labelsOn());
        if (id === ':grid') return row('data-grid', pinHtml('#8b7760', 'grid'), 'Atlas grid', null, false);
        if (!counts.get(id)) return '';
        return row(`data-layer="${id}"`, typePin(id), names.get(id) || TYPES[id].label, counts.get(id), visible.has(id));
      }).join('');
      return rows ? `<div class="cat-group"><h3>${esc(title)}</h3><div class="cat-grid">${rows}</div></div>` : '';
    }).join('');
    const list = $('#catList');
    list.innerHTML = html;
    if (!labelsOn()) S.map.getContainer().classList.add('no-labels');
    const save = () => store.set('layers', $$('#catList [data-layer][aria-pressed="true"]').map((x) => x.dataset.layer));
    const setLayer = (b, on) => {
      b.setAttribute('aria-pressed', String(on));
      const grp = S.layerGroups.get(b.dataset.layer);
      on ? grp.addTo(S.map) : grp.remove();
    };
    list.addEventListener('click', (e) => {
      const hr = e.target.closest('[data-ranges]');
      if (hr) { S.range ? hideRange() : showRange(S.lastRange || 'all'); setDrawer(false); return; }
      const lb = e.target.closest('[data-labels]');
      if (lb) {
        const on = lb.getAttribute('aria-pressed') !== 'true';
        lb.setAttribute('aria-pressed', String(on)); store.set('labels', on);
        S.map.getContainer().classList.toggle('no-labels', !on); return;
      }
      const g = e.target.closest('[data-grid]');
      if (g) { const on = g.getAttribute('aria-pressed') !== 'true'; g.setAttribute('aria-pressed', String(on)); on ? S.gridLayer.addTo(S.map) : S.gridLayer.remove(); return; }
      const b = e.target.closest('[data-layer]'); if (!b) return;
      setLayer(b, b.getAttribute('aria-pressed') !== 'true'); save();
    });
    $('#showAll').addEventListener('click', () => { $$('#catList [data-layer]').forEach((b) => setLayer(b, true)); save(); });
    $('#hideAll').addEventListener('click', () => { $$('#catList [data-layer]').forEach((b) => setLayer(b, false)); save(); });
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
  const RANGE_RED = '#d8352a';

  function initRanges() {
    if (!S.data.ranges) return;
    S.ranges = new Map(S.data.ranges.species.map((sp) => [sp.topic, sp]));
    S.rangeCache = new Map();
    const pane = S.map.createPane('ranges');
    pane.style.zIndex = 350;                        // above the base map, below every pin
    pane.style.pointerEvents = 'none';
    S.rangeRenderer = L.canvas({ pane: 'ranges', padding: 0.3 });
    S.rangeLayer = L.layerGroup();
    renderRangePanel();
  }

  // Each species grid is a base64 bitmask, row by row: bit set = the guide marks it in that cell.
  function rangeCells(sp) {
    if (!sp.bits) {
      const { cols, rows } = S.data.ranges; const bin = atob(sp.grid);
      sp.bits = new Uint8Array(cols * rows);
      for (let i = 0; i < sp.bits.length; i++) sp.bits[i] = (bin.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
    }
    return sp.bits;
  }

  // A range key is one species ("animal-wolf"), a group ("g:Birds") or every species ("all").
  function rangeSet(key) {
    const all = S.data.ranges.species;
    if (key === 'all') return all;
    if (key.startsWith('g:')) return all.filter((sp) => sp.group === key.slice(2));
    return S.ranges.has(key) ? [S.ranges.get(key)] : [];
  }

  // Count the chosen species in each cell; keep the occupied cells and their extent.
  function rangeDots(key) {
    if (S.rangeCache.has(key)) return S.rangeCache.get(key);
    const { cols, rows, cell } = S.data.ranges;
    const set = rangeSet(key).filter((sp) => sp.cells);
    const count = new Uint8Array(cols * rows);
    for (const sp of set) { const b = rangeCells(sp); for (let i = 0; i < b.length; i++) count[i] += b[i]; }
    const dots = []; let peak = 0, c0 = cols, c1 = -1, r0 = rows, r1 = -1;
    for (let i = 0; i < count.length; i++) {
      if (!count[i]) continue;
      const c = i % cols, r = (i / cols) | 0;
      dots.push([c, r, count[i]]);
      peak = Math.max(peak, count[i]);
      c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r);
    }
    const bounds = dots.length ? L.latLngBounds([-(r1 + 1) * cell, c0 * cell], [-r0 * cell, (c1 + 1) * cell]) : null;
    const res = { dots, peak, bounds };
    S.rangeCache.set(key, res);
    return res;
  }

  // One species: solid red patches with smooth edges, like the guide's own maps.
  // Several species: one dot per cell, bigger and stronger where more of them live.
  function drawRange(key, res, multi) {
    const cell = S.data.ranges.cell;
    S.rangeLayer.clearLayers();
    if (!multi) {
      if (res.dots.length) S.rangeLayer.addLayer(L.imageOverlay(rangePatches(key, res), S.homeBounds, { pane: 'ranges', interactive: false }));
    } else {
      for (const [c, r, n] of res.dots) {
        const t = n / res.peak;
        S.rangeLayer.addLayer(L.circle([-(r + 0.5) * cell, (c + 0.5) * cell], {
          radius: cell * (0.12 + 0.4 * t), renderer: S.rangeRenderer, interactive: false,
          stroke: false, fillColor: RANGE_RED, fillOpacity: 0.35 + 0.65 * t,
        }));
      }
    }
    S.rangeLayer.addTo(S.map);
  }

  // Blur the species' cells a little and cut at half height: neighbouring cells merge into
  // round-edged patches, and a lone cell stays a dot of about its own size.
  function rangePatches(key, res) {
    if (res.url) return res.url;
    const { cols, rows } = S.data.ranges; const UP = 12;            // image pixels per cell
    const w = cols * UP, h = rows * UP;
    const on = new Uint8Array(cols * rows); for (const [c, r] of res.dots) on[r * cols + c] = 1;
    let f = new Float32Array(w * h);
    for (let y = 0; y < h; y++) { const row = ((y / UP) | 0) * cols; for (let x = 0; x < w; x++) f[y * w + x] = on[row + ((x / UP) | 0)]; }
    f = boxBlur(boxBlur(f, w, h, 6), w, h, 6);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); const img = ctx.createImageData(w, h); const d = img.data;
    for (let i = 0; i < f.length; i++) {
      const a = Math.min(1, Math.max(0, (f[i] - 0.32) / 0.16));     // soft threshold = anti-aliased edge
      if (!a) continue;
      d[i * 4] = 216; d[i * 4 + 1] = 53; d[i * 4 + 2] = 42; d[i * 4 + 3] = 255 * a;
    }
    ctx.putImageData(img, 0, 0);
    return (res.url = cv.toDataURL());
  }

  function boxBlur(src, w, h, r) {
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length), k = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      const o = y * w; let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[o + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) { tmp[o + x] = acc / k; acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) { out[y * w + x] = acc / k; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
    }
    return out;
  }

  function renderRangePanel() {
    const R = S.data.ranges;
    const ORDER = ['Mammals', 'Birds', 'Reptiles & amphibians', 'Livestock'];
    const rank = (g) => (ORDER.includes(g) ? ORDER.indexOf(g) : ORDER.length);
    const groups = [...new Set(R.species.map((sp) => sp.group))].sort((a, b) => rank(a) - rank(b));
    const mapped = (g) => R.species.filter((sp) => sp.cells && (!g || sp.group === g)).length;
    const name = (sp) => S.topics.get(sp.topic)?.title || sp.topic;
    const opt = (v, label) => `<option value="${esc(v)}">${esc(label)}</option>`;
    const together = [opt('all', `All animals (${mapped()} species)`)]
      .concat(groups.filter((g) => mapped(g) > 1).map((g) => opt('g:' + g, `All ${g.toLowerCase()} (${mapped(g)})`)));
    const bySpecies = groups.map((g) => `<optgroup label="${esc(g)}">${R.species.filter((sp) => sp.group === g)
      .sort((a, b) => name(a).localeCompare(name(b)))
      .map((sp) => opt(sp.topic, name(sp) + (sp.cells ? '' : ' (Guarma only)'))).join('')}</optgroup>`);
    const panel = $('#rangePanel');
    panel.innerHTML = `
      <div class="rp-head">
        <span class="rp-ico">${ICONS.paw}</span>
        <div class="rp-pick">
          <label class="rp-label" for="rangeSel">Animal range</label>
          <select id="rangeSel"><optgroup label="Groups">${together.join('')}</optgroup>${bySpecies.join('')}</select>
        </div>
        <button class="rp-close" type="button" aria-label="Hide animal ranges">${ICONS.close}</button>
      </div>
      <div class="rp-legend"></div>
      <p class="rp-note" id="rpNote" aria-live="polite"></p>`;
    $('#rangeSel').addEventListener('change', (e) => showRange(e.target.value, { fit: true }));
    $('.rp-close', panel).addEventListener('click', hideRange);
    panel.addEventListener('click', (e) => { const b = e.target.closest('[data-topic]'); if (b) openTopic(b.dataset.topic, true); });
  }

  function showRange(key, opts = {}) {
    if (!S.ranges || !(key === 'all' || key.startsWith('g:') || S.ranges.has(key))) return;
    S.range = S.lastRange = key;
    if (!desktop.matches) setView('map');
    const multi = key === 'all' || key.startsWith('g:');
    const res = rangeDots(key);
    drawRange(key, res, multi);

    $('#rangePanel').hidden = false;
    $('#catList [data-ranges]')?.setAttribute('aria-pressed', 'true');
    $('#rangeSel').value = key;
    const dot = (t) => `<i class="rdot" style="--s:${(3 + 10 * t).toFixed(1)}px;opacity:${(0.35 + 0.65 * t).toFixed(2)}"></i>`;
    const legend = $('.rp-legend');
    legend.hidden = !res.dots.length;
    legend.innerHTML = multi
      ? `<span>1 species</span><span class="rp-dots">${[0.25, 0.5, 0.75, 1].map(dot).join('')}</span><span>${res.peak} species</span>`
      : `<span class="rp-dots">${dot(1)}</span><span>Where the guide marks it</span>`;
    let note;
    if (multi) note = "Bigger, stronger dots mean more species live there. From the guide's habitat maps, pp. 149–161.";
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
      <p>${esc(p.description || '')}</p>
      <div class="pc-src">${src}${p.approx ? '<span class="mono pc-approx">Approximate position</span>' : ''}</div>
      ${related.length ? `<div class="pc-topics"><h3>In the guide</h3>${related.map((tp) => `<button class="pc-link" type="button" data-topic="${esc(tp.id)}"><span>${esc(tp.title)}</span><span>${pageLabel(tp)}</span></button>`).join('')}</div>` : ''}`;
    card.hidden = false;
    card.scrollTop = 0;
    $('.pc-close', card).onclick = closePlace;
    card.onclick = (e) => { const b = e.target.closest('[data-topic]'); if (b) openTopic(b.dataset.topic, true); };
    history.replaceState(null, '', '#place=' + encodeURIComponent(id));
    if (p.x == null && !desktop.matches) setView('map');
  }

  function selectMarker(id) {
    if (S.selected) {
      const old = S.markerOf.get(S.selected);
      old?.setZIndexOffset?.(0);
      if (old?._icon) old._icon.classList.remove('is-sel');
    }
    S.selected = id;
    const mk = S.markerOf.get(id);
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
    if (!desktop.matches) setView('guide'); else setPanel('guide');
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
