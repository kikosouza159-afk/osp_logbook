# OSP Logbook

Diário de bordo operacional da OLOS para registrar e acompanhar ocorrências de **Locator**, **ADA** e produtos futuros.

## Funcionalidades do MVP

- Login seguro com sessão HttpOnly.
- Dashboard diário com cards de volume, abertos, tratativas, aguardando retorno, resolvidos, clientes impactados, Locator e ADA.
- Diário de bordo do dia.
- Cadastro e filtro de incidentes.
- Incidente relacionado a um ou vários produtos.
- ID e link de chamado externo.
- Prioridade, status e analista responsável.
- Cadastro de clientes e relacionamento cliente x produto.
- Cadastro de analistas e relacionamento analista x cliente.
- Respostas múltiplas por chamado, sem sobrescrever histórico.
- Timeline de movimentações.
- Auditoria de operações.
- Health check em `/api/health`.

## Stack

- Next.js 16
- React 19
- TypeScript
- PostgreSQL / Neon
- node-postgres (`pg`)
- Zod
- bcryptjs
- jose
- Lucide Icons

## Variáveis de ambiente

Copie `.env.example` para `.env.local`:

```bash
DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://.../neondb?sslmode=require"
SESSION_SECRET="uma-chave-longa-e-aleatoria"
ADMIN_INITIAL_PASSWORD="admin123"
NEXT_PUBLIC_APP_NAME="OSP Logbook"
```

`DATABASE_URL` deve usar a conexão pooled para o tráfego normal da aplicação. `DATABASE_URL_UNPOOLED` deve usar conexão direta para migrations.

Nunca versionar arquivos `.env`.

## Instalação local

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Acesse `http://localhost:3000`.

Primeiro acesso:

- Usuário: `admin`
- Senha inicial: valor de `ADMIN_INITIAL_PASSWORD` (por padrão `admin123`)

A senha é armazenada apenas como hash bcrypt.

## Banco e migrations

As migrations ficam em `db/migrations`.

O runner `scripts/migrate.mjs` mantém a tabela `schema_migrations` e grava um checksum. Uma migration já aplicada não pode ser alterada silenciosamente. Para mudanças futuras, crie um novo arquivo SQL sequencial.

```bash
npm run db:migrate
npm run db:seed
```

O seed é idempotente para produtos, status, prioridades e criação inicial do administrador.

## Deploy no Render

O repositório contém `render.yaml` e também pode ser criado manualmente como Web Service.

Configuração:

- Runtime: Node
- Branch: `main`
- Build: `npm install --no-audit --no-fund && npm run build`
- Start: `npm run start:render`
- Health check: `/api/health`

Variáveis obrigatórias no Render:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `SESSION_SECRET`
- `ADMIN_INITIAL_PASSWORD`
- `NODE_ENV=production`

O `start:render` aplica migrations pendentes, executa o seed idempotente e inicia o Next.js.

## Estrutura

```text
src/app                 Rotas e páginas
src/app/actions.ts      Server Actions / mutações
src/components          Componentes visuais
src/lib/auth.ts         Sessão e autorização
src/lib/db.ts           Pool PostgreSQL
src/lib/queries.ts      Consultas de leitura
src/lib/audit.ts        Auditoria
db/migrations           Schema versionado
scripts                 Migration runner e seed
```

## Segurança

- Cookies HttpOnly, Secure em produção e SameSite=Lax.
- Senhas com bcrypt.
- Sessões assinadas com `SESSION_SECRET`.
- Queries parametrizadas.
- Autorização validada no servidor.
- Segredos somente em variáveis de ambiente.
- O health check não expõe credenciais.

## Modelo escalável

Clientes e produtos usam relacionamento N:N. Incidentes também usam N:N com produtos. Isso permite adicionar produtos como WAY, Voice, Text e Agent IA sem criar novas colunas estruturais no banco.

## Próximas evoluções sugeridas

- Alteração obrigatória da senha no primeiro login.
- Upload de anexos e screenshots.
- SLA e tempo em cada status.
- Notificações e integração Teams/e-mail.
- Webhook/API da ferramenta de chamados.
- Relatório diário automático.
- IA para resumo, classificação e reincidência de incidentes.
