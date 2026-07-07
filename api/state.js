// GET/PUT ข้อมูลทั้งหมดของระบบ — ป้องกันด้วย APP_TOKEN
import { checkToken, loadState, saveState } from './_lib.js';

export default async function handler(req, res) {
  if (!checkToken(req)) return res.status(401).json({ error: 'unauthorized' });
  try {
    if (req.method === 'GET') {
      const data = await loadState();
      return res.status(200).json({ data });
    }
    if (req.method === 'PUT') {
      const d = req.body?.data;
      if (!d || typeof d !== 'object') return res.status(400).json({ error: 'bad data' });
      await saveState(d);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    return res.status(500).json({ error: 'server', detail: String(e.message || e) });
  }
}
