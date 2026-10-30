function buildShops(){
  const host = document.querySelector("#shops-body");
  if(shopMapObj){ shopMapObj.remove(); shopMapObj = null; }
  /* "Unknown" is a sentinel for a purchase whose vendor was never recorded. It is not a
     shop, so it gets no card and no category heading here; the count is reported at the
     foot instead so the bottles are not simply unaccounted for. */
  const stats = {};
  let unknownBottles = {}, unknownRows = 0;
  DATA.forEach(d => d.purchases.forEach(p => {
    const v = p.vendor || "Unknown";
    if(v === "Unknown"){ unknownBottles[d.id] = 1; unknownRows++; return; }
    const s = stats[v] = stats[v] || {n:0, spend:0, bottles:{}};
    s.n++; s.bottles[d.id] = 1;
    if(p.price != null) s.spend += Math.round(p.price * 100);
  }));
  /* Grouped by SHOP_INFO.cat, the short category (Retail, Online, Events). `kind` is a
     long human description and makes one group per shop, which is no grouping at all.
     The Events category classifies vendors like Sake Matsuri that are festivals you
     bought FROM, and it stays. */
  const kinds = {};
  Object.keys(stats).forEach(v => {
    const c = (SHOP_INFO[v] || {}).cat || "Not recorded";
    (kinds[c] = kinds[c] || []).push(v);
  });
  host.innerHTML = '<p class="lede">Where it all came from: ' + Object.keys(stats).length +
    " places, grouped by what they are.</p>" +
    Object.keys(kinds).sort().map(k =>
      '<h2 class="sec">' + esc(k) + " <span style=\"font-size:var(--fs-sm);color:var(--ink-soft)\">" +
      kinds[k].length + "</span></h2><div class=\"shop-grid\">" +
      kinds[k].sort((a,b) => stats[b].spend - stats[a].spend).map(v => {
        const s = stats[v], info = SHOP_INFO[v] || {};
        return '<div class="shop"><h4>' + esc(info.name || v) + "</h4>" +
          '<div class="kind">' + esc(info.kind || "") + "</div>" +
          (info.addr ? "<p>" + esc(info.addr) + "</p>" : "") +
          '<div class="nums">' + Object.keys(s.bottles).length + " bottles · " +
          s.n + " purchase" + (s.n === 1 ? "" : "s") +
          (s.spend ? " · " + money(s.spend / 100) : " · nothing priced") + "</div></div>";
      }).join("") + "</div>").join("") +
    '<h2 class="sec">On the map</h2><div id="shopmap"></div>';
  const pts = Object.keys(stats).filter(v => {
    const i = SHOP_INFO[v];
    return i && typeof i.lat === "number" && typeof i.lng === "number";
  });
  if(pts.length){
    shopMapObj = L.map("shopmap", {scrollWheelZoom:false, minZoom:2, maxZoom:18})
                  .setView([1.3521, 103.8198], 10);
    addBase(shopMapObj);
    addTiles(shopMapObj);
    const b = [];
    pts.forEach(v => {
      const i = SHOP_INFO[v], g = [i.lat, i.lng];
      b.push(g);
      L.circleMarker(g, {radius: 6 + Math.min(5, Object.keys(stats[v].bottles).length / 6),
                         color: "#54648a", weight:2, fillColor:"#54648a", fillOpacity:.45})
        .addTo(shopMapObj)
        .bindPopup('<div class="pop-h">' + esc(i.name || v) + "</div>" +
          '<div class="pop-b">' + esc(i.kind || "") + "</div>" +
          '<div class="pop-b">' + Object.keys(stats[v].bottles).length + " bottles · " +
          stats[v].n + " purchases" +
          (stats[v].spend ? " · " + money(stats[v].spend / 100) : "") + "</div>");
    });
    shopMapObj.fitBounds(b, {padding:[28,28]});
  }
  host.insertAdjacentHTML("beforeend",
    '<p class="count">' + pts.length + " of " + Object.keys(stats).length +
    " places have coordinates; online shops have none." +
    (unknownRows
      ? " A further " + unknownRows + " purchase" + (unknownRows === 1 ? "" : "s") +
        " across " + Object.keys(unknownBottles).length +
        " bottles have no vendor recorded, so they are not shown here."
      : "") + "</p>");
}
