export type ResultadoLink = {
  /** [longitude, latitude] */
  coords: [number, number] | null
  /** Nome do lugar, quando o link é de um "place" */
  nome: string | null
  /** Texto buscado, quando o link é uma busca sem coordenadas */
  busca: string | null
}

// Só seguimos links destes domínios (evita que o servidor seja usado para acessar endereços arbitrários — SSRF)
const HOSTS_PERMITIDOS = new Set([
  'google.com',
  'www.google.com',
  'maps.google.com',
  'consent.google.com',
  'google.com.br',
  'www.google.com.br',
  'maps.google.com.br',
  'consent.google.com.br',
  'maps.app.goo.gl',
  'goo.gl',
])
const MAX_REDIRECIONAMENTOS = 5

export function hostPermitido(url: URL) {
  return url.protocol === 'https:' && url.port === '' && HOSTS_PERMITIDOS.has(url.hostname)
}

const numero = String.raw`(-?\d{1,3}(?:\.\d+)?)`

/** decodeURIComponent que não quebra com "%" solto */
function decodificar(texto: string) {
  try {
    return decodeURIComponent(texto)
  } catch {
    return texto
  }
}

function parLatLng(texto: string | null): [number, number] | null {
  if (!texto) return null
  const m = new RegExp(`^\\s*${numero}\\s*,\\s*\\+?${numero}\\s*$`).exec(texto.replace(/\+/g, ' '))
  return m ? [Number(m[2]), Number(m[1])] : null
}

/** Extrai coordenadas/nome de uma URL completa do Google Maps (sem acessar a rede) */
export function analisarUrl(url: URL): ResultadoLink {
  const caminho = decodificar(url.pathname)
  const completo = decodificar(url.href)

  // Nome em /maps/place/<nome>/...
  const nomeMatch = /\/maps\/place\/([^/@]+)/.exec(caminho)
  const nome = nomeMatch ? nomeMatch[1].replace(/\+/g, ' ').trim() : null

  // 1) Pino do lugar: ...!3d<lat>!4d<lng> (mais preciso — o último par é o do lugar)
  const pinos = [...completo.matchAll(new RegExp(`!3d${numero}!4d${numero}`, 'g'))]
  if (pinos.length) {
    const ultimo = pinos[pinos.length - 1]
    return { coords: [Number(ultimo[2]), Number(ultimo[1])], nome, busca: null }
  }

  // 2) Parâmetros com "lat,lng": ?q= ?query= ?ll= ?destination= ?center=
  for (const chave of ['q', 'query', 'll', 'destination', 'center', 'daddr']) {
    const c = parLatLng(url.searchParams.get(chave))
    if (c) return { coords: c, nome, busca: null }
  }

  // 3) Caminho /maps/search/<lat>,<lng> ou /maps/dir/.../<lat>,<lng>
  const noCaminho = new RegExp(`/(?:search|dir|place)/(?:[^/]*/)*?${numero},\\s*\\+?${numero}`).exec(caminho)
  if (noCaminho) return { coords: [Number(noCaminho[2]), Number(noCaminho[1])], nome, busca: null }

  // 4) Centro da tela: /@<lat>,<lng>,<zoom>z (menos preciso — é o centro do mapa, não um pino)
  const centro = new RegExp(`@${numero},${numero}`).exec(caminho)
  if (centro) return { coords: [Number(centro[2]), Number(centro[1])], nome, busca: null }

  // Sem coordenadas: devolve o texto buscado (ex.: ?q=Supermercado Mateus Cohama) para geocodificar
  const busca = url.searchParams.get('q') ?? url.searchParams.get('query') ?? nome
  return { coords: null, nome, busca: busca?.trim() || null }
}

/** Resolve links curtos (maps.app.goo.gl) seguindo redirecionamentos, só dentro de domínios do Google */
export async function resolverLink(entrada: string): Promise<ResultadoLink> {
  let url: URL
  try {
    url = new URL(entrada.trim())
  } catch {
    throw new Error('URL inválida')
  }
  if (!hostPermitido(url)) throw new Error('Informe um link do Google Maps')

  for (let i = 0; i <= MAX_REDIRECIONAMENTOS; i++) {
    // Página de consentimento de cookies: o destino real vem em ?continue=
    if (url.hostname.startsWith('consent.')) {
      const destino = url.searchParams.get('continue')
      if (!destino) break
      url = new URL(destino)
      if (!hostPermitido(url)) throw new Error('Redirecionamento para fora do Google Maps')
    }

    const resultado = analisarUrl(url)
    if (resultado.coords || !/goo\.gl$/.test(url.hostname)) return resultado

    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(5000) })
    const local = res.headers.get('location')
    if (res.status < 300 || res.status >= 400 || !local) break
    url = new URL(local, url)
    if (!hostPermitido(url)) throw new Error('Redirecionamento para fora do Google Maps')
  }
  return analisarUrl(url)
}

/**
 * Resolve um link do Google Maps em coordenadas. Se o link for só uma busca por texto
 * (sem coordenadas), tenta achar o lugar no OpenStreetMap.
 */
export async function coordenadasDoLink(entrada: string) {
  const r = await resolverLink(entrada)
  if (r.coords) return { coords: r.coords, nome: r.nome, fonte: 'google' as const }
  if (r.busca) {
    const { geocodificar } = await import('./geocodificar.js')
    const [primeiro] = await geocodificar(r.busca, 1)
    if (primeiro) return { coords: primeiro.coords, nome: r.nome ?? r.busca, fonte: 'busca' as const }
  }
  throw new Error('Não encontrei coordenadas neste link. Abra o lugar no Google Maps e copie o link de "Compartilhar".')
}
