// Gera as credenciais do painel e da API.
// Uso: node scripts/gerar-credenciais.ts
// Mostra a senha e a chave UMA vez; na Vercel ficam só os hashes (ADMIN_PASSWORD_HASH, ADMIN_API_KEY_HASH).
import { createHash, randomBytes, scryptSync } from 'node:crypto'

const N = 2 ** 15
const palavras = () => randomBytes(15).toString('base64url') // ~120 bits

const senha = process.argv[2] ?? palavras()
if (senha.length < 12) throw new Error('A senha precisa ter pelo menos 12 caracteres')
const salt = randomBytes(16)
const hashSenha = scryptSync(senha, salt, 32, { N, maxmem: 256 * 1024 * 1024 })

const chaveApi = `mpk_${randomBytes(32).toString('base64url')}`

console.log(JSON.stringify({
  senha,
  chaveApi,
  env: {
    ADMIN_PASSWORD_HASH: `scrypt$${N}$${salt.toString('base64')}$${hashSenha.toString('base64')}`,
    ADMIN_API_KEY_HASH: createHash('sha256').update(chaveApi).digest('hex'),
    SESSION_SECRET: randomBytes(32).toString('base64url'),
  },
}, null, 2))
