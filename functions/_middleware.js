// Cloudflare Pages Edge Guard for pos.macisla.com
// Protects both the POS UI and API on the public internet when either:
//  1) Cloudflare Zero Trust / Access is enabled (CF-Access-Authenticated-User-Email header), OR
//  2) `POS_ACCESS_KEY` secret is set in Cloudflare Pages -> Settings -> Environment Variables
//     (prompts once per device for your shop passcode, stored in a 30-day HttpOnly cookie).

const COOKIE_NAME = 'macisla_pos_auth';

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function getCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return '';
}

function unlockPage(errorMsg = '') {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Macisla POS — Shop Passcode</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#141d46}
    .card{background:#fff;padding:32px;border-radius:12px;box-shadow:0 10px 30px rgba(20,29,70,.08);width:100%;max-width:340px;text-align:center}
    h1{margin:0 0 8px;font-size:20px}
    p{margin:0 0 20px;font-size:13px;color:#64748b}
    input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #cbd5e1;border-radius:8px;font-size:15px;margin-bottom:12px}
    button{width:100%;padding:12px;border:0;border-radius:8px;background:#506fe4;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
    .err{color:#dc2626;font-size:13px;margin-bottom:12px}
  </style>
</head>
<body>
  <form class="card" method="POST" action="/__pos_unlock">
    <h1>Macisla POS</h1>
    <p>Enter shop passcode once to unlock this device.</p>
    ${errorMsg ? `<div class="err">${errorMsg}</div>` : ''}
    <input type="password" name="key" placeholder="Shop passcode" autofocus required />
    <button type="submit">Open POS</button>
  </form>
</body>
</html>`,
    {
      status: 401,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    }
  );
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const accessKey = String(env?.POS_ACCESS_KEY || '').trim();

  // If Cloudflare Zero Trust Access already authenticated this user, allow straight through.
  if (request.headers.get('cf-access-authenticated-user-email')) {
    return next();
  }

  // If no POS_ACCESS_KEY secret is configured on Cloudflare yet, allow through.
  if (!accessKey) {
    return next();
  }

  const expectedToken = await sha256Hex(`macisla-pos:${accessKey}`);
  const url = new URL(request.url);

  // Handle passcode unlock form submission
  if (url.pathname === '/__pos_unlock' && request.method.toUpperCase() === 'POST') {
    let submitted = '';
    const ct = (request.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      submitted = String(body.key || '').trim();
    } else {
      const fd = await request.formData().catch(() => null);
      submitted = String(fd?.get('key') || '').trim();
    }
    if (!timingSafeEqual(submitted, accessKey)) {
      return unlockPage('Incorrect passcode. Please try again.');
    }
    return new Response(null, {
      status: 303,
      headers: {
        location: '/dashboard.html#/sales/new',
        'set-cookie': `${COOKIE_NAME}=${expectedToken}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  const cookieToken = getCookie(request, COOKIE_NAME);
  const headerKey = request.headers.get('x-pos-access-key') || '';
  if (timingSafeEqual(cookieToken, expectedToken) || timingSafeEqual(headerKey, accessKey)) {
    return next();
  }

  const accept = (request.headers.get('accept') || '').toLowerCase();
  if (accept.includes('text/html') || url.pathname === '/' || url.pathname.endsWith('.html')) {
    return unlockPage();
  }

  return new Response(
    JSON.stringify({ type: 'error', message: 'Unauthorized: shop passcode required.' }),
    { status: 401, headers: { 'content-type': 'application/json; charset=utf-8' } }
  );
}
