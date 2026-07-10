/* Vercel Serverless Function — ปฏิทินข่าวเศรษฐกิจจาก ForexFactory
   ใช้ฟีด JSON รายสัปดาห์อย่างเป็นทางการ (faireconomy.media เป็นโดเมนฟีดของ ForexFactory)
   เรียก: /api/ffnews
   คืนค่า: รายการข่าวสัปดาห์นี้ [{ title, country, date, impact, forecast, previous }] */

export default async function handler(req, res) {
  try {
    const r = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      headers: { "User-Agent": "Mozilla/5.0 (dividend-ledger)" },
    });
    if (!r.ok) throw new Error("ฟีดตอบ " + r.status);
    const data = await r.json();
    // แคช 10 นาที — ปฏิทินข่าวไม่เปลี่ยนบ่อย
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: "ดึงปฏิทินข่าวไม่สำเร็จ: " + e.message });
  }
}
