import { useEffect, useMemo, useState } from 'react'
import { MapPin, Search } from 'lucide-react'
import {
  Map,
  MapControls,
  MapMarker,
  MapPopup,
  MarkerContent,
  MarkerLabel,
  MarkerTooltip,
  useMap,
} from '@/components/ui/map'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { polos, SAO_LUIS_CENTER, type Polo } from '@/data/polos'

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function FlyTo({ polo }: { polo: Polo | null }) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (map && isLoaded && polo?.coords) {
      map.flyTo({ center: polo.coords, zoom: 15, duration: 1200 })
    }
  }, [map, isLoaded, polo])
  return null
}

export default function App() {
  const [busca, setBusca] = useState('')
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim())
    if (!termo) return polos
    return polos.filter((p) => normalizar(`${p.nome} ${p.bairro}`).includes(termo))
  }, [busca])

  const selecionado = polos.find((p) => p.id === selecionadoId) ?? null
  const noMapa = filtrados.filter((p) => p.coords)

  return (
    <div className="bg-background text-foreground flex h-dvh flex-col md:flex-row">
      <aside className="flex max-h-[40dvh] w-full shrink-0 flex-col border-b md:max-h-none md:w-80 md:border-r md:border-b-0">
        <header className="space-y-3 border-b p-4">
          <div>
            <h1 className="text-lg font-semibold">Polos · São Luís</h1>
            <p className="text-muted-foreground text-sm">
              {polos.length} polos · {polos.filter((p) => p.coords).length} no mapa
            </p>
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
        </header>
        <ul className="flex-1 overflow-y-auto p-2">
          {filtrados.map((polo) => (
            <li key={polo.id}>
              <button
                type="button"
                disabled={!polo.coords}
                onClick={() => setSelecionadoId(polo.id)}
                className={cn(
                  'hover:bg-muted flex w-full items-start gap-2 rounded-md p-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  selecionadoId === polo.id && 'bg-muted',
                )}
              >
                <MapPin className="text-primary mt-0.5 size-4 shrink-0" />
                <span className="flex-1">
                  <span className="block font-medium">{polo.nome}</span>
                  <span className="text-muted-foreground block text-xs">{polo.bairro}</span>
                </span>
                {!polo.coords ? (
                  <Badge variant="outline">sem local</Badge>
                ) : polo.aproximado ? (
                  <Badge variant="secondary">aprox.</Badge>
                ) : null}
              </button>
            </li>
          ))}
          {filtrados.length === 0 && (
            <li className="text-muted-foreground p-4 text-center text-sm">Nenhum polo encontrado.</li>
          )}
        </ul>
      </aside>

      <main className="relative flex-1">
        <Map center={SAO_LUIS_CENTER} zoom={12.3}>
          <MapControls position="bottom-right" showZoom showCompass showLocate showFullscreen />
          <FlyTo polo={selecionado} />

          {noMapa.map((polo) => (
            <MapMarker
              key={polo.id}
              longitude={polo.coords![0]}
              latitude={polo.coords![1]}
              onClick={() => setSelecionadoId(polo.id)}
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
        </div>
      </main>
    </div>
  )
}
