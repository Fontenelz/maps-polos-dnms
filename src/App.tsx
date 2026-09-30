import { useEffect, useMemo, useState } from 'react'
import { Car, LocateFixed, Loader2, MapPin, Navigation, Search } from 'lucide-react'
import {
  Map,
  MapControls,
  MapGeoJSON,
  MapMarker,
  MapPopup,
  MapRoute,
  MarkerContent,
  MarkerLabel,
  MarkerTooltip,
  useMap,
} from '@/components/ui/map'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { buscarPolos, SAO_LUIS_CENTER, type Polo } from '@/lib/polos'
import { circulo, distanciaMetros, formatarDistancia, obterLocalizacao, type LngLat } from '@/lib/geo'
import { buscarRotas, formatarDuracao, trajetosPorRua, type Rota, type Trajeto } from '@/lib/rotas'

/** Acima disso (metros) avisamos que a localização está imprecisa */
const PRECISAO_RUIM = 100

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

type Camera =
  | { tipo: 'ponto'; centro: LngLat }
  | { tipo: 'enquadrar'; pontos: LngLat[] }

function CameraController({ camera }: { camera: Camera | null }) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!map || !isLoaded || !camera) return
    if (camera.tipo === 'ponto') {
      map.flyTo({ center: camera.centro, zoom: 15, duration: 1200 })
    } else {
      const lngs = camera.pontos.map((p) => p[0])
      const lats = camera.pontos.map((p) => p[1])
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 80, maxZoom: 15, duration: 1200 },
      )
    }
  }, [map, isLoaded, camera])
  return null
}

export default function App() {
  const [polos, setPolos] = useState<Polo[]>([])
  const [carregandoPolos, setCarregandoPolos] = useState(true)
  const [erroPolos, setErroPolos] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [camera, setCamera] = useState<Camera | null>(null)
  const [minhaLocalizacao, setMinhaLocalizacao] = useState<LngLat | null>(null)
  /** Raio de precisão em metros; null quando a posição foi ajustada manualmente */
  const [precisao, setPrecisao] = useState<number | null>(null)
  const [localizando, setLocalizando] = useState(false)
  const [erroLocalizacao, setErroLocalizacao] = useState<string | null>(null)
  /** Distância/tempo pelas ruas até cada polo (OSRM); null enquanto não calculado */
  const [trajetos, setTrajetos] = useState<Record<string, Trajeto | null> | null>(null)
  const [rotas, setRotas] = useState<Rota[]>([])
  const [rotaAtiva, setRotaAtiva] = useState(0)
  const [carregandoRota, setCarregandoRota] = useState(false)
  const [erroRota, setErroRota] = useState<string | null>(null)

  // Polos com a distância até o usuário, ordenados do mais perto ao mais longe.
  // Usa o tempo de carro pelas ruas quando disponível; senão, a distância em linha reta.
  const polosComDistancia = useMemo(() => {
    const lista = polos.map((p) => ({
      ...p,
      distancia: minhaLocalizacao && p.coords ? distanciaMetros(minhaLocalizacao, p.coords) : null,
      trajeto: trajetos?.[p.id] ?? null,
    }))
    if (!minhaLocalizacao) return lista
    return lista.sort((a, b) =>
      trajetos
        ? (a.trajeto?.duracao ?? Infinity) - (b.trajeto?.duracao ?? Infinity)
        : (a.distancia ?? Infinity) - (b.distancia ?? Infinity),
    )
  }, [polos, minhaLocalizacao, trajetos])

  const maisProximo = minhaLocalizacao
    ? (polosComDistancia.find((p) => (trajetos ? p.trajeto : p.distancia !== null)) ?? null)
    : null

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim())
    if (!termo) return polosComDistancia
    return polosComDistancia.filter((p) => normalizar(`${p.nome} ${p.bairro}`).includes(termo))
  }, [busca, polosComDistancia])

  const selecionado = polosComDistancia.find((p) => p.id === selecionadoId) ?? null
  const noMapa = filtrados.filter((p) => p.coords)

  function selecionar(id: string) {
    const polo = polos.find((p) => p.id === id)
    setSelecionadoId(id)
    if (polo?.coords) setCamera({ tipo: 'ponto', centro: polo.coords })
  }

  function mostrarMaisProximo(local: LngLat) {
    setMinhaLocalizacao(local)
    setErroLocalizacao(null)
    setTrajetos(null)
    const proximo = polos
      .filter((p) => p.coords)
      .reduce((melhor, p) =>
        distanciaMetros(local, p.coords!) < distanciaMetros(local, melhor.coords!) ? p : melhor,
      )
    setSelecionadoId(proximo.id)
    setCamera({ tipo: 'enquadrar', pontos: [local, proximo.coords!] })
  }

  useEffect(() => {
    const controle = new AbortController()
    buscarPolos(controle.signal)
      .then(setPolos)
      .catch((e) => {
        if (!controle.signal.aborted) setErroPolos(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!controle.signal.aborted) setCarregandoPolos(false)
      })
    return () => controle.abort()
  }, [])

  // Com a localização definida, calcula o tempo pelas ruas até todos os polos e seleciona o mais rápido
  useEffect(() => {
    if (!minhaLocalizacao || localizando) return
    const controle = new AbortController()
    const comLocal = polos.filter((p) => p.coords)
    trajetosPorRua(minhaLocalizacao, comLocal.map((p) => p.coords!), controle.signal)
      .then((resultado) => {
        const porId = Object.fromEntries(comLocal.map((p, i) => [p.id, resultado[i]]))
        setTrajetos(porId)
        const maisRapido = comLocal
          .filter((p) => porId[p.id])
          .sort((a, b) => porId[a.id]!.duracao - porId[b.id]!.duracao)[0]
        if (maisRapido) setSelecionadoId(maisRapido.id)
      })
      .catch(() => {
        // Sem OSRM, segue com a distância em linha reta
      })
    return () => controle.abort()
  }, [polos, minhaLocalizacao, localizando])

  // Busca a rota (e alternativas) da sua posição até o polo selecionado
  useEffect(() => {
    setRotas([])
    setRotaAtiva(0)
    setErroRota(null)
    const destino = polos.find((p) => p.id === selecionadoId)?.coords
    if (!minhaLocalizacao || localizando || !destino) return
    const controle = new AbortController()
    setCarregandoRota(true)
    buscarRotas(minhaLocalizacao, destino, controle.signal)
      .then((resultado) => {
        setRotas(resultado)
        if (resultado[0]) {
          setCamera({ tipo: 'enquadrar', pontos: [minhaLocalizacao, destino, ...resultado[0].coordenadas] })
        }
      })
      .catch((e) => {
        if (!controle.signal.aborted) setErroRota(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!controle.signal.aborted) setCarregandoRota(false)
      })
    return () => controle.abort()
  }, [polos, minhaLocalizacao, localizando, selecionadoId])

  async function encontrarMaisProximo() {
    setLocalizando(true)
    setErroLocalizacao(null)
    let primeira = true
    try {
      const final = await obterLocalizacao({
        onAtualizacao: ({ coords, precisao }) => {
          setPrecisao(precisao)
          // Enquadra o mapa na primeira leitura; as seguintes só refinam o marcador
          if (primeira) mostrarMaisProximo(coords)
          else setMinhaLocalizacao(coords)
          primeira = false
        },
      })
      mostrarMaisProximo(final.coords)
    } catch (e) {
      setErroLocalizacao(e instanceof Error ? e.message : String(e))
    } finally {
      setLocalizando(false)
    }
  }

  return (
    <div className="bg-background text-foreground flex h-dvh flex-col md:flex-row">
      <aside className="flex max-h-[40dvh] w-full shrink-0 flex-col border-b md:max-h-none md:w-80 md:border-r md:border-b-0">
        <header className="space-y-3 border-b p-4">
          <div>
            <h1 className="text-lg font-semibold">Polos · São Luís</h1>
            <p className="text-muted-foreground text-sm">
              {carregandoPolos
                ? 'Carregando polos…'
                : `${polos.length} polos · ${polos.filter((p) => p.coords).length} no mapa`}
            </p>
            {erroPolos && <p className="text-destructive text-xs">{erroPolos}</p>}
          </div>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar polo ou bairro…"
              className="pl-8"
            />
          </div>
          <Button onClick={encontrarMaisProximo} disabled={localizando} className="w-full">
            {localizando ? <Loader2 className="animate-spin" /> : <LocateFixed />}
            {localizando
              ? precisao !== null
                ? `Refinando… ±${formatarDistancia(precisao)}`
                : 'Buscando sua localização…'
              : minhaLocalizacao
                ? 'Atualizar minha localização'
                : 'Encontrar o polo mais próximo'}
          </Button>
          {erroLocalizacao && <p className="text-destructive text-xs">{erroLocalizacao}</p>}
          {minhaLocalizacao && !localizando && (
            <p className="text-muted-foreground text-xs">
              {precisao === null
                ? 'Posição ajustada manualmente.'
                : `Precisão: ±${formatarDistancia(precisao)}.`}{' '}
              Arraste o ponto verde no mapa se não for onde você está.
            </p>
          )}
          {precisao !== null && precisao > PRECISAO_RUIM && !localizando && (
            <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
              Localização imprecisa. Em computadores a posição vem da rede (Wi-Fi/IP), não de GPS.
              No celular, ative a localização precisa/GPS e tente de novo.
            </p>
          )}
          {maisProximo && (
            <p className="text-muted-foreground text-xs">
              Mais próximo: <span className="text-foreground font-medium">{maisProximo.nome}</span> ·{' '}
              {maisProximo.trajeto
                ? `${formatarDuracao(maisProximo.trajeto.duracao)} de carro (${formatarDistancia(maisProximo.trajeto.distancia)})`
                : `${formatarDistancia(maisProximo.distancia!)} em linha reta`}
            </p>
          )}
          {selecionado && minhaLocalizacao && (carregandoRota || rotas.length > 0 || erroRota) && (
            <div className="space-y-1.5 rounded-md border p-2">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <Car className="size-3.5" />
                Rota até {selecionado.nome}
                {carregandoRota && <Loader2 className="size-3 animate-spin" />}
              </p>
              {erroRota && <p className="text-destructive text-xs">Não foi possível traçar a rota: {erroRota}</p>}
              <div className="flex flex-wrap gap-1.5">
                {rotas.map((rota, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRotaAtiva(i)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs transition-colors',
                      i === rotaAtiva ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                    )}
                  >
                    {formatarDuracao(rota.duracao)} · {formatarDistancia(rota.distancia)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </header>
        <ul className="flex-1 overflow-y-auto p-2">
          {filtrados.map((polo) => (
            <li key={polo.id}>
              <button
                type="button"
                disabled={!polo.coords}
                onClick={() => selecionar(polo.id)}
                className={cn(
                  'hover:bg-muted flex w-full items-start gap-2 rounded-md p-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  selecionadoId === polo.id && 'bg-muted',
                )}
              >
                <MapPin className="text-primary mt-0.5 size-4 shrink-0" />
                <span className="flex-1">
                  <span className="block font-medium">{polo.nome}</span>
                  <span className="text-muted-foreground block text-xs">
                    {polo.bairro}
                    {polo.trajeto
                      ? ` · ${formatarDuracao(polo.trajeto.duracao)} · ${formatarDistancia(polo.trajeto.distancia)}`
                      : polo.distancia !== null && ` · ${formatarDistancia(polo.distancia)}`}
                  </span>
                </span>
                {polo.id === maisProximo?.id ? (
                  <Badge>mais próximo</Badge>
                ) : !polo.coords ? (
                  <Badge variant="outline">sem local</Badge>
                ) : polo.aproximado ? (
                  <Badge variant="secondary">aprox.</Badge>
                ) : null}
              </button>
            </li>
          ))}
          {filtrados.length === 0 && !carregandoPolos && (
            <li className="text-muted-foreground p-4 text-center text-sm">Nenhum polo encontrado.</li>
          )}
        </ul>
      </aside>

      <main className="relative flex-1">
        <Map center={SAO_LUIS_CENTER} zoom={12.3}>
          <MapControls
            position="bottom-right"
            showZoom
            showCompass
            showFullscreen
          />
          <CameraController camera={camera} />

          {/* Rotas pelas ruas: alternativas mais claras por baixo, a ativa por cima */}
          {rotas.map((rota, i) => (
            <MapRoute
              key={`${selecionadoId}-${i}`}
              coordinates={rota.coordenadas}
              active={i === rotaAtiva}
              color="#94a3b8"
              width={5}
              opacity={0.7}
              activeColor="#16a34a"
              activeWidth={6}
              activeOpacity={1}
              onClick={() => setRotaAtiva(i)}
            />
          ))}

          {/* Enquanto a rota carrega (ou se o OSRM falhar), mostra a linha reta */}
          {minhaLocalizacao && selecionado?.coords && rotas.length === 0 && (
            <MapRoute
              coordinates={[minhaLocalizacao, selecionado.coords]}
              color="#16a34a"
              width={3}
              dashArray={[2, 2]}
              interactive={false}
            />
          )}

          {minhaLocalizacao && precisao !== null && (
            <MapGeoJSON
              data={circulo(minhaLocalizacao, precisao)}
              fillPaint={{ 'fill-color': '#16a34a', 'fill-opacity': 0.12 }}
              linePaint={{ 'line-color': '#16a34a', 'line-width': 1, 'line-opacity': 0.5 }}
            />
          )}

          {minhaLocalizacao && (
            <MapMarker
              longitude={minhaLocalizacao[0]}
              latitude={minhaLocalizacao[1]}
              draggable
              onDragEnd={({ lng, lat }) => {
                setPrecisao(null)
                mostrarMaisProximo([lng, lat])
              }}
            >
              <MarkerContent>
                <div className="relative flex size-5 items-center justify-center">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-60" />
                  <span className="relative size-3.5 rounded-full border-2 border-white bg-green-600 shadow-lg" />
                </div>
              </MarkerContent>
              <MarkerTooltip>Você está aqui · arraste para ajustar</MarkerTooltip>
            </MapMarker>
          )}

          {noMapa.map((polo) => (
            <MapMarker
              key={polo.id}
              longitude={polo.coords![0]}
              latitude={polo.coords![1]}
              onClick={() => selecionar(polo.id)}
            >
              <MarkerContent>
                <div
                  className={cn(
                    'size-4 rounded-full border-2 border-white shadow-lg transition-transform',
                    polo.aproximado ? 'bg-amber-500' : 'bg-blue-600',
                    selecionadoId === polo.id && 'scale-150',
                  )}
                />
                {selecionadoId === polo.id && (
                  <MarkerLabel position="bottom">{polo.nome}</MarkerLabel>
                )}
              </MarkerContent>
              <MarkerTooltip>{polo.nome}</MarkerTooltip>
            </MapMarker>
          ))}

          {selecionado?.coords && (
            <MapPopup
              key={selecionado.id}
              longitude={selecionado.coords[0]}
              latitude={selecionado.coords[1]}
              onClose={() => setSelecionadoId(null)}
              closeButton
              offset={14}
            >
              <div className="space-y-1 pr-4">
                <p className="font-medium">{selecionado.nome}</p>
                <p className="text-muted-foreground text-xs">{selecionado.bairro} · São Luís - MA</p>
                {rotas[rotaAtiva] ? (
                  <p className="text-xs">
                    <Car className="mr-1 inline size-3" />
                    {formatarDuracao(rotas[rotaAtiva].duracao)} de carro · {formatarDistancia(rotas[rotaAtiva].distancia)}
                  </p>
                ) : (
                  selecionado.distancia !== null && (
                    <p className="text-xs">
                      <Navigation className="mr-1 inline size-3" />
                      {formatarDistancia(selecionado.distancia)} de você (linha reta)
                    </p>
                  )
                )}
                {selecionado.aproximado && (
                  <p className="text-xs text-amber-600">Localização aproximada</p>
                )}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selecionado.coords[1]},${selecionado.coords[0]}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-block pt-1 text-xs underline"
                >
                  Como chegar
                </a>
              </div>
            </MapPopup>
          )}
        </Map>

        <div className="bg-background/90 absolute top-2 left-2 flex gap-3 rounded-md border px-3 py-1.5 text-xs shadow-sm backdrop-blur">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-blue-600" />Localização exata</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-amber-500" />Aproximada</span>
          {minhaLocalizacao && (
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-green-600" />Você</span>
          )}
        </div>
      </main>
    </div>
  )
}
