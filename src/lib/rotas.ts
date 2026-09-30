import type { LngLat } from '@/lib/geo'

// Servidor público de demonstração do OSRM (o mesmo usado no exemplo de rotas do mapcn).
// É gratuito, mas com limite de uso — para produção com muito acesso, use um servidor próprio.
const OSRM_URL = 'https://router.project-osrm.org'

export type Trajeto = {
  /** metros */
  distancia: number
  /** segundos */
  duracao: number
}

export type Rota = Trajeto & { coordenadas: LngLat[] }

const pares = (pontos: LngLat[]) => pontos.map(([lng, lat]) => `${lng},${lat}`).join(';')

/**
 * Distância e tempo de carro, pelas ruas, da origem até cada destino — numa única requisição.
 * Retorna null para destinos sem rota.
 */
export async function trajetosPorRua(
  origem: LngLat,
  destinos: LngLat[],
  signal?: AbortSignal,
): Promise<(Trajeto | null)[]> {
  const url = `${OSRM_URL}/table/v1/driving/${pares([origem, ...destinos])}?sources=0&annotations=duration,distance`
  const res = await fetch(url, { signal })
  const data = await res.json()
  if (data.code !== 'Ok') throw new Error(data.message ?? 'Falha ao calcular distâncias')
  const duracoes: (number | null)[] = data.durations[0].slice(1)
  const distancias: (number | null)[] = data.distances[0].slice(1)
  return duracoes.map((duracao, i) =>
    duracao === null || distancias[i] === null ? null : { duracao, distancia: distancias[i]! },
  )
}

/** Rota de carro entre dois pontos, com alternativas quando houver */
export async function buscarRotas(origem: LngLat, destino: LngLat, signal?: AbortSignal): Promise<Rota[]> {
  const url = `${OSRM_URL}/route/v1/driving/${pares([origem, destino])}?overview=full&geometries=geojson&alternatives=true`
  const res = await fetch(url, { signal })
  const data = await res.json()
  if (data.code !== 'Ok') throw new Error(data.message ?? 'Falha ao buscar rota')
  return data.routes.map((r: { geometry: { coordinates: LngLat[] }; distance: number; duration: number }) => ({
    coordenadas: r.geometry.coordinates,
    distancia: r.distance,
    duracao: r.duration,
  }))
}

export function formatarDuracao(segundos: number) {
  const min = Math.max(1, Math.round(segundos / 60))
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`
}
