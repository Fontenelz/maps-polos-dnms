import { cookieDeLogout, json } from '../_lib/auth.js'

/** POST /api/auth/logout — encerra a sessão do painel */
export function POST() {
  return json({ ok: true }, 200, { 'Set-Cookie': cookieDeLogout })
}
