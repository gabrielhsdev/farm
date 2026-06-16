#!/usr/bin/env bash
#
# reset.sh — Roda o projeto DO ZERO, RESETANDO o banco de dados.
#
# ATENÇÃO: isto APAGA todos os dados atuais (database.sqlite) e recria
# o banco com schema + seeds. Use quando algo quebrar ou quiser começar limpo.
#
# Depois do reset, inicia backend + frontend igual ao ./run.sh.
#
# Uso:  ./reset.sh
# Parar: Ctrl+C

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
FRONTEND_PORT=5500
BACKEND_PORT=3000

echo "==> Projeto: $ROOT_DIR"

# --- pré-requisitos ---
command -v node >/dev/null 2>&1 || { echo "ERRO: node não encontrado. Instale o Node.js."; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "ERRO: npm não encontrado.";  exit 1; }

# --- confirmação (o reset apaga dados) ---
echo ""
echo "!!  ATENÇÃO: isto vai APAGAR o banco atual e recriá-lo do zero."
read -r -p "    Tem certeza? Digite 'sim' para continuar: " CONFIRM
if [ "$CONFIRM" != "sim" ]; then
  echo "==> Cancelado. Nenhuma alteração feita."
  exit 0
fi

# --- libera a porta do backend se houver processo preso ---
if lsof -ti ":$BACKEND_PORT" >/dev/null 2>&1; then
  echo "==> Porta $BACKEND_PORT ocupada — encerrando processo anterior..."
  lsof -ti ":$BACKEND_PORT" | xargs kill 2>/dev/null || true
  sleep 1
fi

# --- dependências do backend (instala só se faltar) ---
cd "$BACKEND_DIR"
if [ ! -d node_modules ]; then
  echo "==> Instalando dependências do backend (npm install)..."
  npm install
fi

# --- RESET do banco (sempre) ---
echo "==> Resetando banco (npm run db:reset)..."
npm run db:reset

# --- escolhe servidor estático para o frontend ---
if command -v python3 >/dev/null 2>&1; then
  SERVE_CMD=(python3 -m http.server "$FRONTEND_PORT")
elif command -v npx >/dev/null 2>&1; then
  SERVE_CMD=(npx --yes serve -l "$FRONTEND_PORT" .)
else
  echo "ERRO: nenhum servidor estático disponível (precisa de python3 ou npx)."
  exit 1
fi

# --- inicia backend em background ---
echo "==> Iniciando backend em http://localhost:$BACKEND_PORT ..."
npm run dev &
BACKEND_PID=$!

cleanup() {
  echo ""
  echo "==> Encerrando..."
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# --- inicia frontend em foreground ---
echo "==> Iniciando frontend em http://localhost:$FRONTEND_PORT ..."
echo ""
echo "    Backend : http://localhost:$BACKEND_PORT/api  (health: /api/health)"
echo "    Frontend: http://localhost:$FRONTEND_PORT"
echo ""
echo "    Pressione Ctrl+C para parar tudo."
echo ""
cd "$FRONTEND_DIR"
"${SERVE_CMD[@]}"
