# Frontend — Marketplace Agricultura Familiar (Fases A + B + C + D)

Frontend em **HTML + CSS + JavaScript puro**, sem build, sem bundler, sem dependências externas. Consome o backend REST descrito em `API.md`, rodando em `http://localhost:3000/api`.

**Fase B adicionou** carrinho por par cliente-agricultor (RF07), chat com polling (RF08, RF12) e envio do carrinho como snapshot imutável para o chat.

**Fase C adicionou** a área de gestão do agricultor: edição do próprio perfil com foto (RF03), CRUD de produtos com foto (RF05), soft delete (RF04) e seleção de categoria a partir do catálogo fixo (RF06). Tudo plugado em cima das Fases A/B, sem reescrever páginas que já funcionavam.

**Fase D fecha o ciclo do produto** com pedidos e avaliações: agricultor gera pedido a partir de um snapshot recebido no chat (RF13), ambos os lados acompanham o status (pendente → confirmado → entregue), e quando entregue o cliente avalia o agricultor (RF11). Sem reescrever nada das fases anteriores — apenas o botão "Gerar pedido" do chat foi ativado.

---

## Como rodar

1. **Descompactar** o `frontend.zip` em qualquer pasta.
2. **Subir o backend** do projeto em `http://localhost:3000` (ver README do backend; basicamente `npm install`, `npm run db:init` e `npm run dev`).
3. **Servir os arquivos estáticos.** Você pode tentar abrir o `index.html` direto, mas alguns navegadores bloqueiam ES modules via `file://`. O caminho garantido é servir por HTTP:
   ```bash
   cd frontend
   python3 -m http.server 5500
   # ou
   npx serve .
   ```
4. Abrir `http://localhost:5500` no navegador.

Se quiser apontar para outro backend (ex.: porta diferente), edite a constante `BASE_URL` no topo de `api.js`.

---

## Estrutura de pastas

```
frontend/
├── index.html                  # Único HTML. Carrega styles.css e main.js.
├── styles.css                  # CSS puro com tokens em :root (verde orgânico).
├── main.js                     # Entrypoint. Configura router, header e listeners de auth.
├── api.js                      # Wrapper de fetch. Declara TODOS os endpoints do API.md.
├── auth.js                     # Helpers de localStorage: getToken/setToken/getUser/logout.
├── router.js                   # Hash router à mão (~150 linhas): register, navigate, params.
├── ui.js                       # Helpers DOM: el(), criarAvatar(), formatarMoeda(), formatarHora(), toast()…
│                               #   Fase C: lerArquivoComoBase64() e campoUploadFoto().
│                               #   Fase D: renderEstrelasInterativas() para o form de avaliação.
└── pages/
    ├── login.js                # POST /auth/login
    ├── registro.js             # POST /auth/register (com radio cliente/agricultor)
    ├── agricultores-lista.js   # GET /agricultores com filtros q/cidade/estado + paginação
    ├── agricultor-perfil.js    # GET /agricultores/:id + .../produtos + .../avaliacoes
    │                           #   Fase B: botões "Abrir conversa", "Ver carrinho", "Adicionar ao carrinho" ativos.
    ├── carrinho.js             # Fase B — RF07: GET/PATCH/DELETE carrinho + envio de snapshot.
    ├── conversas-lista.js      # Fase B — RF08/RF12: GET /conversas.
    ├── conversa.js             # Fase B — RF08: chat com polling 3s + bolha de snapshot.
    │                           #   Exporta renderConversa (#/conversas/:id) e renderConversaCom (#/conversas/com/:outroId).
    │                           #   Fase D: botão "Gerar pedido" da bolha de snapshot foi ATIVADO — abre modal.
    ├── meu-perfil.js           # Fase C — RF03: GET/PATCH /agricultores/me com upload de foto.
    ├── meus-produtos.js        # Fase C — RF04/RF05/RF06: lista + modal de criar/editar produto.
    ├── pedidos-lista.js        # NOVO (Fase D) — RF13: GET /pedidos com chips de filtro por status.
    │                           #   Exporta renderStatusBadge() reutilizada pelo detalhe.
    ├── pedido-detalhe.js       # NOVO (Fase D) — RF13: GET /pedidos/:id + ações por role × status.
    │                           #   Detecta avaliação já feita via GET /agricultores/:id/avaliacoes.
    ├── modal-gerar-pedido.js   # NOVO (Fase D) — RF13: modal sobreposto disparado pelo botão da bolha
    │                           #   de snapshot do chat. POST /pedidos.
    ├── modal-avaliacao.js      # NOVO (Fase D) — RF11: modal de avaliar agricultor (1–5 estrelas + comentário).
    │                           #   Backend faz upsert por par (cliente, agricultor).
    └── em-breve.js             # Placeholder genérico. Não há mais rotas que o usem após a Fase D;
                                #   mantido pra futuras fases / 404s temporários.
```

**O que importa saber arquivo por arquivo:**

- `index.html` define só o esqueleto: um `<header id="app-header">` e um `<main id="app">` onde as páginas são renderizadas.
- `styles.css` concentra todos os estilos. Tokens em `:root`. Sem inline styles em lugar nenhum exceto width/height do avatar gerado dinamicamente. Fase B adiciona seções `/* Toast */`, `/* Adicionar ao carrinho */`, `/* Carrinho */`, `/* Conversas — lista */`, `/* Conversa — tela de chat */`, `/* Conversa — bolhas */`, `/* Snapshot bubble */`, sem mexer nas existentes.
- `main.js` é o orquestrador. Registra todas as rotas (inclusive os placeholders das Fases C/D que ainda não foram implementadas), define guards por role, monta o header global e ouve dois eventos: `auth:expired` (disparado pelo `api.js` em qualquer 401) e `auth:changed` (disparado quando login/logout ocorre). **Atenção:** a rota `#/conversas/com/:outroId` é registrada **antes** de `#/conversas/:id` para o router não casar errado — o regex de `/:id` aceitaria `"com"` como id.
- `api.js` tem `BASE_URL` no topo e uma função `request(method, path, body?, query?)` que centraliza headers, Authorization, parse de JSON e erro estruturado `{ status, code, message, details }`. Em 401 dispara `auth:expired`. Exporta **todas** as 24 funções da API (não só as das fases atuais) — as fases futuras consomem direto sem mexer aqui. **Não foi alterado na Fase B.**
- `auth.js` é trivial: persiste `roca:token` e `roca:user` em `localStorage`. **Não foi alterado na Fase B.**
- `router.js` parseia `#/agricultores/:id?q=foo` em `{ params: {id}, query: {q} }`. `navigate(hash)` para programaticamente, `replace(hash)` para redirects sem entrar no histórico. **Não foi alterado na Fase B.**
- `ui.js` centraliza criação de DOM sem `innerHTML` (segurança contra XSS). `criarAvatar(nome, fotoId, tamanho)` resolve o fallback de inicial automaticamente. Fase B adiciona `formatarHora(iso)` (HH:mm para as bolhas) e `toast(texto, {tipo, ms, children})` (notificação efêmera no canto inferior direito).
- `pages/carrinho.js` (Fase B) — header com avatar+nome do agricultor (linkado ao perfil), lista de itens com foto, input de quantidade **debounced em 400ms** chamando `atualizarItemCarrinho`, subtotal, lixeira para remover, total destacado embaixo, botões "Continuar comprando" / "Enviar para o agricultor", e "Limpar carrinho" como ghost no rodapé com `confirm()` antes de chamar `limparCarrinho`. O backend devolve `{id:null, itens:[]}` quando o carrinho não existe — tratado como estado vazio, sem erro.
- `pages/conversas-lista.js` (Fase B) — card simples por conversa: avatar do outro lado (fallback de inicial, já que `GET /conversas` não devolve foto), nome, preview da última mensagem truncado em 60 chars (snapshots aparecem como `📦 Snapshot do carrinho`), data.
- `pages/conversa.js` (Fase B) — a tela mais complexa. Exporta dois handlers: `renderConversa` para `#/conversas/:id` e `renderConversaCom` para `#/conversas/com/:outroId`. O segundo resolve via `listarConversas`: se achar conversa existente, faz `router.replace`; se não, abre um **pré-rascunho** — tela renderizada com lista vazia e o form de envio, sem `conversa_id`. A primeira chamada de `enviarMensagem(outroId, ...)` cria a conversa no backend e a página faz `history.replaceState` pra `#/conversas/<novoId>` (sem disparar hashchange, então o polling sobrevive à transição). Bolhas alinhadas pela direita/esquerda conforme `remetente_id === user.id`, separadores de dia entre grupos, snapshot renderizado como bolha especial (máx 5 itens visíveis + "+ N itens", total destacado, botão "Gerar pedido" só pra agricultor recebendo, desabilitado com tooltip "Disponível na Fase D"). **Polling a cada 3s** com `setInterval`, parado via `hashchange { once: true }` + `MutationObserver` no outlet, idempotente. Auto-scroll ao final ao montar e ao chegar mensagem nova. Sem `innerHTML`.

---

## Como testar

### Fase A — fluxo manual

Backend precisa estar rodando em paralelo.

1. **Subir o backend** e popular ao menos um agricultor + um produto. O `README.md` do backend tem um fluxo end-to-end via curl no item (f) que cria tudo em minutos.
2. **Abrir** `http://localhost:5500` → você cai na lista de agricultores (rota pública).
3. **Cadastrar um cliente novo**: clique em "Cadastrar" no header. Preencha nome/email/senha, escolha **Cliente**, submeta. O frontend já loga e redireciona para a lista.
4. **Filtrar agricultores**: na lista, digite parte do nome em "Buscar por nome" ou uma UF e clique em "Filtrar". A URL muda para `#/agricultores?q=...` e a paginação se mantém.
5. **Abrir um perfil**: clique em qualquer card. Você vê o header com avatar + descrição + estrelas, a grade de produtos e a lista de avaliações. **Agora (Fase B)** os botões "Abrir conversa" / "Ver carrinho" / "Adicionar ao carrinho" estão ATIVOS — veja o fluxo abaixo.
6. **Logout**: clique em "Sair" no header. Token sai do `localStorage` e os links públicos voltam.
7. **Testar redirect por role**: registre um **Agricultor**. Após criar conta o sistema redireciona para `#/meu-perfil`, que renderiza o placeholder "Em breve — Fase C". Mesmo placeholder genérico aparece em `#/meus-produtos`, `#/pedidos` etc — agora apenas Fases C/D.
8. **Testar token expirado**: no DevTools, sobrescreva `localStorage.setItem('roca:token','xxx')` e tente acessar uma rota que faz request autenticado. O `api.js` recebe 401, dispara `auth:expired`, o frontend desloga e te manda pro login.

### Fase B — fluxo end-to-end carrinho → snapshot → chat em tempo real

Pré-requisito: existir **pelo menos um agricultor** com produtos cadastrados (o fluxo (f) do README do backend serve). Você vai precisar de **duas abas** abertas em paralelo para ver o chat em tempo real, ou pode rodar tudo numa só pulando o passo 8.

1. **Cliente abre o perfil de um agricultor.** Logue como cliente (registre um se preciso), navegue até `#/agricultores`, clique num card. Você cai em `#/agricultores/<id>`.
2. **Adicionar produto ao carrinho.** No card de um produto, clique em **"Adicionar ao carrinho"** — o card expande um campo de quantidade (`min=0.01`, `step=0.01`, default `1`) e dois botões "Adicionar" / "Cancelar". Submeta. Um toast verde "Item adicionado ao carrinho" aparece no canto inferior direito; o card mostra "✓ Adicionado ao carrinho" + link "Ver carrinho".
3. **Abrir o carrinho.** Clique em "Ver carrinho" (no card OU no header do perfil). Você vai para `#/carrinho/<agricultorId>`. Veja:
   - foto + nome + preço unitário,
   - input de quantidade editável: muda o valor e espere ~400ms — o subtotal e o total atualizam sozinhos (PATCH debounced),
   - botão lixeira remove o item,
   - "Limpar carrinho" (rodapé, ghost) pede `confirm()` antes de chamar `DELETE /carrinho/:id`.
4. **Enviar para o agricultor.** Botão grande **"Enviar para o agricultor"**. O frontend chama `POST /conversas/com/:agricultorId/snapshot`, recebe `{ conversa_id, mensagem }` e navega direto para `#/conversas/<conversaId>`. Você já cai na conversa **com a bolha de snapshot visível** alinhada à direita, listando os itens (até 5 + "+ N itens" se passar), total destacado, hora de envio.
5. **(opcional)** Mande uma mensagem de texto pelo input no rodapé da conversa: "tem entrega pra Campinas?". A bolha aparece em cima da snapshot, também à direita.
6. **Abrir outra aba como o agricultor destinatário.** Logue como ele em `http://localhost:5500/#/login`. No header, clique em **"Conversas"** → você vê a conversa com o cliente, preview "📦 Snapshot do carrinho", data.
7. **Abrir a conversa.** Clique no card. Você cai em `#/conversas/<conversaId>` e vê a snapshot recebida (alinhada à esquerda, título "📦 Carrinho recebido") com o botão **"Gerar pedido"** desabilitado/tooltip "Disponível na Fase D".
8. **Verificar polling em tempo real.** Volte à aba do cliente, envie uma nova mensagem de texto. **Em até 3 segundos** ela aparece sozinha na aba do agricultor, sem refresh. (Confirme em DevTools → Network → vê requests GET `/conversas/:id/mensagens?desde=...` saindo a cada 3s.)
9. **Sair da conversa e verificar que o polling para.** Clique em "← Voltar" ou navegue pra outra rota. Em DevTools → Network, as requisições a cada 3s **devem parar imediatamente**. Se não pararem, é bug — o teardown (`hashchange { once: true }` + `MutationObserver`) falhou.
10. **Fluxo alternativo: abrir conversa diretamente do perfil.** Como cliente OU agricultor, abra `#/agricultores/<id>` de qualquer outro usuário e clique em **"Abrir conversa"**. Se já existir, você cai na rota canônica `#/conversas/<id>` (resolvido via `listarConversas`). Se ainda não existir, abre o **pré-rascunho** — tela vazia com o form pronto; a primeira mensagem enviada cria a conversa no backend e a URL é atualizada para `#/conversas/<novoId>` sem perder o estado nem reiniciar o polling.

### Fase C — fluxo end-to-end área do agricultor

Pré-requisito: backend rodando com pelo menos as 8 categorias seedadas (o `npm run db:init` do backend já faz isso). Você pode rodar tudo em **uma aba só**, mas abrir uma **segunda aba pública** ajuda no passo 7 para ver o perfil refletindo as mudanças sem precisar deslogar.

1. **Registrar (ou logar) como agricultor.** Em `#/registro`, escolha "Agricultor — quero vender", preencha e submeta. Após criar conta o sistema redireciona pra `#/meu-perfil` (que agora NÃO é mais placeholder).
2. **Editar o perfil.** Você cai num formulário com avatar genérico (inicial do nome) à esquerda do título, e abaixo um único form com: nome, telefone, descrição (textarea com contador `0/600`), cidade, UF (auto-uppercase, máx 2 chars), CEP (máscara `00000-000`), latitude/longitude (number com step `0.000001`) e upload de foto de perfil. Preencha tudo, escolha uma imagem JPG/PNG (a área de preview troca pra mostrar a nova foto antes de salvar), submeta. **Toast verde "Perfil atualizado"** aparece. O nome no header global muda na hora (via `setUser` + evento `auth:changed`).
3. **Submit "sem mudanças".** Clique em "Salvar alterações" sem mexer em nada → **toast azul "Nada a salvar"**, sem chamada HTTP (confira em DevTools → Network). Esse comportamento existe porque o submit monta um PATCH só com o diff em relação ao estado inicial.
4. **Validações client-side.** Tente: UF com 1 letra → erro "UF deve ter exatamente 2 letras"; CEP com 7 dígitos → erro "CEP inválido"; latitude > 90 → erro "Latitude deve estar entre -90 e 90"; descrição com mais de 600 chars → o textarea trunca via `maxlength`. Nenhuma requisição sai do navegador nesses casos.
5. **Ir pra "Meus produtos".** Clique no link "Meus produtos" no header ou no botão "Voltar ao painel" no rodapé do form. Você cai em `#/meus-produtos` — pra um agricultor recém-criado, vai ver o estado vazio "Você ainda não cadastrou produtos." + botão grande "Cadastrar primeiro produto".
6. **Criar 3 produtos com fotos diferentes.** Clique no botão "+ Novo produto" (top-right) ou no botão grande do estado vazio. **Abre um modal sobreposto** com overlay escuro. Preencha: nome, descrição, categoria (dropdown com as 8 seedadas), preço, unidade (`un`, `kg`, `g`, `L`, `mL`, `dz`, `cx`, `mç`), estoque e foto. Submeta. **Toast verde "Produto cadastrado"**, modal fecha, lista é re-buscada e o card aparece no grid. Repita 2 vezes com categorias e fotos diferentes.
7. **Verificar que o perfil público reflete.** Abra `http://localhost:5500/#/agricultores/<seuId>` em outra aba (ou navegue como cliente). Você deve ver a foto de perfil, descrição, cidade/UF, as 3 fotos dos produtos e os preços por unidade — tudo já com as imagens carregadas via `/api/imagens/:id`.
8. **Editar um produto.** Volte pra `#/meus-produtos`, clique em "Editar" no card de qualquer produto. O modal abre **pré-preenchido com os valores atuais**, inclusive a foto persistida na área de preview. Mude apenas o preço (ex: de R$ 4,50 pra R$ 5,00) → toast "Produto atualizado", lista re-buscada, novo preço visível.
9. **Inativar um produto (soft delete — RF04).** Clique em "Inativar" (botão ghost vermelho à direita do "Editar") num dos cards. Aparece um `confirm()` do navegador: "Inativar este produto? Ele deixará de aparecer pra clientes." Confirme. Toast "Produto inativado". O card some da lista (a chamada `DELETE /produtos/:id` faz soft delete; nenhum registro é perdido). Confira no perfil público em outra aba: o produto inativado **não aparece mais** para clientes, mas continua no banco para pedidos antigos.
10. **Trocar foto de perfil e ver o avatar atualizar.** Volte pra `#/meu-perfil`, na área de upload clique em "Trocar foto", escolha outra imagem, salve. A página se re-renderiza inteira após o save (decisão de projeto — explicada em "Decisões", veja abaixo) e o novo avatar aparece tanto no header da página quanto no avatar pequeno do header global (em formato circular, mesma imagem servida por `/api/imagens/:id`).

### Fase D — fluxo end-to-end pedidos + avaliações (ciclo completo do produto)

Esse é o fluxo que fecha o produto. **Você vai precisar de duas abas em paralelo** — uma logada como cliente, outra como agricultor — pra ver a coreografia em tempo real, especialmente os passos 6 e 9 onde os dois lados interagem. Use dois navegadores diferentes (ou uma janela anônima) pra não compartilhar `localStorage`.

Pré-requisito: existir pelo menos **um agricultor com produtos e estoque > 0** e **um cliente** registrado. Se você seguiu os fluxos das Fases A/B/C acima, já tem isso.

1. **Cliente: enviar snapshot pelo chat (recap da Fase B).** Como cliente, vá em `#/agricultores/<id>`, adicione 1–2 produtos ao carrinho, abra o carrinho em `#/carrinho/<id>` e clique em **"Enviar para o agricultor"**. Você é levado direto pra `#/conversas/<id>` com a bolha de snapshot visível alinhada à direita.
2. **Agricultor: ver o snapshot recebido.** Na aba do agricultor, clique em **"Conversas"** no header → abra a conversa com o cliente → veja a bolha "📦 Carrinho recebido" alinhada à esquerda. **Agora (Fase D)** o botão **"Gerar pedido"** dentro da bolha está ATIVO (sem tooltip, sem `disabled`).
3. **Agricultor: clicar "Gerar pedido".** **Abre o modal sobreposto** "Gerar pedido a partir do carrinho recebido". O modal mostra:
   - resumo do snapshot (até 5 itens visíveis, "+ N itens" se passar, total destacado);
   - select **Forma de pagamento** (populado por `GET /formas-pagamento` na primeira abertura — em aberturas seguintes vem do cache em memória);
   - input **Data de retirada** (datetime-local, opcional);
   - textarea **Observações** (opcional, max 500 chars, com contador `N/500`);
   - botões "Cancelar" / "Confirmar pedido".

   Escolha PIX (ou Dinheiro), preencha data de retirada pra daqui a 2 dias, observação "Trazer sacolas" e clique em "Confirmar pedido". O modal fecha, um **toast verde "Pedido criado"** aparece, e a página navega automaticamente pra `#/pedidos/<id>` — o detalhe do pedido recém-criado.
4. **Agricultor: ver o detalhe do pedido.** Você cai em `#/pedidos/<id>` com 5 blocos visíveis:
   - **Header**: "Pedido #X" + badge **"Pendente"** (laranja);
   - **Partes envolvidas**: nome do cliente (texto, sem link) e nome do agricultor (link pro perfil) + botão "Abrir conversa";
   - **Itens**: tabela com nome, quantidade, preço unitário, subtotal e total destacado;
   - **Detalhes**: forma de pagamento, observações;
   - **Ações**: "Confirmar pedido" (primary) e "Cancelar pedido" (ghost vermelho).
5. **Cliente: ver o pedido aparecer pra ele.** Na aba do cliente, clique em **"Pedidos"** no header. Você cai em `#/pedidos`. O pedido recém-criado aparece como uma linha na tabela com badge "Pendente". Clique na linha → cai em `#/pedidos/<id>`, mesmo layout mas as ações disponíveis são diferentes: só **"Cancelar pedido"** está visível (cliente só pode cancelar quando pendente).
6. **Agricultor: confirmar o pedido.** De volta na aba do agricultor (`#/pedidos/<id>` ainda aberto), clique em **"Confirmar pedido"**. Aparece um `confirm()` "Confirmar este pedido? O cliente será notificado e o estoque já está reservado." → OK. **Toast "Pedido confirmado"**, a página inteira re-renderiza via `navigate('#/pedidos/<id>')` e agora você vê: badge **"Confirmado"** (azul), e as ações mudam pra "Marcar como entregue" + "Cancelar pedido".

   Atualize a aba do cliente (ou clique em "Pedidos" → linha do pedido). O badge agora está azul "Confirmado" e o cliente perdeu o botão de cancelar (cliente só cancela enquanto pendente).
7. **Agricultor: marcar como entregue.** Clique em **"Marcar como entregue"**. `confirm()` "Confirmar que o pedido foi entregue ao cliente?" → OK. Re-render: badge **"Entregue"** (verde), e o bloco de ações agora mostra apenas "Pedido concluído." em itálico — agricultor não tem mais o que fazer.
8. **Cliente: ver o botão "Avaliar agricultor" aparecer.** Atualize a aba do cliente em `#/pedidos/<id>`. Badge **"Entregue"** (verde). Agora aparece o botão **"Avaliar agricultor"** (primary) no bloco de ações. **(Em paralelo ao GET /pedidos, o frontend chama GET /agricultores/:id/avaliacoes pra ver se você já avaliou esse agricultor antes; se sim, em vez do botão mostra "Você avaliou: ★★★★★ — '...' [Editar avaliação]".)**
9. **Cliente: avaliar.** Clique em "Avaliar agricultor". **Abre o modal de avaliação** com:
   - texto "Como foi sua experiência com **Sítio Boa Terra**?";
   - **5 estrelas grandes interativas** centralizadas — passe o mouse e veja o destaque acompanhar, clique pra fixar a nota;
   - textarea de comentário opcional (max 500 chars, com contador);
   - botões "Cancelar" / "Enviar avaliação".

   Clique na 5ª estrela (★★★★★), escreva "Produtos fresquinhos!" e envie. **Toast "Avaliação enviada"**, modal fecha, página re-renderiza e onde antes era o botão agora aparece "Você avaliou: ★★★★★ — 'Produtos fresquinhos!'" + link "Editar avaliação".
10. **Verificar a média no perfil público do agricultor.** Em qualquer aba, abra `#/agricultores/<idDoAgricultor>` (logado ou não — o perfil é público). O header do agricultor mostra agora `★★★★★ 5.0 (1)` — a média e a contagem foram recalculadas no backend por trigger do banco assim que a avaliação foi inserida. **O frontend não tem nada a fazer aqui: só refaz o GET ao recarregar a página.**
11. **(Opcional) Editar a avaliação.** Volte ao detalhe do pedido `#/pedidos/<id>`, clique em **"Editar avaliação"**. O mesmo modal abre **pré-preenchido com os 5 ★ e o comentário** anteriores. Mude pra 4 ★, comentário "Bom, mas a alface estava um pouco murcha." → "Salvar avaliação". O backend faz UPSERT (mesmo `POST /avaliacoes`), não cria duplicata. Refresh do perfil público: média agora é `4.0 (1)`.
12. **(Opcional) Testar filtros na lista de pedidos.** Em `#/pedidos`, clique nos chips "Pendentes" / "Confirmados" / "Entregues" / "Cancelados" / "Todos". Cada clique muda a URL pra `#/pedidos?status=entregue` etc. — refresh da página preserva o filtro. "Todos" omite o param. Estado vazio é específico do filtro (ex: "Nenhum pedido com status 'pendentes'.").
13. **(Opcional) Testar cancelamento pelo cliente.** Crie outro snapshot e outro pedido (passos 1–3). Antes do agricultor confirmar, vá na aba do cliente, abra o pedido pendente, clique em "Cancelar pedido", confirme. O pedido fica com badge **"Cancelado"** (vermelho). Tanto cliente quanto agricultor veem sem ações disponíveis ("Pedido cancelado.").
14. **(Opcional) Tentar gerar dois pedidos do mesmo snapshot.** Como agricultor, abra a mesma bolha de snapshot do passo 2 e clique de novo em "Gerar pedido". O modal abre normalmente; ao clicar "Confirmar pedido" o backend responde **400 SNAPSHOT_USADO** ("este snapshot já gerou um pedido"). O `bannerErro` aparece no topo do form com a mensagem do backend e o modal **NÃO fecha** — o agricultor pode fechar manualmente.

---

## Status — o que está implementado até esta fase

| RF | Descrição | Status |
|---|---|---|
| RF01 | Cadastro (cliente/agricultor) | ✓ Fase A |
| RF02 | Login / sessão / logout | ✓ Fase A |
| RF03 | Perfil público do agricultor (visualização) | ✓ Fase A |
| RF03 | Edição do próprio perfil (agricultor) | ✓ Fase C |
| RF04 | Soft delete de produtos | ✓ Fase C |
| RF05 | CRUD de produtos (agricultor) | ✓ Fase C |
| RF06 | Categorias fixas (dropdown) | ✓ Fase C |
| RF07 | Carrinho por par cliente-agricultor | ✓ Fase B |
| RF08 | Chat + envio de snapshot | ✓ Fase B |
| RF09 | Lista + busca de agricultores | ✓ Fase A |
| RF10 | Listagem de produtos no perfil | ✓ Fase A |
| RF11 | Visualização de avaliações | ✓ Fase A |
| RF11 | Criar avaliação | ✓ Fase D |
| RF12 | Lista de conversas | ✓ Fase B |
| RF13 | Pedidos (criação + status) | ✓ Fase D |

Todos os 13 requisitos funcionais estão implementados. O frontend cobre o ciclo completo do produto, do cadastro à avaliação após entrega.

---

## Troubleshooting

**Página em branco / nada acontece ao clicar em link**
Abra o console do DevTools (F12). Provavelmente é um erro de import (ES module). Confirme que está servindo por HTTP, não abrindo o `index.html` direto do disco.

**`Failed to fetch` ou tela vermelha "Não foi possível conectar"**
Backend não está rodando ou está em outra porta. Confira `curl http://localhost:3000/api/health` em outro terminal e ajuste `BASE_URL` em `api.js` se necessário.

**CORS error no console**
O backend já manda `cors({ origin: true })`, então isso só acontece se você mudou a config. Volte ao default ou libere explicitamente `http://localhost:5500`.

**Erro 401 e nada acontece**
O frontend dispara `auth:expired` e desloga. Se você ficou preso num loop, abra DevTools → Application → Local Storage e limpe as chaves `roca:token` e `roca:user`. Recarregue.

**"Filtrar" não filtra**
A URL precisa mudar para `#/agricultores?q=...` (veja a barra de endereço depois de submeter). Se a URL não mudou, o JS não rodou — vê erro no console.

**Avatar aparece como `?` mesmo com foto_id**
A imagem falhou no GET. O frontend faz fallback automático para a inicial. Confira no Network do DevTools se o `/api/imagens/:id` retornou 200; se não, o `foto_id` no banco pode estar inválido.

**Mensagens não aparecem em tempo real na conversa (Fase B)**
Confira no DevTools → Network → filtro `mensagens`. Você deve ver uma requisição `GET /api/conversas/:id/mensagens?desde=...` saindo **a cada 3s**. Se não está saindo:
- a página de conversa nem chegou a ligar o polling — provavelmente erro no console na hora do carregamento inicial;
- ou o `conversaId` é null (você está no "pré-rascunho" e ainda não enviou nada).

Se está saindo mas você não vê novas mensagens chegando: confira se o `since` enviado bate com o `server_time` da resposta anterior. Em casos extremos de relógio desalinhado entre cliente e servidor, mensagens próximas no tempo podem ser puladas — refresh resolve.

**Polling continua rodando depois de eu sair da conversa (Fase B)**
Em DevTools → Network, requisições a cada 3s deveriam parar imediatamente ao mudar de rota. Se não param, é bug — o teardown da página (`hashchange { once: true }` + `MutationObserver`) não disparou. Tente recarregar a aba; isso sempre mata o `setInterval`. Reporte como issue.

**"Enviar para o agricultor" do carrinho dá 400 "carrinho ativo está vazio" (Fase B)**
O backend recusa snapshot de carrinho vazio. Confira que ao menos um item está listado na tela antes de clicar. **Importante:** ao contrário do que era documentado antes, o backend **mantém o carrinho como `status='ativo'` após enviar a snapshot** (decisão explícita em `routes/conversas.js`: *"NÃO marca o carrinho como 'snapshot_enviado'"*). Ou seja, depois de enviar você pode continuar adicionando itens ao mesmo carrinho e enviar outro snapshot quando quiser — cada snapshot tira uma "foto" imutável do carrinho daquele momento, mas o carrinho continua disponível. Se mesmo assim você recebe esse 400, recarregue a página e confira no DevTools → Network qual é o estado real do `GET /api/carrinho/:id` antes do POST.

**Quantidade no carrinho não atualiza ao digitar (Fase B)**
O PATCH é **debounced em 400ms** — pare de digitar e espere quase meio segundo. Se mesmo após esperar nada acontece, confira o console e a aba Network: deve sair um `PATCH /carrinho/:id/itens/:itemId`. Quantidades zero ou negativas são rejeitadas client-side e o input volta para o valor anterior.

**Botão "Gerar pedido" na bolha de snapshot está cinza**
É esperado — está como placeholder na Fase B com tooltip "Disponível na Fase D".

**Upload de foto: "Arquivo muito grande (X.XX MB). Máximo permitido: 5 MB." (Fase C)**
O componente de upload valida tamanho **antes** de chamar o backend, justamente pra dar feedback imediato. O limite é de 5 MB (`TAMANHO_MAX_FOTO` em `ui.js`). Reduza a imagem (qualquer editor de imagem do sistema operacional faz isso em segundos) e selecione de novo. O input volta limpo automaticamente após o erro pra você poder re-selecionar.

**Upload de foto: "Tipo de arquivo não suportado. Use JPG, PNG, WebP ou GIF." (Fase C)**
Mesma lógica do limite de tamanho — validação local antes de bater no backend. Tipos aceitos são exatamente os declarados em `MIMES_IMAGEM_ACEITOS` no `ui.js` (`image/jpeg`, `image/png`, `image/webp`, `image/gif`), espelhando o que o backend valida. Se o arquivo é uma das extensões corretas mas o navegador detecta outro MIME (raro, geralmente arquivo corrompido), tente abrir e re-exportar em outro editor.

**Foto não aparece após criar produto (Fase C)**
Causas comuns, em ordem de probabilidade:
- **Backend recebeu o produto mas falhou ao gravar a imagem.** Confira no terminal do backend se houve erro 4xx/5xx na rota `POST /produtos`. Confira no DevTools → Network o response — o produto tem `foto_id` preenchido?
- **Cache de imagem no navegador.** O backend manda `Cache-Control: public, max-age=31536000, immutable` (vide API.md), então `<img src="/api/imagens/123">` é cacheado agressivamente. Se você acabou de criar o produto, o `foto_id` é novo e não deveria ter cache — mas se você está re-enviando para um `foto_id` existente, o navegador pode mostrar a antiga. Force refresh com Ctrl+Shift+R.
- **`foto_id` veio null no response.** O backend pode ter ignorado o `foto_base64` por algum motivo (campo errado, base64 corrompido). Cheque no console se há erro silencioso. Em último caso, edite o produto pra setar a foto via PATCH separadamente.

**Categoria não aparece no select do modal (Fase C)**
O dropdown é populado por `GET /categorias`. Se está vazio, ou:
- o backend não rodou os seeds — verifique com `curl http://localhost:3000/api/categorias` em outro terminal; se voltar `[]`, rode `npm run db:init` (ou `db:reset`) no backend pra repopular as 8 categorias;
- a chamada falhou — abra DevTools → Network e procure por `categorias`; se 401, sua sessão expirou (apesar de `/categorias` ser pública, o `request()` do `api.js` ainda manda o token; se ele estiver inválido o backend NÃO recusa, mas se houver outro middleware, pode); se 500, problema no backend.
O cache de categorias é local — basta recarregar a página depois de corrigir.

**Tela trava com modal aberto e não fecha**
Esc, click no overlay (fora do card) e botão `×` no header do modal são os 3 caminhos de saída. Se nenhum funcionar, há erro JS no console — abra DevTools (F12), inspecione, e em último caso remova manualmente o elemento `.modal-overlay` via `document.querySelector('.modal-overlay').remove()` no console pra destravar a UI enquanto investiga.

**Header não atualiza com o novo nome após editar perfil**
O fluxo é: submit → PATCH bem-sucedido → `setUser({...u, nome: novoNome})` em localStorage → `dispatchEvent('auth:changed')` → `renderHeader()` ouve esse evento e refaz o header global. Se o nome não atualizou, abra DevTools → Application → Local Storage → `roca:user` e confira se o `nome` lá está atualizado. Se sim mas o header não, o listener de `auth:changed` foi removido por algum bug — recarregue a aba.

**"Gerar pedido" dá 400 SNAPSHOT_USADO (Fase D)**
Significa que alguém — você mesmo ou outro agricultor com a mesma conta — já gerou um pedido a partir desse snapshot. Cada snapshot só pode virar pedido **uma vez**, por design. O `bannerErro` no topo do modal mostra a mensagem traduzida do backend; o modal **NÃO fecha automaticamente**, dá tempo de ler. Solução: peça ao cliente um novo snapshot (basta ele abrir o carrinho de novo e clicar "Enviar para o agricultor") — vai criar uma nova bolha de snapshot na conversa, com novo `mensagem_snapshot_id`.

**"Gerar pedido" dá 400 ESTOQUE_INSUFICIENTE (Fase D)**
Entre o momento em que o cliente enviou o snapshot e o momento em que você (agricultor) clicou "Confirmar pedido" no modal, o estoque de algum produto caiu — pode ter sido porque outro cliente comprou esse mesmo produto, ou porque você mesmo editou o estoque manualmente em `#/meus-produtos`. O backend te diz exatamente qual produto e quanto falta: `"estoque insuficiente para X (disponível: N, pedido: M)"`. Atualize o estoque do produto (PATCH em "Meus produtos") OU combine com o cliente uma nova quantidade e peça um snapshot novo.

**Botão "Avaliar agricultor" não aparece para o cliente (Fase D)**
Três causas, em ordem de frequência:
- **O pedido ainda não está `entregue`.** O backend só permite avaliar pedidos nesse status. Confira o badge: se for "Pendente" / "Confirmado" / "Cancelado", o botão fica oculto. Peça ao agricultor pra clicar "Marcar como entregue" — depois recarregue a aba do cliente.
- **A página ficou com cache de estado antigo.** A detecção é feita a cada navegação (`navigate('#/pedidos/<id>')` re-faz o GET). Se você está vendo o detalhe que foi carregado antes do agricultor marcar como entregue, dê F5 ou clique em "Pedidos" → linha do pedido pra forçar refresh.
- **Você já avaliou esse agricultor.** Em vez do botão você vê o bloco "Você avaliou: ★★★★★ — '...' [Editar avaliação]". Isso é o comportamento correto (a avaliação é por par cliente-agricultor, não por pedido — veja "Decisões da Fase D" abaixo).

**Avaliação não atualizou a média do perfil público (Fase D)**
A média (`media_avaliacoes`) e a contagem (`total_avaliacoes`) são atualizadas no banco por **trigger SQL** assim que a avaliação é inserida — instantâneo. Mas o frontend só refaz fetch dos dados ao recarregar a página ou navegar pra `#/agricultores/<id>` de novo. **Solução: recarregue.** Não há WebSocket ou polling no perfil público — é a tela mais "estática" do app.

**Lista de pedidos vazia mesmo tendo criado um pedido (Fase D)**
Verifique se você está logado com o role certo. `GET /api/pedidos` filtra automaticamente: cliente vê os pedidos onde ele é o `cliente_id`, agricultor vê onde ele é o `agricultor_id`. Se você criou o pedido como agricultor A e está logado como agricultor B, a lista fica vazia mesmo havendo pedidos no banco. Confira o nome no header global.

**Clique no chip de filtro não muda a lista (Fase D)**
A URL deveria mudar pra `#/pedidos?status=pendente` (veja a barra de endereço). Se a URL mudou mas a lista não, há erro no console — o `listarPedidos({status})` provavelmente falhou. Se a URL NEM mudou, o JS de click do chip não rodou; abra DevTools → console e procure erros.

**Modal de pedido fica "carregando" forma de pagamento pra sempre (Fase D)**
O select começa com `disabled=true` e texto "Carregando..." até o `GET /formas-pagamento` responder. Se trava nesse estado, o backend não está expondo o endpoint OU os seeds não rodaram. Cheque com `curl http://localhost:3000/api/formas-pagamento` — se voltar `[]` ou 404, rode `npm run db:init` no backend pra repopular as 5 formas de pagamento (Dinheiro, PIX, Cartão de Crédito, Cartão de Débito, Transferência Bancária).

**Estrelas no modal de avaliação não respondem ao clique (Fase D)**
São botões nativos (`<button type="button">`), não inputs radio. Click muda a cor permanentemente; hover faz um destaque temporário que volta no mouseleave. Se não responde a click nem hover, há erro JS — abra console. Se responde a hover mas não a click, é provável que o submit ou outro handler esteja stopando propagation (não devia acontecer no fluxo padrão).

**Nome do cliente aparece como "Cliente #7" na lista/detalhe do pedido (Fase D)**
Isso é fallback defensivo. O backend pode ou não devolver `cliente_nome` / `agricultor_nome` na resposta de `GET /pedidos[/:id]` (o API.md mostra apenas os ids). O frontend tenta `pedido.cliente_nome → pedido.cliente?.nome → "Cliente #<id>"`. Se você quer ver o nome real e está vendo o fallback, o backend precisa expor o campo — não é bug do frontend. Confira o JSON real em DevTools → Network → resposta do GET.

---

## Decisões de design tomadas

### Fase A

- **`localStorage` em vez de `sessionStorage`** para sobreviver a refresh; logout limpa explicitamente.
- **Hash routing** (`#/...`) em vez de History API: dispensa qualquer config de servidor.
- **Sem cache da resposta**: cada navegação refaz o GET. Para uma app desse porte simplifica muito e o backend é rápido.
- **Fallback de imagem**: se o `<img>` falhar em carregar (404 etc.), o avatar/card volta sozinho para o estado "sem foto". Mais robusto que confiar só em `foto_id !== null`.
- **`page` na query string** ao paginar a lista, então o usuário pode dar refresh / compartilhar URL sem perder estado.
- **`auth:expired` global**: qualquer 401 vindo do `api.js` desloga o frontend inteiro de forma coordenada. Cada página individual não precisa saber lidar com isso.
- **`api.js` declara TUDO**: todas as 24 funções correspondentes aos endpoints do API.md, mesmo as não usadas na Fase A. Evita refactor quando as próximas fases consumirem novos endpoints.
- **Branding "Roça"**: como o prompt não definiu nome, escolhi um curto, em português, que conversa com o tema agrícola.

### Fase B

- **Polling fixo em 3s independente da visibilidade da aba.** O prompt explicitou essa preferência; não pareei com `document.visibilitychange` (decisão de projeto, simplifica e evita "buffer" de mensagens ao reabrir a aba).
- **Teardown do polling em três camadas:** flag `desmontado` idempotente + `hashchange { once: true }` (caminho normal de saída) + `MutationObserver` no outlet (rede de segurança caso o router mate o DOM sem trocar de hash). Idempotente: `pararPolling()` pode ser chamado várias vezes sem erro.
- **`history.replaceState` direto na transição pré-rascunho → conversa real,** em vez de `router.replace`, **justamente para NÃO disparar hashchange** e não desmontar a página. Isso preserva o estado da conversa (mensagens já desenhadas, foco do input, scroll) e mantém o polling ligado sem interrupção. O `hashListener` está com `{ once: true }`, então quando o usuário sair de fato, o teardown ainda dispara.
- **Resolver o "outro lado" via `listarConversas` antes de `getAgricultor`.** `GET /agricultores/:id` só funciona se o outro for agricultor; em conversas vistas pelo lado do agricultor (outro = cliente), retornaria 404 e o nome ficaria genérico. `listarConversas` devolve `{ outro: {id, nome, role} }` que cobre ambos os lados. Só caímos no `getAgricultor` adicional quando o outro é agricultor — para pegar a `foto_id`, que não vem em `listarConversas`.
- **Eco imediato da mensagem enviada,** sem esperar o próximo tick do polling. O `POST /conversas/.../mensagens` já devolve o objeto da mensagem criada — anexamos direto na lista (com `remetente_id = user.id` que sabemos por construção). UX fica responsivo; o dedup por `Set(ids)` no tick seguinte garante que não duplica.
- **Dedup por id no polling.** O parâmetro `since` é por timestamp e o backend devolve `>= since` em alguns formatos; com granularidade de segundo em SQLite, mensagens próximas podem repetir entre dois ticks. Mantemos um `Set` dos ids já renderizados e ignoramos os repetidos.
- **Quantidade no carrinho debounced em 400ms** (não a cada keystroke). Evita avalanche de PATCH enquanto o usuário ajusta o número. Em erro, o input volta sozinho para o último valor válido conhecido.
- **`confirm()` nativo do browser para "Limpar carrinho",** em vez de um modal custom. O fluxo é raro e destrutivo; o nativo é familiar, acessível e não exige código novo.
- **Toast efêmero para feedback positivo** (adicionar ao carrinho, snapshot enviado, carrinho limpo). Adicionado em `ui.js` como `toast(texto, { tipo, ms, children })` — fica no canto inferior direito, anima-se in/out e some sozinho em 3.5s. Não compete visualmente com `bannerErro` que ocupa espaço no layout para erros.
- **Ordem das rotas em `main.js`:** `#/conversas/com/:outroId` registrada **antes** de `#/conversas/:id`. Como o router resolve pela primeira regex que casa, a ordem inversa interpretaria `com` como id. Documentei em comentário no próprio `main.js`.
- **Botão "Gerar pedido" mantido como placeholder com tooltip "Disponível na Fase D".** Conforme o prompt, a criação de pedido pertence à Fase D — só preparamos o gancho visual.
- **Snapshot mostra no máximo 5 itens visíveis** + "+ N itens" no rodapé da bolha. Snapshots reais podem ter dezenas de produtos; truncar mantém a bolha legível sem virar uma página inteira. O total e a contagem completa estão sempre visíveis.
- **Separadores de dia ("12/05/2026") entre grupos de mensagens.** Acrescenta contexto temporal sem peso visual — apenas um chip cinza centralizado. Funciona automaticamente: comparo `formatarData(m.created_at)` com o anterior.
- **No fluxo de "Abrir conversa" do perfil, escolhi a opção mais limpa do prompt** (resolver via `listarConversas` + pré-rascunho), **não** o atalho de mandar uma mensagem `👋` automática. Conversas só são criadas quando o usuário escreve algo de fato, o que evita "lixo" no histórico do destinatário.

### Fase C

- **Diff client-side no submit de "Meu perfil" e de "Editar produto".** Em vez de mandar o objeto inteiro toda vez, monto um `patch` apenas com os campos que mudaram em relação ao estado inicial. Se não mudou nada, mostro um toast "Nada a salvar" e nem disparo a requisição. Isso (a) reduz o tráfego, (b) evita acionar triggers `updated_at` no banco à toa, e (c) deixa explícito pro backend o que o usuário quis editar — o `PATCH /agricultores/me` do backend só aplica campos enviados.
- **Componente reusável `campoUploadFoto` em `ui.js`** em vez de duplicar a lógica de upload em duas páginas (perfil e produto). Ele encapsula: preview (96×96 com objeto-URL pra não esperar o base64), validação de tipo e tamanho **antes** de chamar `FileReader`, botões "Escolher/Trocar"/"Remover", e um `getValue()` lazy que serializa em base64 só na hora do submit (e ainda cacheia a promessa, então se o user clicar submit duas vezes ou houver retry, não relê o arquivo).
- **`getValue()` retorna `null` quando o usuário não escolheu foto nova.** Combinado com o spread `...(fotoPayload || {})` no payload, garante que `foto_base64`/`foto_mime` só aparecem no body quando há foto pra enviar — o backend mantém a foto atual nesses casos. Sem isso, eu teria que mandar `foto_base64: null` e o backend teria que diferenciar "deletar foto" de "não tocar". Mais simples assim.
- **`URL.createObjectURL` pro preview imediato** em vez de esperar a leitura base64. Como o `FileReader.readAsDataURL` é assíncrono e o arquivo pode ter 5 MB, o preview demoraria a aparecer; com `createObjectURL` é instantâneo. O base64 só é lido quando o usuário aperta submit, dentro do `getValue()`.
- **Recarregar a página inteira (`navigate('#/meu-perfil')`) após salvar uma foto nova** em vez de só atualizar elementos. Razão: o `criarAvatar` da Fase A coloca `<img src="/api/imagens/<oldId>">` em vários lugares (header, page-header) e como o backend manda `Cache-Control: immutable`, mesmo após o `foto_id` mudar, os `<img>` antigos continuariam no DOM com o `src` antigo. Re-render limpo é mais simples e à prova de erro do que sair caçando referências. Não acontece nas outras salvas (sem foto nova) — o reload custaria sem benefício.
- **Upload via base64 dentro do JSON, não multipart.** O API.md mostra `multipart/form-data`, mas tanto o prompt da Fase C quanto o README do backend e a rota `POST /produtos` real esperam **`foto_base64` + `foto_mime` no JSON**. Documentei no troubleshooting o conflito do API.md pra não causar confusão. O `api.js` da Fase A já estava preparado: a função `criarProduto(payload)` envia JSON puro, então só precisei garantir que o `payload` carregue os dois campos quando há foto.
- **Modal sobreposto pra criar/editar produto** em vez de rota separada `#/meus-produtos/novo` ou `#/meus-produtos/:id/editar`. Vantagens: (a) o agricultor não sai da lista (mais fluido pra cadastros em sequência), (b) cancelar é só fechar — sem state-management de "ele tinha digitado X, devo restaurar?", (c) menos rotas no `router.js` e menos arquivos. Custo: o modal precisa do próprio teardown (Esc, click overlay, botão ×) — fiz tudo em 3 caminhos, sem tab trap por ser projeto acadêmico.
- **Cache em memória das categorias** (variável `categoriasCache` no escopo do módulo `meus-produtos.js`). Carregada uma vez junto com a lista de produtos, reusada em todos os modais subsequentes da mesma sessão. Como categorias são fixas no banco (8 registros, seed), faz sentido evitar o GET repetido. Em produção real eu colocaria um TTL ou um `Cache-Control` no backend, mas pra esse projeto é over-engineering.
- **Re-buscar a lista após criar/editar/inativar produto** (em vez de atualizar localmente). Pra criar/editar daria pra fazer optimistic update com o response do POST/PATCH, mas a inativação é soft delete: o backend não devolve nada útil pra atualizar a UI; precisaria fazer um filtro local. Re-buscar centraliza o "backend é a fonte da verdade" e evita inconsistências sutis (ex: paginação com 50 itens, inativo o item 50, agora a página 2 mudou). Custo: uma requisição GET por ação. Aceitável.
- **Botão "Inativar" estilizado como ghost vermelho** (classe `.meu-produto-btn-inativar`) em vez de "danger" sólido. O hover é que destaca em vermelho com fundo claro. Visual menos agressivo no estado normal — o `confirm()` nativo é a barreira contra clique acidental, não o estilo do botão.
- **Auto-uppercase no campo UF do form de perfil** com `input` listener que filtra `[^A-Z]` e trunca em 2 chars. Combinado com `maxlength="2"` no HTML, garante que o backend sempre recebe exatamente 2 letras maiúsculas (constraint do schema: `CHECK (length(estado) = 2)`).
- **Máscara de CEP `00000-000` aplicada via `input` listener.** Aceita o usuário digitando apenas dígitos e insere o hífen automaticamente na posição 5. Salvo no diff em formato mascarado pra que a comparação de "mudou ou não" seja consistente. Backend aceita ambas as formas (com ou sem hífen), mas mandar sempre mascarado é mais previsível.
- **Validação de descrição com `maxlength` + contador visual `N/600` (e `N/500` no produto).** Implementado via `<textarea maxlength>` (impede digitar além) + um `<span>` que atualiza no `input`. Sem dependência de regex no submit. Se o usuário colar texto maior, o browser trunca automaticamente.
- **`endereco_legado`** — nenhum. Decidi não introduzir campo "endereço" livre. O backend tem cidade + UF + CEP + lat/lng; reaproveito tudo. Se quisermos um endereço textual no futuro, é coluna nova.
- **Não toquei em `agricultor-perfil.js`** mesmo sendo a página onde o agricultor "vê o próprio resultado". O agricultor visita `#/agricultores/:id` igual a qualquer cliente; a edição é via `#/meu-perfil` — separação clara entre "página pública" e "minha área". O botão "Editar meu perfil" no perfil público quando o visitante é o próprio agricultor seria um nice-to-have da Fase D.

### Fase D

- **Snapshot é a única porta de entrada pra criar pedido — sem botão "Novo pedido" avulso.** Conforme o RF13 e o desenho do backend, todo pedido nasce de uma snapshot enviada pelo cliente. Não criei nenhuma rota tipo `#/pedidos/novo` ou botão "Criar pedido" na lista. Essa restrição garante (a) que o pedido sempre carrega o estado imutável do carrinho daquele momento, (b) que cliente e agricultor concordaram com a composição via chat, e (c) que o snapshot é a "evidência" do acordo. O backend ainda valida isso via `mensagem_snapshot_id`, mas o frontend nem oferece o caminho contrário.
- **Modal "Gerar pedido" sobreposto, mesmo padrão da Fase C.** Mesmo reasoning: o agricultor não sai do chat (importante — ele pode ter combinado detalhes via mensagem que quer relembrar enquanto preenche), e cancelar é só fechar. As 4 saídas (×, Cancelar, click no overlay, Esc) replicam o modal de produto da Fase C linha por linha. Adicionei a classe `modal-card-avaliacao` (max-width menor) só pro modal de avaliação, porque ele tem menos campos e fica desproporcional no tamanho padrão de 520px.
- **Cache em memória das formas de pagamento** (variável `formasPagamentoCache` no módulo `modal-gerar-pedido.js`). Mesmo princípio das categorias da Fase C — 5 registros fixos no banco, não muda em runtime, abertura instantânea do modal a partir da segunda vez. Carregamento na primeira abertura mostra "Carregando..." no select + select disabled, depois popula. Se o GET falha, `bannerErro` no topo do form e o select fica disabled — o usuário ainda consegue fechar.
- **Chips de filtro de status sincronizados com a query string.** `#/pedidos?status=pendente` é uma URL bookmarkable / compartilhável / refreshable. O chip "Todos" omite o param (URL fica `#/pedidos`) pra não ter `?status=` vazio. A escolha de chips em vez de `<select>` foi visual: pedidos têm 4 status fixos, chips deixam todos visíveis com um clique de distância — não é uma lista longa que justificaria dropdown.
- **Re-render via `navigate('#/pedidos/<id>')` após cada mudança de status** em vez de atualizar in-place. Razões: (1) o backend pode ter feito mais coisas além de mudar `status` (ex: `updated_at`, regras de transição rejeitadas levantam, side effects no estoque), e re-fetch é a única forma 100% confiável de refletir o novo estado; (2) o bloco de ações inteiro precisa ser reconstruído (agricultor passa de "Confirmar pedido"+"Cancelar" pra "Marcar entregue"+"Cancelar", e por aí vai); (3) é uma transição rara (uma por etapa do pedido), não é um update de quantidade no carrinho que precisa ser instantâneo. O custo de 1 GET extra é desprezível.
- **Detectar avaliação existente via `listarAvaliacoesDoAgricultor` + filtro local por `cliente.id`.** O endpoint `GET /pedidos/:id` não devolve avaliações. Tinha duas opções: (a) estado local pós-submit + perder em refresh, ou (b) chamada extra ao listar avaliações. Escolhi (b) — é uma chamada leve (limit 50), e mais robusta: funciona em refresh, em retorno via histórico do browser, e em qualquer ponto de entrada. Filtro o array pelo `cliente.id === user.id`. Se o cliente tiver >50 avaliações com aquele agricultor (impossível pelo schema UPSERT, mas defensivo), pega o mais recente; ainda assim, *no banco só existe uma avaliação por par*, então o filtro sempre retorna 0 ou 1 item.
- **Upsert de avaliação é transparente para o usuário.** O backend faz `INSERT ... ON CONFLICT DO UPDATE` em `(cliente_id, agricultor_id)`. Documentei isso em comentário em `modal-avaliacao.js` e no troubleshooting do README. O frontend **não** checa antes de enviar se já existe — só envia. Vantagem: simplicidade extrema (uma única função `criarAvaliacao` cobre criar e editar). Implicação importante pro usuário, que **eu fiz explícita na UI**: quando o cliente clica "Editar avaliação", o título do modal muda pra "Editar avaliação" (não mais "Avaliar agricultor"), o botão de submit muda pra "Salvar avaliação", e as estrelas/comentário vêm pré-preenchidas. Mesma rota técnica, UX diferenciada.
- **Avaliação é por par (cliente, agricultor), não por pedido.** Decisão do schema do banco (`UNIQUE(cliente_id, agricultor_id)` em `avaliacoes`), mas tem implicação pro frontend: se o cliente comprou 3 vezes do mesmo agricultor, ele NÃO pode avaliar 3 vezes — só tem uma avaliação total, que ele pode editar. Documentei isso no fluxo end-to-end do README e no troubleshooting "Botão Avaliar agricultor não aparece". É contra-intuitivo pra quem está acostumado com sites tipo iFood ("avalie esse pedido"), mas é o que o schema permite.
- **`renderStatusBadge` exportado de `pedidos-lista.js` e reusado em `pedido-detalhe.js`.** Em vez de duplicar a string/classe em dois lugares ou colocar no `ui.js` (que tem helpers mais genéricos), deixei a fonte da verdade no módulo "dono" do conceito (a listagem). É um padrão leve de coesão por domínio — `ui.js` continua oferecendo só primitivas reusáveis (`el`, `formatarMoeda` etc.), enquanto regras específicas de pedido ficam nas páginas de pedido.
- **`renderEstrelasInterativas` foi pro `ui.js`** (não pra `modal-avaliacao.js`) **porque é um widget reutilizável**, não uma regra de pedido. Hover preview + click select é um padrão de UI clássico; se algum dia aparecer outro uso (ex: edição inline em algum lugar), o helper está pronto. Custou pouco: a função é fechada por closure, expõe `node` e `getValor()`, e tem ARIA correto (`role="radiogroup"` + `aria-checked` nas estrelas).
- **`confirm()` nativo pra cada ação de status** (em vez de modal custom). Mesma decisão que já estava nas Fases B/C ("Limpar carrinho", "Inativar produto"): destrutivo, raro, e o nativo é familiar/acessível/sem código novo. As mensagens são explícitas sobre o que vai acontecer ("O cliente será notificado e o estoque já está reservado.") pra que o agricultor não confirme por hábito.
- **Erros do backend são mostrados literalmente via `bannerErro(err)`.** Conforme o prompt, mensagens como SNAPSHOT_USADO e ESTOQUE_INSUFICIENTE já vêm traduzidas pelo `api.js`. O frontend não tenta interceptar nem reformatar — só exibe. Isso é importante porque a mensagem do ESTOQUE_INSUFICIENTE vem com qual produto e quanto falta, info que o frontend não tinha. Confiar no backend pra mensageria reduz a chance de divergência entre o que o backend rejeitou e o que o usuário leu.
- **Modal de gerar pedido NÃO fecha em erro de submit.** Decisão UX explícita: se SNAPSHOT_USADO ou ESTOQUE_INSUFICIENTE acontece, o cliente fica olhando o modal com o erro em cima, o select de pagamento e a data ainda preenchidos. Se eu fechasse, perderia o input dele e ele teria que reabrir e refazer. Em sucesso, o modal fecha e quem decide o próximo passo é o caller (chat → toast + navigate('#/pedidos/:id')).
- **Layout de "tabela" feito com CSS grid, não `<table>`.** Para a lista de pedidos e a tabela de itens no detalhe. Razões: (a) responsividade é mais simples com grid + grid-template-areas (no mobile, reflowo as 4 colunas em 3 linhas com áreas nomeadas); (b) cada linha precisa ser um `<a>` clicável (na lista), o que com `<tr>` ficaria estranho semanticamente; (c) consistência com o resto do projeto, que já usa grid em vários lugares (`.carrinho-item`, `.grid` etc.). A acessibilidade fica OK porque a hierarquia visual ainda é clara — cabeçalho separado, linhas alinhadas — e os cabeçalhos somem no mobile (eles repetem informação que já está em cada linha).
- **Nome do cliente/agricultor com fallback `Cliente #<id>` / `Agricultor #<id>`.** O API.md do backend não documenta se o pedido vem com `cliente_nome` ou `cliente: {nome}` — só ids planos. O frontend tenta `pedido.cliente_nome → pedido.cliente?.nome → "Cliente #<id>"`, mesma coisa pro agricultor. Se o backend já devolve, aparece o nome; se não, aparece o fallback. Documentei no troubleshooting. Não chamei `getAgricultor(id)` extra na lista (seriam N+1 requests) — o detalhe do pedido também não chama, mas como o detalhe tem o link pro perfil do agricultor, o usuário clica e vê o nome lá.
- **Modal de avaliação dá foco na primeira estrela, não em input texto.** Diferente do modal de produto que foca no campo "Nome". Como a nota é o input principal (obrigatório) e o comentário é opcional, faz sentido o foco inicial guiar o usuário pra ação primária. As estrelas são `<button>` então recebem foco/teclado normalmente — Tab navega entre elas, Enter/Space dispara click.
- **Mantive `em-breve.js` no zip mesmo sem ninguém mais usar.** O prompt diz "pode ser removido se preferir, mas eu deixaria". Deixei. Cinco linhas, zero custo, e se alguma feature da Fase E aparecer, está pronto pra usar.
- **`pedido-detalhe.js` chama `listarAvaliacoesDoAgricultor` em sequência (não em paralelo com `getPedido`).** Em teoria daria pra paralelizar com `Promise.all`, mas como a chamada de avaliações só é necessária quando o pedido está `entregue` E o usuário é cliente, fazer em sequência depois de conhecer o status evita uma requisição desnecessária pra todos os outros casos (pendente/confirmado/cancelado, e agricultor olhando qualquer status). O atraso é desprezível.
