/* ----------------------------------------------------- welcome: autumn scene

   One canvas behind the title: an autumn dusk, falling leaves, and a figure sitting at
   a table with a drink, watching the distance. As the evening runs on, bottles collect
   on the table and the figure works through five stages of drunk, then the scene turns
   over and a new evening begins.

   Canvas rather than DOM for all of it, because 40 drifting leaves plus a figure
   redrawn every frame is a great deal of layout thrash for something purely decorative.
   Nothing here is interactive and nothing here carries information, which is why the
   element is aria-hidden and the only readable part is the stage caption beside it.

   Three things this has to get right, none of them visual:

   * STOP when it is not being looked at. One rAF loop, cancelled when the welcome
     screen is left and whenever the tab is hidden. An animation running behind six
     other screens is a flat battery for nothing.
   * OBEY prefers-reduced-motion. A moving background is exactly what that setting is
     for, so it draws ONE still frame and never starts the loop.
   * FOLLOW the theme. Colours come from DARK rather than from CSS, because the theme
     is applied as inline variables with no attribute to match on, and toggleTheme
     re-enters setScreenMode, which rebuilds this anyway.

   On drawing a readable silhouette: the first attempt drew the torso and head as
   overlapping filled curves and it came out as a black monolith, because a head the
   same width as the shoulders with no neck between them is just a column. What makes
   it read as a person is SEPARATION: a clear neck, a head wider than the neck, and the
   arm stroked as a thick line standing away from the body rather than merged into it.
*/

const SC_STAGES = [
  {cap: "Pouring the first",  lean: 0.00, droop: 0.00, sway: 0.006, sip: 5200, bottles: 0},
  {cap: "Warming up",         lean: 0.05, droop: 0.06, sway: 0.016, sip: 4200, bottles: 1},
  {cap: "Merry",              lean: 0.12, droop: 0.16, sway: 0.034, sip: 3400, bottles: 2},
  {cap: "Unsteady",           lean: 0.22, droop: 0.34, sway: 0.055, sip: 3900, bottles: 4},
  {cap: "Watching the floor", lean: 0.34, droop: 0.95, sway: 0.020, sip: 9000, bottles: 6}
];
const SC_STAGE_MS = 21000;                    // a stage lasts this long
const SC_CYCLE = SC_STAGES.length * SC_STAGE_MS;

let scRAF = null, scCanvas = null, scCtx = null, scLeaves = [], scStart = 0, scW = 0, scH = 0;

function scPalette(){
  return DARK
    ? {sky: ["#121825", "#2a2233", "#573733"], sun: "#80492c", haze: "rgba(128,73,44,.30)",
       hills: ["#1e2531", "#171d27", "#10151c"], fig: "#06080c", table: "#090d13",
       leaf: ["#8a4a24", "#9c6516", "#7d3a2a", "#6b5a1e"], glow: "rgba(156,101,22,.22)"}
    : {sky: ["#c9d5e2", "#f2d9ba", "#eeb684"], sun: "#eaa165", haze: "rgba(234,161,101,.34)",
       hills: ["#9ba4ae", "#7a7d84", "#575554"], fig: "#2f2923", table: "#3b332b",
       leaf: ["#b4621f", "#c98a1c", "#9c4521", "#8a7320"], glow: "rgba(234,161,101,.26)"};
}

function scResize(){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = scCanvas.getBoundingClientRect();
  scW = Math.max(320, Math.round(r.width));
  scH = Math.max(150, Math.round(r.height));
  scCanvas.width = Math.round(scW * dpr);
  scCanvas.height = Math.round(scH * dpr);
  scCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function scSeedLeaves(){
  scLeaves = [];
  // Density scales with area so a wide window does not look empty and a phone does
  // not get a blizzard.
  const n = Math.round(Math.min(48, Math.max(14, scW * scH / 6800)));
  for(let i = 0; i < n; i++){
    scLeaves.push({
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

function scLeaf(ctx, s, pal){
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.r);
  ctx.globalAlpha = 0.32 + s.z * 0.45;
  ctx.fillStyle = pal.leaf[s.col];
  const w = 3.6 * s.z, h = 6.8 * s.z;
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.bezierCurveTo(w, -h * 0.35, w, h * 0.45, 0, h);
  ctx.bezierCurveTo(-w, h * 0.45, -w, -h * 0.35, 0, -h);
  ctx.fill();
  ctx.restore();
}

function scHills(ctx, pal){
  // Three ridges, each a run of overlapping arcs. Drawn back to front and darkening,
  // which is what reads as distance without any perspective maths.
  const bands = [[0.58, 0.25, 7], [0.69, 0.17, 5], [0.80, 0.12, 4]];
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

/* The figure, facing right toward the low sun. Units are roughly centimetres of a
   seated person: hip at the origin, head around y = -62, floor at y = +46. */
function scFigure(ctx, pal, st, next, mix, t){
  const lean = st.lean + (next.lean - st.lean) * mix;
  const droop = st.droop + (next.droop - st.droop) * mix;
  const sway = st.sway + (next.sway - st.sway) * mix;
  const sipMs = st.sip + (next.sip - st.sip) * mix;
  const nb = Math.round(st.bottles + (next.bottles - st.bottles) * mix);

  const scale = Math.max(0.95, Math.min(2.1, scH / 150));
  const gx = scW * 0.57, gy = scH * 0.845;
  const wob = Math.sin(t / 900) * sway + Math.sin(t / 430) * sway * 0.45;

  // The sip: a short raise and tilt, then back. Eased so it is not robotic. Suppressed
  // once the head is down, because the hand is on the table by then.
  const ph = (t % sipMs) / sipMs;
  const sip = (droop < 0.72 && ph < 0.24) ? Math.sin(ph / 0.24 * Math.PI) : 0;

  ctx.save();
  ctx.translate(gx, gy);
  ctx.scale(scale, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // ---- the table, in front of the figure, with the evening's bottles on it
  ctx.fillStyle = pal.table;
  ctx.fillRect(28, -30, 76, 4);                        // top
  ctx.fillRect(60, -26, 4, 72);                        // pedestal
  ctx.beginPath();
  ctx.ellipse(62, 46, 20, 4, 0, 0, Math.PI * 2);       // foot
  ctx.fill();

  ctx.fillStyle = pal.fig;
  for(let i = 0; i < nb; i++){
    const bx = 34 + i * 11.5;
    ctx.fillRect(bx, -47, 5.4, 17);                    // body
    ctx.fillRect(bx + 1.7, -55, 2, 8);                 // neck
    ctx.fillRect(bx + 1.1, -57, 3.2, 2);               // cap
  }

  // ---- everything above the hip sways as one, and leans further as the night goes
  ctx.save();
  ctx.rotate(wob);

  // seat and stool legs
  ctx.fillStyle = pal.fig;
  ctx.fillRect(-20, -2, 34, 5);
  ctx.lineWidth = 4;
  ctx.strokeStyle = pal.fig;
  ctx.beginPath();
  ctx.moveTo(-14, 3); ctx.lineTo(-19, 46);
  ctx.moveTo(8, 3);   ctx.lineTo(13, 46);
  ctx.stroke();

  // legs: thigh forward to the knee, shin down to the floor
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(-6, -4); ctx.lineTo(26, -2);
  ctx.stroke();
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(26, -2); ctx.lineTo(30, 42);
  ctx.stroke();
  ctx.lineWidth = 7;                                    // foot
  ctx.beginPath();
  ctx.moveTo(30, 44); ctx.lineTo(42, 44);
  ctx.stroke();

  ctx.save();
  ctx.rotate(-lean);                                    // torso tips forward over the table

  // torso: a tapered trunk from hip to shoulder. Narrower at the top than the head is
  // wide, which is half of what makes the head read as a head.
  ctx.beginPath();
  ctx.moveTo(-13, -2);
  ctx.quadraticCurveTo(-17, -26, -12, -46);
  ctx.lineTo(4, -48);
  ctx.quadraticCurveTo(9, -26, 10, -2);
  ctx.closePath();
  ctx.fill();

  // neck: a real gap between shoulders and skull, which is the other half
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-4, -46); ctx.lineTo(-2, -56);
  ctx.stroke();

  // head, drooping toward the table as the stages advance
  ctx.save();
  ctx.translate(-2, -56);
  ctx.rotate(droop * 1.15 - sip * 0.34);
  ctx.beginPath();
  ctx.arc(0, -11, 11.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();                                      // nose, so the profile reads
  ctx.moveTo(10, -11); ctx.lineTo(16.5, -8.2); ctx.lineTo(10, -5.6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();                                      // a loose tuft of hair
  ctx.moveTo(-11, -16); ctx.quadraticCurveTo(-4, -26, 7, -17);
  ctx.quadraticCurveTo(-2, -20, -11, -16);
  ctx.fill();
  ctx.restore();

  // the near arm, stroked rather than filled so it stands clear of the trunk.
  // At the last stage it lies flat on the table instead of holding anything.
  const slump = droop > 0.72;
  ctx.lineWidth = 7.5;
  ctx.beginPath();
  if(slump){
    ctx.moveTo(2, -42);
    ctx.lineTo(20, -34);
    ctx.lineTo(44, -31);
  }else{
    const ex = 14, ey = -24 + sip * 3;                  // elbow stays low and tucked
    const hx = 30 - sip * 18, hy = -36 - sip * 16;      // hand comes back to the mouth
    ctx.moveTo(1, -43);
    ctx.lineTo(ex, ey);
    ctx.lineTo(hx, hy);
  }
  ctx.stroke();

  if(!slump){
    const hx = 30 - sip * 18, hy = -36 - sip * 16;
    ctx.save();
    ctx.translate(hx + 3, hy - 4);
    ctx.rotate(-sip * 0.85);
    ctx.beginPath();                                    // a small tumbler
    ctx.moveTo(-4, -7); ctx.lineTo(4, -7); ctx.lineTo(3, 3); ctx.lineTo(-3, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
  ctx.restore();
}

function scDraw(t){
  const ctx = scCtx, pal = scPalette();
  const idx = Math.floor((t % SC_CYCLE) / SC_STAGE_MS);
  const within = ((t % SC_CYCLE) % SC_STAGE_MS) / SC_STAGE_MS;
  const st = SC_STAGES[idx];
  const next = SC_STAGES[Math.min(SC_STAGES.length - 1, idx + 1)];
  // Only blend over the last fifth of a stage, so each one is legible before it moves on.
  const mix = within < 0.8 ? 0 : (within - 0.8) / 0.2;

  const g = ctx.createLinearGradient(0, 0, 0, scH);
  g.addColorStop(0, pal.sky[0]);
  g.addColorStop(0.55, pal.sky[1]);
  g.addColorStop(1, pal.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, scW, scH);

  // The sun sits to the RIGHT of the figure, so the eye runs title, then figure, then
  // the distance it is looking into.
  const sx = scW * 0.84, sy = scH * 0.58;
  const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, scH * 0.62);
  halo.addColorStop(0, pal.glow);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, scW, scH);
  ctx.fillStyle = pal.sun;
  ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.arc(sx, sy, scH * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  scHills(ctx, pal);
  scFigure(ctx, pal, st, next, mix, t);

  scLeaves.forEach(s => {
    scLeaf(ctx, s, pal);
    s.y += s.drift * s.z * 0.55;
    s.x += Math.sin(t / 1000 + s.phase) * 0.55 * s.z;
    s.r += s.spin * 0.012;
    if(s.y - 10 > scH){ s.y = -12; s.x = Math.random() * scW; }
  });

  const cap = document.querySelector("#scene-cap");
  if(cap && cap.dataset.s !== String(idx)){
    cap.dataset.s = String(idx);
    cap.textContent = st.cap;
  }
}

function scStop(){
  if(scRAF){ cancelAnimationFrame(scRAF); scRAF = null; }
  window.removeEventListener("resize", scOnResize);
  document.removeEventListener("visibilitychange", scOnVis);
}

function scOnResize(){
  if(!scCanvas || !scCanvas.isConnected) return;
  scResize();
  scSeedLeaves();
}

function scOnVis(){
  // Pausing on a hidden tab is not a nicety: a background canvas is pure battery cost
  // for something nobody is looking at.
  if(document.hidden){
    if(scRAF){ cancelAnimationFrame(scRAF); scRAF = null; }
  }else if(!scRAF && scCanvas && scCanvas.isConnected){
    scLoop();
  }
}

function scLoop(){
  scRAF = requestAnimationFrame(() => {
    if(!scCanvas || !scCanvas.isConnected){ scStop(); return; }
    scDraw(performance.now() - scStart);
    scLoop();
  });
}

function buildScene(){
  scStop();
  scCanvas = document.querySelector("#scene");
  if(!scCanvas || !scCanvas.getContext) return;
  scCtx = scCanvas.getContext("2d");
  scResize();
  scSeedLeaves();

  const still = window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(still){
    // One frame, taken part way through the evening so the scene has something in it,
    // and no loop at all.
    scDraw(SC_STAGE_MS * 1.5);
    const cap = document.querySelector("#scene-cap");
    if(cap) cap.textContent = SC_STAGES[1].cap;
    return;
  }
  scStart = performance.now();
  window.addEventListener("resize", scOnResize);
  document.addEventListener("visibilitychange", scOnVis);
  scLoop();
}
