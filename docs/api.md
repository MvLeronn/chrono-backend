# Contrato da API

Base local: `http://127.0.0.1:3000`. Corpo e resposta JSON. Rotas privadas exigem `Authorization: Bearer <token>`.

## Convenções

- `type`: `EVENT` ou `TASK`; padrão `TASK`.
- `status`: `PENDING`, `IN_PROGRESS`, `COMPLETED` ou `CANCELED`; padrão `PENDING` para ambos os tipos.
- Título: 1–200 caracteres, sem espaços vazios nas extremidades. Descrição: opcional, até 10.000 caracteres.
- Datas válidas entre `0001-01-01` e `9999-12-31`, em `YYYY-MM-DD`.
- Horários: `HH:mm`, opcionais. Horário final exige inicial e deve ser posterior no mesmo dia. Atividades atravessando a meia-noite não fazem parte desta versão.
- Sem horário inicial, a atividade pertence ao dia inteiro. `null` remove o horário; em PATCH, campo omitido mantém seu valor.
- O fuso fica no usuário, inicialmente `America/Sao_Paulo`. Horários são locais desse planejamento, e `completedAt` é um instante ISO 8601 UTC.
- `completedAt` é controlado pelo servidor. Repetir `COMPLETED` preserva o instante; sair desse status limpa o campo. Uma conclusão posterior a uma reabertura registra outro instante.
- Campos desconhecidos são rejeitados. UUIDs, datas, horários, intervalos e regras combinadas são validados.
- Diferentes atividades podem compartilhar data e horário.

## Endpoints

| Método | Caminho                                                   | Operação                                              |
| ------ | --------------------------------------------------------- | ----------------------------------------------------- |
| GET    | `/health`                                                 | Disponibilidade do processo, sem autenticação         |
| POST   | `/auth/login`                                             | Login somente por senha                               |
| GET    | `/auth/me`                                                | ID e fuso do usuário autenticado                      |
| GET    | `/calendar?from=...&to=...`                               | Calendário unificado                                  |
| GET    | `/events?from=...&to=...`                                 | Somente atividades avulsas/copiadas dos modelos       |
| POST   | `/events`                                                 | Criar atividade avulsa                                |
| GET    | `/events/:id`                                             | Consultar atividade                                   |
| PATCH  | `/events/:id`                                             | Editar, mudar status ou reabrir                       |
| DELETE | `/events/:id`                                             | Remover atividade avulsa                              |
| GET    | `/week-templates?page=1&limit=50`                         | Listar modelos ativos                                 |
| POST   | `/week-templates`                                         | Criar modelo e seus itens                             |
| GET    | `/week-templates/:id`                                     | Consultar modelo ativo                                |
| PATCH  | `/week-templates/:id`                                     | Editar nome e/ou substituir a lista de itens          |
| DELETE | `/week-templates/:id`                                     | Arquivar modelo, preservando eventos gerados          |
| POST   | `/week-templates/:id/apply`                               | Acrescentar modelo à semana                           |
| GET    | `/recurring-events?page=1&limit=50`                       | Listar regras/segmentos, incluindo histórico          |
| POST   | `/recurring-events`                                       | Criar regra                                           |
| GET    | `/recurring-events/:id`                                   | Consultar regra/segmento                              |
| POST   | `/recurring-events/:id/split`                             | Editar esta ocorrência e as próximas                  |
| POST   | `/recurring-events/:id/end`                               | Encerrar a partir de uma data                         |
| GET    | `/recurring-events/:id/occurrences/:occurrenceDate`       | Consultar ocorrência resolvida                        |
| PATCH  | `/recurring-events/:id/occurrences/:occurrenceDate`       | Personalizar ou mudar status somente desta ocorrência |
| DELETE | `/recurring-events/:id/occurrences/:occurrenceDate/state` | Restaurar valores herdados e status pendente          |

Listas paginadas retornam `{ items, total, page, limit }`; limite máximo de 100 por página. Calendário e lista de eventos usam intervalos inclusivos de no máximo 366 dias. Navegar além desse intervalo requer outra consulta.

## Login

```json
{ "password": "sua senha" }
```

Resposta:

```json
{
  "token": "JWT",
  "tokenType": "Bearer",
  "expiresIn": 86400,
  "user": { "id": "uuid", "timezone": "America/Sao_Paulo" }
}
```

Senha inválida retorna `401`. Após a expiração, faça login novamente. Redefinição administrativa invalida os tokens existentes.

## Atividade avulsa

`POST /events`:

```json
{
  "type": "TASK",
  "title": "Estudar inglês",
  "description": "Revisar a aula anterior",
  "date": "2026-10-12",
  "startTime": "19:00",
  "endTime": "20:00"
}
```

Em `PATCH /events/:id`, envie somente os campos a alterar. Para concluir, envie `{ "status": "COMPLETED" }`; para reabrir, `{ "status": "PENDING" }`. Para cancelar sem remover o registro, use `CANCELED`.

## Modelo semanal

`POST /week-templates`:

```json
{
  "name": "Semana normal",
  "items": [
    { "weekday": 1, "type": "TASK", "title": "Estudar", "startTime": "19:00", "endTime": "20:00" },
    { "weekday": 3, "type": "EVENT", "title": "Encontro" }
  ]
}
```

`weekday` vai de 1 (segunda) a 7 (domingo). Um modelo admite até 200 itens. `PATCH` pode alterar o nome, a lista completa de itens ou ambos.

`POST /week-templates/:id/apply`:

```json
{ "weekStart": "2026-10-12" }
```

`weekStart` deve ser segunda-feira. A operação copia os itens como `Event` com status `PENDING`, em uma transação, preservando as atividades existentes. A primeira aplicação retorna `201`; repetições retornam `200`, a mesma aplicação e `alreadyApplied: true`.

O mesmo modelo é aplicado uma única vez por semana, mesmo se seus itens forem alterados ou se algum evento gerado for apagado depois. A reaplicação não recria eventos apagados. Outros modelos podem ser aplicados à mesma semana. Editar/arquivar um modelo não altera as cópias já criadas.

## Criar recorrência

`POST /recurring-events`:

```json
{
  "type": "TASK",
  "title": "Revisão mensal",
  "description": "Revisar as metas",
  "startDate": "2026-10-31",
  "frequency": "MONTHLY",
  "interval": 1,
  "startTime": "18:00",
  "endTime": "19:00"
}
```

- Frequências: `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`.
- `interval`: inteiro entre 1 e 10.000; padrão 1.
- `until`: data final inclusiva, ou `null`.
- `count`: quantidade total entre 1 e 1.000.000, ou `null`.
- Use no máximo um entre `until` e `count`. Omitir ambos permite repetição sem fim.
- `count` inclui a primeira ocorrência e conta datas da regra mesmo quando forem canceladas, concluídas ou reagendadas.
- Uma regra semanal gera uma ocorrência por semana selecionada, no dia da semana da data inicial. Para vários dias, crie regras separadas ou use modelos semanais.
- Política fixa `LAST_VALID_DAY`: dia 31 vira 28/29 em fevereiro e volta a 31 em março. Recorrência anual em 29 de fevereiro usa 28 em anos comuns e volta a 29 em anos bissextos.
- O cálculo parte sempre da data de referência; conclusão ou reagendamento não muda o intervalo da regra.

## Consultar calendário

`GET /calendar?from=2026-10-12&to=2026-10-18`:

```json
{
  "from": "2026-10-12",
  "to": "2026-10-18",
  "timezone": "America/Sao_Paulo",
  "items": [
    {
      "id": null,
      "calendarKey": "recurring:uuid-da-serie:2026-10-15",
      "source": "RECURRING",
      "recurringEventId": "uuid-da-regra",
      "seriesId": "uuid-da-serie",
      "occurrenceDate": "2026-10-15",
      "date": "2026-10-15",
      "type": "TASK",
      "title": "Estudar",
      "description": null,
      "startTime": null,
      "endTime": null,
      "status": "PENDING",
      "completedAt": null
    }
  ]
}
```

`source` distingue `EVENT` (registro avulso ou copiado de modelo) de `RECURRING` (ocorrência de uma regra). Isso é independente de `type`, que pode ser `EVENT` ou `TASK` em qualquer origem.

Uma ocorrência calculada pode ter `id: null`: use `calendarKey` como chave na interface e o par `recurringEventId`/`occurrenceDate` para os endpoints. `calendarKey` usa a série e a data original, preservando a identidade em divisões compatíveis da série.

O backend combina eventos, datas calculadas e estados salvos, incluindo ocorrências movidas de fora para dentro do período. A data original de uma ocorrência movida não reaparece como pendente. Canceladas continuam retornando com seu status, permitindo que a interface decida se deve mostrá-las.

## Personalizar uma ocorrência

`PATCH /recurring-events/:id/occurrences/2026-10-15`:

```json
{
  "scheduledDate": "2026-10-16",
  "typeOverride": "EVENT",
  "titleOverride": "Conversação em inglês",
  "descriptionOverride": "Praticar por 30 minutos",
  "timeOverride": { "startTime": "19:00", "endTime": "19:30" },
  "status": "COMPLETED"
}
```

- `occurrenceDate` identifica a data válida calculada pela regra, após a adaptação do calendário, antes de alterações manuais. Nunca use uma data inexistente como 31 de fevereiro.
- `scheduledDate` altera somente a data de exibição. A resposta resolvida usa o campo `date`.
- Campos omitidos mantêm a personalização atual.
- `typeOverride`, `titleOverride` e `descriptionOverride` com `null` voltam a herdar da regra.
- `descriptionOverride: ""` remove a descrição somente desta ocorrência.
- `timeOverride: null` volta a herdar os horários da regra.
- `timeOverride: { "startTime": null, "endTime": null }` torna somente esta ocorrência sem horário.
- Cada status afeta somente esta ocorrência. Salvar a mesma ocorrência simultaneamente não cria registros duplicados.

`DELETE .../state` é uma redefinição explícita: apaga o estado salvo, incluindo conclusão, reagendamento e personalizações, e restaura a ocorrência padrão pendente. Para apenas cancelar, use `PATCH` com `status: "CANCELED"`.

## Alterar esta e as próximas

`POST /recurring-events/:id/split`:

```json
{
  "fromDate": "2030-02-28",
  "changes": { "title": "Novo título", "startTime": "20:00", "endTime": "21:00" }
}
```

`fromDate` deve ser uma ocorrência válida e ser hoje ou futura no fuso do planejamento. O endpoint cria um novo segmento e retorna `201` com o novo `id`; a parte anterior continua acessível e a `seriesId` é preservada.

Alterar somente conteúdo mantém a data de referência original. Assim, mudar o título na ocorrência adaptada de 28 de fevereiro não transforma uma regra de dia 31 em uma regra de dia 28.

Alterar frequência ou intervalo inicia a nova sequência em `fromDate`; pode-se informar outra `startDate` igual ou posterior. Ao trocar a sequência e manter `count`, o limite passa a representar a quantidade restante. Informar uma nova `count` substitui o limite; ao manter a sequência original, ela continua sendo contada desde sua data de referência.

Definir `count` limpa uma `until` anterior; definir `until` limpa uma `count` anterior, desde que o outro campo não seja enviado. Enviar ambos com valores é inválido.

Personalizações futuras compatíveis migram para o novo segmento. Conteúdo de ocorrências já concluídas é preservado, mesmo quando a conclusão foi antecipada. Estados passados permanecem no segmento anterior.

Se alguma ocorrência personalizada deixar de existir sob a nova regra, a API retorna `409 OCCURRENCE_CONFLICT`, com suas datas e status, e não altera nada. O cliente pode ajustar a alteração ou oferecer uma redefinição explícita dos estados afetados antes de tentar novamente.

Um segmento que já possui continuação retorna `409 SERIES_ALREADY_SPLIT`; use o `recurringEventId` retornado pelo calendário para selecionar o segmento correspondente. Alterações em datas passadas são feitas individualmente, sem reescrever a série.

## Encerrar recorrência

`POST /recurring-events/:id/end`:

```json
{ "fromDate": "2030-05-01" }
```

Nenhuma nova ocorrência da regra será gerada a partir dessa data. A data pode ser qualquer dia a partir de hoje, não necessariamente uma ocorrência. O histórico anterior permanece, incluindo ocorrências anteriores reagendadas para depois do limite.

O encerramento atua no último segmento. Se houver estados salvos de ocorrências cuja data original está a partir do limite, retorna `409 OCCURRENCE_CONFLICT`, sem apagá-los. Escolha outro limite ou redefina explicitamente os estados antes de repetir.

## Erros

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos.",
    "details": []
  }
}
```

Principais respostas: `400` para entrada inválida, `401` para autenticação, `403` para origem CORS não permitida, `404` para registro/ocorrência inexistente, `409` para conflitos, `413` para corpo acima do limite padrão de 100 KB do Express e `500` para falha interna. Todas as consultas e alterações privadas verificam o proprietário.
