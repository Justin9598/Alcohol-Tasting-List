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
    b.addEventListener("click", () => setScreenMode(b.dataset.m)));
}

/* The timer clear sits on its OWN LINE before the if/else chain. Appending
   `else wpClearTimers()` to the first arm is a syntax error that kills the
   whole script, and setScreenMode re-enters buildWelcome on every return. */
function setScreenMode(mode){
  screenMode = mode;
  wpClearTimers();
  SCREENS.forEach(s => document.querySelector("#s-" + s[0]).classList.toggle("on", s[0] === mode));
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
