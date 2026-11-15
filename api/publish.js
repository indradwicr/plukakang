'use strict';

const crypto = require('crypto');

const DEVELOPMENT_BRANCH = 'plukakang-2.0';
const MAX_DATA_BYTES = 5 * 1024 * 1024;

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

function secureEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
}

function validateV4(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['Payload data harus berupa object JSON.'];
  if (data.app !== 'plukakang') errors.push('Identitas data tidak valid.');
  if (data.v !== 4) errors.push('Hanya database Plukakang V4 yang dapat diterbitkan melalui endpoint ini.');

  if (!Array.isArray(data.brands) || data.brands.length === 0) {
    errors.push('Daftar brand wajib tersedia dan tidak boleh kosong.');
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    errors.push('Daftar items V4 wajib tersedia dan tidak boleh kosong.');
  }
  if (errors.length) return errors;

  const brandIds = new Set();
  for (let i = 0; i < data.brands.length; i++) {
    const brand = data.brands[i];
    if (!brand || typeof brand !== 'object' || Array.isArray(brand) ||
        typeof brand.id !== 'string' || !brand.id.trim() ||
        typeof brand.nama !== 'string' || !brand.nama.trim()) {
      errors.push(`Brand pada urutan ${i + 1} wajib memiliki id dan nama.`);
      continue;
    }
    if (brandIds.has(brand.id)) errors.push(`ID brand duplikat: ${brand.id}`);
    brandIds.add(brand.id);
  }

  const itemIds = new Set();
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    const label = `Item pada urutan ${i + 1}`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${label} bukan object yang valid.`);
      continue;
    }
    if (typeof item.id !== 'string' || !item.id.trim()) {
      errors.push(`${label} tidak memiliki ID permanen.`);
    } else if (itemIds.has(item.id)) {
      errors.push(`ID item duplikat: ${item.id}`);
    } else {
      itemIds.add(item.id);
    }
    if (typeof item.brand !== 'string' || !brandIds.has(item.brand)) {
      errors.push(`${label} memakai brand yang tidak dikenal.`);
    }
    if (typeof item.nama !== 'string' || !item.nama.trim()) {
      errors.push(`${label} tidak memiliki nama.`);
    }
    if (!(String(item.raw || '').trim() || String(item.konv || '').trim())) {
      errors.push(`${label} harus memiliki RAW atau KONV.`);
    }
    for (const field of ['deskripsi', 'sub', 'kategori', 'raw', 'konv']) {
      if (item[field] !== undefined && item[field] !== null && typeof item[field] !== 'string') {
        errors.push(`${label}: field ${field} harus berupa teks.`);
      }
    }
  }

  if (itemIds.size !== data.items.length) errors.push('Semua item harus memiliki ID unik.');
  return errors;
}

async function github(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || `GitHub API HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method tidak diizinkan.' });
  }

  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return send(res, 403, { error: 'Origin tidak diizinkan.' });
    } catch (_) {
      return send(res, 403, { error: 'Origin tidak valid.' });
    }
  }

  // Environment-bound publishing:
  // Production may write ONLY to main; Preview may write ONLY to development.
  // Never infer or fall back to a branch when configuration is missing/mismatched.
  const vercelEnv = process.env.VERCEL_ENV;
  const branch = process.env.GITHUB_BRANCH;
  const expectedBranch = vercelEnv === 'production'
    ? 'main'
    : vercelEnv === 'preview'
      ? DEVELOPMENT_BRANCH
      : null;

  if (!expectedBranch || branch !== expectedBranch) {
    return send(res, 403, {
      error: 'Konfigurasi Publish tidak cocok. Production harus memakai GITHUB_BRANCH=main; Preview harus memakai GITHUB_BRANCH=plukakang-2.0.',
    });
  }

  const publishKey = process.env.PLUKAKANG_PUBLISH_KEY;
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!publishKey || !token || !owner || !repo) {
    return send(res, 503, { error: 'Konfigurasi publikasi server belum lengkap.' });
  }
  if (!secureEqual(req.headers['x-admin-publish-key'], publishKey)) {
    return send(res, 401, { error: 'Kunci publikasi salah atau belum diatur.' });
  }

  const data = req.body && req.body.data;
  const errors = validateV4(data);
  if (errors.length) return send(res, 422, { error: 'Validasi V4 gagal.', details: errors });

  const dataText = JSON.stringify(data, null, 2) + '\n';
  if (Buffer.byteLength(dataText, 'utf8') > MAX_DATA_BYTES) {
    return send(res, 413, { error: 'Ukuran data melebihi batas 5 MB.' });
  }

  try {
    const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const ref = await github(`${base}/git/ref/heads/${encodeURIComponent(branch)}`, token);
    const parentSha = ref.object.sha;
    const parentCommit = await github(`${base}/git/commits/${parentSha}`, token);
    const dataHash = crypto.createHash('sha256').update(dataText).digest('hex');

    const version = {
      app: 'plukakang',
      version: `v4-${dataHash.slice(0, 12)}`,
      data_sha256: dataHash,
      item_count: data.items.length,
      brand_count: data.brands.length,
      published_at: new Date().toISOString(),
    };

    const [dataBlob, versionBlob] = await Promise.all([
      github(`${base}/git/blobs`, token, {
        method: 'POST',
        body: JSON.stringify({ content: dataText, encoding: 'utf-8' }),
      }),
      github(`${base}/git/blobs`, token, {
        method: 'POST',
        body: JSON.stringify({ content: JSON.stringify(version, null, 2) + '\n', encoding: 'utf-8' }),
      }),
    ]);

    const tree = await github(`${base}/git/trees`, token, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: parentCommit.tree.sha,
        tree: [
          { path: 'data.json', mode: '100644', type: 'blob', sha: dataBlob.sha },
          { path: 'version.json', mode: '100644', type: 'blob', sha: versionBlob.sha },
        ],
      }),
    });

    const commit = await github(`${base}/git/commits`, token, {
      method: 'POST',
      body: JSON.stringify({
        message: `Publish Plukakang data (${data.items.length} items, v4)`,
        tree: tree.sha,
        parents: [parentSha],
      }),
    });

    await github(`${base}/git/refs/heads/${encodeURIComponent(branch)}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });

    return send(res, 200, {
      ok: true,
      branch,
      commit: commit.sha,
      version: version.version,
      item_count: version.item_count,
      brand_count: version.brand_count,
      message: `Database V4 berhasil diterbitkan ke branch ${branch}.`,
    });
  } catch (error) {
    console.error('Plukakang V4 publish failed:', error.message);
    const status = error.status === 409 || error.status === 422 ? 409 : 502;
    return send(res, status, {
      error: status === 409
        ? 'Repository berubah bersamaan. Muat ulang data Live lalu coba lagi.'
        : 'Gagal menerbitkan ke GitHub. Periksa konfigurasi repository dan token server.',
    });
  }
};

// Exported for local validation tests; not exposed by the HTTP endpoint.
module.exports.validateV4 = validateV4;
