import { exigirAdmin, json } from '../_lib/auth.js'
import { geocodificar } from '../_lib/geocodificar.js'

/** GET /api/admin/geocodificar?q=endereço — busca endereços na Ilha de São Luís (OpenStreetMap/Nominatim) */
export async function GET(request: Request) {
  const autor = await exigirAdmin(request)
  if (autor instanceof Response) return autor

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 3 || q.length > 200) return json({ erro: 'Busca deve ter entre 3 e 200 caracteres' }, 400)

  try {
    return json(await geocodificar(q))
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : 'Falha na busca' }, 502)
  }
}
