import { z } from 'zod'

// Retângulo que cobre a Ilha de São Luís (São Luís, São José de Ribamar, Paço do Lumiar, Raposa).
// Evita pontos fora da região — incluindo o erro clássico de trocar latitude e longitude.
export const LIMITES = { lngMin: -44.45, lngMax: -43.95, latMin: -2.8, latMax: -2.35 }

const texto = (min: number, max: number) =>
  z
    .string()
    .trim()
    // remove caracteres de controle e < > (defesa extra contra HTML injetado)
    // eslint-disable-next-line no-control-regex
    .transform((s) => s.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' '))
    .pipe(z.string().min(min).max(max))

const coords = z
  .tuple([
    z.number().min(LIMITES.lngMin).max(LIMITES.lngMax),
    z.number().min(LIMITES.latMin).max(LIMITES.latMax),
  ])
  .nullable()

export const coordsSchema = coords

const googleMapsUrl = z.string().trim().url().max(2000)

const camposPolo = z
  .object({
    nome: texto(2, 100),
    bairro: texto(0, 100),
    /** [longitude, latitude] dentro da Ilha de São Luís, ou null se ainda sem local */
    coords,
    /** Alternativa a `coords`: link do Google Maps de onde as coordenadas são extraídas */
    googleMapsUrl,
    aproximado: z.boolean(),
  })
  .strict()

export const novoPoloSchema = camposPolo
  .partial({ nome: true, coords: true, googleMapsUrl: true })
  .extend({ bairro: camposPolo.shape.bairro.default(''), aproximado: z.boolean().default(false) })
  .refine((d) => !(d.coords !== undefined && d.googleMapsUrl), 'Envie coords ou googleMapsUrl, não os dois')
  .refine((d) => d.nome || d.googleMapsUrl, { message: 'Informe o nome', path: ['nome'] })

export const edicaoPoloSchema = camposPolo
  .partial()
  .extend({ restaurar: z.literal(true).optional() })
  .strict()
  .refine((d) => Object.keys(d).length > 0, 'Nada para alterar')
  .refine((d) => !(d.coords !== undefined && d.googleMapsUrl), 'Envie coords ou googleMapsUrl, não os dois')

export const loginSchema = z.object({ senha: z.string().min(1).max(200) }).strict()

/** Mensagens de erro legíveis para o cliente */
export function errosDeValidacao(erro: z.ZodError) {
  return erro.issues.map((i) => ({ campo: i.path.join('.') || null, mensagem: i.message }))
}
