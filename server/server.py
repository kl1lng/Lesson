#!/usr/bin/env python3
"""PhysLab: сервер для работы класса. Только стандартная библиотека Python 3.8+.

Запуск:   python server/server.py            (порт 8080)
          python server/server.py --port 9000
          TEACHER_KEY=секрет python server/server.py

Как это работает (как Kahoot / Quizizz):
  1. Учитель на teacher.html создаёт СЕССИЮ и копирует ссылку для учеников.
  2. Ученики открывают ссылку, вводят имя, ждут «Начать» (лобби).
  3. Учитель жмёт «Начать»: ученики решают задания в своём темпе, проверка идёт на сервере.
  4. На board.html (экран для доски) живая таблица с очками, потом пьедестал.
Ключ учителя: TEACHER_KEY или data/teacher.key (создаётся при первом запуске).
"""
import csv
import io
import json
import mimetypes
import os
import secrets
import sqlite3
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
os.makedirs(DATA, exist_ok=True)
DB_PATH = os.path.join(DATA, "physlab2.db")
PORT = int(os.environ.get("PORT", "8080"))
if "--port" in sys.argv:
    PORT = int(sys.argv[sys.argv.index("--port") + 1])
HOST = os.environ.get("HOST", "0.0.0.0")
BLOCKED = ("server", "data", "deploy", ".git", ".claude", "design-system")
LOCK = threading.Lock()
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # без похожих символов 0/O, 1/I

# ---------------------------------------------------------------- ключи ответов (только на сервере)
LESSONS = {
    "8b-cond": {
        "title": "Проводники и диэлектрики",
        "sort": {
            "Медная проволока": True, "Железный гвоздь": True, "Алюминиевая ложка": True, "Водопроводная вода": True, "Раствор соли": True,
            "Тело человека": True, "Влажная почва": True, "Графитовый грифель": True,
            "Стекло": False, "Пластмассовая линейка": False, "Резина": False, "Сухое дерево": False, "Бумага": False,
            "Воздух": False, "Фарфор": False, "Янтарь": False, "Шёлк": False, "Керосин": False,
        },
        "mcq": {"check1": 1},
        "order": {
            "o1": ["Поставить нейтральный шарик на изолирующую подставку", "Поднести отрицательный шарик к нейтральному, не касаясь",
                   "Коснуться нейтрального шарика рукой", "Убрать руку", "Убрать отрицательный шарик"],
            "o2": ["Поставить два одинаковых шарика на изолирующих подставках вплотную", "Поднести к ним отрицательный шарик, не касаясь",
                   "Раздвинуть шарики", "Убрать отрицательный шарик"],
        },
        "multi": {"q3": [0, 3]},
        "teacher": {"s1a": 1, "s1b": 1, "q3exp": 1, "s3a": 1, "s3b": 1},
    }
}
AUTO_MAX = {"o1": 2, "o2": 2, "q3sel": 1}
TASKS_TOTAL = 7  # для полосы прогресса


def db():
    c = sqlite3.connect(DB_PATH, timeout=10)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    with db() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS sessions(
            code TEXT PRIMARY KEY, lesson TEXT, cls TEXT, status TEXT DEFAULT 'lobby', created REAL, started REAL, finished REAL)""")
        c.execute("""CREATE TABLE IF NOT EXISTS players(
            sid TEXT PRIMARY KEY, code TEXT, name TEXT, answers TEXT DEFAULT '{}', auto TEXT DEFAULT '{}',
            teacher TEXT DEFAULT '{}', created REAL, updated REAL, UNIQUE(code, name))""")


def teacher_key():
    k = os.environ.get("TEACHER_KEY")
    if k:
        return k
    p = os.path.join(DATA, "teacher.key")
    if os.path.exists(p):
        return open(p, encoding="utf-8").read().strip()
    k = secrets.token_urlsafe(6)
    open(p, "w", encoding="utf-8").write(k)
    return k


TKEY = teacher_key()


def points(lesson_id, answers, auto, teacher):
    """Баллы за урок строго по КСП: этап 1 (2) + этап 2 (6) + этап 3 (2) = максимум 10.
    Автоматически: задания 1 и 2 (по 2) и выбор в задании 3 (1). Учитель: этап 1 (2), объяснение в задании 3 (1), этап 3 (2)."""
    L = LESSONS[lesson_id]
    p = min(2, auto.get("o1", 0)) + min(2, auto.get("o2", 0)) + min(1, auto.get("q3sel", 0))
    p += sum(min(L["teacher"].get(k, 0), v) for k, v in teacher.items())
    return min(10, p)


def progress(a):
    """Сколько заданий урока начато: проверка понимания, этап 1, задания 1-3, этап 3, выходной билет."""
    n = 0
    n += a.get("check1") is not None
    n += len(a.get("s1") or "") > 15
    n += bool(a.get("o1")) + bool(a.get("o2")) + bool(a.get("q3"))
    n += len(a.get("s3") or "") > 15
    n += bool(a.get("x1") or a.get("x2") or a.get("x3"))
    return int(n)


def player_json(r, full=False):
    lid = "8b-cond"
    auto, teacher, answers = json.loads(r["auto"]), json.loads(r["teacher"]), json.loads(r["answers"])
    L = LESSONS[lid]
    a = sum(min(AUTO_MAX.get(k, 0), v) for k, v in auto.items() if k in AUTO_MAX)
    t = sum(min(L["teacher"].get(k, 0), v) for k, v in teacher.items())
    out = {"name": r["name"], "points": points(lid, answers, auto, teacher), "done": progress(answers), "total": TASKS_TOTAL,
           "autoScore": a, "teacherScore": t, "score10": min(10, a + t), "score": min(10, a + t), "updated": r["updated"]}
    if full:
        out.update({"sid": r["sid"], "auto": auto, "teacher": teacher, "answers": answers})
    return out


def new_code(c):
    for _ in range(50):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(5))
        if not c.execute("SELECT 1 FROM sessions WHERE code=?", (code,)).fetchone():
            return code
    raise RuntimeError("no code")


class H(BaseHTTPRequestHandler):
    server_version = "PhysLab/2.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (time.strftime("%H:%M:%S"), fmt % args))

    def send_json(self, obj, code=200):
        b = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(b)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 200_000:
            return {}
        try:
            return json.loads(self.rfile.read(n).decode("utf-8") or "{}")
        except Exception:
            return {}

    def is_teacher(self):
        return secrets.compare_digest(self.headers.get("X-Teacher-Key") or "", TKEY)

    # ---- статика
    def do_HEAD(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        if u.path.startswith("/api/"):
            return self.api("GET", u)
        rel = unquote(u.path).lstrip("/") or "index.html"
        parts = rel.replace("\\", "/").split("/")
        if ".." in parts or parts[0] in BLOCKED or rel.endswith((".py", ".db", ".key")):
            return self.send_error(404)
        p = os.path.join(ROOT, *parts)
        if os.path.isdir(p):
            p = os.path.join(p, "index.html")
        if not os.path.isfile(p):
            return self.send_error(404)
        data = open(p, "rb").read()
        ctype = mimetypes.guess_type(p)[0] or "application/octet-stream"
        if p.endswith(".html"):
            ctype = "text/html; charset=utf-8"
        elif p.endswith((".js", ".css")):
            ctype += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        self.api("POST", urlparse(self.path))

    def do_DELETE(self):
        self.api("DELETE", urlparse(self.path))

    # ---- API
    def api(self, method, u):
        path, q = u.path, parse_qs(u.query)
        code = (q.get("c", [""])[0] or "").upper()
        try:
            if path == "/api/ping":
                return self.send_json({"ok": True})
            if path == "/api/session" and method == "GET":
                return self.session_info(code)
            if path == "/api/join" and method == "POST":
                return self.join(self.body())
            if path == "/api/state" and method == "GET":
                return self.state(q.get("sid", [""])[0])
            if path == "/api/answer" and method == "POST":
                return self.answer(self.body())
            if path == "/api/board" and method == "GET":
                return self.board(code)
            if path.startswith("/api/t/"):
                if not self.is_teacher():
                    return self.send_json({"error": "bad key"}, 401)
                return self.teacher_api(method, path, q, code)
            return self.send_json({"error": "not found"}, 404)
        except Exception as e:
            sys.stderr.write("ERR %r\n" % (e,))
            return self.send_json({"error": "server error"}, 500)

    def teacher_api(self, method, path, q, code):
        if path == "/api/t/session" and method == "POST":
            b = self.body()
            lesson = b.get("lesson") if b.get("lesson") in LESSONS else "8b-cond"
            with LOCK, db() as c:
                code = new_code(c)
                c.execute("INSERT INTO sessions(code,lesson,cls,status,created) VALUES(?,?,?,?,?)", (code, lesson, (b.get("cls") or "")[:12], "lobby", time.time()))
            return self.send_json({"code": code})
        if path == "/api/t/sessions" and method == "GET":
            with db() as c:
                rows = c.execute("SELECT s.*, (SELECT COUNT(*) FROM players p WHERE p.code=s.code) n FROM sessions s ORDER BY created DESC LIMIT 30").fetchall()
            return self.send_json({"sessions": [{"code": r["code"], "cls": r["cls"], "status": r["status"], "created": r["created"], "n": r["n"], "title": LESSONS[r["lesson"]]["title"]} for r in rows]})
        if path == "/api/t/set-status" and method == "POST":
            b = self.body()
            st = b.get("status")
            if st not in ("lobby", "running", "finished"):
                return self.send_json({"error": "bad status"}, 400)
            now = time.time()
            with LOCK, db() as c:
                if st == "running":
                    c.execute("UPDATE sessions SET status='running', started=COALESCE(started, ?), finished=NULL WHERE code=?", (now, (b.get("code") or "").upper()))
                elif st == "finished":
                    c.execute("UPDATE sessions SET status='finished', finished=? WHERE code=?", (now, (b.get("code") or "").upper()))
                else:
                    c.execute("UPDATE sessions SET status='lobby' WHERE code=?", ((b.get("code") or "").upper(),))
            return self.send_json({"ok": True})
        if path == "/api/t/results" and method == "GET":
            with db() as c:
                rows = c.execute("SELECT * FROM players WHERE code=? ORDER BY name", (code,)).fetchall()
            return self.send_json({"rows": [player_json(r, True) for r in rows], "now": time.time()})
        if path == "/api/t/grade" and method == "POST":
            return self.grade(self.body())
        if path == "/api/t/kick" and method == "POST":
            b = self.body()
            with LOCK, db() as c:
                c.execute("DELETE FROM players WHERE sid=?", (b.get("sid", ""),))
            return self.send_json({"ok": True})
        if path == "/api/t/export.csv" and method == "GET":
            return self.export(code)
        if path == "/api/t/delete-session" and method == "DELETE":
            with LOCK, db() as c:
                c.execute("DELETE FROM players WHERE code=?", (code,))
                c.execute("DELETE FROM sessions WHERE code=?", (code,))
            return self.send_json({"ok": True})
        return self.send_json({"error": "not found"}, 404)

    def session_info(self, code):
        with db() as c:
            s = c.execute("SELECT * FROM sessions WHERE code=?", (code,)).fetchone()
            if not s:
                return self.send_json({"error": "Сессия не найдена. Проверь ссылку."}, 404)
            n = c.execute("SELECT COUNT(*) FROM players WHERE code=?", (code,)).fetchone()[0]
        return self.send_json({"code": code, "cls": s["cls"], "status": s["status"], "title": LESSONS[s["lesson"]]["title"], "count": n})

    def join(self, b):
        code = (b.get("code") or "").upper()
        name = " ".join((b.get("name") or "").split())[:30]
        if len(name) < 2:
            return self.send_json({"error": "Введи имя (не короче 2 букв)"}, 400)
        with LOCK, db() as c:
            s = c.execute("SELECT * FROM sessions WHERE code=?", (code,)).fetchone()
            if not s:
                return self.send_json({"error": "Сессия не найдена. Проверь ссылку."}, 404)
            r = next((x for x in c.execute("SELECT * FROM players WHERE code=?", (code,)).fetchall() if x["name"].casefold() == name.casefold()), None)
            if r:
                if b.get("sid") != r["sid"]:
                    return self.send_json({"error": "Такое имя уже занято в этой сессии. Добавь первую букву фамилии."}, 409)
            else:
                if s["status"] == "finished":
                    return self.send_json({"error": "Сессия уже закончилась."}, 403)
                sid = secrets.token_urlsafe(9)
                c.execute("INSERT INTO players(sid,code,name,created,updated) VALUES(?,?,?,?,?)", (sid, code, name, time.time(), time.time()))
                r = c.execute("SELECT * FROM players WHERE sid=?", (sid,)).fetchone()
        return self.send_json({"sid": r["sid"], "name": r["name"], "answers": json.loads(r["answers"]), "auto": json.loads(r["auto"])})

    def state(self, sid):
        with db() as c:
            r = c.execute("SELECT * FROM players WHERE sid=?", (sid,)).fetchone()
            if not r:
                return self.send_json({"error": "no student"}, 404)
            s = c.execute("SELECT * FROM sessions WHERE code=?", (r["code"],)).fetchone()
            allp = [player_json(x) for x in c.execute("SELECT * FROM players WHERE code=?", (r["code"],)).fetchall()]
        allp.sort(key=lambda x: (-x["points"], -x["done"], x["name"].lower()))
        j = player_json(r)
        rank = [i + 1 for i, x in enumerate(allp) if x["name"] == r["name"]][0]
        return self.send_json({"answers": json.loads(r["answers"]), "auto": json.loads(r["auto"]), "name": r["name"], "code": r["code"],
                               "cls": s["cls"], "status": s["status"], "points": j["points"], "done": j["done"], "rank": rank, "players": len(allp)})

    def board(self, code):
        with db() as c:
            s = c.execute("SELECT * FROM sessions WHERE code=?", (code,)).fetchone()
            if not s:
                return self.send_json({"error": "no session"}, 404)
            rows = c.execute("SELECT * FROM players WHERE code=?", (code,)).fetchall()
        pl = sorted((player_json(r) for r in rows), key=lambda x: (-x["points"], -x["done"], x["name"].lower()))
        for i, p in enumerate(pl):
            p["rank"] = i + 1
        return self.send_json({"code": code, "cls": s["cls"], "status": s["status"], "title": LESSONS[s["lesson"]]["title"], "players": pl,
                               "started": s["started"], "now": time.time()})

    def answer(self, b):
        sid, task, val = b.get("sid", ""), b.get("task", ""), b.get("value")
        with LOCK, db() as c:
            r = c.execute("SELECT * FROM players WHERE sid=?", (sid,)).fetchone()
            if not r:
                return self.send_json({"error": "no student"}, 404)
            s = c.execute("SELECT * FROM sessions WHERE code=?", (r["code"],)).fetchone()
            if s["status"] != "running":
                return self.send_json({"error": "Сессия не идёт: " + ("ещё не началась" if s["status"] == "lobby" else "уже закончилась")}, 403)
            lesson = LESSONS[s["lesson"]]
            answers, auto = json.loads(r["answers"]), json.loads(r["auto"])
            res = {"ok": True}
            if task == "sort":
                item, guess = (val or {}).get("item"), (val or {}).get("conductor")
                good = lesson["sort"].get(item)
                if good is None:
                    return self.send_json({"error": "unknown item"}, 400)
                res = {"ok": good == guess}
                st = answers.setdefault("sort", {"right": [], "wrong": 0})
                if res["ok"] and not any(x.get("n") == item for x in st["right"]):
                    st["right"].append({"n": item, "c": bool(good)})
                elif not res["ok"]:
                    st["wrong"] += 1
            elif task in lesson["mcq"]:
                res = {"ok": val == lesson["mcq"][task]}
                answers[task] = val
            elif task in lesson["order"]:
                right = lesson["order"][task]
                seq = [str(x) for x in (val or [])][: len(right) + 2]
                hit = sum(1 for i, t in enumerate(seq) if i < len(right) and t == right[i])
                exact = seq == right
                pts = 2 if exact else (1 if hit >= -(-len(right) * 3 // 5) and len(seq) == len(right) else 0)
                auto[task] = max(auto.get(task, 0), pts)
                answers[task] = {"seq": seq, "hit": hit, "tries": (answers.get(task, {}) or {}).get("tries", 0) + 1}
                res = {"ok": exact, "hit": hit, "total": len(right), "points": pts, "best": auto[task]}
            elif task in lesson["multi"]:
                sel = sorted(int(x) for x in (val or []) if isinstance(x, int))
                ok = sel == sorted(lesson["multi"][task])
                auto["q3sel"] = max(auto.get("q3sel", 0), 1 if ok else 0)
                answers[task] = sel
                res = {"ok": ok, "points": 1 if ok else 0}
            elif task in ("s1", "s3", "q3exp", "x1", "x2", "x3", "goals", "hints", "e1", "e2", "e3", "e4"):
                answers[task] = (val if isinstance(val, (list, dict)) else str(val or "")[:3000])
                res = {"ok": True, "saved": True}
            else:
                return self.send_json({"error": "unknown task"}, 400)
            c.execute("UPDATE players SET answers=?, auto=?, updated=? WHERE sid=?", (json.dumps(answers, ensure_ascii=False), json.dumps(auto), time.time(), sid))
        return self.send_json(res)

    def grade(self, b):
        sid, key, val = b.get("sid", ""), b.get("key", ""), int(b.get("value", 0))
        with LOCK, db() as c:
            r = c.execute("SELECT p.*, s.lesson FROM players p JOIN sessions s ON s.code=p.code WHERE p.sid=?", (sid,)).fetchone()
            if not r:
                return self.send_json({"error": "no student"}, 404)
            lesson = LESSONS[r["lesson"]]
            if key not in lesson["teacher"]:
                return self.send_json({"error": "unknown key"}, 400)
            t = json.loads(r["teacher"])
            t[key] = max(0, min(lesson["teacher"][key], val))
            c.execute("UPDATE players SET teacher=?, updated=? WHERE sid=?", (json.dumps(t), time.time(), sid))
        return self.send_json({"ok": True, "teacher": t})

    def export(self, code):
        with db() as c:
            rows = [player_json(r, True) for r in c.execute("SELECT * FROM players WHERE code=? ORDER BY name", (code,)).fetchall()]
        out = io.StringIO()
        w = csv.writer(out, delimiter=";")
        w.writerow(["Имя", "Баллы (макс. 10)", "Авто (макс. 5)", "Учитель (макс. 5)", "Итого (макс. 10)", "Задание 1 шагов", "Задание 2 шагов", "Этап 1", "Этап 3"])
        for r in sorted(rows, key=lambda x: -x["points"]):
            a = r["answers"]
            w.writerow([r["name"], r["points"], r["autoScore"], r["teacherScore"], r["score10"], r["auto"].get("o1", ""), r["auto"].get("o2", ""),
                        (a.get("s1") or "").replace("\n", " "), (a.get("s3") or "").replace("\n", " ")])
        b = ("﻿" + out.getvalue()).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", 'attachment; filename="physlab-%s.csv"' % code)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)


def lan_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "localhost"


if __name__ == "__main__":
    init_db()
    srv = ThreadingHTTPServer((HOST, PORT), H)
    ip = lan_ip()
    print("PhysLab запущен.")
    print("  Учитель (создать сессию):  http://%s:%d/teacher.html   (ключ: %s)" % (ip, PORT, TKEY))
    print("  Ссылку для учеников создаёт страница учителя.")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nОстановлено.")
