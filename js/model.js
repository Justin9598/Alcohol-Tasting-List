
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
                    ["sweetness","Sweetness"],["yeast","Yeast"]]
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
