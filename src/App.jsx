import React, { useState, useMemo, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import ForexTab from "./ForexTab.jsx";

/* =====================================================================
   สมุดปันผล — เวอร์ชัน Self-hosted (Vercel)
   ราคาสดจาก /api/quotes (Yahoo Finance) อัปเดตอัตโนมัติทุก 60 วินาที
   ข้อมูลปันผลย้อนหลังเป็นค่าโดยประมาณเพื่อการศึกษา — ตรวจสอบจริงที่
   set.or.th ก่อนตัดสินใจลงทุนเสมอ
   ===================================================================== */

const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const TH_STOCKS = [
  { sym: "TISCO", name: "ทิสโก้ไฟแนนเชียลกรุ๊ป", sector: "ธนาคาร/การเงิน", price: 98,
    dps: { 2016: 3.5, 2017: 4.0, 2018: 7.0, 2019: 7.75, 2020: 6.3, 2021: 7.0, 2022: 7.75, 2023: 7.75, 2024: 7.75, 2025: 7.75 },
    xd: [4], freq: "ปีละ 1 ครั้ง",
    pay2025: [{ round: "ประจำปี", xd: "~ปลาย เม.ย.", pay: "~กลาง พ.ค.", amt: 7.75 }],
    note: "จ่ายสม่ำเสมอที่สุดตัวหนึ่งของกลุ่มธนาคาร Payout ratio สูง" },
  { sym: "SCB", name: "เอสซีบี เอกซ์ (SCBX)", sector: "ธนาคาร/การเงิน", price: 124,
    dps: { 2016: 3.0, 2017: 4.0, 2018: 4.0, 2019: 6.25, 2020: 2.3, 2021: 4.06, 2022: 6.67, 2023: 10.34, 2024: 10.4, 2025: 10.5 },
    xd: [4, 9], freq: "ปีละ 2 ครั้ง",
    pay2025: [{ round: "ประจำปี", xd: "~กลาง เม.ย.", pay: "~ต้น พ.ค.", amt: 8.5 }, { round: "ระหว่างกาล", xd: "~ต้น ก.ย.", pay: "~ปลาย ก.ย.", amt: 2.0 }],
    note: "หลังปรับโครงสร้างเป็น SCBX เพิ่ม payout จ่ายปันผลสูงขึ้นชัดเจน" },
  { sym: "PTTEP", name: "ปตท.สำรวจและผลิตปิโตรเลียม", sector: "พลังงานต้นน้ำ", price: 122,
    dps: { 2016: 3.0, 2017: 3.25, 2018: 5.0, 2019: 6.0, 2020: 4.25, 2021: 5.0, 2022: 9.25, 2023: 9.5, 2024: 9.5, 2025: 9.5 },
    xd: [2, 8], freq: "ปีละ 2 ครั้ง",
    pay2025: [{ round: "ประจำปี (งวดหลัง)", xd: "~กลาง ก.พ.", pay: "~กลาง เม.ย.", amt: 5.13 }, { round: "ระหว่างกาล", xd: "~กลาง ส.ค.", pay: "~ปลาย ส.ค.", amt: 4.38 }],
    note: "ยีลด์สูง ~7–8% ปันผลผูกกับราคาน้ำมัน/ก๊าซโลก ผันผวนตามวัฏจักรพลังงาน" },
  { sym: "KTB", name: "ธนาคารกรุงไทย", sector: "ธนาคาร/การเงิน", price: 26.5,
    dps: { 2016: 0.86, 2017: 0.61, 2018: 0.7, 2019: 0.75, 2020: 0.28, 2021: 0.42, 2022: 0.68, 2023: 0.87, 2024: 1.09, 2025: 1.33 },
    xd: [4, 9], freq: "ปีละ 2 ครั้ง",
    pay2025: [{ round: "ประจำปี", xd: "~กลาง เม.ย.", pay: "~ต้น พ.ค.", amt: 0.88 }, { round: "ระหว่างกาล", xd: "~กลาง ก.ย.", pay: "~ต้น ต.ค.", amt: 0.45 }],
    note: "CET1 สูงสุดในกลุ่มธนาคาร เริ่มจ่าย Interim ครั้งแรก โบรกฯ ชูเป็นหุ้นเด่นปี 2026" },
  { sym: "BBL", name: "ธนาคารกรุงเทพ", sector: "ธนาคาร/การเงิน", price: 152,
    dps: { 2016: 6.5, 2017: 6.5, 2018: 6.5, 2019: 7.0, 2020: 2.5, 2021: 3.5, 2022: 4.5, 2023: 7.0, 2024: 8.5, 2025: 8.5 },
    xd: [4, 9], freq: "ปีละ 2 ครั้ง",
    pay2025: [{ round: "ประจำปี", xd: "~กลาง เม.ย.", pay: "~ต้น พ.ค.", amt: 6.5 }, { round: "ระหว่างกาล", xd: "~ต้น ก.ย.", pay: "~ปลาย ก.ย.", amt: 2.0 }],
    note: "งบดุลแข็งแรง จ่ายปันผลต่อเนื่องยาวนานหลายสิบปี" },
  { sym: "KBANK", name: "ธนาคารกสิกรไทย", sector: "ธนาคาร/การเงิน", price: 160,
    dps: { 2016: 4.0, 2017: 4.0, 2018: 4.0, 2019: 5.0, 2020: 2.5, 2021: 3.25, 2022: 4.0, 2023: 6.5, 2024: 10.5, 2025: 11.0 },
    xd: [4, 9], freq: "ปีละ 2 ครั้ง",
    pay2025: [{ round: "ประจำปี", xd: "~กลาง เม.ย.", pay: "~ต้น พ.ค.", amt: 8.5 }, { round: "ระหว่างกาล", xd: "~กลาง ก.ย.", pay: "~ต้น ต.ค.", amt: 2.5 }],
    note: "เพิ่มอัตราจ่ายปันผลก้าวกระโดดช่วงปี 2024–2025" },
  { sym: "TTB", name: "ทีเอ็มบีธนชาต", sector: "ธนาคาร/การเงิน", price: 1.88,
    dps: { 2016: 0.06, 2017: 0.06, 2018: 0.06, 2019: 0.03, 2020: 0.045, 2021: 0.05, 2022: 0.07, 2023: 0.105, 2024: 0.13, 2025: 0.135 },
    xd: [4, 9], freq: "ปีละ 2 ครั้ง",
    pay2025: [{ round: "ประจำปี", xd: "~กลาง เม.ย.", pay: "~ต้น พ.ค.", amt: 0.075 }, { round: "ระหว่างกาล", xd: "~กลาง ก.ย.", pay: "~ต้น ต.ค.", amt: 0.06 }],
    note: "ยีลด์ ~7% ราคาต่อหุ้นถูก สะสมจำนวนมากได้ง่าย เพิ่ม payout ต่อเนื่องหลังควบรวม" },
  { sym: "BDMS", name: "กรุงเทพดุสิตเวชการ", sector: "โรงพยาบาล", price: 18.4,
    dps: { 2016: 0.36, 2017: 0.38, 2018: 0.36, 2019: 0.55, 2020: 0.55, 2021: 0.6, 2022: 0.75, 2023: 0.8, 2024: 0.9, 2025: 0.95 },
    xd: [4, 9], freq: "ปีละ 2 ครั้ง",
    pay2025: [{ round: "ประจำปี (งวดหลัง)", xd: "~กลาง เม.ย.", pay: "~ต้น พ.ค.", amt: 0.5 }, { round: "ระหว่างกาล", xd: "~ต้น ก.ย.", pay: "~ปลาย ก.ย.", amt: 0.45 }],
    note: "เครือโรงพยาบาลใหญ่สุดในไทย ปันผลโตทุกปี รับเทรนด์สังคมสูงวัย" },
  { sym: "BH", name: "โรงพยาบาลบำรุงราษฎร์", sector: "โรงพยาบาล", price: 165,
    dps: { 2016: 2.7, 2017: 2.8, 2018: 3.05, 2019: 3.2, 2020: 2.05, 2021: 2.4, 2022: 3.1, 2023: 4.0, 2024: 4.4, 2025: 4.5 },
    xd: [4, 8], freq: "ปีละ 2 ครั้ง",
    pay2025: [{ round: "ประจำปี (งวดหลัง)", xd: "~ต้น เม.ย.", pay: "~ปลาย เม.ย.", amt: 2.6 }, { round: "ระหว่างกาล", xd: "~กลาง ส.ค.", pay: "~ต้น ก.ย.", amt: 1.9 }],
    note: "โรงพยาบาลพรีเมียมรับคนไข้ต่างชาติ มาร์จิ้นสูง แต่พึ่งพิงคนไข้ตะวันออกกลางสูง" },
  { sym: "ADVANC", name: "แอดวานซ์ อินโฟร์ เซอร์วิส", sector: "สื่อสาร", price: 292,
    dps: { 2016: 10.08, 2017: 7.08, 2018: 7.08, 2019: 7.34, 2020: 6.92, 2021: 6.92, 2022: 7.79, 2023: 8.16, 2024: 8.72, 2025: 9.6 },
    xd: [4, 8], freq: "ปีละ 2 ครั้ง",
    pay2025: [{ round: "ประจำปี (งวดหลัง)", xd: "~ต้น เม.ย.", pay: "~ปลาย เม.ย.", amt: 5.0 }, { round: "ระหว่างกาล", xd: "~กลาง ส.ค.", pay: "~ต้น ก.ย.", amt: 4.6 }],
    note: "ผู้นำตลาดมือถือ กระแสเงินสดแข็งแรง จ่ายไม่เคยขาดกว่า 20 ปี" },
  { sym: "INTUCH", name: "อินทัช โฮลดิ้งส์", sector: "สื่อสาร (Holding)", price: 84,
    dps: { 2016: 2.6, 2017: 2.6, 2018: 2.65, 2019: 2.72, 2020: 2.6, 2021: 2.68, 2022: 2.87, 2023: 3.05, 2024: 3.38, 2025: 3.5 },
    xd: [4, 8], freq: "ปีละ 2 ครั้ง",
    pay2025: [{ round: "ประจำปี (งวดหลัง)", xd: "~ต้น เม.ย.", pay: "~ปลาย เม.ย.", amt: 1.8 }, { round: "ระหว่างกาล", xd: "~กลาง ส.ค.", pay: "~ต้น ก.ย.", amt: 1.7 }],
    note: "ถือหุ้น ADVANC เป็นหลัก รับปันผลส่งผ่านมาให้ผู้ถือหุ้น" },
  { sym: "PTT", name: "ปตท.", sector: "พลังงาน", price: 32.5,
    dps: { 2016: 1.6, 2017: 2.0, 2018: 2.0, 2019: 2.0, 2020: 1.0, 2021: 2.0, 2022: 2.0, 2023: 2.0, 2024: 2.1, 2025: 2.1 },
    xd: [3, 9], freq: "ปีละ 2 ครั้ง",
    pay2025: [{ round: "ประจำปี (งวดหลัง)", xd: "~ต้น มี.ค.", pay: "~ปลาย เม.ย.", amt: 1.1 }, { round: "ระหว่างกาล", xd: "~กลาง ก.ย.", pay: "~กลาง ต.ค.", amt: 1.0 }],
    note: "รัฐวิสาหกิจพลังงานรายใหญ่ ปันผลผูกกับราคาน้ำมัน/ก๊าซ" },
  { sym: "RATCH", name: "ราช กรุ๊ป", sector: "โรงไฟฟ้า", price: 29,
    dps: { 2016: 2.27, 2017: 2.35, 2018: 2.4, 2019: 2.4, 2020: 2.4, 2021: 2.4, 2022: 1.6, 2023: 1.6, 2024: 1.6, 2025: 1.6 },
    xd: [4, 9], freq: "ปีละ 2 ครั้ง",
    pay2025: [{ round: "ประจำปี (งวดหลัง)", xd: "~ต้น เม.ย.", pay: "~ปลาย เม.ย.", amt: 0.8 }, { round: "ระหว่างกาล", xd: "~ต้น ก.ย.", pay: "~ปลาย ก.ย.", amt: 0.8 }],
    note: "ยีลด์สูงเพราะราคาหุ้นปรับลง ติดตามภาระหนี้จากการลงทุนใหม่" },
  { sym: "LH", name: "แลนด์ แอนด์ เฮ้าส์", sector: "อสังหาริมทรัพย์", price: 5.4,
    dps: { 2016: 0.75, 2017: 0.7, 2018: 0.75, 2019: 0.63, 2020: 0.4, 2021: 0.6, 2022: 0.65, 2023: 0.6, 2024: 0.35, 2025: 0.35 },
    xd: [4, 8], freq: "ปีละ 2 ครั้ง",
    pay2025: [{ round: "ประจำปี (งวดหลัง)", xd: "~ปลาย เม.ย.", pay: "~กลาง พ.ค.", amt: 0.2 }, { round: "ระหว่างกาล", xd: "~ปลาย ส.ค.", pay: "~กลาง ก.ย.", amt: 0.15 }],
    note: "ยีลด์สูงแต่ปันผลมีแนวโน้มลดลงตามกำไร อสังหาฯ เป็นวัฏจักร" },
  { sym: "SPALI", name: "ศุภาลัย", sector: "อสังหาริมทรัพย์", price: 17.5,
    dps: { 2016: 1.0, 2017: 1.05, 2018: 1.1, 2019: 1.0, 2020: 0.85, 2021: 1.25, 2022: 1.45, 2023: 1.35, 2024: 1.4, 2025: 1.35 },
    xd: [4, 8], freq: "ปีละ 2 ครั้ง",
    pay2025: [{ round: "ประจำปี (งวดหลัง)", xd: "~กลาง เม.ย.", pay: "~ต้น พ.ค.", amt: 0.75 }, { round: "ระหว่างกาล", xd: "~ปลาย ส.ค.", pay: "~กลาง ก.ย.", amt: 0.6 }],
    note: "ฐานะการเงินแข็งแรงในกลุ่มอสังหาฯ หนี้ต่ำ จ่ายต่อเนื่อง" },
  { sym: "CPN", name: "เซ็นทรัลพัฒนา", sector: "ค้าปลีก/อสังหาฯ", price: 54,
    dps: { 2016: 0.83, 2017: 1.4, 2018: 1.1, 2019: 1.3, 2020: 0.8, 2021: 0.6, 2022: 1.15, 2023: 1.6, 2024: 1.9, 2025: 2.0 },
    xd: [5], freq: "ปีละ 1 ครั้ง",
    pay2025: [{ round: "ประจำปี", xd: "~ต้น พ.ค.", pay: "~ปลาย พ.ค.", amt: 2.0 }],
    note: "รายได้ค่าเช่าศูนย์การค้าแข็งแรง โบรกฯ ชูเป็นหุ้นเด่นปี 2026" },
  { sym: "AMATA", name: "อมตะ คอร์ปอเรชัน", sector: "นิคมอุตสาหกรรม", price: 22,
    dps: { 2016: 0.35, 2017: 0.42, 2018: 0.5, 2019: 0.55, 2020: 0.3, 2021: 0.4, 2022: 0.6, 2023: 0.7, 2024: 0.85, 2025: 0.9 },
    xd: [4], freq: "ปีละ 1 ครั้ง",
    pay2025: [{ round: "ประจำปี", xd: "~ปลาย เม.ย.", pay: "~กลาง พ.ค.", amt: 0.9 }],
    note: "รับอานิสงส์ย้ายฐานการผลิต/FDI ปันผลโตต่อเนื่อง" },
  { sym: "BCP", name: "บางจาก คอร์ปอเรชัน", sector: "พลังงาน", price: 37,
    dps: { 2016: 1.8, 2017: 2.0, 2018: 1.55, 2019: 0.8, 2020: 0.4, 2021: 2.0, 2022: 2.5, 2023: 2.0, 2024: 2.25, 2025: 2.3 },
    xd: [4, 9], freq: "ปีละ 2 ครั้ง",
    pay2025: [{ round: "ประจำปี (งวดหลัง)", xd: "~กลาง เม.ย.", pay: "~ต้น พ.ค.", amt: 1.3 }, { round: "ระหว่างกาล", xd: "~ต้น ก.ย.", pay: "~ปลาย ก.ย.", amt: 1.0 }],
    note: "ปันผลผันผวนตามค่าการกลั่น เหมาะเป็นส่วนเสริม ไม่ใช่แกนหลัก" },
];

const US_STOCKS = [
  { sym: "KO", name: "Coca-Cola", sector: "เครื่องดื่ม", type: "มั่นคง", price: 70, divYr: 2.04, streak: 63,
    xd: [3, 6, 9, 12], freq: "รายไตรมาส", pay2025: [{ round: "ทุกไตรมาส", xd: "~กลาง มี.ค./มิ.ย./ก.ย./ธ.ค.", pay: "~2 สัปดาห์ถัดไป", amt: 0.51 }],
    note: "Dividend King — เพิ่มปันผลติดต่อกันกว่า 60 ปี" },
  { sym: "JNJ", name: "Johnson & Johnson", sector: "สุขภาพ", type: "มั่นคง", price: 155, divYr: 5.2, streak: 63,
    xd: [2, 5, 8, 11], freq: "รายไตรมาส", pay2025: [{ round: "ทุกไตรมาส", xd: "~ปลาย ก.พ./พ.ค./ส.ค./พ.ย.", pay: "~2 สัปดาห์ถัดไป", amt: 1.3 }],
    note: "Dividend King กลุ่มสุขภาพ เครดิตเรตติ้งระดับสูงสุด" },
  { sym: "PG", name: "Procter & Gamble", sector: "สินค้าอุปโภคบริโภค", type: "มั่นคง", price: 165, divYr: 4.03, streak: 69,
    xd: [1, 4, 7, 10], freq: "รายไตรมาส", pay2025: [{ round: "ทุกไตรมาส", xd: "~กลาง ม.ค./เม.ย./ก.ค./ต.ค.", pay: "~กลางเดือนถัดไป", amt: 1.01 }],
    note: "เพิ่มปันผลติดต่อกันเกือบ 70 ปี สินค้าจำเป็นทนทุกวัฏจักร" },
  { sym: "O", name: "Realty Income", sector: "REIT อสังหาฯ", type: "มั่นคง", price: 58, divYr: 3.16, streak: 30,
    xd: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], freq: "รายเดือน", pay2025: [{ round: "ทุกเดือน", xd: "~ต้นเดือน", pay: "~กลางเดือน", amt: 0.264 }],
    note: "จ่ายปันผล 'ทุกเดือน' เหมาะสร้างกระแสเงินสดรายเดือนช่วงเกษียณ" },
  { sym: "PEP", name: "PepsiCo", sector: "เครื่องดื่ม/อาหาร", type: "มั่นคง", price: 145, divYr: 5.42, streak: 53,
    xd: [3, 6, 9, 12], freq: "รายไตรมาส", pay2025: [{ round: "ทุกไตรมาส", xd: "~ต้น มี.ค./มิ.ย./ก.ย./ธ.ค.", pay: "~ปลายเดือนเดียวกัน", amt: 1.36 }],
    note: "Dividend King ยีลด์สูงกว่าค่าเฉลี่ยตัวเองในอดีต" },
  { sym: "MCD", name: "McDonald's", sector: "อาหาร/แฟรนไชส์", type: "มั่นคง", price: 300, divYr: 7.08, streak: 49,
    xd: [3, 6, 9, 12], freq: "รายไตรมาส", pay2025: [{ round: "ทุกไตรมาส", xd: "~ต้น มี.ค./มิ.ย./ก.ย./ธ.ค.", pay: "~กลางเดือนเดียวกัน", amt: 1.77 }],
    note: "โมเดลแฟรนไชส์+ค่าเช่า กระแสเงินสดสม่ำเสมอ" },
  { sym: "ABBV", name: "AbbVie", sector: "ยา/ไบโอเทค", type: "มั่นคง", price: 200, divYr: 6.56, streak: 12,
    xd: [1, 4, 7, 10], freq: "รายไตรมาส", pay2025: [{ round: "ทุกไตรมาส", xd: "~กลาง ม.ค./เม.ย./ก.ค./ต.ค.", pay: "~กลางเดือนถัดไป", amt: 1.64 }],
    note: "ยีลด์สูงในกลุ่มยา แต่มีความเสี่ยงสิทธิบัตร ต้องติดตาม" },
  { sym: "SCHD", name: "Schwab US Dividend ETF", sector: "ETF หุ้นปันผล", type: "มั่นคง", price: 27, divYr: 1.05, streak: 13,
    xd: [3, 6, 9, 12], freq: "รายไตรมาส", pay2025: [{ round: "ทุกไตรมาส", xd: "~ปลาย มี.ค./มิ.ย./ก.ย./ธ.ค.", pay: "~ต้นเดือนถัดไป", amt: 0.26 }],
    note: "กระจายหุ้นปันผลคุณภาพ ~100 ตัวในกองเดียว ลดความเสี่ยงรายบริษัท" },
  { sym: "MSFT", name: "Microsoft", sector: "เทคโนโลยี", type: "เติบโตสูง", price: 500, divYr: 3.32, streak: 22,
    xd: [2, 5, 8, 11], freq: "รายไตรมาส", pay2025: [{ round: "ทุกไตรมาส", xd: "~กลาง ก.พ./พ.ค./ส.ค./พ.ย.", pay: "~เดือนถัดไป", amt: 0.83 }],
    note: "ยีลด์ต่ำแต่ปันผล 'โต' เร็ว ธุรกิจ Cloud+AI ผูกขาดกึ่งหนึ่ง" },
  { sym: "AVGO", name: "Broadcom", sector: "เซมิคอนดักเตอร์/AI", type: "เติบโตสูง", price: 330, divYr: 2.44, streak: 15,
    xd: [3, 6, 9, 12], freq: "รายไตรมาส", pay2025: [{ round: "ทุกไตรมาส", xd: "~ปลาย มี.ค./มิ.ย./ก.ย./ธ.ค.", pay: "~สิ้นเดือนเดียวกัน", amt: 0.61 }],
    note: "เพิ่มปันผลแรงทุกปี รับกระแสชิป AI — ราคาผันผวนสูงกว่ากลุ่มมั่นคง" },
  { sym: "V", name: "Visa", sector: "การชำระเงิน", type: "เติบโตสูง", price: 340, divYr: 2.36, streak: 17,
    xd: [2, 5, 8, 11], freq: "รายไตรมาส", pay2025: [{ round: "ทุกไตรมาส", xd: "~ต้น ก.พ./พ.ค./ส.ค./พ.ย.", pay: "~ต้นเดือนถัดไป", amt: 0.59 }],
    note: "เครือข่ายชำระเงินระดับโลก อัตรากำไรสูง ปันผลโตปีละ ~15%" },
  { sym: "AAPL", name: "Apple", sector: "เทคโนโลยี", type: "เติบโตสูง", price: 270, divYr: 1.04, streak: 13,
    xd: [2, 5, 8, 11], freq: "รายไตรมาส", pay2025: [{ round: "ทุกไตรมาส", xd: "~ต้น ก.พ./พ.ค./ส.ค./พ.ย.", pay: "~กลางเดือนเดียวกัน", amt: 0.26 }],
    note: "ยีลด์ต่ำมากแต่ซื้อหุ้นคืนมหาศาล รวมผลตอบแทนคืนผู้ถือหุ้นสูง" },
  { sym: "COST", name: "Costco", sector: "ค้าปลีกสมาชิก", type: "เติบโตสูง", price: 950, divYr: 5.22, streak: 21,
    xd: [2, 5, 8, 11], freq: "รายไตรมาส", pay2025: [{ round: "ทุกไตรมาส", xd: "~ต้น ก.พ./พ.ค./ส.ค./พ.ย.", pay: "~กลางเดือนเดียวกัน", amt: 1.3 }],
    note: "รายได้สมาชิกสม่ำเสมอ มีประวัติจ่ายปันผลพิเศษก้อนใหญ่เป็นระยะ" },
  { sym: "NVDA", name: "NVIDIA", sector: "ชิป AI", type: "เติบโตสูง", price: 180, divYr: 0.04, streak: 3,
    xd: [3, 6, 9, 12], freq: "รายไตรมาส", pay2025: [{ round: "ทุกไตรมาส", xd: "~ต้น มี.ค./มิ.ย./ก.ย./ธ.ค.", pay: "~ปลายเดือนเดียวกัน", amt: 0.01 }],
    note: "ผู้นำชิป AI ของโลก — ปันผลเชิงสัญลักษณ์ ถือเพื่อการเติบโตล้วน ๆ" },
  { sym: "TSM", name: "Taiwan Semiconductor (ADR)", sector: "โรงงานผลิตชิป", type: "เติบโตสูง", price: 250, divYr: 2.9, streak: 4,
    xd: [3, 6, 9, 12], freq: "รายไตรมาส", pay2025: [{ round: "ทุกไตรมาส", xd: "~กลาง มี.ค./มิ.ย./ก.ย./ธ.ค.", pay: "~เดือนถัดไป", amt: 0.73 }],
    note: "โรงงานผลิตชิปใหญ่สุดของโลก ผลิตให้ NVIDIA/Apple (ADR โดนหักภาษีไต้หวัน 21%)" },
  { sym: "QCOM", name: "Qualcomm", sector: "ชิปมือถือ/รถยนต์", type: "เติบโตสูง", price: 165, divYr: 3.56, streak: 21,
    xd: [3, 6, 9, 12], freq: "รายไตรมาส", pay2025: [{ round: "ทุกไตรมาส", xd: "~ต้น มี.ค./มิ.ย./ก.ย./ธ.ค.", pay: "~ปลายเดือนเดียวกัน", amt: 0.89 }],
    note: "ยีลด์ ~2% สูงสุดในกลุ่มชิปใหญ่ เพิ่มปันผลต่อเนื่อง 20+ ปี" },
  { sym: "QQQI", name: "NEOS Nasdaq-100 High Income ETF", sector: "ETF ออปชันรายได้สูง", type: "ยีลด์สูง", price: 55.4, divYr: 7.89, streak: 1,
    xd: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], freq: "รายเดือน", pay2025: [{ round: "ทุกเดือน", xd: "~วันที่ 22–23 ของเดือน", pay: "~วันทำการถัดไป", amt: 0.66 }],
    note: "ยีลด์ ~13.8% จ่ายรายเดือน ถือหุ้น Nasdaq-100 แล้วขาย Call Option เก็บพรีเมียมมาจ่าย — แลกกับ upside ที่จำกัดในตลาดขาขึ้นแรง เหมาะช่วง 'หลังเกษียณ' ที่ต้องการเงินสดรายเดือน" },
];

const NON_PAYERS = [
  { sym: "THAI", name: "การบินไทย", reason: "งดจ่ายต่อเนื่องหลายปีช่วงขาดทุนสะสมและแผนฟื้นฟูกิจการ", status: "งดจ่าย" },
  { sym: "EA", name: "พลังงานบริสุทธิ์", reason: "งดจ่ายตั้งแต่ปี 2024 จากปัญหาสภาพคล่อง ภาระหนี้ และคดีความผู้บริหาร", status: "งดจ่าย" },
  { sym: "JAS", name: "จัสมิน อินเตอร์เนชั่นแนล", reason: "หลังขายธุรกิจบรอดแบนด์ ผลประกอบการขาดทุน งดจ่ายปันผลปกติ", status: "งดจ่าย" },
  { sym: "DELTA", name: "เดลต้า อีเลคโทรนิคส์", reason: "ยังจ่ายอยู่แต่ยีลด์ต่ำกว่า 1% — เป็นหุ้นเติบโต ไม่ใช่หุ้นปันผล", status: "ยีลด์ต่ำมาก" },
  { sym: "TSLA / AMZN", name: "Tesla / Amazon (สหรัฐฯ)", reason: "นโยบายไม่จ่ายปันผล เก็บกำไรไว้ลงทุนขยายธุรกิจทั้งหมด", status: "ไม่จ่าย" },
];

const fmt = (n, d = 2) => n.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d });

function thMetrics(s) {
  const vals = YEARS.map((y) => s.dps[y] ?? 0);
  const paidYears = vals.filter((v) => v > 0).length;
  const latest = s.dps[2025] ?? 0;
  const yieldPct = (latest / s.price) * 100;
  const growing = vals.slice(5).reduce((a, b) => a + b, 0) >= vals.slice(0, 5).reduce((a, b) => a + b, 0);
  const score = Math.round(Math.min(yieldPct / 8, 1) * 40 + (paidYears / 10) * 40 + (growing ? 20 : 8));
  return { paidYears, latest, yieldPct, growing, score };
}
function scoreLabel(sc) {
  if (sc >= 80) return { t: "แกนพอร์ตเกษียณ", c: "#3D6FB4", bg: "#E3EEFA" };
  if (sc >= 65) return { t: "สะสมได้", c: "#A85B7E", bg: "#FBE7F0" };
  return { t: "เฝ้าระวัง", c: "#9A6A3F", bg: "#F8EEE2" };
}

function XdStrip({ xd, accent = "#E794B6" }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {MONTHS_TH.map((m, i) => {
        const on = xd.includes(i + 1);
        return (
          <div key={m} title={m} style={{
            width: 13, height: 17, borderRadius: 3, background: on ? accent : "#EDF1F6",
            fontSize: 7, color: on ? "#fff" : "#B9C3CF", fontWeight: 700,
            display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 1,
          }}>{on ? m.replace(".", "").slice(0, 2) : ""}</div>
        );
      })}
    </div>
  );
}

/* ดึงราคาสดจาก serverless function ของเราเอง */
async function fetchQuotes(symbols) {
  const res = await fetch("/api/quotes?symbols=" + encodeURIComponent(symbols.join(",")));
  if (!res.ok) throw new Error("เซิร์ฟเวอร์ตอบ " + res.status);
  return res.json();
}

export default function App() {
  const [tab, setTab] = useState("th");
  const [selected, setSelected] = useState(null);
  const [sortKey, setSortKey] = useState("score");
  const [usFilter, setUsFilter] = useState("ทั้งหมด");
  const [thPrices, setThPrices] = useState({});
  const [usPrices, setUsPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [err, setErr] = useState("");
  const [auto, setAuto] = useState(true);

  const refreshAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setErr("");
    try {
      const thSyms = TH_STOCKS.map((s) => s.sym + ".BK");
      const usSyms = US_STOCKS.map((s) => s.sym);
      const [thQ, usQ] = await Promise.all([fetchQuotes(thSyms), fetchQuotes(usSyms)]);
      const th = {};
      Object.entries(thQ).forEach(([k, v]) => { th[k.replace(".BK", "")] = v; });
      setThPrices((o) => ({ ...o, ...th }));
      setUsPrices((o) => ({ ...o, ...usQ }));
      setUpdatedAt(new Date());
    } catch (e) {
      if (!silent) setErr("อัปเดตไม่สำเร็จ: " + e.message + " — จะลองใหม่อัตโนมัติในรอบถัดไป");
    } finally { setLoading(false); }
  }, []);

  // โหลดครั้งแรก + อัปเดตอัตโนมัติทุก 60 วินาที
  useEffect(() => {
    refreshAll();
    const id = setInterval(() => { if (auto) refreshAll(true); }, 60000);
    return () => clearInterval(id);
  }, [auto, refreshAll]);

  const thRows = useMemo(() => {
    const list = TH_STOCKS.map((s) => {
      const price = thPrices[s.sym] > 0 ? thPrices[s.sym] : s.price;
      return { ...s, price, live: thPrices[s.sym] > 0, m: thMetrics({ ...s, price }) };
    });
    list.sort((a, b) => sortKey === "yield" ? b.m.yieldPct - a.m.yieldPct : sortKey === "dps" ? b.m.latest - a.m.latest : b.m.score - a.m.score);
    return list;
  }, [thPrices, sortKey]);

  const usRows = useMemo(() =>
    US_STOCKS.filter((s) => usFilter === "ทั้งหมด" || s.type === usFilter)
      .map((s) => {
        const price = usPrices[s.sym] > 0 ? usPrices[s.sym] : s.price;
        return { ...s, price, live: usPrices[s.sym] > 0, yieldPct: (s.divYr / price) * 100 };
      }).sort((a, b) => b.yieldPct - a.yieldPct),
  [usPrices, usFilter]);

  const sel = selected && thRows.find((r) => r.sym === selected);

  const ink = "#3A4358", sub = "#7C86A0", blue = "#3D6FB4";
  const card = { background: "#FFFFFF", border: "1px solid #E4E9F2", borderRadius: 14, boxShadow: "0 1px 3px rgba(90,110,160,.06)" };
  const num = { fontVariantNumeric: "tabular-nums" };

  const PaySchedule = ({ pay2025, sym, market, ccy }) => {
    const total = pay2025.reduce((a, r) => a + r.amt, 0);
    const link = market === "TH"
      ? `https://www.set.or.th/th/market/product/stock/quote/${sym}/rights-benefits`
      : `https://dividendhistory.org/payout/${sym}/`;
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: ink }}>
          รอบจ่ายปีล่าสุด — รวม {ccy}{fmt(total)} /หุ้น
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginTop: 4 }}>
          <thead><tr style={{ color: sub, textAlign: "left" }}>
            <th style={{ padding: "4px 8px", fontWeight: 600 }}>รอบ</th>
            <th style={{ padding: "4px 8px", fontWeight: 600 }}>XD (ซื้อก่อนวันนี้)</th>
            <th style={{ padding: "4px 8px", fontWeight: 600 }}>วันจ่ายเงิน</th>
            <th style={{ padding: "4px 8px", fontWeight: 600, textAlign: "right" }}>{ccy}/หุ้น</th>
          </tr></thead>
          <tbody>{pay2025.map((r) => (
            <tr key={r.round} style={{ borderTop: "1px solid #EDF1F6" }}>
              <td style={{ padding: "5px 8px", fontWeight: 600, color: ink }}>{r.round}</td>
              <td style={{ padding: "5px 8px", color: "#B4638A", fontWeight: 600 }}>{r.xd}</td>
              <td style={{ padding: "5px 8px", color: blue, fontWeight: 600 }}>{r.pay}</td>
              <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, ...num }}>{fmt(r.amt)}</td>
            </tr>
          ))}</tbody>
        </table>
        <a href={link} target="_blank" rel="noreferrer" style={{
          display: "inline-block", marginTop: 8, padding: "6px 14px", borderRadius: 999, fontSize: 12,
          fontWeight: 700, border: "1px solid #C9D6EA", background: "#fff", color: blue, textDecoration: "none",
        }}>🔎 เปิดวัน XD จริงล่าสุด ({market === "TH" ? "set.or.th" : "dividendhistory.org"})</a>
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F4F7FB", color: ink, fontFamily: "'IBM Plex Sans Thai','Noto Sans Thai',system-ui,sans-serif" }}>
      <style>{`
        button{font-family:inherit;cursor:pointer}
        tr.row:hover{background:#F7FAFD}
        @media (max-width:720px){.hide-sm{display:none}}
      `}</style>

      <header style={{ background: "linear-gradient(105deg,#BAD4F2 0%,#D8CBEE 55%,#F6C9DC 100%)", padding: "30px 16px 24px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ fontSize: 11.5, letterSpacing: 3, color: "#5B6E96", fontWeight: 700 }}>DIVIDEND LEDGER · SELF-HOSTED</div>
          <h1 style={{ margin: "6px 0 4px", fontSize: 25, fontWeight: 700, color: "#324062" }}>สมุดปันผล — หุ้นไทย & ต่างประเทศ</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "#4E5F85", maxWidth: 660 }}>
            ราคาสดจาก Yahoo Finance · อัปเดตอัตโนมัติทุก 60 วินาที · เปิดได้ทุกที่จาก URL ของคุณเอง
          </p>
          <div style={{ marginTop: 8, fontSize: 12, color: "#5B6E96", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>{loading ? "กำลังดึงราคาล่าสุด…" : updatedAt ? `อัปเดตล่าสุด: ${updatedAt.toLocaleTimeString("th-TH")} น.` : "กำลังโหลด…"}</span>
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              อัปเดตอัตโนมัติ
            </label>
            <button onClick={() => refreshAll()} disabled={loading} style={{
              padding: "5px 14px", borderRadius: 999, border: "none", fontWeight: 700, fontSize: 12,
              background: "rgba(255,255,255,.7)", color: "#3D6FB4",
            }}>รีเฟรชตอนนี้</button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 16px 64px" }}>
        <div style={{ ...card, margin: "16px 0", padding: "12px 16px", background: "#FDF3F8", border: "1px solid #F2D3E2" }}>
          <span style={{ fontWeight: 700, color: "#B4638A" }}>วางแผนรับปันผล:</span>{" "}
          <span style={{ fontSize: 13, color: "#6D5568" }}>
            ต้องมีหุ้นในพอร์ต <b>ภายในวันทำการก่อนวันขึ้น XD</b> — ซื้อวัน XD หรือหลังนั้นไม่ได้รับรอบนั้น
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {[["th", "🇹🇭 หุ้นไทย"], ["us", "🌎 หุ้นต่างประเทศ"], ["fx", "💱 Forex & ทอง"], ["nopay", "งด/ไม่จ่ายปันผล"]].map(([k, t]) => (
            <button key={k} onClick={() => { setTab(k); setSelected(null); }} style={{
              padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 700,
              border: "1px solid " + (tab === k ? blue : "#D5DDEA"),
              background: tab === k ? "linear-gradient(90deg,#8FB6E8,#F0A8C6)" : "#fff",
              color: tab === k ? "#fff" : "#5B6E96",
            }}>{t}</button>
          ))}
        </div>

        {err && <div style={{ ...card, padding: "10px 14px", marginBottom: 12, background: "#FDEEEE", border: "1px solid #F0CACA", color: "#A05252", fontSize: 13 }}>{err}</div>}

        {tab === "th" && (
          <>
            <div style={{ marginBottom: 12 }}>
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}
                style={{ padding: "9px 12px", border: "1px solid #D5DDEA", borderRadius: 10, fontSize: 13, fontFamily: "inherit", background: "#fff", color: ink }}>
                <option value="score">เรียงตามคะแนนพอร์ตเกษียณ</option>
                <option value="yield">เรียงตามยีลด์ %</option>
                <option value="dps">เรียงตามปันผล บาท/ปี</option>
              </select>
            </div>

            <div style={{ ...card, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#F0F5FB", color: "#5B6E96", textAlign: "left" }}>
                  {["หุ้น", "ราคา (฿)", "ปันผล ฿/ปี", "ยีลด์ %", "วัน XD ปีล่าสุด", "จ่ายใน 10 ปี", "เดือน XD", "ประเมิน"].map((h, i) => (
                    <th key={h} className={i === 5 || i === 6 ? "hide-sm" : ""} style={{ padding: "10px 12px", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{thRows.map((r) => {
                  const lb = scoreLabel(r.m.score);
                  return (
                    <tr key={r.sym} className="row" onClick={() => setSelected(selected === r.sym ? null : r.sym)} style={{ borderTop: "1px solid #EDF1F6", cursor: "pointer" }}>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 700, color: blue }}>{r.sym} {r.live && <span style={{ fontSize: 9, background: "#E5F4EA", color: "#3E8A5C", padding: "1px 6px", borderRadius: 999 }}>LIVE</span>}</div>
                        <div style={{ fontSize: 11.5, color: sub }}>{r.name} · {r.sector}</div>
                      </td>
                      <td style={{ padding: "10px 12px", ...num }}>{fmt(r.price)}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "#B4638A", ...num }}>{fmt(r.m.latest)}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, ...num }}>{fmt(r.m.yieldPct, 1)}%</td>
                      <td style={{ padding: "10px 12px", fontSize: 11.5, color: "#B4638A", fontWeight: 700, whiteSpace: "nowrap", lineHeight: 1.5 }}>
                        {r.pay2025.map((p) => <div key={p.round}>{p.xd.replace("~", "")} <span style={{ color: "#7C86A0", fontWeight: 500 }}>({fmt(p.amt)}฿)</span></div>)}
                      </td>
                      <td className="hide-sm" style={{ padding: "10px 12px", ...num }}>{r.m.paidYears}/10</td>
                      <td className="hide-sm" style={{ padding: "10px 12px" }}><XdStrip xd={r.xd} /></td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ background: lb.bg, color: lb.c, padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{r.m.score} · {lb.t}</span>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            <p style={{ fontSize: 11.5, color: sub, marginTop: 8 }}>แตะที่หุ้นเพื่อดูกราฟ 10 ปี + รอบจ่ายปีล่าสุด</p>

            {sel && (
              <div style={{ ...card, marginTop: 14, padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: blue }}>{sel.sym} <span style={{ fontSize: 13, color: sub, fontWeight: 500 }}>{sel.name}</span></div>
                    <div style={{ fontSize: 12.5, color: sub }}>{sel.freq} · {sel.m.growing ? "แนวโน้มปันผลเพิ่มขึ้น" : "แนวโน้มทรงตัว/ลดลง"}</div>
                  </div>
                  <XdStrip xd={sel.xd} />
                </div>
                <PaySchedule pay2025={sel.pay2025} sym={sel.sym} market="TH" ccy="฿" />
                <div style={{ height: 210, marginTop: 12 }}>
                  <ResponsiveContainer>
                    <BarChart data={YEARS.map((y) => ({ year: String(y), dps: sel.dps[y] ?? 0 }))} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="#EDF1F6" vertical={false} />
                      <XAxis dataKey="year" tick={{ fontSize: 11, fill: sub }} />
                      <YAxis tick={{ fontSize: 11, fill: sub }} />
                      <Tooltip formatter={(v) => [fmt(v) + " บาท/หุ้น", "ปันผล"]} labelFormatter={(l) => "ปี " + l} />
                      <Bar dataKey="dps" fill="#8FB6E8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p style={{ fontSize: 13, color: ink, margin: "8px 0 0", lineHeight: 1.6 }}>{sel.note}</p>
              </div>
            )}
          </>
        )}

        {tab === "us" && (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              {["ทั้งหมด", "มั่นคง", "เติบโตสูง", "ยีลด์สูง"].map((f) => (
                <button key={f} onClick={() => setUsFilter(f)} style={{
                  padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 700,
                  border: "1px solid " + (usFilter === f ? blue : "#D5DDEA"),
                  background: usFilter === f ? "#E3EEFA" : "#fff", color: usFilter === f ? blue : "#5B6E96",
                }}>{f === "มั่นคง" ? "🛡 มั่นคง" : f === "เติบโตสูง" ? "🚀 เติบโตสูง" : f === "ยีลด์สูง" ? "💰 ยีลด์สูง" : f}</button>
              ))}
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {usRows.map((r) => (
                <div key={r.sym} style={{ ...card, padding: 16, borderLeft: "4px solid " + (r.type === "เติบโตสูง" ? "#8FB6E8" : r.type === "ยีลด์สูง" ? "#DDBB55" : "#E794B6") }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: blue, fontSize: 15 }}>
                        {r.sym} {r.live && <span style={{ fontSize: 9, background: "#E5F4EA", color: "#3E8A5C", padding: "1px 6px", borderRadius: 999 }}>LIVE</span>}
                        <span style={{ fontSize: 10.5, marginLeft: 6, padding: "2px 8px", borderRadius: 999, fontWeight: 700, background: r.type === "เติบโตสูง" ? "#E3EEFA" : r.type === "ยีลด์สูง" ? "#F8F0DA" : "#FBE7F0", color: r.type === "เติบโตสูง" ? blue : r.type === "ยีลด์สูง" ? "#96762A" : "#A85B7E" }}>
                          {r.type === "เติบโตสูง" ? "🚀 เติบโตสูง" : r.type === "ยีลด์สูง" ? "💰 ยีลด์สูง" : "🛡 มั่นคง"}
                        </span>
                        <span style={{ fontWeight: 500, color: sub, fontSize: 12.5 }}> {r.name} · {r.sector}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: sub, marginTop: 2 }}>เพิ่มปันผลติดต่อกัน <b style={{ color: "#B4638A" }}>{r.streak} ปี</b> · {r.freq}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 17, fontWeight: 700, ...num }}>${fmt(r.price)}</div>
                      <div style={{ fontSize: 12.5, color: "#B4638A", fontWeight: 700, ...num }}>${fmt(r.divYr)}/ปี · ยีลด์ {fmt(r.yieldPct, 1)}%</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}><XdStrip xd={r.xd} accent="#8FB6E8" /></div>
                  <PaySchedule pay2025={r.pay2025} sym={r.sym} market="US" ccy="$" />
                  <p style={{ fontSize: 12.5, color: ink, margin: "8px 0 0", lineHeight: 1.6 }}>{r.note}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: sub, marginTop: 10, lineHeight: 1.7 }}>
              🛡 มั่นคง = จ่ายจากกำไรจริงหลายสิบปี · 🚀 เติบโตสูง = ชิป/AI/เทค ปันผลโตเร็ว เหมาะช่วงสะสม · 💰 ยีลด์สูง = ETF ขายออปชัน เงินสดรายเดือนสูงแต่ upside จำกัด เหมาะหลังเกษียณ
              — ปันผลสหรัฐฯ หักภาษี ณ ที่จ่าย 15% + ความเสี่ยงค่าเงิน USD/THB
            </p>
          </>
        )}

        {tab === "fx" && <ForexTab />}

        {tab === "nopay" && (
          <div style={{ display: "grid", gap: 10 }}>
            {NON_PAYERS.map((s) => (
              <div key={s.sym} style={{ ...card, padding: 16, borderLeft: "4px solid #E794B6" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                  <div style={{ fontWeight: 700 }}>{s.sym} <span style={{ fontWeight: 500, color: sub, fontSize: 13 }}>{s.name}</span></div>
                  <span style={{ background: "#FBE7F0", color: "#A85B7E", padding: "2px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700 }}>{s.status}</span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: ink, lineHeight: 1.6 }}>{s.reason}</p>
              </div>
            ))}
          </div>
        )}

        <div style={{ ...card, marginTop: 20, padding: 16, background: "#FBF6FA", border: "1px solid #EBD9E6" }}>
          <p style={{ fontSize: 12.5, lineHeight: 1.8, margin: 0, color: "#7A5C74" }}>
            <b>คำเตือนความเสี่ยง:</b> ข้อมูลปันผลย้อนหลังและวัน XD เป็นค่าโดยประมาณเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน
            ราคาจาก Yahoo Finance อาจดีเลย์ ~15 นาทีสำหรับตลาดไทย ห้ามใช้ส่งคำสั่งซื้อขาย
            ตรวจสอบวัน XD จริงจาก set.or.th ก่อนตัดสินใจทุกครั้ง
          </p>
        </div>
      </div>
    </div>
  );
}
