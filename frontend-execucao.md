# Instruções de implementação do frontend Chrono

## 1. Tarefa e fontes de verdade

Implemente o frontend completo do Chrono no repositório de frontend disponibilizado. Entregue uma aplicação funcional, responsiva e integrada à API existente. Execute o trabalho até concluir os fluxos descritos; não se limite a um plano, uma tela demonstrativa ou um projeto com dados simulados.

Antes de implementar, leia os documentos do backend fornecidos junto deste arquivo:

- [contexto.md](./contexto.md): domínio, arquitetura e limitações.
- [contrato.md](./contrato.md): endpoints, validações, erros e efeitos reais.
- [models.md](./models.md): formatos de entrada/saída e mapa de endpoints.

Os links acima pressupõem os quatro documentos na mesma pasta. Se estiverem em outra localização, encontre-os no workspace. Preserve esses documentos como referências do backend; não os sobrescreva com documentação do frontend. Se já houver arquivos homônimos do frontend, mantenha as referências do backend numa pasta identificada, sem perder a origem.

Este arquivo define **decisões e requisitos para o frontend a construir**, não funcionalidades já implementadas no backend. Em caso de divergência de payload/status, siga o contrato e a implementação do backend, se acessível, e registre o problema encontrado. Não invente endpoints ou altere o backend para adaptar o frontend silenciosamente.

Se houver código no frontend, inspecione-o antes de alterar. Preserve trabalho existente e aproveite convenções compatíveis. Se estiver vazio, inicialize o projeto nele. Não crie um segundo projeto aninhado sem necessidade.

## 2. Stack escolhida

Use:

- Next.js com App Router e React.
- TypeScript em modo estrito.
- Tailwind CSS para estilos e tokens; CSS Modules quando ajudarem nos layouts específicos do calendário.
- Lucide React para ícones.
- Componentes próprios, com HTML semântico.
- `fetch` nativo, encapsulado numa camada de acesso à API.
- Hooks nativos do React e hooks próprios para estado/interação.
- Server Components, Server Actions e Route Handlers conforme as responsabilidades abaixo.
- Yarn, ESLint e verificação TypeScript; Prettier se já estiver configurado ou for adotado no projeto.

Não adicionar TanStack Query, SWR, shadcn/ui, Radix, FullCalendar, React Big Calendar, Axios, Redux, Zustand, React Hook Form, Zod ou Yup nesta implementação. São escolhas deliberadas para manter a stack próxima do padrão já utilizado pelo usuário. Dependências pequenas necessárias à configuração do Next, como `server-only`, são compatíveis com essa decisão.

Não adicionar ORM, Prisma, conexão PostgreSQL ou regras de recorrência de negócio ao frontend. O backend Express continua sendo responsável por persistência, autorização e regras do domínio.

Use as versões compatíveis já instaladas. Em projeto novo, escolha versões estáveis e compatíveis, verificando os requisitos de Node. Não copie automaticamente as versões exatas de outro projeto nem use canary/experimental para resolver problemas comuns. Fixe o gerenciador em `packageManager` e mantenha `yarn.lock` versionado.

## 3. Referência de padrão: TrackAssets

O projeto de referência inspecionado foi `C:/Users/Cliente/Desktop/www/TrackAssets/trackassets-web`. Não é necessário ter acesso a ele para seguir estas instruções.

Aproveite a abordagem:

- Componentes como `Button`, `Modal`, `NativeSelect` e `Pagination` escritos no projeto.
- Funções tipadas de acesso à API, organizadas por domínio.
- Server Actions pequenas, chamando uma camada interna de acesso a dados.
- Hooks próprios que representam loading, erro e dados e descartam respostas antigas.
- Formulários com estado React, validações simples e apresentação dos erros da API.
- Tokens de estilo compartilhados e arquivos por responsabilidade.

Não copie particularidades do TrackAssets:

- Chrono faz login somente por senha; não usa identificador, e-mail ou CPF.
- Chrono não possui refresh token, empresas, plantas, perfis de acesso ou seleção de tenant.
- O login retorna `token`, não `accessToken`.
- O erro do backend Chrono é `{ error: { code, message, details? } }`.
- Issues de validação do Chrono possuem `path` como array, por exemplo `['body', 'title']`; não reutilize sem adaptação um mapper que espera `body.title` como string.
- Não copie catches que transformam toda falha em `null`, pois isso perde status/código e confunde erro com lista vazia.
- Deduplicação curta de requisições não equivale a um cache completo. Não transportar uma camada de cache sem necessidade.

## 4. Arquitetura: utilizar o servidor do Next

Adote os seguintes fluxos:

```text
Leitura inicial ou navegação de página/período:
Browser → página Server Component → DAL server-only → API Chrono
                                      ↓
                         dados públicos para componentes React

Criação, edição, conclusão, exclusão e aplicação:
Client Component → Server Action → DAL server-only → API Chrono
                        ↓
              resultado tipado + atualização das telas afetadas

Detalhe carregado sob demanda em painel/modal:
Client Component → GET Route Handler específico → DAL server-only → API Chrono
```

**Server Components:** páginas, carregamento inicial de calendário/listas, leitura da sessão, dados do usuário e composição do layout. Consultam a DAL diretamente; não fazem uma chamada HTTP para o próprio `/api` do Next.

**Client Components:** formulários, abertura de painéis, seleção de dias/atividades, controles interativos, estados de envio e navegação. Use `"use client"` apenas nas fronteiras que precisam de estado/eventos/APIs do navegador. Não transforme toda a aplicação em client por conveniência.

**Server Actions:** mutações explícitas e login/logout. Arquivos com `"use server"` exportam funções assíncronas de ação; helpers, tipos e constantes ficam em módulos próprios. Cada ação deve conferir a sessão independentemente da página que a invocou. Não confiar em argumentos TypeScript como validação em runtime.

**Route Handlers GET:** somente para leituras sob demanda que não cabem nos dados da página, como detalhe fresco de uma atividade antes da edição. Crie rotas explícitas por recurso; não implemente um proxy que aceite URL, método ou caminho arbitrário do navegador. Esses handlers não fazem mutações de domínio em GET.

**DAL:** módulos protegidos com `import 'server-only'`, funções por operação e um transporte compartilhado. São os únicos módulos que conhecem a URL do backend e montam o header Bearer. Não exportar o token para componentes client.

Use a URL como origem do estado de navegação: data de referência e visualização do calendário, página das listas e seleção compartilhável quando conveniente. Não manter URL, estado client e servidor com três versões independentes do período atual.

## 5. Estrutura sugerida

Adapte nomes ao projeto existente, preservando a separação abaixo. A árvore é orientação para o frontend, não descrição de pastas do backend.

```text
src/
  app/
    layout.tsx
    globals.css
    page.tsx                        # direciona para login/calendário
    login/
      page.tsx
      LoginForm.tsx
      actions.ts
    (app)/
      layout.tsx
      calendario/
        page.tsx
        loading.tsx
        error.tsx
        CalendarClient.tsx
      modelos-semanais/
        page.tsx
        WeekTemplatesClient.tsx
        actions.ts
      recorrencias/
        page.tsx
        RecurringEventsClient.tsx
        actions.ts
    actions/
      events.ts
      occurrences.ts
      session.ts
    api/
      events/[id]/route.ts
      week-templates/[id]/route.ts
      recurring-events/[id]/route.ts
      recurring-events/[id]/occurrences/[occurrenceDate]/route.ts
  components/
    ui/
      Button.tsx
      Input.tsx
      Select.tsx
      Textarea.tsx
      FormField.tsx
      Dialog.tsx
      ConfirmDialog.tsx
      Feedback.tsx
      EmptyState.tsx
      Pagination.tsx
    layout/
    calendar/
    events/
    recurring-events/
    week-templates/
  server/
    env.ts
    auth/
      session.ts
      require-user.ts
    api/
      request.ts
      result.ts
      auth.ts
      calendar.ts
      events.ts
      recurring-events.ts
      occurrences.ts
      week-templates.ts
  hooks/
    useAsyncResource.ts
  lib/
    dates.ts
    calendar-layout.ts
    validation.ts
    api-errors.ts
    navigation.ts
  models/
    api/
    ui/
```

Não é obrigatório criar cada arquivo antecipadamente. Extraia responsabilidades quando existirem. Não criar um componente genérico gigantesco ou um arquivo único que contenha transporte, formulários e calendário.

`models/api` representa fielmente o JSON do backend. `models/ui` representa drafts, estado dos formulários e resultados internos do Next. Não alterar os tipos públicos para facilitar a tela: faça uma transformação explícita entre eles.

## 6. Autenticação e sessão

O Next será a camada intermediária entre browser e backend, mantendo o JWT em cookie HttpOnly do frontend.

### Login

1. Formulário com somente senha, label visível, mostrar/ocultar e feedback de envio.
2. Server Action envia `POST /auth/login` com `{ password }` para o backend.
3. Em sucesso, lê `token`, `expiresIn` e `user`. Confira estruturalmente os campos necessários antes de criar a sessão; um cast TypeScript não faz isso.
4. Salva o JWT num cookie de nome próprio, por exemplo `chrono_session`, com `httpOnly: true`, `sameSite: 'lax'`, `secure` em produção, `path: '/'` e `maxAge` baseado no `expiresIn` recebido. Não fixe arbitrariamente 24 horas.
5. Retorna ao browser apenas o resultado público necessário ou redireciona para o calendário. Nunca retornar `LoginResponse` integral por props, JSON de handler ou valor da action, pois ele contém o JWT.

Não guardar token em localStorage/sessionStorage, Context, variável `NEXT_PUBLIC_*` ou HTML. O frontend não precisa de `JWT_SECRET`, senha administrativa ou acesso ao hash; o backend valida o JWT.

### Requisições privadas

- Ler a sessão com `await cookies()` no servidor, respeitando a versão instalada do Next.
- Encaminhar apenas `Authorization: Bearer <token>` ao backend, além dos headers necessários à operação.
- `GET /auth/me` fornece `{ id, timezone }`; não tomar um cookie presente como prova suficiente de sessão válida.
- Guard do layout melhora a navegação, mas não substitui a autorização em páginas que leem dados, actions e handlers. Cada entrada do servidor precisa usar a DAL autenticada; o backend continua validando usuário/propriedade.
- Não compartilhar dados autenticados em cache global de processo ou cache público entre sessões.

### Expiração e logout

- Não implementar refresh automático: o backend não possui esse fluxo.
- Em 401, encerrar o uso dos dados privados e apresentar o login novamente. Não tratar 500/offline como senha incorreta ou sessão expirada.
- Cookies só devem ser escritos/apagados em Server Actions ou Route Handlers, nunca durante renderização de Server Component. Um Server Component que recebe 401 pode redirecionar ao login sem tentar apagar o cookie durante renderização.
- A página de login não deve redirecionar ao calendário apenas porque há cookie; se `/auth/me` rejeitar a sessão, exibir o formulário, evitando loop de redirecionamento. A próxima ação de login/logout pode limpar/substituir o cookie inválido.
- Logout é uma Server Action local do Next que apaga o cookie e redireciona para login. Não inventar `POST /auth/logout` no backend. Isso encerra a sessão do navegador; não revoga um JWT que tenha sido copiado, pois não existe essa operação na API atual.
- Manter proteções padrão de origem das Server Actions. Se usar retorno de URL após login, permitir somente destinos internos previamente validados.

Referências: [cookies](https://nextjs.org/docs/app/api-reference/functions/cookies), [autenticação](https://nextjs.org/docs/app/guides/authentication) e [segurança da DAL/actions](https://nextjs.org/docs/app/guides/data-security). Os detalhes de sessão acima são decisões do frontend para integrar o contrato existente.

## 7. Padrão de requisições e erros

Configuração privada do servidor:

```dotenv
API_BASE_URL=http://127.0.0.1:3000
```

No desenvolvimento, rode o Next em `http://localhost:3001` para não disputar a porta 3000 com o backend. Em produção, configure a URL interna/externa adequada e HTTPS na publicação. Não inclua credenciais reais no `.env.example`.

O navegador comunica-se com o próprio Next; o Next comunica-se com o Express. Não é necessário alterar o CORS do backend para esse fluxo servidor a servidor. Não encaminhe indiscriminadamente cookies, `Origin` ou outros headers do browser para o Express. Não habilite CORS `*` como solução de integração.

### Transporte compartilhado

Implemente um helper interno com as seguintes responsabilidades:

1. Montar URL a partir de `API_BASE_URL` validada e caminhos definidos pelos wrappers da DAL. IDs de segmentos de URL devem ser codificados; query deve usar `URLSearchParams` e somente campos previstos no contrato.
2. Ler o token no servidor. Login e health são exceções públicas explícitas; ausência de sessão em operação privada retorna falha de autenticação.
3. Usar `fetch` com `cache: 'no-store'` para dados autenticados nesta versão. Definir timeout limitado; distinguir erro HTTP de falha de rede/timeout.
4. Enviar `Content-Type: application/json` somente quando enviar JSON. GET não recebe body. Não serializar `userId`, timestamps, IDs internos ou campos extras a partir de spreads do objeto de resposta.
5. Interpretar 204 como sucesso sem JSON. O DELETE de estado de ocorrência é diferente: retorna 200 com objeto resolvido.
6. Preservar os códigos e detalhes de erro do backend. Resposta HTML/inválida do upstream deve virar falha de integração, não sucesso nem lista vazia.
7. Não fazer retry automático de mutações. Uma falha de transporte pode ocorrer depois de a alteração ter sido persistida; orientar atualização/consulta antes de reenviar uma criação.
8. Não registrar senha, JWT ou headers de autenticação nos logs.

Use um resultado discriminado interno semelhante a este; ele é **do frontend**, não o envelope JSON do backend:

```ts
export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | {
      ok: false;
      status: number | null; // null quando não houve resposta HTTP
      code: string;
      message: string;
      fieldErrors?: Record<string, string>;
      details?: unknown;
    };
```

Para 204, uma fronteira interna pode usar `ApiResult<null>` com `data: null`, deixando explícito que essa normalização não é o corpo do backend. Chamadas que retornam dados preservam os formatos documentados.

O transporte genérico é interno. Os consumidores usam funções por operação, como `getCalendar`, `createEvent`, `updateEvent`, `splitRecurringEvent` e `applyWeekTemplate`. O client não escolhe URL/método do upstream nem fornece token para a action.

### Validação sem Zod no frontend

- Use recursos HTML (`required`, `maxLength`, `min`, `max`, tipos de input) e funções TypeScript pequenas para feedback imediato.
- Nas actions/handlers, valide também tipos, estrutura, IDs e parâmetros externos usados para construir chamadas. Não confiar na validação do browser.
- Construa explicitamente os DTOs permitidos, conforme o contrato. Distinga campo omitido de `null`; converter todo vazio em `null` indiscriminadamente quebra PATCH e herança.
- A validação de negócio definitiva continua no backend. Não reimplementar expansão, contagem ou migração de recorrências no frontend.
- Para `VALIDATION_ERROR`, remova o prefixo `body` do array `path`, preserve índices de itens e associe cada erro ao campo correspondente; issues sem campo visível devem aparecer no resumo do formulário. Exemplo: `['body', 'items', 2, 'title']` → `items.2.title`.
- `details` é desconhecido na fronteira: confira a estrutura antes de acessar. Um conflito `OCCURRENCE_CONFLICT` deve receber tratamento próprio, mostrando datas e status.
- Ao usar `redirect`/`notFound`, não capturar seus sinais de controle e convertê-los em falha de rede. Faça a navegação fora de catches de transporte.

### Leituras sob demanda no client

Os handlers GET específicos retornam o envelope interno `ApiResult` de forma consistente e usam status HTTP coerente. Falhas locais sem resposta do upstream podem ser representadas pelo handler com 502/504; mantenha essa distinção documentada. Não retornar token.

O hook `useAsyncResource` deve abortar fetches client quando aplicável, descartar respostas antigas, tratar desmontagem e oferecer `reload`, loading e erro. Não criar um motor genérico de cache para substituir TanStack Query.

## 8. Carregamento, navegação e atualização da tela

Para o calendário, adote uma URL como `/calendario?date=2026-10-12&view=week`, com `view` restrita a valores conhecidos (`month`, `week`, `day`, `agenda`). Parâmetros de UI não devem ser repassados ao backend, que aceita apenas `from`/`to` nesse endpoint.

Fluxo de leitura:

1. Server Component valida os search params; parâmetros ausentes usam defaults seguros.
2. Obtém o usuário/fuso e calcula o período visível.
3. Busca o calendário real pela DAL.
4. Envia dados serializáveis públicos ao `CalendarClient`.
5. Próximo/anterior/hoje mudam a URL pelo router/Link; o servidor carrega o novo intervalo. Mostre transição/loading sem exibir atividades do intervalo antigo sob o título novo.

Use dados recebidos por props como fonte de leitura; não faça uma segunda busca idêntica no mount. Não copie a lista de props para `useState` sem definir como novas props substituem esse snapshot. Estado local fica para seleção, drafts e interação.

Fluxo de mutação:

1. O formulário chama a Server Action apropriada e impede envio duplicado.
2. A action valida entrada/sessão, chama a DAL e devolve resultado tipado.
3. Em sucesso, invalida os caminhos afetados com `revalidatePath` quando pertinente; o client fecha/atualiza o editor e chama `router.refresh()` se precisar obter a leitura atual. Evite disparar duas atualizações equivalentes quando o retorno da action já atualizou a rota.
4. Erro preserva os campos preenchidos. Não apresentar sucesso antes da confirmação do servidor nesta primeira implementação.
5. Se a gravação concluir e a atualização visual falhar, informar essa diferença; não reenviar a gravação automaticamente.

`router.refresh()` atualiza Server Components, mas preserva estado client não afetado; por isso a política de props/drafts acima é necessária. Ele não invalida sozinho caches do servidor. [Referência do router](https://nextjs.org/docs/app/api-reference/functions/use-router).

Comece sem cache persistente por intervalo e sem otimização especulativa. Se mais tarde houver necessidade comprovada de cache no client, defina invalidação antes de adicioná-lo: reagendamento afeta origem/destino; split/end afetam períodos futuros; aplicação de modelo afeta a semana; logout troca a sessão e precisa descartar os dados anteriores. Uma coleção global de dados não pode sobreviver inadvertidamente à troca de sessão.

Listas de modelos e segmentos usam paginação real do backend. Não carregar todas as páginas para fingir paginação client. Filtros locais de status/tipo no calendário devem dizer respeito apenas ao período carregado e não gerar query não suportada.

## 9. Componentes e direção visual

Crie uma interface de planejamento pessoal. O calendário e as atividades são o centro da aplicação; não criar uma landing page ou dashboard de métricas fictícias como tela principal.

Antes de montar as telas, implemente os tokens da paleta escolhida abaixo e defina uma escala de espaçamento, raios e tipografia. Registre a direção visual e execute-a com consistência. Pode usar uma família de fonte legível para toda a ferramenta; números/horários podem usar algarismos tabulares. Evite uma dependência de download externo de fonte para conseguir iniciar a aplicação.

O elemento característico deve servir ao produto: organização clara do tempo, destaque do dia atual e leitura rápida de categoria/status. Não empilhar cartões decorativos, cores aleatórias por atividade ou animações que atrasem o uso. Rótulos e mensagens em português do Brasil.

### Paleta escolhida

A paleta clara do Chrono foi definida pelo usuário: azul petróleo como cor principal, pendente em amarelo, em andamento em azul, concluído em verde e cancelado em vermelho. Centralize as cores em variáveis CSS integradas aos tokens do Tailwind, sem espalhar valores hexadecimais pelos componentes.

| Token             | Cor       | Aplicação                                             |
| ----------------- | --------- | ----------------------------------------------------- |
| `background`      | `#F4F7FA` | Fundo geral                                           |
| `surface`         | `#FFFFFF` | Calendário, painéis e formulários                     |
| `primary`         | `#155E75` | Ações principais e seleção                            |
| `primary-hover`   | `#164E63` | Hover de ações principais                             |
| `primary-soft`    | `#E0F2FE` | Fundo de seleção                                      |
| `text-primary`    | `#172B3A` | Texto principal                                       |
| `text-secondary`  | `#526575` | Texto secundário                                      |
| `border`          | `#DCE5EC` | Bordas e linhas da grade                              |
| `text-on-primary` | `#FFFFFF` | Texto sobre a cor principal                           |
| `focus-ring`      | `#155E75` | Indicador de foco, com separação visual da superfície |

| Status        | Token de texto/ícone | Cor       | Token de fundo            | Cor       |
| ------------- | -------------------- | --------- | ------------------------- | --------- |
| `PENDING`     | `status-pending`     | `#854D0E` | `status-pending-soft`     | `#FEF9C3` |
| `IN_PROGRESS` | `status-in-progress` | `#1D4ED8` | `status-in-progress-soft` | `#EFF6FF` |
| `COMPLETED`   | `status-completed`   | `#047857` | `status-completed-soft`   | `#ECFDF5` |
| `CANCELED`    | `status-canceled`    | `#B91C1C` | `status-canceled-soft`    | `#FEF2F2` |

Regras de aplicação:

- Destacar **hoje** com o número branco sobre azul petróleo. Não usar amarelo para hoje, pois amarelo identifica pendência.
- Distinguir o **dia selecionado** com fundo azul claro e contorno azul petróleo. Se também for hoje, preservar o marcador do número e aplicar a seleção à célula.
- Aplicar cores de status em badges, ícones e pequenos indicadores, mantendo a grade predominantemente neutra. Usar as cores escuras da tabela para texto sobre os fundos suaves correspondentes.
- Acompanhar status com texto ou ícone identificável, sem depender exclusivamente de cor.
- Diferenciar tarefa e evento por ícone e rótulo; não criar outra codificação de cores que concorra com os status.
- Usar tokens semânticos separados para erros e ações destrutivas, mesmo que reutilizem o vermelho `#B91C1C` e o fundo `#FEF2F2` dos cancelados. Texto e ícone distinguem os contextos.
- Definir hover, foco, seleção, envio e desabilitado de forma consistente. Não usar a borda suave da grade como único indicador de foco ou único limite necessário à identificação de um controle.
- Validar contraste e legibilidade nas combinações efetivas, incluindo controles, foco e estados. Não tornar texto de botões desabilitados desnecessariamente ilegível.
- Se já existir tema escuro, definir valores próprios para seus tokens e validar contraste; não reutilizar automaticamente os fundos desta paleta clara. Tema escuro não é requisito adicional desta entrega.

### Padrão dos componentes

- Props TypeScript explícitas e sem `any` para contornar contratos.
- Componentes básicos reutilizáveis ficam em `components/ui`; comportamento de domínio fica em componentes do módulo.
- Preserve atributos HTML nativos. Em `Button`, use `variant` para aparência e reserve `type` para `button | submit | reset`, evitando confusão entre estilo e comportamento do formulário.
- Inputs com label, descrição opcional, erro associado por `aria-describedby` e `aria-invalid` quando necessário.
- Não duplicar classes extensas de botão/input em cada tela; centralizar variantes e tokens.
- Preferir controles nativos quando atendem ao caso. Um select customizado exige navegação de teclado/foco correta; não trocar um `<select>` por divs apenas por aparência.
- Context apenas para informação compartilhada de UI que realmente precise disso; não guardar a base inteira de atividades em contexto global.
- Evitar links/botões aninhados dentro de um botão de card. Ações secundárias devem ter foco e nomes acessíveis próprios.

### Diálogos e feedback

Use painel lateral ou diálogo conforme o espaço e o fluxo, sem transformar toda informação em modal. Para diálogo próprio, prefira `<dialog>` quando apropriado ou implemente integralmente o comportamento equivalente: nome acessível, foco inicial, foco contido, Escape, retorno do foco ao acionador e bloqueio de interação com o fundo. Verifique o comportamento no browser.

Confirmações devem explicar a ação: excluir evento, arquivar modelo, encerrar recorrência e redefinir ocorrência têm efeitos diferentes. Não usar a mesma mensagem genérica para todos.

Prever estados de carregamento, vazio, erro, reenvio, sucesso e indisponibilidade. Ícones isolados têm nome acessível; estado não pode depender apenas de cor. Foco visível, navegação por teclado, contraste adequado, zoom de 200%, títulos longos e `prefers-reduced-motion` fazem parte da entrega.

No mobile, ajustar a estrutura: toolbar organizada, agenda legível, editor ocupando o espaço necessário e ações acessíveis. Uma grade semanal pode ter rolagem horizontal controlada, com opção de dia/agenda; não comprimir sete colunas até ficarem inutilizáveis.

## 10. Calendário próprio

Implemente o calendário com React, HTML e CSS Grid/Flex, sem biblioteca de calendário pronta. Separe cálculos de apresentação em funções puras, fora dos componentes.

Componentes sugeridos: `CalendarToolbar`, `MonthView`, `WeekView`, `DayView`, `AgendaView`, `DayCell`, `TimeAxis`, `AllDaySection`, `ActivityCard`, `ActivityEditor` e `RecurringScopeDialog`.

Requisitos:

- Navegação próximo/anterior/hoje, seleção de data e alternância mensal/semanal/diária/agenda.
- Semanas começando na segunda-feira.
- Mês exibe os dias necessários para completar suas semanas; consultar também os dias adjacentes exibidos, respeitando anos/limites da API.
- Semana/dia separam atividades sem horário da grade horária.
- Eventos simultâneos permanecem acessíveis; calcular colunas para sobreposição sem esconder atividades. Ordenar de forma determinística com `calendarKey` como desempate.
- Atividades com início e sem fim são válidas. Podem ter altura visual mínima, mas não inventar/persistir duração ou `endTime` inexistente.
- Em células mensais densas, mostrar quantidade restante e permitir abrir a lista completa do dia.
- Clique em dia/horário abre criação com defaults correspondentes; clique em atividade abre detalhe/edição.
- Status concluído/cancelado continua disponível; filtros locais podem ocultá-lo por escolha explícita.
- `calendarKey` identifica visualmente a atividade. Não depender de `id`, pois ocorrências virtuais têm `id: null`.
- Não renderizar anos inteiros de grade horária; buscar/desenhar o período visível.

Arrastar e redimensionar não são obrigatórios nesta entrega inicial. Reagendamento por formulário deve funcionar integralmente. Não mostrar alças, cursores ou instruções de drag se essa interação não estiver implementada. Se o usuário solicitar drag depois, definir acessibilidade por teclado, toque, confirmação de escopo recorrente e atualização/rollback antes de adicionar.

### Datas e fuso

- Manter `DateOnly` como `YYYY-MM-DD` e horário como `HH:mm` no estado de negócio da UI.
- Não usar `new Date('YYYY-MM-DD')` seguido de getters locais para dias do calendário; isso pode deslocar a data no fuso local.
- Para aritmética civil, implementar helpers que operem consistentemente em UTC/componentes, com parsing/round-trip validado. Tratar o comportamento especial dos construtores JavaScript nos anos 0–99; o contrato admite 0001–9999.
- Calcular “hoje” no fuso retornado pelo usuário/API, não implicitamente no fuso da máquina do navegador ou servidor. Para o primeiro render, compartilhar a mesma referência temporal entre servidor/client, evitando diferenças de hidratação.
- Instantes como `completedAt` são diferentes: podem ser formatados com `Intl.DateTimeFormat` no fuso do planejamento.
- Não converter automaticamente horários locais em timestamps UTC nem adicionar sufixo `Z` aos horários enviados.
- A recorrência já vem expandida da API. O frontend calcula a grade visível, não recalcula regras de recorrência.
- Não permitir navegação que gere datas fora de 0001–9999 ou consulta superior a 366 dias. Nas bordas do calendário, ajustar células adjacentes sem produzir datas inválidas.

## 11. Fluxos funcionais e detalhes de integração

### Atividades concretas

Criar, consultar, editar parcialmente, concluir, reabrir, cancelar e excluir eventos/tarefas. Mostrar a distinção entre categoria `type` e origem `source`. Atividades copiadas de modelos também são eventos concretos editáveis.

Manter a semântica dos status e de `completedAt` controlada pelo backend. Não enviar valores gerenciados pelo servidor. Não impor sequência obrigatória de status que a API não exige.

### Ocorrências individuais

Oferecer edição “somente esta ocorrência” com data de exibição, status, conteúdo e horários. Usar `recurringEventId` e `occurrenceDate` original nas rotas; `date` pode ser o reagendamento.

O backend não retorna os overrides brutos. Portanto:

- Exibir os valores resolvidos, mas não afirmar que conhece quais campos estão personalizados.
- Iniciar a edição com semântica “manter como está” para cada campo. Enviar somente campos efetivamente alterados.
- Disponibilizar comandos explícitos “usar valor da recorrência”, que enviam override nulo.
- Descrição personalizada vazia usa `""`; descrição nula herda.
- Para remover horários somente desta ocorrência, enviar `timeOverride: { startTime: null, endTime: null }`; `timeOverride: null` significa herdar horários.
- Se editar horários, enviar o par completo exigido por `timeOverride`.
- Para desfazer somente o reagendamento, enviar `scheduledDate` igual à data original. Não existe `scheduledDate: null`.
- “Restaurar ocorrência” exclui todo o estado, inclusive conclusão/reagendamento, e deve informar esse efeito antes de chamar DELETE `/state`.

Não salvar todos os valores resolvidos como overrides ao abrir/confirmar um formulário sem alterações: isso congela a herança e cria estados que podem bloquear operações futuras.

### Recorrências

Criar e listar segmentos/regras com paginação, consultar detalhe, editar “esta e as próximas” por split e encerrar por data.

- Formular campos de frequência, intervalo, início e término como sem fim/até data/quantidade, enviando combinações válidas.
- Regras não possuem status de atividade; status é da ocorrência.
- Split precisa de uma ocorrência original válida e limite hoje/futuro no fuso do usuário. Quando iniciado na lista de regras, obter datas candidatas pelo calendário ou deixar a API validar uma data informada; não presumir que toda data é ocorrência.
- Não inferir “último segmento” apenas dos registros da página atual da listagem. Um sucessor pode estar em outra página; a API decide e pode retornar `SERIES_ALREADY_SPLIT`.
- Depois de split, considerar o novo ID de segmento e recarregar dados afetados. A âncora original não é necessariamente `effectiveFrom`.
- Não inventar reabertura, exclusão física ou alteração direta por PATCH da regra.
- End usa qualquer dia permitido como limite, não necessariamente uma ocorrência. Explicar que o limite exclui novas datas originais a partir dele, preservando histórico anterior.
- Em `OCCURRENCE_CONFLICT`, mostrar as datas/status e preservar o draft. Não limpar estados automaticamente. Se oferecer redefinição explícita, explicar a perda de personalização/conclusão/reagendamento; executar somente após escolha do usuário e tratar falhas parciais, pois vários resets são operações separadas.

### Modelos semanais

Listar, criar, consultar, editar, arquivar e aplicar modelo a uma semana.

- Editor de itens com weekday, tipo, título, descrição e horários; permite lista vazia e respeita 200 itens.
- No frontend, usar chave temporária estável para itens novos; essa chave não vai no payload.
- PATCH de `items` substitui a lista inteira. IDs recebidos servem à UI, não devem ser enviados como campos de entrada.
- Aplicação exige segunda-feira. Pode oferecer seleção de qualquer dia e mostrar explicitamente a segunda-feira calculada antes de confirmar a semana.
- Tratar tanto 201 quanto 200 e `alreadyApplied`; repetição não é erro e não recria eventos apagados.
- Arquivar preserva eventos já criados; mostrar essa consequência. Não apresentar botão de restauração sem suporte da API.
- Depois de aplicar, oferecer navegar à semana e atualizar o calendário. Não garantir ordenação dos eventos retornados por reaplicação; ordenar na UI quando necessário.

### Mapa de cobertura

O contrato completo continua nos documentos do backend. Este mapa serve para conferir que há uma utilização adequada para as operações relevantes.

| Backend                                                          | Uso no frontend                                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `GET /health`                                                    | Diagnóstico de conexão opcional; não é autenticação nem prontidão contínua do banco       |
| `POST /auth/login`                                               | Server Action de login                                                                    |
| `GET /auth/me`                                                   | Identidade/fuso e verificação de sessão no servidor                                       |
| `GET /calendar`                                                  | Todas as visualizações do calendário                                                      |
| `GET /events`                                                    | Consulta somente de eventos concretos, se necessária; não substituir calendário unificado |
| `POST /events`                                                   | Criar atividade concreta                                                                  |
| `GET /events/:id`                                                | Detalhe atualizado para edição                                                            |
| `PATCH /events/:id`                                              | Conteúdo, data, horários e status                                                         |
| `DELETE /events/:id`                                             | Excluir evento, resposta 204                                                              |
| `GET /week-templates`                                            | Lista paginada de modelos ativos                                                          |
| `POST /week-templates`                                           | Criar modelo com itens                                                                    |
| `GET /week-templates/:id`                                        | Detalhe/edição de modelo                                                                  |
| `PATCH /week-templates/:id`                                      | Editar nome/substituir itens                                                              |
| `DELETE /week-templates/:id`                                     | Arquivar, resposta 204                                                                    |
| `POST /week-templates/:id/apply`                                 | Aplicação idempotente por modelo/semana                                                   |
| `GET /recurring-events`                                          | Lista paginada de segmentos, incluindo histórico                                          |
| `POST /recurring-events`                                         | Criar recorrência                                                                         |
| `GET /recurring-events/:id`                                      | Consultar definição do segmento                                                           |
| `POST /recurring-events/:id/split`                               | Editar esta ocorrência e as próximas                                                      |
| `POST /recurring-events/:id/end`                                 | Encerrar a partir de uma data                                                             |
| `GET /recurring-events/:id/occurrences/:occurrenceDate`          | Detalhe resolvido da ocorrência                                                           |
| `PATCH /recurring-events/:id/occurrences/:occurrenceDate`        | Personalização/status individual                                                          |
| `DELETE /recurring-events/:id/occurrences/:occurrenceDate/state` | Restaurar ocorrência, resposta 200 com JSON                                               |

Não criar páginas artificiais para cada endpoint: eventos concretos e ocorrências podem ser gerenciados pelo calendário. Health e lista exclusiva de eventos não exigem telas próprias nem chamadas redundantes.

## 12. Sequência de execução

Execute por etapas verificáveis, continuando até a entrega:

1. **Inspeção e decisões:** ler os três documentos, conferir projeto existente e registrar um plano curto de arquivos/fluxos. Resolver detalhes rotineiros usando este padrão; perguntar somente quando faltar uma informação realmente impeditiva.
2. **Fundação:** configuração Next/TS/Tailwind, tokens, layout, componentes básicos, tipos públicos, ambiente privado e scripts.
3. **Servidor e sessão:** DAL, interpretação de erros, login, cookie HttpOnly, proteção de entradas e logout local. Validar que o JWT não atravessa a fronteira client.
4. **Calendário e eventos:** carregamento server-side, navegação por URL, mês/semana/dia/agenda, criação/edição/status/exclusão com API real.
5. **Recorrências e modelos:** editores, ocorrências, split/end/conflitos, modelos com itens e aplicação. Preservar as diferenças entre operações de domínio.
6. **Acabamento e integração:** responsividade, teclado, erros de formulário, carregamentos, estados vazios, falhas de rede, revisão de payloads e atualização após mutações.
7. **Verificação e entrega:** executar os checks proporcionais, inspecionar no navegador, corrigir problemas encontrados e registrar instruções de execução/limitações reais.

Não parar ao fim da fundação apresentando funcionalidades restantes como concluídas. Se backend/credenciais estiverem indisponíveis, continuar o trabalho independente e registrar quais fluxos não puderam ser verificados. Não mascarar isso com dados fictícios na aplicação final.

Não publicar, fazer deploy, criar commit ou alterar o backend sem solicitação correspondente. Não depender de alterações no TrackAssets.

## 13. Execução local e configuração do repositório

Entregar scripts equivalentes a:

```json
{
  "dev": "next dev -p 3001",
  "build": "next build",
  "start": "next start -p 3001",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "check": "yarn lint && yarn typecheck"
}
```

Instalação e execução documentadas no README do frontend:

```text
yarn install
copiar .env.example para .env.local e configurar API_BASE_URL
iniciar o backend conforme o README dele
yarn dev
```

Separar os requisitos de rodar o frontend daqueles de preparar o banco/seed do backend. Nunca incluir senha real no README. Explicar que o login depende de proprietário já configurado no backend.

Versionar código, configurações, `.env.example` e `yarn.lock`. Ignorar `.env`/variantes locais com exceção do exemplo, `node_modules`, `.next`, `out` se usado, logs, temporários e `*.tsbuildinfo`. Definir LF em `.gitattributes` e alinhar o formatter. Não copiar cegamente o `.gitignore` do backend, pois os artefatos do Next são diferentes.

A aplicação usa recursos do servidor Next: não configurar exportação puramente estática (`output: 'export'`). O ambiente de execução deverá suportar Next no servidor.

## 14. Validação e critérios de aceite

**Não criar testes automatizados nem suítes de testes para esta tarefa de frontend, salvo pedido explícito posterior do usuário.** Não instalar Vitest, Jest, Playwright ou Cypress para criar testes. Testes existentes podem ser executados quando pertinentes. Essa restrição não impede inspeção manual no navegador nem verificações de TypeScript, lint e build.

Execute `yarn typecheck`, `yarn lint` e `yarn build` após a implementação, conforme scripts disponíveis, sem desabilitar regras ou ignorar erros para obter sucesso. Inspecione a aplicação em desktop e mobile, com console/rede quando possível. Para alterações de dados durante verificação, use registros de teste claramente identificados e não apague/reescreva dados pessoais existentes.

Critérios de aceite:

- Login real funciona; usuário/fuso vêm da API; reload mantém sessão e expiração volta ao login sem loop.
- Token não aparece em localStorage, respostas públicas, props ou bundle; requests ao backend ocorrem no servidor Next.
- Calendário começa com dados carregados no servidor e navega sem duplicar a requisição inicial no client.
- Quatro visualizações próprias funcionam, incluindo vazio, sobreposição, atividades sem horário e início sem fim.
- Datas continuam corretas com fuso de navegador diferente do planejamento, virada de mês/ano e anos bissextos.
- Atividades concretas permitem todas as operações previstas; 204 é tratado sem falha de JSON.
- Ocorrência virtual com ID nulo abre/edita corretamente; reagendamento preserva identidade original e atualiza a tela.
- Edição parcial não cria overrides de campos intocados; herança, remoção de horários e reset têm comportamento distinto.
- Split/end respeitam os limites da API; conflitos aparecem sem apagar estados automaticamente.
- Modelos permitem edição e aplicação; repetição não duplica atividades e arquivamento não remove cópias existentes.
- Listas respeitam paginação e filtros reais; campos extras de UI não são enviados à API.
- Falhas mantêm drafts e diferenciam sessão, validação, conflito e indisponibilidade.
- Interface é usável por teclado e em tela pequena; diálogos têm foco correto; não há controles decorativos sem ação.
- Não há dependências rejeitadas, endpoints inventados, integração simulada permanente ou alterações indevidas no backend.
- README do frontend contém setup, ambiente, comandos e decisões de arquitetura. Relatório final lista o que foi implementado, verificações executadas e limitações efetivamente encontradas.

Referência adicional para as fronteiras de componentes: [Server e Client Components no Next](https://nextjs.org/docs/app/getting-started/server-and-client-components). Use documentação compatível com a versão instalada para detalhes de API; preserve as decisões e o contrato deste projeto.
