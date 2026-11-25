/* PhysLab: панель учителя (сессии, ссылка, результаты, оценка по дескрипторам). */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var KEY = "", CODE = "", rows = [], sel = null, timer = null;
  var HINTS = { s1a: ["свободн"], s1b: ["медь", "желез", "металл", "стекл", "эбонит", "пластмасс", "резин"], s3a: ["сух", "влажн", "стека", "земл"], s3b: ["заземл", "увлажн", "принтер", "молни", "полез", "вредн"] };
  var CRIT = [
    ["s1a", "s1", "Этап 1: объясняет, что в проводниках есть свободные заряды, в диэлектриках нет"],
    ["s1b", "s1", "Этап 1: называет не менее трёх проводников и трёх диэлектриков"],
    ["q3exp", "q3exp", "Задание 3: объясняет через проводники и диэлектрики"],
    ["s3a", "s3", "Этап 3: сухая щётка электризуется, влажная проводит заряд, заряд стекает"],
    ["s3b", "s3", "Этап 3: пример полезной и вредной электризации и способ защиты"]
  ];
  var STAT = { lobby: "Ожидание учеников", running: "Идёт урок", finished: "Завершено" };

  function api(path, opt) {
    opt = opt || {}; opt.headers = Object.assign({ "X-Teacher-Key": KEY, "Content-Type": "application/json" }, opt.headers || {});
    return fetch(path, opt);
  }
  function post(path, body) { return api(path, { method: "POST", body: JSON.stringify(body || {}) }).then(function (r) { return r.json(); }); }
  function get(path) { return api(path).then(function (r) { return r.json(); }); }

  function enter(auto) {
    KEY = $("#key").value.trim();
    api("/api/t/sessions").then(function (r) {
      if (r.status === 401) { if (!auto) $("#loginMsg").textContent = "Неверный ключ."; return null; }
      return r.json();
    }).then(function (j) {
      if (!j) return; try { localStorage.setItem("physlab-tkey", KEY); } catch (e) {}
      $("#login").hidden = true; $("#app").hidden = false; ["#live", "#csv"].forEach(function (s) { $(s).hidden = false; });
      fillSessions(j.sessions);
      var last = null; try { last = localStorage.getItem("physlab-code"); } catch (e) {}
      var pick = (j.sessions.filter(function (s) { return s.code === last; })[0]) || j.sessions[0];
      if (pick) open(pick.code);
      timer = setInterval(poll, 3000);
    }).catch(function () { $("#loginMsg").textContent = "Нет связи с сервером."; });
  }
  $("#enter").addEventListener("click", function () { enter(false); });
  $("#key").addEventListener("keydown", function (e) { if (e.key === "Enter") enter(false); });
  $("#tTheme").addEventListener("click", function () { var r = document.documentElement; r.setAttribute("data-theme", r.getAttribute("data-theme") === "dark" ? "light" : "dark"); });
  try { var k0 = localStorage.getItem("physlab-tkey"); if (k0) { $("#key").value = k0; enter(true); } } catch (e) {}

  function fillSessions(list) {
    var s = $("#oldSess"); s.innerHTML = '<option value="">Прошлые сессии…</option>';
    list.forEach(function (x) { var o = document.createElement("option"); o.value = x.code; o.textContent = x.code + " · " + (x.cls || "—") + " · " + STAT[x.status] + " · " + x.n + " уч."; s.appendChild(o); });
  }
  function refreshList() { get("/api/t/sessions").then(function (j) { if (j.sessions) fillSessions(j.sessions); }); }

  function open(code) {
    CODE = code; sel = null; try { localStorage.setItem("physlab-code", code); } catch (e) {}
    $("#sessBox").hidden = false; $("#codeBig").textContent = code;
    $("#link").value = location.origin + location.pathname.replace(/teacher\.html$/, "") + "student.html?c=" + code;
    $("#detail").innerHTML = "<h3>Выберите ученика в таблице</h3><p class='empty'>Здесь появятся его ответы и критерии для оценки.</p>";
    poll();
  }
  $("#newSess").addEventListener("click", function () { post("/api/t/session", { cls: $("#newCls").value }).then(function (r) { if (r.code) { open(r.code); refreshList(); } }); });
  $("#oldSess").addEventListener("change", function () { if (this.value) open(this.value); });
  $("#copy").addEventListener("click", function () {
    var l = $("#link"), b = this; l.select();
    (navigator.clipboard ? navigator.clipboard.writeText(l.value) : Promise.reject()).catch(function () { document.execCommand("copy"); }).then(function () { b.textContent = "Скопировано"; setTimeout(function () { b.textContent = "Копировать"; }, 1500); });
  });
  function setStatus(st) { post("/api/t/set-status", { code: CODE, status: st }).then(function () { poll(); refreshList(); }); }
  $("#start").addEventListener("click", function () { setStatus("running"); });
  $("#finish").addEventListener("click", function () { setStatus("finished"); });
  $("#board").addEventListener("click", function () { window.open("board.html?c=" + CODE, "_blank"); });
  $("#delSess").addEventListener("click", function () {
    if (!confirm("Удалить сессию " + CODE + " вместе со всеми ответами учеников? Это нельзя отменить.")) return;
    api("/api/t/delete-session?c=" + CODE, { method: "DELETE" }).then(function () { CODE = ""; $("#sessBox").hidden = true; rows = []; draw([]); refreshList(); });
  });

  function poll() {
    if (!CODE) return;
    api("/api/t/results?c=" + CODE).then(function (r) { return r.json(); }).then(function (j) { if (j && j.rows) draw(j.rows); }).catch(function () {});
    fetch("/api/session?c=" + CODE).then(function (r) { return r.json(); }).then(function (s) {
      if (!s || s.error) return;
      var p = $("#stat"); p.textContent = STAT[s.status]; p.className = "statuspill " + s.status;
      $("#start").disabled = s.status === "running"; $("#start").textContent = s.status === "finished" ? "Продолжить урок" : "Начать";
      $("#finish").disabled = s.status === "finished";
    }).catch(function () {});
  }

  function pill(v, max) { var c = v == null ? "n" : v >= max ? "g" : v > 0 ? "y" : "r"; return '<span class="mini ' + c + '">' + (v == null ? "–" : v) + "</span>"; }
  function draw(list) {
    rows = list.slice().sort(function (a, b) { return b.points - a.points; });
    var avg = rows.length ? (rows.reduce(function (s, r) { return s + r.score10; }, 0) / rows.length) : 0;
    var done = rows.filter(function (r) { return r.answers.s3 && r.answers.s3.length > 15 && r.auto.o1 != null && r.auto.o2 != null; }).length;
    var wait = rows.filter(function (r) { return (r.answers.s1 || r.answers.s3 || r.answers.q3exp) && Object.keys(r.teacher).length < 5; }).length;
    $("#kN").textContent = rows.length; $("#kAvg").textContent = avg.toFixed(1); $("#kDone").textContent = done; $("#kWait").textContent = wait;
    var tb = $("#rows"); tb.innerHTML = "";
    if (!rows.length) { tb.innerHTML = '<tr><td colspan="7" class="empty">Пока никто не вошёл. Отправьте ссылку ученикам.</td></tr>'; }
    rows.forEach(function (r) {
      var tr = document.createElement("tr"); tr.className = "row-click" + (sel === r.sid ? " on" : "");
      tr.innerHTML = "<td></td><td>" + pill(r.auto.o1, 2) + "</td><td>" + pill(r.auto.o2, 2) + "</td><td>" + pill(r.auto.q3sel, 1) + "</td><td><b>" + r.autoScore + "</b></td><td><b>" + r.teacherScore + "</b></td><td><b>" + r.score10 + "</b> / 10</td>";
      tr.children[0].textContent = r.name;
      tr.addEventListener("click", function () { sel = r.sid; draw(rows); detail(); });
      tb.appendChild(tr);
    });
    if (sel) detail(true);
  }
  function hintFor(key, text) {
    var low = (text || "").toLowerCase(), h = HINTS[key]; if (!h) return "";
    var found = h.filter(function (w) { return low.indexOf(w) > -1; }); return found.length ? "подсказка: найдено «" + found.join("», «") + "»" : "подсказка: ключевых слов нет";
  }
  function detail(soft) {
    var r = rows.filter(function (x) { return x.sid === sel; })[0]; var box = $("#detail");
    if (!r) return;
    if (soft && box.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
    var a = r.answers || {};
    function block(title) { return "<h3 style='margin-top:.8rem'>" + title + "</h3><div class='ans'></div>"; }
    box.innerHTML = "<h3></h3><p class='hint'>Авто: " + r.autoScore + " · Учитель: " + r.teacherScore + " · Итого: <b>" + r.score10 + "</b> из 10 . Попыток: З1 " + ((a.o1 && a.o1.tries) || 0) + ", З2 " + ((a.o2 && a.o2.tries) || 0) + ".</p>" +
      block("Этап 1") + block("Задание 3: объяснение") + block("Этап 3") + block("Выходной билет");
    box.querySelector("h3").textContent = r.name;
    var ans = box.querySelectorAll(".ans");
    ans[0].textContent = a.s1 || "— нет ответа —"; ans[1].textContent = a.q3exp || "— нет ответа —"; ans[2].textContent = a.s3 || "— нет ответа —";
    ans[3].textContent = ["x1", "x2", "x3"].map(function (k, i) { return (i + 1) + ". " + (a[k] || "—"); }).join("\n") + (Array.isArray(a.goals) ? "\nЦели достигнуты: " + a.goals.reduce(function (s, v) { return s + v; }, 0) + " из 3" : "");
    var cr = document.createElement("div"); cr.innerHTML = "<h3 style='margin-top:.8rem'>Оценка по дескрипторам</h3>";
    CRIT.forEach(function (c) {
      var l = document.createElement("label"); l.className = "graded"; var chk = document.createElement("input"); chk.type = "checkbox"; chk.checked = !!(r.teacher[c[0]]);
      var sp = document.createElement("span"); sp.innerHTML = c[2] + " — <b>1 балл</b><br><span class='hint'>" + hintFor(c[0], a[c[1]]) + "</span>";
      chk.addEventListener("change", function () { post("/api/t/grade", { sid: r.sid, key: c[0], value: chk.checked ? 1 : 0 }).then(poll); });
      l.appendChild(chk); l.appendChild(sp); cr.appendChild(l);
    });
    var kick = document.createElement("button"); kick.className = "btn"; kick.style.marginTop = ".8rem"; kick.textContent = "Удалить ученика из сессии";
    kick.addEventListener("click", function () { if (confirm("Удалить " + r.name + " из сессии вместе с ответами?")) post("/api/t/kick", { sid: r.sid }).then(function () { sel = null; $("#detail").innerHTML = "<h3>Выберите ученика в таблице</h3>"; poll(); }); });
    box.appendChild(cr); box.appendChild(kick);
  }
  $("#csv").addEventListener("click", function () {
    if (!CODE) return;
    api("/api/t/export.csv?c=" + CODE).then(function (r) { return r.blob(); }).then(function (b) { var u = URL.createObjectURL(b), a = document.createElement("a"); a.href = u; a.download = "physlab-" + CODE + ".csv"; a.click(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000); });
  });
})();
