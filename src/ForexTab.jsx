import React, { useState, useEffect, useCallback } from "react";

/* =====================================================================
   แท็บ Forex & ทองคำ
   - ราคาสด + แนวโน้ม (จาก SMA20 และ % เปลี่ยนแปลง 1 เดือน)
   - นาฬิกาเซสชันตลาด (ซิดนีย์/โตเกียว/ลอนดอน/นิวยอร์ก) เวลาไทย
   - ตั้งเตือนราคา: แจ้งเตือนผ่าน Browser Notification + เสียง
     (ทำงานขณะเปิดหน้าเว็บค้างไว้ — บันทึกค่าเตือนถาวรใน localStorage)
   - ข่าวเศรษฐกิจสัปดาห์นี้จากฟีด ForexFactory
   ===================================================================== */

const FX_LIST = [
  { sym: "THB=X", label: "USD/THB", desc: "ดอลลาร์–บาท", d: 2 },
  { sym: "EURUSD=X", label: "EUR/USD", desc: "ยูโร–ดอลลาร์", d: 4 },
  { sym: "GBPUSD=X", label: "GBP/USD", desc: "ปอนด์–ดอลลาร์", d: 4 },
  { sym: "JPY=X", label: "USD/JPY", desc: "ดอลลาร์–เยน", d: 2 },
  { sym: "GC=F", label: "ทองคำ (Gold)", desc: "Gold Futures $/ออนซ์", d: 1 },
];

/* เซสชันตลาด (เวลาไทย ICT โดยประมาณ ช่วง Daylight Saving ของฝั่งตะวันตกอาจเลื่อน ±1 ชม.) */
const SESSIONS = [
  { name: "ซิดนีย์", open: 4, close: 13, emoji: "🇦🇺" },
  { name: "โตเกียว", open: 7, close: 16, emoji: "🇯🇵" },
  { name: "ลอนดอน", open: 14, close: 23, emoji: "🇬🇧" },
  { name: "นิวยอร์ก", open: 19, close: 28, emoji: "🇺🇸" }, // 28 = 04:00 ของวันถัดไป
];

const fmt = (n, d = 2) => Number(n).toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d });

function bkkNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
}
function marketOpen(now) {
  const day = now.getDay(), h = now.getHours();
  if (day === 0) return false;                 // อาทิตย์ปิด
  if (day === 6 && h >= 4) return false;       // เสาร์หลังตี 4 ปิด
  if (day === 1 && h < 4) return false;        // จันทร์ก่อนตี 4 ยังไม่เปิด
  return true;
}
function sessionActive(s, now) {
  if (!marketOpen(now)) return false;
  const h = now.getHours() + now.getMinutes() / 60;
  if (s.close > 24) return h >= s.open || h < s.close - 24;
  return h >= s.open && h < s.close;
}
function trendOf(q) {
  if (!q) return { t: "—", c: "#7C86A0", bg: "#EDF1F6" };
  if (q.price > q.sma20 && q.chg1m > 0.3) return { t: "↑ ขาขึ้น", c: "#2E7D4F", bg: "#E5F4EA" };
  if (q.price < q.sma20 && q.chg1m < -0.3) return { t: "↓ ขาลง", c: "#B03A3A", bg: "#FDEAEA" };
  return { t: "→ Sideways", c: "#96762A", bg: "#F8F0DA" };
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.value = 0.08;
    o.start(); o.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}
const loadAlerts = () => { try { return JSON.parse(localStorage.getItem("fxAlerts") || "[]"); } catch (e) { return []; } };
const saveAlerts = (a) => { try { localStorage.setItem("fxAlerts", JSON.stringify(a)); } catch (e) {} };

const IMPACT_TH = { High: { t: "สูง", c: "#B03A3A", bg: "#FDEAEA" }, Medium: { t: "กลาง", c: "#96762A", bg: "#F8F0DA" }, Low: { t: "ต่ำ", c: "#2E7D4F", bg: "#E5F4EA" } };

export default function ForexTab() {
  const [quotes, setQuotes] = useState({});
  const [news, setNews] = useState([]);
  const [newsErr, setNewsErr] = useState("");
  const [alerts, setAlerts] = useState(loadAlerts);
  const [hits, setHits] = useState([]);
  const [form, setForm] = useState({ sym: "THB=X", dir: "above", price: "" });
  const [notifOk, setNotifOk] = useState(typeof Notification !== "undefined" && Notification.permission === "granted");
  const [now, setNow] = useState(bkkNow());
  const [impactFilter, setImpactFilter] = useState("High");

  const ink = "#3A4358", sub = "#7C86A0", blue = "#3D6FB4";
  const card = { background: "#fff", border: "1px solid #E4E9F2", borderRadius: 14, boxShadow: "0 1px 3px rgba(90,110,160,.06)" };
  const num = { fontVariantNumeric: "tabular-nums" };

  /* ดึงราคา + เช็กเงื่อนไขเตือน ทุก 60 วินาที */
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/fx?symbols=" + encodeURIComponent(FX_LIST.map((f) => f.sym).join(",")));
      const q = await r.json();
      setQuotes(q);
      setAlerts((prev) => {
        const remain = [], fired = [];
        prev.forEach((a) => {
          const p = q[a.sym]?.price;
          const hit = p > 0 && ((a.dir === "above" && p >= a.price) || (a.dir === "below" && p <= a.price));
          (hit ? fired : remain).push({ ...a, cur: p });
        });
        if (fired.length) {
          fired.forEach((a) => {
            const lbl = FX_LIST.find((f) => f.sym === a.sym)?.label || a.sym;
            const msg = `${lbl} ${a.dir === "above" ? "ขึ้นถึง" : "ลงถึง"} ${a.price} (ราคาตอนนี้ ${fmt(a.cur, 4)})`;
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification("🔔 แจ้งเตือนราคา", { body: msg });
            }
            setHits((h) => [{ msg, time: bkkNow().toLocaleTimeString("th-TH") }, ...h].slice(0, 10));
          });
          beep();
          saveAlerts(remain);
        }
        return remain;
      });
    } catch (e) { /* รอบถัดไปลองใหม่ */ }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60000);
    const clock = setInterval(() => setNow(bkkNow()), 30000);
    return () => { clearInterval(id); clearInterval(clock); };
  }, [refresh]);

  /* ข่าว ForexFactory */
  useEffect(() => {
    fetch("/api/ffnews")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) ? setNews(d) : setNewsErr(d.error || "รูปแบบข้อมูลไม่ถูกต้อง"))
      .catch((e) => setNewsErr(String(e.message || e)));
  }, []);

  const addAlert = () => {
    const p = parseFloat(form.price);
    if (!(p > 0)) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().then((perm) => setNotifOk(perm === "granted"));
    }
    const next = [...alerts, { sym: form.sym, dir: form.dir, price: p }];
    setAlerts(next); saveAlerts(next); setForm({ ...form, price: "" });
  };
  const removeAlert = (i) => {
    const next = alerts.filter((_, idx) => idx !== i);
    setAlerts(next); saveAlerts(next);
  };

  const open = marketOpen(now);
  const shownNews = news
    .filter((n) => impactFilter === "ทั้งหมด" || n.impact === impactFilter)
    .slice(0, 30);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* เวลาตลาด */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <div style={{ fontWeight: 700, color: ink }}>🕐 เวลาตลาด Forex (เวลาไทย)</div>
          <span style={{ padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: open ? "#E5F4EA" : "#FDEAEA", color: open ? "#2E7D4F" : "#B03A3A" }}>
            {open ? "● ตลาดเปิดอยู่" : "● ตลาดปิด (เปิด จ. 04:00 – ส. 04:00)"}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginTop: 10 }}>
          {SESSIONS.map((s) => {
            const on = sessionActive(s, now);
            return (
              <div key={s.name} style={{ padding: "10px 12px", borderRadius: 10, background: on ? "#E3EEFA" : "#F4F6FA", border: "1px solid " + (on ? "#B7CFEC" : "#E4E9F2") }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: on ? blue : sub }}>{s.emoji} {s.name} {on && "●"}</div>
                <div style={{ fontSize: 11.5, color: sub, ...num }}>{String(s.open).padStart(2, "0")}:00–{String(s.close > 24 ? s.close - 24 : s.close).padStart(2, "0")}:00 น.</div>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 11.5, color: sub, margin: "8px 0 0" }}>ช่วงลอนดอน+นิวยอร์กซ้อนกัน (~19:00–23:00 น.) คือช่วงสภาพคล่องและความผันผวนสูงสุด · เวลาอาจเลื่อน ±1 ชม. ตาม Daylight Saving</p>
      </div>

      {/* ราคาสด + แนวโน้ม */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
        {FX_LIST.map((f) => {
          const q = quotes[f.sym];
          const tr = trendOf(q);
          const up = q && q.chg1d >= 0;
          return (
            <div key={f.sym} style={{ ...card, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700, color: blue }}>{f.label}</div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: tr.bg, color: tr.c }}>{tr.t}</span>
              </div>
              <div style={{ fontSize: 11.5, color: sub }}>{f.desc}</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: ink, ...num }}>{q ? fmt(q.price, f.d) : "…"}</div>
              {q && (
                <div style={{ fontSize: 12, marginTop: 2, ...num }}>
                  <span style={{ color: up ? "#2E7D4F" : "#B03A3A", fontWeight: 700 }}>{up ? "▲" : "▼"} {fmt(Math.abs(q.chg1d), 2)}% วันนี้</span>
                  <span style={{ color: sub }}> · 1 เดือน {q.chg1m >= 0 ? "+" : ""}{fmt(q.chg1m, 1)}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ตั้งเตือนราคา */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontWeight: 700, color: ink }}>🔔 ตั้งเตือนราคา</div>
        <p style={{ fontSize: 12, color: sub, margin: "4px 0 10px" }}>
          ระบบเช็กราคาทุก 60 วินาที เมื่อถึงเป้าจะเด้ง Notification + เสียงเตือน — ทำงานขณะเปิดหน้าเว็บนี้ค้างไว้ (พับจอ/สลับแท็บได้ แต่ห้ามปิด)
          {!notifOk && " · เมื่อกดเพิ่มครั้งแรก เบราว์เซอร์จะขออนุญาตแจ้งเตือน กด 'อนุญาต' ด้วยนะครับ"}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={form.sym} onChange={(e) => setForm({ ...form, sym: e.target.value })}
            style={{ padding: "8px 10px", border: "1px solid #D5DDEA", borderRadius: 10, fontSize: 13, fontFamily: "inherit" }}>
            {FX_LIST.map((f) => <option key={f.sym} value={f.sym}>{f.label}</option>)}
          </select>
          <select value={form.dir} onChange={(e) => setForm({ ...form, dir: e.target.value })}
            style={{ padding: "8px 10px", border: "1px solid #D5DDEA", borderRadius: 10, fontSize: 13, fontFamily: "inherit" }}>
            <option value="above">ขึ้นถึง ≥</option>
            <option value="below">ลงถึง ≤</option>
          </select>
          <input type="number" step="any" placeholder="ราคาเป้าหมาย" value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            style={{ padding: "8px 10px", border: "1px solid #D5DDEA", borderRadius: 10, fontSize: 13, width: 130, fontFamily: "inherit" }} />
          <button onClick={addAlert} style={{ padding: "8px 18px", borderRadius: 999, border: "none", fontWeight: 700, fontSize: 13, background: "linear-gradient(90deg,#8FB6E8,#F0A8C6)", color: "#fff" }}>+ เพิ่ม</button>
        </div>
        {alerts.length > 0 && (
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            {alerts.map((a, i) => {
              const f = FX_LIST.find((x) => x.sym === a.sym);
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#F4F7FB", borderRadius: 10, fontSize: 13 }}>
                  <span style={num}><b style={{ color: blue }}>{f?.label}</b> {a.dir === "above" ? "ขึ้นถึง ≥" : "ลงถึง ≤"} <b>{a.price}</b></span>
                  <button onClick={() => removeAlert(i)} style={{ border: "none", background: "none", color: "#B03A3A", fontWeight: 700, fontSize: 12 }}>ลบ</button>
                </div>
              );
            })}
          </div>
        )}
        {hits.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#2E7D4F" }}>ประวัติการเตือนล่าสุด</div>
            {hits.map((h, i) => (
              <div key={i} style={{ fontSize: 12.5, color: ink, padding: "4px 0", borderBottom: "1px dashed #E4E9F2" }}>✅ {h.time} — {h.msg}</div>
            ))}
          </div>
        )}
      </div>

      {/* ข่าว ForexFactory */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <div style={{ fontWeight: 700, color: ink }}>📰 ปฏิทินข่าวเศรษฐกิจสัปดาห์นี้ (ForexFactory)</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["High", "Medium", "ทั้งหมด"].map((f) => (
              <button key={f} onClick={() => setImpactFilter(f)} style={{
                padding: "4px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                border: "1px solid " + (impactFilter === f ? blue : "#D5DDEA"),
                background: impactFilter === f ? "#E3EEFA" : "#fff", color: impactFilter === f ? blue : sub,
              }}>{f === "High" ? "ผลกระทบสูง" : f === "Medium" ? "กลางขึ้นไป" : "ทั้งหมด"}</button>
            ))}
          </div>
        </div>
        {newsErr && <p style={{ fontSize: 12.5, color: "#B03A3A" }}>โหลดข่าวไม่สำเร็จ: {newsErr}</p>}
        <div style={{ overflow: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr style={{ color: sub, textAlign: "left" }}>
              {["เวลา (ไทย)", "สกุลเงิน", "ข่าว", "ผลกระทบ", "คาดการณ์", "ครั้งก่อน"].map((h) => (
                <th key={h} style={{ padding: "6px 8px", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {shownNews.map((n, i) => {
                const imp = IMPACT_TH[n.impact] || { t: n.impact, c: sub, bg: "#F4F6FA" };
                const dt = n.date ? new Date(n.date) : null;
                return (
                  <tr key={i} style={{ borderTop: "1px solid #EDF1F6" }}>
                    <td style={{ padding: "6px 8px", whiteSpace: "nowrap", ...num }}>
                      {dt ? dt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", weekday: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td style={{ padding: "6px 8px", fontWeight: 700, color: blue }}>{n.country}</td>
                    <td style={{ padding: "6px 8px", color: ink }}>{n.title}</td>
                    <td style={{ padding: "6px 8px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: imp.bg, color: imp.c }}>{imp.t}</span>
                    </td>
                    <td style={{ padding: "6px 8px", ...num }}>{n.forecast || "—"}</td>
                    <td style={{ padding: "6px 8px", color: sub, ...num }}>{n.previous || "—"}</td>
                  </tr>
                );
              })}
              {!shownNews.length && !newsErr && (
                <tr><td colSpan={6} style={{ padding: 12, color: sub }}>กำลังโหลดข่าว…</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11.5, color: sub, margin: "8px 0 0" }}>
          ข่าว "ผลกระทบสูง" (เช่น Non-Farm Payrolls, CPI, ดอกเบี้ย Fed) มักทำให้ราคาเหวี่ยงแรงในไม่กี่นาที — หลีกเลี่ยงการถือสถานะหนัก ๆ ช่วงคร่อมข่าว ·
          ดูฉบับเต็มที่ <a href="https://www.forexfactory.com/calendar" target="_blank" rel="noreferrer" style={{ color: blue }}>forexfactory.com/calendar</a>
        </p>
      </div>

      <div style={{ ...card, padding: 14, background: "#FBF6FA", border: "1px solid #EBD9E6" }}>
        <p style={{ fontSize: 12.5, lineHeight: 1.8, margin: 0, color: "#7A5C74" }}>
          <b>คำเตือน:</b> Forex และทองคำมีความผันผวนสูงและมีเลเวอเรจ อาจขาดทุนเกินเงินต้นได้
          แนวโน้มที่แสดงคำนวณจากสถิติอย่างง่าย (SMA20 + โมเมนตัม 1 เดือน) ใช้ประกอบการวิเคราะห์เท่านั้น ไม่ใช่สัญญาณซื้อขาย
          ราคาจาก Yahoo Finance อาจดีเลย์เล็กน้อย ห้ามใช้ตัดสินใจเทรดรายวินาที
        </p>
      </div>
    </div>
  );
}
