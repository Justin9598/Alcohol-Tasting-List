/* ------------------------------------------------------------- charts
   The two v1 chart screens are merged into one. The sweetness by acidity plot
   stays SAKE SCOPED, because SMV and acidity are sake lab values, and it now also
   reads a WSET note, so every tasting note filled widens it. */
const SAT_SWEET = {"dry":8, "off-dry":4, "medium-dry":2, "medium-sweet":-2,
                   "sweet":-6, "luscious":-10};
const SAT_ACID = {"low":1.1, "medium(-)":1.3, "medium":1.5, "medium(+)":1.7, "high":1.9};

function chartPoint(d){
  const D = det(d);
  let smv = D.smv, acid = D.acidity, src = "measured";
  if(smv == null && d.sat && SAT_SWEET[d.sat.sweet] != null){ smv = SAT_SWEET[d.sat.sweet]; src = "note"; }
  if(acid == null && d.sat && SAT_ACID[d.sat.acid] != null){ acid = SAT_ACID[d.sat.acid]; src = "note"; }
  return smv != null && acid != null ? {d:d, smv:smv, acid:acid, src:src} : null;
}

let chartColourBy = "Grade";     // Category is degenerate here, see the note below
function buildChart(){
  const host = document.querySelector("#chart-body");
  const pool = DATA.filter(d => d.cat === "Sake" || d.cat === "Craft Sake");
  const pts = pool.map(chartPoint).filter(Boolean);
  const W = 720, H = 420, M = {t:22, r:22, b:46, l:56};
  const xs = pts.map(p => p.smv), ys = pts.map(p => p.acid);
  /* SMV zero sits dead centre, so the axis is symmetric. The bound cannot simply be the
     largest value: two genuinely extreme sweets (a honey-yeast junmai at -70 and the
     Awayuki sparkling at -58) would stretch it to plus or minus 70 and squash the other
     sixty bottles into a thumbnail. So the bound covers the bulk and anything beyond it
     is PINNED TO THE EDGE and drawn hollow, never dropped, with the caption naming them.

     The bound is the largest value inside a fixed sanity limit of 25, NOT a percentile.
     A percentile tracks the data and pinned Akishika at -20, which is an ordinary sweet
     sake; 25 is already outside the normal SMV range, so only the genuinely absurd
     clamps. */
  const SANE = 25;
  const inside = xs.filter(v => Math.abs(v) <= SANE);
  const widest = inside.length ? Math.max.apply(null, inside.map(Math.abs)) : 12;
  const BOUND = Math.max(12, Math.ceil(widest / 2) * 2);
  const x0 = -BOUND, x1 = BOUND;
  const y0 = Math.min(1.0, Math.min.apply(null, ys) - .1), y1 = Math.max(2.2, Math.max.apply(null, ys) + .1);
  const clamp = v => Math.max(x0, Math.min(x1, v));
  const px = v => M.l + (clamp(v) - x0) / (x1 - x0) * (W - M.l - M.r);
  // Y is inverted in screen space so LIGHT sits at the bottom and FULL at the top.
  const py = v => H - M.b - (v - y0) / (y1 - y0) * (H - M.t - M.b);

  let svg = '<svg class="scatter" viewBox="0 0 ' + W + " " + H + '" role="img" ' +
    'aria-label="Sweetness against acidity, ' + pts.length + ' bottles">';
  for(let i = 0; i <= 4; i++){
    const yy = M.t + i * (H - M.t - M.b) / 4;
    svg += '<line class="grid-l" x1="' + M.l + '" y1="' + yy + '" x2="' + (W - M.r) + '" y2="' + yy + '"/>';
  }
  for(let i = 0; i <= 4; i++){
    const xx = M.l + i * (W - M.l - M.r) / 4;
    svg += '<line class="grid-l" x1="' + xx + '" y1="' + M.t + '" x2="' + xx + '" y2="' + (H - M.b) + '"/>';
  }
  /* The two lines a reader actually looks for: SMV zero, the true sweet/dry divide, and
     the conventional acidity midpoint of 1.5. Drawn heavier than the grid and labelled,
     because an unmarked grid gives no anchor at all. */
  const x0line = px(0), ymid = py(1.5);
  svg += '<line class="axis-mid" x1="' + x0line.toFixed(1) + '" y1="' + M.t +
         '" x2="' + x0line.toFixed(1) + '" y2="' + (H - M.b) + '"/>' +
         '<line class="axis-mid" x1="' + M.l + '" y1="' + ymid.toFixed(1) +
         '" x2="' + (W - M.r) + '" y2="' + ymid.toFixed(1) + '"/>' +
         '<text class="axis-mid-lab" x="' + (x0line + 5).toFixed(1) + '" y="' + (M.t + 13) +
         '">SMV 0</text>' +
         '<text class="axis-mid-lab" x="' + (W - M.r - 5) + '" y="' + (ymid - 6).toFixed(1) +
         '" text-anchor="end">acidity 1.5</text>';

  /* Colour. `chartColourBy` picks the field: Category is what was asked for, Grade is the
     one that actually varies here, because EVERY plottable bottle is Sake. SMV and
     acidity are sake lab values and craft sake publishes neither, so the category axis is
     degenerate on this chart by construction, not by accident. */
  const colOf = p => chartColourBy === "Grade"
    ? gradeCol(gradeOf(p.d) || "") : catCol(p.d.cat);
  const keyOf = p => chartColourBy === "Grade" ? (gradeOf(p.d) || "No grade") : p.d.cat;

  pts.forEach((p, i) => {
    const off = p.smv < x0 || p.smv > x1;     // pinned to the edge, drawn hollow
    svg += '<circle data-i="' + i + '" tabindex="0" role="button" ' +
      'cx="' + px(p.smv).toFixed(1) + '" cy="' + py(p.acid).toFixed(1) + '" r="' +
      (off ? 7 : p.src === "note" ? 6 : 5) + '" fill="' + (off ? "none" : colOf(p)) +
      '" fill-opacity="' + (p.src === "note" ? ".35" : ".6") +
      '" stroke="' + colOf(p) + '" stroke-width="' + (off ? 2.2 : 1.4) + '"' +
      (off ? ' stroke-dasharray="3 2"' : "") + ">" +
      "<title>" + esc(p.d.n) + "  SMV " + (p.smv > 0 ? "+" : "") + p.smv +
      ", acidity " + p.acid + (p.src === "note" ? "  (from the tasting note)" : "") +
      (off ? "  (beyond the axis, pinned to the edge)" : "") + "</title></circle>";
  });
  svg += '<text class="axis-lab" x="' + M.l + '" y="' + (H - 14) + '">sweet</text>' +
    '<text class="axis-lab" x="' + (W - M.r) + '" y="' + (H - 14) + '" text-anchor="end">dry</text>' +
    '<text class="axis-lab" transform="rotate(-90 16 ' + (H - M.b - 6) + ')" x="16" y="' +
      (H - M.b - 6) + '">light</text>' +
    '<text class="axis-lab" transform="rotate(-90 16 ' + (M.t + 34) + ')" x="16" y="' + (M.t + 34) + '">full</text>' +
    "</svg>";

  const fromNote = pts.filter(p => p.src === "note").length;
  const offs = pts.filter(p => p.smv < x0 || p.smv > x1);
  // legend, in the chart's own colour vocabulary
  const seen = [];
  pts.forEach(p => { if(seen.indexOf(keyOf(p)) < 0) seen.push(keyOf(p)); });
  seen.sort((a, b) => chartColourBy === "Grade"
    ? GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b) : catOrder(a) - catOrder(b));
  const legend = '<div class="catkey" style="margin-top:9px">' + seen.map(k =>
    '<span><i style="background:' +
    (chartColourBy === "Grade" ? gradeCol(k) : catCol(k)) + '"></i>' + esc(k) +
    " " + pts.filter(p => keyOf(p) === k).length + "</span>").join("") + "</div>";

  host.innerHTML = '<p class="lede">Sweetness runs left to right, sweet to dry, with ' +
    '<b>SMV zero dead centre</b>. Acidity runs bottom to top, light to full. Sake and ' +
    'craft sake only, because SMV and acidity are sake measurements. ' +
    '<b>Click any circle</b> for the bottle.</p>' +
    '<div class="ctl-row"><span class="ctl-lab">Colour by</span>' +
    '<span id="chart-colour"></span></div>' +
    '<div class="chart-wrap">' + svg + legend +
    '<div class="pt-card" id="pt-card"></div>' +
    '<p class="count" id="pt-hint">' + pts.length + " of " + pool.length + " plotted" +
    (fromNote ? ", " + fromNote + " of them from a tasting note rather than a measured figure"
              : "") + ". Faded circles come from a tasting note." +
    (offs.length ? " " + offs.length + " bottle" + (offs.length === 1 ? " sits" : "s sit") +
      " beyond the axis and " + (offs.length === 1 ? "is" : "are") +
      " pinned to the edge, drawn hollow: " +
      offs.map(p => esc(p.d.n) + " at " + (p.smv > 0 ? "+" : "") + p.smv).join(", ") +
      ". The axis is held at plus or minus " + BOUND +
      " so those extremes do not squash everything else." : "") +
    (chartColourBy === "Category" && seen.length === 1
      ? " <b>Every plottable bottle is " + esc(seen[0]) + "</b>, so colouring by category " +
        "gives one colour: craft sake publishes no SMV or acidity, so it can never appear " +
        "here. Colour by grade to see the spread." : "") +
    "</p></div>" +
    barChart("By category", categoryCounts(), catCol) +
    barChart("By grade", gradeCounts(), gradeCol,
      DATA.filter(d => !gradeOf(d)).length + " bottles carry no grade, which is correct for " +
      "every category outside sake, most craft sake, and the bottles whose brewery " +
      "declines to designate one.");

  pillRow("#chart-colour", ["Grade", "Category"], chartColourBy, v => { chartColourBy = v; });
  host.querySelectorAll("#chart-colour button").forEach(b =>
    b.addEventListener("click", () => buildChart()));

  /* A <title> only shows on hover, which is no use on a touch screen and easy to miss
     anywhere. Clicking or focusing a circle fills a card under the plot instead. */
  const card = host.querySelector("#pt-card");
  const show = i => {
    const p = pts[i];
    host.querySelectorAll(".scatter circle").forEach(c => c.classList.remove("sel"));
    const c = host.querySelector('.scatter circle[data-i="' + i + '"]');
    if(c) c.classList.add("sel");
    const pu = p.d.purchases[0] || {};
    card.innerHTML = '<div class="pt-name">' + esc(p.d.n) + "</div>" +
      '<div class="pt-meta">' + esc([p.d.producer, p.d.origin, gradeOf(p.d)].filter(Boolean)
        .join(" · ")) + "</div>" +
      '<div class="pt-meta">SMV ' + (p.smv > 0 ? "+" : "") + p.smv + " · acidity " + p.acid +
        (p.d.abv != null ? " · " + p.d.abv + "% ABV" : "") +
        (p.src === "note" ? ' · <span class="pt-hint">read from the tasting note, not measured</span>' : "") +
      "</div>" +
      '<div class="pt-meta">' + esc(pu.size || "") +
        (pu.vendor ? " · " + esc(pu.vendor) : "") +
        (pu.price != null ? " · " + money(pu.price) : "") + "</div>";
    card.classList.add("on");
  };
  host.querySelectorAll(".scatter circle").forEach(c => {
    c.addEventListener("click", () => show(parseInt(c.dataset.i, 10)));
    c.addEventListener("focus", () => show(parseInt(c.dataset.i, 10)));
    c.addEventListener("keydown", e => {
      if(e.key === "Enter" || e.key === " "){ e.preventDefault(); show(parseInt(c.dataset.i, 10)); }
    });
  });
}
