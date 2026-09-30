import { cookieDeSessao, ipDe, json, lerJson, loginBloqueado, registrarTentativa, senhaCorreta } from '../_lib/auth.js'
import { errosDeValidacao, loginSchema } from '../_lib/validacao.js'

/** POST /api/auth/login { senha } — abre a sessão do painel (cookie HttpOnly de 8h) */
export async function POST(request: Request) {
  const ip = ipDe(request)
  if (await loginBloqueado(ip)) {
    return json({ erro: 'Muitas tentativas. Aguarde 15 minutos.' }, 429, { 'Retry-After': '900' })
  }

  const corpo = await lerJson(request)
  if (corpo instanceof Response) return corpo
  const dados = loginSchema.safeParse(corpo)
  if (!dados.success) return json({ erro: 'Dados inválidos', detalhes: errosDeValidacao(dados.error) }, 400)

  const ok = await senhaCorreta(dados.data.senha)
  await registrarTentativa(ip, ok)
  if (!ok) return json({ erro: 'Senha incorreta' }, 401)

  return json({ ok: true }, 200, { 'Set-Cookie': await cookieDeSessao() })
}
