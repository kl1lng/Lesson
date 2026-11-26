/* PhysLab: страница ученика. Все проверки выполняет сервер, ключей ответов здесь нет. */
(function () {
  "use strict";
  var PL = window.PL, $ = PL.$, $$ = PL.$$;
  var CODE = (new URLSearchParams(location.search).get("c") || "").toUpperCase(), SK = "physlab-student-" + CODE, pollT = null;
  var sid = null, auto = {}, answers = {};

  /* ---------- связь с сервером ---------- */
  function api(path, body) {
    var opt = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {};
    return fetch(path, opt).then(function (r) { return r.json().then(function (j) { j._status = r.status; return j; }); })
      .then(function (j) { $("#offline").hidden = true; return j; })
      .catch(function () { $("#offline").hidden = false; setSave("не сохранено", "bad"); return null; });
  }
  function setSave(t, cls) { var s = $("#save"); s.textContent = t; s.className = "status " + (cls || ""); }
  function send(task, value, cb) {
    setSave("сохраняю…");
    return api("/api/answer", { sid: sid, task: task, value: value }).then(function (r) {
      if (r && r.ok !== undefined && !r.error) { setSave("сохранено", "ok"); }
      else if (r && r.error) { setSave("ошибка", "bad"); }
      if (cb && r) cb(r); refreshScore(); return r;
    });
  }
  function refreshScore() {
    return api("/api/state?sid=" + encodeURIComponent(sid)).then(function (s) {
      if (!s || s.error) return; auto = s.auto || {};
      $("#pill").textContent = s.points + " / 10 · " + s.rank + " место";
      progress(s.answers || {});
      var app = $("#app"), was = app.dataset.state;
      app.dataset.state = s.status === "running" ? "running" : s.status === "finished" ? "finished" : "lobby";
      if (s.status === "lobby") $("#waitCount").textContent = "Игроков в сессии: " + s.players;
      if (s.status === "finished") { $("#doneTitle").textContent = "Урок завершён"; $("#doneText").innerHTML = 'Твоё место: <span class="rank">' + s.rank + '</span> из ' + s.players + '. Баллы: <b>' + s.points + '</b> из 10.'; clearInterval(pollT); }
    });
  }
  function progress(a) {
    var done = 0, total = 7;
    if (a.check1 !== undefined) done++;
    if (a.s1 && a.s1.length > 15) done++; if (a.o1) done++; if (a.o2) done++; if (a.q3) done++;
    if (a.s3 && a.s3.length > 15) done++; if (a.x1 || a.x2 || a.x3) done++;
    $("#bar").style.width = Math.round(done / total * 100) + "%";
  }

  /* ---------- вход по ссылке с кодом сессии ---------- */
  function start(sidv, st) {
    sid = sidv; answers = st.answers || {}; auto = st.auto || {};
    $("#login").hidden = true; $("#app").hidden = false; $("#who").textContent = (st.name || "");
    restore(); refreshScore(); clearInterval(pollT); pollT = setInterval(refreshScore, 4000);
  }
  if (!CODE) { $("#sessInfo").textContent = "Нет кода сессии в ссылке. Попроси у учителя ссылку заново."; $("#go").disabled = true; }
  else api("/api/session?c=" + CODE).then(function (r) {
    if (!r || r.error) { $("#sessInfo").textContent = (r && r.error) || "Нет связи с сервером."; $("#go").disabled = true; return; }
    $("#sessInfo").textContent = "Физика · " + r.title + (r.cls ? " · " + r.cls : "") + " · код " + CODE;
    $("#who").textContent = r.title;
  });
  $("#go").addEventListener("click", function () {
    var name = $("#nm").value.trim(), saved = null; try { saved = JSON.parse(localStorage.getItem(SK) || "null"); } catch (e) {}
    api("/api/join", { code: CODE, name: name, sid: saved && saved.name === name ? saved.sid : undefined }).then(function (r) {
      if (!r) { $("#loginMsg").textContent = "Нет связи с сервером."; return; }
      if (r.error) { $("#loginMsg").textContent = r.error; return; }
      try { localStorage.setItem(SK, JSON.stringify({ sid: r.sid, name: r.name })); } catch (e) {}
      start(r.sid, { answers: r.answers, auto: r.auto, name: r.name });
    });
  });
  $("#nm").addEventListener("keydown", function (e) { if (e.key === "Enter") $("#go").click(); });
  $("#tTheme").addEventListener("click", function () { var r = document.documentElement; r.setAttribute("data-theme", r.getAttribute("data-theme") === "dark" ? "light" : "dark"); });

  /* ---------- проверка A-D ---------- */
  var mcqHost = $("#check1");
  ["листочки опадут", "листочки останутся разведёнными", "листочки разойдутся ещё сильнее", "электроскоп получит заряд противоположного знака"].forEach(function (t, i) {
    var b = PL.el("button", { class: "opt", type: "button", html: '<span class="k">' + "ABCD"[i] + '</span><span></span>' }, mcqHost); b.children[1].textContent = t;
    b.addEventListener("click", function () {
      send("check1", i, function (r) {
        $$(".opt", mcqHost).forEach(function (x) { x.classList.remove("right", "wrong"); });
        b.classList.add(r.ok ? "right" : "wrong");
        $("#check1Msg").textContent = r.ok ? "Верно! Стекло — диэлектрик: заряд в землю не уходит." : "Подумай ещё: может ли заряд уйти в землю через стекло?";
        $("#check1Msg").className = "feedback " + (r.ok ? "ok" : "bad");
      });
    });
  });

  /* ---------- открытые ответы (автосохранение) ---------- */
  [["s1", "stS1"], ["s3", "stS3"], ["q3exp", "stQ3exp"], ["x1", "stX"], ["x2", "stX"], ["x3", "stX"], ["e1", ""], ["e2", ""], ["e3", ""], ["e4", ""]].forEach(function (p) {
    var t = $("#" + p[0]), timer = null;
    function flush() { clearTimeout(timer); send(p[0], t.value); }
    t.addEventListener("input", function () { setSave("пишу…"); clearTimeout(timer); timer = setTimeout(flush, 1200); });
    t.addEventListener("blur", flush);
  });
  $$(".goal").forEach(function (c, i) { c.addEventListener("change", function () { send("goals", $$(".goal").map(function (x) { return x.checked ? 1 : 0; })); }); });

  /* ---------- подсказки: учитель видит, кто ими пользовался ---------- */
  $$("details.hint").forEach(function (d) { d.addEventListener("toggle", function () {
    if (!d.open) return; var used = (answers.hints || []).slice(); if (used.indexOf(d.dataset.h) < 0) { used.push(d.dataset.h); answers.hints = used; send("hints", used); }
  }); });

  /* ---------- порядок шагов ---------- */
  var STEPS = {
    o1: ["Поставить нейтральный шарик на изолирующую подставку", "Поднести отрицательный шарик к нейтральному, не касаясь", "Коснуться нейтрального шарика рукой", "Убрать руку", "Убрать отрицательный шарик", "Коснуться нейтрального шарика отрицательным шариком"],
    o2: ["Поставить два одинаковых шарика на изолирующих подставках вплотную", "Поднести к ним отрицательный шарик, не касаясь", "Раздвинуть шарики", "Убрать отрицательный шарик", "Коснуться шариков рукой"]
  };
  function orderTask(p) {
    var steps = STEPS[p], pool = $("#" + p + "pool"), list = $("#" + p + "list"), empty = $("#" + p + "empty"), msg = $("#" + p + "msg"), chosen = [];
    var shuffled = steps.map(function (t, i) { return { t: t, i: i }; }).sort(function () { return Math.random() - .5; });
    function render() {
      pool.innerHTML = ""; list.innerHTML = "";
      shuffled.forEach(function (s) { var b = PL.el("button", { class: "chip" + (chosen.indexOf(s.i) > -1 ? " used" : ""), type: "button", text: s.t }, pool); b.addEventListener("click", function () { chosen.push(s.i); msg.textContent = ""; render(); }); });
      chosen.forEach(function (i) { PL.el("li", { text: steps[i] }, list); });
      empty.style.display = chosen.length ? "none" : "block";
    }
    $("#" + p + "undo").addEventListener("click", function () { chosen.pop(); render(); });
    $("#" + p + "reset").addEventListener("click", function () { chosen = []; msg.textContent = ""; render(); });
    $("#" + p + "check").addEventListener("click", function () {
      send(p, chosen.map(function (i) { return steps[i]; }), function (r) {
        $$("li", list).forEach(function (li, k) { /* подсветку по позициям даёт только число совпадений */ li.classList.remove("right", "wrong"); });
        msg.textContent = r.ok ? "Верно! 2 балла." : "Совпало шагов: " + r.hit + " из " + r.total + ". Баллы за эту попытку: " + r.points + ". Лучший результат: " + r.best + ". Сбрось и попробуй ещё.";
        msg.className = "feedback " + (r.ok ? "ok" : "bad");
      });
    });
    render();
  }
  orderTask("o1"); orderTask("o2");
  (function () {
    var host = $("#q3"), items = ["а) медная проволока в руке", "б) стеклянная палочка", "в) пластмассовая линейка", "г) рука"];
    items.forEach(function (t, i) { var l = PL.el("label", { class: "desc", html: '<input type="checkbox" data-i="' + i + '"><span></span>' }, host); l.children[1].textContent = t + " — листочки опадут"; });
    $("#q3check").addEventListener("click", function () {
      var sel = []; $$("input", host).forEach(function (c, i) { if (c.checked) sel.push(i); });
      send("q3", sel, function (r) { $("#q3msg").textContent = r.ok ? "Верно! Теперь объясни свой выбор." : "Не совсем. Подумай, какие предметы проводят заряд."; $("#q3msg").className = "feedback " + (r.ok ? "ok" : "bad"); });
    });
  })();
  $$("#s2tabs button").forEach(function (b) { b.addEventListener("click", function () { $$("#s2tabs button").forEach(function (x) { x.classList.toggle("on", x === b); }); $$(".tpane").forEach(function (p) { p.hidden = p.id !== b.dataset.t; }); }); });

  /* ---------- восстановление сохранённых ответов ---------- */
  function restore() {
    ["s1", "s3", "q3exp", "x1", "x2", "x3", "e1", "e2", "e3", "e4"].forEach(function (k) { if (typeof answers[k] === "string" && $("#" + k)) $("#" + k).value = answers[k]; });
    if (Array.isArray(answers.goals)) $$(".goal").forEach(function (c, i) { c.checked = !!answers.goals[i]; });
    if (Array.isArray(answers.q3)) answers.q3.forEach(function (i) { var c = $("#q3 input[data-i='" + i + "']"); if (c) c.checked = true; });
    if (answers.check1 !== undefined) { var b = $$("#check1 .opt")[answers.check1]; if (b) b.classList.add(answers.check1 === 1 ? "right" : "wrong"); }
  }

  /* ---------- лаборатории ---------- */
  var e2 = new PL.Electroscope($("#e2"), { rods: true, rod: "ebonite", tools: true });
  e2.onChange = function (s, es) { $("#e2Narr").textContent = es.describe(); };
  (function () { var pool = $(".pool", $("#e2")); if (pool) $("#e2ToolsHost").appendChild(pool); })();
  $$("#rodSeg button").forEach(function (b) { b.addEventListener("click", function () { $$("#rodSeg button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); e2.setRodKind(b.dataset.r); }); });
  $("#rubBtn").addEventListener("click", function () { e2.rub(); });
  $("#e2Remove").addEventListener("click", function () { e2.removeRod(); });
  $("#e2Zero").addEventListener("click", function () { e2.reset(0); e2.setRodKind(e2.rodKind); });
  new PL.LampLab($("#lamp"), { pool: $("#matPool"), msg: $("#lampMsg") });

  /* ---------- автовход, если уже заходил с этого устройства ---------- */
  var saved = null; try { saved = JSON.parse(localStorage.getItem(SK) || "null"); } catch (e) {}
  if (saved && saved.sid && CODE) {
    api("/api/state?sid=" + encodeURIComponent(saved.sid)).then(function (s) {
      if (s && !s.error) start(saved.sid, { answers: s.answers, auto: s.auto, name: s.name });
    });
  }
})();
