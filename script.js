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

  /* ---------- look of each place type ---------- */
  const TYPES = {
    town:            { label: 'Town',              color: '#f2e6d0', named: true,  labelled: 'always' },
    camp:            { label: 'Gang camp',         color: '#e07a2e', named: true,  labelled: 'always' },
    landmark:        { label: 'Landmark',          color: '#d9c08c', named: true,  labelled: 'near' },
    area:            { label: 'Region',            color: '#a99f8d', named: true,  labelled: 'mid' },
    water:           { label: 'Lake or river',     color: '#7fb6c7', named: true,  labelled: 'mid' },
    legendary:       { label: 'Legendary animal',  color: '#e25d4a', named: true,  diamond: true },
    'legendary-fish':{ label: 'Legendary fish',    color: '#5fb3c9', named: true,  diamond: true },
    hideout:         { label: 'Gang hideout',      color: '#c9504a', named: true },
    stranger:        { label: 'Stranger',          color: '#b49be0', named: true },
    special:         { label: 'Special character', color: '#d48fc4', named: true },
    bounty:          { label: 'Bounty target',     color: '#e0b04a', named: true },
    treasure:        { label: 'Treasure',          color: '#f2cc5a', named: true,  diamond: true },
    shop:            { label: 'Trapper / fence',   color: '#9bbf73', named: true },
    poi:             { label: 'Point of interest', color: '#c7a77a', named: true },
    shack:           { label: 'Shack',             color: '#b08a62', named: true },
    card:            { label: 'Cigarette card',    color: '#e8c770' },
    bone:            { label: 'Dinosaur bone',     color: '#e6dcc8' },
    carving:         { label: 'Rock carving',      color: '#c2b49a' },
    dreamcatcher:    { label: 'Dreamcatcher',      color: '#c48be6' },
    chest:           { label: 'Chest / lock box',  color: '#e09a4f' },
    tonic:           { label: 'Special tonic',     color: '#6fd0a0' },
    unique:          { label: 'Unique item',       color: '#f07f6a' },
    request:         { label: 'Item request',      color: '#8fb8e8' },
    orchid:          { label: 'Orchid',            color: '#e78fb3' },
    'gator-egg':     { label: 'Gator eggs',        color: '#b9d27a' },
  };
  const ICONS = {
    topic: '<svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5z"/><path d="M8 10h8M8 14h8M8 18h5"/></svg>',
    place: '<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',
    map: '<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };

  const S = {
    data: null, fuse: null,
    topics: new Map(), places: new Map(), sectionOf: new Map(), catColor: new Map(),
    activeCats: new Set(),
    map: null, H: 0, W: 0, layerGroups: new Map(), markerOf: new Map(), selected: null,
    hitLayer: null, gridLayer: null, mapReady: false, view: 'guide',
    results: [], activeResult: -1,
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
      if (e.key === 'Escape') { if (!$('#results').hidden) showResults(false); else closePlace(); }
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
    box.innerHTML = placesFirst ? pGroup + tGroup : tGroup + pGroup;
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
      <span class="result-ico">${isTopic ? ICONS.topic : ICONS.place}</span>
      <span><span class="result-title">${title}</span><span class="result-snip">${snip}</span></span>
      <span class="result-meta">${esc(meta)}</span>
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
    else showPlace(el.dataset.id, true);
  }

  /* ---------- views (phones switch, desktop shows both) ---------- */
  function bindViews() {
    $$('.viewtabs [data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    desktop.addEventListener?.('change', () => S.map && setTimeout(() => S.map.invalidateSize(), 50));
  }

  function setView(v) {
    S.view = v;
    $('#layout').dataset.view = v;
    $$('.viewtabs [data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    if (v === 'map' && S.map) requestAnimationFrame(() => {
      if (!S.mapShown) { S.mapShown = true; if (!S.selected) { homeView(); return; } }
      ensureView();
    });
  }

  /* ---------- map ---------- */
  function initMap() {
    const m = S.data.map; S.H = m.height; S.W = m.width;
    const bounds = [[-S.H, 0], [0, S.W]];
    const map = L.map('map', {
      crs: L.CRS.Simple, minZoom: -3, maxZoom: 2, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 90,
      attributionControl: false, zoomControl: false, preferCanvas: true, renderer: L.canvas({ tolerance: 9 }),
    });
    S.map = map;
    L.imageOverlay(m.image, bounds, { className: 'base-map' }).addTo(map);
    map.setMaxBounds(L.latLngBounds(bounds).pad(0.2));
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    S.homeBounds = bounds;
    homeView();
    // The container may get its final size after fonts/header settle; refit once it has.
    requestAnimationFrame(() => { map.invalidateSize(); homeView(); });
    map.on('zoomend', zoomClass); zoomClass();
    map.on('click', () => closePlace());

    const visible = new Set(store.get('layers', null) || S.data.layers.filter((l) => l.default).map((l) => l.id));
    for (const l of S.data.layers) S.layerGroups.set(l.id, L.layerGroup());
    for (const p of S.data.places) {
      if (p.x == null) continue;
      const mk = makeMarker(p);
      S.markerOf.set(p.id, mk);
      (S.layerGroups.get(p.type) || S.layerGroups.get('landmark')).addLayer(mk);
    }
    for (const [id, g] of S.layerGroups) if (visible.has(id)) g.addTo(map);
    S.hitLayer = L.layerGroup().addTo(map);
    S.gridLayer = buildGrid();
    renderLayerbar(visible);
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

  function makeMarker(p) {
    const t = TYPES[p.type] || TYPES.landmark;
    if (!t.named) {
      const mk = L.circleMarker(ll(p), { radius: S.dotRadius || 3, color: '#0f1013', weight: 1.2, fillColor: t.color, fillOpacity: 0.95 });
      mk.on('click', (e) => { L.DomEvent.stop(e); onMarker(p); });
      return mk;
    }
    const lbl = t.labelled ? `<span class="mk-label">${esc(p.name)}</span>` : '';
    const icon = L.divIcon({
      className: `mk mk-${p.type}`, iconSize: [26, 26], iconAnchor: [13, 13],
      html: `<span class="mk-pin${t.diamond ? ' diamond' : ''}" style="--c:${t.color}"></span>${lbl}`,
    });
    const mk = L.marker(ll(p), { icon, title: p.name, keyboard: true, riseOnHover: true });
    mk.on('click', (e) => { L.DomEvent.stop(e); onMarker(p); });
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

  function zoomClass() {
    const z = S.map.getZoom();
    const el = S.map.getContainer();
    const band = z < -1.6 ? 'far' : z < -0.25 ? 'mid' : 'near';
    if (el.dataset.z === band) return;
    el.dataset.z = band;
    // Collectible dots are canvas circles: resize them with the zoom band.
    S.dotRadius = band === 'far' ? 2.6 : band === 'mid' ? 3.8 : 5.5;
    for (const [id, mk] of S.markerOf) if (mk.setRadius && id !== S.selected) mk.setRadius(S.dotRadius);
  }

  function renderLayerbar(visible) {
    const counts = new Map();
    for (const p of S.data.places) if (p.x != null) counts.set(p.type, (counts.get(p.type) || 0) + 1);
    const chips = S.data.layers.filter((l) => counts.get(l.id)).map((l) => {
      const c = (TYPES[l.id] || {}).color || '#e07a2e';
      return `<button class="chip" type="button" data-layer="${l.id}" aria-pressed="${visible.has(l.id)}" style="--c:${c}"><span class="dot"></span>${esc(l.label)} <span class="n">${counts.get(l.id)}</span></button>`;
    });
    chips.push(`<button class="chip" type="button" data-grid aria-pressed="false"><span class="dot" style="--c:#a99f8d"></span>Atlas grid</button>`);
    const bar = $('#layerbar');
    bar.innerHTML = chips.join('');
    bar.addEventListener('click', (e) => {
      const g = e.target.closest('[data-grid]');
      if (g) { const on = g.getAttribute('aria-pressed') !== 'true'; g.setAttribute('aria-pressed', String(on)); on ? S.gridLayer.addTo(S.map) : S.gridLayer.remove(); return; }
      const b = e.target.closest('[data-layer]'); if (!b) return;
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      const grp = S.layerGroups.get(b.dataset.layer);
      on ? grp.addTo(S.map) : grp.remove();
      store.set('layers', $$('#layerbar [data-layer][aria-pressed="true"]').map((x) => x.dataset.layer));
    });
  }

  function ensureLayer(type) {
    const grp = S.layerGroups.get(type);
    if (grp && !S.map.hasLayer(grp)) {
      grp.addTo(S.map);
      $(`#layerbar [data-layer="${type}"]`)?.setAttribute('aria-pressed', 'true');
    }
  }

  function buildGrid() {
    const m = S.data.map; const g = L.layerGroup();
    const style = { color: '#eadfcb', weight: 1, opacity: 0.16, interactive: false, dashArray: '4 6' };
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
      if (old?._icon) old._icon.classList.remove('is-sel');
      else if (old?.setStyle) { old.setStyle({ weight: 1.2, color: '#0f1013' }); old.setRadius(S.dotRadius || 3); }
    }
    S.selected = id;
    const mk = S.markerOf.get(id);
    if (mk?._icon) mk._icon.classList.add('is-sel');
    else if (mk?.setStyle) { mk.setStyle({ weight: 3, color: '#f4a259' }); mk.setRadius(8); mk.bringToFront(); }
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
    if (!desktop.matches) setView('guide');
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
  }

  function copyLink(kind, id, btn) {
    const url = `${location.origin}${location.pathname}#${kind}=${encodeURIComponent(id)}`;
    const done = () => { const old = btn.innerHTML; btn.textContent = 'Copied'; setTimeout(() => { btn.innerHTML = old; }, 1400); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, () => prompt('Copy this link:', url));
    else prompt('Copy this link:', url);
  }

  const smooth = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  // Scroll so the element sits just below the sticky header. Long jumps skip the smooth animation.
  function scrollToEl(el) {
    const header = $('#topbar').offsetHeight;
    const target = el.getBoundingClientRect().top + window.scrollY - header - 12;
    const far = Math.abs(target - window.scrollY) > window.innerHeight * 3;
    window.scrollTo({ top: target, behavior: far ? 'auto' : smooth() });
  }
})();
