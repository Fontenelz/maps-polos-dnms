export type LngLat = [number, number]

/** Distância em linha reta (fórmula de Haversine), em metros */
export function distanciaMetros([lng1, lat1]: LngLat, [lng2, lat2]: LngLat) {
  const R = 6371000
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function formatarDistancia(metros: number) {
  return metros < 1000
    ? `${Math.round(metros)} m`
    : `${(metros / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
}

const MENSAGENS_ERRO: Record<number, string> = {
  1: 'Permissão de localização negada. Libere o acesso no navegador.',
  2: 'Não foi possível determinar sua localização.',
  3: 'Tempo esgotado ao buscar sua localização.',
}

export function obterLocalizacao(): Promise<LngLat> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Seu navegador não suporta geolocalização.'))
      return
    }
    if (!window.isSecureContext) {
      reject(new Error('A localização só funciona em HTTPS ou em localhost.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
      (err) => reject(new Error(MENSAGENS_ERRO[err.code] ?? err.message)),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  })
}
