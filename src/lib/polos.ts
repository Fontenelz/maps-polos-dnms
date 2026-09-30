import type { LngLat } from '@/lib/geo'

export type Polo = {
  id: string
  nome: string
  bairro: string
  /** [longitude, latitude] — null quando a localização ainda não foi definida */
  coords: LngLat | null
  /** true quando a coordenada é aproximada (centro do bairro/condomínio) */
  aproximado: boolean
}

/** Centro da região dos polos em São Luís - MA */
export const SAO_LUIS_CENTER: LngLat = [-44.245, -2.502]

export async function buscarPolos(signal?: AbortSignal): Promise<Polo[]> {
  const res = await fetch('/api/polos', { signal })
  if (!res.ok) throw new Error(`Erro ${res.status} ao carregar os polos`)
  return res.json()
}
