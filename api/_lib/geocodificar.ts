import { LIMITES } from './validacao.js'

export type ResultadoGeocodificacao = { nome: string; coords: [number, number] }

/** Busca endereços dentro da Ilha de São Luís no OpenStreetMap (Nominatim) */
export async function geocodificar(q: string, limite = 5): Promise<ResultadoGeocodificacao[]> {
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: String(limite),
    countrycodes: 'br',
    viewbox: `${LIMITES.lngMin},${LIMITES.latMax},${LIMITES.lngMax},${LIMITES.latMin}`,
    bounded: '1',
    'accept-language': 'pt-BR',
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    // A política de uso do Nominatim exige um User-Agent identificando a aplicação
    headers: { 'User-Agent': 'map-polos-sao-luis/1.0 (painel administrativo)' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error('Serviço de endereços indisponível')
  const dados = (await res.json()) as { display_name: string; lat: string; lon: string }[]
  return dados.map((r) => ({ nome: r.display_name, coords: [Number(r.lon), Number(r.lat)] }))
}
