
import React, { useEffect, useMemo, useState } from "react";

// Monthly Happiness Tracker UI (no emojis)
// Tick daily for: Work • Relationship • Health
// States per category (cycles): Off → Happy → Sad → Off
// - Month navigation
// - Auto-save (localStorage)
// - CSV export (happy=1, sad=-1, off=0)
// - Clear this month's data
// - TailwindCSS for styling

const CATEGORIES = [
  { key: "work", label: "💼 Work", short: "💼" },
  { key: "health", label: "💪 Health", short: "💪" },
];

const STORAGE_KEY = "monthly-happiness-tracker-v2"; // schema with happy/sad

function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function endOfMonth(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0); }

function getMonthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const last = endOfMonth(first);
  const firstWeekday = first.getDay();
  const daysInMonth = last.getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function fmtDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function migrateOldState(raw) {
  const out = {};
  for (const [dateKey, day] of Object.entries(raw || {})) {
    const next = {};
    for (const c of CATEGORIES) {
      const v = day[c.key];
      if (v === true) next[c.key] = "happy"; // old boolean → happy
      else if (v === false || v == null) next[c.key] = undefined;
      else if (v === "happy" || v === "sad") next[c.key] = v;
    }
    out[dateKey] = next;
  }
  return out;
}

function loadState() {
  try {
    const v2 = localStorage.getItem(STORAGE_KEY);
    if (v2) return JSON.parse(v2);
    const v1 = localStorage.getItem("monthly-happiness-tracker-v1");
    return migrateOldState(v1 ? JSON.parse(v1) : {});
  } catch {
    return {};
  }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function cycleMood(curr) {
  if (!curr) return "happy"; // off → happy
  if (curr === "happy") return "sad"; // happy → sad
  return undefined; // sad → off
}

function moodToInt(m) { return m === "happy" ? 1 : m === "sad" ? -1 : 0; }
function moodClass(m) {
  if (m === "happy") return "bg-green-600 text-white border-green-600 shadow";
  if (m === "sad") return "bg-rose-600 text-white border-rose-600 shadow";
  return "bg-white hover:bg-gray-50";
}

// Instead of emojis, show category initials when Off; buttons change color for Happy/Sad
function moodIcon(m, fallback) {
  if (m === "happy") return "🙂";
  if (m === "sad") return "🙁";
  return fallback; // default to category emoji when Off
}

function computeMonthStats(cursor, checks) {
  const first = startOfMonth(cursor);
  const last = endOfMonth(cursor);
  const perCat = {};
  let totalNet = 0;
  let daysTracked = 0;
  for (const c of CATEGORIES) perCat[c.key] = { happy: 0, sad: 0, off: 0, net: 0 };
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    const k = fmtDateKey(d);
    const day = checks[k] || {};
    let anySet = false;
    for (const c of CATEGORIES) {
      const m = day[c.key];
      if (m === "happy") { perCat[c.key].happy++; perCat[c.key].net += 1; totalNet += 1; anySet = true; }
      else if (m === "sad") { perCat[c.key].sad++; perCat[c.key].net -= 1; totalNet -= 1; anySet = true; }
      else { perCat[c.key].off++; }
    }
    if (anySet) daysTracked++;
  }
  const daysInMonth = last.getDate();
  return { perCat, totalNet, daysTracked, daysInMonth };
}

export default function MonthlyHappinessTracker() {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [checks, setChecks] = useState({});

  useEffect(() => { setChecks(loadState()); }, []);
  useEffect(() => { saveState(checks); }, [checks]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const weeks = useMemo(() => getMonthMatrix(year, month), [year, month]);
  const stats = useMemo(() => computeMonthStats(cursor, checks), [cursor, checks]);

  const toggle = (dateKey, key) => {
    setChecks((prev) => {
      const day = prev[dateKey] || {};
      return { ...prev, [dateKey]: { ...day, [key]: cycleMood(day[key]) } };
    });
  };

  const clearMonth = () => {
    const first = startOfMonth(cursor);
    const last = endOfMonth(cursor);
    const next = { ...checks };
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) delete next[fmtDateKey(d)];
    setChecks(next);
  };

  const prevMonth = () => setCursor(new Date(year, month - 1, 1));
  const nextMonth = () => setCursor(new Date(year, month + 1, 1));

  const downloadCSV = () => {
    const first = startOfMonth(cursor);
    const last = endOfMonth(cursor);
    const rows = [[ "Date", "Work (happy/sad)", "Health (happy/sad)", "Daily Score (±2)" ]];
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      const k = fmtDateKey(d);
      const day = checks[k] || {};
      const w = day.work || "";
      const h = day.health || "";
      const score = moodToInt(w) + moodToInt(h);
      rows.push([k, w, h, score]);
    }
    rows.push([]);
    rows.push(["Totals (month)", "", "", ""]);
    for (const c of CATEGORIES) {
      const s = stats.perCat[c.key];
      rows.push([c.label, `happy:${s.happy}`, `sad:${s.sad}`, `off:${s.off}`, `net:${s.net}`]);
    }
    rows.push(["Overall Net Score", "", "", stats.totalNet]);
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `happiness-${year}-${String(month + 1).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const DayCell = ({ date }) => {
    if (!date) return <div className="border h-28 rounded-2xl bg-white/30" />;
    const k = fmtDateKey(date);
    const day = checks[k] || {};
    const isToday = fmtDateKey(date) === fmtDateKey(new Date());
  const score = moodToInt(day.work) + moodToInt(day.health);
    return (
      <div className={`border rounded-2xl p-2 flex flex-col gap-2 bg-white ${isToday ? "ring-2 ring-indigo-500" : ""}`}>
        <div className="text-xs font-semibold opacity-70">{date.getDate()}</div>
        <div className="mt-auto flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => toggle(k, c.key)}
              className={`text-xs px-2 py-1 rounded-full border transition w-10 text-center select-none ${moodClass(day[c.key])}`}
              title={`${c.label}`}
            >
              {moodIcon(day[c.key], c.short)}
            </button>
          ))}
        </div>
        <div className="text-[10px] mt-1 opacity-60">Score: {score}</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-indigo-50 to-purple-50 p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Monthly Happiness Tracker</h1>
            <p className="text-sm opacity-70">Tick 🙂 or 🙁 for Work and Health. Click again to switch.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={prevMonth} className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50">◀ Prev</button>
            <div className="px-4 py-2 font-semibold">{monthLabel(year, month)}</div>
            <button onClick={nextMonth} className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50">Next ▶</button>
          </div>
        </header>

        <section className="mb-4 flex items-center gap-3 text-sm">
          <span className="px-2 py-1 rounded-full border">🙂 = Happy</span>
          <span className="px-2 py-1 rounded-full border">🙁 = Sad</span>
          <span className="px-2 py-1 rounded-full border">Score = Happy(+1), Sad(−1)</span>
        </section>

        <section className="rounded-3xl border bg-white p-4 shadow-sm">
          <div className="grid grid-cols-7 gap-2 mb-2 text-xs font-medium opacity-70">
            {"Sun Mon Tue Wed Thu Fri Sat".split(" ").map((d) => (
              <div key={d} className="text-center">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weeks.flat().map((date, i) => (<DayCell key={i} date={date} />))}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">This Month Summary</h2>
            <div className="text-xs opacity-70">Days tracked: {stats.daysTracked}/{stats.daysInMonth} · Overall net: {stats.totalNet}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {CATEGORIES.map((c) => {
              const s = stats.perCat[c.key];
              return (
                <div key={c.key} className="border rounded-2xl p-3">
                  <div className="text-sm font-medium mb-2">{c.label}</div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1"><span>🙂</span><span className="font-semibold">{s.happy}</span></div>
                    <div className="flex items-center gap-1"><span>🙁</span><span className="font-semibold">{s.sad}</span></div>
                    <div className="ml-auto text-xs opacity-70">net: <span className="font-semibold">{s.net}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="mt-6 flex flex-wrap gap-3">
          <button onClick={downloadCSV} className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50">Download CSV</button>
          <button onClick={clearMonth} className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50">Clear This Month</button>
        </footer>
      </div>
    </div>
  );
}
