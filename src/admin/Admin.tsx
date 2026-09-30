import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  Link2,
  Loader2,
  LogOut,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerLabel,
  MarkerTooltip,
  useMap,
} from '@/components/ui/map'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminApi, ErroApi, type DadosPolo, type PoloAdmin } from '@/lib/admin-api'
import type { LngLat } from '@/lib/geo'
import { SAO_LUIS_CENTER } from '@/lib/polos'
import { cn } from '@/lib/utils'

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e))
const formatarCoords = ([lng, lat]: LngLat) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`

type Rascunho = DadosPolo & {
  /** id do polo em edição; null = novo polo */
  id: string | null
  /** posição de onde o ponto veio (link, busca ou valor salvo), para poder desfazer ajustes */
  coordsOrigem: LngLat | null
}

const rascunhoVazio: Rascunho = { id: null, nome: '', bairro: '', coords: null, aproximado: false, coordsOrigem: null }

/** Clique no mapa move o ponto da prévia */
function CliqueNoMapa({ ativo, onClique }: { ativo: boolean; onClique: (c: LngLat) => void }) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!map || !isLoaded || !ativo) return
    const handler = (e: { lngLat: { lng: number; lat: number } }) => onClique([e.lngLat.lng, e.lngLat.lat])
    map.on('click', handler)
    map.getCanvas().style.cursor = 'crosshair'
    return () => {
      map.off('click', handler)
      map.getCanvas().style.cursor = ''
    }
  }, [map, isLoaded, ativo, onClique])
  return null
}

function VoarPara({ alvo }: { alvo: { coords: LngLat; n: number } | null }) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (map && isLoaded && alvo) map.flyTo({ center: alvo.coords, zoom: Math.max(map.getZoom(), 16), duration: 1000 })
  }, [map, isLoaded, alvo])
  return null
}

function Login({ onEntrar }: { onEntrar: () => void }) {
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      await adminApi.login(senha)
      onEntrar()
    } catch (err) {
      setErro(mensagem(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="bg-background text-foreground flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-lg border p-6 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold">Painel dos polos</h1>
          <p className="text-muted-foreground text-sm">Entre com a senha de administrador.</p>
        </div>
        <Input
          type="password"
          autoComplete="current-password"
          autoFocus
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha"
          aria-label="Senha"
        />
        {erro && <p className="text-destructive text-sm">{erro}</p>}
        <Button type="submit" disabled={enviando || !senha} className="w-full">
          {enviando && <Loader2 className="animate-spin" />}
          Entrar
        </Button>
        <a href="/" className="text-muted-foreground block text-center text-xs underline">
          Voltar ao mapa
        </a>
      </form>
    </div>
  )
}

function Painel({ onSair }: { onSair: () => void }) {
  const [polos, setPolos] = useState<PoloAdmin[]>([])
  const [carregando, setCarregando] = useState(true)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [voo, setVoo] = useState<{ coords: LngLat; n: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const [link, setLink] = useState('')
  const [lendoLink, setLendoLink] = useState(false)
  const [busca, setBusca] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultadosBusca, setResultadosBusca] = useState<{ nome: string; coords: LngLat }[]>([])

  const tratarErro = useCallback(
    (e: unknown) => {
      if (e instanceof ErroApi && e.status === 401) onSair()
      else setErro(mensagem(e))
    },
    [onSair],
  )

  const recarregar = useCallback(async () => {
    try {
      setPolos(await adminApi.listar())
    } catch (e) {
      tratarErro(e)
    } finally {
      setCarregando(false)
    }
  }, [tratarErro])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  function voar(coords: LngLat) {
    setVoo((v) => ({ coords, n: (v?.n ?? 0) + 1 }))
  }

  function limparEntradas() {
    setLink('')
    setBusca('')
    setResultadosBusca([])
    setErro(null)
    setAviso(null)
  }

  function novo() {
    limparEntradas()
    setRascunho({ ...rascunhoVazio })
  }

  function editar(p: PoloAdmin) {
    limparEntradas()
    setRascunho({ id: p.id, nome: p.nome, bairro: p.bairro, coords: p.coords, aproximado: p.aproximado, coordsOrigem: p.coords })
    if (p.coords) voar(p.coords)
  }

  /** Define a posição a partir de uma fonte (link/busca) — vira a nova "origem" para desfazer */
  function posicionar(coords: LngLat, extras: Partial<Rascunho> = {}) {
    setRascunho((r) => ({ ...(r ?? rascunhoVazio), ...extras, coords, coordsOrigem: coords }))
    voar(coords)
  }

  /** Ajuste fino (clique no mapa ou arraste): muda o ponto mas mantém a origem */
  const ajustar = useCallback((coords: LngLat) => {
    setRascunho((r) => (r ? { ...r, coords } : r))
  }, [])

  async function lerLink(e: FormEvent) {
    e.preventDefault()
    setLendoLink(true)
    setErro(null)
    setAviso(null)
    try {
      const r = await adminApi.lerGoogleMaps(link)
      posicionar(r.coords, {
        nome: rascunho?.nome || r.nome || '',
        aproximado: r.fonte === 'busca' ? true : (rascunho?.aproximado ?? false),
      })
      if (!r.dentroDaIlha) setAviso('Esse ponto fica fora da Ilha de São Luís e não poderá ser salvo. Ajuste no mapa.')
      else if (r.fonte === 'busca')
        setAviso('O link não tinha coordenadas; o ponto foi localizado pelo nome e pode estar impreciso. Confira no mapa.')
    } catch (err) {
      tratarErro(err)
    } finally {
      setLendoLink(false)
    }
  }

  async function buscarEndereco(e: FormEvent) {
    e.preventDefault()
    setBuscando(true)
    setErro(null)
    try {
      const r = await adminApi.geocodificar(busca)
      setResultadosBusca(r)
      if (r.length === 0) setAviso('Nenhum endereço encontrado na Ilha de São Luís.')
    } catch (err) {
      tratarErro(err)
    } finally {
      setBuscando(false)
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!rascunho) return
    setSalvando(true)
    setErro(null)
    const dados: DadosPolo = {
      nome: rascunho.nome,
      bairro: rascunho.bairro,
      coords: rascunho.coords,
      aproximado: rascunho.aproximado,
    }
    try {
      if (rascunho.id) await adminApi.editar(rascunho.id, dados)
      else await adminApi.criar(dados)
      setRascunho(null)
      limparEntradas()
      await recarregar()
    } catch (err) {
      tratarErro(err)
    } finally {
      setSalvando(false)
    }
  }

  async function remover(p: PoloAdmin) {
    if (!confirm(`Remover "${p.nome}" do mapa? Dá para restaurar depois.`)) return
    try {
      await adminApi.remover(p.id)
      if (rascunho?.id === p.id) setRascunho(null)
      await recarregar()
    } catch (err) {
      tratarErro(err)
    }
  }

  async function restaurar(p: PoloAdmin) {
    try {
      await adminApi.restaurar(p.id)
      await recarregar()
    } catch (err) {
      tratarErro(err)
    }
  }

  async function sair() {
    await adminApi.logout().catch(() => {})
    onSair()
  }

  const ajustado =
    rascunho?.coords && rascunho.coordsOrigem &&
    (rascunho.coords[0] !== rascunho.coordsOrigem[0] || rascunho.coords[1] !== rascunho.coordsOrigem[1])

  return (
    <div className="bg-background text-foreground flex h-dvh flex-col md:flex-row">
      <aside className="flex max-h-[55dvh] w-full shrink-0 flex-col border-b md:max-h-none md:w-96 md:border-r md:border-b-0">
        <header className="flex items-center justify-between gap-2 border-b p-4">
          <div>
            <h1 className="text-lg font-semibold">Painel dos polos</h1>
            <a href="/" className="text-muted-foreground inline-flex items-center gap-1 text-xs underline">
              <ArrowLeft className="size-3" /> Ver mapa público
            </a>
          </div>
          <Button variant="outline" size="sm" onClick={sair}>
            <LogOut /> Sair
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {erro && (
            <div className="bg-destructive/10 text-destructive m-4 mb-0 flex items-start gap-2 rounded-md p-2 text-sm">
              <span className="flex-1">{erro}</span>
              <button type="button" onClick={() => setErro(null)} aria-label="Fechar erro">
                <X className="size-4" />
              </button>
            </div>
          )}

          {rascunho ? (
            <section className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{rascunho.id ? 'Editar polo' : 'Novo polo'}</h2>
                <Button variant="ghost" size="sm" onClick={() => { setRascunho(null); limparEntradas() }}>
                  Cancelar
                </Button>
              </div>

              {/* 1. Localização */}
              <div className="space-y-2">
                <p className="text-sm font-medium">1. Localização</p>
                <form onSubmit={lerLink} className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                    <Input
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="Cole o link do Google Maps"
                      className="pl-8"
                      inputMode="url"
                    />
                  </div>
                  <Button type="submit" variant="secondary" disabled={lendoLink || !link.trim()}>
                    {lendoLink ? <Loader2 className="animate-spin" /> : 'Ler'}
                  </Button>
                </form>
                <form onSubmit={buscarEndereco} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Ou busque um endereço"
                      className="pl-8"
                    />
                  </div>
                  <Button type="submit" variant="secondary" disabled={buscando || busca.trim().length < 3}>
                    {buscando ? <Loader2 className="animate-spin" /> : 'Buscar'}
                  </Button>
                </form>
                {resultadosBusca.length > 0 && (
                  <ul className="divide-y rounded-md border text-xs">
                    {resultadosBusca.map((r) => (
                      <li key={r.nome}>
                        <button
                          type="button"
                          className="hover:bg-muted w-full p-2 text-left"
                          onClick={() => {
                            posicionar(r.coords)
                            setResultadosBusca([])
                          }}
                        >
                          {r.nome}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {aviso && (
                  <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">{aviso}</p>
                )}

                <div className="bg-muted/50 space-y-1 rounded-md p-2 text-xs">
                  {rascunho.coords ? (
                    <>
                      <p>
                        <span className="text-muted-foreground">Ponto:</span>{' '}
                        <span className="font-mono">{formatarCoords(rascunho.coords)}</span>
                        {ajustado && <Badge variant="secondary" className="ml-2">ajustado</Badge>}
                      </p>
                      <p className="text-muted-foreground">
                        Clique no mapa ou arraste o marcador vermelho para ajustar.
                      </p>
                      <div className="flex gap-3 pt-1">
                        {ajustado && (
                          <button type="button" className="inline-flex items-center gap-1 underline"
                            onClick={() => rascunho.coordsOrigem && ajustar(rascunho.coordsOrigem)}>
                            <Undo2 className="size-3" /> Voltar ao ponto original
                          </button>
                        )}
                        <button type="button" className="text-destructive underline"
                          onClick={() => setRascunho({ ...rascunho, coords: null, coordsOrigem: null })}>
                          Remover localização
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      Sem localização. Cole um link, busque um endereço ou <strong>clique no mapa</strong>.
                    </p>
                  )}
                </div>
              </div>

              {/* 2. Dados */}
              <form onSubmit={salvar} className="space-y-2">
                <p className="text-sm font-medium">2. Dados</p>
                <Input
                  value={rascunho.nome}
                  onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                  placeholder="Nome do polo"
                  maxLength={100}
                  required
                  aria-label="Nome do polo"
                />
                <Input
                  value={rascunho.bairro}
                  onChange={(e) => setRascunho({ ...rascunho, bairro: e.target.value })}
                  placeholder="Bairro"
                  maxLength={100}
                  aria-label="Bairro"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={rascunho.aproximado}
                    onChange={(e) => setRascunho({ ...rascunho, aproximado: e.target.checked })}
                    className="accent-primary size-4"
                  />
                  Localização aproximada
                </label>
                <Button type="submit" className="w-full" disabled={salvando || rascunho.nome.trim().length < 2}>
                  {salvando && <Loader2 className="animate-spin" />}
                  {rascunho.id ? 'Salvar alterações' : 'Adicionar polo'}
                </Button>
              </form>
            </section>
          ) : (
            <section className="p-4">
              <Button onClick={novo} className="w-full">
                <Plus /> Adicionar polo
              </Button>
            </section>
          )}

          <section className="border-t p-2">
            <p className="text-muted-foreground px-2 py-1 text-xs">
              {carregando ? 'Carregando…' : `${polos.filter((p) => !p.removido).length} polos ativos`}
            </p>
            <ul>
              {polos.map((p) => (
                <li
                  key={p.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md p-2 text-sm',
                    rascunho?.id === p.id && 'bg-muted',
                    p.removido && 'opacity-50',
                  )}
                >
                  <MapPin className="text-primary size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate font-medium', p.removido && 'line-through')}>{p.nome}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {p.bairro || '—'}
                      {!p.coords && ' · sem local'}
                    </span>
                  </span>
                  {p.removido ? (
                    <Button variant="ghost" size="icon-sm" onClick={() => restaurar(p)} aria-label={`Restaurar ${p.nome}`}>
                      <RotateCcw />
                    </Button>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon-sm" onClick={() => editar(p)} aria-label={`Editar ${p.nome}`}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => remover(p)} aria-label={`Remover ${p.nome}`}>
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>

      <main className="relative min-h-0 flex-1">
        <Map center={SAO_LUIS_CENTER} zoom={12.3}>
          <MapControls position="bottom-right" showZoom showFullscreen />
          <CliqueNoMapa ativo={rascunho !== null} onClique={ajustar} />
          <VoarPara alvo={voo} />

          {polos
            .filter((p) => p.coords && !p.removido && p.id !== rascunho?.id)
            .map((p) => (
              <MapMarker key={p.id} longitude={p.coords![0]} latitude={p.coords![1]}>
                <MarkerContent>
                  <div
                    className={cn(
                      'size-3 rounded-full border-2 border-white shadow',
                      p.aproximado ? 'bg-amber-500' : 'bg-blue-600',
                      rascunho && 'opacity-40',
                    )}
                  />
                </MarkerContent>
                <MarkerTooltip>{p.nome}</MarkerTooltip>
              </MapMarker>
            ))}

          {/* Prévia do ponto em edição: arraste ou clique no mapa para mover */}
          {rascunho?.coords && (
            <MapMarker
              longitude={rascunho.coords[0]}
              latitude={rascunho.coords[1]}
              draggable
              onDragEnd={({ lng, lat }) => ajustar([lng, lat])}
            >
              <MarkerContent>
                <div className="relative flex size-6 items-center justify-center">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-50" />
                  <span className="relative size-4 rounded-full border-2 border-white bg-red-600 shadow-lg" />
                </div>
                <MarkerLabel position="bottom" className="rounded bg-red-600 px-1.5 py-0.5 text-white">
                  {rascunho.nome.trim() || 'Novo polo'} · prévia
                </MarkerLabel>
              </MarkerContent>
            </MapMarker>
          )}
        </Map>

        {rascunho && (
          <div className="bg-background/90 pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-md border px-3 py-1.5 text-xs shadow-sm backdrop-blur">
            Clique no mapa para {rascunho.coords ? 'mover' : 'posicionar'} o ponto
          </div>
        )}
      </main>
    </div>
  )
}

export default function Admin() {
  const [estado, setEstado] = useState<'verificando' | 'fora' | 'dentro'>('verificando')

  useEffect(() => {
    adminApi
      .sessao()
      .then((s) => setEstado(s.autenticado ? 'dentro' : 'fora'))
      .catch(() => setEstado('fora'))
  }, [])

  if (estado === 'verificando') {
    return (
      <div className="bg-background flex min-h-dvh items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }
  if (estado === 'fora') return <Login onEntrar={() => setEstado('dentro')} />
  return <Painel onSair={() => setEstado('fora')} />
}
