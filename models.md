# Modelos públicos da API Chrono

Formatos JSON observados na implementação em 11/10/2026. Consulte [contrato.md](./contrato.md) para validações, efeitos e erros e [contexto.md](./contexto.md) para arquitetura e domínio. Os nomes TypeScript abaixo são nomes de integração deste documento; não implicam a existência de um SDK ou de exports equivalentes no backend.

## Representação e presença dos campos

- `campo?: T` permite omissão na entrada; `campo: T | null` exige a chave na saída e permite valor nulo. JSON não possui `undefined`.
- Datas civis são strings `YYYY-MM-DD`, entre `0001-01-01` e `9999-12-31`; horários locais são `HH:mm`. Não converter automaticamente uma data civil em data local usando `new Date(string)`.
- Instantes (`createdAt`, `updatedAt`, `completedAt`) são strings ISO 8601 UTC, por exemplo `2026-10-11T14:30:00.000Z`, produzidas pela serialização JSON de `Date`. Não chegam como objetos `Date`.
- IDs são UUIDs em strings. Números são números JSON; não há valores monetários, `Decimal`, `BigInt`, arquivos ou dados binários nos contratos atuais.
- As restrições semânticas de strings, números e combinações de campos continuam sendo validadas pelo servidor; os aliases abaixo não validam conteúdo em tempo de execução.
- As saídas não possuem um envelope global `data`. Cada endpoint retorna o objeto indicado no mapa final.

## Tipos base, parâmetros e paginação

```ts
export type UUID = string;
export type DateOnly = string; // YYYY-MM-DD
export type LocalTime = string; // HH:mm
export type Instant = string; // ISO 8601 UTC
export type Timezone = string;

export type ActivityType = 'EVENT' | 'TASK';
export type ActivityStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // segunda a domingo

// Pelo menos uma propriedade conhecida; validações cruzadas estão no contrato.
export type AtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Omit<T, K>>;
}[keyof T];

export interface IdParams {
  id: UUID;
}

export interface OccurrenceParams extends IdParams {
  occurrenceDate: DateOnly; // data ORIGINAL válida da regra
}

export interface RangeQuery {
  from: DateOnly;
  to: DateOnly;
}

// Valores enviados na URL, por exemplo ?page=2&limit=20.
// A API converte usando z.coerce.number(); os valores retornados são números.
export interface PaginationQuery {
  page?: string; // inteiro convertido entre 1 e 100000; padrão 1
  limit?: string; // inteiro convertido entre 1 e 100; padrão 50
}

export interface Page<T> {
  items: T[];
  total: number; // quantidade total de registros do filtro, não de páginas
  page: number;
  limit: number;
}

export type NoContent = void; // HTTP 204, sem corpo; não é JSON null
```

`Page<T>` existe somente nas listas de modelos semanais e de regras recorrentes. Calendário e eventos usam intervalo de datas, sem `page`, `limit` ou `total`.

## Disponibilidade e autenticação

```ts
export interface HealthResponse {
  status: 'ok';
}

export interface PublicUser {
  id: UUID;
  timezone: Timezone;
}

export interface LoginRequest {
  password: string;
}

export interface LoginResponse {
  token: string;
  tokenType: 'Bearer';
  expiresIn: number; // segundos
  user: PublicUser;
}

export type CurrentUserResponse = PublicUser;
```

`passwordHash`, `tokenVersion`, `singletonKey` e timestamps do usuário não integram essas respostas. Não há entrada de e-mail, nome de usuário ou seleção de proprietário.

## Eventos concretos

```ts
export interface ActivityInput {
  type?: ActivityType; // padrão TASK na criação
  title: string;
  description?: string | null;
  startTime?: LocalTime | null;
  endTime?: LocalTime | null;
}

export interface CreateEventRequest extends ActivityInput {
  date: DateOnly;
  status?: ActivityStatus; // padrão PENDING
}

export type UpdateEventRequest = AtLeastOne<CreateEventRequest>;

export interface ResolvedActivityFields {
  type: ActivityType;
  title: string;
  description: string | null;
  date: DateOnly;
  startTime: LocalTime | null;
  endTime: LocalTime | null;
  status: ActivityStatus;
  completedAt: Instant | null;
}

export interface EventResponse extends ResolvedActivityFields {
  id: UUID;
  calendarKey: `event:${string}`;
  source: 'EVENT';
  templateApplicationId: UUID | null;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface EventListResponse {
  items: EventResponse[];
}
```

O mesmo `EventResponse` é usado na criação, consulta, alteração, listagem, calendário e aplicação de modelo. Não contém `userId`, objetos de relacionamento ou campos de recorrência. O vínculo `templateApplicationId` é produzido pelo servidor e não pode ser enviado em POST/PATCH de eventos.

## Ocorrências resolvidas e calendário

```ts
export interface ResolvedOccurrence extends ResolvedActivityFields {
  id: UUID | null; // null enquanto não houver estado persistido
  calendarKey: `recurring:${string}:${DateOnly}`;
  source: 'RECURRING';
  recurringEventId: UUID; // ID do segmento atual; pode mudar após split
  seriesId: UUID;
  occurrenceDate: DateOnly; // identidade original; date é a data de exibição
}

export interface TimeOverride {
  startTime: LocalTime | null; // ambas as chaves são obrigatórias
  endTime: LocalTime | null;
}

export interface OccurrenceChanges {
  scheduledDate?: DateOnly; // não aceita null; para restaurar, enviar occurrenceDate
  status?: ActivityStatus;
  typeOverride?: ActivityType | null;
  titleOverride?: string | null;
  descriptionOverride?: string | null;
  timeOverride?: TimeOverride | null;
}

export type UpdateOccurrenceRequest = AtLeastOne<OccurrenceChanges>;

// PATCH bem-sucedido sempre faz upsert de um estado.
export type UpdatedOccurrenceResponse = ResolvedOccurrence & { id: UUID };

// DELETE /state remove o registro e devolve os valores da regra.
export type ResetOccurrenceResponse = ResolvedOccurrence & {
  id: null;
  status: 'PENDING';
  completedAt: null;
};

export type CalendarItem = EventResponse | ResolvedOccurrence;

export interface CalendarResponse {
  from: DateOnly;
  to: DateOnly;
  timezone: Timezone;
  items: CalendarItem[];
}
```

Use `source` para discriminar `CalendarItem`; `type` é a categoria funcional e não distingue a origem. `calendarKey` recorrente é `recurring:<seriesId>:<occurrenceDate>`. O retorno de ocorrência não expõe `scheduledDate`, overrides, `hasTimeOverride`, `createdAt` ou `updatedAt`; contém apenas valores resolvidos. Não há endpoint de consulta do estado bruto ou indicadores públicos de quais campos foram personalizados.

`null` em um override significa herdar. Para descrição explicitamente vazia, use `descriptionOverride: ""`; para remover ambos os horários somente da ocorrência, use `timeOverride: { startTime: null, endTime: null }`. A resposta continuará usando `description`, `startTime`, `endTime` e `date`, não os nomes de entrada.

## Modelos semanais e aplicações

```ts
export interface TemplateItemInput extends ActivityInput {
  weekday: Weekday;
}

export interface CreateWeekTemplateRequest {
  name: string;
  items: TemplateItemInput[]; // de 0 a 200 itens
}

export type UpdateWeekTemplateRequest = AtLeastOne<CreateWeekTemplateRequest>;

export interface WeekTemplateItemResponse {
  id: UUID;
  templateId: UUID;
  weekday: Weekday;
  type: ActivityType;
  title: string;
  description: string | null;
  startTime: LocalTime | null;
  endTime: LocalTime | null;
}

export interface WeekTemplateResponse {
  id: UUID;
  userId: UUID;
  name: string;
  archivedAt: null; // endpoints de leitura/escrita retornam somente modelos ativos
  createdAt: Instant;
  updatedAt: Instant;
  items: WeekTemplateItemResponse[];
}

export type WeekTemplateListResponse = Page<WeekTemplateResponse>;

export interface ApplyWeekTemplateRequest {
  weekStart: DateOnly;
}

export interface ApplyWeekTemplateResponse {
  id: UUID; // ID da aplicação, não do modelo
  weekStart: DateOnly;
  alreadyApplied: boolean; // false em 201; true em 200
  events: EventResponse[];
}
```

A lista inclui os mesmos itens e campos do detalhe; não há DTO resumido. Itens não possuem timestamps. A resposta de aplicação não inclui `templateId` nem `appliedAt`, embora existam na persistência; o `id` é o mesmo usado por `EventResponse.templateApplicationId`.

`userId` e `templateId` estão documentados porque os serializers atuais efetivamente os retornam. Eles não são aceitos nas entradas. `archivedAt` existe como instante anulável no banco, mas o endpoint DELETE responde 204 e não há leitura pública dos modelos arquivados.

## Regras recorrentes e segmentos

```ts
export interface CreateRecurringEventRequest extends ActivityInput {
  startDate: DateOnly;
  frequency: Frequency;
  interval?: number; // inteiro 1..10000; padrão 1
  until?: DateOnly | null;
  count?: number | null; // inteiro 1..1000000
}

export type RecurringEventChanges = AtLeastOne<CreateRecurringEventRequest>;

export interface SplitRecurringEventRequest {
  fromDate: DateOnly;
  changes: RecurringEventChanges;
}

export interface EndRecurringEventRequest {
  fromDate: DateOnly;
}

export interface RecurringEventResponse {
  id: UUID;
  userId: UUID;
  seriesId: UUID;
  previousId: UUID | null;
  type: ActivityType;
  title: string;
  description: string | null;
  startDate: DateOnly;
  startTime: LocalTime | null;
  endTime: LocalTime | null;
  frequency: Frequency;
  interval: number;
  until: DateOnly | null;
  count: number | null;
  effectiveFrom: DateOnly;
  effectiveUntil: DateOnly | null;
  createdAt: Instant;
  updatedAt: Instant;
  invalidDatePolicy: 'LAST_VALID_DAY';
}

export interface RecurringEventDetailResponse extends RecurringEventResponse {
  isActive: boolean;
}

export type RecurringListStatus = 'active' | 'history' | 'all';
export interface RecurringListQuery extends PaginationQuery {
    status?: RecurringListStatus; // Default: active
}
export type RecurringEventListResponse = Page<RecurringEventResponse>;
```

Criação, lista, divisão e encerramento usam o mesmo formato. O detalhe acrescenta `isActive`, pelo mesmo critério da lista de atuais. Não há arrays `occurrences`, objetos `previous`/`next`, `status` ou `completedAt` na regra retornada. `previousId`, `seriesId`, limites efetivos e `invalidDatePolicy` são somente de saída. `until` e `count` não podem ser simultaneamente não nulos. `effectiveUntil` pode ser anterior a `effectiveFrom` quando o segmento é inteiramente encerrado/substituído; não imponha a invariância contrária no frontend.

## Erros

```ts
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_JSON'
  | 'INVALID_TIME_RANGE'
  | 'INVALID_WEEK_START'
  | 'INVALID_TERMINATION'
  | 'INVALID_START_DATE'
  | 'INVALID_END_DATE'
  | 'HISTORY_PROTECTED'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'ORIGIN_NOT_ALLOWED'
  | 'NOT_FOUND'
  | 'OCCURRENCE_NOT_FOUND'
  | 'SERIES_ALREADY_SPLIT'
  | 'OCCURRENCE_CONFLICT'
  | 'DATA_CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR';

// Formato de integração do subconjunto comum de error.issues do Zod 4.
// As propriedades adicionais variam por validação e não formam um DTO estável.
export interface ValidationIssue {
  code: string;
  path: Array<string | number>;
  message: string;
  [key: string]: unknown;
}

export interface OccurrenceConflictDetails {
  occurrences: Array<{
    occurrenceDate: DateOnly;
    status: ActivityStatus;
  }>;
}

export type ApiErrorResponse =
  | {
      error: {
        code: 'VALIDATION_ERROR';
        message: string;
        details: ValidationIssue[];
      };
    }
  | {
      error: {
        code: 'OCCURRENCE_CONFLICT';
        message: string;
        details: OccurrenceConflictDetails;
      };
    }
  | {
      error: {
        code: Exclude<ApiErrorCode, 'VALIDATION_ERROR' | 'OCCURRENCE_CONFLICT'>;
        message: string;
        details?: never;
      };
    };
```

No código atual, só validação e conflito de ocorrências retornam `details`. Nos outros casos a propriedade fica ausente, não `null`. O contrato lista a associação dos códigos com HTTP. Erros do transporte, de proxies e respostas sem corpo não são objetos `ApiErrorResponse`.

## Mapa completo de endpoints

`—` indica ausência de entrada contratada naquela categoria. Nos endpoints com schema, query/body não declarados precisam estar ausentes ou vazios; detalhes e exceções em [contrato.md](./contrato.md). Headers de autenticação são compartilhados e não fazem parte dos bodies.

| Método | Caminho                                                   | Params             | Query             | Body                          | Sucesso → tipo JSON                      |
| ------ | --------------------------------------------------------- | ------------------ | ----------------- | ----------------------------- | ---------------------------------------- |
| GET    | `/health`                                                 | —                  | —                 | —                             | 200 → `HealthResponse`                   |
| POST   | `/auth/login`                                             | —                  | —                 | `LoginRequest`                | 200 → `LoginResponse`                    |
| GET    | `/auth/me`                                                | —                  | —                 | —                             | 200 → `CurrentUserResponse`              |
| GET    | `/calendar`                                               | —                  | `RangeQuery`      | —                             | 200 → `CalendarResponse`                 |
| GET    | `/events`                                                 | —                  | `RangeQuery`      | —                             | 200 → `EventListResponse`                |
| POST   | `/events`                                                 | —                  | —                 | `CreateEventRequest`          | 201 → `EventResponse`                    |
| GET    | `/events/:id`                                             | `IdParams`         | —                 | —                             | 200 → `EventResponse`                    |
| PATCH  | `/events/:id`                                             | `IdParams`         | —                 | `UpdateEventRequest`          | 200 → `EventResponse`                    |
| DELETE | `/events/:id`                                             | `IdParams`         | —                 | —                             | 204 → `NoContent`                        |
| GET    | `/week-templates`                                         | —                  | `PaginationQuery` | —                             | 200 → `WeekTemplateListResponse`         |
| POST   | `/week-templates`                                         | —                  | —                 | `CreateWeekTemplateRequest`   | 201 → `WeekTemplateResponse`             |
| GET    | `/week-templates/:id`                                     | `IdParams`         | —                 | —                             | 200 → `WeekTemplateResponse`             |
| PATCH  | `/week-templates/:id`                                     | `IdParams`         | —                 | `UpdateWeekTemplateRequest`   | 200 → `WeekTemplateResponse`             |
| DELETE | `/week-templates/:id`                                     | `IdParams`         | —                 | —                             | 204 → `NoContent`                        |
| POST   | `/week-templates/:id/apply`                               | `IdParams`         | —                 | `ApplyWeekTemplateRequest`    | 201 ou 200 → `ApplyWeekTemplateResponse` |
| GET    | `/recurring-events`                                       | —                  | `RecurringListQuery` | —                             | 200 → `RecurringEventListResponse`       |
| POST   | `/recurring-events`                                       | —                  | —                 | `CreateRecurringEventRequest` | 201 → `RecurringEventResponse`           |
| GET    | `/recurring-events/:id`                                   | `IdParams`         | —                 | —                             | 200 → `RecurringEventDetailResponse`           |
| POST   | `/recurring-events/:id/split`                             | `IdParams`         | —                 | `SplitRecurringEventRequest`  | 201 → `RecurringEventResponse`           |
| POST   | `/recurring-events/:id/end`                               | `IdParams`         | —                 | `EndRecurringEventRequest`    | 200 → `RecurringEventResponse`           |
| GET    | `/recurring-events/:id/occurrences/:occurrenceDate`       | `OccurrenceParams` | —                 | —                             | 200 → `ResolvedOccurrence`               |
| PATCH  | `/recurring-events/:id/occurrences/:occurrenceDate`       | `OccurrenceParams` | —                 | `UpdateOccurrenceRequest`     | 200 → `UpdatedOccurrenceResponse`        |
| DELETE | `/recurring-events/:id/occurrences/:occurrenceDate/state` | `OccurrenceParams` | —                 | —                             | 200 → `ResetOccurrenceResponse`          |

## Fontes e cuidados de atualização

Entradas: [schemas](./src/schemas/). Saídas: [controllers](./src/controllers/), [serialização de atividades e regras](./src/domain/activity.ts), [serialização dos modelos](./src/services/week-template/shared/serialize-template.ts) e [aplicação de modelo](./src/services/week-template/apply-week-template.service.ts). Campos retornados por spread foram conferidos no [schema Prisma](./prisma/schema.prisma), sem transportar modelos internos inteiros para a interface pública.

O spread de regras/modelos pode tornar novos campos persistidos automaticamente públicos; mudanças nessas entidades exigem revisar esta documentação e os serializers. Não existe contrato OpenAPI ou geração automática desses tipos no repositório.
