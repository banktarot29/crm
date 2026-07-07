// รอบ 23:30 น. — สรุปปิดวัน: งานค้าง ลูกค้าที่ยังไม่ทัก พรีวิวพรุ่งนี้ และความคืบหน้าเป้า
import { checkCron, loadState, tgPush, eveningText } from './_lib.js';

export default async function handler(req, res) {
  if (!checkCron(req)) return res.status(401).json({ error: 'unauthorized' });
  try {
    const state = await loadState();
    if (!state) return res.status(200).json({ ok: true, note: 'ยังไม่มีข้อมูล' });
    const tk = state.settings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const chat = state.settings?.telegramChatId || process.env.TELEGRAM_CHAT_ID;
    let pushed = false;
    if (tk && chat) { try { await tgPush(tk, chat, eveningText(state)); pushed = true; } catch (e) {} }
    return res.status(200).json({ ok: true, pushed });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
