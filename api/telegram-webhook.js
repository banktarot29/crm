// เลขาในแชท Telegram — ส่งข้อความหาบอทเพื่อสั่งงาน:
//   "โทรหาคุณเมย์"            → จดเป็นงานวันนี้
//   "15/7 จ่ายค่าเช่าร้าน"     → จดงานพร้อมวันครบกำหนด (วัน/เดือน หรือ วัน/เดือน/ปี)
//   "วันนี้"                   → ขอสรุปงาน + ลูกค้าที่ควรดูแลทันที
//   "รายการ"                  → ดูงานค้างทั้งหมด
// ติดตั้งครั้งเดียว: เปิดลิงก์
//   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<โดเมน>.vercel.app/api/telegram-webhook?key=<CRON_SECRET>
import { loadState, saveState, runScan, summaryText, tgPush } from './_lib.js';

const uid = () => 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayStr = () => new Date().toISOString().slice(0, 10);

function parseTask(text) {
  // รูปแบบ "15/7 ข้อความ" หรือ "15/7/69 ข้อความ" (รับ พ.ศ. 2 หลัก และ ค.ศ.)
  const m = text.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\s+(.+)$/s);
  if (!m) return { text: text.trim(), dueDate: todayStr() };
  let [, d, mo, y, body] = m;
  const now = new Date();
  let year = now.getFullYear();
  if (y) {
    y = Number(y);
    if (y > 2400) year = y - 543;          // พ.ศ. เต็ม
    else if (y > 100) year = y;            // ค.ศ. เต็ม
    else if (y > 43) year = 2500 + y - 543; // พ.ศ. 2 หลัก เช่น 69
    else year = 2000 + y;                  // ค.ศ. 2 หลัก
  }
  const due = new Date(year, Number(mo) - 1, Number(d));
  if (!y && due < new Date(now.getFullYear(), now.getMonth(), now.getDate())) due.setFullYear(year + 1);
  return { text: body.trim(), dueDate: due.toISOString().slice(0, 10) };
}

export default async function handler(req, res) {
  // กันคนนอกยิงมั่ว — ต้องมี key ตรงกับ CRON_SECRET (ฝังใน URL ตอน setWebhook)
  if ((req.query?.key || '') !== process.env.CRON_SECRET) return res.status(200).json({ ok: true });
  if (req.method !== 'POST') return res.status(200).json({ ok: true });
  try {
    const msg = req.body?.message;
    const chatId = msg?.chat?.id, text = (msg?.text || '').trim();
    if (!chatId || !text) return res.status(200).json({ ok: true });

    const state = (await loadState()) || { clients: [], sessions: [], alerts: [], tasks: [], settings: {} };
    const tk = state.settings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const myChat = String(state.settings?.telegramChatId || process.env.TELEGRAM_CHAT_ID || '');
    if (String(chatId) !== myChat) return res.status(200).json({ ok: true }); // คุยกับเจ้าของเท่านั้น
    const reply = t => tgPush(tk, chatId, t);

    const low = text.toLowerCase();
    if (low === 'วันนี้' || low === 'today' || low === '/today') {
      runScan(state); await saveState(state);
      await reply(summaryText(state));
    } else if (low === 'รายการ' || low === 'list' || low === '/list') {
      const open = (state.tasks || []).filter(x => !x.done)
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
      await reply(open.length
        ? '📋 งานค้าง ' + open.length + ' รายการ:\n' + open.slice(0, 15).map(x => '• ' + x.text + ' (' + x.dueDate + ')').join('\n')
        : '📋 ไม่มีงานค้าง เคลียร์หมดแล้วครับ');
    } else {
      const { text: body, dueDate } = parseTask(text);
      state.tasks = state.tasks || [];
      state.tasks.unshift({ id: uid(), text: body, dueDate, done: false, createdAt: todayStr(), via: 'telegram' });
      await saveState(state);
      const th = new Date(dueDate + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      await reply('✅ จดไว้แล้ว: ' + body + '\n⏰ เตือนวันที่ ' + th + '\n(พิมพ์ "วันนี้" เพื่อดูสรุป • "รายการ" เพื่อดูงานค้าง)');
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false });
  }
}
