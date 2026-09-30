import { createHash, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { jwtVerify, SignJWT } from 'jose'
import { getSql } from './db.js'

const scrypt = promisify(scryptCb) as (senha: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>

const COOKIE = 'polos_sessao'
const DURACAO_SESSAO_S = 8 * 60 * 60 // 8 horas
const JANELA_LOGIN_MIN = 15
const MAX_FALHAS_POR_IP = 5
const MAX_FALHAS_GLOBAL = 50

export type Autor = 'painel' | 'api'

function env(nome: string) {
  const valor = process.env[nome]
  if (!valor) throw new Error(`${nome} não configurada`)
  return valor
}

function iguais(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b)
}

function chaveSessao() {
  return new TextEncoder().encode(env('SESSION_SECRET'))
}

export function json(dados: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(dados, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  })
}

export function ipDe(request: Request) {
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'desconhecido'
  )
}

/** ADMIN_PASSWORD_HASH tem o formato scrypt$<N>$<salt base64>$<hash base64> (gerado por scripts/gerar-credenciais.ts) */
export async function senhaCorreta(senha: string) {
  const [algo, n, salt, hash] = env('ADMIN_PASSWORD_HASH').split('$')
  if (algo !== 'scrypt' || !n || !salt || !hash) throw new Error('ADMIN_PASSWORD_HASH inválido')
  const esperado = Buffer.from(hash, 'base64')
  const calculado = await scrypt(senha, Buffer.from(salt, 'base64'), esperado.length, {
    N: Number(n),
    maxmem: 256 * 1024 * 1024,
  })
  return iguais(calculado, esperado)
}

/** Limita força bruta: por IP e no total (contra ataques distribuídos) */
export async function loginBloqueado(ip: string) {
  const sql = getSql()
  const [linha] = await sql`
    SELECT
      count(*) FILTER (WHERE ip = ${ip})::int AS por_ip,
      count(*)::int AS total
    FROM login_tentativas
    WHERE NOT sucesso AND criado_em > now() - make_interval(mins => ${JANELA_LOGIN_MIN})`
  return linha.por_ip >= MAX_FALHAS_POR_IP || linha.total >= MAX_FALHAS_GLOBAL
}

export async function registrarTentativa(ip: string, sucesso: boolean) {
  const sql = getSql()
  await sql`INSERT INTO login_tentativas (ip, sucesso) VALUES (${ip}, ${sucesso})`
  // limpeza oportunista de registros antigos
  await sql`DELETE FROM login_tentativas WHERE criado_em < now() - interval '1 day'`
}

export async function cookieDeSessao() {
  const token = await new SignJWT({ papel: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_S}s`)
    .sign(chaveSessao())
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=${DURACAO_SESSAO_S}`
}

export const cookieDeLogout = `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0`

function lerCookie(request: Request, nome: string) {
  for (const parte of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = parte.trim().split('=')
    if (k === nome) return v.join('=')
  }
  return null
}

/**
 * Identifica quem está chamando:
 * - `Authorization: Bearer <chave>` → sistemas externos (chave comparada pelo hash SHA-256)
 * - cookie de sessão → painel /admin
 * Retorna null se não autenticado.
 */
export async function autenticar(request: Request): Promise<Autor | null> {
  const authz = request.headers.get('authorization')
  if (authz?.startsWith('Bearer ')) {
    const hashRecebido = createHash('sha256').update(authz.slice(7).trim()).digest()
    const hashEsperado = Buffer.from(env('ADMIN_API_KEY_HASH'), 'hex')
    return iguais(hashRecebido, hashEsperado) ? 'api' : null
  }

  const token = lerCookie(request, COOKIE)
  if (!token) return null
  try {
    await jwtVerify(token, chaveSessao(), { algorithms: ['HS256'] })
  } catch {
    return null
  }

  // Proteção contra CSRF: escritas com cookie precisam vir do próprio site
  if (request.method !== 'GET') {
    const origem = request.headers.get('origin')
    if (!origem || new URL(origem).host !== new URL(request.url).host) return null
  }
  return 'painel'
}

/** Atalho para rotas protegidas: devolve o autor ou uma resposta 401 */
export async function exigirAdmin(request: Request): Promise<Autor | Response> {
  const autor = await autenticar(request)
  return autor ?? json({ erro: 'Não autorizado' }, 401)
}

/** Lê o corpo JSON exigindo Content-Type correto e tamanho limitado */
export async function lerJson(request: Request): Promise<unknown | Response> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return json({ erro: 'Envie Content-Type: application/json' }, 415)
  }
  const texto = await request.text()
  if (texto.length > 10_000) return json({ erro: 'Corpo muito grande' }, 413)
  try {
    return JSON.parse(texto)
  } catch {
    return json({ erro: 'JSON inválido' }, 400)
  }
}
