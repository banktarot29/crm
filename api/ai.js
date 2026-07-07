// AI proxy — คีย์ Anthropic อยู่ฝั่ง server ไม่หลุดไปหน้าเว็บ
import { checkToken } from './_lib.js';

export default async function handler(req, res) {
  if (!checkToken(req)) return res.status(401).json({ error: 'unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { prompt, maxTokens = 1000 } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'no prompt' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: Math.min(Number(maxTokens) || 1000, 2000),
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!r.ok) return res.status(502).json({ error: 'anthropic ' + r.status });
    const data = await r.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
