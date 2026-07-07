// รันอัตโนมัติทุกเช้า 08:00 น. ไทย (ตั้งใน vercel.json)
// 1) สแกน alert ทั้งระบบ  2) บันทึกลง Supabase  3) ส่งสรุปเข้า LINE ของเจ้าของระบบ
import { checkCron, loadState, saveState, runScan, summaryText, linePush, tgPush } from './_lib.js';

export default async function handler(req, res) {
  if (!checkCron(req)) return res.status(401).json({ error: 'unauthorized' });
  try {
    const state = await loadState();
    if (!state) return res.status(200).json({ ok: true, note: 'ยังไม่มีข้อมูล' });
    const open = runScan(state);
    await saveState(state);
    const summary = summaryText(state);
    let pushed = { line: false, telegram: false };
    const admin = state.settings?.lineAdminUserId;
    if (admin && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      try { await linePush(admin, summary); pushed.line = true; } catch (e) { /* token/uid ผิด */ }
    }
    const tgToken = state.settings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const tgChat = state.settings?.telegramChatId || process.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChat) {
      try { await tgPush(tgToken, tgChat, summary); pushed.telegram = true; } catch (e) { /* token/chat ผิด */ }
    }
    if (state.settings?.webhookUrl) {
      try {
        await fetch(state.settings.webhookUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'banktarot-advisor-os', date: new Date().toISOString().slice(0, 10), summary, openCount: open.length })
        });
      } catch (e) { /* webhook ล้ม ไม่กระทบระบบหลัก */ }
    }
    return res.status(200).json({ ok: true, openAlerts: open.length, pushed });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
