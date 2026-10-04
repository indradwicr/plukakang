/* ================================================================
   plukakang — Telegram Bot v3.1 FINAL (Vercel Function)
   Mode tombol: /add /edit /hapus via percakapan tap-tap
   Cepat: cache data.json 60 detik + indikator typing
   Perintah pipe lama tetap jalan. Restore file via reply.
   ================================================================ */

const REPO = process.env.GITHUB_REPO;
const TOKEN = process.env.GITHUB_TOKEN;
const BOT = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = String(process.env.TELEGRAM_CHAT_ID || '');

const FILE_PATH = 'data.json';
const API = 'https://api.github.com';

/* ---------- Cache data.json (memori, TTL 60 detik) ---------- */
let _cache = { ts: 0, sha: '', content: '' };
const CACHE_TTL = 60 * 1000;

async function tgTyping(chatId) {
  try { await fetch(`https://api.telegram.org/bot${BOT}/sendChatAction`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' })
  }); } catch {}
}

/* ---------- Telegram helpers ---------- */
async function tgSend(chatId, text, keyboard) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = { inline_keyboard: keyboard };
  await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

async function tgEdit(chatId, messageId, text, keyboard) {
  try {
    const body = { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' };
    if (keyboard) body.reply_markup = { inline_keyboard: keyboard };
    const r = await fetch(`https://api.telegram.org/bot${BOT}/editMessageText`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('edit gagal');
  } catch {
    await tgSend(chatId, text, keyboard);
  }
}

async function tgAnswer(cbId) {
  try { await fetch(`https://api.telegram.org/bot${BOT}/answerCallbackQuery`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: cbId })
  }); } catch {}
}

async function tgSendFile(chatId, content) {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', '💾 data.json (backup) — balas pesan ini dengan file JSON untuk mengganti data');
  form.append('document', new Blob([content], { type: 'application/json' }), 'data.json');
  await fetch(`https://api.telegram.org/bot${BOT}/sendDocument`, { method: 'POST', body: form });
}

/* ---------- GitHub helpers (dengan cache) ---------- */
async function ghGetData(force) {
  const now = Date.now();
  if (!force && _cache.ts && (now - _cache.ts) < CACHE_TTL) {
    return { sha: _cache.sha, content: _cache.content };
  }
  const res = await fetch(`${API}/repos/${REPO}/contents/${FILE_PATH}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json' }
  });
  if (!res.ok) throw new Error('GitHub GET: ' + res.status + (res.status === 401 ? ' (token salah/expired)' : res.status === 404 ? ' (cek GITHUB_REPO)' : ''));
  const j = await res.json();
  _cache = { ts: now, sha: j.sha, content: Buffer.from(j.content, 'base64').toString('utf8') };
  return { sha: j.sha, content: _cache.content };
}

async function ghSave(newContent, sha, message) {
  const res = await fetch(`${API}/repos/${REPO}/contents/${FILE_PATH}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: Buffer.from(newContent, 'utf8').toString('base64'), sha })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('GitHub PUT: ' + res.status + ' ' + t.slice(0, 200));
  }
  try {
    const j = await res.json();
    _cache = { ts: Date.now(), sha: j.content ? j.content.sha : _cache.sha, content: newContent };
  } catch {}
}

/* ---------- Utility ---------- */
function buildJsonText(items) {
  return '[\n' + items.map(it => '  ' + JSON.stringify({
    brand: it.brand || '', sub: it.sub || '', kategori: it.kategori || '',
    nama: it.nama || '', raw: it.raw || '', konv: it.konv || ''
  })).join(',\n') + '\n]';
}

function bName(k) { return CONFIG.brandNames[k] || k; }
function sName(k) { return CONFIG.subLabels[k] || k || '(kosong)'; }
function kName(k) { return k || '(kosong)'; }
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function findIndexByItem(items, t) {
  return items.findIndex(it => it.brand === t.brand && it.nama === t.nama && (it.raw || '') === (t.raw || '') && (it.konv || '') === (t.konv || ''));
}

/* ---------- Sesi percakapan (memori, TTL 15 menit) ---------- */
const sessions = new Map();
const SESSION_TTL = 15 * 60 * 1000;
function getSession(chatId) {
  const s = sessions.get(chatId);
  if (s && Date.now() - s.ts < SESSION_TTL) return s;
  sessions.delete(chatId);
  return null;
}
function setSession(chatId, s) { s.ts = Date.now(); sessions.set(chatId, s); }
function clearSession(chatId) { sessions.delete(chatId); }

/* ---------- CONFIG brand/sub/kategori (harus sama dengan index.html) ---------- */
const CONFIG = {
  brands: ['saybread','sayburger','yummychoice','yummycoffee','pointcoffee','hambalanfc','perishable'],
  brandNames: { saybread:'🍞 Say Bread', sayburger:'🍔 Say Burger', yummychoice:'🍽️ Yummy Choice', yummycoffee:'☕ Yummy Coffee Gold', pointcoffee:'🟢 Point Coffee', hambalanfc:'📦 Hambalan FC', perishable:'🥬 Perishable' },
  subs: {
    saybread: ['dcf','sarana'],
    sayburger: ['bkl','sarana'],
    yummychoice: ['bkl','sarana'],
    yummycoffee: ['bkl','dcf','sarana'],
    pointcoffee: ['bkl','sarana'],
    hambalanfc: ['minyak','beras','gula','mineral','beverage'],
    perishable: ['buah_sayur']
  },
  subLabels: { dcf:'Frozen Dough', sarana:'Sarana', bkl:'Bahan Baku', minyak:'Minyak', beras:'Beras', gula:'Gula', mineral:'Mineral', beverage:'Beverage', buah_sayur:'Buah & Sayur' },
  kategoriMaps: {
    'yummychoice|bkl': { snack_rte:'Snack RTE', dimsum:'Dimsum', pao:'Pao', fried_chicken:'Fried Chicken', frozen_fc:'Frozen FC', sosis:'Sosis', pizza:'Pizza' },
    'yummycoffee|bkl': { jelly:'Jelly', syrup:'Syrup', powder:'Powder', other:'Other' },
    'pointcoffee|bkl': { coffee_bean:'Coffee Bean', sauce:'Sauce', topping_jelly:'Topping Jelly', syrup:'Syrup', powder:'Powder', milk_dairy:'Milk & Dairy', rtd_beverage:'RTD Beverage', tea:'Tea', sweetener:'Sweetener', topping_crunches:'Topping Crunches', rtd_coffee:'RTD Coffee' },
    'perishable|buah_sayur': { buah:'Buah', sayur:'Sayur', jus:'Jus', bo:'B/O', bp:'B/P' }
  }
};

/* ================================================================
   ALUR: /add (tombol)
   ================================================================ */
function addStart(chatId, msgId) {
  setSession(chatId, { flow: 'add', step: 'brand', brand: '', sub: '', kategori: '', nama: '', raw: '', konv: '' });
  const kb = CONFIG.brands.map(b => [{ text: bName(b), callback_data: 'ab:' + b }]);
  kb.push([{ text: '❌ Batal', callback_data: 'ax' }]);
  const text = '➕ <b>Tambah Item</b>\n\n1/6 · Pilih <b>Brand</b>:';
  if (msgId) tgEdit(chatId, msgId, text, kb); else tgSend(chatId, text, kb);
}

function addBrand(chatId, msgId, brand) {
  const s = getSession(chatId); if (!s) { tgSend(chatId, '⌛ Sesi habis. Ketik /add untuk mulai lagi.'); return; }
  s.brand = brand; s.step = 'sub';
  const kb = CONFIG.subs[brand].map(x => [{ text: sName(x), callback_data: 'as:' + x }]);
  kb.push([{ text: '❌ Batal', callback_data: 'ax' }]);
  tgEdit(chatId, msgId, `➕ <b>Tambah Item</b>\n\nBrand: <b>${bName(brand)}</b>\n\n2/6 · Pilih <b>Sub</b>:`, kb);
}

function addSub(chatId, msgId, sub) {
  const s = getSession(chatId); if (!s) { tgSend(chatId, '⌛ Sesi habis. Ketik /add untuk mulai lagi.'); return; }
  s.sub = sub;
  const map = CONFIG.kategoriMaps[s.brand + '|' + sub];
  if (map) {
    s.step = 'kategori';
    const kb = Object.keys(map).map(k => [{ text: map[k], callback_data: 'ak:' + k }]);
    kb.push([{ text: '⏭️ Lewati (tanpa kategori)', callback_data: 'ak:__skip' }]);
    kb.push([{ text: '❌ Batal', callback_data: 'ax' }]);
    tgEdit(chatId, msgId, `➕ <b>Tambah Item</b>\n\n${bName(s.brand)} · <b>${sName(sub)}</b>\n\n3/6 · Pilih <b>Kategori</b>:`, kb);
  } else {
    s.kategori = ''; s.step = 'nama';
    tgEdit(chatId, msgId, `➕ <b>Tambah Item</b>\n\n${bName(s.brand)} · ${sName(sub)}\n\n4/6 · <b>Ketik nama barang</b> (contoh: Salt Bread Sesame (28))`);
  }
}

function addKat(chatId, msgId, kat) {
  const s = getSession(chatId); if (!s) { tgSend(chatId, '⌛ Sesi habis. Ketik /add untuk mulai lagi.'); return; }
  s.kategori = kat === '__skip' ? '' : kat;
  s.step = 'nama';
  tgEdit(chatId, msgId, `➕ <b>Tambah Item</b>\n\n${bName(s.brand)} · ${sName(s.sub)} · ${kName(s.kategori)}\n\n4/6 · <b>Ketik nama barang</b> (contoh: Salt Bread Sesame (28))`);
}

function addConfirm(chatId, msgId) {
  const s = getSession(chatId); if (!s) { tgSend(chatId, '⌛ Sesi habis. Ketik /add untuk mulai lagi.'); return; }
  s.step = 'confirm';
  const text = `📋 <b>KONFIRMASI</b>\n\n📦 Nama: <b>${esc(s.nama)}</b>\n🏷️ Brand: ${bName(s.brand)}\n📁 Sub: ${sName(s.sub)}\n🏷️ Kategori: ${kName(s.kategori)}\n🔵 RAW: <code>${s.raw || '-'}</code>\n🟡 KONV: <code>${s.konv || '-'}</code>\n\nSimpan?`;
  tgEdit(chatId, msgId, text, [[{ text: '✅ SIMPAN', callback_data: 'aa:save' }], [{ text: '❌ Batal', callback_data: 'ax' }]]);
}

async function addSave(chatId, msgId) {
  const s = getSession(chatId); if (!s) { tgSend(chatId, '⌛ Sesi habis. Ketik /add untuk mulai lagi.'); return; }
  await tgEdit(chatId, msgId, '⏳ Menyimpan…');
  try {
    const { sha, content } = await ghGetData();
    const items = JSON.parse(content);
    const dup = items.find(it => (s.raw && it.raw === s.raw) || (s.konv && it.konv === s.konv) || (it.brand === s.brand && String(it.nama).toLowerCase() === s.nama.toLowerCase()));
    if (dup) {
      clearSession(chatId);
      await tgEdit(chatId, msgId, `⚠️ Duplikat dengan: <b>${esc(dup.nama)}</b> (${dup.brand}, RAW: ${dup.raw || '-'})\n\nTidak jadi disimpan. Gunakan /add lagi kalau memang beda item.`);
      return;
    }
    items.push({ brand: s.brand, sub: s.sub, kategori: s.kategori, nama: s.nama, raw: s.raw, konv: s.konv });
    await ghSave(buildJsonText(items), sha, 'bot: add ' + s.nama);
    clearSession(chatId);
    await tgEdit(chatId, msgId, `✅ <b>Tersimpan!</b>\n\n📦 ${esc(s.nama)}\n\nApp ter-update dalam ±1 menit. 🚀`);
  } catch (err) {
    await tgEdit(chatId, msgId, '❌ Gagal: ' + esc(String(err.message || err).slice(0, 200)));
  }
}

/* ================================================================
   ALUR: /hapus (cari → pilih → konfirmasi)
   ================================================================ */
async function hapusResults(chatId, q, msgId) {
  const { content } = await ghGetData();
  const items = JSON.parse(content);
  const ql = q.toLowerCase();
  const found = items.filter(it => String(it.nama || '').toLowerCase().includes(ql) || String(it.raw || '').includes(q) || String(it.konv || '').includes(q));
  if (!found.length) {
    clearSession(chatId);
    const t = `❌ Tidak ditemukan: "${esc(q)}"`;
    if (msgId) tgEdit(chatId, msgId, t); else tgSend(chatId, t);
    return;
  }
  if (found.length > 1) {
    setSession(chatId, { flow: 'hapus', step: 'select', candidates: found.slice(0, 10) });
    const kb = found.slice(0, 10).map((it, i) => [{ text: it.nama + ' (' + (it.raw || '-') + ')', callback_data: 'hs:' + i }]);
    kb.push([{ text: '❌ Batal', callback_data: 'ax' }]);
    const t = `⚠️ Ditemukan ${found.length} item. Pilih yang mau dihapus:`;
    if (msgId) tgEdit(chatId, msgId, t, kb); else tgSend(chatId, t, kb);
    return;
  }
  setSession(chatId, { flow: 'hapus', step: 'confirm', candidates: found });
  hapusConfirm(chatId, msgId);
}

function hapusConfirm(chatId, msgId) {
  const s = getSession(chatId); if (!s) { tgSend(chatId, '⌛ Sesi habis. Ketik /hapus untuk mulai lagi.'); return; }
  const it = s.candidates[0];
  tgEdit(chatId, msgId, `🗑️ <b>Hapus item ini?</b>\n\n${itemSummary(it)}`,
    [[{ text: '🗑️ Ya, hapus', callback_data: 'hd:yes' }], [{ text: '❌ Batal', callback_data: 'ax' }]]);
}

async function hapusDo(chatId, msgId, candIdx) {
  const s = getSession(chatId); if (!s) { tgSend(chatId, '⌛ Sesi habis. Ketik /hapus untuk mulai lagi.'); return; }
  const it = s.candidates[candIdx];
  await tgEdit(chatId, msgId, '⏳ Menghapus…');
  try {
    const { sha, content } = await ghGetData();
    const items = JSON.parse(content);
    const idx = findIndexByItem(items, it);
    if (idx === -1) { await tgEdit(chatId, msgId, '⚠️ Item tidak ditemukan di data terbaru (mungkin sudah diubah).'); clearSession(chatId); return; }
    items.splice(idx, 1);
    await ghSave(buildJsonText(items), sha, 'bot: hapus ' + it.nama);
    clearSession(chatId);
    await tgEdit(chatId, msgId, `🗑️ <b>Dihapus!</b>\n\n📦 ${esc(it.nama)}\n\nApp ter-update dalam ±1 menit. 🚀`);
  } catch (err) {
    await tgEdit(chatId, msgId, '❌ Gagal: ' + esc(String(err.message || err).slice(0, 200)));
  }
}

function itemSummary(it) {
  return `📦 <b>${esc(it.nama)}</b>\n${bName(it.brand)} · ${sName(it.sub)} · ${kName(it.kategori)}\nRAW: <code>${it.raw || '-'}</code> · KONV: <code>${it.konv || '-'}</code>`;
}

/* ================================================================
   ALUR: /edit (cari → pilih → ubah field → simpan)
   ================================================================ */
async function editResults(chatId, q, msgId) {
  const { content } = await ghGetData();
  const items = JSON.parse(content);
  const ql = q.toLowerCase();
  const found = items.filter(it => String(it.nama || '').toLowerCase().includes(ql) || String(it.raw || '').includes(q) || String(it.konv || '').includes(q));
  if (!found.length) {
    clearSession(chatId);
    const t = `❌ Tidak ditemukan: "${esc(q)}"`;
    if (msgId) tgEdit(chatId, msgId, t); else tgSend(chatId, t);
    return;
  }
  setSession(chatId, { flow: 'edit', step: 'select', candidates: found.slice(0, 10), target: null, changed: {}, field: null });
  const kb = found.slice(0, 10).map((it, i) => [{ text: it.nama + ' (' + (it.raw || '-') + ')', callback_data: 'eq:' + i }]);
  kb.push([{ text: '❌ Batal', callback_data: 'ax' }]);
  const t = `✏️ Ditemukan ${found.length} item. Pilih yang mau diedit:`;
  if (msgId) tgEdit(chatId, msgId, t, kb); else tgSend(chatId, t, kb);
}

function editFields(chatId, msgId) {
  const s = getSession(chatId); if (!s) { tgSend(chatId, '⌛ Sesi habis. Ketik /edit untuk mulai lagi.'); return; }
  s.step = 'fields'; s.field = null;
  const shown = Object.assign({}, s.target, s.changed);
  const kb = [
    [{ text: '🏷️ Brand', callback_data: 'ef:brand' }, { text: '📁 Sub', callback_data: 'ef:sub' }, { text: '🏷️ Kategori', callback_data: 'ef:kat' }],
    [{ text: '📝 Nama', callback_data: 'ef:nama' }, { text: '🔵 RAW', callback_data: 'ef:raw' }, { text: '🟡 KONV', callback_data: 'ef:konv' }],
    [{ text: '✅ SIMPAN', callback_data: 'esave:yes' }, { text: '❌ Batal', callback_data: 'ax' }]
  ];
  tgEdit(chatId, msgId, '✏️ <b>Edit Item</b>\n\n' + itemSummary(shown) + '\n\nPilih bagian yang mau diubah:', kb);
}

async function editDoSave(chatId, msgId) {
  const s = getSession(chatId); if (!s) { tgSend(chatId, '⌛ Sesi habis. Ketik /edit untuk mulai lagi.'); return; }
  await tgEdit(chatId, msgId, '⏳ Menyimpan…');
  try {
    const { sha, content } = await ghGetData();
    const items = JSON.parse(content);
    const idx = findIndexByItem(items, s.target);
    if (idx === -1) { await tgEdit(chatId, msgId, '⚠️ Item tidak ditemukan di data terbaru.'); clearSession(chatId); return; }
    items[idx] = Object.assign({}, items[idx], s.changed);
    await ghSave(buildJsonText(items), sha, 'bot: edit ' + s.target.nama);
    clearSession(chatId);
    await tgEdit(chatId, msgId, '✅ <b>Tersimpan!</b>\n\nApp ter-update dalam ±1 menit. 🚀');
  } catch (err) {
    await tgEdit(chatId, msgId, '❌ Gagal: ' + esc(String(err.message || err).slice(0, 200)));
  }
}

/* ================================================================
   MENU UTAMA
   ================================================================ */
function menu(chatId, msgId) {
  const kb = [
    [{ text: '➕ Tambah Item', callback_data: 'm:add' }, { text: '✏️ Edit Item', callback_data: 'm:edit' }],
    [{ text: '🗑️ Hapus Item', callback_data: 'm:hapus' }, { text: '🔎 Cari', callback_data: 'm:cari' }],
    [{ text: '📊 Total', callback_data: 'm:total' }, { text: '💾 Backup', callback_data: 'm:backup' }]
  ];
  const text = '👋 <b>plukakang admin bot</b>\n\nPilih aksi di bawah — semua lewat tombol, tanpa perlu hafal format.';
  if (msgId) tgEdit(chatId, msgId, text, kb); else tgSend(chatId, text, kb);
}

/* ================================================================
   Restore file (reply /backup dengan file JSON)
   ================================================================ */
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
    const { sha } = await ghGetData(true);
    await ghSave(buildJsonText(data), sha, 'bot: restore data.json via Telegram');
    await tgSend(CHAT_ID, `✅ data.json diganti (${data.length} item)! App ter-update ±1 menit. 🚀`);
  } catch (err) {
    await tgSend(CHAT_ID, '❌ Restore gagal: ' + String(err.message || err).slice(0, 200));
  }
}

/* ================================================================
   ROUTER UTAMA
   ================================================================ */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      status: 'plukakang bot v3.1 berjalan ✅ (tombol + cache)',
      env: {
        TELEGRAM_BOT_TOKEN: BOT ? '✅' : '❌',
        TELEGRAM_CHAT_ID: CHAT_ID ? '✅' : '❌',
        GITHUB_TOKEN: TOKEN ? '✅' : '❌',
        GITHUB_REPO: REPO ? '✅' : '❌'
      }
    });
  }

  const update = req.body || {};

  try {
    /* ---------- CALLBACK (tombol ditekan) ---------- */
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = String(cb.message.chat.id);
      const msgId = cb.message.message_id;
      const data = cb.data || '';
      await tgAnswer(cb.id);

      if (chatId !== CHAT_ID) { await tgSend(chatId, '🚫 Kamu tidak memiliki akses.'); return res.status(200).json({ ok: true }); }
      await tgTyping(chatId);

      const colonIdx = data.indexOf(':');
      const head = colonIdx === -1 ? data : data.slice(0, colonIdx);
      const tail = colonIdx === -1 ? '' : data.slice(colonIdx + 1);

      if (head === 'm') {
        if (tail === 'add') addStart(chatId, msgId);
        else if (tail === 'hapus') { setSession(chatId, { flow: 'hapus', step: 'query' }); tgEdit(chatId, msgId, '🗑️ <b>Hapus Item</b>\n\nKetik <b>nama</b> atau <b>PLU</b> yang mau dihapus:'); }
        else if (tail === 'edit') { setSession(chatId, { flow: 'edit', step: 'query' }); tgEdit(chatId, msgId, '✏️ <b>Edit Item</b>\n\nKetik <b>nama</b> atau <b>PLU</b> yang mau diedit:'); }
        else if (tail === 'cari') { setSession(chatId, { flow: 'cari', step: 'query' }); tgEdit(chatId, msgId, '🔎 Ketik yang mau dicari:'); }
        else if (tail === 'total') {
          const { content } = await ghGetData();
          const items = JSON.parse(content);
          const per = {};
          items.forEach(it => { per[it.brand] = (per[it.brand] || 0) + 1; });
          const lines = Object.keys(per).sort().map(b => `• ${b}: <b>${per[b]}</b>`);
          tgEdit(chatId, msgId, `📊 Total: <b>${items.length}</b> item\n\n${lines.join('\n')}`);
        }
        else if (tail === 'backup') {
          const { content } = await ghGetData();
          await tgSendFile(chatId, content);
          tgEdit(chatId, msgId, '💾 Backup terkirim (lihat pesan file di atas).');
        }
        return res.status(200).json({ ok: true });
      }

      if (head === 'ax') { clearSession(chatId); tgEdit(chatId, msgId, '❌ Dibatalkan. Ketik /start untuk mulai lagi.'); return res.status(200).json({ ok: true }); }

      if (head === 'ab') { addBrand(chatId, msgId, tail); return res.status(200).json({ ok: true }); }
      if (head === 'as') { addSub(chatId, msgId, tail); return res.status(200).json({ ok: true }); }
      if (head === 'ak') { addKat(chatId, msgId, tail); return res.status(200).json({ ok: true }); }
      if (head === 'aa' && tail === 'save') { await addSave(chatId, msgId); return res.status(200).json({ ok: true }); }

      if (head === 'hs') {
        const s = getSession(chatId);
        if (s && s.flow === 'hapus') { s.candidates = [s.candidates[parseInt(tail, 10)]]; s.step = 'confirm'; hapusConfirm(chatId, msgId); }
        return res.status(200).json({ ok: true });
      }
      if (head === 'hd' && tail === 'yes') { await hapusDo(chatId, msgId, 0); return res.status(200).json({ ok: true }); }

      if (head === 'eq') {
        const s = getSession(chatId);
        if (s && s.flow === 'edit') { s.target = s.candidates[parseInt(tail, 10)]; s.changed = {}; editFields(chatId, msgId); }
        return res.status(200).json({ ok: true });
      }
      if (head === 'ef') {
        const s = getSession(chatId);
        if (s && s.flow === 'edit') {
          if (tail === 'back') { s.step = 'fields'; s.field = null; editFields(chatId, msgId); return res.status(200).json({ ok: true }); }
          s.field = tail;
          if (tail === 'brand') {
            s.step = 'pick-brand';
            const kb = CONFIG.brands.map(b => [{ text: bName(b), callback_data: 'eb:' + b }]);
            kb.push([{ text: '↩️ Kembali', callback_data: 'ef:back' }]);
            tgEdit(chatId, msgId, 'Pilih <b>Brand</b> baru:', kb);
          } else if (tail === 'sub') {
            s.step = 'pick-sub';
            const kb = (CONFIG.subs[s.target.brand] || []).map(x => [{ text: sName(x), callback_data: 'eu:' + x }]);
            kb.push([{ text: '↩️ Kembali', callback_data: 'ef:back' }]);
            tgEdit(chatId, msgId, 'Pilih <b>Sub</b> baru:', kb);
          } else if (tail === 'kat') {
            s.step = 'pick-kat';
            const map = CONFIG.kategoriMaps[s.target.brand + '|' + (s.changed.sub || s.target.sub)] || {};
            const kb = Object.keys(map).map(k => [{ text: map[k], callback_data: 'ek:' + k }]);
            kb.push([{ text: '⏭️ Kosongkan', callback_data: 'ek:__skip' }, { text: '↩️ Kembali', callback_data: 'ef:back' }]);
            tgEdit(chatId, msgId, 'Pilih <b>Kategori</b> baru:', kb);
          } else {
            s.step = 'await-input';
            tgEdit(chatId, msgId, `Ketik <b>${tail === 'nama' ? 'nama barang' : 'PLU ' + tail.toUpperCase()}</b> yang baru (ketik <code>batal</code> untuk batal):`);
          }
        }
        return res.status(200).json({ ok: true });
      }
      if (head === 'eb') { const s = getSession(chatId); if (s) { s.changed.brand = tail; editFields(chatId, msgId); } return res.status(200).json({ ok: true }); }
      if (head === 'eu') { const s = getSession(chatId); if (s) { s.changed.sub = tail; editFields(chatId, msgId); } return res.status(200).json({ ok: true }); }
      if (head === 'ek') { const s = getSession(chatId); if (s) { s.changed.kategori = tail === '__skip' ? '' : tail; editFields(chatId, msgId); } return res.status(200).json({ ok: true }); }
      if (head === 'esave' && tail === 'yes') { await editDoSave(chatId, msgId); return res.status(200).json({ ok: true }); }

      return res.status(200).json({ ok: true });
    }

    /* ---------- MESSAGE (teks dari user) ---------- */
    const msg = update.message;
    if (!msg || !msg.text) {
      if (msg && msg.document && msg.reply_to_message) { await tgTyping(CHAT_ID); await handleRestore(msg); }
      return res.status(200).json({ ok: true });
    }
    const chatId = String(msg.chat.id);
    if (chatId !== CHAT_ID) { await tgSend(chatId, '🚫 Kamu tidak memiliki akses ke bot ini.'); return res.status(200).json({ ok: true }); }

    const text = (msg.text || '').trim();

    if (text.startsWith('/')) {
      const [cmdRaw, ...rest] = text.split(/\s+/);
      const cmd = cmdRaw.toLowerCase().replace(/@.*$/, '');
      const arg = rest.join(' ').trim();
      clearSession(chatId);
      await tgTyping(chatId);

      if (cmd === '/start' || cmd === '/help') { menu(chatId, null); return res.status(200).json({ ok: true }); }
      if (cmd === '/ping') { await tgSend(chatId, '🏓 Pong! Bot hidup.'); return res.status(200).json({ ok: true }); }

      if (cmd === '/add') {
        if (arg && arg.includes('|')) {
          const { sha, content } = await ghGetData();
          const items = JSON.parse(content);
          const p = arg.split('|').map(x => x.trim());
          if (p.length < 6 || !p[0] || !p[1] || !p[3] || (!p[4] && !p[5])) { await tgSend(chatId, '❌ Format salah. Gunakan /add lewat tombol: ketik /add'); return res.status(200).json({ ok: true }); }
          items.push({ brand: p[0], sub: p[1], kategori: p[2], nama: p[3], raw: p[4], konv: p[5] });
          await ghSave(buildJsonText(items), sha, 'bot: add ' + p[3]);
          await tgSend(chatId, '✅ Tersimpan! App ter-update ±1 menit. 🚀');
          return res.status(200).json({ ok: true });
        }
        addStart(chatId, null);
        return res.status(200).json({ ok: true });
      }

      if (cmd === '/hapus') {
        if (!arg) { setSession(chatId, { flow: 'hapus', step: 'query' }); await tgSend(chatId, '🗑️ Ketik <b>nama</b> atau <b>PLU</b> yang mau dihapus:'); }
        else await hapusResults(chatId, arg, null);
        return res.status(200).json({ ok: true });
      }

      if (cmd === '/edit') {
        if (!arg) { setSession(chatId, { flow: 'edit', step: 'query' }); await tgSend(chatId, '✏️ Ketik <b>nama</b> atau <b>PLU</b> yang mau diedit:'); }
        else await editResults(chatId, arg, null);
        return res.status(200).json({ ok: true });
      }

      if (cmd === '/cari') {
        if (!arg) { await tgSend(chatId, 'Ketik: <code>/cari salt bread</code>'); return res.status(200).json({ ok: true }); }
        const { content } = await ghGetData();
        const items = JSON.parse(content);
        const ql = arg.toLowerCase();
        const found = items.filter(it => String(it.nama || '').toLowerCase().includes(ql) || String(it.raw || '').includes(arg) || String(it.konv || '').includes(arg)).slice(0, 15);
        if (!found.length) { await tgSend(chatId, `❌ Tidak ditemukan: "${esc(arg)}"`); return res.status(200).json({ ok: true }); }
        const lines = found.map(it => `📦 <b>${esc(it.nama)}</b>\n   ${bName(it.brand)} · ${sName(it.sub)}\n   RAW: <code>${it.raw || '-'}</code> | KONV: <code>${it.konv || '-'}</code>`);
        await tgSend(chatId, `🔎 Hasil "${esc(arg)}" (${found.length}):\n\n${lines.join('\n\n')}`);
        return res.status(200).json({ ok: true });
      }

      if (cmd === '/total') {
        const { content } = await ghGetData();
        const items = JSON.parse(content);
        const per = {};
        items.forEach(it => { per[it.brand] = (per[it.brand] || 0) + 1; });
        const lines = Object.keys(per).sort().map(b => `• ${b}: <b>${per[b]}</b>`);
        await tgSend(chatId, `📊 Total: <b>${items.length}</b> item\n\n${lines.join('\n')}`);
        return res.status(200).json({ ok: true });
      }

      if (cmd === '/backup') {
        const { content } = await ghGetData();
        await tgSendFile(chatId, content);
        return res.status(200).json({ ok: true });
      }

      await tgSend(chatId, '🤔 Perintah tidak dikenal. Ketik /start untuk menu tombol.');
      return res.status(200).json({ ok: true });
    }

    /* ---- Teks biasa: lanjutan sesi percakapan ---- */
    await tgTyping(chatId);
    const s = getSession(chatId);
    if (!s) { menu(chatId, null); return res.status(200).json({ ok: true }); }

    if (s.flow === 'add') {
      if (s.step === 'nama') {
        s.nama = text; s.step = 'raw';
        await tgSend(chatId, `Nama: <b>${esc(text)}</b> ✅\n\n5/6 · Ketik <b>PLU RAW</b> (angka saja):`);
      } else if (s.step === 'raw') {
        if (text.toLowerCase() === 'batal') { clearSession(chatId); await tgSend(chatId, '❌ Dibatalkan.'); return res.status(200).json({ ok: true }); }
        s.raw = text.toLowerCase() === 'skip' ? '' : text.replace(/\D/g, '');
        s.step = 'konv';
        await tgSend(chatId, `RAW: <b>${s.raw || '-'}</b> ✅\n\n6/6 · Ketik <b>PLU KONV</b> (atau ketik: <code>skip</code>):`);
      } else if (s.step === 'konv') {
        if (text.toLowerCase() === 'batal') { clearSession(chatId); await tgSend(chatId, '❌ Dibatalkan.'); return res.status(200).json({ ok: true }); }
        s.konv = text.toLowerCase() === 'skip' ? '' : text.replace(/\D/g, '');
        if (!s.raw && !s.konv) { s.step = 'raw'; await tgSend(chatId, '⚠️ Minimal salah satu PLU harus diisi.\n\nKetik <b>PLU RAW</b>:'); return res.status(200).json({ ok: true }); }
        addConfirm(chatId, null);
      }
      return res.status(200).json({ ok: true });
    }

    if (s.flow === 'hapus' && s.step === 'query') {
      await hapusResults(chatId, text, null);
      return res.status(200).json({ ok: true });
    }

    if (s.flow === 'edit' && s.step === 'query') {
      await editResults(chatId, text, null);
      return res.status(200).json({ ok: true });
    }

    if (s.flow === 'edit' && s.step === 'await-input' && s.field) {
      if (text.toLowerCase() === 'batal') { s.step = 'fields'; s.field = null; editFields(chatId, null); return res.status(200).json({ ok: true }); }
      if (s.field === 'nama') s.changed.nama = text;
      else if (s.field === 'raw') s.changed.raw = text.replace(/\D/g, '');
      else if (s.field === 'konv') s.changed.konv = text.replace(/\D/g, '');
      s.step = 'fields'; s.field = null;
      editFields(chatId, null);
      return res.status(200).json({ ok: true });
    }

    if (s.flow === 'cari' && s.step === 'query') {
      const { content } = await ghGetData();
      const items = JSON.parse(content);
      const ql = text.toLowerCase();
      const found = items.filter(it => String(it.nama || '').toLowerCase().includes(ql) || String(it.raw || '').includes(text) || String(it.konv || '').includes(text)).slice(0, 15);
      clearSession(chatId);
      if (!found.length) { await tgSend(chatId, `❌ Tidak ditemukan: "${esc(text)}"`); return res.status(200).json({ ok: true }); }
      const lines = found.map(it => `📦 <b>${esc(it.nama)}</b>\n   ${bName(it.brand)} · ${sName(it.sub)}\n   RAW: <code>${it.raw || '-'}</code> | KONV: <code>${it.konv || '-'}</code>`);
      await tgSend(chatId, `🔎 Hasil (${found.length}):\n\n${lines.join('\n\n')}`);
      return res.status(200).json({ ok: true });
    }

    menu(chatId, null);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    try { await tgSend(CHAT_ID, '❌ Error: ' + String(err.message || err).slice(0, 300)); } catch {}
    return res.status(200).json({ ok: true });
  }
}
