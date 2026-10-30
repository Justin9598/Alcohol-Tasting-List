/* ------------------------------------------------------------- welcome */
const WP_MS = 120000;                 // two minutes
let wpTimers = [];
function wpClearTimers(){ wpTimers.forEach(clearInterval); wpTimers = []; }

/* The welcome screen is scoped by the dropdown under the title. "All" is every bottle,
   which is what it was before. Everything on this screen reads welcomeRows() rather
   than DATA so one selection moves the tiles, the panels and the charts together.
   Nothing else in the app is affected: the Collection screen keeps its own pills. */
let wCat = "All";
const welcomeRows = () => wCat === "All" ? DATA : DATA.filter(d => d.cat === wCat);

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
  const R = welcomeRows();
  const seasonal = R.filter(d => d.cat === "Sake" || d.cat === "Craft Sake")
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
  const dated = R.filter(d => d.added);
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
    photoFirst(R.filter(d => !d.fav)).forEach(d => {
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
  panels.push(["Favourites", photoFirst(R.filter(d => d.fav)).slice(0, 12)]);
  panels.push(["Good for " + season, seasonal]);
  /* Drop panels with nothing in them. Across the whole cellar none of these is ever
     empty, but a narrow category easily has no favourite and no seasonal pick, and
     three panels of which two read "nothing here yet" is worse than one that does not.
     It also keeps the no-empty-state rule the rest of the app follows. */
  return panels.filter(p => p[1].length);
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

/* Both take an optional row set. The Charts screen calls them with nothing and still
   gets the whole cellar; the welcome screen passes its current scope. Adding the
   argument rather than reading a global keeps the two screens independent. */
function gradeCounts(rows){
  const m = {};
  GRADE_ORDER.forEach(g => { m[g] = 0; });
  (rows || DATA).forEach(d => { const g = gradeOf(d); if(g) m[g] = (m[g] || 0) + 1; });
  return m;
}
function categoryCounts(rows){
  const m = {};
  Object.keys(CATEGORIES).sort((a, b) => catOrder(a) - catOrder(b)).forEach(c => { m[c] = 0; });
  (rows || DATA).forEach(d => { m[d.cat] = (m[d.cat] || 0) + 1; });
  return m;
}

/* No money on this screen. The Spend tile is gone and so is the masthead total; the
   Spending tab is where every figure lives now, which is also where someone looking
   for one would go. */
function buildWelcomeSummary(){
  const R = welcomeRows();
  const pours = R.filter(isPour).length;
  const bottles = R.length - pours;
  const countries = new Set(R.map(d => d.country).filter(Boolean)).size;
  const nPur = R.reduce((a, d) => a + d.purchases.length, 0);
  const styles = new Set();
  R.forEach(d => (d.styles || []).forEach(x => styles.add(x)));
  const cell = (k, v, s) => "<div><div class=\"k\">" + k + '</div><div class="v">' + v +
    "</div>" + (s ? '<div class="s">' + s + "</div>" : "") + "</div>";
  document.querySelector("#welcome-summary").innerHTML =
    '<div class="sum">' +
      cell("Bottles", R.length, nPur + (nPur === 1 ? " purchase" : " purchases")) +
      cell("Tasted", pours, "pours and carafes") +
      cell("Kept", bottles, "full bottles") +
      cell("Producers", new Set(R.map(d => d.producer).filter(Boolean)).size,
           countries + (countries === 1 ? " country" : " countries")) +
      cell("Styles", styles.size, "across the selection") +
      cell("Favourites", R.filter(d => d.fav).length, "starred in the workbook") +
    "</div>";
}

function buildWelcomeCharts(){
  const R = welcomeRows();
  const ungraded = R.filter(d => !gradeOf(d)).length;
  const grades = gradeCounts(R);
  const anyGrade = Object.keys(grades).some(g => grades[g] > 0);
  let html = "";
  if(anyGrade){
    html += barChart("Grades I have tried", grades, gradeCol,
      ungraded + (ungraded === 1 ? " bottle carries" : " bottles carry") + " no grade, " +
      "which is correct for every category outside sake, most craft sake, and any " +
      "bottle whose brewery declines to designate one.");
  }
  /* With one category selected this chart is a single bar, which says nothing the
     dropdown has not already said. It only earns its place across the whole cellar. */
  if(wCat === "All") html += barChart("By category", categoryCounts(R), catCol);
  document.querySelector("#welcome-charts").innerHTML = html;
}

/* The dropdown lists only categories that actually have bottles, with their counts,
   for the same reason the grade pills do: an option that returns nothing is a dead end
   the reader has to discover by clicking it. */
function buildWelcomePicker(){
  const sel = document.querySelector("#wcat");
  if(!sel) return;
  const counts = categoryCounts();
  const live = Object.keys(counts).filter(c => counts[c] > 0)
    .sort((a, b) => catOrder(a) - catOrder(b));
  if(live.indexOf(wCat) < 0 && wCat !== "All") wCat = "All";
  sel.innerHTML = '<option value="All">Everything (' + DATA.length + ")</option>" +
    live.map(c => '<option value="' + esc(c) + '">' + esc(c) + " (" + counts[c] + ")</option>").join("");
  sel.value = wCat;
  sel.onchange = () => { wCat = sel.value; buildWelcome(); };
}

function buildWelcome(){
  wpClearTimers();
  buildWelcomePicker();
  buildScene();
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
