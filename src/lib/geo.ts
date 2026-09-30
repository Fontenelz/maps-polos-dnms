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

export type Posicao = { coords: LngLat; /** raio de precisão, em metros */ precisao: number }

type OpcoesLocalizacao = {
  /** Para assim que a precisão for igual ou melhor que este valor (metros) */
  precisaoAlvo?: number
  /** Tempo máximo refinando a posição antes de ficar com a melhor leitura (ms) */
  tempoMaximo?: number
  /** Chamado sempre que chega uma leitura mais precisa que a anterior */
  onAtualizacao?: (posicao: Posicao) => void
}

/**
 * Acompanha a posição por alguns segundos e devolve a leitura mais precisa.
 * A primeira leitura do navegador costuma vir do Wi-Fi/IP (centenas de metros ou mais);
 * o GPS refina em seguida, por isso não usamos só getCurrentPosition.
 */
export function obterLocalizacao({
  precisaoAlvo = 20,
  tempoMaximo = 15000,
  onAtualizacao,
}: OpcoesLocalizacao = {}): Promise<Posicao> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Seu navegador não suporta geolocalização.'))
      return
    }
    if (!window.isSecureContext) {
      reject(new Error('A localização só funciona em HTTPS ou em localhost.'))
      return
    }

    let melhor: Posicao | null = null
    let finalizado = false

    const finalizar = (erro?: Error) => {
      if (finalizado) return
      finalizado = true
      navigator.geolocation.clearWatch(watchId)
      clearTimeout(timer)
      if (melhor) resolve(melhor)
      else reject(erro ?? new Error(MENSAGENS_ERRO[3]))
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const atual: Posicao = {
          coords: [pos.coords.longitude, pos.coords.latitude],
          precisao: pos.coords.accuracy,
        }
        if (!melhor || atual.precisao < melhor.precisao) {
          melhor = atual
          onAtualizacao?.(atual)
        }
        if (atual.precisao <= precisaoAlvo) finalizar()
      },
      (err) => {
        // Permissão negada encerra na hora; outros erros só encerram se ainda não houver leitura
        if (err.code === 1 || !melhor) finalizar(new Error(MENSAGENS_ERRO[err.code] ?? err.message))
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: tempoMaximo },
    )

    const timer = setTimeout(() => finalizar(), tempoMaximo)
  })
}

/** Polígono aproximando um círculo de `raio` metros em volta de `centro` */
export function circulo([lng, lat]: LngLat, raio: number, pontos = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const dLat = raio / 111320
  const dLng = raio / (111320 * Math.cos((lat * Math.PI) / 180))
  const anel: LngLat[] = []
  for (let i = 0; i <= pontos; i++) {
    const t = (i / pontos) * 2 * Math.PI
    anel.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)])
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [anel] } }
}
