# Campfire: RDR2 field companion

An unofficial, searchable companion to *Red Dead Redemption 2: The Complete Official Guide* (Piggyback, 2018).
Facts and summaries are written in our own words, and every topic shows the guide page it comes from.

- **Search** (Fuse.js): fuzzy, typo-tolerant search across every topic and place, with live results.
- **Map** (Leaflet, `CRS.Simple`): Jotrius's J10 Railroad Engineer map of RDR2, used with permission. It's lined up with the guide's atlas positions and carries 800 teardrop pins, each showing a picture of its category.
- **Categories sidebar**: every pin category grouped with counts, plus *Show all* / *Hide all* and the atlas grid. On wide screens, a tab on the map's left edge folds the panel away for a full-screen map. On phones it opens as a drawer from the *Categories* button.
- **Animal ranges**: where each of the 76 Field Guide species lives, shown as red patches the way the guide's habitat maps (pp. 149–161) mark them. The "all animals", mammal, bird, reptile and livestock views show red dots instead, bigger where more species overlap. Open them from the map's *Animal ranges* chip, an animal topic's *Range on map* button, or by searching a species name.
- **Plants & herbs**: where the 26 herbs, berries and mushrooms of the guide's Items chapter (pp. 305–306) grow, in green. The guide has no plant maps, only a line on where each one grows, so these areas are drawn from that line: the regions or states it names, narrowed to riverbanks, the railway or a named river where it says so. They're approximate, and the panel says so. Five plants the guide only describes as growing almost everywhere get no area. Open them from the sidebar's *Plants & herbs* row or by searching a plant's name.
- **Progress tracker**: tick off places as you find them, with *Mark as found* on a place's card, or by right-clicking its pin (press and hold on a phone). Found pins fade and get a green tick, and *Hide found* takes them off the map. The sidebar shows overall progress and found / total for each category. Progress is saved in the browser (`localStorage` key `campfire:found`, a list of place ids). *Export* saves it as `campfire-progress.json`, *Import* adds a saved file back, and *Reset* clears it.
- **100% checklist** (the *100%* tab): all 490 tasks for 100% completion, chapter by chapter in a route that avoids backtracking, with tick boxes, progress per chapter and overall, a *Next up* pointer, filters (story, side quests, challenges, collectibles, prep) and *Hide done*. The route and its video guides are from Jimbatron's [RDR2 100% Completion Strategy Guide](https://gtaforums.com/topic/922595-rdr2-100-completion-strategy-guide/) on GTAForums. Campfire keeps the task names, places, order and video links, and writes its own summaries and tips. Tasks tied to a map pin (legendary animals and fish, bounties, gang hideouts) tick and untick together with that pin. Ticks are saved in the browser (`campfire:done`) and included in the progress *Export* / *Import*.
- **Browse**: contents, collapsible chapters and category filters.
- **Home-screen app (iPad first)**: in Safari, *Share → Add to Home Screen* installs Campfire as an app with its own icon and parchment launch screens (`manifest.webmanifest`, `icons/`). Any iPad, portrait or landscape, gets the side panel next to the map (phones keep one view at a time, even turned sideways). Press and hold a pin to mark it found. Tap targets grow on touch screens, controls stay clear of the home indicator, and the installed app doesn't bounce or zoom by accident. *Export* uses the share sheet on iPad and iPhone. The service worker keeps the page, libraries and fonts so the app opens instantly and works offline. Note that an installed app keeps its own saved progress, separate from Safari's; use *Export* / *Import* to move it.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page structure; loads Leaflet and Fuse.js from CDNs |
| `style.css` | All styling (parchment theme, mobile first) |
| `script.js` | Search, map and browse logic; reads everything from `data.json` |
| `data.json` | **All content.** Edit this to update the site |
| `ranges.json` | Animal-range and plant-area shapes, loaded on demand (see below) |
| `manifest.webmanifest`, `icons/` | Home-screen app name, icons (180 px Apple touch icon, 192/512 px, a maskable 512 px) and iPad launch screens, drawn by the scratch script `app/icons.py` |
| `hundred.json` | The 100% checklist, loaded when its tab first opens: `source`, `requirements`, `covered`, `natural`, `tips`, and `chapters[] → parts[] → tasks[]`. A task has `id` (stable, used for ticks and `#hundred=<id>` links), `t` (type label), `k` (kind: story, side, challenge, collect, prep, optional), `n` (name), and optionally `w` (where), `tip`, `v` (video links), `tp` (a guide topic id), `p` (a place id it shares a tick with) and `c` (a pin category whose found count it shows). Optional tasks don't count towards the total |
| `sw.js` | Service worker. Map tiles and `ranges.json` are versioned (`?v=` from `data.json` → `map.v` / `map.rangesV`) and served cache first. The page, `data.json`, `hundred.json`, the manifest and icons are network first, with the saved copy used offline or when the network is slow. CDN libraries and fonts are cache first |
| `tiles/` | The base map as 256 px WebP tiles at six zoom levels (`tiles/{zoom}/{x}/{y}.webp`, zoom −2 to 3 = ¼ to 8 pixels per map unit), plus `backdrop.webp`, a small picture of the whole map that sits under the tiles so the map never shows blank areas while tiles load. The map's coordinate space is 2240 × 1680 units, and one atlas cell is 224 × 280 units |

## Preview locally

The page loads `data.json` with `fetch`, so it must be served over HTTP. Opening `index.html` straight from disk won't work.

## Updating content (`data.json`)

- `sections[]` → `topics[]`. Each topic has `id`, `title`, `text`, `category`, `keywords`, `page` (and optional `page_end`) and an optional `location` (a place `id`).
  - In `text`, `\n` starts a new line, `- ` makes a bullet, `1. ` makes a numbered step, a short line ending in `:` becomes a small heading, and `Tip:` makes a callout.
- `places[]`: `id`, `name`, `type`, `description`, `topics` (topic ids), `x`/`y` in map units (the 2240 × 1680 space, top-left origin; `null` = not on the map), `cell` and `atlasPage`. `approx: true` shows an "Approximate position" note.
- `categories`, `layers` (the sidebar's pin categories; `default: true` = on at first load) and `quickSearch` (the chips under the search bar).
- `ranges`: the animal-range species list. Each entry in `species` has:
  - `topic`: the animal topic it belongs to
  - `group`: Mammals, Birds, Reptiles & amphibians, Livestock or Other
  - `page`: the guide page of its habitat map
  - `guarma`: also found on Guarma, which isn't on this map
  - `cells`: how many grid cells it covers (0 = Guarma only)

  The shapes themselves are in `ranges.json`, which the page loads the first time a range is opened. The same species also carry:
  - `rings`: the range outline as polygons, in half map units, delta-encoded (`[x0, y0, dx1, dy1, …]`).
  - `rle`: a grid of `cols` × `rows` cells of `cell` map units (560 × 420 cells of 4 units), run-length encoded. Each entry is an alternating off/on run, row by row, as LEB128 varints, then base64. The "all animals" and group views count species from this grid.

  Both come from the guide's habitat maps (pp. 149–161). Each map is lined up with this map by the shapes of its lakes and rivers, with its own scale and offset. A cell is in a range when at least half of it is red on the guide's map.

  Plants are in the same list with `kind: "plant"`, `group: "Plants"`, a `name`, `where` (the guide's description in our words), `page` (305 or 306) and `ref` (the topic to open: `herbs` or `provisions`). `spread: true` marks a plant the guide says grows almost everywhere: it has no shape and `cells` is 0. Plant areas use the same `rings` / `rle` format. They're drawn from the guide's descriptions on hand-traced region and state borders (snapped to the rivers where a border follows one), cut to the land inside the map's outer border.

Topic and place ids are used in share links (`#topic=…`, `#place=…`, `#range=animal-wolf`, `#range=all`, `#range=g:Birds`, `#range=plants`, `#range=plant-yarrow`). Saved progress uses place ids too, so keep them stable.

## Disclaimer

Fan-made. Not affiliated with Rockstar Games, Take-Two Interactive or Piggyback.
No text, maps or images from the guide are reproduced. The base map is Jotrius's J10 Railroad Engineer map, used with permission. Its elevation is estimated from how steep the guide's atlas shows the ground, so heights are indicative rather than exact. Positions come from the guide's atlas.
