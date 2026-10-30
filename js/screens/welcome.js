/* ------------------------------------------------------------- welcome */
const WP_MS = 120000;                 // two minutes
let wpTimers = [];
function wpClearTimers(){ wpTimers.forEach(clearInterval); wpTimers = []; }

function seasonNow(){
  const m = new Date().getMonth();
  return m <= 1 || m === 11 ? "winter" : m <= 4 ? "spring" : m <= 7 ? "summer" : "autumn";
}
function seasonScore(d, season){
  const P = flavourProfile(d), st = d.styles || [], has = x => st.indexOf(x) >= 0, n = d.n || "";
  let sc = 0;
  if(season === "summer"){
    if(P.texture && P.texture.v === "fizz") sc += 3;
    if(P.texture && P.texture.v === "cloudy") sc += 1;
    if(P.body && P.body.v === "light") sc += 3;
    if(P.sharp && P.sharp.v === "sharp") sc += 2;
    if(has("Nama")) sc += 2;
    if(/natsu/i.test(n)) sc += 4;
    if(d.abv != null && d.abv < 14) sc += 1;
  }else if(season === "autumn"){
    if(P.body && P.body.v === "full") sc += 3;
    if(P.body && P.body.v === "medium") sc += 1;
    if(P.aroma && P.aroma.v === "savoury") sc += 2;
    if(has("Genshu")) sc += 2;
    if(/hiyaoroshi|akiagari|aki /i.test(n)) sc += 5;
  }else if(season === "winter"){
    if(P.body && P.body.v === "full") sc += 3;
    if(P.aroma && P.aroma.v === "savoury") sc += 3;
    if(has("Yamahai") || has("Kimoto") || has("Mizumoto")) sc += 2;
    if(has("Taruzake")) sc += 2;
    if(d.abv != null && d.abv >= 17) sc += 1;
    if(/shiboritate|shinshu|fuyu/i.test(n)) sc += 2;
  }else{
    if(P.aroma && P.aroma.v === "aromatic") sc += 3;
    if(has("Nama")) sc += 2;
    if(has("Origarami")) sc += 2;
    if(P.texture && P.texture.v === "fizz") sc += 2;
    if(/hanami|sakura|haru/i.test(n)) sc += 4;
  }
  if(d.img) sc += 0.5;              // a feature panel leads with the photograph
  return sc;
}
// Photographed bottles first, because the panel is built around the photograph.
// The one exception is any strictly chronological panel, whose whole claim is recency.
const photoFirst = rows => rows.slice().sort((a,b) => (b.img ? 1 : 0) - (a.img ? 1 : 0));

function wpPanels(){
  const season = seasonNow();
  const seasonal = DATA.filter(d => d.cat === "Sake" || d.cat === "Craft Sake")
    .map(d => [d, seasonScore(d, season)]).filter(x => x[1] > 0)
    .sort((a,b) => b[1] - a[1]).slice(0, 12).map(x => x[0]);
  const panels = [];
  /* "Newly added" runs off the Added column, which records when a bottle entered this
     ledger. NOT off row order, which is what v1 did and what broke on every resort, and
     NOT off Acquired, which answers a different question: Acquired is when you got the
     bottle, Added is when it reached the file, and only the second can order "what is
     new here". A category sampler stands in while the column is empty.

     Oldest first, so the newest bottle is the last card rather than the first. The slice
     is taken from the END, so the panel always reaches the most recent additions however
     many rows carry a date. Values are ISO strings and are compared as strings, which
     sorts correctly whether a row carries a date or a date and a time: the two batches of
     2026-10-14 are only separable because the later one records the time as well. */
  const dated = DATA.filter(d => d.added);
  if(dated.length){
    const byAdded = dated.slice().sort((a, b) =>
      a.added < b.added ? -1 : a.added > b.added ? 1
        : sortKey(a.n) < sortKey(b.n) ? -1 : sortKey(a.n) > sortKey(b.n) ? 1 : 0);
    panels.push(["Newly added", byAdded.slice(-12)]);
  }else{
    /* Round robin across the categories, one each in turn, so a sampler actually
       samples instead of showing three sake then three craft. Favourites are left
       out because the panel beside this one is entirely favourites, and two adjacent
       panels opening on the same bottle reads as a bug even when it is not. */
    const buckets = {};
    photoFirst(DATA.filter(d => !d.fav)).forEach(d => {
      (buckets[d.cat] = buckets[d.cat] || []).push(d);
    });
    const order = Object.keys(buckets).sort((a,b) => catOrder(a) - catOrder(b));
    const mix = [];
    for(let r = 0; mix.length < 12 && r < 40; r++){
      let added = false;
      order.forEach(c => { if(buckets[c][r] && mix.length < 12){ mix.push(buckets[c][r]); added = true; } });
      if(!added) break;
    }
    panels.push(["A bit of everything", mix]);
  }
  panels.push(["Favourites", photoFirst(DATA.filter(d => d.fav)).slice(0, 12)]);
  panels.push(["Good for " + season, seasonal]);
  return panels;
}

/* One bar chart helper, shared by the welcome screen and the charts screen, so the
   grade distribution cannot drift between the two places it appears. */
function barChart(title, counts, colFn, note){
  const keys = Object.keys(counts).filter(k => counts[k]);
  if(!keys.length) return "";
  const max = Math.max.apply(null, keys.map(k => counts[k]));
  const total = keys.reduce((a, k) => a + counts[k], 0);
  return (title ? '<h2 class="sec">' + esc(title) + "</h2>" : "") +
    '<div class="chart-wrap"><div class="bars">' +
    keys.map(k =>
      '<div class="bar-row"><span>' + esc(k) + "</span>" +
      '<span class="bar-track"><span class="bar-fill" style="width:' +
      (counts[k] / max * 100).toFixed(1) + "%;background:" + colFn(k) + '"></span></span>' +
      '<span class="bar-num">' + counts[k] + "</span></div>").join("") +
    "</div>" + (note ? '<p class="count">' + note + "</p>" : "") + "</div>";
}

function gradeCounts(){
  const m = {};
  GRADE_ORDER.forEach(g => { m[g] = 0; });
  DATA.forEach(d => { const g = gradeOf(d); if(g) m[g] = (m[g] || 0) + 1; });
  return m;
}
function categoryCounts(){
  const m = {};
  Object.keys(CATEGORIES).sort((a, b) => catOrder(a) - catOrder(b)).forEach(c => { m[c] = 0; });
  DATA.forEach(d => { m[d.cat] = (m[d.cat] || 0) + 1; });
  return m;
}

function buildWelcomeSummary(){
  const pours = DATA.filter(isPour).length;
  const bottles = DATA.length - pours;
  const prices = [];
  DATA.forEach(d => d.purchases.forEach(p => { if(p.price != null) prices.push(p.price); }));
  const spend = prices.reduce((a, b) => a + Math.round(b * 100), 0) / 100;
  const countries = new Set(DATA.map(d => d.country).filter(Boolean)).size;
  const nPur = DATA.reduce((a, d) => a + d.purchases.length, 0);
  // Six, so they sit on one row at a normal window width. Anything else is a click away.
  const cell = (k, v, s) => "<div><div class=\"k\">" + k + '</div><div class="v">' + v +
    "</div>" + (s ? '<div class="s">' + s + "</div>" : "") + "</div>";
  document.querySelector("#welcome-summary").innerHTML =
    '<div class="sum">' +
      cell("Bottles", DATA.length, nPur + " purchases") +
      cell("Tasted", pours, "pours and carafes") +
      cell("Kept", bottles, "full bottles") +
      cell("Producers", new Set(DATA.map(d => d.producer).filter(Boolean)).size,
           countries + " countries") +
      cell("Spend", money(spend), prices.length + " of " + nPur + " priced") +
      cell("Favourites", DATA.filter(d => d.fav).length, "starred in the workbook") +
    "</div>";
}

function buildWelcomeCharts(){
  document.querySelector("#welcome-charts").innerHTML =
    barChart("Grades I have tried", gradeCounts(), gradeCol,
      DATA.filter(d => !gradeOf(d)).length + " bottles carry no grade, which is correct for " +
      "every category outside sake, most craft sake, and any bottle whose brewery " +
      "declines to designate one.") +
    barChart("By category", categoryCounts(), catCol);
}

function buildWelcome(){
  wpClearTimers();
  buildWelcomeSummary();
  buildWelcomeCharts();
  const host = document.querySelector("#welcome-panels");
  const panels = wpPanels();
  host.innerHTML = panels.map((p,i) =>
    '<div class="panel" data-p="' + i + '"><h3>' + esc(p[0]) + "</h3>" +
    '<div class="wp-slot"></div></div>').join("");

  panels.forEach((p, i) => {
    const panel = host.querySelector('.panel[data-p="' + i + '"]');
    const rows = p[1];
    let ix = 0, timer = null;
    /* draw() re-queries .wp-slot every pass: outerHTML swaps the node out, so a
       reference captured once goes stale and every later draw writes into nothing. */
    function draw(){
      const slot = panel.querySelector(".wp-slot");
      if(!slot) return;
      if(!rows.length){
        slot.outerHTML = '<div class="wp-slot"><div class="wp-photo"><div class="wp-none">' +
          '<span class="glyph">酒</span><span class="cap">nothing here yet</span></div></div></div>';
        return;
      }
      const d = rows[ix];
      const p0 = d.purchases[0] || {};
      const bits = [gradeOf(d), p0.size, det(d).mill != null ? det(d).mill + "%" : null,
                    d.abv != null ? d.abv + "%" : null].filter(Boolean);
      slot.outerHTML = '<div class="wp-slot">' +
        '<div class="wp-photo">' +
          (d.img ? '<img src="' + d.img + '" decoding="async" alt="' + esc(d.n) + '">'
                 : '<div class="wp-none"><span class="glyph">酒</span>' +
                   '<span class="cap">no photo yet</span></div>') +
          '<button class="wp-prev" type="button" aria-label="Previous bottle"><span>‹</span></button>' +
          '<button class="wp-next" type="button" aria-label="Next bottle"><span>›</span></button>' +
        "</div>" +
        '<div class="wp-name">' + esc(d.n) + "</div>" +
        '<div class="wp-meta">' + esc(bits.join(" · ")) + "</div>" +
        '<div class="wp-meta">' + esc([d.producer, d.origin].filter(Boolean).join(" · ")) + "</div>" +
        '<div class="wp-foot"><div class="wp-dots">' +
          rows.map((_,k) => '<span class="wp-dot' + (k === ix ? " on" : "") + '"></span>').join("") +
        '</div><span class="wp-n">' + (ix + 1) + "/" + rows.length + "</span>" +
        (p0.price != null ? '<span class="wp-n">' + money(p0.price) + "</span>" : "") +
        "</div></div>";
      const fresh = panel.querySelector(".wp-slot");
      const step = n => { ix = (ix + n + rows.length) % rows.length; draw(); arm(); };
      fresh.querySelector(".wp-prev").addEventListener("click", () => step(-1));
      fresh.querySelector(".wp-next").addEventListener("click", () => step(1));
    }
    /* One interval per panel, and a manual step re-arms only THIS panel's clock, so a
       bottle you just chose does not vanish a second later and the other panels are
       left alone. The tick is skipped while the panel is hovered or holds focus, the
       standard mitigation for auto-rotating content. */
    function arm(){
      if(timer){ clearInterval(timer); wpTimers = wpTimers.filter(t => t !== timer); }
      timer = setInterval(() => {
        if(panel.matches(":hover") || panel.contains(document.activeElement)) return;
        ix = (ix + 1) % Math.max(1, rows.length);
        draw();
      }, WP_MS);
      wpTimers.push(timer);
    }
    draw();
    arm();
  });
}
