/* ------------------------------------------------------------------- state */
let fQuery = "", fCat = "All", fGrade = "All", fFav = false, fSort = "name";
let page = 1;
const PER_PAGE = 24;

function pillRow(host, values, current, onPick){
  const el = document.querySelector(host);
  el.innerHTML = values.map(v =>
    '<button class="pill" type="button" data-v="' + esc(v) + '" aria-pressed="' +
    (v === current ? "true" : "false") + '">' + esc(v) + "</button>").join(" ");
  el.querySelectorAll("button").forEach(b => {
    b.addEventListener("click", () => { onPick(b.dataset.v); render(); });
  });
}

function buildControls(){
  const cats = ["All"].concat(
    Array.from(new Set(DATA.map(d => d.cat))).sort((a,b) => catOrder(a) - catOrder(b)));
  pillRow("#cat-pills", cats, fCat, v => { fCat = v; page = 1; });
  /* Grades in the brewing ladder's own order, not alphabetical, and only the ones
     actually present. "No grade" is a real answer here: 45 bottles have none, which is
     correct for beer, umeshu, most craft sake and any bottle whose brewery declines to
     designate one, and without this pill they would be unreachable. */
  const present = new Set(DATA.map(d => gradeOf(d)).filter(Boolean));
  const grades = ["All"].concat(GRADE_ORDER.filter(g => present.has(g)));
  if(DATA.some(d => !gradeOf(d))) grades.push("No grade");
  pillRow("#grade-pills", grades, fGrade, v => { fGrade = v; page = 1; });
  const fav = document.querySelector("#fav-pills");
  fav.innerHTML = '<button class="pill" type="button" aria-pressed="' + (fFav ? "true" : "false") +
                  '">Favourites</button>';
  fav.querySelector("button").addEventListener("click", () => {
    fFav = !fFav; page = 1; buildControls(); render();
  });
}

function matches(d){
  if(fCat !== "All" && d.cat !== fCat) return false;
  if(fGrade === "No grade" && gradeOf(d)) return false;
  if(fGrade !== "All" && fGrade !== "No grade" && gradeOf(d) !== fGrade) return false;
  if(fFav && !d.fav) return false;
  if(fQuery){
    const hay = [d.n, d.producer, d.origin, d.country, d.cat, d.note,
                 (d.styles || []).join(" "),
                 Object.keys(d.det || {}).map(k => d.det[k]).join(" "),
                 d.purchases.map(p => p.vendor).join(" ")].join(" ").toLowerCase();
    if(hay.indexOf(fQuery.toLowerCase()) < 0) return false;
  }
  return true;
}

function sortRows(rows){
  const by = {
    "name":       (a,b) => sortKey(a.n) < sortKey(b.n) ? -1 : sortKey(a.n) > sortKey(b.n) ? 1 : 0,
    "price-desc": (a,b) => (priceOf(b) == null ? -1 : priceOf(b)) - (priceOf(a) == null ? -1 : priceOf(a)),
    "price-asc":  (a,b) => (priceOf(a) == null ? 1e9 : priceOf(a)) - (priceOf(b) == null ? 1e9 : priceOf(b)),
    "abv-desc":   (a,b) => (b.abv == null ? -1 : b.abv) - (a.abv == null ? -1 : a.abv)
  }[fSort];
  return rows.slice().sort(by);
}

/* ------------------------------------------------------------------ render */
function rowHTML(d){
  const p = priceOf(d), size = (d.purchases[0] || {}).size || "";
  const meta = [d.producer, d.origin].filter(Boolean).join(" · ");
  const extra = d.purchases.length > 1 ? " · " + d.purchases.length + " purchases" : "";
  const chips = [
    '<span class="chip" style="background:' + catBg(d.cat) + ';color:' + catCol(d.cat) + '">' +
      esc(d.cat) + "</span>"
  ].concat((d.styles || []).map(s =>
    '<span class="chip" style="background:var(--paper-2);color:var(--ink-soft)">' + esc(s) + "</span>"));
  return '<div class="row" data-id="' + esc(d.id) + '">' +
    '<div class="row-head">' +
      (d.fav
        ? '<span class="fav-mark" role="img" aria-label="Favourite">★</span>'
        : '<span class="fav-mark off" aria-hidden="true">★</span>') +
      '<div class="row-main">' +
        '<div class="row-name">' + esc(d.n) + "</div>" +
        '<div class="row-meta">' + esc(meta) + (size ? " · " + esc(size) : "") + extra + "</div>" +
        '<div class="chips">' + chips.join("") + "</div>" +
      "</div>" +
      '<div class="row-right">' +
        (p == null ? '<span class="price none">not recorded</span>'
                   : '<span class="price">' + money(p) + "</span>") +
        '<button class="chev' + (hasNotes(d.id) ? " noted" : "") + '" type="button" ' +
          'aria-expanded="false" aria-label="Show details">' +
          '<svg width="11" height="7" viewBox="0 0 11 7" fill="none" aria-hidden="true">' +
          '<path d="M1 1l4.5 4.5L10 1" stroke="currentColor" stroke-width="1.6" ' +
          'stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        "</button>" +
      "</div>" +
    "</div>" +
    '<div class="detail"></div></div>';
}

function kv(k, v){
  return '<div><div class="bd-k">' + esc(k) + '</div><div class="bd-v">' + v + "</div></div>";
}

function buildDetail(d){
  const out = [];
  // Photograph on the left, fields on the right. object-fit:contain, never cover: the
  // bottle is the subject and cropping it defeats the point.
  const photo = d.img
    ? '<div class="bd-photo"><img src="' + d.img + '" loading="lazy" decoding="async"'
      + ' alt="' + esc(d.n) + '"></div>'
    : '<div class="nophoto"><span class="glyph">酒</span>' +
      '<span class="cap">no photo yet</span></div>';
  // Only fields that have a value. A null is omitted, never rendered as a dash.
  const core = [];
  if(d.abv != null) core.push(kv("ABV", esc(d.abv) + "%"));
  if(d.producer) core.push(kv("Producer", esc(d.producer)));
  if(d.origin) core.push(kv("Origin", esc(d.origin)));
  if(d.country) core.push(kv("Country", esc(d.country)));
  if(d.rating != null) core.push(kv("Rating",
    '<span class="rating">' + ratingStars(d.rating) + "</span> " + esc(d.rating)));
  if((d.styles || []).length) core.push(kv("Styles", esc(d.styles.join(", "))));

  const det = [], fields = DET_FIELDS[d.detKind] || [];
  fields.forEach(f => {
    const v = (d.det || {})[f[0]];
    if(v == null || v === "") return;
    det.push(kv(f[1], esc(f[2] ? FMT[f[2]](v) : v)));
  });

  out.push('<div class="bd-split">' + photo + '<div class="bd-main">' +
    (core.length || det.length
      ? '<div class="bd-grid">' + core.join("") + det.join("") + "</div>"
      : '<p class="count">Nothing recorded for this one beyond its purchase.</p>') +
    "</div></div>");

  // The Acquired column is dropped entirely when no purchase of this bottle carries a
  // date, rather than printing an empty column on every row. Same rule as the fields
  // above: a value that does not exist is omitted, not rendered as a placeholder.
  const anyDate = d.purchases.some(p => p.acquired);
  out.push('<div class="bd-sec">Purchase history</div>');
  out.push('<table class="pur"><thead><tr><th>Size</th><th>Price</th><th>Bought from</th>' +
    (anyDate ? "<th>Acquired</th>" : "") + "</tr></thead><tbody>" +
    d.purchases.map(p =>
      "<tr><td>" + esc(p.size || "") + "</td><td>" +
      (p.price == null ? '<span style="color:var(--ink-soft);font-style:italic">not recorded</span>'
                       : money(p.price)) +
      "</td><td>" + esc(p.vendor || "") + "</td>" +
      (anyDate ? "<td>" + esc(p.acquired || "") + "</td>" : "") +
      "</tr>" +
      // A note belonging to this purchase rather than to the bottle, for example the
      // invoice it came off. Spans the row so it reads as a footnote, not a column.
      (p.note ? '<tr><td colspan="' + (anyDate ? 4 : 3) +
        '" style="color:var(--ink-soft);padding-bottom:7px">' + esc(p.note) + "</td></tr>" : "")
      ).join("") + "</tbody></table>");

  // The whole block is omitted when there is no note. No "none yet" empty state:
  // "yet" would imply the reader can add one, and the ledger is read only.
  if(d.note){
    out.push('<div class="bd-sec">Notes</div>');
    out.push('<div class="imported-note">' + esc(d.note) + "</div>");
  }
  if(d.sat && Object.keys(d.sat).length){
    out.push('<div class="bd-sec">Tasting note</div>');
    SAT_FIELDS.forEach(grp => {
      const items = grp[1].filter(f => {
        const v = d.sat[f[0]];
        return v != null && v !== "" && !(Array.isArray(v) && !v.length);
      }).map(f => {
        const v = d.sat[f[0]];
        return kv(f[1], esc(Array.isArray(v) ? v.join(", ") : v));
      });
      if(items.length){
        out.push('<div class="bd-k" style="margin:9px 0 4px">' + esc(grp[0]) + "</div>");
        out.push('<div class="sat-grid">' + items.join("") + "</div>");
      }
    });
  }
  return out.join("");
}

/* Must be called after EVERY place .bd-photo markup is injected. */
function bindPhotoZoom(container){
  container.querySelectorAll(".bd-photo").forEach(box => {
    box.querySelector("img").addEventListener("click", () => box.classList.toggle("zoomed"));
  });
}

function syncResetBtn(){
  const active = fQuery !== "" || fCat !== "All" || fGrade !== "All" || fFav || fSort !== "name";
  document.querySelector("#reset").disabled = !active;
}

/* First and last page always shown, a window of neighbours around the current one, and
   an ellipsis for the rest, so the control stays one line at 224 bottles or at 2,000. */
function buildPager(total){
  const el = document.querySelector("#pager");
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  if(pages < 2){ el.innerHTML = ""; return; }
  const want = new Set([1, pages, page, page - 1, page + 1]);
  if(page <= 3) [2, 3, 4].forEach(n => want.add(n));
  if(page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach(n => want.add(n));
  const nums = Array.from(want).filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out = ['<button type="button" data-p="' + (page - 1) + '"' +
               (page === 1 ? " disabled" : "") + ">Previous</button>"];
  let last = 0;
  nums.forEach(n => {
    if(n - last > 1) out.push('<span class="gap">...</span>');
    out.push('<button type="button" data-p="' + n + '"' +
             (n === page ? ' aria-current="true"' : "") + ">" + n + "</button>");
    last = n;
  });
  out.push('<button type="button" data-p="' + (page + 1) + '"' +
           (page === pages ? " disabled" : "") + ">Next</button>");
  el.innerHTML = out.join("");
  el.querySelectorAll("button[data-p]").forEach(b => b.addEventListener("click", () => {
    if(b.disabled) return;
    page = parseInt(b.dataset.p, 10);
    render();
    document.querySelector("#s-list").scrollIntoView({block: "start"});
  }));
}

function buildStats(){
  const prices = [];
  DATA.forEach(d => d.purchases.forEach(p => { if(p.price != null) prices.push(p.price); }));
  /* Summed in integer cents. Adding 150 floats and rounding at the end reported the
     total a cent under the workbook, because the error accumulates before the rounding. */
  const total = prices.reduce((a,b) => a + Math.round(b * 100), 0) / 100;
  const nPur = DATA.reduce((a,d) => a + d.purchases.length, 0);
  const producers = new Set(DATA.map(d => d.producer).filter(Boolean)).size;
  document.querySelector("#stats").innerHTML =
    '<div><div class="stat-k">Bottles</div><div class="stat-v">' + DATA.length + "</div></div>" +
    '<div><div class="stat-k">Producers</div><div class="stat-v">' + producers + "</div></div>" +
    '<div><div class="stat-k">Total value</div><div class="stat-v">' + money(total) + "</div>" +
    '<div class="stat-sub">across ' + prices.length + " of " + nPur + " purchases</div></div>";
}

/* render() is the single owner of the reset button state. Do not sprinkle
   syncResetBtn() into individual control handlers. */
function render(){
  const rows = sortRows(DATA.filter(matches));
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  // A filter change can leave you past the end, so clamp before slicing.
  if(page > pages) page = pages;
  if(page < 1) page = 1;
  const from = (page - 1) * PER_PAGE;
  const shown = rows.slice(from, from + PER_PAGE);
  const list = document.querySelector("#list");
  list.innerHTML = rows.length
    ? shown.map(rowHTML).join("")
    : '<div class="empty"><span class="glyph">酒</span>Nothing matches those filters.</div>';
  document.querySelector("#count").textContent = rows.length
    ? "Showing " + (from + 1) + " to " + (from + shown.length) + " of " + rows.length +
      (rows.length === DATA.length ? " bottles" : " matching bottles, out of " + DATA.length)
    : "No bottles match those filters.";
  buildPager(rows.length);

  list.querySelectorAll(".row").forEach(row => {
    const btn = row.querySelector(".chev");
    if(!btn) return;
    btn.addEventListener("click", () => {
      const open = row.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      const panel = row.querySelector(".detail");
      if(open && !panel.dataset.built){
        panel.innerHTML = buildDetail(BY_ID[row.dataset.id]);
        panel.dataset.built = "1";
        bindPhotoZoom(panel);
      }
    });
  });
  syncResetBtn();
}
