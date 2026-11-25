/* PhysLab: виртуальный электроскоп.
   Модель (в условных единицах заряда):
   N — суммарный избыточный заряд электроскопа (N>0: не хватает электронов).
   p — разделение зарядов под действием поднесённого тела: p = знак_тела * a, a растёт при сближении.
   Листочки: (N/2 + p) на двоих, шарик и стержень: (N/2 − p). Сумма всегда N: заряд сохраняется.
   Заземление: электроны уходят в землю (или приходят из неё), пока листочки не станут нейтральными: N = −2p. */
(function () {
  "use strict";
  var PL = window.PL, mk = PL.mk, $ = PL.$, clamp = PL.clamp;
  var CX = 400, BALL_Y = 72, HINGE_Y = 300, LEAF = 100;

  var TOOLS = [
    { id: "cu", n: "Медная проволока (в руке)", short: "медь", c: true, why: "металл — проводник: заряд ушёл через руку в землю" },
    { id: "fe", n: "Железный гвоздь (в руке)", short: "железо", c: true, why: "металл — проводник: заряд ушёл через руку в землю" },
    { id: "hand", n: "Рука", short: "рука", c: true, why: "тело человека — проводник: заряд стёк в землю" },
    { id: "glass", n: "Стеклянная палочка", short: "стекло", c: false, why: "стекло — диэлектрик: заряд остался на электроскопе" },
    { id: "pl", n: "Пластмассовая линейка", short: "пластмасса", c: false, why: "пластмасса — диэлектрик: заряд остался" },
    { id: "eb", n: "Эбонитовая палочка", short: "эбонит", c: false, why: "эбонит — диэлектрик: заряд остался" }
  ];
  var RODS = {
    glass: { name: "стеклянная палочка", cloth: "шёлк", q: +8 },
    ebonite: { name: "эбонитовая палочка", cloth: "мех", q: -8 }
  };

  function Electroscope(host, o) {
    o = o || {};
    var self = this;
    this.host = host; this.o = o;
    this.N = o.startN || 0; this.rodQ = 0; this.rodKind = o.rod || "ebonite";
    this.rod = { x: 150, y: 200, on: false, home: { x: 150, y: 210 } };
    this.mode = o.mode || "excess";
    this.busy = false; this.onChange = o.onChange || function () {};
    this.build();
    this.update(true);
    if (o.tools) this.buildTools(o.tools);
    return this;
  }
  var P = Electroscope.prototype;

  /* ---- вспомогательное: приводит шаг к значению ---- */
  P.a = function () { /* сила индукции 0..3 */
    if (!this.rod.on || !this.rodQ) return 0;
    var d = Math.hypot(this.rod.x - CX, this.rod.y - BALL_Y);
    return 5 * Math.pow(clamp(1 - (d - 95) / 270, 0, 1), 2);
  };
  P.p = function () { return (this.rodQ > 0 ? 1 : -1) * this.a(); };
  P.leaf = function () { return (this.N / 2 + this.p()) / 2; };           /* заряд одного листочка */
  P.head = function () { return this.N / 2 - this.p(); };                  /* шарик + стержень */

  /* ---- построение SVG ---- */
  var UID_N = 0;
  P.build = function () {
    this.uid = "es" + (++UID_N) + "-";
    var host = this.host; host.innerHTML = "";
    var wrap = PL.el("div", { class: "stage" }, host);
    var s = this.svg = mk("svg", { viewBox: "0 0 640 440", role: "img", "aria-label": "Виртуальный электроскоп" }, wrap);
    var d = mk("defs", {}, s);
    function grad(id, stops, type, extra) {
      var g = mk(type || "linearGradient", Object.assign({ id: id }, extra || {}), d);
      stops.forEach(function (st) { mk("stop", { offset: st[0], "stop-color": st[1], "stop-opacity": st[2] == null ? 1 : st[2] }, g); });
    }
    grad("gBrass", [[0, "#f6d38b"], [.45, "#c98a2b"], [1, "#7a4a12"]], "linearGradient", { x1: 0, x2: 1, y1: 0, y2: 0 });
    grad("gBall", [[0, "#fff1c9"], [.35, "#e0a640"], [1, "#8a5714"]], "radialGradient", { cx: ".35", cy: ".3", r: ".8" });
    grad("gFoil", [[0, "#fff0b8"], [.5, "#f0c24a"], [1, "#b8861a"]], "linearGradient", { x1: 0, x2: 1, y1: 0, y2: 0 });
    grad("gGlass", [[0, "#cfe6ff", .55], [.5, "#e9f3ff", .18], [1, "#bcd6f5", .5]], "linearGradient", { x1: 0, x2: 1, y1: 0, y2: 0 });
    grad("gRubber", [[0, "#3a3f4d"], [1, "#1a1d26"]], "linearGradient", { x1: 0, x2: 0, y1: 0, y2: 1 });
    grad("gGlassRod", [[0, "#e6f3ff", .95], [.5, "#9fc8f0", .8], [1, "#6d9fd0", .95]], "linearGradient", { x1: 0, x2: 0, y1: 0, y2: 1 });
    grad("gEbonite", [[0, "#5a5058"], [.5, "#24202a"], [1, "#0f0d12"]], "linearGradient", { x1: 0, x2: 0, y1: 0, y2: 1 });
    var fl = mk("filter", { id: "glow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, d);
    mk("feGaussianBlur", { stdDeviation: 4 }, fl);

    /* стол и тень */
    mk("rect", { x: 0, y: 415, width: 640, height: 25, fill: "var(--surface-3)" }, s);
    mk("ellipse", { cx: CX, cy: 414, rx: 128, ry: 9, fill: "rgba(20,33,61,.18)" }, s);

    /* банка (задняя стенка) */
    mk("path", { d: "M296,196 H504 V386 a26,26 0 0 1 -26,26 H322 a26,26 0 0 1 -26,-26 Z", fill: "url(#gGlass)", stroke: "var(--glass-line)", "stroke-width": 3 }, s);
    /* шкала углов */
    var sc = mk("g", { opacity: .35 }, s);
    for (var t = -50; t <= 50; t += 10) { if (!t) continue; var r1 = 112, r2 = t % 20 ? 118 : 124, ang = t * Math.PI / 180;
      mk("line", { x1: CX + Math.sin(ang) * r1, y1: HINGE_Y + Math.cos(ang) * r1, x2: CX + Math.sin(ang) * r2, y2: HINGE_Y + Math.cos(ang) * r2, stroke: "var(--ink-2)", "stroke-width": 1.5 }, sc); }

    /* крышка-пробка, стержень */
    mk("path", { d: "M366,196 L374,150 H426 L434,196 Z", fill: "url(#gRubber)" }, s);
    mk("rect", { x: 292, y: 190, width: 216, height: 12, rx: 5, fill: "url(#gBrass)", stroke: "#6b4410", "stroke-width": 1.5 }, s);
    mk("rect", { x: CX - 4, y: BALL_Y, width: 8, height: HINGE_Y - BALL_Y, rx: 3, fill: "url(#gBrass)" }, s);
    mk("circle", { cx: CX, cy: HINGE_Y, r: 7, fill: "url(#gBrass)", stroke: "#6b4410", "stroke-width": 1.5 }, s);

    /* листочки: две группы, вращаются вокруг шарнира */
    this.leafL = mk("g", {}, s); this.leafR = mk("g", {}, s);
    [this.leafL, this.leafR].forEach(function (g) {
      mk("path", { d: "M" + (CX - 8) + "," + HINGE_Y + " h16 l-2," + LEAF + " h-12 Z", fill: "url(#gFoil)", stroke: "#8a6212", "stroke-width": 1.2 }, g);
    });

    /* передняя блик-стенка банки */
    mk("path", { d: "M306,200 V380 a20,20 0 0 0 10,17", fill: "none", stroke: "rgba(255,255,255,.7)", "stroke-width": 5, "stroke-linecap": "round" }, s);
    mk("path", { d: "M492,210 V300", fill: "none", stroke: "rgba(255,255,255,.4)", "stroke-width": 4, "stroke-linecap": "round" }, s);

    /* шарик */
    mk("circle", { cx: CX, cy: BALL_Y, r: 30, fill: "url(#gBall)", stroke: "#6b4410", "stroke-width": 2 }, s);

    /* слоты зарядов */
    this.slots = { ball: [], rod: [], leafL: [], leafR: [] };
    var gb = mk("g", {}, s), gr = mk("g", {}, s);
    var i, a, ballPos = [[-12, -12], [12, -12], [0, -16], [-16, 2], [16, 2], [-8, 12], [8, 12], [0, 0]];
    ballPos.forEach(function (p) { this.slots.ball.push(this.slot(gb, CX + p[0], BALL_Y + p[1])); }, this);
    for (i = 0; i < 5; i++) this.slots.rod.push(this.slot(gr, CX + (i % 2 ? 11 : -11), 118 + i * 38));
    [["leafL", this.leafL], ["leafR", this.leafR]].forEach(function (pair) {
      for (var k = 0; k < 4; k++) this.slots[pair[0]].push(this.slot(pair[1], CX, HINGE_Y + 22 + k * 22));
    }, this);

    /* земля / поток электронов */
    this.fx = mk("g", {}, s);
    this.earth = mk("g", { opacity: 0 }, s);
    mk("path", { d: "M556,120 V250 M538,250 h36 M544,260 h24 M550,270 h12", stroke: "var(--ok)", "stroke-width": 4, "stroke-linecap": "round", fill: "none" }, this.earth);
    var et = mk("text", { x: 556, y: 296, "text-anchor": "middle", fill: "var(--ok)", "font-size": 15, "font-weight": 700 }, this.earth); et.textContent = "земля";
    this.toolG = mk("g", { opacity: 0 }, s);

    /* лоток слева: ткань и палочка */
    if (this.o.rods) this.buildTray(s);

    /* подпись угла */
    this.angTxt = mk("text", { x: CX, y: 392, "text-anchor": "middle", fill: "var(--ink-2)", "font-size": 14, "font-weight": 650 }, s);

    /* пружины листочков */
    var self = this;
    this.spring = new PL.Spring(0, function (th) {
      self.leafL.setAttribute("transform", "rotate(" + th + " " + CX + " " + HINGE_Y + ")");
      self.leafR.setAttribute("transform", "rotate(" + (-th) + " " + CX + " " + HINGE_Y + ")");
      self.theta = th; self.angTxt.textContent = th > 1.5 ? "угол ≈ " + Math.round(th * 2) + "°" : "";
    }, { k: 110, c: 8.5 });
    this.spring.set(0);
    this.uniq(s);
  };
  P.uniq = function (svg) {
    var uid = this.uid;
    Array.prototype.slice.call(svg.querySelectorAll("[id]")).forEach(function (el) { el.setAttribute("id", uid + el.getAttribute("id")); });
    Array.prototype.slice.call(svg.querySelectorAll("*")).forEach(function (el) {
      ["fill", "stroke", "filter"].forEach(function (a) { var v = el.getAttribute(a); if (v && v.indexOf("url(#") === 0 && v.indexOf("url(#" + uid) !== 0) el.setAttribute(a, v.replace("url(#", "url(#" + uid)); });
    });
  };

  /* слот заряда: пара фоновых (все заряды) и жирный знак */
  P.slot = function (parent, x, y) {
    var g = mk("g", {}, parent);
    var bgp = mk("text", { x: x - 7, y: y, class: "sign", "font-size": 11, fill: "var(--pos)", opacity: 0 }, g); bgp.textContent = "+";
    var bgm = mk("text", { x: x + 7, y: y, class: "sign", "font-size": 11, fill: "var(--neg)", opacity: 0 }, g); bgm.textContent = "−";
    var fg = mk("text", { x: x, y: y, class: "sign", opacity: 0, "font-size": 17 }, g);
    fg.style.transition = "opacity .25s, transform .3s"; fg.style.transformBox = "fill-box"; fg.style.transformOrigin = "center";
    return { bgp: bgp, bgm: bgm, fg: fg };
  };
  P.fill = function (slots, v, max) {
    var n = Math.min(slots.length, Math.round(Math.abs(v) * (max || 1))), sign = v > 0 ? "+" : "−";
    var showAll = this.mode === "all", none = this.mode === "none";
    slots.forEach(function (s, i) {
      var on = !none && i < n && Math.abs(v) > .25;
      s.fg.textContent = sign; s.fg.setAttribute("fill", v > 0 ? "var(--pos)" : "var(--neg)");
      s.fg.setAttribute("opacity", on ? 1 : 0); s.fg.style.transform = on ? "scale(1)" : "scale(.4)";
      s.bgp.setAttribute("opacity", showAll ? .38 : 0); s.bgm.setAttribute("opacity", showAll ? .38 : 0);
    });
  };

  /* ---- лоток с палочкой и тканью ---- */
  P.buildTray = function (s) {
    var self = this;
    this.cloth = mk("g", {}, s);
    this.clothShape = mk("path", { d: "M40,330 q60,-18 120,0 l8,60 q-68,16 -136,0 Z", fill: "#c2d4ee", stroke: "#6b82a8", "stroke-width": 2 }, this.cloth);
    this.clothTxt = mk("text", { x: 100, y: 364, "text-anchor": "middle", "font-size": 15, "font-weight": 700, fill: "var(--ink)" }, this.cloth);
    this.clothSigns = []; for (var i = 0; i < 4; i++) this.clothSigns.push(mk("text", { x: 62 + i * 25, y: 346 + (i % 2) * 22, class: "sign", opacity: 0 }, this.cloth));
    this.rodG = mk("g", { class: "dragme", tabindex: 0, role: "button", "aria-label": "Палочка. Перетащите её к электроскопу" }, s);
    this.rodBody = mk("rect", { x: -86, y: -11, width: 172, height: 22, rx: 11, stroke: "#4b6a8f", "stroke-width": 2 }, this.rodG);
    this.rodSigns = []; for (var j = 0; j < 4; j++) this.rodSigns.push(mk("text", { x: -52 + j * 35, y: 1, class: "sign", opacity: 0, "font-size": 18 }, this.rodG));
    this.rodLabel = mk("text", { x: 0, y: 34, "text-anchor": "middle", "font-size": 13, "font-weight": 650, fill: "var(--ink-2)" }, this.rodG);
    this.setRodKind(this.rodKind);
    this.placeRodG();
    PL.drag(this.rodG, this.svg, {
      start: function (p) { if (self.busy) return; self.msg = ""; self.rod.on = true; self.grab = { dx: self.rod.x - p.x, dy: self.rod.y - p.y }; self.rodSpr && self.rodSpr.stop && self.rodSpr.stop(); },
      move: function (p) { if (self.busy) return; self.msg = ""; self.rod.x = clamp(p.x + self.grab.dx, 70, 610); self.rod.y = clamp(p.y + self.grab.dy, 36, 380); self.placeRodG(); self.update(); },
      end: function () { self.drop(); }
    });
  };
  P.setRodKind = function (kind) {
    this.rodKind = kind; var r = RODS[kind];
    this.rodBody.setAttribute("fill", kind === "glass" ? "url(#" + this.uid + "gGlassRod)" : "url(#" + this.uid + "gEbonite)");
    this.rodLabel.textContent = r.name;
    this.clothTxt.textContent = r.cloth;
    this.clothShape.setAttribute("fill", kind === "glass" ? "#e8d6f5" : "#c9a37a");
    this.rodQ = 0; this.clothQ = 0; this.rod.on = false; this.rod.x = this.rod.home.x; this.rod.y = this.rod.home.y;
    this.paintRod(); this.placeRodG(); this.update();
  };
  P.placeRodG = function () { this.rodG.setAttribute("transform", "translate(" + this.rod.x + " " + this.rod.y + ") rotate(-14)"); };
  P.paintRod = function () {
    var q = this.rodQ, sign = q > 0 ? "+" : "−", on = Math.abs(q) > .5;
    this.rodSigns.forEach(function (t) { t.textContent = sign; t.setAttribute("opacity", on ? 1 : 0); t.setAttribute("fill", q > 0 ? "var(--pos)" : "var(--neg)"); });
    var cq = -(RODS[this.rodKind].q) * (on ? 1 : 0), cs = cq > 0 ? "+" : "−";
    this.clothSigns.forEach(function (t) { t.textContent = cs; t.setAttribute("opacity", on || this.cloth_on ? 1 : 0); t.setAttribute("fill", cq > 0 ? "var(--pos)" : "var(--neg)"); }, this);
    if (!on) this.clothSigns.forEach(function (t) { t.setAttribute("opacity", 0); });
  };
  /* потереть палочку тканью */
  P.rub = function (done) {
    var self = this; if (this.busy) return; this.busy = true;
    this.rod.on = false; this.rod.x = this.rod.home.x; this.rod.y = this.rod.home.y; this.placeRodG();
    var t0 = performance.now(), dur = PL.rm ? 1 : 1100;
    function frame(t) {
      var k = clamp((t - t0) / dur, 0, 1), sw = Math.sin(k * Math.PI * 6) * 26 * (1 - k * .3);
      self.cloth.setAttribute("transform", "translate(" + (30 + sw) + "," + (-135) + ")");
      if (k < 1) requestAnimationFrame(frame);
      else { self.cloth.setAttribute("transform", ""); self.rodQ = RODS[self.rodKind].q; self.paintRod(); [0, 1, 2, 3].forEach(function (i) { setTimeout(function () { PL.pop(i); }, i * 90); }); self.busy = false; self.update(); done && done(); }
    }
    requestAnimationFrame(frame);
  };
  P.drop = function () {
    var d = Math.hypot(this.rod.x - CX, this.rod.y - BALL_Y);
    if (d < 100 && this.rodQ) { this.touchRod(); }
    this.update();
  };
  /* коснуться шарика заряженной палочкой: часть заряда переходит на электроскоп */
  P.touchRod = function () {
    var give = this.rodQ * 0.6; this.N = clamp(this.N + give, -12, 12); this.rodQ -= give;
    PL.pop(3); this.msg = "Палочка коснулась шарика: часть заряда перешла на электроскоп. Листочки получили заряд того же знака и разошлись.";
    this.rod.x = 255; this.rod.y = 118; this.placeRodG(); this.paintRod(); this.flash();
  };
  P.flash = function () {
    var c = mk("circle", { cx: CX, cy: BALL_Y, r: 30, fill: "none", stroke: "#f6c453", "stroke-width": 4, filter: "url(#" + this.uid + "glow)", opacity: .9 }, this.fx);
    var t0 = performance.now(); (function f(t) { var k = clamp((t - t0) / 600, 0, 1); c.setAttribute("r", 30 + k * 26); c.setAttribute("opacity", .9 * (1 - k)); if (k < 1) requestAnimationFrame(f); else c.remove(); })(t0);
  };
  P.removeRod = function () {
    var self = this, from = { x: this.rod.x, y: this.rod.y }, to = this.rod.home, t0 = performance.now();
    (function f(t) {
      var k = PL.rm ? 1 : clamp((t - t0) / 650, 0, 1), e = 1 - Math.pow(1 - k, 3);
      self.rod.x = from.x + (to.x - from.x) * e; self.rod.y = from.y + (to.y - from.y) * e; self.placeRodG();
      self.rod.on = k < 1; if (k >= 1) self.rod.on = false; self.update();
      if (k < 1) requestAnimationFrame(f);
    })(t0);
    this.msg = "Заряженное тело убрали.";
  };
  /* поставить палочку на заданное расстояние (для сценариев) */
  P.moveRodTo = function (x, y, cb) {
    var self = this, from = { x: this.rod.x, y: this.rod.y }, t0 = performance.now(); this.rod.on = true; this.busy = true;
    (function f(t) {
      var k = PL.rm ? 1 : clamp((t - t0) / 800, 0, 1), e = 1 - Math.pow(1 - k, 3);
      self.rod.x = from.x + (x - from.x) * e; self.rod.y = from.y + (y - from.y) * e; self.placeRodG(); self.update();
      if (k < 1) requestAnimationFrame(f); else { self.busy = false; cb && cb(); }
    })(t0);
  };

  /* ---- предметы-касания ---- */
  P.buildTools = function (ids) {
    var self = this, host = PL.el("div", { class: "pool", style: "margin-top:.6rem" }, this.host);
    this.toolBtns = [];
    TOOLS.forEach(function (t) {
      if (ids !== true && ids.indexOf(t.id) < 0) return;
      var b = PL.el("button", { class: "chip", type: "button", text: t.n }, host);
      b.addEventListener("click", function () { self.touch(t); });
      self.toolBtns.push(b);
    });
  };
  P.touch = function (t) {
    var self = this; if (this.busy) return; this.busy = true;
    if (this.o.autoCharge && Math.abs(this.N) < 1) { this.N = this.o.startN; this.update(); }
    var g = this.toolG; g.innerHTML = "";
    mk("rect", { x: 0, y: -14, width: 116, height: 28, rx: 14, fill: t.c ? "var(--ok-soft)" : "var(--surface-3)", stroke: t.c ? "var(--ok)" : "var(--ink-2)", "stroke-width": 2 }, g);
    var tx = mk("text", { x: 58, y: 1, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 13, "font-weight": 700, fill: "var(--ink)" }, g); tx.textContent = t.short;
    var x0 = 640, x1 = CX + 34, t0 = performance.now();
    g.setAttribute("opacity", 1);
    function setX(x) { g.setAttribute("transform", "translate(" + x + " " + BALL_Y + ")"); }
    setX(x0);
    (function f(now) {
      var k = PL.rm ? 1 : clamp((now - t0) / 520, 0, 1), e = 1 - Math.pow(1 - k, 3);
      setX(x0 + (x1 - x0) * e);
      if (k < 1) requestAnimationFrame(f); else apply();
    })(t0);
    function apply() {
      var old = self.N;
      if (t.c) { var newN = -2 * self.p(); self.groundFlow(newN - old); self.N = newN; self.msg = "Листочки опали: " + t.why + "."; self.earthShow(true); }
      else { self.msg = "Листочки остались на месте: " + t.why + "."; }
      self.update();
      self.onTouch && self.onTouch(t, old, self.N);
      setTimeout(function () { self.earthShow(false); (function ret(n0) { (function f(now) { var k = PL.rm ? 1 : clamp((now - n0) / 420, 0, 1); setX(x1 + (x0 - x1) * k); if (k < 1) requestAnimationFrame(f); else { g.setAttribute("opacity", 0); self.busy = false; } })(n0); })(performance.now()); }, 900);
    }
  };
  P.earthShow = function (on) { this.earth.setAttribute("opacity", on ? 1 : 0); this.earth.style.transition = "opacity .3s"; };
  /* электроны вытекают в землю (dN>0) или втекают из земли (dN<0) */
  P.groundFlow = function (dN) {
    var n = clamp(Math.round(Math.abs(dN)), 0, 6); if (!n || PL.rm) return;
    var self = this, out = dN > 0;
    for (var i = 0; i < n; i++) (function (i) {
      setTimeout(function () {
        var c = mk("circle", { r: 7, fill: "var(--neg)", opacity: .95 }, self.fx), t0 = performance.now(), dur = 900;
        var pts = [[CX, BALL_Y + 40], [CX + 34, BALL_Y], [556, BALL_Y], [556, 250]];
        PL.pop(i);
        (function f(now) {
          var k = clamp((now - t0) / dur, 0, 1), u = out ? k : 1 - k, seg = u * (pts.length - 1), s0 = Math.min(pts.length - 2, Math.floor(seg)), w = seg - s0;
          c.setAttribute("cx", pts[s0][0] + (pts[s0 + 1][0] - pts[s0][0]) * w); c.setAttribute("cy", pts[s0][1] + (pts[s0 + 1][1] - pts[s0][1]) * w);
          c.setAttribute("opacity", k < .1 ? k * 9 : (k > .9 ? (1 - k) * 9 : .95));
          if (k < 1) requestAnimationFrame(f); else c.remove();
        })(t0);
      }, i * 110);
    })(i);
  };

  /* ---- обновление картинки ---- */
  P.setMode = function (m) { this.mode = m; this.update(true); };
  P.update = function (force) {
    if (!this.spring) return;
    var L = this.leaf(), H = this.head(), th = clamp(Math.abs(L) * 15, 0, 56);
    this.spring.to(th);
    var lv = Math.abs(L) > .25 ? L : 0;
    this.fill(this.slots.leafL, L, 1.6); this.fill(this.slots.leafR, L, 1.6);
    this.fill(this.slots.ball, H * .7, 1.4); this.fill(this.slots.rod, H * .3, 1.6);
    this.state = { N: this.N, a: this.a(), leaf: L, head: H, rodQ: this.rodQ, theta: th };
    this.onChange(this.state, this);
  };
  P.reset = function (n) { this.N = n == null ? (this.o.startN || 0) : n; this.rodQ = 0; this.rod.on = false; if (this.rodG) { this.rod.x = this.rod.home.x; this.rod.y = this.rod.home.y; this.placeRodG(); this.paintRod(); } this.msg = ""; this.update(true); };
  P.setN = function (n) { this.N = n; this.update(); };
  /* краткое описание происходящего */
  P.describe = function () {
    if (this.msg) return this.msg;
    var a = this.a(), s = this.rodQ > 0 ? "положительно" : "отрицательно";
    if (a > .35) return this.rodQ < 0
      ? "Рядом отрицательное тело: свободные электроны отталкиваются от него, уходят вниз на листочки. Листочки заряжаются отрицательно и расходятся, шарик становится положительным."
      : "Рядом положительное тело: оно притягивает электроны к шарику. Листочки остаются без электронов, заряжаются положительно и расходятся, шарик становится отрицательным.";
    if (Math.abs(this.N) > .3) return "Электроскоп заряжен " + (this.N > 0 ? "положительно" : "отрицательно") + ": листочки одноимённо заряжены и отталкиваются.";
    return "Электроскоп нейтрален: листочки висят вертикально.";
  };

  window.PL.Electroscope = Electroscope;
  window.PL.TOOLS = TOOLS;
})();
