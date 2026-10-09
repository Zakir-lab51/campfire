# Campfire: RDR2 field companion

An unofficial, searchable companion to *Red Dead Redemption 2: The Complete Official Guide* (Piggyback, 2018).
Facts and summaries are written in our own words, and every topic shows the guide page it comes from.

- **Search** (Fuse.js): fuzzy, typo-tolerant search across every topic and place, with live results.
- **Map** (Leaflet, `CRS.Simple`): Jotrius's J10 Railroad Engineer map of RDR2, used with permission. It's lined up with the guide's atlas positions and carries 800 teardrop pins, each showing a picture of its category.
- **Categories sidebar**: every pin category grouped with counts, plus *Show all* / *Hide all*, place names and the atlas grid. On phones it opens as a drawer from the *Categories* button.
- **Animal ranges**: where each of the 76 Field Guide species lives, shown as red patches the way the guide's habitat maps (pp. 149–161) mark them. The "all animals", mammal, bird, reptile and livestock views show red dots instead, bigger where more species overlap. Open them from the map's *Animal ranges* chip, an animal topic's *Range on map* button, or by searching a species name.
- **Browse**: contents, collapsible chapters and category filters.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page structure; loads Leaflet and Fuse.js from CDNs |
| `style.css` | All styling (dark theme, mobile first) |
| `script.js` | Search, map and browse logic; reads everything from `data.json` |
| `data.json` | **All content.** Edit this to update the site |
| `tiles/` | The base map as 256 px WebP tiles at six zoom levels (`tiles/{zoom}/{x}/{y}.webp`, zoom −2 to 3 = ¼ to 8 pixels per map unit). The map's coordinate space is 2240 × 1680 units, and one atlas cell is 224 × 280 units |

## Preview locally

The page loads `data.json` with `fetch`, so it must be served over HTTP. Opening `index.html` straight from disk won't work.

## Updating content (`data.json`)

- `sections[]` → `topics[]`. Each topic has `id`, `title`, `text`, `category`, `keywords`, `page` (and optional `page_end`) and an optional `location` (a place `id`).
  - In `text`, `\n` starts a new line, `- ` makes a bullet, `1. ` makes a numbered step, a short line ending in `:` becomes a small heading, and `Tip:` makes a callout.
- `places[]`: `id`, `name`, `type`, `description`, `topics` (topic ids), `x`/`y` in map units (the 2240 × 1680 space, top-left origin; `null` = not on the map), `cell` and `atlasPage`. `approx: true` shows an "Approximate position" note.
- `categories`, `layers` (the sidebar's pin categories; `default: true` = on at first load) and `quickSearch` (the chips under the search bar).
- `map.states`: the five state names drawn on the map (`name`, `x`, `y`). Towns, regions, rivers, lakes, camps and landmarks are labelled from `places`.
- `ranges`: animal habitat grids. The map is split into `cols` × `rows` cells of `cell` map units (140 × 105 cells of 16 units). Each entry in `species` has:
  - `topic`: the animal topic it belongs to
  - `group`: Mammals, Birds, Reptiles & amphibians, Livestock or Other
  - `page`: the guide page of its habitat map
  - `guarma`: also found on Guarma, which isn't on this map
  - `cells`: how many cells it covers
  - `grid`: a base64 bitmask, row by row, where a set bit means the guide marks the species in that cell.

  The grids were made by lining each guide habitat map up with this map, using the shapes of the lakes and rivers.

Topic and place ids are used in share links (`#topic=…`, `#place=…`, `#range=animal-wolf`, `#range=all`, `#range=g:Birds`), so keep them stable.

## Disclaimer

Fan-made. Not affiliated with Rockstar Games, Take-Two Interactive or Piggyback.
No text, maps or images from the guide are reproduced. The base map is Jotrius's J10 Railroad Engineer map, used with permission. Its elevation is estimated from how steep the guide's atlas shows the ground, so heights are indicative rather than exact. Positions come from the guide's atlas.
