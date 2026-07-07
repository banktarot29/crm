# HANDOFF — งานที่เหลือสำหรับ Claude Cowork / Claude Code

> เจ้าของระบบ: BankTarot (อ.แบงค์)
> เป้าหมาย: ทำให้ระบบ CRM แจ้งเตือนอัตโนมัติทุกเช้า 8 โมงผ่าน Telegram ใช้งานได้จริง 100%

## สถานะปัจจุบัน (อัปเดตล่าสุด)

| งาน | สถานะ |
|---|---|
| โค้ดทั้งระบบ (app + api + cron) | ✅ เสร็จ อยู่ในโฟลเดอร์นี้ |
| GitHub repo (banktarot29/crm) + Vercel project (banktarot_crm) | ✅ สร้างแล้ว |
| Domain | ✅ https://banktarotcrm.vercel.app |
| Telegram bot + ทดสอบส่งผ่านเบราว์เซอร์ | ✅ ผ่านแล้ว (เจ้าของมี Token ใหม่หลัง revoke + Chat ID) |
| Environment Variables บน Vercel | ⬜ **ยังว่างเปล่า — งานหลักที่ต้องทำ** |
| Supabase schema (ตาราง app_state) | ⬜ ต้องตรวจ/รัน |
| Redeploy หลังใส่ env | ⬜ |
| Import ข้อมูลจากเวอร์ชันทดลอง | ⬜ (เจ้าของมีไฟล์ Export JSON) |
| ทดสอบ /api/health และ /api/cron | ⬜ |
| LINE OA (ส่งตรงหาลูกค้า) | ⏸ พักไว้ก่อน ใช้ Telegram แทน |

## ค่าที่รู้แล้ว

- Vercel project: `banktarot_crm` (team: sinsaebank-s-projects)
- Domain: `https://banktarotcrm.vercel.app`
- SUPABASE_URL: `https://ljaghasmciemztdinjwb.supabase.co`
- GitHub: `banktarot29/crm`

## ค่าที่ต้องถามเจ้าของ (ห้ามเดา)

1. `SUPABASE_SERVICE_ROLE_KEY` — จาก supabase.com → Settings → API Keys → Secret key (`sb_secret_...`)
2. `ANTHROPIC_API_KEY` — จาก console.anthropic.com
3. Telegram Bot Token (ตัวใหม่หลัง revoke) + Chat ID — เจ้าของมีแล้ว

## ขั้นตอนที่ต้องทำ (เรียงตามลำดับ)

### 1. ตั้ง Environment Variables บน Vercel (Production)
ใช้ `vercel env add <KEY> production` หรือทำผ่าน dashboard:
- SUPABASE_URL = ค่าด้านบน
- SUPABASE_SERVICE_ROLE_KEY = ถามเจ้าของ
- APP_TOKEN = สุ่มให้ (รูปแบบ `bank-xxxx-xxxx` จำง่าย) **แล้วแจ้งเจ้าของให้จดเก็บ**
- ANTHROPIC_API_KEY = ถามเจ้าของ
- CRON_SECRET = สุ่ม string ยาว
- APP_URL = https://banktarotcrm.vercel.app

### 2. Supabase schema
รันไฟล์ `supabase/schema.sql` (ผ่าน SQL Editor บนเว็บ หรือ psql ถ้ามี connection string)
รันซ้ำได้ ไม่พัง (`create table if not exists`)

### 3. Redeploy production
`vercel --prod` หรือ Redeploy ผ่าน dashboard — env ใหม่จะทำงานหลัง deploy เท่านั้น

### 4. ตรวจระบบ
```
curl -H "x-app-token: <APP_TOKEN>" https://banktarotcrm.vercel.app/api/health
```
ต้องได้ `"ready": true, "db": "ok"` — ถ้า env ตัวไหน false หรือ db fail ให้แก้ก่อนไปต่อ

### 5. พาเจ้าของ Import ข้อมูล
- เปิด https://banktarotcrm.vercel.app → ใส่ APP_TOKEN
- Settings → Import ข้อมูล → วาง JSON จากไฟล์ Export ของเวอร์ชันทดลอง
- Settings → กล่อง Telegram: ตรวจว่ามี Token+Chat ID (ติดมากับ Import) → บันทึก → กดทดสอบส่ง (บนเว็บจริงปุ่มนี้ใช้ได้)

### 6. ทดสอบ cron จริง
```
curl -H "x-app-token: <APP_TOKEN>" https://banktarotcrm.vercel.app/api/cron
```
เกณฑ์ผ่าน: response มี `"telegram": true` และสรุปเด้งเข้า Telegram ของเจ้าของ
Cron อัตโนมัติตั้งไว้แล้วใน vercel.json (01:00 UTC = 08:00 ไทย)


### 6.5 เปิดโหมดเลขาในแชท Telegram (ครั้งเดียว)
เปิดลิงก์นี้ในเบราว์เซอร์ (แทนค่า TOKEN และ CRON_SECRET จริง):
```
https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook?url=https://banktarotcrm.vercel.app/api/telegram-webhook?key=<CRON_SECRET>
```
เห็น "Webhook was set" = สำเร็จ จากนั้นเจ้าของพิมพ์หาบอทได้เลย:
- ข้อความอะไรก็ได้ → จดเป็นงานวันนี้ | "15/7 ข้อความ" → จดพร้อมวันเตือน
- "วันนี้" → รับสรุปทันที | "รายการ" → ดูงานค้าง
หมายเหตุ: หลัง setWebhook แล้ว ปุ่ม "ค้นหา Chat ID" ในแอปจะใช้ไม่ได้อีก (ปกติ — ค่าตั้งไว้แล้ว)

### 7. รายงานปิดงาน
สรุปให้เจ้าของ: APP_TOKEN ที่ตั้ง, ลิงก์เว็บ, ยืนยัน cron ทำงาน, สิ่งที่พักไว้ (LINE OA)

## กติกา
- ห้ามพิมพ์ secret ลง log/แชทเกินจำเป็น
- ห้ามลบข้อมูลใน Supabase
- ติดปัญหาให้แก้เองก่อน ถ้าต้องการค่าจากเจ้าของค่อยถาม ถามทีละเรื่อง
- ภาษาไทย อธิบายสั้น เจ้าของไม่ใช่โปรแกรมเมอร์
