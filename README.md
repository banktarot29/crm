# BankTarot Private Advisor OS — Cloud Edition

ระบบ CRM + AI Report + แจ้งเตือนอัตโนมัติสำหรับที่ปรึกษา/หมอดู
รันบน **Vercel + Supabase + LINE Messaging API**

สิ่งที่ได้เพิ่มจากเวอร์ชันทดลอง:
- ⏰ **Cron ทุกเช้า 08:00 น.** สแกนลูกค้าทั้งระบบ แล้วส่งสรุปเข้า LINE ให้อัตโนมัติ ไม่ต้องเปิดแอป
- 🚀 **ส่งข้อความตรงถึงลูกค้า** ผ่าน LINE OA จากปุ่มเดียวในแอป
- 🔐 ข้อมูลอยู่ใน Supabase ของคุณเอง + คีย์ AI อยู่ฝั่ง server ไม่หลุด
- 📱 เปิดใช้ได้ทุกเครื่อง ข้อมูลชุดเดียวกัน

---

## ขั้นตอนติดตั้ง (ประมาณ 30–45 นาที ทำครั้งเดียว)

### 1) Supabase — คลังข้อมูล (ฟรี)
1. สมัคร/ล็อกอินที่ supabase.com → **New project**
2. เมนูซ้าย **SQL Editor** → วางเนื้อหาไฟล์ `supabase/schema.sql` → Run
3. ไปที่ **Project Settings → API** จดค่า 2 ตัว:
   - `Project URL` → ใช้เป็น `SUPABASE_URL`
   - `service_role` key → ใช้เป็น `SUPABASE_SERVICE_ROLE_KEY` (ห้ามแปะลงหน้าเว็บเด็ดขาด)

### 2) LINE Developers — ช่องทางแจ้งเตือน
> แนะนำ: สร้าง **Messaging API channel ใหม่แยกจาก OA หลัก** เพื่อใช้แจ้งเตือนตัวเอง
> (ถ้าผูกกับ OA หลักที่มีลูกค้าจริง webhook จะเข้ามาที่ระบบนี้ด้วย — ข้อดีคือระบบจะจับ userId ลูกค้าให้อัตโนมัติ ข้อควรระวังคือ auto-reply เดิมของ OA อาจต้องปิด)

1. developers.line.biz → สร้าง Provider → สร้าง channel แบบ **Messaging API**
2. แท็บ Messaging API → **Issue channel access token** → จดไว้เป็น `LINE_CHANNEL_ACCESS_TOKEN`
3. Webhook URL: จะมาตั้งหลัง deploy (ขั้นตอนที่ 4)

### 3) Vercel — ตัวรันระบบ (ฟรี)
1. อัปโหลดโฟลเดอร์นี้ขึ้น GitHub (หรือใช้ `vercel` CLI)
2. vercel.com → **Add New Project** → เลือก repo → Deploy
3. ไปที่ **Settings → Environment Variables** ใส่ค่าตาม `.env.example`:

| ตัวแปร | ค่า |
|---|---|
| `SUPABASE_URL` | จากขั้นตอน 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | จากขั้นตอน 1 |
| `APP_TOKEN` | ตั้งเอง — รหัสเข้าแอป เช่น `bank-xxxx-2569` |
| `ANTHROPIC_API_KEY` | จาก console.anthropic.com (ใช้ทำ AI report/ข้อความ) |
| `LINE_CHANNEL_ACCESS_TOKEN` | จากขั้นตอน 2 |
| `CRON_SECRET` | ตั้งเอง string ยาวๆ (Vercel ใช้ยืนยัน cron) |
| `APP_URL` | URL เว็บหลัง deploy เช่น `https://xxx.vercel.app` |

4. Redeploy 1 ครั้งหลังใส่ env ครบ

### 4) เชื่อม LINE เข้าระบบ
1. กลับไป LINE Developers → Messaging API → **Webhook URL** ใส่:
   `https://<โดเมนของคุณ>.vercel.app/api/line-webhook`
   เปิด **Use webhook** = ON
2. แอดบอทเป็นเพื่อน (สแกน QR ในหน้า channel)
3. **พิมพ์คำว่า `ADMIN` ส่งไปในแชทบอท** → บอทตอบยืนยัน = ตั้งค่าผู้รับแจ้งเตือนสำเร็จ
4. เสร็จแล้ว — ทุกเช้า 08:00 น. สรุป Today Alerts จะเด้งเข้า LINE เอง

### 5) ย้ายข้อมูลจากเวอร์ชันทดลอง
1. เปิดแอปเวอร์ชันทดลอง (ใน Claude) → Settings → **Export ข้อมูล (JSON)**
2. เปิดเว็บใหม่ `https://xxx.vercel.app` → ใส่ APP_TOKEN → Settings → **Import ข้อมูล** → วาง JSON
3. ข้อมูลลูกค้า/session/ประวัติทั้งหมดตามมาครบ


---

## ทางลัด: แจ้งเตือนผ่าน Telegram (ง่ายกว่า LINE มาก)

ไม่อยากยุ่งกับ LINE Developers? ใช้ Telegram แทนได้ ผลเหมือนกัน:

1. ใน Telegram ทัก **@BotFather** → พิมพ์ `/newbot` → ตั้งชื่อ → ได้ **Token**
2. ทักบอทตัวใหม่ของคุณ 1 ข้อความ
3. เปิดแอป → Settings → วาง Token → กด **"ค้นหา Chat ID"** → บันทึก → ทดสอบส่ง

เท่านี้ cron ตอนเช้าจะส่งสรุปเข้า Telegram อัตโนมัติ (ตั้งค่าในแอปพอ ไม่ต้องแตะ env)
ข้อแตกต่างเดียว: Telegram ใช้แจ้งเตือน "ตัวคุณ" — ส่วนการส่งข้อความ "ถึงลูกค้า" ยังต้องใช้ LINE OA เพราะลูกค้าอยู่ที่นั่น

---

## การส่งข้อความตรงถึงลูกค้า (ขั้นสูง)

LINE ไม่ยอมให้ push หาคนด้วย LINE ID ธรรมดา — ต้องใช้ **userId** ซึ่งได้เมื่อลูกค้าทักเข้ามาที่ OA/บอทตัวนี้เท่านั้น:

1. ลูกค้าทักแชทเข้ามา → ระบบจับ userId + ชื่อ เก็บให้อัตโนมัติ
2. ในแอป เปิดข้อมูลลูกค้า → แก้ไข → ช่อง "LINE userId" จะมีรายชื่อให้เลือกผูก
3. หลังผูกแล้ว ปุ่ม **"🚀 ส่งตรงถึงลูกค้า (OA)"** จะโผล่ใน modal ข้อความ — กดเดียวส่งถึงลูกค้าทันที และบันทึกลงประวัติการติดต่อให้ด้วย

## ทดสอบระบบ

- ทดสอบ cron ด้วยมือ: เปิด `https://xxx.vercel.app/api/cron` พร้อม header `x-app-token: <APP_TOKEN>` (ใช้แอปอย่าง Postman หรือกด Run ใน Vercel → Crons)
- ดู log: Vercel → Deployments → Functions

## โครงสร้าง

```
public/index.html      ← ตัวแอปทั้งหมด (ไฟล์เดียวกับเวอร์ชันทดลอง ตรวจจับ cloud เอง)
api/state.js           ← อ่าน/เขียนข้อมูล (Supabase)
api/ai.js              ← AI proxy (Claude)
api/cron.js            ← สแกน + ส่ง LINE ทุกเช้า
api/line-push.js       ← ส่งข้อความถึงลูกค้า
api/line-webhook.js    ← รับ event จาก LINE / จับ userId / คำสั่ง ADMIN
supabase/schema.sql    ← ตาราง 1 ตาราง รันครั้งเดียว
vercel.json            ← ตั้งเวลา cron (01:00 UTC = 08:00 ไทย)
```

## TODO ก่อนใช้จริงระยะยาว
- [ ] เพิ่ม verify `x-line-signature` ใน line-webhook.js (ใช้ channel secret)
- [ ] แยกตารางข้อมูล (clients/sessions/alerts) เมื่อลูกค้าเกิน ~500 คน
- [ ] เพิ่ม user หลายคน + สิทธิ์ ถ้ามีทีมงาน
