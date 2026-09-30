import { exigirAdmin, json, lerJson } from '../../_lib/auth.js'
import { getSql, paraPolo, registrarAuditoria, type PoloRow } from '../../_lib/db.js'
import { resolverGoogleMaps } from '../../_lib/preparar.js'
import { errosDeValidacao, novoPoloSchema } from '../../_lib/validacao.js'

/** GET /api/admin/polos — todos os polos, inclusive removidos (sem cache) */
export async function GET(request: Request) {
  const autor = await exigirAdmin(request)
  if (autor instanceof Response) return autor

  const sql = getSql()
  const linhas = (await sql`SELECT * FROM polos ORDER BY removido_em IS NOT NULL, nome`) as PoloRow[]
  return json(
    linhas.map((r) => ({ ...paraPolo(r), removido: r.removido_em !== null, atualizadoEm: r.atualizado_em })),
  )
}

/**
 * POST /api/admin/polos — cria um polo.
 * Corpo: { nome, bairro?, aproximado?, coords?: [lng, lat] | null } ou { nome?, googleMapsUrl, ... }
 */
export async function POST(request: Request) {
  const autor = await exigirAdmin(request)
  if (autor instanceof Response) return autor

  const corpo = await lerJson(request)
  if (corpo instanceof Response) return corpo
  const dados = novoPoloSchema.safeParse(corpo)
  if (!dados.success) return json({ erro: 'Dados inválidos', detalhes: errosDeValidacao(dados.error) }, 400)

  const preparado = await resolverGoogleMaps(dados.data)
  if (preparado instanceof Response) return preparado
  const { bairro, aproximado } = preparado
  const nome = preparado.nome!
  const coords = preparado.coords ?? null
  const sql = getSql()
  const [linha] = (await sql`
    INSERT INTO polos (nome, bairro, longitude, latitude, aproximado, criado_por, atualizado_por)
    VALUES (${nome}, ${bairro}, ${coords?.[0] ?? null}, ${coords?.[1] ?? null}, ${aproximado}, ${autor}, ${autor})
    RETURNING *`) as PoloRow[]
  await registrarAuditoria(linha.id, 'criar', autor, dados.data)
  return json(paraPolo(linha), 201)
}
