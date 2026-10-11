# Contexto técnico e funcional do Chrono

Este documento registra o estado do backend inspecionado em 11/10/2026. A implementação é a fonte principal; [README.md](./README.md), [docs/api.md](./docs/api.md) e [docs/implementation-plan.md](./docs/implementation-plan.md) foram conferidos como referências complementares.

Leia [contrato.md](./contrato.md) para comportamento HTTP, validações e efeitos de cada endpoint; [models.md](./models.md) define exclusivamente os formatos públicos em TypeScript e o mapa de endpoints. Este arquivo concentra arquitetura, domínio e cuidados de manutenção.

## Propósito e domínio

Chrono é uma API de calendário pessoal para planejar e acompanhar eventos e tarefas. Existe um único proprietário, autenticado somente por senha. Não há frontend neste repositório, contas de equipes, organizações ou cadastro público.

Os conceitos centrais são:

| Conceito                  | Responsabilidade                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `User`                    | Único proprietário, hash de senha, versão dos tokens e fuso do planejamento                            |
| `Event`                   | Atividade concreta numa data; criada diretamente ou copiada de modelo semanal                          |
| `WeekTemplate`            | Definição reutilizável de semana; pode ser arquivada                                                   |
| `WeekTemplateItem`        | Conteúdo e horário de uma atividade em um weekday de segunda a domingo                                 |
| `WeekTemplateApplication` | Aplicação única de um modelo numa semana, vinculando eventos copiados                                  |
| `RecurringEvent`          | Regra de repetição e conteúdo padrão de um segmento da série                                           |
| `RecurringOccurrence`     | Estado persistido opcional de uma data original da regra: status, conclusão, reagendamento e overrides |

`EVENT`/`TASK` categorizam a atividade e não determinam seu ciclo de status. Já `source: EVENT/RECURRING`, usado nas respostas, distingue registro concreto de ocorrência calculada. Uma tarefa copiada de modelo continua sendo `source: EVENT`.

O calendário não mantém tabelas de dia, semana, mês ou ano. Dias sem atividades não precisam ser cadastrados. Não existe uma tabela separada de exceções: `RecurringOccurrence` concentra estado e personalizações.

## Stack e organização

Stack declarada em [package.json](./package.json): Node.js >=22.12.0, Yarn 4.13.0, TypeScript 5, Express 5, Zod 4, Prisma 7 com `@prisma/adapter-pg`/`pg`, PostgreSQL, `bcryptjs`, `jsonwebtoken`, `cors` e `dotenv`. O [compose.yml](./compose.yml) oferece PostgreSQL 17 local. `tsx`, `node:test`, Supertest e Prettier são ferramentas de desenvolvimento. As versões completas resolvidas estão em `yarn.lock`; as dependências do manifesto usam faixas em vários casos.

TypeScript usa modo estrito, `noUncheckedIndexedAccess`, ESM/NodeNext, alvo ES2023 e imports relativos com extensão `.js`. Não há framework de injeção de dependências, camada repository separada ou ORM adicional.

Fluxo predominante: **rotas → autenticação/validação → controller → service → Prisma**, com helpers de domínio. O Express 5 encaminha rejeições dos handlers assíncronos ao tratamento global de erros.

| Caminho                                                                                    | Responsabilidade                                                                                          |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| [src/server.ts](./src/server.ts)                                                           | `createApp`, CORS, parser JSON, rotas, fallback 404, erros, conexão inicial, listen e desligamento        |
| [src/config/env.ts](./src/config/env.ts)                                                   | Carrega `.env` e valida configuração com Zod, sem imprimir segredos                                       |
| [src/routes](./src/routes/)                                                                | Arquivos por módulo e agregador `index.ts`; define middlewares e endpoints                                |
| [src/controllers](./src/controllers/)                                                      | Uma operação por arquivo/classe, método `handle`; extrai entradas validadas e define resposta/status HTTP |
| [src/services](./src/services/)                                                            | Uma operação por arquivo/classe, método `execute`; negócio, consultas e transações                        |
| [src/services/shared](./src/services/shared/)                                              | Transação com retry e advisory locks PostgreSQL                                                           |
| [src/domain](./src/domain/)                                                                | Datas civis, expansão de recorrências, resolução/serialização e erros da aplicação                        |
| [src/schemas](./src/schemas/)                                                              | Schemas Zod de body, params, query e tipos internos inferidos                                             |
| [src/middlewares](./src/middlewares/)                                                      | JWT, validação em `req.validated`, acesso a `req.userId` e respostas de erro                              |
| [src/@types/express/index.d.ts](./src/@types/express/index.d.ts)                           | Extensão da Request com dados de autenticação/validação                                                   |
| [src/prisma/index.ts](./src/prisma/index.ts)                                               | Instância central de Prisma com adapter PostgreSQL e schema da URL                                        |
| `src/generated/prisma/`                                                                    | Client Prisma gerado; não editar manualmente, ignorado pelo `.gitignore`                                  |
| [src/seeds](./src/seeds/)                                                                  | Criação idempotente do proprietário e redefinição administrativa de senha                                 |
| [prisma/schema.prisma](./prisma/schema.prisma) e [prisma/migrations](./prisma/migrations/) | Modelo persistido e evolução SQL, inclusive checks não representados integralmente no schema              |
| [tests/unit](./tests/unit/) e [tests/integration](./tests/integration/)                    | Testes de domínio e API/banco                                                                             |
| [docs](./docs/)                                                                            | Contrato anterior e planejamento histórico                                                                |
| `dist/`, `node_modules/`, `.yarn/`, `tmp/`                                                 | Build, dependências e artefatos locais; não são fonte do contrato                                         |

Helpers específicos de recorrências/modelos ficam em suas pastas `shared`. Controllers instanciam os services diretamente; a persistência é acessada pelos services, não pelos controllers.

## Configuração e ciclo do processo

| Variável                 | Uso e validação                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`               | `development`, `test` ou `production`; padrão `development`                                                   |
| `HOST` / `PORT`          | Padrões `127.0.0.1` e 3000; porta inteira 1–65535                                                             |
| `DATABASE_URL`           | Obrigatória, URL `postgres:`/`postgresql:`; parâmetro `schema` consumido pelo adapter, padrão `public`        |
| `JWT_SECRET`             | Obrigatório, pelo menos 32 caracteres; rejeita prefixo `replace-`                                             |
| `JWT_EXPIRES_IN_SECONDS` | 60–2592000 segundos; padrão 86400                                                                             |
| `TIMEZONE`               | Validado por `Intl.DateTimeFormat`; padrão `America/Sao_Paulo`; usado para criar o proprietário               |
| `CORS_ORIGINS`           | Lista separada por vírgulas; padrão `http://localhost:5173`                                                   |
| `ADMIN_PASSWORD`         | Lida pelos scripts de seed/reset; mínimo 12 caracteres, máximo 72 bytes UTF-8; rejeita placeholder `replace-` |
| `TEST_DATABASE_URL`      | Usada na execução dos testes de integração; não é configuração obrigatória da API                             |

Alterar `TIMEZONE` no ambiente depois do seed não atualiza o usuário existente: serviços usam o fuso persistido. Não há endpoint público de mudança desse fuso. `ADMIN_PASSWORD` também não troca automaticamente uma senha existente ao iniciar a API ou repetir o seed.

Configuração inicial e comandos detalhados estão no [README](./README.md). A sequência de preparação é instalar dependências com Yarn, configurar `.env`, disponibilizar PostgreSQL, executar `yarn prisma:generate`, `yarn prisma:deploy` e `yarn seed:admin`; depois `yarn dev` ou `yarn build`/`yarn start`. [prisma.config.ts](./prisma.config.ts) configura migrations e seed; seu fallback local de URL não elimina a obrigatoriedade de `DATABASE_URL` na aplicação.

`createApp` pode ser importada sem iniciar listener. Quando `server.ts` é o ponto de entrada, conecta ao banco antes de escutar. Em SIGINT/SIGTERM, fecha o servidor, desconecta Prisma e usa limite de 10 segundos para terminar. `/health` responde disponibilidade HTTP sem consultar o banco a cada chamada.

`.yarnrc.yml` usa `node-modules`, hardened mode, checagem de checksum, scripts de dependências desabilitados e age gate do registro. Essas configurações fazem parte da instalação atual; não inferem uma infraestrutura de produção.

## Autenticação, autorização e isolamento

O proprietário é selecionado por `singletonKey = 1`. A unicidade desse campo somada ao check SQL que exige valor 1 impede um segundo proprietário quando as migrations completas são aplicadas. Não existem papéis administrativos diferentes: o nome `seed:admin` corresponde à criação do único usuário.

O seed usa bcrypt com custo 12 e preserva usuário/senha existentes. Login compara a senha com o hash; se não houver usuário, ainda faz comparação contra hash dummy antes de rejeitar. O JWT contém subject e versão, usa HS256, issuer/audience fixos e expiração. O middleware consulta o usuário e compara `tokenVersion` em cada chamada. `password:reset` atualiza hash e incrementa a versão, invalidando tokens anteriores.

As operações de eventos, modelos e regras filtram pelo `userId` autenticado. Ocorrências são acessadas após conferir a regra proprietária; aplicações após conferir o modelo proprietário. Registro ausente/de outro proprietário resulta em 404. Não há seleção de `userId` pelo cliente, row-level security declarada ou uma arquitetura de múltiplos tenants; a proteção implementada está nos services e no usuário único do banco.

Senha/hash e campos de controle do usuário não são expostos pelo login/me. Entretanto, regras e modelos usam spreads de entidades e retornam `userId`; itens de modelo retornam `templateId`. Isso é parte do formato atual e está documentado em [models.md](./models.md).

## Módulos e fluxos implementados

### Eventos e status

Um evento concreto pode ser criado, consultado por ID/período, alterado parcialmente ou excluído fisicamente. Eventos na mesma data/horário são permitidos. A origem opcional de modelo não impede edições posteriores independentes.

Os quatro status são `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELED`; qualquer transição explícita entre eles é aceita. Conclusão é independente de categoria ou data. A invariância é `status = COMPLETED` se e somente se `completedAt` não for nulo. Repetir conclusão preserva o instante; reabrir limpa; reconcluir gera novo instante. Cancelar mantém a atividade disponível nas consultas; excluir remove o registro.

### Modelos semanais

Criar/editar um modelo não produz atividades. A aplicação numa segunda-feira copia seus itens como eventos pendentes nas datas daquela semana. A operação é aditiva e transacional; a unicidade de modelo/semana impede duplicação inclusive sob concorrência.

Depois da aplicação, cópias vivem independentemente do modelo. Alterar os itens não propaga conteúdo; reaplicar devolve os eventos atuais restantes, sem recriar os apagados. Substituir itens gera novos IDs de itens. Modelos vazios são aceitos e também podem registrar aplicação. Arquivar remove o modelo das operações públicas, mas preserva aplicações/eventos. Não há desarquivamento público.

### Recorrências e identidade

Uma série consiste em um ou mais segmentos `RecurringEvent`, com `seriesId` comum e encadeamento por `previousId`. `startDate` é a âncora matemática; `effectiveFrom`/`effectiveUntil` delimitam onde um segmento vale. Não são conceitos intercambiáveis.

O motor [recurrence.ts](./src/domain/recurrence.ts) calcula períodos a partir da âncora, localiza diretamente um índice próximo do intervalo solicitado e expande só as datas necessárias. Frequências diária/semanal contam dias; mensal/anual calculam meses/anos civis. `LAST_VALID_DAY` adapta datas inexistentes sem deslocar a âncora permanentemente. Semanal representa apenas o weekday da âncora, não uma lista de dias.

`until` é inclusivo e `count` conta posições da regra, inclusive canceladas, concluídas e reagendadas. Os dois não podem ser não nulos simultaneamente. Concluir uma ocorrência não altera as seguintes nem a frequência.

`occurrenceDate` é a data válida original calculada, depois da adaptação de calendário. O estado salvo pode apontar `scheduledDate` diferente; a resposta o apresenta como `date`. A identidade visual é `recurring:<seriesId>:<occurrenceDate>`, mesmo sem registro persistido. Para a operação HTTP, ainda é necessário o ID do segmento atual.

### Personalização, divisão e encerramento

Ler uma ocorrência não a materializa. Um PATCH faz upsert do estado único e a resposta combina seus overrides com a regra. Nulo significa herdar para tipo, título e descrição; descrição vazia significa conteúdo explicitamente vazio. O indicador interno `hasTimeOverride` distingue herança de uma ocorrência deliberadamente sem horários. DELETE de estado apaga todas as personalizações, reagendamento e conclusão, restaurando a ocorrência virtual pendente.

Split aplica “esta e as próximas”: limita o segmento anterior ao dia precedente e cria continuação. Alterar só conteúdo preserva a âncora; mudar a sequência ou fornecer `startDate` explicitamente pode criar nova âncora. Estados de datas originais futuras compatíveis migram; incompatíveis retornam conflito e provocam rollback. Conteúdo de estados concluídos migrados é congelado. O contrato detalha as particularidades de contagem e término, evitando que o consumidor reimplemente esse algoritmo.

End limita a geração de datas originais a partir de um dia escolhido, sem apagar histórico. Estados a partir do limite bloqueiam a operação; estados anteriores reagendados para depois dele permanecem. Não existe reabertura pública da regra.

Split/end só aceitam hoje ou futuro no fuso persistido. A proteção não se aplica à edição/reset individual de ocorrências, que pode alterar passado. Portanto, “histórico preservado” significa que operações em série não o reescrevem implicitamente; não é um log imutável de auditoria.

### Consulta unificada

O calendário lê eventos, segmentos relevantes e estados salvos numa transação `RepeatableRead`; resolve herança, substitui ocorrências alteradas e filtra pela data de exibição. Movidos de fora para dentro entram; movidos para fora não deixam duplicata pendente na data original. Cancelados e concluídos continuam retornando.

Não há geração antecipada, cron, fila, WebSocket, polling de servidor ou sincronização externa. Intervalos são limitados a 366 dias, mas podem navegar pelos anos 0001–9999. O número total de itens por intervalo não possui teto independente. A expansão virtual evita persistir anos inteiros de ocorrências.

## Persistência, concorrência e serialização

PostgreSQL armazena UUIDs, enums, datas em `DATE`, horários locais em `TIME(0)` e instantes em `TIMESTAMPTZ(3)`. Helpers usam componentes UTC para manipular as datas civis sem dependência do fuso do processo; isso não transforma os horários locais de planejamento em instantes UTC. `today(timezone)` usa `Intl` para a proteção do histórico.

Migrations implementam:

- Unicidade de proprietário, aplicação `(templateId, weekStart)`, ocorrência `(recurringEventId, occurrenceDate)` e continuação por `previousId`.
- Checks de horário, status/conclusão, weekday, início de semana, intervalo/contagem positivos e exclusão mútua de término.
- FKs predominantemente `RESTRICT`, preservando vínculos históricos. Itens de modelo usam `CASCADE` na exclusão do pai; o endpoint público arquiva o pai.
- Índices por proprietário/data de evento, proprietário/arquivo de modelo, proprietário/início efetivo, série, data reagendada e relações de aplicação/itens.

Os checks SQL não cobrem todas as regras Zod/domain, como limites máximos das entradas ou validade de uma data de ocorrência perante sua regra. Escrita direta no banco não equivale a executar o service.

O helper [transaction.ts](./src/services/shared/transaction.ts) usa `ReadCommitted`, `maxWait` de 10 segundos, timeout de 20 segundos e até três retries adicionais para Prisma P2034. [lock.ts](./src/services/shared/lock.ts) usa `pg_advisory_xact_lock(hashtextextended(...))` com chaves por evento, modelo ou segmento. Updates de eventos, edição/arquivamento/aplicação de modelos e operações transacionais de ocorrências/séries leem depois de adquirir o lock correspondente. A consulta individual de ocorrência também usa o lock da regra.

Não generalizar esse mecanismo para todas as operações: criação de eventos/regras, exclusão de eventos e várias leituras não usam esse helper. Listas paginadas executam consulta e contagem numa transação sem isolamento explicitamente configurado; não têm a mesma garantia explícita de snapshot do calendário. Não há versionamento otimista por payload ou prevenção de sobrescrita entre edições do mesmo campo além da serialização das operações protegidas.

[activity.ts](./src/domain/activity.ts) define três formatos distintos: seleção explícita para evento, objeto resolvido para ocorrência e spread de regra com transformação de datas/horários. Modelos/itens também usam spread no serializer próprio. `Date` de instante é convertido pelo JSON do Express; datas civis e horários recebem formatação explícita.

## Manutenção e verificações disponíveis

- `yarn typecheck` valida fontes e testes; `yarn build` compila para `dist`; `yarn check` é alias de typecheck. Não há script ESLint; `format:check` verifica Prettier.
- `yarn test` executa testes existentes de recorrência/datas/conclusão com `node:test` via tsx.
- `yarn test:integration` usa PostgreSQL, migrations e Supertest; cria schema isolado e remove esse schema ao terminar. Precisa de configuração e permissão apropriadas, podendo deixar schema temporário se interrompido à força.
- Testes existentes cobrem autenticação, intervalos/datas inválidos, calendário sem escrita, reagendamento, aplicação concorrente/idempotente, updates concorrentes, split/conflitos e invalidação de JWT no reset. A presença desses testes não é confirmação de execução nesta análise documental.
- Ao mudar o schema, criar migration, aplicar as migrations e regenerar o client. `prisma:push` não substitui a migration de integridade, que contém checks SQL adicionais.
- Ao adicionar campo persistido a regra/modelo/item, conferir o spread do serializer antes de assumir que o campo é privado. Ao mudar uma rota, revisar os três documentos, com detalhes HTTP e tipos em seus arquivos próprios.

## Limitações, lacunas e divergências confirmadas

1. **Documentação anterior simplifica formatos e validação.** `docs/api.md` resume bem o domínio, mas não enumera todos os campos/status por operação. A rejeição de campos desconhecidos não se aplica aos handlers de health/me. Calendário e lista de eventos diferem no tratamento da ordem de horários nulos; reaplicação de modelo não define ordem.
2. **Timestamps variam por entidade.** A menção genérica do plano a `createdAt`/`updatedAt` não define os campos de cada entidade: `WeekTemplateItem` não tem timestamps e `WeekTemplateApplication` tem `appliedAt`. Os tipos públicos precisam respeitar essas diferenças.
3. **“Lista uniforme” é apenas funcional.** Ocorrências e eventos compartilham campos resolvidos, mas têm identidades/metadados diferentes. Regras/modelos retornam identificadores de proprietário por spread. Não há OpenAPI, SDK ou tipos públicos gerados automaticamente.
4. **A edição não recebe estado bruto.** O consumidor vê conteúdo resolvido, mas não se ele está herdado ou personalizado. Não há endpoint de overrides nem consulta dos estados salvos de uma série. Conflitos retornam datas/status para orientar ação explícita.
5. **Casos de segmentos vazios são permitidos.** Encerrar/dividir no início pode deixar `effectiveUntil < effectiveFrom`; um split também pode reduzir a contagem sem garantir ocorrência restante. No congelamento de concluídas, descrição nula passa a string vazia. Essas particularidades constam do contrato.
6. **Sem funcionalidades externas de calendário.** Não há Google Calendar, e-mail, notificações, anexos, pagamentos, importação/exportação ou webhooks. A integração externa implementada é PostgreSQL; as demais dependências executam localmente. Nada disso deve ser tratado como funcionalidade pronta ou compromisso de roadmap.
7. **Escopo pessoal e operacional limitado.** Não há rate limiting, dependências `helmet`/`express-rate-limit`, MFA, sessões revogáveis individualmente, monitoramento estruturado, configuração de proxy/TLS ou política própria de cache. CORS não substitui autenticação. A publicação/hospedagem continua uma pendência citada no planejamento, sem infraestrutura de produção confirmada aqui.
8. **Ambiente real não auditado.** A análise não verificou dados de produção, migrations aplicadas a uma instância em execução, valores de `.env`, latência ou capacidade. O diretório fornecido não possui metadados Git utilizáveis (`git status` informou que não é repositório), portanto não foi possível vincular a fotografia a um commit. Isso não impede a leitura da implementação local.

Os três documentos descrevem o comportamento encontrado; esta tarefa não altera a aplicação nem apresenta funcionalidades propostas como implementadas.
