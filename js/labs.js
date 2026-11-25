/* PhysLab: лаборатория «цепь с лампочкой» и «ряд электризации трением». */
(function () {
  "use strict";
  var PL = window.PL, mk = PL.mk, clamp = PL.clamp;

  /* ================= Цепь с лампочкой ================= */
  var MATS = [
    { n: "Медная проволока", c: true, k: "metal" }, { n: "Железный гвоздь", c: true, k: "metal" },
    { n: "Графитовый грифель", c: true, k: "metal", note: "в учебнике 1 не указан, но проводит ток" },
    { n: "Водопроводная вода", c: true, k: "ion" }, { n: "Раствор соли", c: true, k: "ion" },
    { n: "Стекло", c: false }, { n: "Пластмасса", c: false }, { n: "Резина", c: false },
    { n: "Сухое дерево", c: false }, { n: "Бумага", c: false }, { n: "Фарфор", c: false }, { n: "Воздух (зазор)", c: false }
  ];
  var LOOP = [[90, 232], [90, 60], [265, 60], [375, 60], [560, 60], [560, 262], [410, 262], [230, 262], [90, 262], [90, 232]];

  function LampLab(host, o) {
    o = o || {}; var self = this;
    host.innerHTML = "";
    var stage = PL.el("div", { class: "stage" }, host);
    var s = this.svg = mk("svg", { viewBox: "0 0 640 330", role: "img", "aria-label": "Электрическая цепь с лампочкой и клеммами X и Y" }, stage);
    var d = mk("defs", {}, s);
    var rg = mk("radialGradient", { id: "gLamp" }, d);
    [[0, "#fff6c9", 1], [.5, "#ffd45a", .85], [1, "#ffb300", 0]].forEach(function (a) { mk("stop", { offset: a[0], "stop-color": a[1], "stop-opacity": a[2] }, rg); });
    /* провода */
    mk("path", { d: "M90,232 V60 H268 M372,60 H560 V262 H412 M228,262 H90 V232", fill: "none", stroke: "var(--ink)", "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round" }, s);
    /* батарея */
    mk("rect", { x: 56, y: 150, width: 68, height: 60, rx: 10, fill: "var(--surface-2)", stroke: "var(--ink)", "stroke-width": 3 }, s);
    mk("path", { d: "M74,170 v20 M90,162 v36 M106,170 v20", stroke: "var(--ink)", "stroke-width": 5, "stroke-linecap": "round" }, s);
    var pl = mk("text", { x: 90, y: 142, "text-anchor": "middle", "font-size": 16, "font-weight": 800, fill: "var(--ink)" }, s); pl.textContent = "батарея";
    /* лампочка */
    this.glow = mk("circle", { cx: 320, cy: 60, r: 80, fill: "url(#gLamp)", opacity: 0 }, s);
    this.bulb = mk("circle", { cx: 320, cy: 60, r: 40, fill: "var(--surface)", stroke: "var(--ink)", "stroke-width": 4 }, s);
    mk("path", { d: "M300,78 q8,-34 20,-4 q12,-30 20,4", fill: "none", stroke: "var(--ink)", "stroke-width": 3, "stroke-linecap": "round" }, s);
    mk("rect", { x: 304, y: 96, width: 32, height: 12, rx: 3, fill: "url(#gBrassL)", stroke: "var(--ink)", "stroke-width": 2 }, s).setAttribute("fill", "var(--brass)");
    /* клеммы */
    [["X", 230], ["Y", 410]].forEach(function (c) {
      mk("circle", { cx: c[1], cy: 262, r: 11, fill: "var(--primary)", stroke: "var(--ink)", "stroke-width": 2 }, s);
      var t = mk("text", { x: c[1], y: 296, "text-anchor": "middle", "font-size": 20, "font-weight": 800, fill: "var(--ink)" }, s); t.textContent = c[0];
    });
    /* образец */
    this.sample = mk("g", { opacity: 0 }, s);
    this.sRect = mk("rect", { x: 241, y: 247, width: 158, height: 30, rx: 9, "stroke-width": 3 }, this.sample);
    this.sTxt = mk("text", { x: 320, y: 262, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 14, "font-weight": 700, fill: "var(--ink)" }, this.sample);
    /* поток электронов */
    this.flow = mk("g", {}, s); this.dots = [];
    for (var i = 0; i < 26; i++) this.dots.push(mk("circle", { r: 5, fill: "var(--neg)", opacity: 0 }, this.flow));
    /* увеличительное стекло: что внутри материала */
    var lens = mk("g", { transform: "translate(500 170)" }, s);
    mk("circle", { r: 58, fill: "var(--surface)", stroke: "var(--ink-2)", "stroke-width": 3 }, lens);
    this.micro = mk("g", {}, lens);
    this.microCap = mk("text", { y: 80, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: "var(--ink-2)" }, lens);
    this.parts = [];
    /* состояние */
    this.on = false; this.cur = null; this.tested = {}; this.log = o.log; this.msg = o.msg; this.cnt = o.cnt;
    this.len = 0; var seg = [], tot = 0;
    for (var j = 0; j < LOOP.length - 1; j++) { var l = Math.hypot(LOOP[j + 1][0] - LOOP[j][0], LOOP[j + 1][1] - LOOP[j][1]); seg.push(l); tot += l; }
    this.seg = seg; this.tot = tot; this.off = 0;
    this.tick = function (t) { self.off = (self.off + 1.4) % self.tot; self.paintFlow(); self.moveParts(); requestAnimationFrame(self.tick); };
    if (!PL.rm) requestAnimationFrame(this.tick); else { this.paintFlow(); }
    this.setCaption("выбери образец");
    /* кнопки материалов */
    if (o.pool) { MATS.forEach(function (m) { var b = PL.el("button", { class: "chip", type: "button", text: m.n }, o.pool); b.addEventListener("click", function () { self.test(m); }); }); }
  }
  LampLab.prototype.pointAt = function (u) {
    var d = u, i = 0;
    while (i < this.seg.length && d > this.seg[i]) { d -= this.seg[i]; i++; }
    i = Math.min(i, this.seg.length - 1);
    var a = LOOP[i], b = LOOP[i + 1], k = d / this.seg[i];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };
  LampLab.prototype.paintFlow = function () {
    var n = this.dots.length;
    for (var i = 0; i < n; i++) {
      var p = this.pointAt((this.off + i * this.tot / n) % this.tot);
      this.dots[i].setAttribute("cx", p[0]); this.dots[i].setAttribute("cy", p[1]); this.dots[i].setAttribute("opacity", this.on ? .95 : 0);
    }
  };
  LampLab.prototype.setCaption = function (t) { this.microCap.textContent = t; };
  LampLab.prototype.buildMicro = function (m) {
    this.micro.innerHTML = ""; this.parts = [];
    for (var i = 0; i < 14; i++) {
      var x = -36 + (i % 5) * 18 + (Math.floor(i / 5) % 2) * 9, y = -34 + Math.floor(i / 5) * 24;
      var ion = mk("g", {}, this.micro), bg = mk("circle", { cx: x, cy: y, r: 8, fill: "var(--pos-soft)", stroke: "var(--pos)", "stroke-width": 1.5 }, ion);
      var pt = mk("text", { x: x, y: y, class: "sign", "font-size": 11, fill: "var(--pos)" }, ion); pt.textContent = "+";
    }
    if (m.c) {
      var kind = m.k, nEl = kind === "ion" ? 8 : 10;
      for (var k = 0; k < nEl; k++) {
        var c = mk("circle", { r: 5, fill: kind === "ion" && k % 2 ? "var(--pos)" : "var(--neg)" }, this.micro);
        this.parts.push({ n: c, x: (Math.random() - .5) * 90, y: (Math.random() - .5) * 80, vx: (Math.random() - .5) * 1.8, vy: (Math.random() - .5) * 1.8 });
      }
    } else {
      for (var q = 0; q < 6; q++) { var c2 = mk("circle", { cx: -30 + q * 12, cy: 38 - (q % 2) * 6, r: 4, fill: "var(--neg)" }, this.micro); c2.setAttribute("opacity", .9); }
    }
  };
  LampLab.prototype.moveParts = function () {
    this.parts.forEach(function (p) { p.x += p.vx; p.y += p.vy; if (Math.abs(p.x) > 44) p.vx *= -1; if (Math.abs(p.y) > 40) p.vy *= -1; p.n.setAttribute("cx", p.x); p.n.setAttribute("cy", p.y); });
  };
  LampLab.prototype.test = function (m) {
    this.cur = m; this.on = !!m.c;
    this.sample.setAttribute("opacity", 1);
    this.sRect.setAttribute("fill", m.c ? "var(--ok-soft)" : "var(--surface-3)"); this.sRect.setAttribute("stroke", m.c ? "var(--ok)" : "var(--ink-2)");
    this.sTxt.textContent = m.n;
    this.bulb.setAttribute("fill", m.c ? "#ffe27a" : "var(--surface)");
    this.glow.setAttribute("opacity", m.c ? 1 : 0); this.glow.style.transition = "opacity .35s";
    this.buildMicro(m);
    this.setCaption(m.c ? (m.k === "ion" ? "в растворе движутся ионы" : "свободные электроны") : "заряды связаны, не движутся");
    if (!PL.rm) this.paintFlow(); else { this.paintFlow(); this.moveParts(); }
    if (this.msg) { this.msg.textContent = (m.c ? "Лампочка горит: " + m.n + " — проводник." : "Лампочка не горит: " + m.n + " — диэлектрик.") + (m.note ? " (" + m.note + ")" : ""); this.msg.className = "feedback " + (m.c ? "ok" : "bad"); }
    if (!this.tested[m.n]) {
      this.tested[m.n] = 1;
      if (this.log) { if (this.log.querySelector(".empty")) this.log.innerHTML = ""; var tr = PL.el("tr", { class: "new" }, this.log); [m.n, m.c ? "горит" : "не горит", m.c ? "проводник" : "диэлектрик"].forEach(function (t) { PL.el("td", { text: t }, tr); }); }
      if (this.cnt) this.cnt.textContent = Object.keys(this.tested).length;
    }
  };

  /* ================= Ряд электризации ================= */
  var SERIES = ["мех", "фланель", "слоновая кость", "перья", "горный хрусталь", "флинтглас (стекло)", "бумажная ткань", "шёлк", "дерево", "металл", "сера"];
  function Tribo(host, o) {
    var self = this; host.innerHTML = "";
    this.sel = [null, null]; this.msg = o.msg;
    var stage = PL.el("div", { class: "stage" }, host);
    var s = this.svg = mk("svg", { viewBox: "0 0 640 300", role: "img", "aria-label": "Электризация двух тел трением" }, stage);
    this.bodies = [0, 1].map(function (i) {
      var g = mk("g", { transform: "translate(" + (i ? 400 : 100) + " 70)" }, s);
      mk("rect", { width: 140, height: 120, rx: 20, fill: "var(--surface-3)", stroke: "var(--ink-2)", "stroke-width": 3 }, g);
      var t = mk("text", { x: 70, y: 60, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 18, "font-weight": 700, fill: "var(--ink)" }, g); t.textContent = "выбери";
      var sg = []; for (var k = 0; k < 6; k++) { var q = mk("text", { x: 22 + k * 19, y: 100 + (k % 2) * 4, class: "sign", opacity: 0, "font-size": 20 }, g); sg.push(q); }
      return { g: g, rect: g.firstChild, t: t, sg: sg };
    });
    this.arrowG = mk("g", {}, s); this.flow = mk("g", {}, s);
    var ar = mk("text", { x: 320, y: 255, "text-anchor": "middle", "font-size": 15, "font-weight": 700, fill: "var(--ink-2)" }, s); this.cap = ar;
    var rows = o.rows; this.rowBtns = [[], []];
    [0, 1].forEach(function (i) {
      var box = PL.el("div", { style: "margin-top:.6rem" }, rows); PL.el("p", { class: "tag", text: i ? "Второе тело" : "Первое тело" }, box);
      var pool = PL.el("div", { class: "pool" }, box);
      SERIES.forEach(function (n, idx) { var b = PL.el("button", { class: "chip", type: "button", text: n }, pool); b.addEventListener("click", function () { self.pick(i, idx); }); self.rowBtns[i].push(b); });
    });
    this.rubBtn = o.rub; this.rubBtn.addEventListener("click", function () { self.rub(); });
  }
  Tribo.prototype.pick = function (i, idx) {
    this.sel[i] = idx; this.rowBtns[i].forEach(function (b, k) { b.classList.toggle("sel", k === idx); });
    var b = this.bodies[i]; b.t.textContent = SERIES[idx]; b.sg.forEach(function (q) { q.setAttribute("opacity", 0); }); this.flow.innerHTML = "";
    this.cap.textContent = ""; this.msg.textContent = "";
  };
  Tribo.prototype.rub = function () {
    var self = this, a = this.sel[0], b = this.sel[1];
    if (a == null || b == null) { this.msg.textContent = "Выбери оба тела."; this.msg.className = "feedback bad"; return; }
    if (a === b) { this.msg.textContent = "Выбери два разных вещества."; this.msg.className = "feedback bad"; return; }
    var pos = a < b ? 0 : 1, neg = 1 - pos;           // раньше в ряду — положительный
    var P = this.bodies[pos], N = this.bodies[neg];
    this.flow.innerHTML = "";
    var xs = [pos ? 470 : 170, neg ? 470 : 170], n = 6, i;
    for (i = 0; i < n; i++) (function (i) {
      setTimeout(function () {
        var c = mk("circle", { r: 7, fill: "var(--neg)", cy: 130 }, self.flow), t0 = performance.now(), dur = PL.rm ? 1 : 900;
        (function f(now) { var k = clamp((now - t0) / dur, 0, 1); c.setAttribute("cx", xs[0] + (xs[1] - xs[0]) * k); c.setAttribute("cy", 130 - Math.sin(k * Math.PI) * 36); c.setAttribute("opacity", k < .85 ? 1 : (1 - k) * 6); if (k < 1) requestAnimationFrame(f); else { c.remove(); P.sg[i].textContent = "+"; P.sg[i].setAttribute("fill", "var(--pos)"); P.sg[i].setAttribute("opacity", 1); N.sg[i].textContent = "−"; N.sg[i].setAttribute("fill", "var(--neg)"); N.sg[i].setAttribute("opacity", 1); PL.pop(i); } })(t0);
      }, PL.rm ? 0 : i * 120);
    })(i);
    this.cap.textContent = "электроны переходят с «+» тела на «−» тело";
    this.msg.textContent = SERIES[a < b ? a : b] + " получает заряд «+» (теряет электроны), " + SERIES[a < b ? b : a] + " получает «−» (забирает электроны). Заряды равны по модулю и противоположны по знаку.";
    this.msg.className = "feedback ok";
  };

  PL.LampLab = LampLab; PL.Tribo = Tribo; PL.MATS = MATS; PL.SERIES = SERIES;
})();
