#!/usr/bin/env bash
# ==============================================================================
# GIO Os - Iniciar Sistema Operacional no Linux Real
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=4567

echo "🪐 Iniciando GIO Os..."

# 1. Verificar se o servidor backend nativo já está rodando
if ! curl -s "http://localhost:${PORT}/api/system/stats" >/dev/null 2>&1; then
  echo "🚀 Inicializando backend nativo do Linux (Node.js na porta ${PORT})..."
  node "${DIR}/server/backend.js" >/dev/null 2>&1 &
  sleep 1
fi

echo "✅ Backend nativo ativo em http://localhost:${PORT}"

# 2. Abrir no modo Desktop / Aplicação Nativa (Sem barras de navegador)
if which google-chrome >/dev/null 2>&1; then
  echo "🖥️ Abrindo GIO Desktop via Google Chrome App Mode..."
  google-chrome --app="http://localhost:${PORT}" --start-maximized >/dev/null 2>&1 &
elif which chromium-browser >/dev/null 2>&1; then
  echo "🖥️ Abrindo GIO Desktop via Chromium..."
  chromium-browser --app="http://localhost:${PORT}" --start-maximized >/dev/null 2>&1 &
elif which chromium >/dev/null 2>&1; then
  echo "🖥️ Abrindo GIO Desktop via Chromium..."
  chromium --app="http://localhost:${PORT}" --start-maximized >/dev/null 2>&1 &
elif which firefox >/dev/null 2>&1; then
  echo "🖥️ Abrindo GIO Desktop via Firefox..."
  firefox "http://localhost:${PORT}" >/dev/null 2>&1 &
else
  echo "🌐 Abra seu navegador em: http://localhost:${PORT}"
  xdg-open "http://localhost:${PORT}" >/dev/null 2>&1 &
fi

echo "✨ GIO Os pronto e em execução!"
