/* PhysLab: список материалов с фотографиями (фото со свободными лицензиями Wikimedia Commons, авторы и лицензии: CREDITS.md) */
(function () {
  "use strict";
  var PL = window.PL = window.PL || {};
  PL.MATERIALS = [
    { k: "copper", n: "Медная проволока", c: true, kind: "metal" },
    { k: "iron", n: "Железный гвоздь", c: true, kind: "metal" },
    { k: "aluminium", n: "Алюминий (фольга)", c: true, kind: "metal" },
    { k: "graphite", n: "Графит (грифель)", c: true, kind: "metal", note: "в учебнике 1 не указан, но графит проводит ток" },
    { k: "saltwater", n: "Морская вода", c: true, kind: "ion", note: "в ней растворены соли" },
    { k: "water", n: "Водопроводная вода", c: true, kind: "ion" },
    { k: "hand", n: "Тело человека", c: true, kind: "ion" },
    { k: "soil", n: "Влажная почва", c: true, kind: "ion" },
    { k: "glass", n: "Стекло", c: false },
    { k: "plastic", n: "Пластмасса", c: false },
    { k: "rubber", n: "Резина", c: false },
    { k: "wood", n: "Сухое дерево", c: false },
    { k: "paper", n: "Бумага", c: false },
    { k: "porcelain", n: "Фарфор", c: false },
    { k: "amber", n: "Янтарь", c: false },
    { k: "silk", n: "Шёлк", c: false }
  ];
  /* кнопка-карточка материала с фото */
  PL.matBtn = function (m, parent) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "mat"; b.dataset.k = m.k;
    var img = document.createElement("img"); img.src = "img/materials/" + m.k + ".jpg"; img.alt = m.n; img.loading = "lazy"; img.draggable = false;
    var t = document.createElement("span"); t.textContent = m.n;
    var tick = document.createElement("i"); tick.className = "tick"; tick.textContent = m.c ? "✓" : "–";
    b.appendChild(img); b.appendChild(t); b.appendChild(tick);
    if (parent) parent.appendChild(b);
    return b;
  };
})();
