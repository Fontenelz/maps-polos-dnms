import { exigirAdmin, json } from '../_lib/auth.js'
import { coordenadasDoLink } from '../_lib/google-maps.js'
import { LIMITES } from '../_lib/validacao.js'

/** GET /api/admin/google-maps?url=<link> — extrai coordenadas e nome de um link do Google Maps */
export async function GET(request: Request) {
  const autor = await exigirAdmin(request)
  if (autor instanceof Response) return autor

  const link = new URL(request.url).searchParams.get('url') ?? ''
  if (!link || link.length > 2000) return json({ erro: 'Informe o link do Google Maps' }, 400)

  try {
    const r = await coordenadasDoLink(link)
    const [lng, lat] = r.coords
    const dentroDaIlha =
      lng >= LIMITES.lngMin && lng <= LIMITES.lngMax && lat >= LIMITES.latMin && lat <= LIMITES.latMax
    return json({ ...r, dentroDaIlha })
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : 'Falha ao ler o link' }, 422)
  }
}
