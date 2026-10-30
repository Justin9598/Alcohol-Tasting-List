/* ------------------------------------------------------------- screens */
let screenMode = "welcome";
const SCREENS = [["welcome","Welcome"],["list","Collection"],["rec","Recommend"],
                 ["map","Map"],["shops","Shops"],["chart","Charts"],["price","Spending"]];

function buildNav(){
  const el = document.querySelector("#nav");
  el.innerHTML = SCREENS.map(s =>
    '<button type="button" data-m="' + s[0] + '"' +
    (s[0] === screenMode ? ' aria-current="page"' : "") + ">" + esc(s[1]) + "</button>").join("");
  el.querySelectorAll("button").forEach(b =>
    b.addEventListener("click", () => { setScreenMode(b.dataset.m); menuClose(); }));
}

/* The tabs live behind the menu button now. It is a real button with aria-expanded and
   aria-controls, and the panel is hidden with the `hidden` attribute rather than with
   opacity, so the tabs are genuinely out of the tab order while closed instead of being
   invisible targets.

   Escape closes it, a click outside closes it, and focus returns to the button on
   Escape. A menu you can open but not close from the keyboard is a trap. */
function menuOpen(){
  const b = document.querySelector("#burger"), n = document.querySelector("#nav");
  if(!b || !n) return;
  n.hidden = false;
  b.setAttribute("aria-expanded", "true");
  b.setAttribute("aria-label", "Close menu");
  document.addEventListener("keydown", menuKey);
  document.addEventListener("click", menuAway, true);
}

function menuClose(){
  const b = document.querySelector("#burger"), n = document.querySelector("#nav");
  if(!b || !n) return;
  n.hidden = true;
  b.setAttribute("aria-expanded", "false");
  b.setAttribute("aria-label", "Open menu");
  document.removeEventListener("keydown", menuKey);
  document.removeEventListener("click", menuAway, true);
}

function menuKey(e){
  if(e.key !== "Escape") return;
  menuClose();
  const b = document.querySelector("#burger");
  if(b) b.focus();
}

function menuAway(e){
  const wrap = document.querySelector("#menu-wrap");
  if(wrap && !wrap.contains(e.target)) menuClose();
}

function menuToggle(){
  const b = document.querySelector("#burger");
  if(b && b.getAttribute("aria-expanded") === "true") menuClose();
  else menuOpen();
}

/* The timer clear sits on its OWN LINE before the if/else chain. Appending
   `else wpClearTimers()` to the first arm is a syntax error that kills the
   whole script, and setScreenMode re-enters buildWelcome on every return. */
function setScreenMode(mode){
  screenMode = mode;
  wpClearTimers();
  /* The scene is one requestAnimationFrame loop. Leaving it running behind six other
     screens is a flat battery for a decoration nobody can see, so it is stopped here
     and buildWelcome starts it again on the way back. */
  if(typeof scStop === "function") scStop();
  SCREENS.forEach(s => document.querySelector("#s-" + s[0]).classList.toggle("on", s[0] === mode));
  /* The wordmark in the bar is for every screen EXCEPT welcome, where the hero already
     carries the title in full and a second copy would just be clutter. */
  document.querySelector(".wrap").classList.toggle("at-welcome", mode === "welcome");
  /* The backdrop is painted only on the welcome screen. Everywhere else the canvas
     is display:none and the ordinary paper background takes over, so no other
     screen pays for it and none of them has to fight it for contrast. */
  document.body.classList.toggle("scene-on", mode === "welcome");
  buildNav();
  if(mode === "welcome") buildWelcome();
  else if(mode === "rec") buildRec();
  else if(mode === "map") buildMap();
  else if(mode === "shops") buildShops();
  else if(mode === "chart") buildChart();
  else if(mode === "price") buildPrice();
  else if(mode === "list") render();
  window.scrollTo(0, 0);
}
