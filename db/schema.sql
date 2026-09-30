-- Esquema do banco (Neon Postgres). Idempotente: pode rodar mais de uma vez.

CREATE TABLE IF NOT EXISTS polos (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome           text NOT NULL CHECK (char_length(nome) BETWEEN 2 AND 100),
  bairro         text NOT NULL DEFAULT '' CHECK (char_length(bairro) <= 100),
  -- null quando a localização ainda não foi definida
  longitude      double precision CHECK (longitude BETWEEN -180 AND 180),
  latitude       double precision CHECK (latitude BETWEEN -90 AND 90),
  aproximado     boolean NOT NULL DEFAULT false,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  criado_por     text NOT NULL DEFAULT 'sistema',
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  atualizado_por text NOT NULL DEFAULT 'sistema',
  -- exclusão lógica: o polo some do mapa mas pode ser restaurado
  removido_em    timestamptz,
  CHECK ((longitude IS NULL) = (latitude IS NULL))
);

-- Tentativas de login, para limitar força bruta
CREATE TABLE IF NOT EXISTS login_tentativas (
  id        bigserial PRIMARY KEY,
  ip        text NOT NULL,
  sucesso   boolean NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_tentativas_ip_idx ON login_tentativas (ip, criado_em);

-- Histórico de alterações (quem mudou o quê e quando)
CREATE TABLE IF NOT EXISTS auditoria (
  id        bigserial PRIMARY KEY,
  polo_id   text NOT NULL,
  acao      text NOT NULL CHECK (acao IN ('criar', 'editar', 'remover', 'restaurar')),
  autor     text NOT NULL,
  dados     jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
