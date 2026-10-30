/* ------------------------------------------------------------ map popup */
/* Deliberately minimal: photo, the spec fields, and the note. Type, size, paid,
   acidity, styles and purchases belong to the list row, not here. */
function bottleDetailHTML(d){
  const D = det(d), bits = [];
  if(D.grade) bits.push(["Grade", D.grade]);
  if(D.mill != null) bits.push(["Milling", D.mill + "%"]);
  if(d.abv != null) bits.push(["ABV", d.abv + "%"]);
  if(D.smv != null) bits.push(["SMV", (D.smv > 0 ? "+" : "") + D.smv]);
  if(D.rice) bits.push(["Rice", D.rice]);
  if(D.yeast) bits.push(["Yeast", D.yeast]);
  // Same split as the list row: photograph left, the spec fields beside it.
  const photo = d.img
    ? '<div class="bd-photo"><img src="' + d.img + '" loading="lazy" decoding="async"'
      + ' alt="' + esc(d.n) + '"></div>' : "";
  const fields = bits.length
    ? '<div class="bd-grid">' + bits.map(b => kv(b[0], esc(b[1]))).join("") + "</div>" : "";
  return (photo || fields
            ? '<div class="bd-split pop-split">' + photo +
              '<div class="bd-main">' + fields + "</div></div>"
            : "") +
    (d.note ? '<div class="imported-note" style="margin-top:9px">' + esc(d.note) + "</div>" : "");
}
