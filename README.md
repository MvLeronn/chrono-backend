# Chrono Backend

API pessoal de calendário, eventos e tarefas. Inclui login somente por senha, modelos de semana, recorrências com adaptação de datas e acompanhamento de cada ocorrência. Apenas backend.

## Requisitos

- Node.js 22.12+ (validado com Node.js 24).
- Yarn 4, pela versão fixada em `package.json`.
- PostgreSQL. O `compose.yml` fornece uma instância local PostgreSQL 17 opcional.

## Executar localmente

```powershell
corepack enable
yarn install
Copy-Item .env.example .env
```

Edite `.env` e defina:

- `DATABASE_URL`: sua conexão PostgreSQL.
- `JWT_SECRET`: segredo próprio e aleatório de pelo menos 32 caracteres.
- `ADMIN_PASSWORD`: senha inicial, com pelo menos 12 caracteres e no máximo 72 bytes UTF-8.
- `CORS_ORIGINS`: origens permitidas, separadas por vírgula.

Os valores `replace-...` do exemplo devem ser substituídos. Para gerar um segredo JWT localmente:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Se usar o banco fornecido pelo projeto:

```powershell
docker compose up -d
```

Depois:

```powershell
yarn prisma:generate
yarn prisma:deploy
yarn seed:admin
yarn dev
```

Por padrão, a API escuta em `http://127.0.0.1:3000`. `GET /health` confirma que o servidor está ativo. O servidor conecta ao banco antes de começar a escutar.

O seed é idempotente: não sobrescreve a senha de um usuário existente. O banco também impede que seja cadastrado um segundo proprietário.

## Autenticação

Envie `POST /auth/login` com `{ "password": "sua senha" }`. Use o token retornado em `Authorization: Bearer <token>` nas rotas privadas. O token expira conforme `JWT_EXPIRES_IN_SECONDS`; após expirar, faça login novamente.

Para redefinir a senha, altere `ADMIN_PASSWORD` localmente e execute:

```powershell
yarn password:reset
```

Isso invalida os JWTs anteriores. Não existe cadastro público, fluxo de e-mail ou refresh token. Conforme solicitado, não são usadas as dependências `helmet` e `express-rate-limit`.

## Uso pelo futuro frontend

`GET /calendar?from=2026-10-12&to=2026-11-08` retorna atividades avulsas e ocorrências calculadas para o intervalo, com todos os campos resolvidos.

- Ambas as datas são inclusivas; cada consulta aceita até 366 dias.
- É possível consultar qualquer período entre os anos 0001 e 9999.
- Datas são `YYYY-MM-DD`; horários locais são `HH:mm`. A resposta informa o fuso do planejamento.
- `calendarKey` é a identificação da atividade na interface, inclusive antes de haver ocorrência persistida.
- Consultar o calendário não cria registros de ocorrências.
- Busque o período visível e, se conveniente, semanas vizinhas; mantenha os resultados em cache na aplicação cliente.
- Após uma alteração, atualize ou invalide os períodos afetados, incluindo a data original e a nova data em um reagendamento. Uma edição de regra pode afetar todos os períodos futuros em cache.
- O cache em memória da aplicação cliente pode armazenar os períodos já carregados. A API não define uma política HTTP de cache personalizada nesta versão.
- Não são necessários polling, WebSocket, cron ou geração antecipada de anos de eventos.

## Build e verificações

```powershell
yarn typecheck
yarn test
yarn build
yarn start
```

Os testes de integração precisam de um PostgreSQL de desenvolvimento acessível e permissão de criação de schemas:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://chrono:chrono_local@localhost:15432/chrono'
yarn test:integration
```

Os testes criam um schema com nome aleatório, aplicam as migrations e removem somente esse schema ao terminar. Nunca limpam as tabelas da aplicação. Se o processo for interrompido à força, o schema temporário poderá permanecer para inspeção.

Use `yarn prisma:migrate` para criar novas migrations em desenvolvimento e `yarn prisma:deploy` para aplicar as migrations versionadas. Gere novamente o client após alterações no schema. `prisma:push` é apenas uma ferramenta de desenvolvimento e não substitui as migrations com restrições de integridade.

## Estrutura

```text
src/
  @types/       Tipos adicionais do Express
  config/       Validação da configuração de ambiente
  controllers/  Pastas por domínio, uma operação por arquivo (handle)
  domain/       Datas, recorrências e resolução das atividades
  middlewares/  Autenticação, validação e erros
  prisma/       Prisma Client centralizado
  routes/       Um arquivo por categoria, sem subpastas, e index agregador
  schemas/      Schemas Zod
  seeds/        Criação do proprietário e redefinição de senha
  services/     Pastas por domínio, um caso de uso por arquivo (execute)
  server.ts     Configuração do Express, inicialização e encerramento
prisma/
  schema.prisma
  migrations/
tests/
  unit/
  integration/
```

O projeto usa TypeScript estrito, ESM/NodeNext e imports relativos terminados em `.js`. `.env`, dependências, build, banco temporário e Prisma Client gerado não são versionados.

Exemplo de operação: `controllers/event/create-event.controller.ts` chama `services/event/create-event.service.ts`; todas as rotas de eventos ficam em `routes/event-routes.ts`. O `routes/index.ts` reúne os arquivos de categorias. Controllers e services continuam separados por domínio e operação. Helpers compartilhados de um domínio ficam em sua pasta `shared`, evitando duplicação entre casos de uso.

O servidor usa `express.json()` com o limite padrão de 100 KB do Express, sem limite personalizado. As configurações de `x-powered-by`, `trust proxy` e `Cache-Control` também não são personalizadas.

O `server.ts` exporta `createApp` para os testes. A conexão inicial e o `listen` só são executados quando esse arquivo é o ponto de entrada do processo; importar a aplicação não inicia um servidor automaticamente.

O [contrato da API](docs/api.md) contém endpoints, payloads, regras de edição e exemplos. O [plano de implementação](docs/implementation-plan.md) registra as decisões do projeto.
