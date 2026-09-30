import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

let _sql: NeonQueryFunction<false, false> | null = null

/** Conexão preguiçosa: só exige DATABASE_URL quando a função realmente consulta o banco */
export function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL não configurada')
    _sql = neon(url)
  }
  return _sql
}

export type PoloRow = {
  id: string
  nome: string
  bairro: string
  longitude: number | null
  latitude: number | null
  aproximado: boolean
  criado_em: string
  atualizado_em: string
  removido_em: string | null
}

/** Formato público enviado ao mapa */
export function paraPolo(row: PoloRow) {
  return {
    id: row.id,
    nome: row.nome,
    bairro: row.bairro,
    coords: row.longitude === null || row.latitude === null ? null : [row.longitude, row.latitude],
    aproximado: row.aproximado,
  }
}

export async function registrarAuditoria(poloId: string, acao: string, autor: string, dados: unknown) {
  const sql = getSql()
  await sql`INSERT INTO auditoria (polo_id, acao, autor, dados) VALUES (${poloId}, ${acao}, ${autor}, ${JSON.stringify(dados)})`
}
