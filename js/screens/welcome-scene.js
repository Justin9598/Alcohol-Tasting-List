/* ----------------------------------------------------- welcome: the scene

   The whole welcome screen. A figure sits at a table with a drink, watching the
   distance, while the weather falls around him. Over ten minutes he works through six
   stages, collecting bottles, until he goes down on the table. He stays there: the only
   way to start another evening is to wake him.

   Canvas for all of it, because 40 drifting particles plus a figure redrawn every frame
   is a great deal of layout thrash for something decorative. The one thing that is NOT
   on the canvas is the shelf, which is real buttons, and the wake control, which is a
   real button too. Painting an interactive thing into a canvas means hand-rolling hit
   testing and losing the keyboard entirely.

   Four things this has to get right, none of them visual:

   * STOP when it is not being looked at. One rAF loop, cancelled when the welcome
     screen is left and whenever the tab is hidden.
   * OBEY prefers-reduced-motion. A full-screen moving background is exactly what that
     setting is for, so it draws ONE still frame and never starts the loop.
   * FOLLOW the theme and the season. Light is a sunrise and a bright day, dark is a
     sunset going to night. Spring drops blossom, summer drifts seeds, autumn drops
     leaves, winter snows.
   * STAY REACHABLE once he is down. The wake control is a button over the figure, so
     it answers a click, the Enter key and a screen reader alike.
*/

const SC_STAGES = [
  {cap: "Pouring the first",   lean: 0.00, droop: 0.00, sway: 0.005, sip: 5600, bottles: 0},
  {cap: "Settling in",         lean: 0.03, droop: 0.04, sway: 0.012, sip: 4800, bottles: 1},
  {cap: "Warming up",          lean: 0.07, droop: 0.09, sway: 0.021, sip: 4000, bottles: 2},
  {cap: "Merry",               lean: 0.13, droop: 0.18, sway: 0.036, sip: 3400, bottles: 3},
  {cap: "Unsteady",            lean: 0.26, droop: 0.38, sway: 0.058, sip: 4200, bottles: 5},
  {cap: "Out",                 lean: 0.95, droop: 0.72, sway: 0.010, sip: 0,    bottles: 7}
];
/* Ten minutes end to end, so the last stage is reached at about eight and a third and
   he is out for the rest of it. Changing SC_TOTAL_MS is the only knob. */
const SC_TOTAL_MS = 10 * 60 * 1000;
const SC_STAGE_MS = SC_TOTAL_MS / SC_STAGES.length;
const SC_OUT = SC_STAGES.length - 1;

let scRAF = null, scCanvas = null, scCtx = null, scBits = [], scStart = 0;
let scW = 0, scH = 0, scAsleep = false, scFigBox = null;

/* Season decides what falls and what colour the land is; theme decides whether the sun
   is coming up or going down. Keeping them orthogonal means four seasons times two
   themes is eight looks out of two small tables rather than eight hand-written ones. */
const SC_SEASON = {
  spring: {land: ["#8fa07e", "#728563", "#51603f"], bits: ["#e8c0d0", "#f0d6e2", "#dca7bd", "#f6e6ec"],
           kind: "petal", skyL: ["#cfe2ef", "#eaf0e4", "#f6e4e9"], skyD: ["#141d28", "#2b2838", "#4a3a46"]},
  summer: {land: ["#8a9c6d", "#6a7d52", "#495936"], bits: ["#dbe3a8", "#eef0c8", "#c9d68e", "#f2f0cf"],
           kind: "seed",  skyL: ["#bcdcf0", "#e6f0f4", "#f7ead0"], skyD: ["#101a26", "#232c3c", "#3e4152"]},
  autumn: {land: ["#9ba4ae", "#7a7d84", "#575554"], bits: ["#b4621f", "#c98a1c", "#9c4521", "#8a7320"],
           kind: "leaf",  skyL: ["#c9d5e2", "#f2d9ba", "#eeb684"], skyD: ["#121825", "#2a2233", "#573733"]},
  winter: {land: ["#aeb6c0", "#8d939d", "#676c75"], bits: ["#ffffff", "#eef4fa", "#dfe8f2", "#ffffff"],
           kind: "snow",  skyL: ["#cdd9e6", "#e6edf4", "#f2e6e0"], skyD: ["#0e141e", "#1e2633", "#39404f"]}
};

function scPalette(){
  const S = SC_SEASON[seasonNow()] || SC_SEASON.autumn;
  const dark = DARK;
  return {
    sky: dark ? S.skyD : S.skyL,
    // Light is a sunrise and reads warm and high; dark is the sun going down.
    sun: dark ? "#7f4a2e" : "#fff0cf",
    glow: dark ? "rgba(140,80,46,.22)" : "rgba(255,226,170,.55)",
    sunY: dark ? 0.60 : 0.44,
    sunR: dark ? 0.065 : 0.085,
    hills: S.land.map(c => dark ? scShade(c, -0.62) : c),
    fig: dark ? "#06080c" : "#2c2620",
    table: dark ? "#090d13" : "#38302a",
    bits: S.bits,
    kind: S.kind
  };
}

function scShade(hex, amt){
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, Math.round(v + v * amt)));
  return "#" + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)]
    .map(v => v.toString(16).padStart(2, "0")).join("");
}

function scResize(){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = scCanvas.getBoundingClientRect();
  scW = Math.max(320, Math.round(r.width));
  scH = Math.max(220, Math.round(r.height));
  scCanvas.width = Math.round(scW * dpr);
  scCanvas.height = Math.round(scH * dpr);
  scCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function scSeedBits(){
  scBits = [];
  // Density scales with area so a wide window does not look empty and a phone does
  // not get a blizzard.
  const n = Math.round(Math.min(64, Math.max(16, scW * scH / 9000)));
  for(let i = 0; i < n; i++){
    scBits.push({
      x: Math.random() * scW,
      y: Math.random() * scH,
      z: 0.45 + Math.random() * 0.95,          // depth: size, speed and alpha together
      r: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.9,
      drift: 0.5 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      col: Math.floor(Math.random() * 4)
    });
  }
}

function scBit(ctx, s, pal){
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.globalAlpha = 0.32 + s.z * 0.45;
  ctx.fillStyle = pal.bits[s.col];
  if(pal.kind === "snow"){
    ctx.beginPath(); ctx.arc(0, 0, 1.9 * s.z, 0, Math.PI * 2); ctx.fill();
  }else if(pal.kind === "seed"){
    ctx.rotate(s.r);
    ctx.beginPath(); ctx.ellipse(0, 0, 1.2 * s.z, 4.6 * s.z, 0, 0, Math.PI * 2); ctx.fill();
  }else{
    // Leaf and petal share a shape; the petal is rounder and the palette does the rest.
    ctx.rotate(s.r);
    const w = (pal.kind === "petal" ? 4.4 : 3.6) * s.z;
    const h = (pal.kind === "petal" ? 5.2 : 6.8) * s.z;
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.bezierCurveTo(w, -h * 0.35, w, h * 0.45, 0, h);
    ctx.bezierCurveTo(-w, h * 0.45, -w, -h * 0.35, 0, -h);
    ctx.fill();
  }
  ctx.restore();
}

function scHills(ctx, pal){
  const bands = [[0.56, 0.24, 7], [0.68, 0.17, 5], [0.80, 0.12, 4]];
  bands.forEach((b, i) => {
    const base = scH * b[0], amp = scH * b[1], lumps = b[2];
    ctx.fillStyle = pal.hills[i];
    ctx.beginPath();
    ctx.moveTo(0, scH);
    ctx.lineTo(0, base);
    for(let k = 0; k < lumps; k++){
      const mid = scW * ((k + 0.5) / lumps);
      const peak = base - amp * (0.42 + 0.58 * Math.abs(Math.sin(k * 2.3 + i * 1.7)));
      ctx.quadraticCurveTo(mid, peak, scW * ((k + 1) / lumps), base);
    }
    ctx.lineTo(scW, scH);
    ctx.closePath();
    ctx.fill();
  });
}

/* The figure, facing right toward the sun. Units are roughly centimetres of a seated
   person: hip at the origin, head around y = -62, floor at y = +46.

   Reading a silhouette is about SEPARATION, not detail. The first version drew torso
   and head as overlapping filled curves and came out as a black monolith, because a
   head the same width as the shoulders with no neck between them is just a column.
   A real neck gap, a head wider than the neck, and the arm stroked as a line standing
   clear of the trunk are what make it a person. */
function scFigure(ctx, pal, st, next, mix, t, out){
  const lean = st.lean + (next.lean - st.lean) * mix;
  const droop = st.droop + (next.droop - st.droop) * mix;
  const sway = st.sway + (next.sway - st.sway) * mix;
  const sipMs = st.sip + (next.sip - st.sip) * mix;
  const nb = Math.round(st.bottles + (next.bottles - st.bottles) * mix);

  /* Capped on WIDTH as well as height. Height alone let a tall narrow phone scale the
     figure to 3x, which ran the table straight off the right edge: the group spans
     about 190 units, so the width cap is what keeps all of it in frame. The figure also
     moves left on a narrow screen, where 0.60 of the width leaves no room for the
     table beside it. */
  const scale = Math.max(0.9, Math.min(2.8, scH / 190, scW / 320));
  const gx = scW * (scW < 560 ? 0.44 : 0.60), gy = scH * 0.88;
  // Once he is out the sway becomes a slow breath rather than a wobble.
  const wob = out ? Math.sin(t / 2600) * 0.008
                  : Math.sin(t / 900) * sway + Math.sin(t / 430) * sway * 0.45;

  const ph = sipMs > 0 ? (t % sipMs) / sipMs : 1;
  const sip = (!out && droop < 0.72 && ph < 0.24) ? Math.sin(ph / 0.24 * Math.PI) : 0;

  // Where the figure is on screen, so the wake button can sit over him.
  scFigBox = {x: gx - 30 * scale, y: gy - 80 * scale, w: 70 * scale, h: 86 * scale};

  ctx.save();
  ctx.translate(gx, gy);
  ctx.scale(scale, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.fillStyle = pal.table;
  ctx.fillRect(28, -30, 80, 4);
  ctx.fillRect(62, -26, 4, 72);
  ctx.beginPath();
  ctx.ellipse(64, 46, 20, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = pal.fig;
  for(let i = 0; i < nb; i++){
    const bx = 32 + (i % 7) * 10.6;
    ctx.fillRect(bx, -47, 5.2, 17);
    ctx.fillRect(bx + 1.6, -55, 2, 8);
    ctx.fillRect(bx + 1.0, -57, 3.2, 2);
  }

  ctx.save();
  ctx.rotate(wob);

  ctx.fillStyle = pal.fig;
  ctx.fillRect(-20, -2, 34, 5);
  ctx.strokeStyle = pal.fig;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-14, 3); ctx.lineTo(-19, 46);
  ctx.moveTo(8, 3);   ctx.lineTo(13, 46);
  ctx.stroke();

  ctx.lineWidth = 13;
  ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(26, -2); ctx.stroke();
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(26, -2); ctx.lineTo(30, 42); ctx.stroke();
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(30, 44); ctx.lineTo(42, 44); ctx.stroke();

  ctx.save();
  /* POSITIVE, so the torso pitches FORWARD over the table. Canvas rotate() is clockwise
     for a positive angle and the shoulder sits straight up from the hip at (0,-48), so
     a negative angle swings it backward, away from the table, which is what the first
     version did and why "Out" read as leaning back in the chair. */
  ctx.rotate(lean);

  ctx.beginPath();
  ctx.moveTo(-13, -2);
  ctx.quadraticCurveTo(-17, -26, -12, -46);
  ctx.lineTo(4, -48);
  ctx.quadraticCurveTo(9, -26, 10, -2);
  ctx.closePath();
  ctx.fill();

  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(-4, -46); ctx.lineTo(-2, -56); ctx.stroke();

  ctx.save();
  ctx.translate(-2, -56);
  ctx.rotate(droop * 1.2 - sip * 0.34);
  ctx.beginPath(); ctx.arc(0, -11, 11.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(10, -11); ctx.lineTo(16.5, -8.2); ctx.lineTo(10, -5.6);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-11, -16); ctx.quadraticCurveTo(-4, -26, 7, -17);
  ctx.quadraticCurveTo(-2, -20, -11, -16);
  ctx.fill();
  ctx.restore();

  const slump = droop > 0.72;
  ctx.lineWidth = 7.5;
  ctx.beginPath();
  if(slump){
    ctx.moveTo(2, -42); ctx.lineTo(22, -34); ctx.lineTo(46, -31);
  }else{
    const ex = 14, ey = -24 + sip * 3;
    const hx = 30 - sip * 18, hy = -36 - sip * 16;
    ctx.moveTo(1, -43); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy);
  }
  ctx.stroke();

  if(!slump){
    const hx = 30 - sip * 18, hy = -36 - sip * 16;
    ctx.save();
    ctx.translate(hx + 3, hy - 4);
    ctx.rotate(-sip * 0.85);
    ctx.beginPath();
    ctx.moveTo(-4, -7); ctx.lineTo(4, -7); ctx.lineTo(3, 3); ctx.lineTo(-3, 3);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
  ctx.restore();
}

function scDraw(t){
  const ctx = scCtx, pal = scPalette();
  // Once the ten minutes are up he is OUT and stays out. The clock is pinned to the
  // last stage rather than wrapping, because waking him is the only way on.
  const done = t >= SC_TOTAL_MS;
  const idx = done ? SC_OUT : Math.floor(t / SC_STAGE_MS);
  const within = done ? 1 : (t % SC_STAGE_MS) / SC_STAGE_MS;
  const st = SC_STAGES[idx];
  const next = SC_STAGES[Math.min(SC_OUT, idx + 1)];
  const mix = within < 0.8 ? 0 : (within - 0.8) / 0.2;
  const out = idx === SC_OUT;

  const g = ctx.createLinearGradient(0, 0, 0, scH);
  g.addColorStop(0, pal.sky[0]);
  g.addColorStop(0.55, pal.sky[1]);
  g.addColorStop(1, pal.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, scW, scH);

  const sx = scW * 0.84, sy = scH * pal.sunY;
  const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, scH * 0.7);
  halo.addColorStop(0, pal.glow);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, scW, scH);
  ctx.fillStyle = pal.sun;
  ctx.globalAlpha = DARK ? 0.9 : 1;
  ctx.beginPath(); ctx.arc(sx, sy, scH * pal.sunR, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  scHills(ctx, pal);
  scFigure(ctx, pal, st, next, mix, t, out);

  scBits.forEach(s => {
    scBit(ctx, s, pal);
    s.y += s.drift * s.z * (pal.kind === "snow" ? 0.38 : 0.55);
    s.x += Math.sin(t / 1000 + s.phase) * (pal.kind === "snow" ? 0.3 : 0.55) * s.z;
    s.r += s.spin * 0.012;
    if(s.y - 10 > scH){ s.y = -12; s.x = Math.random() * scW; }
  });

  const cap = document.querySelector("#scene-cap");
  if(cap && cap.dataset.s !== String(idx)){
    cap.dataset.s = String(idx);
    cap.textContent = st.cap;
  }
  if(done && !scAsleep) scSleep();
}

/* He is down. Stop the clock, park the wake button over him and leave it there. The
   button is real, so Enter and a screen reader reach it exactly as a click does. */
function scSleep(){
  scAsleep = true;
  const btn = document.querySelector("#scene-wake");
  if(!btn || !scFigBox) return;
  btn.hidden = false;
  btn.style.left = Math.round(scFigBox.x) + "px";
  btn.style.top = Math.round(scFigBox.y) + "px";
  btn.style.width = Math.round(scFigBox.w) + "px";
  btn.style.height = Math.round(scFigBox.h) + "px";
}

function scWake(){
  scAsleep = false;
  scStart = performance.now();
  const btn = document.querySelector("#scene-wake");
  if(btn) btn.hidden = true;
  const cap = document.querySelector("#scene-cap");
  if(cap) cap.dataset.s = "";
  if(!scRAF) scLoop();
}

function scStop(){
  if(scRAF){ cancelAnimationFrame(scRAF); scRAF = null; }
  window.removeEventListener("resize", scOnResize);
  document.removeEventListener("visibilitychange", scOnVis);
}

function scOnResize(){
  if(!scCanvas || !scCanvas.isConnected) return;
  scResize();
  scSeedBits();
  if(scAsleep) scSleep();                    // the button has to follow him
}

function scOnVis(){
  // A full-screen canvas is pure battery cost for something nobody is looking at.
  if(document.hidden){
    if(scRAF){ cancelAnimationFrame(scRAF); scRAF = null; }
  }else if(!scRAF && !scAsleep && scCanvas && scCanvas.isConnected){
    scLoop();
  }
}

function scLoop(){
  scRAF = requestAnimationFrame(() => {
    if(!scCanvas || !scCanvas.isConnected){ scStop(); return; }
    const t = performance.now() - scStart;
    scDraw(t);
    // Nothing moves once he is out, so there is no reason to keep painting.
    if(scAsleep){ scRAF = null; return; }
    scLoop();
  });
}

function buildScene(){
  scStop();
  scCanvas = document.querySelector("#scene");
  if(!scCanvas || !scCanvas.getContext) return;
  scCtx = scCanvas.getContext("2d");
  scAsleep = false;
  const btn = document.querySelector("#scene-wake");
  if(btn){
    btn.hidden = true;
    if(!btn.dataset.bound){ btn.dataset.bound = "1"; btn.addEventListener("click", scWake); }
  }
  scResize();
  scSeedBits();

  const still = window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(still){
    // One frame, early in the evening so he is upright and the scene has something in
    // it, and no loop at all.
    scDraw(SC_STAGE_MS * 1.4);
    const cap = document.querySelector("#scene-cap");
    if(cap) cap.textContent = SC_STAGES[1].cap;
    return;
  }
  scStart = performance.now();
  window.addEventListener("resize", scOnResize);
  document.addEventListener("visibilitychange", scOnVis);
  scLoop();
}
