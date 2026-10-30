/* --------------------------------------------------------- spending
   Three sections only: where the money goes by vendor, taste profile trends, and a
   few more things worth knowing. The stat tiles, butterfly chart, best-value-by-grade
   and priciest-splurges blocks were removed from v1 on request. Do not reintroduce them.
   v1 excluded Umeshu and Beer outright to stop them distorting spend per sake; with
   eight categories that becomes GROUPING by category, which is more useful. */
function buildPrice(){
  const host = document.querySelector("#price-body");
  const rows = [];
  DATA.forEach(d => d.purchases.forEach(p => {
    if(p.price != null) rows.push({d:d, p:p, cents: Math.round(p.price * 100)});
  }));
  const total = rows.reduce((a,r) => a + r.cents, 0);

  const byCat = {};
  rows.forEach(r => { byCat[r.d.cat] = (byCat[r.d.cat] || 0) + r.cents; });
  const catKeys = Object.keys(byCat).sort((a,b) => byCat[b] - byCat[a]);
  const catBar = '<div class="catbar">' + catKeys.map(c =>
    '<i style="width:' + (byCat[c] / total * 100).toFixed(2) + "%;background:" + catCol(c) + '"></i>').join("") +
    '</div><div class="catkey">' + catKeys.map(c =>
    '<span><i style="background:' + catCol(c) + '"></i>' + esc(c) + " " + money(byCat[c] / 100) +
    " (" + (byCat[c] / total * 100).toFixed(0) + "%)</span>").join("") + "</div>";

  const byVendor = {};
  rows.forEach(r => {
    const v = r.p.vendor || "Unknown";
    const s = byVendor[v] = byVendor[v] || {cents:0, n:0, ids:{}, rows:[]};
    s.cents += r.cents; s.n++; s.ids[r.d.id] = 1; s.rows.push(r);
  });
  const vkeys = Object.keys(byVendor).sort((a,b) => byVendor[b].cents - byVendor[a].cents);
  const maxV = byVendor[vkeys[0]].cents;

  const vendorBlocks = vkeys.map((v,i) => {
    const s = byVendor[v];
    const sorted = s.rows.slice().sort((a,b) => a.cents - b.cents);
    const cheap = sorted[0], dear = sorted[sorted.length - 1];
    const favs = Object.keys(s.ids).filter(id => BY_ID[id].fav);
    return '<div class="pv" data-i="' + i + '">' +
      '<button class="pv-head" type="button" aria-expanded="false" aria-controls="pv-body-' + i + '">' +
        '<span class="pv-top"><span class="pv-name">' + esc(v) + "</span>" +
        '<span class="pv-spend">' + money(s.cents / 100) + "</span></span>" +
        '<div class="pv-sub">' + (s.cents / total * 100).toFixed(1) + "% of spend · " +
          Object.keys(s.ids).length + " bottles · " + s.n + " purchases" +
          (favs.length ? " · " + favs.length + " favourite" + (favs.length > 1 ? "s" : "") : "") +
        "</div>" +
        '<div class="pv-bar"><i style="width:' + (s.cents / maxV * 100).toFixed(1) +
          "%;background:var(--indigo-soft)\"></i></div>" +
        '<div class="pv-sub">cheapest ' + esc(cheap.d.n) + " at " + money(cheap.cents / 100) +
          " · dearest " + esc(dear.d.n) + " at " + money(dear.cents / 100) + "</div>" +
      "</button>" +
      '<div class="pv-cols" id="pv-body-' + i + '">' +
        '<div class="pv-col"><h5>Every purchase</h5><ul>' +
          sorted.slice().reverse().map(r => "<li>" + esc(r.d.n) + " · " +
            money(r.cents / 100) + "</li>").join("") + "</ul></div>" +
        '<div class="pv-col"><h5>By category</h5><ul>' +
          (function(){
            const m = {}; s.rows.forEach(r => { m[r.d.cat] = (m[r.d.cat] || 0) + r.cents; });
            return Object.keys(m).sort((a,b) => m[b] - m[a]).map(c =>
              "<li>" + esc(c) + " · " + money(m[c] / 100) + "</li>").join("");
          })() + "</ul></div>" +
      "</div></div>";
  }).join("");

  // Taste profile trends: what the spending actually bought, by derived axis.
  const axisSpend = {};
  ["sweet","body","aroma","texture","sharp"].forEach(ax => {
    const m = {};
    rows.forEach(r => {
      const g = flavourProfile(r.d)[ax];
      if(g) m[FP_LABEL[ax][g.v] || g.v] = (m[FP_LABEL[ax][g.v] || g.v] || 0) + r.cents;
    });
    axisSpend[ax] = m;
  });
  const trends = ["sweet","body","aroma","texture","sharp"].map(ax => {
    const m = axisSpend[ax], keys = Object.keys(m).sort((a,b) => m[b] - m[a]);
    if(!keys.length) return "";
    const sum = keys.reduce((a,k) => a + m[k], 0);
    return '<div class="bar-row"><span>' + esc(keys[0]) + "</span>" +
      '<span class="bar-track"><span class="bar-fill" style="width:' +
      (m[keys[0]] / sum * 100).toFixed(1) + '%;background:var(--celadon)"></span></span>' +
      '<span class="bar-num">' + (m[keys[0]] / sum * 100).toFixed(0) + "%</span></div>";
  }).join("");

  // A few more things worth knowing.
  const pourRows = rows.filter(r => isPourSize(r.p.size));
  const bottleRows = rows.filter(r => !isPourSize(r.p.size));
  const avg = rs => rs.length ? money(rs.reduce((a,r) => a + r.cents, 0) / rs.length / 100) : "n/a";
  const unpriced = DATA.reduce((a,d) => a + d.purchases.filter(p => p.price == null).length, 0);
  const noVendorBlock = Object.keys(byVendor).length;
  const allVendors = new Set();
  DATA.forEach(d => d.purchases.forEach(p => allVendors.add(p.vendor || "Unknown")));

  host.innerHTML =
    '<p class="lede">Every purchase that carries a price. ' + rows.length + " of " +
      DATA.reduce((a,d) => a + d.purchases.length, 0) + " purchase rows are priced, so these " +
      "figures are a floor, not a total.</p>" +
    '<h2 class="sec">Where the money goes by category</h2>' + catBar +
    '<h2 class="sec">Where the money goes by vendor</h2>' +
    '<p class="count">Each block opens for the full list. ' + nonePriced(allVendors.size, noVendorBlock) +
    "</p>" + vendorBlocks +
    '<h2 class="sec">Taste profile trends</h2>' +
    '<p class="count">The dominant value on each derived axis, by share of spend.</p>' +
    '<div class="chart-wrap"><div class="bars">' + trends + "</div></div>" +
    '<h2 class="sec">A few more things worth knowing</h2>' +
    '<div class="chart-wrap"><ul style="margin:0;padding-left:17px;line-height:1.85">' +
      "<li>Bottles average " + avg(bottleRows) + " across " + bottleRows.length +
        " purchases; tasting pours average " + avg(pourRows) + " across " + pourRows.length + ".</li>" +
      "<li>" + unpriced + " purchase rows carry no price at all, so the real total is higher.</li>" +
      "<li>The dearest single purchase is " + esc(rows.slice().sort((a,b) => b.cents - a.cents)[0].d.n) +
        " at " + money(rows.slice().sort((a,b) => b.cents - a.cents)[0].cents / 100) + ".</li>" +
      "<li>" + catKeys.length + " of the eight categories have any spend recorded against them.</li>" +
    "</ul></div>";

  /* Handlers bound AFTER the innerHTML write, so a screen rebuild rebinds cleanly
     rather than double firing. */
  host.querySelectorAll(".pv-head").forEach(btn => {
    btn.addEventListener("click", () => {
      const open = btn.parentElement.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });
}
/* A vendor whose purchases are all unpriced gets no block here, though it still
   appears on the Shops screen. Say so rather than leaving an unexplained gap. */
function nonePriced(allN, blockN){
  const missing = allN - blockN;
  return missing > 0
    ? missing + " of the " + allN + " places you have bought from have no priced purchase, " +
      "so they appear on the Shops screen but not here."
    : "";
}
