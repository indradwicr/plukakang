/* ================================================================
   plukakang — Telegram Bot (Vercel Function)
   Perintah: /start /total /cari <kata> /add /hapus <nama>
             /backup   (kirim file .json untuk restore)
   ================================================================ */

const REPO = process.env.GITHUB_REPO;            // "username/nama-repo"
const TOKEN = process.env.GITHUB_TOKEN;          // fine-grained token
const BOT = process.env.TELEGRAM_BOT_TOKEN;      // token BotFather
const CHAT_ID = String(process.env.TELEGRAM_CHAT_ID || '');

const FILE_PATH = 'data.json';
const API = 'https://api.github.com';

/* ---------- Telegram helpers ---------- */
async function tgSend(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
}

async function tgSendFile(chatId, content) {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', '💾 data.json (backup) — balas pesan ini dengan file JSON untuk mengganti data');
  const blob = new Blob([content], { type: 'application/json' });
  form.append('document', blob, 'data.json');
  await fetch(`https://api.telegram.org/bot${BOT}/sendDocument`, {
    method: 'POST',
    body: form
  });
}

/* ---------- GitHub helpers ---------- */
async function ghGetData() {
  const res = await fetch(`${API}/repos/${REPO}/contents/${FILE_PATH}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json'
    }
  });
  if (!res.ok) throw new Error('GitHub GET: ' + res.status);
  const j = await res.json();
  return { sha: j.sha, content: Buffer.from(j.content, 'base64').toString('utf8') };
}

async function ghSave(newContent, sha, message) {
  const res = await fetch(`${API}/repos/${REPO}/contents/${FILE_PATH}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(newContent, 'utf8').toString('base64'),
      sha
    })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('GitHub PUT: ' + res.status + ' ' + t.slice(0, 200));
  }
}

/* ---------- JSON text builder (format sama dengan admin.html) ---------- */
function buildJsonText(items) {
  return '[\n' + items.map(it => '  ' + JSON.stringify({
    brand: it.brand || '', sub: it.sub || '', kategori: it.kategori || '',
    nama: it.nama || '', raw: it.raw || '', konv: it.konv || ''
  })).join(',\n') + '\n]';
}

/* ---------- Perintah: /total ---------- */
function cmdTotal(items) {
  const per = {};
  items.forEach(it => { per[it.brand] = (per[it.brand] || 0) + 1; });
  const lines = Object.keys(per).sort()
    .map(b => `• ${b}: <b>${per[b]}</b>`);
  return `📊 Total: <b>${items.length}</b> item\n\n${lines.join('\n')}`;
}

/* ---------- Perintah: /cari ---------- */
function cmdCari(items, q) {
  const ql = q.toLowerCase();
  const found = items.filter(it =>
    String(it.nama || '').toLowerCase().includes(ql) ||
    String(it.raw || '').includes(q) ||
    String(it.konv || '').includes(q)
  ).slice(0, 15);
  if (!found.length) return `❌ Tidak ditemukan: "${q}"`;
  const lines = found.map(it =>
    `📦 <b>${it.nama}</b>\n   ${it.brand} · ${it.sub}${it.kategori ? ' · ' + it.kategori : ''}\n   RAW: ${it.raw || '-'} | KONV: ${it.konv || '-'}`
  );
  return `🔎 Hasil "${q}" (${found.length}):\n\n${lines.join('\n\n')}`;
}

/* ---------- Perintah: /add brand|sub|kategori|nama|raw|konv ---------- */
function cmdAdd(items, arg) {
  const p = arg.split('|').map(s => s.trim());
  if (p.length < 6) {
    return `❌ Format salah.\n\nGunakan:\n<code>/add brand|sub|kategori|nama|raw|konv</code>\n\nContoh:\n<code>/add saybread | dcf | | Salt Bread Sesame (28) | 20141111 | 20141112</code>\n\n(Kategori boleh kosong, tulis <code>| |</code>)`;
  }
  const [brand, sub, kategori, nama, raw, konv] = p;
  if (!brand || !sub || !nama) return '❌ Brand, sub, dan nama wajib diisi.';
  if (!raw && !konv) return '❌ Isi minimal salah satu PLU (raw atau konv).';

  const dup = items.find(it =>
    (raw && it.raw === raw) || (konv && it.konv === konv) ||
    (String(it.nama).toLowerCase() === nama.toLowerCase() && it.brand === brand)
  );
  if (dup) return `⚠️ Duplikat dengan: <b>${dup.nama}</b> (${dup.brand}, RAW: ${dup.raw || '-'})\n\nGunakan /cari untuk memeriksa dulu.`;

  items.push({ brand, sub, kategori, nama, raw, konv });
  return { items, msg: `✅ Ditambahkan:\n\n📦 <b>${nama}</b>\n${brand} · ${sub}${kategori ? ' · ' + kategori : ''}\nRAW: ${raw || '-'} | KONV: ${konv || '-'}\n\n⏳ Sedang disimpan…` };
}

/* ---------- Perintah: /hapus ---------- */
function cmdHapus(items, q) {
  const ql = q.toLowerCase();
  const found = items.filter(it =>
    String(it.nama || '').toLowerCase().includes(ql) ||
    String(it.raw || '').includes(q) ||
    String(it.konv || '').includes(q)
  );
  if (!found.length) return `❌ Tidak ditemukan: "${q}"`;
  if (found.length > 1) {
    return `⚠️ Ditemukan ${found.length} item yang cocok. Perjelas:\n\n` +
      found.slice(0, 10).map(it => `• ${it.nama} (${it.brand}, RAW: ${it.raw || '-'})`).join('\n');
  }
  const it = found[0];
  const idx = items.indexOf(it);
  items.splice(idx, 1);
  return { items, msg: `🗑️ Dihapus:\n\n📦 <b>${it.nama}</b>\n${it.brand} · RAW: ${it.raw || '-'}\n\n⏳ Sedang disimpan…` };
}

/* ================================================================ */
export default async function handler(req, res) {
  let update;
  try { update = await req.json(); }
  catch { return res.status(400).json({ ok: true }); }

  try {
    const msg = update.message || update.edited_message;
    if (!msg || !msg.text) {
      // Kemungkinan: file JSON dikirim sebagai reply → restore
      if (msg && msg.document && msg.reply_to_message) {
        if (String(msg.chat.id) !== CHAT_ID) return res.status(200).json({ ok: true });
        const r = await handleRestore(msg);
        return res.status(200).json({ ok: true });
      }
      return res.status(200).json({ ok: true });
    }

    const chatId = String(msg.chat.id);
    if (chatId !== CHAT_ID) {
      await tgSend(chatId, '🚫 Kamu tidak memiliki akses ke bot ini.');
      return res.status(200).json({ ok: true });
    }

    const text = (msg.text || '').trim();
    const [cmdRaw, ...rest] = text.split(/\s+/);
    const cmd = cmdRaw.toLowerCase().replace(/@.*$/, ''); // buang @username bot
    const arg = rest.join(' ').trim();

    // Ambil data terbaru dari GitHub
    const { sha, content } = await ghGetData();
    let items;
    try { items = JSON.parse(content); }
    catch { await tgSend(chatId, '❌ data.json di repo tidak valid (bukan array JSON).'); return res.status(200).json({ ok: true }); }

    let result;
    let reply;

    switch (cmd) {
      case '/start':
      case '/help':
        reply =
          `👋 <b>plukakang admin bot</b>\n\n` +
          `📊 /total — rekap jumlah item\n` +
          `🔎 /cari &lt;kata&gt; — cari item\n` +
          `➕ /add brand|sub|kategori|nama|raw|konv — tambah item\n` +
          `🗑️ /hapus &lt;kata&gt; — hapus item (perlu nama unik)\n` +
          `💾 /backup — unduh data.json ke chat ini\n` +
          `📥 <b>Restore:</b> balas (reply) pesan backup ini dengan file data.json baru\n\n` +
          `Semua perubahan otomatis di-commit &amp; app ter-update ±1 menit.`;
        await tgSend(chatId, reply);
        return res.status(200).json({ ok: true });

      case '/total':
        reply = cmdTotal(items);
        await tgSend(chatId, reply);
        return res.status(200).json({ ok: true });

      case '/cari':
        if (!arg) { await tgSend(chatId, 'Ketik: <code>/cari salt bread</code>'); return res.status(200).json({ ok: true }); }
        reply = cmdCari(items, arg);
        await tgSend(chatId, reply);
        return res.status(200).json({ ok: true });

      case '/add':
        if (!arg) { await tgSend(chatId, 'Ketik: <code>/add brand|sub|kategori|nama|raw|konv</code>'); return res.status(200).json({ ok: true }); }
        result = cmdAdd(items, arg);
        if (typeof result === 'string') { await tgSend(chatId, result); return res.status(200).json({ ok: true }); }
        items = result.items;
        await tgSend(chatId, result.msg);
        await ghSave(buildJsonText(items), sha, 'bot: add ' + items[items.length - 1].nama);
        await tgSend(chatId, '✅ Tersimpan ke GitHub! App ter-update dalam ±1 menit. 🚀');
        return res.status(200).json({ ok: true });

      case '/hapus':
        if (!arg) { await tgSend(chatId, 'Ketik: <code>/hapus nama item</code>'); return res.status(200).json({ ok: true }); }
        result = cmdHapus(items, arg);
        if (typeof result === 'string') { await tgSend(chatId, result); return res.status(200).json({ ok: true }); }
        items = result.items;
        await tgSend(chatId, result.msg);
        await ghSave(buildJsonText(items), sha, 'bot: hapus ' + arg);
        await tgSend(chatId, '✅ Tersimpan ke GitHub! App ter-update dalam ±1 menit. 🚀');
        return res.status(200).json({ ok: true });

      case '/backup':
        await tgSendFile(chatId, content);
        return res.status(200).json({ ok: true });

      default:
        await tgSend(chatId, '🤔 Perintah tidak dikenal. Ketik /help untuk daftar perintah.');
        return res.status(200).json({ ok: true });
    }
  } catch (err) {
    console.error(err);
    try { await tgSend(CHAT_ID, '❌ Error: ' + String(err.message || err).slice(0, 300)); } catch {}
    return res.status(200).json({ ok: true });
  }
}

/* ---------- Restore file (reply /backup dengan file JSON) ---------- */
async function handleRestore(msg) {
  try {
    const fileId = msg.document.file_id;
    const info = await (await fetch(`https://api.telegram.org/bot${BOT}/getFile?file_id=${fileId}`)).json();
    if (!info.ok) throw new Error('getFile gagal');
    const fileResp = await fetch(`https://api.telegram.org/file/bot${BOT}/${info.result.file_path}`);
    const text = await fileResp.text();

    let data;
    try { data = JSON.parse(text); }
    catch { await tgSend(CHAT_ID, '❌ File bukan JSON valid.'); return; }
    if (!Array.isArray(data)) { await tgSend(CHAT_ID, '❌ JSON harus berupa array of items.'); return; }

    const { sha } = await ghGetData();
    await ghSave(buildJsonText(data), sha, 'bot: restore data.json via Telegram');
    await tgSend(CHAT_ID, `✅ data.json diganti dengan file-mu (${data.length} item)!\n\n⏳ App ter-update dalam ±1 menit. 🚀`);
  } catch (err) {
    await tgSend(CHAT_ID, '❌ Restore gagal: ' + String(err.message || err).slice(0, 200));
  }
}
