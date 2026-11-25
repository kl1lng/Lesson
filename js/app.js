/* PhysLab: каркас урока (навигация, таймер, задания, баллы) и подключение лабораторий. */
(function () {
  "use strict";
  var PL = window.PL, $ = PL.$, $$ = PL.$$, mk = PL.mk, store = PL.store;

  /* ---------- навигация ---------- */
  var slides = $$(".slide"), cur = 0, visited = {}, stepsEl = $("#steps");
  slides.forEach(function (s, i) {
    var b = PL.el("button", { type: "button", text: s.dataset.title }, stepsEl);
    b.addEventListener("click", function () { go(i); });
  });
  function go(i) {
    cur = PL.clamp(i, 0, slides.length - 1); visited[cur] = 1;
    slides.forEach(function (s, k) { s.classList.toggle("active", k === cur); });
    $$("button", stepsEl).forEach(function (b, k) {
      if (k === cur) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      b.classList.toggle("done", !!visited[k] && k !== cur);
    });
    var act = $$("button", stepsEl)[cur]; if (act && act.scrollIntoView) act.scrollIntoView({ inline: "center", block: "nearest" });
    window.scrollTo(0, 0);
    if (slides[cur].dataset.title.indexOf("Итоги") > -1) renderScore();
    try { history.replaceState(null, "", "#" + (cur + 1)); } catch (e) {}
  }
  $("#prev").addEventListener("click", function () { go(cur - 1); });
  $("#next").addEventListener("click", function () { go(cur + 1); });
  document.addEventListener("keydown", function (e) {
    var t = e.target.tagName; if (t === "TEXTAREA" || t === "INPUT") return;
    if (e.key === "ArrowRight") go(cur + 1); else if (e.key === "ArrowLeft") go(cur - 1);
    else if ("tTеЕ".indexOf(e.key) > -1 && e.key.length === 1) toggleTeacher();
    else if ("fFаА".indexOf(e.key) > -1 && e.key.length === 1) toggleFull();
  });
  function toggleTeacher() { var on = document.body.classList.toggle("teacher"); $("#tTeacher").setAttribute("aria-pressed", on); }
  function toggleFull() { if (!document.fullscreenElement) { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); } else { document.exitFullscreen && document.exitFullscreen(); } }
  $("#tTeacher").addEventListener("click", toggleTeacher); $("#tFull").addEventListener("click", toggleFull);
  $("#tTheme").addEventListener("click", function () { var r = document.documentElement; r.setAttribute("data-theme", r.getAttribute("data-theme") === "dark" ? "light" : "dark"); });
  $("#tSound").addEventListener("click", function () { PL.sound.on = !PL.sound.on; this.setAttribute("aria-pressed", PL.sound.on); PL.pop(2); });

  /* ---------- таймер 10 + 30 + 5 ---------- */
  var phases = [["Старт", 600], ["Середина", 1800], ["Конец", 300]], total = 2700, el = 0, run = false, tid = null;
  function fmt(s) { s = Math.max(0, s); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
  function paint() {
    var acc = 0, idx = 0; for (; idx < phases.length; idx++) { if (el < acc + phases[idx][1]) break; acc += phases[idx][1]; }
    if (idx >= phases.length) { $("#phase").textContent = "Время вышло"; $("#clock").textContent = "00:00"; return; }
    $("#phase").textContent = phases[idx][0]; $("#clock").textContent = fmt(acc + phases[idx][1] - el);
  }
  var PLAY = '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>', PAUSE = '<svg viewBox="0 0 24 24"><path d="M8 4v16M16 4v16"/></svg>';
  $("#tplay").addEventListener("click", function () {
    run = !run; this.innerHTML = run ? PAUSE : PLAY;
    if (run) tid = setInterval(function () { el++; paint(); if (el >= total) { clearInterval(tid); run = false; $("#tplay").innerHTML = PLAY; } }, 1000); else clearInterval(tid);
  });
  $("#treset").addEventListener("click", function () { clearInterval(tid); run = false; el = 0; $("#tplay").innerHTML = PLAY; paint(); });
  paint();

  /* ---------- слайд 1: мини-электроскоп ---------- */
  var e1 = new PL.Electroscope($("#e1"), { startN: -8, tools: ["hand", "pl"], autoCharge: true });
  e1.onChange = function () { if (!e1.busy) $("#e1Msg").textContent = ""; };
  var _t = e1.touch; e1.onTouch = function (t) { var m = $("#e1Msg"); m.textContent = e1.msg; m.className = "feedback " + (t.c ? "ok" : "bad"); };
  $("#e1Reset").addEventListener("click", function () { e1.reset(-8); $("#e1Msg").textContent = "Электроскоп снова заряжен отрицательно."; $("#e1Msg").className = "feedback"; });
  $("#guessBtn").addEventListener("click", function () { $("#topicReveal").classList.add("on"); });

  /* ---------- слайд 3: анимация и сортировка ---------- */
  (function () {
    var c = $("#condDots"), d = $("#dielDots"), dots = [], i, j, k;
    for (i = 0; i < 14; i++) { var x = 24 + Math.random() * 270, y = 22 + Math.random() * 68; dots.push({ n: mk("circle", { cx: x, cy: y, r: 7, fill: "var(--neg)" }, c), x: x, y: y, vx: (Math.random() - .5) * 1.6, vy: (Math.random() - .5) * 1.6 }); }
    for (j = 0; j < 5; j++) for (k = 0; k < 14; k++) mk("circle", { cx: 24 + k * 22.5, cy: 24 + j * 17, r: 6, fill: k % 2 ? "var(--neg)" : "var(--pos)" }, d);
    if (PL.rm) return;
    (function tick() { dots.forEach(function (o) { o.x += o.vx; o.y += o.vy; if (o.x < 16 || o.x > 304) o.vx *= -1; if (o.y < 16 || o.y > 94) o.vy *= -1; o.n.setAttribute("cx", o.x); o.n.setAttribute("cy", o.y); }); requestAnimationFrame(tick); })();
  })();
  (function () {
    var mats = [
      ["Медная проволока", 1], ["Железный гвоздь", 1], ["Алюминиевая ложка", 1], ["Водопроводная вода", 1], ["Раствор соли", 1], ["Тело человека", 1], ["Влажная почва", 1], ["Графитовый грифель", 1],
      ["Стекло", 0], ["Пластмассовая линейка", 0], ["Резина", 0], ["Сухое дерево", 0], ["Бумага", 0], ["Воздух", 0], ["Фарфор", 0], ["Янтарь", 0], ["Шёлк", 0], ["Керосин", 0]
    ];
    var pool = $("#sortPool"), sel = null, done = 0, wrong = 0, msg = $("#sortMsg");
    mats.slice().sort(function () { return Math.random() - .5; }).forEach(function (m) {
      var b = PL.el("button", { class: "chip", type: "button", text: m[0] }, pool);
      b.addEventListener("click", function () { $$(".chip.sel", pool).forEach(function (x) { x.classList.remove("sel"); }); sel = { m: m, b: b }; b.classList.add("sel"); });
    });
    function drop(isC, box) {
      if (!sel) return; var ok = (sel.m[1] === 1) === isC, b = sel.b;
      if (ok) { b.classList.remove("sel"); b.classList.add("right", "used"); var n = b.cloneNode(true); n.className = "chip right"; n.style.pointerEvents = "none"; box.appendChild(n); done++; msg.textContent = done + " из " + mats.length + " разложено" + (wrong ? ", ошибок: " + wrong : ""); msg.className = "feedback ok"; PL.pop(done % 5); }
      else { wrong++; b.classList.add("wrong"); setTimeout(function () { b.classList.remove("wrong"); }, 600); msg.textContent = "Не туда: " + sel.m[0] + ". Подумай, есть ли в нём свободные заряды."; msg.className = "feedback bad"; }
      sel = null; if (done === mats.length) { msg.textContent = "Все предметы разложены! Ошибок: " + wrong; }
    }
    $("#zoneC").addEventListener("click", function () { drop(true, $("#inC")); });
    $("#zoneD").addEventListener("click", function () { drop(false, $("#inD")); });
    ["#zoneC", "#zoneD"].forEach(function (s) { $(s).addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.click(); } }); });
  })();

  /* ---------- слайд 4: лампочка ---------- */
  new PL.LampLab($("#lamp"), { pool: $("#matPool"), log: $("#lampLog"), msg: $("#lampMsg"), cnt: $("#lampCnt") });

  /* ---------- слайд 5: песочница ---------- */
  var e2 = new PL.Electroscope($("#e2"), { rods: true, rod: "ebonite", tools: true });
  var e2log = $("#e2Log");
  function fmtN(n) { var r = Math.round(n * 10) / 10; return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r); }
  e2.onChange = function (s, es) {
    $("#roN").textContent = fmtN(s.N); $("#roTh").textContent = Math.round(s.theta * 2) + "°";
    $("#roRod").textContent = Math.abs(s.rodQ) > .4 ? fmtN(s.rodQ) : "нет заряда";
    $("#e2Narr").textContent = es.describe();
  };
  e2.onTouch = function (t, old, nw) {
    if (e2log.querySelector(".empty")) e2log.innerHTML = "";
    var tr = PL.el("tr", { class: "new" }, e2log); var changed = Math.abs(old - nw) > .3;
    [t.n, changed ? "опали" : "не изменились", t.why].forEach(function (x) { PL.el("td", { text: x }, tr); });
    e2.onChange(e2.state, e2);
  };
  $$("#rodSeg button").forEach(function (b) { b.addEventListener("click", function () { $$("#rodSeg button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); e2.setRodKind(b.dataset.r); }); });
  $("#rubBtn").addEventListener("click", function () { e2.rub(); });
  $("#e2Remove").addEventListener("click", function () { e2.removeRod(); });
  $("#e2Zero").addEventListener("click", function () { e2.reset(0); e2.setRodKind(e2.rodKind); });
  $$("#modeSeg button").forEach(function (b) { b.addEventListener("click", function () { $$("#modeSeg button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); e2.setMode(b.dataset.m); }); });
  /* кнопки предметов в песочнице лежат внутри хоста e2 — перенесём под нужную подпись */
  (function () { var pool = $(".pool", $("#e2")); if (pool) $("#e2ToolsHost").appendChild(pool); })();

  /* ---------- слайд 6: индукция по шагам ---------- */
  var e3 = new PL.Electroscope($("#e3"), { rods: true, rod: "ebonite" });
  e3.onChange = function () {};
  var step = 0, steps = [
    { t: "Шаг 1. Потираем палочку", x: "Эбонитовую палочку потёрли о мех: она получила избыток электронов и заряжена отрицательно.", run: function (d) { e3.rub(d); }, next: "Шаг 2: поднести палочку →" },
    { t: "Шаг 2. Подносим палочку, не касаясь", x: "Свободные электроны электроскопа отталкиваются от отрицательной палочки и уходят вниз на листочки. Листочки заряжаются отрицательно и расходятся, шарик становится положительным.", run: function (d) { e3.moveRodTo(262, 96, d); }, next: "Шаг 3: коснуться рукой →" },
    { t: "Шаг 3. Касаемся шарика рукой", x: "Электроны уходят по телу человека в землю. Листочки опадают, а положительный заряд шарика остаётся рядом с палочкой.", run: function (d) { e3.onTouch = function () {}; e3.touch(PL.TOOLS[2]); setTimeout(d, 1600); }, next: "Шаг 4: убрать руку →" },
    { t: "Шаг 4. Убираем руку", x: "Электроскоп изолирован, палочка по-прежнему рядом. Положительный заряд остаётся на шарике. Внешний вид не изменился.", run: function (d) { e3.msg = "Руку убрали: электроскоп изолирован, положительный заряд остался."; e3.update(); d(); }, next: "Шаг 5: убрать палочку →" },
    { t: "Шаг 5. Убираем палочку", x: "Заряд электроскопа остаётся положительным: он распределился по шарику и листочкам, и листочки разошлись. Это индуцированный (наведённый) заряд, противоположный заряду палочки.", run: function (d) { e3.msg = ""; e3.removeRod(); setTimeout(d, 800); }, next: "Готово. С начала ↺" }
  ];
  function paintStep() {
    $("#infNo").textContent = step;
    if (step === 0) { $("#infTitle").textContent = "Шаг 0"; $("#infText").textContent = "Нажми «Шаг 1» и наблюдай за зарядами."; $("#infNext").textContent = "Шаг 1: потереть палочку →"; return; }
    var s = steps[step - 1]; $("#infTitle").textContent = s.t; $("#infText").textContent = s.x; $("#infNext").textContent = step === 5 ? "С начала ↺" : steps[step].t.replace(/^Шаг (\d)\. (.*)$/, function (m, n, t) { return "Шаг " + n + ": " + t.toLowerCase() + " →"; });
  }
  $("#infNext").addEventListener("click", function () {
    if (e3.busy) return;
    if (step === 5) { step = 0; e3.reset(0); e3.setRodKind("ebonite"); paintStep(); return; }
    step++; var s = steps[step - 1]; $("#infTitle").textContent = s.t; $("#infText").textContent = s.x; $("#infNo").textContent = step;
    s.run(function () {});
    $("#infNext").textContent = step === 5 ? "С начала ↺" : steps[step].t.replace(/^Шаг (\d)\. (.*)$/, function (m, n, t) { return "Шаг " + n + ": " + t.toLowerCase() + " →"; });
  });
  $("#infPrev").addEventListener("click", function () { step = 0; e3.reset(0); e3.setRodKind("ebonite"); paintStep(); });
  paintStep();

  /* ---------- слайд 8: A/B/C/D ---------- */
  (function () {
    var host = $("#check1"), msg = $("#check1Msg");
    ["листочки опадут", "листочки останутся разведёнными", "листочки разойдутся ещё сильнее", "электроскоп получит заряд противоположного знака"].forEach(function (t, i) {
      var b = PL.el("button", { class: "opt", type: "button", html: '<span class="k">' + "ABCD"[i] + '</span><span></span>' }, host); b.children[1].textContent = t;
      b.addEventListener("click", function () {
        $$(".opt", host).forEach(function (x) { x.classList.remove("right", "wrong"); });
        if (i === 1) { b.classList.add("right"); msg.textContent = "Верно! Стекло — диэлектрик: заряд в землю не уходит."; msg.className = "feedback ok"; }
        else { b.classList.add("wrong"); msg.textContent = "Подумай ещё: может ли заряд уйти в землю через стекло?"; msg.className = "feedback bad"; }
      });
    });
  })();

  /* ---------- слайд 10: порядок шагов ---------- */
  function orderTask(p, steps, right, key) {
    var pool = $("#" + p + "pool"), list = $("#" + p + "list"), empty = $("#" + p + "empty"), msg = $("#" + p + "msg"), chosen = [];
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
      var ok = 0; $$("li", list).forEach(function (li, k) { var g = chosen[k] === right[k]; li.classList.toggle("right", g); li.classList.toggle("wrong", !g); if (g) ok++; });
      var exact = chosen.length === right.length && ok === right.length, pts = exact ? 2 : (ok >= Math.ceil(right.length * .6) ? 1 : 0);
      store.set(key, pts); updateScore();
      msg.textContent = exact ? "Верно! 2 балла." : "Сходится шагов: " + ok + " из " + right.length + ". Баллы: " + pts + ". Можно сбросить и попробовать ещё.";
      msg.className = "feedback " + (exact ? "ok" : "bad");
    });
    render();
  }
  orderTask("o1", ["Поставить нейтральный шарик на изолирующую подставку", "Поднести отрицательный шарик к нейтральному, не касаясь", "Коснуться нейтрального шарика рукой", "Убрать руку", "Убрать отрицательный шарик", "Коснуться нейтрального шарика отрицательным шариком"], [0, 1, 2, 3, 4], "s2a");
  orderTask("o2", ["Поставить два одинаковых шарика на изолирующих подставках вплотную", "Поднести к ним отрицательный шарик, не касаясь", "Раздвинуть шарики", "Убрать отрицательный шарик", "Коснуться шариков рукой"], [0, 1, 2, 3], "s2b");
  (function () {
    var host = $("#q3"), items = [["а) медная проволока в руке", true], ["б) стеклянная палочка", false], ["в) пластмассовая линейка", false], ["г) рука", true]];
    items.forEach(function (it, i) { var l = PL.el("label", { class: "desc", html: '<input type="checkbox" data-i="' + i + '"><span></span>' }, host); l.children[1].textContent = it[0] + " — листочки опадут"; });
    $("#q3check").addEventListener("click", function () {
      var ok = true; items.forEach(function (it, i) { if ($("input[data-i='" + i + "']", host).checked !== it[1]) ok = false; });
      store.set("s2c1", ok ? 1 : 0); updateScore();
      $("#q3msg").textContent = ok ? "Верно: листочки опадут в случаях а и г. +1 балл. Теперь объясни и отметь второй дескриптор." : "Не совсем. Подумай, какие предметы проводят заряд.";
      $("#q3msg").className = "feedback " + (ok ? "ok" : "bad");
    });
  })();
  $$("#s2tabs button").forEach(function (b) { b.addEventListener("click", function () { $$("#s2tabs button").forEach(function (x) { x.classList.toggle("on", x === b); }); $$(".tpane").forEach(function (p) { p.hidden = p.id !== b.dataset.t; }); }); });

  /* ---------- баллы ---------- */
  $$("input[data-score]").forEach(function (c, i) { c.dataset.k = "d" + i; if (store.get(c.dataset.k)) c.checked = true; c.addEventListener("change", function () { store.set(c.dataset.k, c.checked ? 1 : 0); updateScore(); }); });
  ["s1text", "s3text", "x1", "x2", "x3"].forEach(function (id) { var t = $("#" + id); var v = store.get(id); if (v) t.value = v; t.addEventListener("input", function () { store.set(id, t.value); }); });
  function sums() {
    var s1 = 0, s3 = 0, s2c = 0;
    $$("input[data-score]").forEach(function (c) { if (c.checked) { if (c.dataset.score === "s1") s1++; else if (c.dataset.score === "s3") s3++; else s2c++; } });
    var s2 = (store.get("s2a", 0)) + (store.get("s2b", 0)) + (store.get("s2c1", 0)) + Math.min(1, s2c);
    return { s1: Math.min(2, s1), s2: Math.min(6, s2), s3: Math.min(2, s3) };
  }
  function updateScore() { var r = sums(); $("#scorePill").textContent = (r.s1 + r.s2 + r.s3) + " / 10"; }
  function renderScore() {
    var r = sums(), t = r.s1 + r.s2 + r.s3; $("#scoreBig").textContent = t;
    $("#scoreTable").innerHTML = "<tr><td>Этап 1</td><td><b>" + r.s1 + "</b> из 2</td></tr><tr><td>Этап 2</td><td><b>" + r.s2 + "</b> из 6</td></tr><tr><td>Этап 3</td><td><b>" + r.s3 + "</b> из 2</td></tr>";
    $("#grade").textContent = t >= 9 ? "Отлично" : t >= 7 ? "Хорошо" : t >= 5 ? "Удовлетворительно" : "Нужна помощь учителя";
  }
  $$(".goal").forEach(function (c, i) { if (store.get("g" + i)) c.checked = true; c.addEventListener("change", function () { store.set("g" + i, c.checked ? 1 : 0); var n = $$(".goal").filter(function (x) { return x.checked; }).length; $("#goalMsg").textContent = n === 3 ? "Все цели достигнуты!" : n + " из 3 целей достигнуто. Что осталось непонятным — напиши в выходном билете."; }); });
  $("#resetAll").addEventListener("click", function () { if (confirm("Сбросить все ответы?")) { store.clear(); location.reload(); } });
  updateScore();
  var h = parseInt((location.hash || "").slice(1), 10);
  go(h > 0 && h <= slides.length ? h - 1 : 0);
})();
