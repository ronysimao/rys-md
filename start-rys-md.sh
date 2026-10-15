#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export PATH="$HOME/.cargo/bin:$HOME/.bun/bin:$PATH"

# Se o binário nativo Rust (Tauri) já estiver compilado, executa diretamente:
if [ -x "$SCRIPT_DIR/src-tauri/target/release/rys-md" ]; then
  exec "$SCRIPT_DIR/src-tauri/target/release/rys-md"
fi

echo "🚀 Iniciando Rys MD (Apple Notes + Orca ADE Markdown)..."

# Verifica se a porta 1420 já está ativa
if ! curl -s http://localhost:1420 >/dev/null 2>&1; then
  bun run dev >/tmp/rys-md-server.log 2>&1 &
  SERVER_PID=$!
  trap "kill $SERVER_PID 2>/dev/null || true" EXIT

  # Aguarda o servidor inicializar
  for i in {1..30}; do
    if curl -s http://localhost:1420 >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done
fi

# Abre em janela dedicada estilo aplicativo nativo no Ubuntu
if command -v google-chrome >/dev/null 2>&1; then
  google-chrome --app="http://localhost:1420" --window-size=1360,860 --class="RysMD" >/dev/null 2>&1
elif command -v brave-browser >/dev/null 2>&1; then
  brave-browser --app="http://localhost:1420" --window-size=1360,860 --class="RysMD" >/dev/null 2>&1
elif command -v chromium-browser >/dev/null 2>&1; then
  chromium-browser --app="http://localhost:1420" --window-size=1360,860 --class="RysMD" >/dev/null 2>&1
else
  xdg-open "http://localhost:1420"
fi

wait
