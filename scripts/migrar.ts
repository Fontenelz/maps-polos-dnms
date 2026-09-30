// Aplica o esquema do banco e grava os polos iniciais.
// Uso: node --env-file=.env.local scripts/migrar.ts
import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'
import { polosIniciais } from '../db/polos-iniciais.ts'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL não configurada (rode `vercel env pull .env.local`)')
const sql = neon(url)

const esquema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')
for (const comando of esquema.split(';').map((c) => c.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean)) {
  await sql.query(comando)
}
console.log('Esquema aplicado.')

let inseridos = 0
for (const p of polosIniciais) {
  const r = await sql`
    INSERT INTO polos (id, nome, bairro, longitude, latitude, aproximado)
    VALUES (${p.id}, ${p.nome}, ${p.bairro}, ${p.coords?.[0] ?? null}, ${p.coords?.[1] ?? null}, ${p.aproximado ?? false})
    ON CONFLICT (id) DO NOTHING
    RETURNING id`
  inseridos += r.length
}
const [{ total }] = await sql`SELECT count(*)::int AS total FROM polos WHERE removido_em IS NULL`
console.log(`Polos iniciais inseridos: ${inseridos}. Polos ativos no banco: ${total}.`)
