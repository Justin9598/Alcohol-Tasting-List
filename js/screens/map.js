/* ---------------------------------------------------------------- maps */
let mapObj = null, shopMapObj = null;
/* THERE IS NO TILE SERVER. The basemap ships inside this file.

   Two providers were lost the same way. CARTO began requiring a key and served an
   "API KEY REQUIRED" watermark with HTTP 200. Then on 2026-10-27 OpenStreetMap blocked
   this machine and served a PNG reading "Access blocked", also with HTTP 200. Both
   decode as perfectly good images, so Leaflet fired tileload rather than tileerror and
   the careful fallback that used to sit here could never run. A status code and a valid
   image have now proved nothing twice.

   OSM was also unfixable in principle, not just in practice: its tile usage policy
   requires a valid Referer on web traffic and forbids stripping it, and a page opened
   from a file:// URL has no origin to send one from. This ledger could never comply
   however it was written. Esri's keyless endpoints are for licensed ArcGIS customers.

   So the basemap stopped being a service and became data: Natural Earth, public domain,
   generated into BASEMAP by tools/gen_basemap.py. No key, no terms, no rate limit and
   nothing left to block.

   Tiles came BACK on 2026-10-30, and the two layers now stack rather than replacing one
   another. What changed is the Referer: the ledger is served from a real https origin
   instead of opened from a file:// path, so the one requirement it could never meet is
   met by the hosting rather than by the code.

   The geometry stays underneath because the failure mode above has not changed and
   cannot be detected from script. Two providers were lost inside a month and both went
   silently. So the answer is not detection, it is that something real is still drawn
   when the tiles are wrong: BASEMAP renders into its own pane below the tile pane, is
   covered completely while the tiles are healthy, and is what the reader sees if they
   are ever blocked again. It costs nothing, being already in the file. */
function mapPalette(){
  const cs = getComputedStyle(document.documentElement);
  const v = (n, fb) => ((cs.getPropertyValue(n) || "").trim() || fb);
  return {sea: v("--sea", "#dde6ec"), land: v("--card", "#fbf9f3"),
          line: v("--line", "#ddd4c0")};
}
/* Canvas, not the default SVG: 465 rings as individual paths is a great deal of DOM for
   a backdrop nothing ever clicks. interactive:false so every click reaches the pin. */
function addBase(map){
  /* Leaflet's own panes start at tilePane 200, so 150 puts the geometry below the
     tiles and nothing else has to know about the ordering. The city labels go in the
     same pane: as markers they would default to markerPane at 600 and sit ON TOP of
     the tiles, doubling every name OSM already prints. */
  if(!map.getPane("basefill")) map.createPane("basefill").style.zIndex = 150;
  const pal = mapPalette(), rend = L.canvas({pane: "basefill", padding: .3});
  map.getContainer().style.background = pal.sea;
  const draw = (rings, weight, opacity) => rings.forEach(flat => {
    const ll = [];
    for(let i = 0; i < flat.length; i += 2) ll.push([flat[i + 1], flat[i]]);
    L.polygon(ll, {renderer: rend, interactive: false, color: pal.line, weight: weight,
                   opacity: opacity, fillColor: pal.land, fillOpacity: 1}).addTo(map);
  });
  draw(BASEMAP.w, 1, .9);                 // the world, for the Everywhere view
  draw(BASEMAP.r, 1, .9);                 // Korea, Taiwan, Singapore
  draw(BASEMAP.j, .8, .5);                // Japan: one set is coast AND prefecture lines
  /* A coastline with no names is hard to read, so these do the work the tile labels
     used to. They are markers rather than canvas so they stay crisp and upright. */
  BASEMAP.c.forEach(c => L.marker([c[2], c[1]], {pane: "basefill", interactive: false,
    keyboard: false,
    icon: L.divIcon({className: "map-lab", html: esc(c[0]), iconSize: null,
                     iconAnchor: [-5, 6]})}).addTo(map));
  map.attributionControl.addAttribution("Boundaries: Natural Earth");
}

/* The tile layer proper. Attribution is not decoration here: OSM's licence requires the
   credit and the link, which is why it is spelled out rather than shortened. */
function addTiles(map){
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" ' +
                 'target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(map);
}

let mapScope = "japan";               // "japan" or "all"
function buildMap(){
  const host = document.querySelector("#map-body");
  host.innerHTML = '<p class="lede">Every producer in the ledger that has a known address, ' +
    'pinned at town level. Click a pin for the bottles from that house.</p>' +
    '<div class="ctl-row"><span class="ctl-lab">Show</span><span id="map-scope"></span></div>' +
    '<div id="map"></div><p class="count" id="map-status"></p>';
  // Leaflet stamps the container, so clearing innerHTML alone is not enough: revisiting
  // the screen threw "Map container is already initialized".
  if(mapObj){ mapObj.remove(); mapObj = null; }
  pillRow("#map-scope", ["Japan", "Everywhere"], mapScope === "japan" ? "Japan" : "Everywhere",
          v => { mapScope = v === "Japan" ? "japan" : "all"; });
  document.querySelectorAll("#map-scope button").forEach(b =>
    b.addEventListener("click", () => buildMap()));
  const byProd = {};
  DATA.forEach(d => {
    if(!d.producer || !BREW_GEO[d.producer]) return;
    (byProd[d.producer] = byProd[d.producer] || []).push(d);
  });
  const keys = Object.keys(byProd);
  /* maxZoom was 10 while the map was geometry only, because a closer look showed a
     blank slab. Tiles have streets, so the ceiling goes back to OSM's own 18. In the
     degraded case the reader can now zoom past where the basemap has detail, which is
     the right way round: it costs nothing when the tiles are healthy. */
  mapObj = L.map("map", {scrollWheelZoom:false, minZoom:2, maxZoom:18})
            .setView([37.5, 137.5], 4);
  addBase(mapObj);
  addTiles(mapObj);
  const bounds = [];
  keys.forEach(k => {
    const c = BREW_GEO[k], rows = byProd[k], info = BREW_INFO[k];
    /* Fitting worldwide bounds shrinks Japan, where 128 of the 140 pinned producers are,
       to a smudge. So the default fit covers Japan only and the twelve overseas houses are
       still pinned, just outside the opening view. The test is the Country column, not the
       coordinates: a lat/lon box around Japan contains the whole Korean peninsula, so the
       seven Korean houses would read as Japanese. */
    const inJapan = rows.some(r => r.country === "Japan");
    if(mapScope === "all" || inJapan) bounds.push(c);
    const col = catCol(rows[0].cat);
    L.circleMarker(c, {radius: Math.min(11, 4 + rows.length), color: col, weight: 2,
                       fillColor: col, fillOpacity: .45})
      .addTo(mapObj)
      .bindPopup('<div class="pop-h">' + esc(k) + "</div>" +
        (info && (info.city || info.founded)
          ? '<div class="pop-b">' + esc([info.city, info.founded ? "founded " + info.founded : null]
              .filter(Boolean).join(" · ")) + "</div>" : "") +
        (info && info.note ? '<div class="pop-b">' + esc(String(info.note).slice(0, 230)) +
          (String(info.note).length > 230 ? "..." : "") + "</div>" : "") +
        '<ul class="pop-list">' + rows.map(r => "<li>" + esc(r.n) + "</li>").join("") + "</ul>",
        {maxWidth: 300});
  });
  if(bounds.length) mapObj.fitBounds(bounds, {padding:[28,28]});
  const abroad = keys.filter(k => !byProd[k].some(r => r.country === "Japan")).length;
  host.querySelector("#map-status").textContent =
    keys.length + " producers pinned, " +
    DATA.filter(d => d.producer && BREW_GEO[d.producer]).length + " of " + DATA.length +
    " bottles placed." +
    (mapScope === "japan" && abroad
      ? " " + abroad + " producers outside Japan are pinned too; choose Everywhere to see them."
      : "");
}
