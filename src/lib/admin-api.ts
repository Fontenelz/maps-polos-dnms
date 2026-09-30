import type { LngLat } from '@/lib/geo'
import type { Polo } from '@/lib/polos'

export type PoloAdmin = Polo & { removido: boolean; atualizadoEm: string }

export type DadosPolo = {
  nome: string
  bairro: string
  coords: LngLat | null
  aproximado: boolean
}

export class ErroApi extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(caminho, {
    ...init,
    credentials: 'same-origin',
    headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
  })
  const corpo = await res.json().catch(() => null)
  if (!res.ok) {
    const detalhes = corpo?.detalhes?.map((d: { campo: string | null; mensagem: string }) =>
      d.campo ? `${d.campo}: ${d.mensagem}` : d.mensagem,
    )
    throw new ErroApi([corpo?.erro ?? `Erro ${res.status}`, ...(detalhes ?? [])].join(' · '), res.status)
  }
  return corpo as T
}

export const adminApi = {
  sessao: () => chamar<{ autenticado: boolean }>('/api/auth/sessao'),
  login: (senha: string) => chamar<{ ok: true }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ senha }) }),
  logout: () => chamar<{ ok: true }>('/api/auth/logout', { method: 'POST' }),

  listar: () => chamar<PoloAdmin[]>('/api/admin/polos'),
  criar: (dados: DadosPolo) => chamar<Polo>('/api/admin/polos', { method: 'POST', body: JSON.stringify(dados) }),
  editar: (id: string, dados: Partial<DadosPolo>) =>
    chamar<Polo>(`/api/admin/polos/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(dados) }),
  remover: (id: string) => chamar<{ ok: true }>(`/api/admin/polos/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  restaurar: (id: string) =>
    chamar<Polo>(`/api/admin/polos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ restaurar: true }),
    }),

  lerGoogleMaps: (url: string) =>
    chamar<{ coords: LngLat; nome: string | null; fonte: 'google' | 'busca'; dentroDaIlha: boolean }>(
      `/api/admin/google-maps?url=${encodeURIComponent(url)}`,
    ),
  geocodificar: (q: string) =>
    chamar<{ nome: string; coords: LngLat }[]>(`/api/admin/geocodificar?q=${encodeURIComponent(q)}`),
}
