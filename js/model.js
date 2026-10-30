
const BY_ID = {};
DATA.forEach(d => { BY_ID[d.id] = d; });

/* ------------------------------------------------------------------------
   ONE categories table. Colour, order, which detail tab a category uses and
   whether it counts on the price screen all read from here. v1 needed six
   parallel maps plus two validations to add a type; with eleven categories that
   was untenable. Dark variants are DERIVED from the hue, not stored, for the
   same reason: one definition, nothing to keep in step.
   ------------------------------------------------------------------------ */
const CATEGORIES = {
  "Sake":       {ord:1, col:"#4f6f8a", det:"Sake Detail",   price:true},
  "Craft Sake": {ord:2, col:"#4f7a4a", det:"Sake Detail",   price:true},
  "Makgeolli":  {ord:3, col:"#6b7033", det:"Other Detail",  price:true},
  "Umeshu":     {ord:4, col:"#9c6516", det:"Other Detail",  price:false},
  "Beer":       {ord:5, col:"#7d4a6b", det:"Other Detail",  price:false},
  "Whisky":     {ord:6, col:"#8a5a2b", det:"Whisky Detail", price:true},
  "Wine":       {ord:7, col:"#8d3f52", det:"Wine Detail",   price:true},
  "Shochu":     {ord:8, col:"#4f6a60", det:"Shochu Detail", price:true},
  "Soju":       {ord:9, col:"#6b4f85", det:"Shochu Detail", price:true},
  "Spirit":     {ord:10, col:"#55597a", det:"Other Detail", price:true},
  "Cocktail":   {ord:11, col:"#18707f", det:"Other Detail", price:true}
};

/* Field order and labels per detail tab. The detail panel iterates whichever list
   the bottle's category points at, so adding a category adds no branching. */
const DET_FIELDS = {
  "Sake Detail":   [["grade","Grade"],["mill","Milling","pct"],["rice","Rice"],
                    ["yeast","Yeast"],["smv","SMV","smv"],["acidity","Acidity"]],
  "Whisky Detail": [["age","Age statement"],["cask","Cask"],["region","Region"],
                    ["bottler","Bottler"],["kind","Type"],["caskStrength","Cask strength"],
                    ["peat","Peat","ppm"]],
  "Wine Detail":   [["vintage","Vintage"],["grape","Grapes"],["appellation","Appellation"],
                    ["colour","Colour"],["sweetness","Sweetness"],["oak","Oak"]],
  "Shochu Detail": [["base","Base"],["koji","Koji"],["distillation","Distillation"],
                    ["maturation","Maturation"]],
  "Other Detail":  [["base","Base"],["flavouring","Flavouring"],["maturation","Maturation"],
                    ["sweetness","Sweetness"],["yeast","Yeast"],["type","Type"]]
};

const SAT_FIELDS = [
  ["Appearance", [["clarity","Clarity"],["appIntensity","Intensity"],["colour","Colour"],
                  ["appOther","Other"]]],
  ["Nose",       [["noseCond","Condition"],["noseInt","Intensity"],["aroma","Aroma"]]],
  ["Palate",     [["sweet","Sweetness"],["acid","Acidity"],["umami","Umami"],
                  ["alcohol","Alcohol"],["body","Body"],["mousse","Mousse"],
                  ["flavInt","Flavour intensity"],["flavour","Flavour"],["palOther","Other"]]],
  ["Conclusion", [["finish","Finish"],["quality","Quality"],["category","Category"],
                  ["ginjoId","Ginjo"],["prod","Production"],["special","Special style"]]]
];


/* ------------------------------------------------------------------------
   MAIN CATEGORIES, added 2026-10-30 for the welcome shelf.

   This is a LAYER OVER `CATEGORIES`, not a replacement for it. The eleven
   categories still drive colours, the Collection pills, the charts, the map
   pins and the price screen; nothing below is read by any of them. Six shelf
   bottles group those eleven into what a drinker would call them, and each
   one splits by whatever its bottles actually record.

   Wine gets its own bottle rather than sitting under Spirits. It is fermented,
   not distilled, and filing it under Spirits would be a visible error on the
   shelf for the sake of a round number.

   `sub` names the function that derives a subcategory. A main with no `sub`,
   or whose bottles record nothing for it, simply shows no second row, which is
   how Beer behaves until its Type column is filled in.
   ------------------------------------------------------------------------ */
const MAINS = {
  "Sake":      {ord:1, col:"#4f6f8a", cats:["Sake","Craft Sake"],                 sub:"grade"},
  "Makgeolli": {ord:2, col:"#6b7033", cats:["Makgeolli"],                         sub:null},
  "Beer":      {ord:3, col:"#7d4a6b", cats:["Beer"],                              sub:"beerType"},
  "Wine":      {ord:4, col:"#8d3f52", cats:["Wine"],                              sub:"colour"},
  "Spirits":   {ord:5, col:"#8a5a2b", cats:["Whisky","Shochu","Soju","Umeshu","Spirit"], sub:"kind"},
  "Cocktails": {ord:6, col:"#18707f", cats:["Cocktail"],                          sub:null}
};

/* cat -> main, built once rather than searched. Any category not listed above
   would fall through as undefined, which the shelf counts would then show as a
   missing bottle rather than silently dropping it. */
const MAIN_OF_CAT = {};
Object.keys(MAINS).forEach(m => MAINS[m].cats.forEach(c => { MAIN_OF_CAT[c] = m; }));

const mainOf = d => MAIN_OF_CAT[d.cat];
const mainOrder = m => (MAINS[m] || {}).ord || 99;

/* The spirit shelf holds five different drinks and the ledger already knows which
   is which: the sub IS the category it came from, renamed where the drinker's word
   differs from the schema's. Umeshu is a liqueur; a gin and an apple brandy have no
   type recorded anywhere, so they group honestly as "Other spirits" rather than
   being guessed at. */
const SPIRIT_KIND = {"Whisky":"Whisky", "Shochu":"Shochu", "Soju":"Soju",
                     "Umeshu":"Liqueur", "Spirit":"Other spirits"};

function subOf(d){
  const m = MAINS[mainOf(d)];
  if(!m || !m.sub) return null;
  const D = d.det || {};
  if(m.sub === "grade")    return d.cat === "Craft Sake" ? "Craft Sake" : (D.grade || "No grade");
  if(m.sub === "kind")     return SPIRIT_KIND[d.cat] || null;
  if(m.sub === "beerType") return D.type || null;
  if(m.sub === "colour")   return D.colour || null;
  return null;
}

/* Sub ordering: sake follows the brewing ladder with Craft Sake and No grade at the
   end, spirits follow the shelf order above, everything else is alphabetical. An
   alphabetical grade list would put Daiginjo above Junmai Daiginjo, which is the
   wrong way round and the Collection pills already avoid it. */
const SUB_ORDER = {
  "Sake": GRADE_ORDER.concat(["Craft Sake", "No grade"]),
  "Spirits": ["Whisky", "Shochu", "Soju", "Liqueur", "Other spirits"]
};
function subRank(main, s){
  const list = SUB_ORDER[main];
  if(!list) return 0;
  const i = list.indexOf(s);
  return i < 0 ? 99 : i;
}
