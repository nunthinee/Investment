/* Vercel Serverless Function — ดึงราคาหุ้นสดจาก Yahoo Finance (ฟรี ไม่ต้องมี API key)
   วิธีเรียกจากหน้าเว็บ:  /api/quotes?symbols=PTT.BK,TISCO.BK,KO,QQQI
   หุ้นไทยใช้ท้าย .BK เช่น PTT.BK / หุ้นสหรัฐฯ ใช้ชื่อย่อตรง ๆ เช่น KO
   ราคาที่ได้เป็น near-realtime (ตลาดสหรัฐฯ realtime, ตลาดไทยดีเลย์ ~15 นาที) */

export default async function handler(req, res) {
  const symbols = String(req.query.symbols || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40); // จำกัดสูงสุด 40 ตัวต่อครั้ง กันการยิงถล่ม

  if (!symbols.length) {
    return res.status(400).json({ error: "ต้องส่ง ?symbols=AAA,BBB มาด้วย" });
  }

  const out = {};
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
        const r = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (dividend-ledger)" },
        });
        if (!r.ok) return;
        const j = await r.json();
        const price = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (typeof price === "number" && price > 0) out[sym] = price;
      } catch (e) {
        /* ตัวไหนพลาดก็ข้าม ตัวอื่นยังได้ราคา */
      }
    })
  );

  // แคชที่ edge 60 วินาที — ลดโหลดและเร็วขึ้นสำหรับผู้ใช้ถัดไป
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
  res.status(200).json(out);
}
