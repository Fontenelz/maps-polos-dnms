import { getSql, paraPolo, type PoloRow } from './_lib/db.js'
import { json } from './_lib/auth.js'

/** GET /api/polos — lista pública dos polos ativos (com cache na CDN da Vercel) */
export async function GET() {
  const sql = getSql()
  const linhas = (await sql`
    SELECT * FROM polos WHERE removido_em IS NULL ORDER BY nome`) as PoloRow[]
  return json(linhas.map(paraPolo), 200, {
    'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300',
  })
}
