import { exigirAdmin, json, lerJson } from '../../_lib/auth.js'
import { getSql, paraPolo, registrarAuditoria, type PoloRow } from '../../_lib/db.js'
import { resolverGoogleMaps } from '../../_lib/preparar.js'
import { edicaoPoloSchema, errosDeValidacao } from '../../_lib/validacao.js'

function idDe(request: Request) {
  const id = decodeURIComponent(new URL(request.url).pathname.split('/').pop() ?? '')
  return /^[\w-]{1,64}$/.test(id) ? id : null
}

/** PATCH /api/admin/polos/:id — edita campos (ou { restaurar: true } para desfazer uma remoção) */
export async function PATCH(request: Request) {
  const autor = await exigirAdmin(request)
  if (autor instanceof Response) return autor
  const id = idDe(request)
  if (!id) return json({ erro: 'ID inválido' }, 400)

  const corpo = await lerJson(request)
  if (corpo instanceof Response) return corpo
  const dados = edicaoPoloSchema.safeParse(corpo)
  if (!dados.success) return json({ erro: 'Dados inválidos', detalhes: errosDeValidacao(dados.error) }, 400)

  const d = await resolverGoogleMaps(dados.data)
  if (d instanceof Response) return d
  const mudaCoords = d.coords !== undefined
  const sql = getSql()
  const [linha] = (await sql`
    UPDATE polos SET
      nome           = COALESCE(${d.nome ?? null}, nome),
      bairro         = COALESCE(${d.bairro ?? null}, bairro),
      aproximado     = COALESCE(${d.aproximado ?? null}, aproximado),
      longitude      = CASE WHEN ${mudaCoords} THEN ${d.coords?.[0] ?? null}::double precision ELSE longitude END,
      latitude       = CASE WHEN ${mudaCoords} THEN ${d.coords?.[1] ?? null}::double precision ELSE latitude END,
      removido_em    = CASE WHEN ${d.restaurar === true} THEN NULL ELSE removido_em END,
      atualizado_em  = now(),
      atualizado_por = ${autor}
    WHERE id = ${id}
    RETURNING *`) as PoloRow[]
  if (!linha) return json({ erro: 'Polo não encontrado' }, 404)

  await registrarAuditoria(id, d.restaurar ? 'restaurar' : 'editar', autor, dados.data)
  return json(paraPolo(linha))
}

/** DELETE /api/admin/polos/:id — remoção lógica (pode ser desfeita com PATCH { restaurar: true }) */
export async function DELETE(request: Request) {
  const autor = await exigirAdmin(request)
  if (autor instanceof Response) return autor
  const id = idDe(request)
  if (!id) return json({ erro: 'ID inválido' }, 400)

  const sql = getSql()
  const [linha] = (await sql`
    UPDATE polos SET removido_em = now(), atualizado_em = now(), atualizado_por = ${autor}
    WHERE id = ${id} AND removido_em IS NULL
    RETURNING id`) as { id: string }[]
  if (!linha) return json({ erro: 'Polo não encontrado' }, 404)

  await registrarAuditoria(id, 'remover', autor, null)
  return json({ ok: true })
}
