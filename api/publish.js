
'use strict';

const crypto = require('crypto');

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

function validate(data) {
  const errors = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['Payload data harus berupa object JSON.'];
  }

  if (data.app !== 'plukakang') {
    errors.push('Identitas data tidak valid.');
  }

  if (data.v !== 4) {
    errors.push('Versi data harus V4.');
  }

  if (!Array.isArray(data.brands) || data.brands.length === 0) {
    errors.push('Daftar brand wajib tersedia.');
  }

  const brandIds = new Set();

  if (Array.isArray(data.brands)) {
    for (const brand of data.brands) {
      if (
        !brand ||
        typeof brand.id !== 'string' ||
        !brand.id.trim() ||
        typeof brand.nama !== 'string' ||
        !brand.nama.trim()
      ) {
        errors.push('Setiap brand wajib memiliki id dan nama.');
        break;
      }

      if (brandIds.has(brand.id)) {
        errors.push(`ID brand duplikat: ${brand.id}`);
        break;
      }

      brandIds.add(brand.id);
    }
  }

  if (data.v === 4) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      errors.push('Daftar items V4 wajib tersedia dan tidak boleh kosong.');
    }
    if (Array.isArray(data.items)) {
      const itemIds = new Set();
      let invalid = 0;
      for (const item of data.items) {
        if (!item || typeof item !== 'object' ||
            typeof item.id !== 'string' || !item.id.trim() ||
            typeof item.brand !== 'string' || !brandIds.has(item.brand) ||
            typeof item.nama !== 'string' || !item.nama.trim() ||
            (!String(item.raw || '').trim() && !String(item.konv || '').trim())) {
          invalid++;
          continue;
        }
        if (itemIds.has(item.id)) invalid++;
        itemIds.add(item.id);
      }
      if (invalid) errors.push(`${invalid} item tidak valid, ID kosong/duplikat, atau brand tidak dikenal.`);
    }
  }

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
    const error = new Error(
      body.message || `GitHub API HTTP ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  return body;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, {
      error: 'Method tidak diizinkan.'
    });
  }

  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;

  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return send(res, 403, {
          error: 'Origin tidak diizinkan.'
        });
      }
    } catch (_) {
      return send(res, 403, {
        error: 'Origin tidak valid.'
      });
    }
  }

  const publishKey = process.env.PLUKAKANG_PUBLISH_KEY;
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = String(process.env.GITHUB_BRANCH || '').trim();

  if (!branch) {
    return send(res, 503, { error: 'GITHUB_BRANCH wajib diatur secara eksplisit. Publish default ke main dinonaktifkan.' });
  }
  if (branch === 'main') {
    return send(res, 403, { error: 'Publish ke branch main dikunci pada paket V4 ini. Gunakan branch development sampai produksi disetujui.' });
  }

  if (!publishKey || !token || !owner || !repo) {
    return send(res, 503, {
      error: 'Konfigurasi publikasi server belum lengkap.'
    });
  }

  if (!secureEqual(req.headers['x-admin-publish-key'], publishKey)) {
    return send(res, 401, {
      error: 'Kunci publikasi salah atau belum diatur.'
    });
  }

  const data = req.body && req.body.data;
  const errors = validate(data);

  if (errors.length) {
    return send(res, 422, {
      error: 'Validasi data gagal.',
      details: errors
    });
  }

  const relationCount = data.items.length;

  const dataText = JSON.stringify(data, null, 2) + '\n';

  if (Buffer.byteLength(dataText, 'utf8') > 5 * 1024 * 1024) {
    return send(res, 413, {
      error: 'Ukuran data melebihi batas 5 MB.'
    });
  }

  try {
    const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

    const ref = await github(
      `${base}/git/ref/heads/${encodeURIComponent(branch)}`,
      token
    );

    const parentSha = ref.object.sha;

    const parentCommit = await github(
      `${base}/git/commits/${parentSha}`,
      token
    );

    const dataHash = crypto
      .createHash('sha256')
      .update(dataText)
      .digest('hex');

    const version = {
      app: 'plukakang',
      version: dataHash.slice(0, 12),
      data_sha256: dataHash,
      item_count: relationCount,
      brand_count: data.brands.length,
      published_at: new Date().toISOString()
    };

    const [dataBlob, versionBlob] = await Promise.all([
      github(`${base}/git/blobs`, token, {
        method: 'POST',
        body: JSON.stringify({
          content: dataText,
          encoding: 'utf-8'
        })
      }),

      github(`${base}/git/blobs`, token, {
        method: 'POST',
        body: JSON.stringify({
          content: JSON.stringify(version, null, 2) + '\n',
          encoding: 'utf-8'
        })
      })
    ]);

    const tree = await github(`${base}/git/trees`, token, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: parentCommit.tree.sha,
        tree: [
          {
            path: 'data.json',
            mode: '100644',
            type: 'blob',
            sha: dataBlob.sha
          },
          {
            path: 'version.json',
            mode: '100644',
            type: 'blob',
            sha: versionBlob.sha
          }
        ]
      })
    });

    const commit = await github(`${base}/git/commits`, token, {
      method: 'POST',
      body: JSON.stringify({
        message: `Publish Plukakang data (${relationCount} items, v${data.v})`,
        tree: tree.sha,
        parents: [parentSha]
      })
    });

    await github(
      `${base}/git/refs/heads/${encodeURIComponent(branch)}`,
      token,
      {
        method: 'PATCH',
        body: JSON.stringify({
          sha: commit.sha,
          force: false
        })
      }
    );

    return send(res, 200, {
      ok: true,
      commit: commit.sha,
      version: version.version,
      item_count: version.item_count,
      brand_count: version.brand_count,
      message: 'Commit berhasil dibuat. Deployment hosting akan berjalan mengikuti integrasi repository.'
    });

  } catch (error) {
    console.error(
      'Plukakang publish failed:',
      error.message
    );

    const status =
      error.status === 409 || error.status === 422
        ? 409
        : 502;

    return send(res, status, {
      error: status === 409
        ? 'Repository berubah bersamaan. Muat ulang data live lalu coba lagi.'
        : 'Gagal menerbitkan ke GitHub. Periksa konfigurasi repository dan token server.'
    });
  }
};
