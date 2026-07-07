// api/_lib.js — โค้ดกลางที่ทุก endpoint ใช้ร่วมกัน (ขึ้นต้น _ = ไม่เปิดเป็น route)
import { createClient } from '@supabase/supabase-js';

/* ================= SUPABASE ================= */
export function sb() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}
export async function loadState() {
  const { data, error } = await sb().from('app_state').select('data').eq('id', 'main').maybeSingle();
  if (error) throw error;
  return data?.data || null;
}
export async function saveState(d) {
  const { error } = await sb().from('app_state')
    .upsert({ id: 'main', data: d, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/* ================= AUTH ================= */
export function checkToken(req) {
  return (req.headers['x-app-token'] || '') === process.env.APP_TOKEN && !!process.env.APP_TOKEN;
}
export function checkCron(req) {
  const auth = req.headers['authorization'] || '';
  return auth === `Bearer ${process.env.CRON_SECRET}` || checkToken(req);
}

/* ================= LINE ================= */
export async function linePush(to, text) {
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({ to, messages: [{ type: 'text', text: text.slice(0, 4900) }] })
  });
  if (!r.ok) throw new Error('LINE push ' + r.status + ' ' + await r.text());
}
export async function lineReply(replyToken, text) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] })
  });
}
export async function lineProfile(userId) {
  try {
    const r = await fetch('https://api.line.me/v2/bot/profile/' + userId, {
      headers: { 'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` }
    });
    if (r.ok) return await r.json();
  } catch (e) { /* profile ดึงไม่ได้ ใช้ userId แทน */ }
  return null;
}

/* ================= ALERT ENGINE (server-side — ตรรกะเดียวกับหน้าแอป) ================= */
const ALERT_TH = {
  follow_up_due: 'ถึงกำหนด Follow-up', prediction_window_starting: 'ใกล้ช่วงเวลาที่เคยทำนาย',
  life_event_due: 'เหตุการณ์สำคัญของลูกค้า', birthday_cycle: 'ใกล้วันเกิด',
  vip_silence: 'VIP เงียบหายไปนาน', risk_pattern: 'พบ Pattern ความเสี่ยง',
  opportunity_window: 'ช่วงโอกาสที่ควรติดตาม', fengshui_followup: 'ครบรอบติดตามฮวงจุ้ย'
};
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
const addMonths = (d, m) => { const x = new Date(d + 'T00:00:00'); x.setMonth(x.getMonth() + m); return x.toISOString().slice(0, 10); };
const fmtTH = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '—';
const uid = () => 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function computeAlerts(state) {
  const t = todayStr(); const win = Number(state.settings?.scanWindow) || 14;
  const cands = []; const sessions = state.sessions || [];
  const clients = (state.clients || []).filter(c => c.status === 'active');
  const cById = Object.fromEntries((state.clients || []).map(c => [c.id, c]));

  const score = (c, type, extra = {}) => {
    let s = 0;
    if (type === 'follow_up_due' || type === 'life_event_due') s += 40;
    if (type === 'prediction_window_starting' || type === 'opportunity_window') s += 30;
    if (type === 'vip_silence') s += 25;
    if (type === 'risk_pattern') s += 30;
    if (type === 'fengshui_followup') s += 35;
    if (type === 'birthday_cycle') s += (extra.birthdayDays <= 7 ? 20 : 10);
    if (c.clientLevel === 'vip') s += 20;
    if (sessions.some(x => x.clientId === c.id && x.riskLevel === 'high')) s += 20;
    if (c.lastSessionDate && daysBetween(c.lastSessionDate, t) > 90) s += 15;
    if (c.businessContext) s += 10;
    return Math.min(100, s);
  };
  const mk = (c, type, reason, action, extra = {}) => ({
    key: type + ':' + c.id + (extra.sessionId ? ':' + extra.sessionId : '') + (extra.checkpoint ? ':' + extra.checkpoint : ''),
    type, clientId: c.id, reason, action, ...extra, score: score(c, type, extra)
  });

  for (const c of clients) {
    if (c.nextFollowUpDate && daysBetween(t, c.nextFollowUpDate) <= 0)
      cands.push(mk(c, 'follow_up_due', 'ถึงกำหนดวันนัดติดตามผล (' + fmtTH(c.nextFollowUpDate) + ')', 'ทักไปสอบถามความคืบหน้าเรื่อง ' + (c.mainConcern || 'ที่เคยปรึกษาไว้')));
    if (c.birthDate) {
      const bd = new Date(c.birthDate + 'T00:00:00'); const now = new Date(t + 'T00:00:00');
      let next = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
      if (next < now) next = new Date(now.getFullYear() + 1, bd.getMonth(), bd.getDate());
      const dd = Math.round((next - now) / 86400000);
      if (dd <= 30) cands.push(mk(c, 'birthday_cycle', 'วันเกิดของลูกค้าอีก ' + dd + ' วัน', dd <= 7 ? 'ส่งคำอวยพร + แนะนำดูดวงปีใหม่ของชีวิต' : 'เตรียมข้อความอวยพร และชวนอัปเดตดวงรอบปีเกิด', { birthdayDays: dd }));
    }
    if (c.clientLevel === 'vip' && c.lastSessionDate) {
      const gap = daysBetween(c.lastSessionDate, t);
      if (gap >= 60) cands.push(mk(c, 'vip_silence', 'ลูกค้า VIP ไม่ได้ติดต่อมา ' + gap + ' วัน', 'ทักไปถามไถ่สารทุกข์สุกดิบ ไม่ต้องขายอะไร'));
    }
  }
  const byClient = {};
  for (const s of sessions) {
    (byClient[s.clientId] = byClient[s.clientId] || []).push(s);
    const c = cById[s.clientId]; if (!c || c.status !== 'active') continue;
    if (s.predictionStartDate) {
      const dd = daysBetween(t, s.predictionStartDate);
      if (dd >= 0 && dd <= win) cands.push(mk(c, 'prediction_window_starting', 'อีก ' + dd + ' วันจะเข้าช่วงเวลาที่เคยทำนายไว้ เรื่อง: ' + (s.mainQuestion || '—'), 'ทักไปเตือนล่วงหน้า พร้อมย้ำคำแนะนำที่ให้ไว้', { sessionId: s.id }));
      else if (dd < 0 && s.predictionEndDate && daysBetween(t, s.predictionEndDate) >= 0)
        cands.push(mk(c, 'prediction_window_starting', 'ตอนนี้อยู่ในช่วงเวลาที่เคยทำนายไว้ (ถึง ' + fmtTH(s.predictionEndDate) + ') เรื่อง: ' + (s.mainQuestion || '—'), 'ติดตามสถานการณ์ใกล้ชิด', { sessionId: s.id }));
    }
    if (s.followUpNeeded && s.followUpDate && daysBetween(t, s.followUpDate) <= 0)
      cands.push(mk(c, 'life_event_due', 'ถึงกำหนดติดตามเหตุการณ์จาก session วันที่ ' + fmtTH(s.sessionDate) + ': ' + (s.mainQuestion || '—'), 'สอบถามผลลัพธ์ตาม Action Plan ที่วางไว้', { sessionId: s.id }));
    if (s.opportunityLevel === 'high' && s.predictionStartDate) {
      const dd = daysBetween(t, s.predictionStartDate);
      if (dd >= 0 && dd <= win) cands.push(mk(c, 'opportunity_window', 'มีช่วงโอกาสสำคัญกำลังจะมาถึงใน ' + dd + ' วัน', 'ส่งข้อความชวนเตรียมตัวรับจังหวะดี', { sessionId: s.id }));
    }
    if (s.sessionType === 'fengshui' && s.fengshui && s.sessionDate) {
      for (const m of (s.fengshui.checkpoints || [])) {
        if (s.fengshui.done && s.fengshui.done[m]) continue;
        const due = addMonths(s.sessionDate, m); const dd = daysBetween(t, due);
        if (dd <= 7) {
          const when = dd < 0 ? '(เลยกำหนดมา ' + (-dd) + ' วัน)' : dd === 0 ? '(วันนี้)' : '(อีก ' + dd + ' วัน)';
          const goals = (s.fengshui.goals || []).join(', ') || 'ผลโดยรวม';
          cands.push(mk(c, 'fengshui_followup', 'ครบ ' + m + ' เดือนหลังจัดฮวงจุ้ย' + (s.fengshui.place ? ' ' + s.fengshui.place : '') + ' ' + when, 'สอบถามความเปลี่ยนแปลงด้าน' + goals, { sessionId: s.id, checkpoint: m }));
        }
      }
    }
  }
  for (const [cid, list] of Object.entries(byClient)) {
    const c = cById[cid]; if (!c || c.status !== 'active') continue;
    const highRisk = list.filter(s => s.riskLevel === 'high').length;
    const qs = list.map(s => (s.mainQuestion || '').trim().toLowerCase()).filter(Boolean);
    const repeated = qs.length >= 2 && new Set(qs).size < qs.length;
    if (highRisk >= 1 && (highRisk >= 2 || repeated))
      cands.push(mk(c, 'risk_pattern', repeated ? 'ลูกค้าถามเรื่องเดิมซ้ำหลายครั้ง และมีระดับความเสี่ยงสูง' : 'มี session ระดับความเสี่ยงสูงซ้ำหลายครั้ง', 'ดูแลใกล้ชิด อาจนัดคุยเชิงลึก'));
  }
  return cands;
}

export function runScan(state) {
  const cands = computeAlerts(state);
  const alerts = state.alerts || [];
  const doneKeys = new Set(alerts.filter(a => a.status === 'done').map(a => a.key));
  const existing = Object.fromEntries(alerts.map(a => [a.key, a]));
  const fresh = [];
  for (const c of cands) {
    if (doneKeys.has(c.key)) continue;
    const old = existing[c.key];
    if (old && old.status === 'snoozed' && old.snoozeUntil > todayStr()) { fresh.push({ ...old, ...c, status: 'snoozed', snoozeUntil: old.snoozeUntil }); continue; }
    fresh.push({ id: old?.id || uid(), status: 'open', createdAt: todayStr(), ...c });
  }
  const doneToday = alerts.filter(a => a.status === 'done' && a.doneAt === todayStr());
  state.alerts = [...fresh, ...doneToday];
  return fresh.filter(a => a.status === 'open');
}

export function summaryText(state) {
  const t = todayStr();
  const open = (state.alerts || []).filter(a => a.status === 'open' || (a.status === 'snoozed' && a.snoozeUntil <= t));
  open.sort((a, b) => b.score - a.score);
  const dueTasks = (state.tasks || []).filter(x => !x.done && x.dueDate && x.dueDate <= t);
  const brand = state.settings?.brand || 'BankTarot';
  let txt = '☀️ ' + brand + ' — ' + new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + '\n';
  if (dueTasks.length) {
    txt += '\n📋 งานของคุณวันนี้ (' + dueTasks.length + '):\n';
    dueTasks.slice(0, 6).forEach(x => { txt += '• ' + x.text + (x.dueDate < t ? ' (ค้างมา ' + (-daysBetween(t, x.dueDate)) + ' วัน)' : '') + '\n'; });
  }
  if (!open.length && !dueTasks.length) return '☀️ ' + brand + ' — วันนี้ไม่มีงานค้างและไม่มีลูกค้าที่ต้องติดตาม พักผ่อนได้ครับ';
  if (open.length) {
    const cById = Object.fromEntries((state.clients || []).map(c => [c.id, c]));
    const icon = s => s >= 80 ? '🔴' : s >= 50 ? '🟡' : '🟢';
    txt += '\n👥 ลูกค้าที่ควรดูแล ' + open.length + ' คน:\n';
    open.slice(0, 8).forEach(a => {
      const c = cById[a.clientId];
      txt += '\n' + icon(a.score) + ' ' + (c?.nickname || c?.fullName || '—') + ' (' + a.score + ')\n   ' + (ALERT_TH[a.type] || a.type) + ' — ' + a.reason;
    });
    if (open.length > 8) txt += '\n…และอีก ' + (open.length - 8) + ' รายการ';
  }
  txt += '\n\n' + goalLine(state);
  return txt;
}

/* ================= TELEGRAM ================= */
export async function tgPush(token, chatId, text) {
  const r = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) })
  });
  const j = await r.json();
  if (!j.ok) throw new Error('telegram: ' + (j.description || r.status));
}

/* ================= GOALS & EVENING WRAP ================= */
export function goalLine(state) {
  const mo = todayStr().slice(0, 7);
  const rev = (state.sessions || []).filter(s => (s.sessionDate || '').startsWith(mo) && s.paidStatus !== 'unpaid')
    .reduce((a, s) => a + (Number(s.fee) || 0), 0);
  const tgt = Number(state.settings?.monthlyTarget) || 100000;
  const fsC = (state.sessions || []).filter(s => (s.sessionDate || '').startsWith(mo) && s.sessionType === 'fengshui').length;
  const fsT = Number(state.settings?.fsCaseTarget) || 4;
  return '🎯 เดือนนี้: ฿' + rev.toLocaleString() + ' / ฿' + tgt.toLocaleString() +
    ' (' + Math.min(100, Math.round(rev / tgt * 100)) + '%) • ฮวงจุ้ย ' + fsC + '/' + fsT + ' เคส';
}
export function eveningText(state) {
  const t = todayStr();
  const tm = new Date(); tm.setDate(tm.getDate() + 1);
  const tomorrow = tm.toISOString().slice(0, 10);
  const openTasks = (state.tasks || []).filter(x => !x.done && x.dueDate && x.dueDate <= t);
  const tmrTasks = (state.tasks || []).filter(x => !x.done && x.dueDate === tomorrow);
  const openAlerts = (state.alerts || []).filter(a => a.status === 'open');
  let txt = '🌙 สรุปก่อนปิดวัน — ' + new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + '\n';
  if (openTasks.length) {
    txt += '\n⏳ งานยังค้าง ' + openTasks.length + ':\n' + openTasks.slice(0, 5).map(x => '• ' + x.text).join('\n') + '\n';
  }
  if (openAlerts.length) txt += '\n👥 ลูกค้าที่ยังไม่ได้ทัก: ' + openAlerts.length + ' คน (พรุ่งนี้เช้าจะเตือนอีกครั้ง)\n';
  if (tmrTasks.length) txt += '\n📅 พรุ่งนี้มีนัด/งาน ' + tmrTasks.length + ':\n' + tmrTasks.slice(0, 5).map(x => '• ' + x.text).join('\n') + '\n';
  if (!openTasks.length && !openAlerts.length && !tmrTasks.length) txt += '\nเคลียร์ครบทุกอย่างแล้ว 👏 พักผ่อนได้เต็มที่\n';
  txt += '\n' + goalLine(state);
  return txt;
}
