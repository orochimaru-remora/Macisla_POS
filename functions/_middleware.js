/**
 * Cloudflare Pages Edge & Local Express 4-Digit PIN Security Gate for pos.macisla.com
 * - Constant-time PIN verification
 * - 24h HMAC-SHA256 signed HttpOnly cookie
 * - 5-attempt / 15-minute IP brute-force lockout
 */

const COOKIE_NAME = 'macisla_pos_session';
const SESSION_DURATION_SEC = 24 * 60 * 60;
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000;
const PIN_ATTEMPTS = new Map();

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

function getExpectedPin(env) {
  const raw = env?.BARBER_PIN ?? env?.POS_PIN;
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    return String(raw).trim();
  }
  return '';
}

function getSigningSecret(env, expectedPin) {
  const explicit = env?.SESSION_SECRET ? String(env.SESSION_SECRET).trim() : '';
  if (explicit) return `${explicit}:${expectedPin}`;
  return `macisla-pos-hmac-v1:${expectedPin}`;
}

function getPinLockoutStatus(ip) {
  if (!ip) return { locked: false, remainingAttempts: PIN_MAX_ATTEMPTS, retryAfterSeconds: 0 };
  const now = Date.now();
  const entry = PIN_ATTEMPTS.get(ip);
  if (!entry) return { locked: false, remainingAttempts: PIN_MAX_ATTEMPTS, retryAfterSeconds: 0 };
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return {
      locked: true,
      remainingAttempts: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000))
    };
  }
  if (entry.lockedUntil && now >= entry.lockedUntil) {
    PIN_ATTEMPTS.delete(ip);
    return { locked: false, remainingAttempts: PIN_MAX_ATTEMPTS, retryAfterSeconds: 0 };
  }
  return {
    locked: false,
    remainingAttempts: Math.max(0, PIN_MAX_ATTEMPTS - (entry.count || 0)),
    retryAfterSeconds: 0
  };
}

function recordPinFailure(ip) {
  const key = ip || 'unknown';
  const now = Date.now();
  const curr = PIN_ATTEMPTS.get(key);
  const count = (curr && (!curr.lockedUntil || now >= curr.lockedUntil) ? curr.count : 0) + 1;
  if (count >= PIN_MAX_ATTEMPTS) {
    const lockedUntil = now + PIN_LOCKOUT_MS;
    PIN_ATTEMPTS.set(key, { count, lockedUntil });
    return { locked: true, remainingAttempts: 0, retryAfterSeconds: Math.ceil(PIN_LOCKOUT_MS / 1000) };
  }
  PIN_ATTEMPTS.set(key, { count, lockedUntil: 0 });
  return { locked: false, remainingAttempts: PIN_MAX_ATTEMPTS - count, retryAfterSeconds: 0 };
}

function clearPinFailures(ip) {
  if (ip) PIN_ATTEMPTS.delete(ip);
}

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function createSessionToken(signingSecret) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DURATION_SEC;
  const payload = `pos_v1.${exp}`;
  const sig = await hmacSha256Hex(signingSecret, payload);
  return `${payload}.${sig}`;
}

async function verifySessionToken(token, signingSecret) {
  if (!token || typeof token !== 'string' || !signingSecret) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [ver, expStr, providedSig] = parts;
  if (ver !== 'pos_v1') return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const expectedSig = await hmacSha256Hex(signingSecret, `${ver}.${expStr}`);
  if (providedSig.length !== expectedSig.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    diff |= providedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  return diff === 0;
}

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return '';
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return '';
}

function renderPinGateHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Macisla POS · Terminal Lock (pos.macisla.com)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0b0f17;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
    }
    .pin-card {
      width: 100%;
      max-width: 360px;
      background: #131b2e;
      border: 1px solid #23304d;
      border-radius: 16px;
      padding: 1.75rem 1.5rem;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.14);
      color: #34d399;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    h1 { font-size: 1.25rem; font-weight: 800; margin-bottom: 4px; }
    p.sub { font-size: 0.78rem; color: #94a3b8; margin-bottom: 1.25rem; }
    .dots {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-bottom: 1.1rem;
    }
    .dot {
      width: 15px;
      height: 15px;
      border-radius: 50%;
      border: 2px solid #475569;
      transition: all 0.15s ease;
    }
    .dot.filled {
      background: #10b981;
      border-color: #10b981;
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
    }
    .msg {
      min-height: 20px;
      font-size: 0.78rem;
      color: #f87171;
      margin-bottom: 0.75rem;
    }
    .pad {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .btn {
      height: 54px;
      border-radius: 12px;
      border: 1px solid #263454;
      background: #1a243b;
      color: #f8fafc;
      font-size: 1.15rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.12s;
    }
    .btn:hover { background: #23304f; border-color: #10b981; }
    .btn:active { transform: scale(0.97); }
  </style>
</head>
<body>
  <main class="pin-card">
    <div class="badge">POS Register Lock · D1 Edge</div>
    <h1>MACISLA POS</h1>
    <p class="sub">Enter 4-Digit Cashier PIN to open register</p>
    <div class="dots" id="dots">
      <div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div>
    </div>
    <div class="msg" id="msg" role="alert"></div>
    <div class="pad">
      <button class="btn" type="button" onclick="tap('1')">1</button>
      <button class="btn" type="button" onclick="tap('2')">2</button>
      <button class="btn" type="button" onclick="tap('3')">3</button>
      <button class="btn" type="button" onclick="tap('4')">4</button>
      <button class="btn" type="button" onclick="tap('5')">5</button>
      <button class="btn" type="button" onclick="tap('6')">6</button>
      <button class="btn" type="button" onclick="tap('7')">7</button>
      <button class="btn" type="button" onclick="tap('8')">8</button>
      <button class="btn" type="button" onclick="tap('9')">9</button>
      <button class="btn" type="button" onclick="clearPin()">CLR</button>
      <button class="btn" type="button" onclick="tap('0')">0</button>
      <button class="btn" type="button" onclick="delPin()">⌫</button>
    </div>
  </main>
  <script>
    let pin = '';
    const dots = document.querySelectorAll('.dot');
    const msg = document.getElementById('msg');
    function render() {
      dots.forEach((d, i) => d.classList.toggle('filled', i < pin.length));
    }
    function clearPin() { pin = ''; msg.textContent = ''; render(); }
    function delPin() { pin = pin.slice(0, -1); render(); }
    async function tap(digit) {
      if (pin.length >= 4) return;
      pin += digit;
      render();
      if (pin.length === 4) {
        const code = pin;
        try {
          const r = await fetch('/api/verify-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: code })
          });
          const data = await r.json().catch(() => ({}));
          if (r.ok && data.ok) {
            window.location.reload();
            return;
          }
          msg.textContent = data.error || 'Invalid PIN';
        } catch (e) {
          msg.textContent = 'Network error';
        }
        pin = '';
        render();
      }
    }
    window.addEventListener('keydown', (e) => {
      if (/^[0-9]$/.test(e.key)) tap(e.key);
      if (e.key === 'Backspace') delPin();
      if (e.key === 'Escape') clearPin();
    });
  </script>
</body>
</html>`;
}

async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const p = (url.pathname || '/').toLowerCase();

  if (
    p.startsWith('/.env') ||
    p.includes('.env') ||
    p.startsWith('/.dev.vars') ||
    p.includes('.dev.vars') ||
    p.startsWith('/.git') ||
    p.startsWith('/.wrangler') ||
    p.endsWith('.toml') ||
    p.endsWith('.db') ||
    p.endsWith('.sqlite') ||
    p.endsWith('.sql') ||
    p.endsWith('.md')
  ) {
    return new Response('Not Found', { status: 404, headers: SECURITY_HEADERS });
  }

  const expectedPin = getExpectedPin(env);
  const signingSecret = expectedPin ? getSigningSecret(env, expectedPin) : '';
  const clientIp =
    request.headers.get('CF-Connecting-IP') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown';

  if (p === '/api/verify-pin' && request.method.toUpperCase() === 'POST') {
    if (!expectedPin) {
      return new Response(JSON.stringify({ ok: false, error: 'PIN is not configured on server (set BARBER_PIN).' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS }
      });
    }

    const lock = getPinLockoutStatus(clientIp);
    if (lock.locked) {
      return new Response(JSON.stringify({
        ok: false,
        locked: true,
        retryAfterSeconds: lock.retryAfterSeconds,
        error: `Too many failed attempts. Locked for ${Math.ceil(lock.retryAfterSeconds / 60)}m.`
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(lock.retryAfterSeconds), ...SECURITY_HEADERS }
      });
    }

    const body = await request.json().catch(() => ({}));
    const submitted = String(body.pin || '').trim();
    let match = submitted.length === expectedPin.length;
    const len = Math.max(submitted.length, expectedPin.length);
    let diff = 0;
    for (let i = 0; i < len; i++) {
      diff |= (submitted.charCodeAt(i) || 0) ^ (expectedPin.charCodeAt(i) || 0);
    }

    if (!match || diff !== 0) {
      const fail = recordPinFailure(clientIp);
      return new Response(JSON.stringify({
        ok: false,
        locked: fail.locked,
        remainingAttempts: fail.remainingAttempts,
        retryAfterSeconds: fail.retryAfterSeconds,
        error: fail.locked
          ? 'Too many failed PIN attempts. Terminal locked for 15 minutes.'
          : `Invalid PIN (${fail.remainingAttempts} attempt${fail.remainingAttempts === 1 ? '' : 's'} remaining)`
      }), {
        status: fail.locked ? 429 : 401,
        headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS }
      });
    }

    clearPinFailures(clientIp);
    const token = await createSessionToken(signingSecret);
    const isSecure = url.protocol === 'https:';
    const cookie = [
      `${COOKIE_NAME}=${token}`,
      'Path=/',
      `Max-Age=${SESSION_DURATION_SEC}`,
      'HttpOnly',
      'SameSite=Lax',
      ...(isSecure ? ['Secure'] : [])
    ].join('; ');

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
        ...SECURITY_HEADERS
      }
    });
  }

  // If BARBER_PIN is configured, enforce cookie on HTML & API requests
  if (expectedPin) {
    const token = parseCookie(request.headers.get('Cookie') || '', COOKIE_NAME);
    const valid = await verifySessionToken(token, signingSecret);
    if (!valid) {
      if (p.startsWith('/api/')) {
        return new Response(JSON.stringify({ ok: false, error: 'Unauthorized: POS PIN session required' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS }
        });
      }
      return new Response(renderPinGateHtml(), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS }
      });
    }
  }

  return next();
}

export {
  COOKIE_NAME,
  SESSION_DURATION_SEC,
  SECURITY_HEADERS,
  getExpectedPin,
  getSigningSecret,
  getPinLockoutStatus,
  recordPinFailure,
  clearPinFailures,
  createSessionToken,
  verifySessionToken,
  parseCookie,
  renderPinGateHtml,
  onRequest
};
