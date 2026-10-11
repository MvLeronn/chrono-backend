# Chrono — plano de implementação

Status: backend implementado. Consulte `README.md` para configuração e `docs/api.md` para o contrato efetivo dos endpoints.

## Decisões confirmadas

### Acesso e tecnologia

- Aplicação pessoal, com um único usuário e entrada somente por senha.
- Sem e-mail, nome de usuário ou cadastro público.
- PostgreSQL, Prisma e `@prisma/adapter-pg`.
- Node.js, TypeScript estrito, Express, Yarn, Zod, bcryptjs e JWT, seguindo a skill `node-api-standards`.
- Senha armazenada somente como hash; JWT com expiração e proteção das rotas privadas.
- Fluxo de código: routes > controller > service > Prisma.

### Calendário e atividades

- Navegação por dias, semanas, meses e anos.
- Dias sem atividades aparecem vazios; não são previamente cadastrados no banco.
- Sem tabelas de ano, mês, semana ou dia nesta versão. Anotações gerais do dia não fazem parte do escopo inicial.
- Uma atividade avulsa tem título obrigatório, descrição opcional, data e horários opcionais.
- Várias atividades podem ocupar a mesma data e horário. Não haverá restrição de exclusividade nesses campos.
- Tipos: `EVENT` e `TASK`. O tipo categoriza a atividade e não impede a conclusão.
- Status: `PENDING`, `IN_PROGRESS`, `COMPLETED` e `CANCELED`.
- `completedAt` registra o instante da conclusão e é limpo quando a atividade deixa de estar concluída.
- Concluir uma atividade não altera automaticamente a data das próximas ocorrências.

### Modelos semanais

- O usuário pode manter diferentes modelos de semana.
- Cada modelo possui itens com dia da semana, tipo, título, descrição e horários opcionais.
- Aplicar um modelo acrescenta atividades concretas às datas da semana escolhida.
- Atividades existentes, inclusive recorrentes, são preservadas.
- As atividades copiadas são independentes: editar o modelo não modifica semanas já preenchidas.
- Repetir a mesma aplicação não deve duplicar os itens.

### Recorrências

- Frequências: diária, semanal, mensal e anual, com intervalo inteiro positivo.
- Exemplos: a cada 3 dias, a cada 2 semanas, a cada mês ou a cada ano.
- A regra contém uma data inicial e pode não ter fim, terminar em uma data ou limitar a quantidade de ocorrências.
- Meses e anos são tratados como períodos de calendário, e não como quantidades fixas de dias.
- Se a data não existir no período, usar o último dia válido do mês.
- Preservar a data de referência da regra: dia 31 volta a ser 31 nos meses que o possuem; 29 de fevereiro volta a ocorrer em 29 nos anos bissextos.
- Gerar as ocorrências apenas para o intervalo consultado, sem salvar infinitos registros futuros.
- Uma ocorrência pode ser adiada, personalizada, cancelada ou concluída independentemente das demais.

### Nome e responsabilidade da ocorrência

- Nome definitivo: `RecurringOccurrence`, substituindo `RecurringEventOccurrence`.
- `RecurringEvent` guarda a regra e os valores padrão.
- `RecurringOccurrence` guarda o estado e as personalizações de uma ocorrência; pode representar `EVENT` ou `TASK`.
- Não haverá uma tabela separada `RecurringEventException` nesta versão.
- A ocorrência herda título, descrição, tipo e horários, a menos que haja personalização.
- A API entrega os valores finais resolvidos, para o frontend não precisar combinar os registros.
- Uma descrição personalizada vazia remove a descrição somente daquela ocorrência. Valor nulo no campo de personalização significa herdar a descrição padrão.

## Padrões adotados para completar os detalhes

Estes itens foram aceitos pelo usuário após a consolidação do planejamento e adotados na implementação.

- Fuso do planejamento: `America/Sao_Paulo`; semanas começam na segunda-feira.
- Sem horários, a atividade pertence ao dia inteiro. Se houver horário final, exigir horário inicial e final posterior ao inicial, dentro do mesmo dia. Atividades atravessando a meia-noite ficam fora da primeira versão.
- Datas da API em `YYYY-MM-DD`; horários em `HH:mm`; instantes como `completedAt` em ISO 8601 UTC.
- Usar `DATE` para datas, `TIME` para horários locais e `TIMESTAMPTZ` para instantes de auditoria/conclusão.
- Status inicial `PENDING` para ambos os tipos. Reabrir uma atividade a coloca em `PENDING`; a API também permite mudar explicitamente para `IN_PROGRESS`.
- Recorrência semanal: uma ocorrência por semana selecionada, no dia da semana da data inicial. Para atividades em vários dias da semana, usar regras separadas ou o modelo semanal.
- Data final da recorrência inclusiva. Limite por quantidade conta as ocorrências da regra, incluindo as adaptadas, independentemente de conclusão ou cancelamento.
- Encerrar uma recorrência define um limite para novas ocorrências e preserva o histórico.
- Edição recorrente oferece “somente esta ocorrência” e “esta e as próximas”. A segunda opção encerra o trecho anterior e cria uma continuação vinculada à mesma série, preservando ocorrências e estados passados.
- Na divisão de uma série, tratar explicitamente as personalizações futuras: ocorrências compatíveis são migradas; alterações incompatíveis devem ser apresentadas ao usuário antes de qualquer descarte.
- Aplicar o mesmo modelo na mesma semana uma única vez. Editar o modelo depois não libera uma reaplicação automática; diferentes modelos podem ser acrescentados à mesma semana.
- Token com validade configurável e novo login ao expirar. Sem fluxo de refresh token, `express-rate-limit` ou `helmet`, conforme a escolha do usuário.
- Usuário inicial criado por seed idempotente. Redefinição de senha por comando administrativo explícito; executar novamente o seed não substitui uma senha existente.

## Modelo de dados proposto

Todas as entidades persistidas usam IDs próprios. Registros relevantes possuem `createdAt` e `updatedAt`.

| Modelo                    | Campos principais e responsabilidade                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`                    | `id`, `passwordHash`, `timezone`; representa o único proprietário                                                                                                       |
| `Event`                   | `id`, `userId`, `type`, `title`, `description`, `date`, `startTime`, `endTime`, `status`, `completedAt`, origem opcional da aplicação de modelo                         |
| `WeekTemplate`            | `id`, `userId`, `name`; modelo semanal salvo                                                                                                                            |
| `WeekTemplateItem`        | `id`, `templateId`, `weekday`, `type`, `title`, `description`, `startTime`, `endTime`                                                                                   |
| `WeekTemplateApplication` | `id`, `templateId`, `weekStart`, `appliedAt`; registra a aplicação e impede duplicações                                                                                 |
| `RecurringEvent`          | `id`, `userId`, identificador da série, `type`, `title`, `description`, `startDate`, horários padrão, `frequency`, `interval`, término opcional e política de adaptação |
| `RecurringOccurrence`     | `id`, `recurringEventId`, `occurrenceDate`, `scheduledDate`, `status`, `completedAt`, personalizações opcionais de tipo, título, descrição e horários                   |

### Identidade de uma ocorrência

- `occurrenceDate` é a data válida calculada pela regra, após a adaptação do calendário e antes de mudanças manuais.
- `scheduledDate` é a data em que a ocorrência deve aparecer, incluindo eventual reagendamento.
- Mover uma ocorrência não altera `occurrenceDate`.
- Chave única: `(recurringEventId, occurrenceDate)`. A regra inicial admite no máximo uma ocorrência de uma mesma recorrência em cada data; outras recorrências e eventos continuam livres para coincidir.
- A resposta do calendário possui uma `calendarKey` estável baseada em `seriesId` e `occurrenceDate`, mesmo antes de existir um registro salvo e após a migração para uma continuação compatível da série.

### Valores herdados e personalizações

- `typeOverride` e `titleOverride`: nulo significa herdar; título personalizado deve ser não vazio.
- `descriptionOverride`: nulo herda; string vazia remove a descrição daquela ocorrência.
- Horários precisam distinguir herança de remoção explícita. Usar um indicador de personalização do horário e campos opcionais de início/fim, permitindo tornar uma ocorrência sem horário.
- `scheduledDate` começa igual a `occurrenceDate`.
- O frontend recebe `type`, `title`, `description`, data, horários, status e conclusão já resolvidos.

### Integridade e histórico

- Índice de consulta por proprietário e data em `Event`.
- Unicidade de aplicação por `(templateId, weekStart)`.
- Aplicação de modelo em transação: criar o registro de aplicação e todos os eventos juntos. Tentativas simultâneas ou repetidas não geram duplicações.
- Conclusão/reabertura de ocorrência usa atualização ou criação atômica pela chave única.
- Mudanças repetidas para `COMPLETED` preservam o instante de conclusão existente; uma nova conclusão após reabertura registra um novo instante.
- Mudanças futuras de uma série não reescrevem suas definições passadas nem apagam ocorrências concluídas.
- Regras e modelos referenciados por histórico não são apagados em cascata. Remoção administrativa deve preservar as atividades já geradas ou arquivar a definição conforme necessário.

## Consulta do calendário

1. Validar o intervalo solicitado e o usuário autenticado.
2. Buscar os eventos avulsos, incluindo os gerados por modelos, que caem no intervalo.
3. Encontrar os trechos de recorrência relevantes e calcular suas datas no fuso do planejamento.
4. Buscar estados e personalizações salvos, incluindo ocorrências movidas de fora para dentro do intervalo.
5. Substituir ocorrências geradas pelos registros correspondentes, sem duplicar a data original. Ocorrências movidas para fora não permanecem no intervalo.
6. Retornar uma lista uniforme e ordenada com todos os valores resolvidos. Manter atividades canceladas identificáveis pelo status; a interface poderá filtrá-las.

As consultas têm limites de intervalo para evitar expansão ilimitada. Navegar para outros anos continua possível consultando os períodos necessários. A visualização do calendário não precisa gravar ocorrências no banco.

## API prevista

| Área            | Operações                                                                              |
| --------------- | -------------------------------------------------------------------------------------- |
| Autenticação    | `POST /auth/login` com somente `password`; consulta do usuário autenticado             |
| Calendário      | `GET /calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`, com ambas as datas inclusivas           |
| Eventos avulsos | Criar, consultar, editar, concluir/reabrir, cancelar e remover em `/events`            |
| Modelos         | CRUD em `/week-templates`, incluindo seus itens                                        |
| Aplicação       | `POST /week-templates/:id/apply` com a data de início da semana                        |
| Recorrências    | Criar, consultar, alterar a partir de uma ocorrência e encerrar em `/recurring-events` |
| Ocorrências     | Consultar e atualizar em `/recurring-events/:id/occurrences/:occurrenceDate`           |

Zod valida corpo, parâmetros e consultas. As rotas privadas usam o middleware JWT, que fornece `req.userId`; os serviços verificam a propriedade dos registros. Erros têm respostas consistentes.

## Organização do código

```text
src/
  @types/
  controllers/
  middlewares/
  prisma/
  routes/
  schemas/
  seeds/
  services/
  server.ts
prisma/
  schema.prisma
  migrations/
docs/
  implementation-plan.md
prisma.config.ts
tsconfig.json
.env.example
.yarnrc.yml
package.json
```

- Arquivos compostos em kebab-case com sufixos de responsabilidade.
- ESM/NodeNext e imports relativos terminando em `.js`.
- Prisma Client centralizado e gerado em `src/generated/prisma`, fora do Git.
- Controllers recebem dados e produzem respostas; services contêm regras e acesso ao banco.
- Controllers e services são agrupados por domínio, com uma operação por arquivo. Cada controller possui `handle` e cada service possui `execute`. As rotas ficam diretamente em `src/routes`, em um arquivo por categoria (por exemplo, `event-routes.ts`), reunidas pelo `routes/index.ts`.
- A configuração e inicialização do Express ficam em `server.ts`. A função `createApp` pode ser importada nos testes sem executar o `listen`.
- Cálculo de recorrência isolado em funções de domínio reutilizáveis pelos serviços, sem acesso direto ao HTTP.
- Configuração por ambiente: conexão do banco, segredo/validade JWT, porta e senha inicial do proprietário. Sem variável obrigatória de e-mail.
- Versionar schema, migrations, Yarn lockfile e `.env.example`; ignorar segredos, dependências, build e código gerado.

## Ordem de implementação e validação

1. Inicializar projeto, configuração Yarn/TypeScript, Prisma e PostgreSQL.
2. Criar schema, migrations, seed do proprietário e autenticação.
3. Implementar atividades avulsas e status.
4. Implementar modelos semanais e aplicação transacional.
5. Implementar cálculo de recorrências, adaptação de datas, ocorrências e edição com preservação de histórico.
6. Implementar a consulta unificada do calendário e documentar a API.
7. Validar com `yarn typecheck`, `yarn build` e verificações do banco e endpoints.

Testes automatizados de backend serão focados nas regras com risco de erro: meses curtos, anos bissextos, intervalos ancorados, término, reagendamento atravessando intervalos de consulta, conclusão independente, valores herdados, histórico e aplicação concorrente/repetida de modelos. Este planejamento não inclui criação de frontend nem testes de frontend.

## Pendências práticas

- O backend foi implementado usando os padrões acima. Não há frontend neste projeto.
- Antes de executar migrations, será necessária uma instância PostgreSQL de desenvolvimento e sua configuração local.
- A senha inicial e os segredos devem ser definidos localmente, sem inclusão no documento ou no Git.
- Hospedagem e publicação serão definidas quando houver necessidade de colocar a aplicação online.
