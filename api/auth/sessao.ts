import { autenticar, json } from '../_lib/auth.js'

/** GET /api/auth/sessao — informa se há sessão ativa no painel */
export async function GET(request: Request) {
  return json({ autenticado: (await autenticar(request)) !== null })
}
