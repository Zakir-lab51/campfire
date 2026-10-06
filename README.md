# Campfire: RDR2 field companion

An unofficial, searchable companion to *Red Dead Redemption 2: The Complete Official Guide* (Piggyback, 2018).
Facts and summaries are written in our own words, and every topic shows the guide page it comes from.

- **Search** (Fuse.js): fuzzy, typo-tolerant search across every topic and place, with live results.
- **Map** (Leaflet, `CRS.Simple`): an original topographic map (elevation tints, hill shading, contour lines) with 800 pins from the guide's atlas.
- **Browse**: contents, collapsible chapters and category filters.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page structure; loads Leaflet and Fuse.js from CDNs |
| `style.css` | All styling (dark theme, mobile first) |
| `script.js` | Search, map and browse logic; reads everything from `data.json` |
| `data.json` | **All content.** Edit this to update the site |
| `map.jpg` | The topographic map image, 3360 × 2520 px. It's drawn at 1.5× the map's 2240 × 1680 coordinate space (one atlas cell = 224 × 280 units), so it stays sharp when zoomed in |

## Preview locally

The page loads `data.json` with `fetch`, so it must be served over HTTP. Opening `index.html` straight from disk won't work.

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Updating content (`data.json`)

- `sections[]` → `topics[]`. Each topic has `id`, `title`, `text`, `category`, `keywords`, `page` (and optional `page_end`) and an optional `location` (a place `id`).
  - In `text`, `\n` starts a new line, `- ` makes a bullet, `1. ` makes a numbered step, a short line ending in `:` becomes a small heading, and `Tip:` makes a callout.
- `places[]`: `id`, `name`, `type`, `description`, `topics` (topic ids), `x`/`y` in map units (the 2240 × 1680 space, top-left origin; `null` = not on the map), `cell` and `atlasPage`. `approx: true` shows an "Approximate position" note.
- `categories`, `layers` (map filter chips; `default: true` = on at first load) and `quickSearch` (the chips under the search bar).

Topic and place ids are used in share links (`#topic=…`, `#place=…`), so keep them stable.

## Disclaimer

Fan-made. Not affiliated with Rockstar Games, Take-Two Interactive or Piggyback.
No text, maps or images from the guide are reproduced. The map is an original drawing. Its elevation is estimated from how steep the guide's atlas shows the ground, so heights are indicative rather than exact. Positions come from the guide's atlas.
