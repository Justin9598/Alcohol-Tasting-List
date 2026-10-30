
/* ======================================================================
   STAGE 4: the screens carried over from v1
   ====================================================================== */
const det = d => d.det || {};
const sizeOf = d => (d.purchases[0] || {}).size || "";
const gradeOf = d => det(d).grade || "";
const FP_CACHE = {};

function styleCol(s){
  const pair = STYLE_COLOR[s];
  if(!pair) return ["var(--paper-2)", "var(--ink-soft)"];
  if(!DARK) return pair;
  const [h,sat] = hexToHsl(pair[1]);
  return ["hsl(" + h.toFixed(0) + " " + sat.toFixed(0) + "% 70% / .20)",
          "hsl(" + h.toFixed(0) + " " + Math.max(26, sat * .88).toFixed(0) + "% 74%)"];
}
function gradeCol(g){
  const c = GRADE_COLOR[g];
  if(!c) return "var(--ink-soft)";
  if(!DARK) return c;
  const [h,s] = hexToHsl(c);
  return "hsl(" + h.toFixed(0) + " " + Math.max(26, s * .88).toFixed(0) + "% 74%)";
}
function regionOf(p){
  if(!p) return null;
  for(const k in REGION_MAP) if(REGION_MAP[k].some(x => p.indexOf(x) >= 0)) return k;
  return "away";
}
function sizeBucket(sz){
  if(isPourSize(sz)) return "taste";
  return mlOf(sz) >= 1000 ? "big" : "bottle";
}

/* ----------------------------------------------------------------------
   flavourProfile: five axes, each {v, c, src} where c is a confidence.
   Values read straight off the bottle score 1; values inferred from a style,
   a grade or a label keyword score lower and render faded, so a guess never
   poses as a fact. Derived, never stored on DATA, so they stay in step when a
   field changes. Memoised by id because quizScore calls this once per bottle
   per path and the sweep walks hundreds of thousands of paths.

   The AXES AND SCORING ARE CATEGORY BLIND. Only the inference rules are not,
   so each detail tab gets its own rule function. The sake rules are v1's,
   unchanged.

   The rest were written from the same principles with no data behind them, and
   each one has since been wrong the first time a real bottle met it. Whisky
   keyed peat on a ppm figure nobody prints (2026-10-27). Wine matched a bare
   /sauvignon/ that fires inside Cabernet Sauvignon, and read the variety for one
   purpose only. Shochu scored every rule AT .5, which the shared ABV rule had
   already taken, so its base rules could not fire at all, and it read three of
   its four columns, never koji. All three are fixed and all three were found by
   dumping profiles for real rows, not by any verifier: v2diff proves the two
   files agree, which a wrong inference does not disturb.

   Only Other Detail is still untested in that sense. Treat it the same way.
   ---------------------------------------------------------------------- */
const FP_RULES = {
  "Sake Detail": function(d, D, set, has){
    if(D.smv != null) set("sweet", D.smv < 0 ? "sweet" : D.smv < 5 ? "balanced" : "dry",
                          1, "SMV " + (D.smv > 0 ? "+" : "") + D.smv);
    if(has("Kijoshu") || has("Nigori") || has("Doburoku"))
      set("sweet", "sweet", .55, "cloudy and sweet-leaning");
    if(D.mill != null) set("body", D.mill <= 50 ? "light" : D.mill <= 65 ? "medium" : "full",
                           .55, D.mill + "% milled");
    if(has("Genshu") || has("Muroka") || has("Taruzake") || has("Kijoshu"))
      set("body", "full", .7, "undiluted");
    if(has("Yamahai") || has("Kimoto") || has("Mizumoto")) set("body", "full", .65, "old-school starter");
    if(GIN.indexOf(D.grade) >= 0) set("aroma", "aromatic", .65, "ginjo class");
    if(DAI.indexOf(D.grade) >= 0) set("aroma", "aromatic", .75, "daiginjo class");
    if(DAY.indexOf(D.grade) >= 0) set("aroma", "clean", .5, D.grade ? D.grade.toLowerCase() : null);
    if(has("Yamahai") || has("Kimoto") || has("Mizumoto") || has("Taruzake"))
      set("aroma", "savoury", .8, "yamahai or kimoto");
    if(D.acidity != null) set("sharp", D.acidity < 1.3 ? "soft" : D.acidity <= 1.7 ? "medium" : "sharp",
                              1, "acidity " + D.acidity);
    if(has("Yamahai") || has("Kimoto") || has("Mizumoto")) set("sharp", "sharp", .6, "yamahai or kimoto");
  },
  "Whisky Detail": function(d, D, set){
    const cask = (D.cask || "") + " " + (D.kind || "");
    if(/sherry|oloroso|px|pedro|port|madeira|sauternes/i.test(cask))
      set("sweet", "sweet", .6, "sweet-wine cask"), set("body", "full", .6, "sweet-wine cask");
    if(/bourbon|ex-bourbon|oak/i.test(cask)) set("sweet", "balanced", .4, "bourbon cask");
    /* A ppm figure is the strong signal, but outside the Islay specialists almost nobody
       prints one: the first real whisky in this file declares 煙燻泥煤 on the back and
       PEATED on the front with no number anywhere, and the old test dropped the single
       most defining thing about the bottle. So fall back to the declaration, at a lower
       confidence than a measured figure, which is the same tiering the rest of the engine
       uses. Scoped to Whisky Detail, so no other category can match on it. */
    if(D.peat != null && D.peat !== "" && parseFloat(D.peat) > 0){
      set("aroma", "savoury", .8, D.peat + " ppm peat");
      set("sharp", "sharp", .5, "peated");
    } else if(/\bpeat(ed|y)\b|islay/i.test((d.n || "") + " " + (d.note || ""))){
      set("aroma", "savoury", .6, "peated on the label");
      set("sharp", "sharp", .4, "peated on the label");
    }
    if(D.caskStrength === "Yes") set("body", "full", .7, "cask strength");
    if(D.age != null && parseFloat(D.age) >= 15) set("body", "full", .5, D.age + " year");
    set("texture", "still", .9, null);
  },
  "Wine Detail": function(d, D, set){
    const colour = D.colour || "", grape = D.grape || "";
    if(D.sweetness) set("sweet", /^(sweet|luscious|medium-sweet)/i.test(D.sweetness) ? "sweet"
                        : /^dry/i.test(D.sweetness) ? "dry" : "balanced", 1, D.sweetness);
    /* Colour is the coarsest reading this tab carries: not every red is full bodied and
       not every white is sharp. It is therefore scored BELOW the variety rules, which
       overrule it wherever a grape is actually named. */
    if(/red/i.test(colour)) set("body", "full", .55, "red");
    if(/white/i.test(colour))
      set("body", "light", .52, "white"), set("sharp", "sharp", .45, "white");
    if(/rose|orange/i.test(colour)) set("body", "medium", .5, colour.toLowerCase());
    if(/sparkling/i.test(colour))
      set("texture", "fizz", 1, "sparkling"), set("sharp", "sharp", .6, "sparkling");
    /* Fortified runs 18 to 20%, so a full body is about as near certain as this tab
       gets. Sweetness is deliberately NOT inferred from it: fino and dry madeira exist,
       and a guess on the weakest axis in the file is worse than leaving a gap. */
    if(/fortified/i.test(colour)) set("body", "full", .8, "fortified");

    /* The variety is the most informative thing a wine label prints, and until now this
       tab read it for exactly one purpose. Body, acidity and aroma all follow from it
       more reliably than from colour, so each gets its own vocabulary. A blend matches
       every variety it names; where two fire on one axis at the same confidence the
       first wins, which is deterministic rather than arbitrary. */
    if(GRAPE_FULL.test(grape)) set("body", "full", .65, "full-bodied variety");
    if(GRAPE_LIGHT.test(grape)) set("body", "light", .65, "light-bodied variety");
    if(GRAPE_CRISP.test(grape)) set("sharp", "sharp", .6, "high-acid variety");
    if(GRAPE_SOFT.test(grape)) set("sharp", "soft", .55, "low-acid variety");
    if(GRAPE_AROMATIC.test(grape)) set("aroma", "aromatic", .65, "aromatic variety");
    if(GRAPE_SAVOURY.test(grape)) set("aroma", "savoury", .55, "earthy variety");
    if(GRAPE_NEUTRAL.test(grape)) set("aroma", "clean", .5, "neutral variety");
    /* Oak outranks a neutral variety and loses to an aromatic one, which is the right
       order: barrel character is what a Chardonnay tastes of and is not what a Riesling
       tastes of. */
    if(D.oak) set("body", "full", .58, "oak"), set("aroma", "savoury", .55, "oak");
  },
  "Shochu Detail": function(d, D, set){
    const base = D.base || "", koji = D.koji || "", dist = D.distillation || "";
    const label = (d.n || "") + " " + (d.note || "");
    /* EVERY VALUE HERE MUST CLEAR .5, because the shared ABV rule has already claimed
       body at .5 and its bands are cut for sake: anything distilled is over 16% and so
       reads "full" before this function is ever called. The old barley and rice rules
       sat AT .5 and could therefore never take effect, since set() replaces only on a
       strictly higher confidence. Measured on the one soju in the file, whose body came
       back as "17% ABV" rather than as "barley". */
    if(/sweet potato|imo/i.test(base))
      set("body", "full", .6, "sweet potato"), set("aroma", "savoury", .6, "sweet potato");
    if(/barley|mugi/i.test(base))
      set("body", "medium", .6, "barley"), set("aroma", "clean", .45, "barley");
    if(/rice|kome/i.test(base))
      set("body", "light", .6, "rice"), set("aroma", "aromatic", .45, "rice");
    if(/buckwheat|soba/i.test(base))
      set("body", "light", .55, "buckwheat"), set("aroma", "clean", .45, "buckwheat");
    if(/brown sugar|kokuto/i.test(base))
      set("sweet", "sweet", .55, "brown sugar"), set("body", "medium", .55, "brown sugar");
    if(/chestnut|kuri/i.test(base))
      set("sweet", "sweet", .5, "chestnut"), set("aroma", "aromatic", .5, "chestnut");

    /* Koji was read by NOTHING, though it is one of only four columns the tab carries
       and the first thing a shochu brewer names. Black gives the rich, mellow, faintly
       sweet style, white the clean one, yellow the fruity sake-like one. Nuruk is the
       Korean starter and arrives here because Soju points at this tab. Scored above the
       base rules: where the two disagree the koji is the sharper signal. */
    if(/black/i.test(koji))
      set("body", "full", .65, "black koji"), set("aroma", "savoury", .6, "black koji"),
      set("sweet", "sweet", .45, "black koji");
    if(/white/i.test(koji))
      set("body", "medium", .65, "white koji"), set("aroma", "clean", .6, "white koji");
    if(/yellow/i.test(koji))
      set("aroma", "aromatic", .65, "yellow koji"), set("sharp", "sharp", .55, "yellow koji");
    if(/nuruk/i.test(koji))
      set("aroma", "savoury", .55, "nuruk"), set("body", "medium", .55, "nuruk");

    /* The Distillation column's own vocabulary is honkaku against korui, so the other
       axis every shochu label prints, reduced pressure against atmospheric, has nowhere
       to live but the note. It is read from there, the same fallback the whisky peat
       rule uses and scoped to this tab alone so nothing else can match on it.

       It outranks koji, and that is not a tiering mistake. The whisky rule scores a
       label declaration BELOW a measured figure because both speak to one fact. These
       are two different facts, so they are ranked by how much each one decides: the
       still gates which compounds survive at all, the koji only shapes what is left. */
    if(/korui|multiple/i.test(dist))
      set("body", "light", .6, "korui"), set("aroma", "clean", .65, "korui"),
      set("sharp", "soft", .5, "korui");
    if(/reduced pressure|genatsu|減圧/.test(label))
      set("body", "light", .68, "reduced pressure"),
      set("aroma", "aromatic", .68, "reduced pressure"),
      set("sharp", "sharp", .5, "reduced pressure");
    else if(/atmospheric|joatsu|常圧/.test(label))
      set("body", "full", .68, "atmospheric"), set("aroma", "savoury", .68, "atmospheric");

    if(D.maturation) set("body", "full", .5, "matured"), set("aroma", "savoury", .5, "matured");
    /* A distilled spirit carries almost no acid, so soft is the floor rather than a
       blank axis. set() keeps the highest confidence whatever the order, so every rule
       above that names an edge still overrides this. */
    set("sharp", "soft", .4, "distilled");
    set("texture", "still", .9, null);
  },
  "Other Detail": function(d, D, set){
    if(D.sweetness) set("sweet", /^(sweet|luscious|medium-sweet)/i.test(D.sweetness) ? "sweet"
                        : /^dry/i.test(D.sweetness) ? "dry" : "balanced", 1, D.sweetness);
    if(D.flavouring) set("aroma", "aromatic", .7, "flavoured");
    if(D.maturation) set("body", "full", .4, "matured");
  }
};

function flavourProfile(d){
  if(FP_CACHE[d.id]) return FP_CACHE[d.id];
  const st = d.styles || [], has = x => st.indexOf(x) >= 0;
  const name = (d.n || "") + " " + (d.note || "");
  const P = {};
  const set = (axis, v, c, src) => { if(!P[axis] || P[axis].c < c) P[axis] = {v:v, c:c, src:src}; };

  /* Shared rules, true of any category: label words, ABV, texture from styles,
     and a WSET note, which feeds in at confidence 1 as the read-off-the-glass tier.
     That is why the Aroma filter, the quiz and the seasonal panel cannot drift:
     there is exactly one definition of aroma behind all three. */
  if(/karakuchi|\bdry\b|brut/i.test(name)) set("sweet", "dry", .7, "dry on the label");
  if(/amakuchi|kijoshu|dessert/i.test(name)) set("sweet", "sweet", .7, "sweet on the label");
  if(d.abv != null) set("body", d.abv < 13 ? "light" : d.abv <= 16 ? "medium" : "full",
                        .5, d.abv + "% ABV");
  const sa = [].concat((d.sat && d.sat.aroma) || [], (d.sat && d.sat.flavour) || []);
  if(sa.some(t => /ginj|fruity|floral/i.test(t))) set("aroma", "aromatic", 1, "tasting note");
  if(sa.some(t => /cereal|grain|lactic|dairy|\bage\b/i.test(t))) set("aroma", "savoury", 1, "tasting note");
  if(has("Flavoured") || has("Hopped"))
    set("aroma", "aromatic", .8, "something added"), set("sharp", "sharp", .5, "something added");

  FP_RULES[d.detKind || (CATEGORIES[d.cat] || {}).det] &&
    FP_RULES[d.detKind || (CATEGORIES[d.cat] || {}).det](d, det(d), set, has);

  // Texture is never missing. Set last so a category rule cannot be overridden by it.
  if(!P.texture){
    if(has("Sparkling")) set("texture", "fizz", 1, "sparkling");
    else if(has("Doburoku")) set("texture", "cloudy", 1, "doburoku");
    else if(has("Nigori")) set("texture", "cloudy", .95, "nigori");
    else if(has("Origarami")) set("texture", "cloudy", .8, "origarami");
    /* Makgeolli is cloudy by definition, not by style: takju (탁주) on the Korean label
       literally means cloudy liquor, so this is the regulated food type and not a
       brewer's claim. Keyed off the category rather than a Nigori tag so every future
       makgeolli gets it without anyone remembering, and so a Japanese style term is not
       stretched over a Korean one. */
    else if(d.cat === "Makgeolli") set("texture", "cloudy", .9, "makgeolli");
    else set("texture", "still", .7, null);
  }
  if(!P.aroma && has("Nama")) set("aroma", "aromatic", .35, "unpasteurised");
  if(!P.sharp && (has("Nama") || has("Genshu"))) set("sharp", "medium", .4, null);
  if(!P.sharp && d.cat === "Craft Sake") set("sharp", "sharp", .4, null);
  if(!P.sweet && DAI.indexOf(gradeOf(d)) >= 0) set("sweet", "balanced", .3, null);
  if(!P.body && DAI.indexOf(gradeOf(d)) >= 0) set("body", "light", .4, null);

  FP_CACHE[d.id] = P;
  return P;
}
