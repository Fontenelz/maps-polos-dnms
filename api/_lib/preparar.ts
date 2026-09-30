import { json } from './auth.js'
import { coordenadasDoLink } from './google-maps.js'
import { coordsSchema } from './validacao.js'

type Entrada = { coords?: [number, number] | null; googleMapsUrl?: string; nome?: string }

/**
 * Se veio `googleMapsUrl`, troca pelo par de coordenadas extraído do link (e usa o nome do lugar
 * quando o nome não foi informado). Garante que o ponto fique dentro da Ilha de São Luís.
 */
export async function resolverGoogleMaps<T extends Entrada>(
  dados: T,
): Promise<(Omit<T, 'googleMapsUrl'> & { coords?: [number, number] | null }) | Response> {
  const { googleMapsUrl, ...resto } = dados
  if (!googleMapsUrl) return resto

  let r
  try {
    r = await coordenadasDoLink(googleMapsUrl)
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : 'Falha ao ler o link' }, 422)
  }
  const coords = coordsSchema.safeParse(r.coords)
  if (!coords.success) return json({ erro: 'O local do link fica fora da Ilha de São Luís' }, 422)

  const nome = resto.nome ?? r.nome?.slice(0, 100)
  if (!nome || nome.length < 2) return json({ erro: 'Informe o nome do polo' }, 400)
  return { ...resto, nome, coords: coords.data }
}
