/* PhysLab: экран для доски (лобби, живая таблица, пьедестал). */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var CODE = (new URLSearchParams(location.search).get("c") || "").toUpperCase();
  var KEY = ""; try { KEY = localStorage.getItem("physlab-tkey") || ""; } catch (e) {}
  var rm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ROW = 82, rowEls = {}, lastRank = {}, lastPts = {}, lastState = "", seenNames = {}, podiumShown = false, viewTable = false, last = null;

  function host(path, body) { return fetch(path, { method: "POST", headers: { "Content-Type": "application/json", "X-Teacher-Key": KEY }, body: JSON.stringify(body || {}) }); }
  function setStatus(st) { host("/api/t/set-status", { code: CODE, status: st }).then(function (r) { if (r.status === 401) alert("Нужен ключ учителя: откройте teacher.html на этом же устройстве и войдите один раз."); else poll(); }); }
  $("#start").addEventListener("click", function () { setStatus("running"); });
  $("#finish").addEventListener("click", function () { podiumShown = false; viewTable = false; setStatus("finished"); });
  $("#again").addEventListener("click", function () { viewTable = true; render(last); });

  if (!CODE) { $("#err").hidden = false; $("#err").textContent = "Нет кода сессии в ссылке."; return; }
  $("#code").textContent = CODE;
  $("#url").textContent = location.origin.replace(/^https?:\/\//, "") + location.pathname.replace(/board\.html$/, "") + "student.html?c=" + CODE;
  var FULL = location.origin + location.pathname.replace(/board\.html$/, "") + "student.html?c=" + CODE;
  try { var svg = window.PL && PL.qr ? PL.qr.svg(FULL, 300) : ""; if (svg) { $("#qr").innerHTML = svg; $("#qrbox").hidden = false; } } catch (e) {}
  if (KEY) { $("#start").hidden = false; }

  function poll() { fetch("/api/board?c=" + CODE, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) { if (j.error) { $("#err").hidden = false; $("#err").textContent = "Сессия не найдена."; return; } $("#err").hidden = true; last = j; render(j); }).catch(function () { $("#err").hidden = false; $("#err").textContent = "Нет связи с сервером…"; }); }
  setInterval(poll, 2000); poll();

  function render(j) {
    if (!j) return;
    $("#title").textContent = "PhysLab · " + j.title; $("#sub").textContent = (j.cls ? j.cls + " · " : "") + "код " + j.code;
    var st = j.status === "finished" && viewTable ? "running" : j.status;
    document.body.dataset.state = st;
    $("#start").hidden = !KEY || j.status !== "lobby"; $("#finish").hidden = !KEY || j.status !== "running" || viewTable && false;
    $("#again").hidden = !(j.status === "finished" && !viewTable);
    $("#finish").hidden = !KEY || st !== "running" || j.status === "finished";
    if (st === "lobby") lobby(j); else if (st === "running") table(j); else end(j);
    lastState = st;
  }

  /* лобби: имена всплывают */
  function lobby(j) {
    $("#count").textContent = j.players.length ? "В игре: " + j.players.length : "Ждём игроков…";
    var box = $("#names");
    j.players.forEach(function (p) {
      if (seenNames[p.name]) return; seenNames[p.name] = 1;
      var d = document.createElement("div"); d.className = "nm"; d.textContent = p.name; box.appendChild(d);
    });
    Array.prototype.slice.call(box.children).forEach(function (el) { if (!j.players.some(function (p) { return p.name === el.textContent; })) { delete seenNames[el.textContent]; el.remove(); } });
  }

  /* живая таблица с перестановкой строк (FLIP) */
  function table(j) {
    var lb = $("#lb"), n = j.players.length;
    $("#runCount").textContent = n ? "Игроков: " + n + " · заданий выполнено в среднем " + (j.players.reduce(function (s, p) { return s + p.done; }, 0) / n).toFixed(1) + " из " + (j.players[0] ? j.players[0].total : 8) : "Пока никто не вошёл";
    var top0 = lb.getBoundingClientRect().top, avail = Math.max(120, window.innerHeight - top0 - 70);
    ROW = Math.max(34, Math.min(82, Math.floor(avail / Math.max(1, n))));
    lb.style.setProperty("--rh", (ROW - 8) + "px"); lb.style.height = (n * ROW) + "px";
    var names = {};
    j.players.forEach(function (p, i) {
      names[p.name] = 1;
      var el = rowEls[p.name];
      if (!el) {
        el = rowEls[p.name] = document.createElement("div"); el.className = "rowx";
        el.innerHTML = '<div class="rk"></div><div class="nmx"></div><div class="pbar"><i></i></div><div class="pts">0</div>';
        el.querySelector(".nmx").textContent = p.name; el.style.transform = "translateY(" + (i * ROW + 40) + "px)"; el.style.opacity = 0; lb.appendChild(el);
        requestAnimationFrame(function () { el.style.transition += ",opacity .5s"; el.style.opacity = 1; });
      }
      el.className = "rowx" + (p.rank <= 3 && p.points > 0 ? " r" + p.rank : "");
      el.style.transform = "translateY(" + (i * ROW) + "px)";
      el.querySelector(".rk").textContent = p.rank;
      el.querySelector(".pbar i").style.width = Math.round(p.done / p.total * 100) + "%";
      countTo(el.querySelector(".pts"), lastPts[p.name] || 0, p.points); lastPts[p.name] = p.points;
      if (lastRank[p.name] && p.rank < lastRank[p.name]) { el.classList.add("up"); }
      lastRank[p.name] = p.rank;
    });
    Object.keys(rowEls).forEach(function (k) { if (!names[k]) { rowEls[k].remove(); delete rowEls[k]; } });
  }
  function countTo(el, from, to) {
    if (from === to) { el.textContent = to; return; }
    if (rm) { el.textContent = to; return; }
    var t0 = performance.now(), dur = 700;
    (function f(t) { var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(f); })(t0);
  }

  /* итоги: пьедестал */
  function end(j) {
    var pod = $("#podium"), top = j.players.slice(0, 3), rest = j.players.slice(3);
    if (!podiumShown) {
      podiumShown = true; pod.innerHTML = "";
      [[2, top[1]], [1, top[0]], [3, top[2]]].forEach(function (x) {
        if (!x[1]) return; var c = document.createElement("div"); c.className = "pcol p" + x[0];
        c.innerHTML = '<div class="pname"></div><div class="ppts"></div><div class="pbase">' + x[0] + "</div>";
        c.querySelector(".pname").textContent = x[1].name; c.querySelector(".ppts").textContent = x[1].points + " из 10"; pod.appendChild(c);
      });
      pod.classList.remove("show"); void pod.offsetWidth; pod.classList.add("show");
      if (top.length && !rm) setTimeout(confetti, 3200);
    }
    var r = $("#rest"); r.innerHTML = "";
    rest.forEach(function (p) { var d = document.createElement("div"); d.innerHTML = "<span></span><b></b>"; d.children[0].textContent = p.rank + ". " + p.name; d.children[1].textContent = p.points + " / 10"; r.appendChild(d); });
  }

  /* конфетти */
  function confetti() {
    var cv = $("#conf"), ctx = cv.getContext("2d"); cv.width = innerWidth; cv.height = innerHeight;
    var cols = ["#f4c542", "#3b82f6", "#ef4444", "#22c55e", "#ff8a3d", "#a855f7"], ps = [];
    for (var i = 0; i < 160; i++) ps.push({ x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * .5, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, s: 6 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[i % cols.length] });
    var t0 = performance.now();
    (function f(t) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ps.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
      if (t - t0 < 4500) requestAnimationFrame(f); else ctx.clearRect(0, 0, cv.width, cv.height);
    })(t0);
  }
})();
