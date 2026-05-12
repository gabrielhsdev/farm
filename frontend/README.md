# Frontend — Marketplace Agricultura Familiar (Fase A)

Frontend em **HTML + CSS + JavaScript puro**, sem build, sem bundler, sem dependências externas. Consome o backend REST descrito em `API.md`, rodando em `http://localhost:3000/api`.

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
├── ui.js                       # Helpers DOM: el(), criarAvatar(), formatarMoeda(), renderEstrelas()…
└── pages/
    ├── login.js                # POST /auth/login
    ├── registro.js             # POST /auth/register (com radio cliente/agricultor)
    ├── agricultores-lista.js   # GET /agricultores com filtros q/cidade/estado + paginação
    ├── agricultor-perfil.js    # GET /agricultores/:id + .../produtos + .../avaliacoes
    └── em-breve.js             # Placeholder genérico parametrizado por fase.
```

**O que importa saber arquivo por arquivo:**

- `index.html` define só o esqueleto: um `<header id="app-header">` e um `<main id="app">` onde as páginas são renderizadas.
- `styles.css` concentra todos os estilos. Tokens em `:root`. Sem inline styles em lugar nenhum exceto width/height do avatar gerado dinamicamente.
- `main.js` é o orquestrador. Registra todas as rotas (inclusive os placeholders das Fases B/C/D), define guards por role, monta o header global e ouve dois eventos: `auth:expired` (disparado pelo `api.js` em qualquer 401) e `auth:changed` (disparado quando login/logout ocorre).
- `api.js` tem `BASE_URL` no topo e uma função `request(method, path, body?, query?)` que centraliza headers, Authorization, parse de JSON e erro estruturado `{ status, code, message, details }`. Em 401 dispara `auth:expired`. Exporta **todas** as 24 funções da API (não só as da Fase A) — as fases futuras consomem direto sem mexer aqui.
- `auth.js` é trivial: persiste `roca:token` e `roca:user` em `localStorage`.
- `router.js` parseia `#/agricultores/:id?q=foo` em `{ params: {id}, query: {q} }`. `navigate(hash)` para programaticamente, `replace(hash)` para redirects sem entrar no histórico.
- `ui.js` centraliza criação de DOM sem `innerHTML` (segurança contra XSS). `criarAvatar(nome, fotoId, tamanho)` resolve o fallback de inicial automaticamente.

---

## Como testar

Fluxo manual cobrindo tudo da Fase A. Backend precisa estar rodando em paralelo.

1. **Subir o backend** e popular ao menos um agricultor + um produto. O `README.md` do backend tem um fluxo end-to-end via curl no item (f) que cria tudo em minutos.
2. **Abrir** `http://localhost:5500` → você cai na lista de agricultores (rota pública).
3. **Cadastrar um cliente novo**: clique em "Cadastrar" no header. Preencha nome/email/senha, escolha **Cliente**, submeta. O frontend já loga e redireciona para a lista.
4. **Filtrar agricultores**: na lista, digite parte do nome em "Buscar por nome" ou uma UF e clique em "Filtrar". A URL muda para `#/agricultores?q=...` e a paginação se mantém.
5. **Abrir um perfil**: clique em qualquer card. Você vê o header com avatar + descrição + estrelas, a grade de produtos e a lista de avaliações. Os botões "Abrir conversa" / "Adicionar ao carrinho" aparecem desabilitados com tooltip "Disponível na Fase B".
6. **Logout**: clique em "Sair" no header. Token sai do `localStorage` e os links públicos voltam.
7. **Testar redirect por role**: registre um **Agricultor**. Após criar conta o sistema redireciona para `#/meu-perfil`, que renderiza o placeholder "Em breve — Fase C". Mesmo placeholder genérico aparece em `#/meus-produtos`, `#/pedidos`, `#/carrinho/:id` etc, cada um marcado com a fase correta.
8. **Testar token expirado**: no DevTools, sobrescreva `localStorage.setItem('roca:token','xxx')` e tente acessar uma rota que faz request autenticado. O `api.js` recebe 401, dispara `auth:expired`, o frontend desloga e te manda pro login.

---

## Status — o que está implementado nesta fase

| RF | Descrição | Status |
|---|---|---|
| RF01 | Cadastro (cliente/agricultor) | ✓ Fase A |
| RF02 | Login / sessão / logout | ✓ Fase A |
| RF03 | Perfil público do agricultor (visualização) | ✓ Fase A |
| RF03 | Edição do próprio perfil (agricultor) | ⏳ Fase C |
| RF04 | Soft delete de produtos | ⏳ Fase C |
| RF05 | CRUD de produtos (agricultor) | ⏳ Fase C |
| RF06 | Categorias fixas (dropdown) | ⏳ Fase C |
| RF07 | Carrinho por par cliente-agricultor | ⏳ Fase B |
| RF08 | Chat + envio de snapshot | ⏳ Fase B |
| RF09 | Lista + busca de agricultores | ✓ Fase A |
| RF10 | Listagem de produtos no perfil | ✓ Fase A |
| RF11 | Visualização de avaliações | ✓ Fase A |
| RF11 | Criar avaliação | ⏳ Fase D |
| RF12 | Lista de conversas | ⏳ Fase B |
| RF13 | Pedidos (criação + status) | ⏳ Fase D |

Todas as funções de API das fases futuras já estão declaradas em `api.js` — basta consumir nas páginas novas.

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

---

## Decisões de design tomadas

- **`localStorage` em vez de `sessionStorage`** para sobreviver a refresh; logout limpa explicitamente.
- **Hash routing** (`#/...`) em vez de History API: dispensa qualquer config de servidor.
- **Sem cache da resposta**: cada navegação refaz o GET. Para uma app desse porte simplifica muito e o backend é rápido.
- **Fallback de imagem**: se o `<img>` falhar em carregar (404 etc.), o avatar/card volta sozinho para o estado "sem foto". Mais robusto que confiar só em `foto_id !== null`.
- **`page` na query string** ao paginar a lista, então o usuário pode dar refresh / compartilhar URL sem perder estado.
- **`auth:expired` global**: qualquer 401 vindo do `api.js` desloga o frontend inteiro de forma coordenada. Cada página individual não precisa saber lidar com isso.
- **`api.js` declara TUDO**: todas as 24 funções correspondentes aos endpoints do API.md, mesmo as não usadas na Fase A. Evita refactor quando as próximas fases consumirem novos endpoints.
- **Branding "Roça"**: como o prompt não definiu nome, escolhi um curto, em português, que conversa com o tema agrícola.
