import { Controller, Get, Header } from '@nestjs/common';

/**
 * The page the reset email links to: GET /reset-password?token=...
 * It works in any browser or mail app (no app install or deep link needed) and posts the new password
 * to POST /auth/reset-password. The token is read in the browser from the URL and is never echoed into the HTML.
 */
const PAGE = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Reset your password</title>
<style>
  :root{--bg:#f4f5f2;--card:#fff;--fg:#1c2b3a;--muted:#5f6b76;--border:#d9dee3;--accent:#1c2b3a;--ok:#2f6f5e;--err:#b3382c}
  @media (prefers-color-scheme: dark){:root{--bg:#10161c;--card:#18222b;--fg:#eef2f5;--muted:#9aa7b2;--border:#2c3a46;--accent:#e8eef2}}
  body{margin:0;background:var(--bg);color:var(--fg);font-family:Arial,Helvetica,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px;box-sizing:border-box}
  main{background:var(--card);border-radius:14px;padding:28px;max-width:400px;width:100%;box-sizing:border-box}
  h1{font-size:22px;margin:0 0 6px} p{color:var(--muted);line-height:1.5;margin:0 0 18px}
  label{display:block;font-size:13px;font-weight:bold;margin:0 0 6px}
  input{width:100%;box-sizing:border-box;padding:13px;border:1px solid var(--border);border-radius:10px;font-size:16px;margin:0 0 14px;background:transparent;color:var(--fg)}
  button{width:100%;padding:14px;border:0;border-radius:10px;background:var(--accent);color:var(--bg);font-size:16px;font-weight:bold;cursor:pointer}
  button:disabled{opacity:.6;cursor:default} #msg{margin:14px 0 0;font-size:14px;min-height:20px}
  .err{color:var(--err)} .ok{color:var(--ok)}
</style></head>
<body><main>
<h1>Choose a new password</h1>
<p id="intro">Enter a new password for your account.</p>
<form id="f" novalidate>
  <label for="p1">New password (8+ characters)</label>
  <input id="p1" type="password" autocomplete="new-password" minlength="8" required>
  <label for="p2">Confirm new password</label>
  <input id="p2" type="password" autocomplete="new-password" minlength="8" required>
  <button id="b" type="submit">Update password</button>
</form>
<p id="msg" role="status"></p>
</main>
<script>
(function () {
  var token = new URLSearchParams(window.location.search).get('token') || '';
  var f = document.getElementById('f'), msg = document.getElementById('msg'), b = document.getElementById('b');
  function say(text, cls) { msg.textContent = text; msg.className = cls || ''; }
  if (!token) { f.style.display = 'none'; say('This reset link is incomplete. Please request a new one from the app.', 'err'); return; }
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var p1 = document.getElementById('p1').value, p2 = document.getElementById('p2').value;
    if (p1.length < 8) return say('Password must be at least 8 characters.', 'err');
    if (p1 !== p2) return say('The two passwords do not match.', 'err');
    b.disabled = true; say('Updating...', '');
    fetch('/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token, newPassword: p1 }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok) { f.style.display = 'none'; document.getElementById('intro').textContent = ''; say('Your password has been updated. You can now sign in to the app.', 'ok'); return; }
        var m = res.d && res.d.message; if (Array.isArray(m)) m = m.join(' ');
        say(m || 'Could not update your password. The link may have expired. Please request a new one.', 'err'); b.disabled = false;
      })
      .catch(function () { say('Could not reach the server. Check your connection and try again.', 'err'); b.disabled = false; });
  });
})();
</script></body></html>`;

@Controller('reset-password')
export class ResetPasswordPageController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
  )
  page(): string {
    return PAGE;
  }
}
