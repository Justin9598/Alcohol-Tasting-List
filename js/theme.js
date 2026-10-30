/* ------------------------------------------------------------------- theme */
const DARK_BASE = {
  "--paper":"#15171b","--paper-2":"#1b1e23","--card":"#20242b",
  "--ink":"#ece6da","--ink-soft":"#a29a8b","--line":"#343a43","--sea":"#11161d",
  "--tile-filter":"invert(1) hue-rotate(180deg) brightness(.92) contrast(.9) saturate(.85)",
  "--shadow":"0 1px 0 rgba(0,0,0,.25), 0 10px 28px -18px rgba(0,0,0,.85)"
};
const LIGHT_BASE = {
  "--paper":"#f4f0e6","--paper-2":"#efe9db","--card":"#fbf9f3",
  "--ink":"#1f1c17","--ink-soft":"#5e574c","--line":"#ddd4c0","--sea":"#dde6ec",
  "--tile-filter":"none",
  "--shadow":"0 1px 0 rgba(31,28,23,.04), 0 8px 24px -16px rgba(31,28,23,.35)"
};
/* Seasonal palettes. Only the PAPER surfaces, the line and the accent shift; ink,
   --sea and --tile-filter are deliberately not in here, so these can layer over either
   base without touching contrast. The tile filter is a light-or-dark fact and has no
   seasonal reading at all, so a season that carried one would fight the base set it was
   layered on. The sea is excluded for the same reason as the ink: land is drawn
   on --card, which every season moves, and a season that happened to pick a card close
   to the water colour would erase the coastline. Spring leans plum and blossom, summer cool and pale, autumn warm and
   russet, winter cold and blue. */
const SEASON_LIGHT = {
  spring:{"--paper":"#f6eff0","--paper-2":"#f1e6e8","--card":"#fdf8f8",
          "--line":"#e3d2d4","--indigo":"#6d3f55","--indigo-soft":"#8d6076"},
  summer:{"--paper":"#edf2f2","--paper-2":"#e4ecec","--card":"#f8fbfb",
          "--line":"#cadcdb","--indigo":"#23585f","--indigo-soft":"#4e8188"},
  autumn:{"--paper":"#f5efe3","--paper-2":"#eee5d4","--card":"#fcf8f0",
          "--line":"#ddcdb0","--indigo":"#7a4a1d","--indigo-soft":"#9d6f42"},
  winter:{"--paper":"#eef0f4","--paper-2":"#e5e8ee","--card":"#f9fafc",
          "--line":"#d0d6e0","--indigo":"#2c3f63","--indigo-soft":"#5a6c8d"}
};
const SEASON_DARK = {
  spring:{"--paper":"#1b1419","--paper-2":"#21181d","--card":"#271d24",
          "--line":"#3e2f38","--indigo":"#8d6076","--indigo-soft":"#b48ca0"},
  summer:{"--paper":"#111a1b","--paper-2":"#162022","--card":"#1b282a",
          "--line":"#2d4043","--indigo":"#4e8188","--indigo-soft":"#7fb0b6"},
  autumn:{"--paper":"#1a1611","--paper-2":"#201b14","--card":"#27211a",
          "--line":"#3d3426","--indigo":"#9d6f42","--indigo-soft":"#c19a6f"},
  winter:{"--paper":"#13161c","--paper-2":"#181c24","--card":"#1e232c",
          "--line":"#333b48","--indigo":"#5a6c8d","--indigo-soft":"#8a9ab8"}
};
const SEASON_LABEL = {spring:"Spring", summer:"Summer", autumn:"Autumn", winter:"Winter"};
/* In-memory override first, because localStorage throws on file: and data: origins,
   which is where this file is actually opened from. */
let themeOverride = null;
function wantDark(){
  if(themeOverride) return themeOverride === "dark";
  try{
    const v = localStorage.getItem("drinks-theme");
    if(v) return v === "dark";
  }catch(e){ /* sandboxed origin */ }
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
/* The single entry point for appearance. It resolves season AND mode, applies a FULL
   base set, then layers the seasonal surfaces on top.

   Applying the full base every time is not tidiness: the seasonal sets carry no --ink,
   --ink-soft or --shadow, so a stale dark --ink surviving into light would destroy text
   contrast. Base first, season second, always. */
function applySeason(){
  DARK = wantDark();
  const season = seasonNow();
  const base = DARK ? DARK_BASE : LIGHT_BASE;
  const tint = (DARK ? SEASON_DARK : SEASON_LIGHT)[season] || {};
  const root = document.documentElement.style;
  Object.keys(base).forEach(k => root.setProperty(k, base[k]));
  Object.keys(tint).forEach(k => root.setProperty(k, tint[k]));
  root.colorScheme = DARK ? "dark" : "light";
  document.querySelector("#theme-btn").textContent = DARK ? "Light" : "Dark";
  const s = document.querySelector("#season-note");
  if(s) s.textContent = SEASON_LABEL[season];
}
const applyTheme = applySeason;   // the old name, still used by the boot sequence
function toggleTheme(){
  themeOverride = DARK ? "light" : "dark";
  try{ localStorage.setItem("drinks-theme", themeOverride); }catch(e){}
  applyTheme();
  /* Charts, chips and the Leaflet tile layer all bake the current theme into
     generated markup, so the live screen is rebuilt rather than just recoloured. */
  render();
  setScreenMode(screenMode);
}
