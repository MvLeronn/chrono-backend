# Contrato público da API Chrono

Estado conferido no código em 11/10/2026. Este documento cobre os 23 endpoints explícitos de [src/routes](./src/routes/). Tipos completos e mapa de entradas/saídas: [models.md](./models.md). Arquitetura, operação e limitações: [contexto.md](./contexto.md).

## Transporte, autenticação e respostas

- Base local padrão: `http://127.0.0.1:3000`, configurável por `HOST`/`PORT`. Não existe prefixo `/api` ou versionamento de URL.
- Envie `Content-Type: application/json` quando houver body. O servidor usa apenas `express.json()`; não há parser de formulário, multipart ou upload. O limite é o padrão de 100 KB, sem aumento para listas de itens.
- As respostas de sucesso são JSON diretamente, sem envelope `data`; exceções: os dois DELETEs de evento/modelo retornam 204 sem corpo. Não chamar `response.json()` nesses 204.
- Somente `GET /health` e `POST /auth/login` são públicos. Todos os demais endpoints exigem `Authorization: Bearer <token>`; o middleware exige exatamente `Bearer`, um espaço e token sem espaços.
- JWT usa HS256, issuer `chrono`, audience `chrono-api`, subject igual ao ID do proprietário e versão de sessão conferida no banco a cada requisição. Expiração padrão: 86400 segundos, configurável entre 60 e 2592000. Use `expiresIn` retornado pelo login.
- Não existem cookies de sessão, `Set-Cookie`, autenticação por query, refresh, logout, cadastro, endpoint de alteração de senha ou papéis/permissões distintos. A redefinição administrativa da senha invalida todos os tokens anteriores.
- CORS permite origens exatamente presentes em `CORS_ORIGINS`, separadas por vírgulas e aparadas; chamadas sem `Origin` também passam. Origem rejeitada gera 403 `ORIGIN_NOT_ALLOWED`; no navegador, o bloqueio CORS pode impedir a leitura desse JSON. `credentials` não é habilitado.
- Preflight é tratado pelo middleware `cors` (204 por padrão); a lista padrão de métodos do CORS não significa que todos estejam implementados. Não há política própria de `Cache-Control`, negociação de versão ou header de idempotência.

## Validação compartilhada

Nos endpoints com `validateSchema`, params, query e body são objetos estritos: propriedades extras são rejeitadas, inclusive nas estruturas aninhadas. Sem body, o middleware utiliza `{}`. Uma query não prevista ou um body com propriedades em um GET/DELETE validado produz 400 `VALIDATION_ERROR`.

**Exceções verificadas:** `/health` e `/auth/me` não usam `validateSchema`; query e body são ignorados por seus handlers. O parser JSON e o CORS continuam globais. Para rotas privadas, autenticação vem antes da validação de schema, mas depois do parser JSON. Caminhos/métodos não implementados atravessam a autenticação global: sem sessão podem retornar 401; com sessão retornam 404 `NOT_FOUND`.

| Campo/conjunto                                 | Regra efetiva                                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| `id`                                           | UUID validado com `z.uuid()`, não número nem identificador arbitrário                   |
| Datas civis                                    | Data real em `YYYY-MM-DD`, anos 0001–9999; não aceita rollover, timestamp ou ano zero   |
| Horários                                       | `HH:mm`, de `00:00` a `23:59`; sem segundos ou offset                                   |
| `type`                                         | `EVENT` ou `TASK`; padrão `TASK` na criação                                             |
| `title` e `titleOverride` não nulo             | `trim()` antes da validação; 1–200 caracteres                                           |
| `description` e `descriptionOverride` não nulo | Até 10000 caracteres; aceita string vazia, sem trim                                     |
| `startTime`/`endTime`                          | Opcionais/anuláveis; final exige inicial e deve ser estritamente posterior no mesmo dia |
| `status`                                       | `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELED`; padrão `PENDING`                     |
| PATCH e `changes` de split                     | Pelo menos um campo reconhecido; omissão preserva o valor atual                         |
| `from`, `to`                                   | Ambos obrigatórios; intervalo inclusivo de 1–366 dias (`to - from` entre 0 e 365)       |
| `page`, `limit`                                | Coerção numérica Zod; inteiros, `page` 1–100000 e `limit` 1–100; padrões 1 e 50         |

Campos obrigatórios, opcionais e anuláveis estão definidos em [models.md](./models.md). Números de body não sofrem coerção: por exemplo, `interval: "2"` é inválido. Os parâmetros de paginação passam por `Number` via Zod, sem exigir uma regex decimal específica; prefira strings decimais simples na URL.

Status não possui uma sequência obrigatória: qualquer status pode mudar para qualquer outro, tanto para `EVENT` quanto para `TASK`. `completedAt` é controlado pelo servidor: concluir registra o instante, repetir `COMPLETED` preserva-o, sair de `COMPLETED` limpa-o e concluir de novo registra outro. Não envie `completedAt` no body.

Campos de horário de um PATCH de evento/regra são validados depois de combinados com os atuais. Para remover um início que ainda tem final, remova ambos no mesmo pedido. `startTime: null` com um final preservado é inválido. Não há bloqueio por coincidência de datas/horários nem restrição geral de edição de atividades passadas.

## Catálogo de erros

Formato: `ApiErrorResponse` em [models.md](./models.md), com `error.code` e `error.message`. Só validações e conflitos de ocorrências incluem `error.details` no código atual. Mensagens são em português; detalhes de validação vêm diretamente de `ZodError.issues` e podem incluir mensagens padrão da biblioteca.

| HTTP    | Código                 | Condição                                                                                                    |
| ------- | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| 400     | `VALIDATION_ERROR`     | Schema, campo extra, formato/limite inválido; `details` contém issues com caminho, como `['body', 'title']` |
| 400     | `INVALID_JSON`         | Falha de parsing reconhecida como `SyntaxError` com body                                                    |
| 400     | `INVALID_TIME_RANGE`   | Final sem início ou final menor/igual ao início                                                             |
| 400     | `INVALID_WEEK_START`   | Aplicação fora de segunda-feira ou semana ultrapassando o ano 9999                                          |
| 400     | `INVALID_TERMINATION`  | `count` e `until` simultâneos; `until` anterior à âncora ou ao limite de divisão                            |
| 400     | `INVALID_START_DATE`   | Nova âncora anterior a `fromDate` no split                                                                  |
| 400     | `INVALID_END_DATE`     | Encerramento anterior a `effectiveFrom`                                                                     |
| 400     | `HISTORY_PROTECTED`    | `fromDate` de split/end anterior a hoje no fuso do usuário                                                  |
| 401     | `INVALID_CREDENTIALS`  | Senha incorreta ou proprietário ainda não criado                                                            |
| 401     | `UNAUTHORIZED`         | Token ausente, inválido, expirado, usuário ausente ou versão revogada                                       |
| 403     | `ORIGIN_NOT_ALLOWED`   | `Origin` não permitido                                                                                      |
| 404     | `NOT_FOUND`            | Registro ausente, de outro proprietário, modelo arquivado ou rota inexistente                               |
| 404     | `OCCURRENCE_NOT_FOUND` | Data original não pertence ao segmento da regra                                                             |
| 404/409 | `DATA_CONFLICT`        | Prisma P2025 → 404; P2002, P2003 e P2034 → 409                                                              |
| 409     | `SERIES_ALREADY_SPLIT` | Tentativa de split/end em segmento com continuação                                                          |
| 409     | `OCCURRENCE_CONFLICT`  | Estados persistidos incompatíveis com split/end; `details.occurrences` informa `occurrenceDate` e `status`  |
| 413     | `PAYLOAD_TOO_LARGE`    | Body acima do limite do parser                                                                              |
| 500     | `INTERNAL_ERROR`       | Falhas não mapeadas; não expõe stack ou valores do banco                                                    |

Todos os endpoints estão sujeitos a CORS, falhas de parsing e falhas internas. Nos endpoints privados, acrescente 401 aos erros de domínio listados abaixo; nos endpoints com schema, acrescente 400 `VALIDATION_ERROR`. Conflitos de banco também podem atingir operações persistidas. Esses erros comuns não são repetidos integralmente em cada operação.

## Disponibilidade e autenticação

### GET `/health`

- **Finalidade/acesso:** verificar se o processo atende HTTP; público.
- **Entrada:** nenhum parâmetro de rota, query ou body contratado; query/body não têm schema.
- **Sucesso:** 200 `HealthResponse`, `{ "status": "ok" }`.
- **Efeito/limite:** não consulta o banco. Não representa verificação contínua de prontidão do PostgreSQL.

### POST `/auth/login`

- **Finalidade/acesso:** autenticar o único proprietário; público.
- **Entrada:** body `LoginRequest`, somente `password` obrigatório; sem params/query.
- **Validação:** string não vazia, no máximo 72 bytes UTF-8; não faz trim. O mínimo de 12 caracteres é exigido pelos scripts de criação/redefinição, não pelo login.
- **Sucesso:** 200 `LoginResponse`, com token, tipo, validade em segundos e `{ id, timezone }` do usuário.
- **Erros relevantes:** 401 `INVALID_CREDENTIALS`, inclusive se o seed não tiver sido executado.
- **Efeito:** assina JWT; não cria sessão persistida nem cookie. Logins sucessivos não revogam tokens anteriores.

### GET `/auth/me`

- **Finalidade/acesso:** consultar o usuário da sessão; privado.
- **Entrada:** sem params/query/body contratados; query/body não são validados pelo handler.
- **Sucesso:** 200 `CurrentUserResponse`, somente `id` e `timezone`.
- **Erros relevantes:** 401; o service também prevê 404 `NOT_FOUND` se o usuário desaparecer entre autenticação e consulta.

Fontes: [rotas auth](./src/routes/auth-routes.ts), [schema auth](./src/schemas/auth.schema.ts), [services auth](./src/services/auth/).

## Calendário

### GET `/calendar`

- **Finalidade/acesso:** consultar eventos concretos e ocorrências resolvidas no mesmo período; privado.
- **Entrada:** query obrigatória `RangeQuery` (`from`, `to`); sem params/body.
- **Sucesso:** 200 `CalendarResponse`: intervalo solicitado, fuso e `items: CalendarItem[]`.
- **Filtro:** data efetiva de exibição, inclusiva; inclui todos os tipos e status, inclusive cancelados/concluídos. Não aceita filtros de status, tipo ou série.
- **Ordenação:** `date` crescente, `startTime` crescente com nulos tratados como string vazia (sem horário primeiro), depois `calendarKey` via `localeCompare`.
- **Efeitos:** nenhum registro de ocorrência é criado. A resposta combina datas calculadas com estados salvos; inclui ocorrências movidas de fora para dentro, exclui as movidas para fora e não recria a pendente na data original.
- **Limites:** não paginado; período máximo de 366 dias, sem limite adicional de quantidade de atividades retornadas. Dias vazios não geram objetos.

Use `calendarKey` como chave visual; para alterar uma ocorrência use `recurringEventId` e `occurrenceDate`, mesmo se `id` for nulo. `source: EVENT` também inclui cópias de modelos; `type: EVENT` é uma categoria independente. Após reagendar, atualize os períodos da data original e da nova; após split/end, atualize os períodos afetados da série. A API não implementa invalidação do cache do frontend.

Fonte: [get-calendar.service.ts](./src/services/calendar/get-calendar.service.ts).

## Eventos concretos

Todas as operações desta seção são privadas e se aplicam tanto a eventos criados diretamente quanto aos copiados de modelos. `id` é UUID de `Event`, não de ocorrência recorrente.

### GET `/events`

- **Entrada:** query `RangeQuery` obrigatória; sem params/body.
- **Sucesso:** 200 `EventListResponse`, **somente `{ items }`**, sem intervalo, fuso ou paginação na resposta.
- **Filtro/ordem:** data inclusiva; `date ASC`, `startTime ASC`, `id ASC` no banco. PostgreSQL coloca horários nulos por último nessa ordenação, diferindo do calendário.
- **Efeito/limite:** leitura de registros concretos; não expande recorrências; todos os status retornam.

### POST `/events`

- **Entrada:** body `CreateEventRequest`; obrigatórios `title` e `date`; opcionais `type`, `description`, `startTime`, `endTime`, `status`; sem params/query.
- **Sucesso:** 201 `EventResponse`. Omissões produzem `TASK`, `PENDING` e campos descritivos/horários nulos; `templateApplicationId` é nulo.
- **Efeito:** cria atividade, podendo já estar concluída, inclusive em data passada/futura.
- **Erros relevantes:** 400 `INVALID_TIME_RANGE`.
- **Idempotência:** não existe deduplicação; repetir POST cria outro evento.

### GET `/events/:id`

- **Entrada:** `IdParams`; sem query/body.
- **Sucesso:** 200 `EventResponse`, mesmo formato da listagem.
- **Erros relevantes:** 404 `NOT_FOUND` se não existir para o proprietário.

### PATCH `/events/:id`

- **Entrada:** `IdParams` e body `UpdateEventRequest`, pelo menos um campo aceito na criação; sem query.
- **Sucesso:** 200 `EventResponse` atualizado.
- **Efeito:** alteração parcial; permite data, conteúdo, categoria, horários e status. `description: null` remove a descrição; horários nulos removem os respectivos valores. Vínculo de aplicação não é editável.
- **Erros relevantes:** 404 `NOT_FOUND`, 400 `INVALID_TIME_RANGE` após combinar com os valores preservados.

### DELETE `/events/:id`

- **Entrada:** `IdParams`; sem query/body.
- **Sucesso:** 204 sem corpo (`NoContent`).
- **Efeito:** exclusão física; não equivale a cancelar. Se for cópia de modelo, o registro da aplicação permanece e reaplicar não recria o evento.
- **Erros relevantes:** 404 `NOT_FOUND`, inclusive ao repetir a exclusão.

Fontes: [schema event](./src/schemas/event.schema.ts), [controllers event](./src/controllers/event/), [services event](./src/services/event/).

## Modelos semanais

Todas as operações são privadas e acessam somente modelos não arquivados. `id` é UUID de modelo. Um modelo pode estar vazio; itens não têm status nem datas concretas.

### GET `/week-templates`

- **Entrada:** query opcional `PaginationQuery`; sem params/body.
- **Sucesso:** 200 `WeekTemplateListResponse` (`items`, `total`, `page`, `limit`). Cada item é um modelo completo com sua lista de itens, sem versão resumida.
- **Filtro/ordem:** somente ativos; `createdAt DESC`, `id ASC`; itens por `weekday ASC`, `id ASC`.
- **Limites:** página vazia é válida; não há pesquisa por nome, ordenação configurável ou inclusão de arquivados.

### POST `/week-templates`

- **Entrada:** body `CreateWeekTemplateRequest`; `name` e `items` obrigatórios; sem params/query.
- **Validações:** nome após trim de 1–100 caracteres; lista de 0–200 itens. Cada item exige `weekday` inteiro 1–7 e `title`; aceita `type`, `description`, `startTime`, `endTime`, conforme as regras comuns. Não aceita IDs nos itens.
- **Sucesso:** 201 `WeekTemplateResponse`, incluindo itens criados e ordenados.
- **Efeito:** cria definição e itens; não preenche calendário. Nomes repetidos são permitidos.
- **Erros relevantes:** 400 `INVALID_TIME_RANGE` em qualquer item.

### GET `/week-templates/:id`

- **Entrada:** `IdParams`; sem query/body.
- **Sucesso:** 200 `WeekTemplateResponse`, incluindo todos os itens.
- **Erros relevantes:** 404 `NOT_FOUND`, também para modelo arquivado.

### PATCH `/week-templates/:id`

- **Entrada:** `IdParams`, body `UpdateWeekTemplateRequest`; `name`, `items` ou ambos; sem query. Mesmos limites da criação.
- **Sucesso:** 200 `WeekTemplateResponse`.
- **Efeito:** `items` substitui integralmente os itens, excluindo os anteriores e gerando novos IDs. `items: []` esvazia o modelo; omitir `items` preserva-os. Não existe PATCH individual de item.
- **Independência:** eventos e aplicações existentes não são modificados.
- **Erros relevantes:** 404 `NOT_FOUND`, 400 `INVALID_TIME_RANGE`.

### DELETE `/week-templates/:id`

- **Entrada:** `IdParams`; sem query/body.
- **Sucesso:** 204 sem corpo (`NoContent`).
- **Efeito:** arquivamento lógico por `archivedAt`; preserva itens, aplicações e eventos já gerados. Não há endpoint de restauração.
- **Erros relevantes:** 404 `NOT_FOUND` se já arquivado/ausente. Depois do arquivamento, não é possível consultar, editar ou reaplicar esse modelo por essas rotas.

### POST `/week-templates/:id/apply`

- **Entrada:** `IdParams`, body `ApplyWeekTemplateRequest` com `weekStart` obrigatório; sem query.
- **Validações:** data deve ser segunda-feira; a semana completa até domingo precisa caber no ano 9999. Aceita semanas passadas.
- **Sucesso inicial:** 201 `ApplyWeekTemplateResponse`, `alreadyApplied: false`; `id` identifica a aplicação. `events` contém eventos criados com `PENDING`, ordenados por data e ID.
- **Repetição:** 200 no mesmo formato, `alreadyApplied: true`, mesmo ID de aplicação e eventos **atuais** ainda vinculados a ela. Essa consulta não define ordenação; alterações posteriores e datas movidas aparecem, eventos apagados não reaparecem.
- **Efeito:** copia todos os itens nas datas `weekStart + weekday - 1`, atomicamente, preservando atividades existentes e recorrentes. Modelo vazio gera aplicação válida com `events: []`.
- **Idempotência:** unicidade por `(templateId, weekStart)`; edição do modelo não reinicia a aplicação. Modelos diferentes podem ser aplicados à mesma semana. A existência de uma aplicação não permite reaplicar um modelo já arquivado.
- **Erros relevantes:** 400 `INVALID_WEEK_START`, 404 `NOT_FOUND`.

Fontes: [schema template](./src/schemas/template.schema.ts), [services week-template](./src/services/week-template/).

## Regras recorrentes

Todas as operações são privadas. `id` identifica um **segmento** de `RecurringEvent`; `seriesId` reúne a cadeia. Não há PATCH/DELETE direto da regra, filtro por série ou listagem pública dos estados salvos.

### GET `/recurring-events`

- **Entrada:** query opcional `RecurringListQuery` (`page`, `limit`, `status`); sem params/body.
- **Sucesso:** 200 `RecurringEventListResponse`; cada item usa `RecurringEventResponse`, sem o indicador de gerenciamento exclusivo do detalhe.
- **Filtro/ordem:** query `status=active|history|all`, padrão `active`. Atuais são segmentos sem continuação com ao menos uma ocorrência original após hoje no fuso do proprietário. Ocorrências de hoje permanecem no calendário, mas não mantêm em Atuais uma regra sem próximas repetições; histórico é o complemento. Limites por data, quantidade e trecho são respeitados. `all` inclui todos. Ordem: `effectiveFrom DESC`, `id ASC`. O filtro é aplicado antes da paginação; `total` conta segmentos do filtro, não séries.
- **Limites:** sem filtro de atividade, frequência ou período; página além do total filtrado retorna lista vazia.

### POST `/recurring-events`

- **Entrada:** body `CreateRecurringEventRequest`; obrigatórios `title`, `startDate`, `frequency`; sem params/query. Aceita campos comuns de conteúdo/horário, `interval`, `until`, `count`; não aceita `status`.
- **Validações:** frequência `DAILY`, `WEEKLY`, `MONTHLY` ou `YEARLY`; intervalo inteiro 1–10000 (padrão 1); contagem inteira 1–1000000 ou nula; `until` data ou nula. No máximo um entre `count` e `until` não nulos; `until >= startDate`.
- **Sucesso:** 201 `RecurringEventResponse`. Cria uma série, `previousId: null`, `effectiveFrom = startDate`, `effectiveUntil: null`.
- **Efeito:** grava apenas a regra, sem ocorrências antecipadas. Sem limite de término, expande enquanto as datas forem representáveis. Não exige início hoje ou futuro.
- **Erros relevantes:** 400 `INVALID_TERMINATION`, `INVALID_TIME_RANGE`.
- **Idempotência:** repetir cria outra série.

Semanal gera um dia por semana selecionada, ancorado no dia da semana de `startDate`; não aceita vários weekdays. Mensal/anual usa `LAST_VALID_DAY`: dia 31 pode virar 28/29 sem perder a âncora para os meses seguintes; 29/02 volta em anos bissextos. `until` é inclusivo. `count` conta posições a partir da âncora original, independentemente de estado, cancelamento e reagendamento.

### GET `/recurring-events/:id`

- **Entrada:** `IdParams`; sem query/body.
- **Sucesso:** 200 `RecurringEventDetailResponse`, inclusive para segmento encerrado. Adiciona `isActive`, calculado pelo mesmo critério do filtro Atuais (sem continuação e com ocorrência após hoje). Use esse indicador para oferecer ações de edição/encerramento. Não inclui ocorrências ou objetos relacionados.
- **Erros relevantes:** 404 `NOT_FOUND`.

### POST `/recurring-events/:id/split`

- **Finalidade:** editar esta ocorrência e as próximas preservando o trecho anterior.
- **Entrada:** `IdParams`, body `SplitRecurringEventRequest`: `fromDate` e `changes` obrigatórios, com pelo menos um campo de criação em `changes`; sem query.
- **Validações:** `fromDate` deve ser ocorrência válida do segmento e ser hoje ou futura no fuso do usuário. Segmento não pode já ter continuação. Aplicam-se as validações dos campos de criação ao estado resultante.
- **Sucesso:** 201 `RecurringEventResponse` do **novo segmento**; não retorna o antigo nem lista de ocorrências migradas.
- **Efeito atômico:** cria segmento com mesmo `seriesId`, `previousId` igual ao ID anterior e `effectiveFrom = fromDate`; o anterior termina no dia imediatamente anterior. O novo herda o `effectiveUntil` anterior. Pode dividir na primeira ocorrência, deixando o segmento antigo sem datas efetivas.

Regras para construir a continuação:

1. Alterar somente conteúdo/horário/término preserva a âncora `startDate`. A data adaptada em fevereiro não vira a nova âncora de uma série mensal do dia 31.
2. Enviar `startDate` explicitamente, ou alterar de fato `frequency`/`interval`, recalcula a âncora. Sem `startDate` explícita nesse caso, usa `fromDate`; nova âncora não pode anteceder o limite. Enviar a mesma frequência/intervalo, sem `startDate`, não recalcula a âncora.
3. Se a âncora mudar e `count` for omitido, uma contagem existente vira `countAnterior - índiceOriginalDeFromDate` (índice iniciado em zero). Sem mudança de âncora, preserva a contagem referida à âncora original. `count` explícito substitui esse limite.
4. `count` não nulo limpa `until` herdada apenas se `until` foi omitida; `until` não nula limpa `count` herdado apenas se `count` foi omitido. `null` remove somente o respectivo limite. Dois limites não nulos são inválidos; `until` não pode ser anterior à âncora nem a `fromDate`.
5. Estados com `occurrenceDate >= fromDate` só migram se suas datas originais existirem na nova regra. Compatíveis preservam ID, status, conclusão e reagendamento; os demais fazem a transação falhar integralmente.
6. Para ocorrências concluídas migradas, congela tipo, título, descrição e horários resolvidos. Uma descrição anteriormente nula vira string vazia nesse congelamento. Outras ocorrências continuam herdando o novo conteúdo onde não têm override.

- **Erros relevantes:** 404 `NOT_FOUND`/`OCCURRENCE_NOT_FOUND`; 400 `HISTORY_PROTECTED`, `INVALID_START_DATE`, `INVALID_TERMINATION`, `INVALID_TIME_RANGE`; 409 `SERIES_ALREADY_SPLIT`/`OCCURRENCE_CONFLICT`.
- **Integração:** recarregue os segmentos/itens afetados e use o novo `recurringEventId`. A chave `calendarKey` permanece estável para datas originais compatíveis. Repetir no segmento antigo não é idempotente: normalmente falha na validação de ocorrência, pois o limite já o encerrou.
- **Limitação confirmada:** não há validação exigindo que a nova configuração produza ao menos uma ocorrência no segmento se não houver estados salvos conflitantes; por exemplo, reduzir `count` mantendo uma âncora antiga pode produzir segmento vazio.

### POST `/recurring-events/:id/end`

- **Entrada:** `IdParams`, body `EndRecurringEventRequest` com `fromDate`; sem query.
- **Validações:** hoje ou futuro no fuso do usuário e `fromDate >= effectiveFrom`. Não precisa ser ocorrência da regra. Só o último segmento, sem continuação, pode ser encerrado.
- **Sucesso:** 200 `RecurringEventResponse` do segmento atual.
- **Efeito:** define `effectiveUntil = fromDate - 1 dia`, impedindo datas originais a partir do limite. Encerrar em `effectiveFrom` deixa o segmento sem ocorrências. Não apaga o segmento.
- **Histórico:** estados com data original anterior permanecem, mesmo reagendados para depois do limite. Qualquer estado salvo com data original a partir do limite gera conflito, inclusive `PENDING` sem personalização visível.
- **Repetição:** se já há `effectiveUntil` e o novo `fromDate` é posterior a ele, devolve o registro sem alteração, após validar data futura, início do segmento e ausência de continuação. Pode antecipar um limite, respeitando conflitos; não reabre nem estende a série.
- **Erros relevantes:** 404 `NOT_FOUND`; 400 `HISTORY_PROTECTED`/`INVALID_END_DATE`; 409 `SERIES_ALREADY_SPLIT`/`OCCURRENCE_CONFLICT`.

Fontes: [schema recurring](./src/schemas/recurring.schema.ts), [services recurring-event](./src/services/recurring-event/), [motor de recorrência](./src/domain/recurrence.ts).

## Ocorrências individuais

Todas as operações são privadas. Params `OccurrenceParams`: UUID do segmento em `id` e data civil original em `occurrenceDate`. Esta deve ser gerada pela regra e respeitar `count`, `until` e limites efetivos; não use a data reagendada nem uma data impossível como 31/02. Não há proteção por passado nessas três operações.

### GET `/recurring-events/:id/occurrences/:occurrenceDate`

- **Entrada:** `OccurrenceParams`; sem query/body.
- **Sucesso:** 200 `ResolvedOccurrence`. Sem estado salvo, `id: null`, `PENDING`, `completedAt: null` e valores herdados.
- **Efeito:** leitura transacional, sem materializar ocorrência no banco.
- **Erros relevantes:** 404 `NOT_FOUND` ou `OCCURRENCE_NOT_FOUND`.

### PATCH `/recurring-events/:id/occurrences/:occurrenceDate`

- **Entrada:** `OccurrenceParams`, body `UpdateOccurrenceRequest` não vazio; sem query.
- **Campos:** `scheduledDate`, `status`, `typeOverride`, `titleOverride`, `descriptionOverride`, `timeOverride`; não aceita `date`, `title`, `startTime` diretamente ou campos internos de estado.
- **Validação:** overrides de tipo/título/descrição aceitam `null` para herdar; título não nulo é aparado e não vazio. `timeOverride` é `null` ou objeto com as duas chaves obrigatórias `startTime` e `endTime`, cada uma string de horário ou nula; horário final deve ser posterior ao inicial. `scheduledDate` não aceita `null`.
- **Sucesso:** 200 `UpdatedOccurrenceResponse`, contendo o estado resolvido e ID persistido, inclusive na primeira personalização.
- **Efeito:** upsert único por segmento/data original. Omissões preservam overrides e data reagendada existentes. Primeira gravação parte de data original e `PENDING`. Reagendamento não move a âncora, não muda `count` e pode ficar fora do segmento, no passado ou em data coincidente com outra atividade.
- **Erros relevantes:** 404 `NOT_FOUND`/`OCCURRENCE_NOT_FOUND`, 400 `INVALID_TIME_RANGE`.

Exemplos de semânticas distintas:

```json
{ "timeOverride": null }
```

Volta a herdar os horários. Para remover horários somente desta ocorrência:

```json
{ "timeOverride": { "startTime": null, "endTime": null } }
```

`descriptionOverride: null` herda a descrição; `descriptionOverride: ""` fornece uma descrição vazia. Para desfazer somente o reagendamento, envie `scheduledDate` igual à `occurrenceDate` original. Até um PATCH que mantém todos os valores aparentes cria estado persistido e pode participar de conflitos futuros de split/end.

### DELETE `/recurring-events/:id/occurrences/:occurrenceDate/state`

- **Entrada:** `OccurrenceParams`; sem query/body.
- **Sucesso:** **200 com JSON** `ResetOccurrenceResponse`, não 204.
- **Efeito:** apaga o estado persistido completo (overrides, reagendamento, status e conclusão); restaura ocorrência virtual da regra com `id: null`, data original, `PENDING` e conclusão nula. A ocorrência continua existindo na série.
- **Idempotência:** se não houver estado e a data continuar válida, retorna a mesma ocorrência virtual; para apenas cancelar use PATCH com `CANCELED`.
- **Erros relevantes:** 404 `NOT_FOUND`/`OCCURRENCE_NOT_FOUND`.

Fonte: [services recurring-occurrence](./src/services/recurring-occurrence/) e [resolução/serialização](./src/domain/activity.ts).

## Limites do contrato e diferenças da documentação anterior

- A descrição anterior de “campos desconhecidos rejeitados” tem as exceções `/health` e `/auth/me`, documentadas acima.
- Não existe um único formato completo para todas as atividades: eventos têm timestamps e vínculo de aplicação; ocorrências não. Não há tipos resumidos diferentes para listas de regras/modelos.
- Regras/modelos retornam `userId` e itens de modelo retornam `templateId` por spread; eventos e usuário atual usam seleção explícita. São campos reais de saída, não entradas permitidas.
- Não há endpoint público de aplicações, estado bruto da ocorrência, mudança de fuso, reabertura de regra, restauração de modelo, upload, busca textual ou integrações externas de calendário.
- Não há idempotência geral para POST nem controle de concorrência por versão/`If-Match`. As garantias específicas de aplicação, conclusão e reset estão descritas nas respectivas operações.
- Documentação baseada em inspeção de fonte, configurações, migrations e testes existentes; implantação, configuração efetiva do ambiente e dados de produção não foram verificados. Este trabalho não executou operações de API contra dados reais.

### DELETE `/recurring-events/:id`

Exclui definitivamente um segmento do histórico e todas as suas ocorrências persistidas, inclusive concluídas, reagendadas e marcadores de exclusão. Suas ocorrências virtuais também deixam de aparecer no calendário. Não exclui os demais segmentos da série: reconecta os vínculos `previousId` preservando `seriesId`, datas, limites e conteúdo dos sobreviventes.

- Autenticação obrigatória; `id` deve ser UUID e pertencer ao usuário autenticado.
- Usa o mesmo critério de `status=history`, considerando o fuso do usuário e repetições após hoje.
- Retorna `204` sem corpo. Registro inexistente, de outro usuário ou já excluído retorna `404 NOT_FOUND`.
- Regra ainda ativa retorna `409 RECURRENCE_ACTIVE`; encerre as próximas repetições antes de excluir.
- Operação atômica. Após sucesso, recarregue as listas de recorrências e os períodos afetados do calendário. A interface deve informar que a exclusão também apaga o histórico de ocorrências daquele segmento.
