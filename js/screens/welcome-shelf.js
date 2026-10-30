/* ------------------------------------------------- welcome: the shelf

   The category selector, standing on a shelf beside the drinking figure. Each main
   category is the bottle it is best known by: an isshobin for sake, a longneck for
   beer, a Bordeaux for wine, a squat jug for makgeolli, a broad-shouldered whisky for
   spirits, a can for cocktails.

   DOM and SVG rather than painted onto the canvas, and that is the important decision
   here. Shapes drawn into the canvas would need their own hit testing, could not be
   focused, could not be tabbed to and would be invisible to a screen reader. These are
   real buttons with real labels that happen to be bottle shaped, so the keyboard, the
   focus ring and the accessible name all come for free.
*/

/* Each path is drawn in a 40 x 90 box standing on y = 90.

   PROPORTION is what makes a silhouette readable at this size, not shoulder detail.
   The first attempt varied only the shape of the shoulder and all six came out as the
   same tall sliver. These differ in overall ratio first: the isshobin is the tallest
   and slimmest, the whisky the widest and stubbiest, the makgeolli short and fat, the
   can has no neck at all. */
const BOTTLE_SHAPE = {
  /* Isshobin: tall, slim, straight sided, a long narrow neck. */
  "Sake": "M17 3h6v20l6 9v58H11V32l6-9V3z",
  /* Makgeolli: short and fat, a stubby neck under a broad screw cap. */
  "Makgeolli": "M15 10h10v6l-1 9 8 9v56H8V34l8-9-1-9z",
  /* Beer longneck: a long thin neck with a crown lip, body low down. */
  "Beer": "M15 4h10v3l-2 4v26l6 8v45H11V45l6-8V11l-2-4V4z",
  /* Bordeaux: a high square shoulder and a long straight neck. */
  "Wine": "M16 2h8v26l7 10v52H9V38l7-10V2z",
  /* Whisky: the widest and shortest on the shelf, broad shoulders, thick short neck. */
  "Spirits": "M14 12h12v6l8 12v60H6V30l8-12v-6z",
  /* The two cocktails on file are cans, and a can has no neck, which is the single
     most distinguishing silhouette here. */
  "Cocktails": "M11 16h18l3 7v63a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V23l3-7z"
};

function shelfCounts(){
  const n = {};
  Object.keys(MAINS).forEach(m => { n[m] = 0; });
  DATA.forEach(d => { const m = mainOf(d); if(m) n[m]++; });
  return n;
}

function buildShelf(){
  const host = document.querySelector("#shelf");
  if(!host) return;
  const counts = shelfCounts();
  const mains = Object.keys(MAINS).filter(m => counts[m] > 0)
    .sort((a, b) => mainOrder(a) - mainOrder(b));

  host.innerHTML =
    '<div class="shelf-row">' + mains.map(m =>
      '<button class="bot" type="button" data-m="' + esc(m) + '"' +
        ' aria-pressed="' + (wMain === m ? "true" : "false") + '"' +
        ' style="--bot:' + catCol(MAINS[m].cats[0]) + '">' +
        '<svg class="bot-svg" viewBox="0 0 40 90" aria-hidden="true" focusable="false">' +
          '<path d="' + BOTTLE_SHAPE[m] + '"/>' +
        "</svg>" +
        '<span class="bot-n">' + esc(m) + "</span>" +
        '<span class="bot-c">' + counts[m] + "</span>" +
      "</button>").join("") +
    "</div><div class=\"shelf-plank\"></div>";

  host.querySelectorAll(".bot").forEach(b =>
    b.addEventListener("click", () => pickMain(b.dataset.m)));
}

/* The subs appear only once a main is chosen, and only when that main's bottles
   actually record something to split on. Beer records no type yet, so Beer shows no
   second row at all rather than a row with one dead option in it. */
function buildSubs(){
  const host = document.querySelector("#subs");
  if(!host) return;
  if(!wMain){ host.innerHTML = ""; return; }
  const rows = DATA.filter(d => mainOf(d) === wMain);
  const counts = {};
  rows.forEach(d => { const s = subOf(d); if(s) counts[s] = (counts[s] || 0) + 1; });
  const subs = Object.keys(counts)
    .sort((a, b) => (subRank(wMain, a) - subRank(wMain, b)) || (a < b ? -1 : 1));
  if(subs.length < 2){ host.innerHTML = ""; return; }

  const pill = (v, lab, n) =>
    '<button class="sub" type="button" data-s="' + esc(v) + '"' +
    (wSub === v ? ' aria-pressed="true"' : ' aria-pressed="false"') + ">" +
    esc(lab) + '<span class="sub-c">' + n + "</span></button>";
  host.innerHTML = pill("All", "All " + wMain.toLowerCase(), rows.length) +
    subs.map(s => pill(s, s, counts[s])).join("");
  host.querySelectorAll(".sub").forEach(b =>
    b.addEventListener("click", () => { wSub = b.dataset.s; buildSubs(); buildWelcomeInfo(); }));
}

function pickMain(m){
  // Clicking the bottle that is already showing closes the panel again, so the scene
  // can be got back to without reloading.
  if(wMain === m){ wMain = null; wSub = "All"; }
  else { wMain = m; wSub = "All"; }
  buildShelf();
  buildSubs();
  buildWelcomeInfo();
  if(wMain){
    const info = document.querySelector("#welcome-info");
    if(info) info.scrollIntoView({behavior: "smooth", block: "start"});
  }
}
