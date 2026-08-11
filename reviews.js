/**
 * reviews.js — the empty-until-real evidence slot, vanilla JS version.
 * See README.md in this folder. Never seed this with fake reviews.
 *
 * Usage: <div id="reviews-slot"></div>
 *        <script src="/reviews.js" data-src="/reviews.json" data-mailto="you@example.com"></script>
 */
(function () {
  var script = document.currentScript;
  var dataSrc = (script && script.getAttribute("data-src")) || "/reviews.json";
  var mailto = (script && script.getAttribute("data-mailto")) || "";
  var slot = document.getElementById("reviews-slot");
  if (!slot) return;

  var css = document.createElement("style");
  css.textContent = [
    "#reviews-slot{font-family:var(--sans,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif)}",
    "#reviews-slot .rv-h{font-family:var(--mono,ui-monospace,monospace);font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint,#888);margin-bottom:14px}",
    "#reviews-slot .rv-empty{border:1px dashed var(--line,#ddd);border-radius:8px;padding:24px;color:var(--muted,#666);font-size:14px}",
    "#reviews-slot .rv-empty a{color:var(--accent,#2563eb)}",
    "#reviews-slot .rv-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}",
    "#reviews-slot .rv-card{border:1px solid var(--line,#ddd);border-radius:8px;padding:16px;background:var(--panel,transparent)}",
    "#reviews-slot .rv-quote{color:var(--text,inherit);font-size:14px;line-height:1.5}",
    "#reviews-slot .rv-quote::before{content:'\\201C'}#reviews-slot .rv-quote::after{content:'\\201D'}",
    "#reviews-slot .rv-meta{margin-top:10px;font-size:12px;color:var(--faint,#888)}",
  ].join("\n");
  document.head.appendChild(css);

  function renderEmpty() {
    var mailtoHref = mailto ? "mailto:" + mailto + "?subject=A review for you" : "#";
    slot.innerHTML =
      '<div class="rv-h">Reviews</div>' +
      '<div class="rv-empty">No reviews yet. Be the first — ' +
      (mailto ? '<a href="' + mailtoHref + '">tell us how it went</a>.' : "reviews go here once real customers leave them.") +
      "</div>";
  }

  function renderReviews(reviews) {
    var cards = reviews
      .map(function (r) {
        var meta = [r.author, r.context, r.date].filter(Boolean).join(" · ");
        return (
          '<div class="rv-card"><p class="rv-quote">' +
          escapeHtml(r.quote) +
          '</p><p class="rv-meta">' +
          escapeHtml(meta) +
          "</p></div>"
        );
      })
      .join("");
    slot.innerHTML = '<div class="rv-h">Reviews</div><div class="rv-grid">' + cards + "</div>";
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  fetch(dataSrc)
    .then(function (r) {
      return r.ok ? r.json() : { reviews: [] };
    })
    .then(function (data) {
      var reviews = (data && data.reviews) || [];
      if (reviews.length === 0) renderEmpty();
      else renderReviews(reviews);
    })
    .catch(renderEmpty);
})();
