/* PhysLab: общие помощники. Классические скрипты (без модулей), чтобы страница открывалась и по file://. */
(function (g) {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var PL = g.PL = { NS: NS };

  PL.$ = function (s, r) { return (r || document).querySelector(s); };
  PL.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  PL.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  PL.rm = !!(g.matchMedia && g.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* создать SVG-элемент */
  PL.mk = function (tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  PL.el = function (tag, props, parent) {
    var n = document.createElement(tag);
    for (var k in props) { if (k === "text") n.textContent = props[k]; else if (k === "html") n.innerHTML = props[k]; else n.setAttribute(k, props[k]); }
    if (parent) parent.appendChild(n);
    return n;
  };

  /* хранилище ответов (localStorage, с запасным вариантом) */
  var KEY = "physlab-v1", mem = {};
  try { mem = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { mem = {}; }
  PL.store = {
    get: function (k, d) { return k in mem ? mem[k] : d; },
    set: function (k, v) { mem[k] = v; try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} },
    all: function () { return mem; },
    clear: function () { mem = {}; try { localStorage.removeItem(KEY); } catch (e) {} }
  };

  /* пружина: плавное движение к цели (критическое демпфирование, rAF) */
  PL.Spring = function (value, onTick, opts) {
    opts = opts || {};
    var k = opts.k || 140, c = opts.c || 15;
    var x = value, v = 0, target = value, raf = 0, last = 0;
    function step(t) {
      var dt = Math.min(0.032, (t - last) / 1000 || 0.016); last = t;
      var a = -k * (x - target) - c * v;
      v += a * dt; x += v * dt;
      onTick(x);
      if (Math.abs(x - target) < 0.02 && Math.abs(v) < 0.02) { x = target; onTick(x); raf = 0; return; }
      raf = requestAnimationFrame(step);
    }
    return {
      to: function (t) {
        target = t;
        if (PL.rm) { x = t; v = 0; onTick(x); return; }
        if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
      },
      set: function (t) { x = target = t; v = 0; onTick(x); },
      get: function () { return x; }
    };
  };

  /* звук: короткие щелчки заряда (по желанию пользователя). Звук включается кнопкой. */
  PL.sound = { on: false, ctx: null };
  PL.pop = function (pitch) {
    if (!PL.sound.on) return;
    try {
      var C = g.AudioContext || g.webkitAudioContext; if (!C) return;
      var ctx = PL.sound.ctx || (PL.sound.ctx = new C());
      var o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = "sine"; o.frequency.value = 380 + (pitch || 0) * 60;
      gn.gain.setValueAtTime(.12, ctx.currentTime); gn.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .12);
      o.connect(gn); gn.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .13);
    } catch (e) {}
  };

  /* перетаскивание через pointer events (мышь, палец, маркер доски) */
  PL.drag = function (node, svg, handlers) {
    function pt(e) {
      var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
      var m = svg.getScreenCTM(); return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
    }
    var active = false;
    node.addEventListener("pointerdown", function (e) {
      active = true; node.setPointerCapture && node.setPointerCapture(e.pointerId);
      handlers.start && handlers.start(pt(e)); e.preventDefault();
    });
    node.addEventListener("pointermove", function (e) { if (active) handlers.move(pt(e)); });
    function end(e) { if (!active) return; active = false; handlers.end && handlers.end(pt(e)); }
    node.addEventListener("pointerup", end); node.addEventListener("pointercancel", end);
  };
})(window);
