/* PhysLab: небольшой генератор QR-кода без зависимостей (режим «байты», коррекция M, версии 1–6, до 106 байт).
   Работает офлайн. Проверен декодером OpenCV на ссылках разной длины (см. README). */
(function (g) {
  "use strict";
  // версия: [число блоков, байт данных в блоке, байт коррекции в блоке]
  var VER = [null, [1, 16, 10], [1, 28, 16], [1, 44, 26], [2, 32, 18], [2, 43, 24], [4, 27, 16]];
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

  /* ---- поле Галуа GF(256) ---- */
  var EXP = new Array(512), LOG = new Array(256), x = 1, i;
  for (i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  function gmul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
  function rsGen(n) { var p = [1]; for (var k = 0; k < n; k++) { var q = new Array(p.length + 1).fill(0); for (var j = 0; j < p.length; j++) { q[j] ^= p[j]; q[j + 1] ^= gmul(p[j], EXP[k]); } p = q; } return p; }
  function rsEncode(data, n) {
    var gen = rsGen(n), res = data.concat(new Array(n).fill(0));
    for (var a = 0; a < data.length; a++) { var c = res[a]; if (c) for (var b = 0; b < gen.length; b++) res[a + b] ^= gmul(gen[b], c); }
    return res.slice(data.length);
  }

  function utf8(s) { return Array.prototype.slice.call(unescape(encodeURIComponent(s))).map(function (c) { return c.charCodeAt(0); }); }

  function codewords(bytes, ver) {
    var cfg = VER[ver], nb = cfg[0], dpb = cfg[1], ecb = cfg[2], total = nb * dpb, bits = [];
    function put(v, n) { for (var k = n - 1; k >= 0; k--) bits.push((v >> k) & 1); }
    put(4, 4); put(bytes.length, 8); bytes.forEach(function (b) { put(b, 8); });
    for (var t = 0; t < 4 && bits.length < total * 8; t++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var data = []; for (var k = 0; k < bits.length; k += 8) { var v = 0; for (var j = 0; j < 8; j++) v = (v << 1) | bits[k + j]; data.push(v); }
    for (var pad = 0; data.length < total; pad++) data.push(pad % 2 ? 0x11 : 0xec);
    var blocks = [], ecs = [];
    for (var b = 0; b < nb; b++) { var d = data.slice(b * dpb, (b + 1) * dpb); blocks.push(d); ecs.push(rsEncode(d, ecb)); }
    var out = [];
    for (var c = 0; c < dpb; c++) for (b = 0; b < nb; b++) out.push(blocks[b][c]);
    for (c = 0; c < ecb; c++) for (b = 0; b < nb; b++) out.push(ecs[b][c]);
    return out;
  }

  function maskFn(m, r, c) {
    switch (m) {
      case 0: return (r + c) % 2 === 0; case 1: return r % 2 === 0; case 2: return c % 3 === 0; case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; case 5: return (r * c) % 2 + (r * c) % 3 === 0;
      case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0; default: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
    }
  }
  function formatBits(mask) { // уровень коррекции M = 00; код BCH(15,5), многочлен 0x537, маска 0x5412
    var d = (0 << 3) | mask, r = d << 10;
    for (var k = 14; k >= 10; k--) if ((r >> k) & 1) r ^= 0x537 << (k - 10);
    return ((d << 10) | r) ^ 0x5412;
  }

  function build(cw, ver, mask) {
    var n = 17 + 4 * ver, M = [], R = [], r, c;
    for (r = 0; r < n; r++) { M.push(new Array(n).fill(0)); R.push(new Array(n).fill(false)); }
    function set(r, c, v) { M[r][c] = v ? 1 : 0; R[r][c] = true; }
    function finder(r0, c0) { for (var dr = -1; dr <= 7; dr++) for (var dc = -1; dc <= 7; dc++) { var rr = r0 + dr, cc = c0 + dc; if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue; var on = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)); set(rr, cc, on); } }
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    for (c = 8; c < n - 8; c++) { set(6, c, c % 2 === 0); set(c, 6, c % 2 === 0); }
    var al = ALIGN[ver];
    al.forEach(function (ar) { al.forEach(function (ac) { if ((ar === 6 && ac === 6) || (ar === 6 && ac === al[al.length - 1]) || (ar === al[al.length - 1] && ac === 6)) return; for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) set(ar + dr, ac + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1); }); });
    set(n - 8, 8, 1); // тёмный модуль
    // резерв под формат
    for (var k = 0; k < 9; k++) { if (!R[8][k]) set(8, k, 0); if (!R[k][8]) set(k, 8, 0); }
    for (k = 0; k < 8; k++) { if (!R[8][n - 1 - k]) set(8, n - 1 - k, 0); if (!R[n - 1 - k][8]) set(n - 1 - k, 8, 0); }
    // данные змейкой
    var bits = []; cw.forEach(function (b) { for (var j = 7; j >= 0; j--) bits.push((b >> j) & 1); });
    var idx = 0, up = true;
    for (c = n - 1; c > 0; c -= 2) {
      if (c === 6) c--;
      for (var t = 0; t < n; t++) {
        r = up ? n - 1 - t : t;
        for (var dc = 0; dc < 2; dc++) { var cc = c - dc; if (R[r][cc]) continue; var bit = idx < bits.length ? bits[idx++] : 0; M[r][cc] = (bit ^ (maskFn(mask, r, cc) ? 1 : 0)); }
      }
      up = !up;
    }
    // формат (две копии)
    var f = formatBits(mask);
    for (k = 0; k < 15; k++) {
      var bit2 = (f >> k) & 1;
      var r1 = k < 6 ? k : (k < 8 ? k + 1 : null), c1 = k < 8 ? 8 : null;
      if (k < 6) { M[k][8] = bit2; } else if (k < 8) { M[k + 1][8] = bit2; } else if (k === 8) { M[8][7] = bit2; } else { M[8][14 - k] = bit2; }
      if (k < 8) { M[8][n - 1 - k] = bit2; } else { M[n - 15 + k][8] = bit2; }
    }
    return M;
  }
  function penalty(M) {
    var n = M.length, p = 0, r, c, run, k;
    for (var pass = 0; pass < 2; pass++) {
      for (r = 0; r < n; r++) { run = 1; for (c = 1; c < n; c++) { var a = pass ? M[c][r] : M[r][c], b = pass ? M[c - 1][r] : M[r][c - 1]; if (a === b) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
    }
    for (r = 0; r < n - 1; r++) for (c = 0; c < n - 1; c++) { var v = M[r][c]; if (v === M[r][c + 1] && v === M[r + 1][c] && v === M[r + 1][c + 1]) p += 3; }
    var pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    function match(get, p0) { for (var j = 0; j < 11; j++) if (get(j) !== p0[j]) return false; return true; }
    for (r = 0; r < n; r++) for (c = 0; c <= n - 11; c++) { if (match(function (j) { return M[r][c + j]; }, pat1) || match(function (j) { return M[r][c + j]; }, pat2)) p += 40; if (match(function (j) { return M[c + j][r]; }, pat1) || match(function (j) { return M[c + j][r]; }, pat2)) p += 40; }
    var dark = 0; for (r = 0; r < n; r++) for (c = 0; c < n; c++) dark += M[r][c];
    p += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
    return p;
  }

  /* публичный интерфейс: матрица модулей или null, если ссылка слишком длинная */
  function matrix(text) {
    var bytes = utf8(text), ver = 0;
    for (var v = 1; v <= 6; v++) { if (bytes.length <= VER[v][0] * VER[v][1] - 2) { ver = v; break; } }
    if (!ver) return null;
    var cw = codewords(bytes, ver), best = null, bp = 1e9;
    for (var m = 0; m < 8; m++) { var M = build(cw, ver, m), p = penalty(M); if (p < bp) { bp = p; best = M; } }
    return best;
  }
  /* SVG-строка: белый фон, чёрные модули, тихая зона 4 модуля */
  function svg(text, px) {
    var M = matrix(text); if (!M) return "";
    var n = M.length, q = 4, size = n + 2 * q, d = [];
    for (var r = 0; r < n; r++) { var c = 0; while (c < n) { if (M[r][c]) { var s = c; while (c < n && M[r][c]) c++; d.push("M" + (s + q) + "," + (r + q) + "h" + (c - s) + "v1h-" + (c - s) + "z"); } else c++; } }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + " " + size + '" width="' + (px || 240) + '" height="' + (px || 240) + '" shape-rendering="crispEdges" role="img" aria-label="QR-код ссылки для учеников"><rect width="' + size + '" height="' + size + '" fill="#fff"/><path d="' + d.join("") + '" fill="#000"/></svg>';
  }
  var api = { matrix: matrix, svg: svg };
  if (g && typeof window !== "undefined" && g === window) { g.PL = g.PL || {}; g.PL.qr = api; }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : this);
