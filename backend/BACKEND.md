Agora preciso do backend completo e funcional do projeto, pronto pra rodar localmente.

Stack obrigatória:
- Node.js + Express
- SQLite via better-sqlite3 (síncrono, mais simples)
- Auth com JWT
- Senhas com bcrypt
- CORS habilitado pra localhost
- Sem TypeScript, sem build step, JS puro

# O que entregar

## 1. Projeto inteiro empacotado em .zip

Use o ambiente de execução de código pra criar todos os arquivos, zipar e me devolver o link de download. Não cole o conteúdo dos arquivos no chat — só o link do .zip e um resumo curto. Se algum arquivo for crítico de eu revisar antes de baixar (ex: server.js), pode mostrar só esse no chat além do zip.

## 2. Arquivos que precisam existir

Crie cada arquivo abaixo com conteúdo completo e funcional:

backend/package.json — com scripts start, dev, db:init, db:reset e dependências mínimas (express, better-sqlite3, bcrypt, jsonwebtoken, cors, dotenv)

backend/server.js — entrypoint, monta Express, registra middlewares globais (cors, json, error handler), monta todas as rotas com prefixo /api, sobe na porta do .env

backend/.env.example — PORT, JWT_SECRET, JWT_EXPIRES_IN, DB_PATH


backend/.gitignore — node_modules, .env, database.sqlite

backend/db/schema.sql — schema completo do projeto (use o que está no contexto)

backend/db/seeds.sql — seeds de categorias e formas de pagamento (use o que está no contexto)

backend/db/init.js — script que apaga database.sqlite se existir, cria novo, executa schema.sql e seeds.sql, loga sucesso

backend/db/connection.js — abre conexão better-sqlite3 reutilizável, exporta a instância

backend/middleware/auth.js — extrai e valida JWT do header Authorization, anexa req.user

backend/middleware/role.js — fábrica requireRole('cliente') / requireRole('agricultor')

backend/middleware/error.js — handler de erro central, formata resposta JSON

backend/utils/senha.js — hashSenha(plain) e verificarSenha(plain, hash) usando bcrypt

backend/utils/validacao.js — helpers simples (campo obrigatório, email válido, número positivo)

backend/routes/auth.js — registro, login, logout, /me

backend/routes/agricultores.js — listar com busca, ver perfil público, editar próprio perfil

backend/routes/produtos.js — listar por agricultor (com filtro categoria), criar, editar, marcar inativo, servir imagem BLOB em endpoint dedicado com Content-Type correto

backend/routes/catalogos.js — GET /categorias, GET /formas-pagamento

backend/routes/carrinho.js — obter carrinho ativo do par, adicionar item, atualizar qtd, remover item, limpar

backend/routes/conversas.js — listar minhas conversas, obter histórico, enviar mensagem texto, enviar snapshot do carrinho, polling GET com query desde=<timestamp> retornando só novas

backend/routes/pedidos.js — criar pedido a partir de snapshot (só agricultor), listar meus pedidos, atualizar status

backend/routes/avaliacoes.js — criar/atualizar avaliação de agricultor (upsert), listar avaliações de um agricultor

backend/README.md — descrito no item 3

## 3. Conteúdo do README.md

Em ordem, com seções claras:

a) Pré-requisitos — Node 18+, npm. Nada além.

b) Como rodar passo a passo, numerado e literal:
   1. Descompactar o zip
   2. cd backend
   3. npm install
   4. cp .env.example .env (e ajustar JWT_SECRET pra qualquer string longa)
   5. npm run db:init
   6. npm run dev
   7. Como confirmar que subiu (mensagem no console + porta)

c) Variáveis de ambiente — tabela com nome, descrição e valor exemplo de cada var do .env

d) Estrutura de pastas explicada em prosa curta — um parágrafo por pasta principal (db, middleware, routes, utils)

e) Como testar os endpoints — pra cada grupo (auth, agricultores, produtos, carrinho, conversas, pedidos, avaliações), pelo menos um exemplo curl completo:
   - Comando com headers e body
   - Resposta esperada resumida
   - Endpoints autenticados mostram primeiro como obter o token via login e usar no Authorization

f) Fluxo end-to-end de teste manual — sequência numerada de comandos curl que prova o sistema inteiro funcionando:
   1. Registrar agricultor
   2. Registrar cliente
   3. Login agricultor → guardar token
   4. Agricultor edita perfil (nome, descrição, localização, horários)
   5. Agricultor cria produto
   6. Login cliente → guardar token
   7. Cliente lista agricultores
   8. Cliente vê perfil + produtos do agricultor
   9. Cliente adiciona item ao carrinho
   10. Cliente envia carrinho como snapshot pro chat
   11. Agricultor lista conversas e vê o snapshot
   12. Agricultor cria pedido a partir do snapshot
   13. Cliente avalia agricultor

g) Troubleshooting — porta ocupada, banco não inicializado, token expirado, erro de CORS

h) Próximos passos — frontend será integrado na Fase 4 - nada nescessario disso agora

## 4. Regras de qualidade

- Toda rota com try/catch ou next(err)
- Validação de payload nas rotas que recebem body (campos obrigatórios, tipos básicos)
- Senhas sempre hashadas, nunca trafegam em resposta
- JWT com expiração de 240h
- Soft delete respeitado em queries (filtrar produtos/agricultores ativos)
- Imagens servidas em endpoint dedicado com Content-Type baseado no mime salvo (ou padrão image/jpeg)
- Polling do chat funcional via query param desde=ISO timestamp
- Snapshot é salvo como mensagem do tipo "snapshot" na tabela de mensagens, com payload JSON dos itens — não cria registro novo de carrinho, não invalida o carrinho atual
- Pedido criado pelo agricultor referencia o snapshot e a conversa, conforme RF13
- Avaliação é upsert por par (cliente, agricultor)
- Comentários só onde lógica não é óbvia

## 5. Decisões que você pode tomar sozinho

Se algo não estiver explícito nos requisitos ou no schema, decida com bom senso e documente no final da resposta. Exemplos:
- Tamanho máximo de upload de imagem
- Formato de timestamp nas respostas (ISO 8601)
- Estrutura exata do payload do snapshot
- Códigos de status HTTP em casos ambíguos

## 6. Ao final da resposta

Entregue, nessa ordem:
1. Link de download do .zip
2. Resumo de 5–10 linhas do que foi gerado
3. Lista de decisões tomadas que não estavam explícitas
4. Avisos sobre qualquer ajuste feito no schema ou nos endpoints em relação ao que estava no contexto, e por quê

Quero descompactar o zip, seguir o README literalmente e ter o backend rodando sem voltar pra perguntar nada.