/* -------------------------------------------------------------------- utils */
const esc = s => String(s == null ? "" : s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

function mlOf(size){
  if(!size) return 0;
  const l = /([\d.]+)\s*L\b/i.exec(size);
  if(l) return parseFloat(l[1]) * 1000;
  const m = /([\d.]+)\s*ml\b/i.exec(size);
  return m ? parseFloat(m[1]) : 0;
}
/* Carried over unchanged from v1, including the guard. An explicitly named bottle is
   never a pour, even at 180ml: without this the <=180ml rule books a sealed 180ml
   bottle as a tasting while the row still reads "per bottle". The bare "Bottle",
   used when a volume is unknown, lands on the right side of it for free. */
function isPourSize(size){
  if(!size) return false;
  if(/tasting|carafe|pour/i.test(size)) return true;
  if(/bottle|magnum|can\b/i.test(size)) return false;
  const ml = mlOf(size);
  return ml > 0 && ml <= 180;
}
const isPour = d => isPourSize((d.purchases[0] || {}).size);

function hexToHsl(hex){
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r,g,b), mn = Math.min(r,g,b), l = (mx + mn) / 2;
  if(mx === mn) return [0, 0, l * 100];
  const dd = mx - mn, s = l > .5 ? dd / (2 - mx - mn) : dd / (mx + mn);
  let h;
  if(mx === r) h = ((g - b) / dd + (g < b ? 6 : 0));
  else if(mx === g) h = (b - r) / dd + 2;
  else h = (r - g) / dd + 4;
  return [h * 60, s * 100, l * 100];
}
let DARK = false;
/* Always read a category colour through these, never index CATEGORIES.col directly.
   A baked rgba() would be a light-theme value sitting invisibly on a dark card. */
function catCol(cat){
  const c = (CATEGORIES[cat] || {}).col || "#5f6357";
  if(!DARK) return c;
  const [h,s] = hexToHsl(c);
  return "hsl(" + h.toFixed(0) + " " + Math.max(26, s * .88).toFixed(0) + "% 74%)";
}
function catBg(cat){
  const c = (CATEGORIES[cat] || {}).col || "#5f6357";
  const [h,s] = hexToHsl(c);
  return "hsl(" + h.toFixed(0) + " " + s.toFixed(0) + "% " + (DARK ? "70%" : "42%") +
         " / " + (DARK ? ".20" : ".14") + ")";
}
const catOrder = c => (CATEGORIES[c] || {}).ord || 99;

/* v1's documented sort key: strip leading symbols and quotes, then casefold. Confirmed
   against the workbook's own ordering, where stripping only at the START reproduces it
   exactly and stripping everywhere does not. */
const sortKey = n => String(n || "").replace(/^[#"'‘’“” .\-]+/, "").toLowerCase();

/* Round to cents BEFORE formatting. Summing 150 floats and calling toFixed straight on
   the result reported the total as S$7732.64 against the workbook's S$7732.65. */
const money = v => v == null ? null
  : "S$" + (Math.round(v * 100) / 100).toFixed(2).replace(/\.00$/, "");
const pct = v => v + "%";
const smvFmt = v => (v > 0 ? "+" : "") + v;
const ppm = v => v + " ppm";
const FMT = {pct: pct, smv: smvFmt, ppm: ppm};

const priceOf = d => {
  const ps = d.purchases.map(p => p.price).filter(p => p != null);
  return ps.length ? Math.max.apply(null, ps) : null;
};
const hasNotes = id => {
  const d = BY_ID[id];
  return !!d && (!!d.note || (d.sat && Object.keys(d.sat).length > 0));
};
const ratingStars = r => {
  if(r == null) return "";
  let s = "";
  for(let i = 1; i <= 5; i++) s += r >= i ? "★" : (r >= i - .5 ? "½" : "☆");
  return s;
};
