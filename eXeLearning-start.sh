#!/bin/bash
# eXeLearning - Desktop App Launcher
# Usage: ./eXeLearning-start.sh [--desktop|--web-docker|--web-local]
#   --desktop    avvia l'app Electron desktop (default)
#   --web-docker avvia lo stack web Docker per sviluppo server
#   --web-local  avvia il server web con Bun per sviluppo server

set -e

MODE="${1:---desktop}"
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$HOME/exelearning-data"
APP_PORT=8080

export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

if [ "$MODE" = "--desktop" ]; then
    cd "$BASE_DIR"
    echo "=================================="
    echo "  eXeLearning Desktop (Electron)"
    echo "=================================="
    echo ""
    if [ ! -f "$BASE_DIR/app/dist/static/index.html" ]; then
        echo "Bundle desktop mancante: genero dist/static..."
        bun run build:static
        mkdir -p app/dist/static
        cp -a dist/static/. app/dist/static/
    fi
    exec bun run electron
fi

# --- Modalita' Web Docker ---
if [ "$MODE" = "--web-docker" ]; then
    mkdir -p "$DATA_DIR"
    echo "=================================="
    echo "  eXeLearning via Docker"
    echo "  Porta: $APP_PORT"
    echo "  Dati:  $DATA_DIR"
    echo "=================================="
    echo "  Apri http://localhost:$APP_PORT"
    echo "=================================="
    echo ""
    cd "$BASE_DIR"
    exec docker compose up --build --remove-orphans
fi

# --- Modalita' Web Locale (Bun) ---
if [ "$MODE" = "--web-local" ]; then
    export FILES_DIR="$DATA_DIR"
    export DB_PATH="$DATA_DIR/exelearning.db"
    export APP_PORT=$APP_PORT
    export APP_ONLINE_MODE=1
    export APP_SECRET="exelearning-dev-secret"

    cd "$BASE_DIR"
    mkdir -p "$DATA_DIR"

    echo "=================================="
    echo "  eXeLearning - Avvio server..."
    echo "  Porta: $APP_PORT"
    echo "  DB:    $DB_PATH"
    echo "=================================="
    echo "  Apri http://localhost:$APP_PORT"
    echo "=================================="
    echo ""

    exec bun run start
fi

echo "[ERROR] Modalita' sconosciuta: $MODE"
echo "  Usa: --desktop, --web-docker o --web-local"
exit 1
