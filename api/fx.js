/* Vercel Serverless Function — ราคา Forex/ทองคำ พร้อมข้อมูลแนวโน้ม
   เรียก: /api/fx?symbols=THB=X,EURUSD=X,GC=F
   คืนค่า: { "THB=X": { price, chg1d, chg1m, sma20 } , ... }
   - price  = ราคาล่าสุด
   - chg1d  = % เปลี่ยนแปลงจากวันก่อน
   - chg1m  = % เปลี่ยนแปลงในรอบ ~1 เดือน
   - sma20  = ค่าเฉลี่ยเคลื่อนที่ 20 วัน (ใช้ตัดสินแนวโน้มฝั่งหน้าเว็บ) */

export default async function handler(req, res) {
  const symbols = String(req.query.symbols || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (!symbols.length) {
    return res.status(400).json({ error: "ต้องส่ง ?symbols=THB=X,GC=F มาด้วย" });
  }

  const out = {};
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1mo`;
        const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (dividend-ledger)" } });
        if (!r.ok) return;
        const j = await r.json();
        const result = j?.chart?.result?.[0];
        const price = result?.meta?.regularMarketPrice;
        if (!(typeof price === "number" && price > 0)) return;
        const closes = (result?.indicators?.quote?.[0]?.close || []).filter((v) => typeof v === "number" && v > 0);
        const prev = result?.meta?.chartPreviousClose || closes[closes.length - 2] || price;
        const first = closes[0] || price;
        const win = closes.slice(-20);
        const sma20 = win.length ? win.reduce((a, b) => a + b, 0) / win.length : price;
        out[sym] = {
          price,
          chg1d: prev ? ((price / prev) - 1) * 100 : 0,
          chg1m: first ? ((price / first) - 1) * 100 : 0,
          sma20,
        };
      } catch (e) { /* ข้ามตัวที่พลาด */ }
    })
  );

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
  res.status(200).json(out);
}
