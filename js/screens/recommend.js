/* ------------------------------------------------------------------- quiz
   Scoped by FLAVOUR PROFILE, not by type. Nothing is ever filtered out: the pool
   is always every sake and craft sake, and flavour scopes by weight. A bottle with
   no data on an axis simply stays out of that axis, rather than being deleted by a
   field it happens to be missing. */
let quizAnswers = {}, quizAsked = [], quizDone = false;

const quizPool = () => DATA.filter(d => d.cat === "Sake" || d.cat === "Craft Sake");
const quizApplies = (q, a) => !q.when || q.when(a);
const quizNext = () => QUIZ.find(q => quizApplies(q, quizAnswers) && !(q.key in quizAnswers));

function quizScore(d, a){
  const P = flavourProfile(d), st = d.styles || [], has = x => st.indexOf(x) >= 0;
  const D = det(d);
  let earned = 0, possible = 0;
  const why = [], matched = {};

  AXIS.forEach(ax => {
    const want = a[ax.key];
    if(!want || want === "any") return;
    const got = P[ax.key];
    if(!got) return;                      // no data: stays out of the denominator
    const w = ax.w * got.c;
    possible += w;
    let q = 0;
    if(got.v === want) q = 1;
    else if(ax.adj) q = (ax.adj[want] || []).indexOf(got.v) >= 0 ? .4 : 0;
    else {
      const i = ax.order.indexOf(want), j = ax.order.indexOf(got.v);
      q = (i >= 0 && j >= 0 && Math.abs(i - j) === 1) ? .4 : 0;
    }
    earned += w * q;
    // Two axes can cite the same evidence (yamahai reads as both full-bodied and
    // savoury), so the reason list is deduped or it reads as a stutter.
    if(q === 1){ matched[ax.key] = 1; if(got.src && why.indexOf(got.src) < 0) why.push(got.src); }
  });

  // The practical questions share the same pot, at lower weight.
  const prac = (want, known, ok, w, txt) => {
    if(!want || want === "any" || !known) return;
    possible += w;
    if(ok){ earned += w; if(txt && why.indexOf(txt) < 0) why.push(txt); }
  };
  const sz = sizeOf(d);
  prac(a.size, !!sz, sizeBucket(sz) === a.size, 3, sz);
  prac(a.region, !!d.origin, regionOf(d.origin) === a.region, 3, d.origin);
  prac(a.grade, !!D.grade, !!D.grade && ((a.grade === "dai" && DAI.indexOf(D.grade) >= 0)
      || (a.grade === "gin" && GIN.indexOf(D.grade) >= 0)
      || (a.grade === "day" && DAY.indexOf(D.grade) >= 0)),
      3, D.grade ? D.grade.toLowerCase() : null);
  prac(a.cloudkind, has("Nigori") || has("Origarami") || has("Doburoku") || has("Sparkling"),
      (a.cloudkind === "haze" && has("Origarami")) || (a.cloudkind === "full" && has("Nigori"))
      || (a.cloudkind === "thick" && has("Doburoku")), 4, null);
  prac(a.oldschool, has("Kimoto") || has("Yamahai") || has("Mizumoto") || has("Taruzake") || has("Cask-aged"),
      (a.oldschool === "kimoto" && (has("Kimoto") || has("Mizumoto")))
      || (a.oldschool === "yamahai" && has("Yamahai"))
      || (a.oldschool === "wood" && (has("Taruzake") || has("Cask-aged"))), 4, null);

  /* Smoothed ratio, not a raw total. The +6 is what stops one lucky hit on a single
     thin axis outranking a bottle that matched five, so a sparsely documented bottle
     is neither rewarded nor punished for its gaps. */
  let sc = possible > 0 ? (earned / (possible + 6)) * 10 : 0;
  if(a.type && a.type !== "any"){
    // A nudge, not a filter. It moves a bottle up or down; it never removes one.
    sc += ((a.type === "Craft") === (d.cat === "Craft Sake")) ? 2 : -2;
  }
  if(d.fav) sc += 0.3;
  return {sc:sc, why:why, profile:P, matched:matched};
}

function profileChips(P, matched){
  const out = [];
  ["sweet","body","aroma","texture","sharp"].forEach(k => {
    const g = P[k];
    if(!g) return;
    const cls = "qz-pchip" + (matched && matched[k] ? " on" : "") + (g.c < .6 ? " soft" : "");
    out.push('<span class="' + cls + '">' + esc(FP_LABEL[k][g.v] || g.v) + "</span>");
  });
  return out.length ? '<span class="qz-prof">' + out.join("") + "</span>" : "";
}

/* Three picks, one each, drawn from the cellar rather than from a hand-maintained list of
   bottles you do not own: a curated list goes stale silently, which is why v1's was
   dropped. Each card says where that bottle came from, so it can be bought again.

   The seed is the day, so the three stay put while you read the page and change tomorrow.
   Seasonal is the exception: it is a ranking, not a shuffle, so it picks the best fit. */
function daySeed(){
  const d = new Date();
  return d.getFullYear() * 1000 + Math.floor(
    (d - new Date(d.getFullYear(), 0, 0)) / 86400000);
}
function pickOne(rows, seed){
  if(!rows.length) return null;
  return rows[seed % rows.length];
}

/* ----------------------------------------------------------------------
   The cellar's own taste, and how far a given bottle sits from it.

   Built from favourites when there are enough of them, because a favourite is a
   deliberate statement and a purchase is often just what was open. Each axis keeps the
   value you lean to and how hard you lean, so a 90% lean counts for more than a 40% one.
   ---------------------------------------------------------------------- */
let CELLAR_PROFILE = null;
function cellarProfile(){
  if(CELLAR_PROFILE) return CELLAR_PROFILE;
  const favs = DATA.filter(d => d.fav);
  const pool = favs.length >= 5 ? favs : DATA;
  const prof = {};
  AXIS.forEach(ax => {
    const m = {};
    pool.forEach(d => {
      const g = flavourProfile(d)[ax.key];
      if(g) m[g.v] = (m[g.v] || 0) + g.c;
    });
    const keys = Object.keys(m);
    if(!keys.length) return;
    keys.sort((a, b) => m[b] - m[a]);
    const total = keys.reduce((a, k) => a + m[k], 0);
    prof[ax.key] = {v: keys[0], share: m[keys[0]] / total};
  });
  CELLAR_PROFILE = {prof: prof, from: favs.length >= 5 ? "favourites" : "the whole cellar",
                    n: pool.length};
  return CELLAR_PROFILE;
}

/* 0 means it tastes like the rest of the cellar, 1 means it is the opposite of it.
   Weighted by the bottle's own confidence and by how hard the cellar leans, so a guess
   on a thin axis cannot make something look exotic. */
function profileDistance(P, prof){
  let dist = 0, weight = 0, away = [];
  AXIS.forEach(ax => {
    const want = prof[ax.key], got = P[ax.key];
    if(!want || !got) return;
    let d;
    if(ax.adj){
      d = got.v === want.v ? 0 : ((ax.adj[want.v] || []).indexOf(got.v) >= 0 ? 0.5 : 1);
    }else{
      const i = ax.order.indexOf(want.v), j = ax.order.indexOf(got.v);
      d = Math.abs(i - j) / (ax.order.length - 1);
    }
    const w = got.c * want.share;
    dist += d * w;
    weight += w;
    if(d >= 0.5) away.push(FP_LABEL[ax.key][got.v] + " where you lean " +
                           FP_LABEL[ax.key][want.v]);
  });
  return weight ? {d: dist / weight, away: away} : null;
}

/* A candidate is not a bottle, but it can be made to look like one: its tags and grade
   map onto the same styles and grades DATA uses, so the SAME flavourProfile engine
   scores it. One definition of taste, used on both sides of the screen. */
const TAG_STYLE = {nama: "Nama", muroka: "Muroka", genshu: "Genshu", kimoto: "Kimoto",
                   yamahai: "Yamahai", nigori: "Nigori", sparkling: "Sparkling",
                   taruzake: "Taruzake", origarami: "Origarami"};
const GRADE_TAG = {"junmai daiginjo": "Junmai Daiginjo", "junmai ginjo": "Junmai Ginjo",
                   "tokubetsu junmai": "Tokubetsu Junmai", "junmai": "Junmai",
                   "daiginjo": "Daiginjo", "ginjo": "Ginjo", "honjozo": "Honjozo"};
function candidateAsBottle(c){
  const tags = (c.tags || []).map(t => String(t).toLowerCase());
  const styles = tags.map(t => TAG_STYLE[t]).filter(Boolean);
  let grade = c.grade || "";
  if(!grade){
    tags.forEach(t => { if(GRADE_TAG[t] && !grade) grade = GRADE_TAG[t]; });
  }
  return {id: "cand:" + c.n, n: c.n, cat: "Sake", abv: null, note: c.why || "",
          styles: styles, detKind: "Sake Detail", det: grade ? {grade: grade} : {},
          purchases: []};
}

/* Candidates already bought are dropped. That is what stops a hand-maintained list of
   things to try from quietly recommending what is already on the shelf. */
function normName(x){
  return String(x || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/)
    .filter(w => w && w.length > 2);
}
function alreadyOwned(c){
  const ct = normName(c.n);
  if(!ct.length) return false;
  return DATA.some(d => {
    const dt = normName(d.n);
    const hit = ct.filter(w => dt.indexOf(w) >= 0).length;
    return hit / ct.length >= 0.6 && hit >= 2;
  });
}

function availableCandidates(){
  const all = (typeof CANDIDATES !== "undefined" ? CANDIDATES : []);
  const free = all.filter(c => !alreadyOwned(c));
  return {free: free, dropped: all.length - free.length, total: all.length};
}

/* Two layers of three. The first is bottles NOT in the ledger, the second is the shelf
   you already own. Both answer the same three questions. */
function recommendations(){
  const season = seasonNow();
  const seed = daySeed();
  const CP = cellarProfile();
  const own = DATA.filter(d => d.cat === "Sake" || d.cat === "Craft Sake");
  const cand = availableCandidates();

  // ---------------------------------------------------- layer 1, not in the ledger
  const outNew = [];
  const seasonC = cand.free.filter(c => c.kind === "seasonal" && c.season === season);
  const pickSeason = pickOne(seasonC.length ? seasonC
                             : cand.free.filter(c => c.kind === "seasonal"), seed);
  if(pickSeason) outNew.push(["Good for " + season, pickSeason,
    pickSeason.why, pickSeason.season !== season ? "No " + season + " pick left on the list, so this is the nearest." : ""]);

  const newC = cand.free.filter(c => c.kind === "new" && c !== pickSeason);
  const pickNew = pickOne(newC, seed * 3);
  if(pickNew) outNew.push(["Something new", pickNew, pickNew.why, ""]);

  // interesting: the candidate furthest from the cellar's own taste, any category,
  // any grade. Not restricted to craft, and not scored on rarity.
  const scoredC = cand.free.filter(c => c !== pickSeason && c !== pickNew)
    .map(c => {
      const r = profileDistance(flavourProfile(candidateAsBottle(c)), CP.prof);
      return {c: c, r: r};
    }).filter(x => x.r).sort((a, b) => b.r.d - a.r.d);
  if(scoredC.length){
    const top = scoredC[0];
    outNew.push(["Something interesting", top.c,
      (top.r.away.length ? "Pulls against your usual: " + top.r.away.slice(0, 2).join(", ") + ". "
                         : "A different shape from your usual. ") + (top.c.why || ""), ""]);
  }

  // -------------------------------------------------------- layer 2, on your shelf
  const outOwn = [];
  const seasonal = own.map(d => [d, seasonScore(d, season)])
    .filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
  if(seasonal.length){
    outOwn.push(["Good for " + season, seasonal[0][0],
      "Scored highest on the season's own profile: " +
      (season === "summer" ? "light, sharp, fizzy or unpasteurised."
       : season === "autumn" ? "fuller body, savoury, hiyaoroshi."
       : season === "winter" ? "full body, kimoto or yamahai, cedar."
       : "aromatic, nama, lightly cloudy."), ""]);
  }
  const fresh = photoFirst(DATA.filter(d => !d.note && !d.sat));
  const unexplored = fresh.length ? fresh : photoFirst(DATA.filter(d => !d.sat));
  const nw = pickOne(unexplored.filter(d => !outOwn.some(o => o[1].id === d.id)), seed);
  if(nw) outOwn.push(["Something new", nw,
    nw.note ? "Nothing written down about how it tasted yet."
            : "No note and no tasting note: still unexplored.", ""]);

  /* Interesting, on the shelf. Scored purely on distance from the cellar's own taste,
     across EVERY category: an umeshu, a doburoku or a bone-dry honjozo can all win it.
     The old version scored rarity with a bonus for anything that was not Sake, which
     made it a craft-sake card in practice. */
  const scored = DATA.filter(d => !outOwn.some(o => o[1].id === d.id))
    .map(d => ({d: d, r: profileDistance(flavourProfile(d), CP.prof)}))
    .filter(x => x.r).sort((a, b) => (b.r.d - a.r.d) || ((b.d.img ? 1 : 0) - (a.d.img ? 1 : 0)));
  if(scored.length){
    const top = scored[0];
    outOwn.push(["Something interesting", top.d,
      (top.r.away.length
        ? "The furthest thing here from your usual: " + top.r.away.slice(0, 2).join(", ") + "."
        : "An unusual shape for this cellar."), ""]);
  }
  return {notOwned: outNew, owned: outOwn, cand: cand, profile: CP};
}

const PHOTO_NONE = '<div class="wp-none"><span class="glyph">酒</span>' +
                   '<span class="cap">no photo yet</span></div>';

function recCard(why, title, photo, lines, reason, buy, caveat){
  return '<div class="rec"><div class="rec-why">' + esc(why) + "</div>" +
    '<div class="rec-split"><div class="rec-photo">' + photo + "</div>" +
    '<div class="rec-body"><div class="rec-name">' + esc(title) + "</div>" +
    lines.filter(Boolean).map(l => '<div class="rec-meta">' + esc(l) + "</div>").join("") +
    (reason ? '<div class="rec-meta" style="margin-top:6px">' + esc(reason) + "</div>" : "") +
    (caveat ? '<div class="rec-meta" style="font-style:italic">' + esc(caveat) + "</div>" : "") +
    '<div class="rec-buy">' + buy + "</div></div></div></div>";
}

function buildRec(){
  const host = document.querySelector("#rec-body");
  const R = recommendations();
  const P = R.profile;
  const leans = AXIS.map(ax => P.prof[ax.key]
    ? FP_LABEL[ax.key][P.prof[ax.key].v] : null).filter(Boolean);

  // ---- layer 1: not in the ledger. No photographs exist for these, by definition.
  const notOwned = R.notOwned.map(r => {
    const c = r[1];
    const buy = c.buy
      ? 'Buy at <a href="' + esc(c.buy) + '" target="_blank" rel="noopener">' +
        esc((c.buy.split("/")[2] || "the shop").replace(/^www\./, "")) + "</a>"
      : '<span class="none">No stockist on file. Ask at Mirai Sake Hall or Isego Honten.</span>';
    return recCard(r[0], c.n, PHOTO_NONE,
                   [[c.brewery, c.pref].filter(Boolean).join(" · "),
                    c.grade || ""], r[2], buy, r[3]);
  }).join("");

  // ---- layer 2: on your shelf
  const owned = R.owned.map(r => {
    const d = r[1], pu = d.purchases[0] || {};
    const vendors = Array.from(new Set(d.purchases.map(p => p.vendor).filter(
      v => v && v !== "Unknown")));
    const buy = vendors.length
      ? "Bought at <b>" + vendors.map(esc).join("</b>, <b>") + "</b>" +
        (pu.price != null ? ", last " + money(pu.price) : "")
      : '<span class="none">No vendor recorded for this one.</span>';
    return recCard(r[0], d.n,
      d.img ? '<img src="' + d.img + '" loading="lazy" decoding="async" alt="'
              + esc(d.n) + '">' : PHOTO_NONE,
      [[gradeOf(d), pu.size, d.abv != null ? d.abv + "%" : null].filter(Boolean).join(" · "),
       [d.producer, d.origin].filter(Boolean).join(" · ")], r[2], buy, r[3]);
  }).join("");

  host.innerHTML =
    '<p class="lede">Six picks, one of each kind on each layer. They change daily, and ' +
    'both layers read your own taste: across ' + P.n + " " + esc(P.from) +
    " you lean <b>" + esc(leans.join(", ")) + "</b>.</p>" +
    '<h2 class="sec">To try next, not in your ledger</h2>' +
    '<p class="rec-lede">' + R.cand.free.length + " of " + R.cand.total +
    " curated bottles are still untried" +
    (R.cand.dropped ? "; " + R.cand.dropped + " have been dropped from the list because " +
     "you have since bought them" : "") + ".</p>" +
    '<div class="recs">' + notOwned + "</div>" +
    '<h2 class="sec">Already on your shelf</h2>' +
    '<p class="rec-lede">The same three questions, answered from what you own, with where ' +
    'each came from so you can find it again.</p>' +
    '<div class="recs">' + owned + "</div>" +
    '<h2 class="sec">Or answer a few questions</h2>' +
    '<p class="lede">Nothing is filtered out: your answers weight the whole cellar, so a ' +
    'bottle missing a field is never deleted by it.</p><div class="qz" id="qz"></div>';
  drawQuiz();
  bindPhotoZoom(host);
}

function drawQuiz(){
  const el = document.querySelector("#qz");
  if(!el) return;
  if(quizDone) return drawQuizResults(el);
  const q = quizNext();
  if(!q){ quizDone = true; return drawQuizResults(el); }
  /* The progress indicator deliberately has NO denominator: the path length is not
     known until the branches resolve, and a total that climbs as you answer reads
     as a bug. */
  el.innerHTML = '<div class="qz-step">Question ' + (quizAsked.length + 1) +
    '<span class="qz-dots">' +
      quizAsked.map(() => '<span class="wp-dot on"></span>').join("") +
      '<span class="wp-dot"></span></span></div>' +
    '<div class="qz-q">' + esc(q.q) + "</div>" +
    '<div class="qz-opts">' + q.opts.map(o =>
      '<button class="qz-opt" type="button" data-v="' + esc(o.v) + '">' + esc(o.l) + "</button>").join("") +
    "</div>" +
    '<div class="qz-nav">' +
      (quizAsked.length ? '<button class="reset" type="button" id="qz-back">Back</button>' : "") +
      '<button class="reset" type="button" id="qz-skip">Skip to results</button>' +
    "</div>";
  el.querySelectorAll(".qz-opt").forEach(b => b.addEventListener("click", () => {
    quizAnswers[q.key] = b.dataset.v;
    quizAsked.push(q.key);
    drawQuiz();
  }));
  const back = el.querySelector("#qz-back");
  // quizAsked is an ordered list, so Back pops exactly the question that was asked,
  // which matters once branches can skip questions.
  if(back) back.addEventListener("click", () => {
    const k = quizAsked.pop();
    delete quizAnswers[k];
    drawQuiz();
  });
  el.querySelector("#qz-skip").addEventListener("click", () => { quizDone = true; drawQuiz(); });
}

function drawQuizResults(el){
  const pool = quizPool();
  const scored = pool.map(d => {
    const r = quizScore(d, quizAnswers);
    r.d = d;
    return r;
  }).sort((a,b) => b.sc - a.sc);
  const best = scored[0] ? scored[0].sc : 0;
  // A RELATIVE cutoff. An absolute floor wipes out every result whenever the top
  // score falls below it.
  const cut = Math.max(0.3, best - 1.5);
  let picks = scored.filter(r => r.sc >= cut).slice(0, 6);
  let fellBack = false;
  // If every answer is "any" the scorer has nothing to rank on, so return a broad
  // selection, favourites first, rather than an empty state.
  if(!picks.length || best <= 0.31){
    fellBack = true;
    picks = scored.slice().sort((a,b) => (b.d.fav ? 1 : 0) - (a.d.fav ? 1 : 0)).slice(0, 6);
  }
  // The recap reads back r, the plain term, never l, the playful button label.
  const recap = quizAsked.map(k => {
    const q = QUIZ.find(x => x.key === k);
    const o = q && q.opts.find(x => x.v === quizAnswers[k]);
    return o && o.r ? o.r : null;
  }).filter(Boolean);

  el.innerHTML = '<div class="qz-step">Results</div>' +
    '<div class="qz-q">' + (recap.length ? "Something " + esc(recap.join(", ")) + "."
                                          : "No strong preferences, so here is a broad spread.") + "</div>" +
    (fellBack ? '<p class="count">Nothing to rank on, so these are favourites first.</p>' : "") +
    '<div class="qz-res">' + picks.map((r,i) => {
      const vendor = (r.d.purchases[0] || {}).vendor;
      return '<div class="qz-card' + (i === 0 ? " top" : "") + '">' +
        '<div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">' +
          '<span class="qz-name">' + esc(r.d.n) + "</span>" +
          // The badge shows WHERE it was bought, not its price.
          (vendor && vendor !== "Unknown"
            ? '<span class="qz-badge">' + esc(vendor) + "</span>"
            : '<span class="qz-badge none">not recorded</span>') +
        "</div>" +
        profileChips(r.profile, r.matched) +
        (r.why.length ? '<div class="qz-why">Matches on ' + esc(r.why.join(", ")) + "</div>" : "") +
        "</div>";
    }).join("") + "</div>" +
    '<div class="qz-nav"><button class="reset" type="button" id="qz-again">Start again</button></div>';
  el.querySelector("#qz-again").addEventListener("click", () => {
    quizAnswers = {}; quizAsked = []; quizDone = false; drawQuiz();
  });
}
