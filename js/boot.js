/* -------------------------------------------------------------------- boot */
document.querySelector("#q").addEventListener("input", e => {
  fQuery = e.target.value.trim(); page = 1; render();
});
document.querySelector("#sort").addEventListener("change", e => {
  fSort = e.target.value; page = 1; render();
});
document.querySelector("#reset").addEventListener("click", () => {
  fQuery = ""; fCat = "All"; fGrade = "All"; fFav = false; fSort = "name"; page = 1;
  document.querySelector("#q").value = "";
  document.querySelector("#sort").value = "name";
  buildControls(); render();
});
document.querySelector("#theme-btn").addEventListener("click", toggleTheme);
document.querySelector("#burger").addEventListener("click", menuToggle);

applyTheme();
buildControls();
render();
setScreenMode("welcome");