#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "  🍎 Instalador Oficial do Rys MD para macOS (Universal)  "
echo "  Compatível com Intel & Apple Silicon (macOS 10.15 -> Sonoma/Sequoia)"
echo "=========================================================="
echo ""

REPO="ronysimao/rys-md"
APP_NAME="Rys MD.app"
INSTALL_DIR="/Applications"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "1/4 🔍 Buscando a versão mais recente do Rys MD no GitHub..."
DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/Rys-MD_macOS_Universal.app.tar.gz"

echo "2/4 ⬇️  Baixando pacote Universal (Intel + Apple Silicon)..."
curl -fL --progress-bar "$DOWNLOAD_URL" -o "$TMP_DIR/rys-md.app.tar.gz"

echo "3/4 📦 Extraindo e instalando em ${INSTALL_DIR}/${APP_NAME}..."
tar -xzf "$TMP_DIR/rys-md.app.tar.gz" -C "$TMP_DIR"

if [ -d "${INSTALL_DIR}/${APP_NAME}" ]; then
  rm -rf "${INSTALL_DIR}/${APP_NAME}" 2>/dev/null || sudo rm -rf "${INSTALL_DIR}/${APP_NAME}"
fi

mv "$TMP_DIR/${APP_NAME}" "${INSTALL_DIR}/${APP_NAME}" 2>/dev/null || sudo mv "$TMP_DIR/${APP_NAME}" "${INSTALL_DIR}/${APP_NAME}"

echo "4/4 🔓 Removendo quarentena do Gatekeeper (macOS Sonoma/Sequoia) e validando assinatura..."
xattr -cr "${INSTALL_DIR}/${APP_NAME}" 2>/dev/null || sudo xattr -cr "${INSTALL_DIR}/${APP_NAME}" || true
codesign --force --deep --sign - "${INSTALL_DIR}/${APP_NAME}" 2>/dev/null || sudo codesign --force --deep --sign - "${INSTALL_DIR}/${APP_NAME}" || true

echo ""
echo "✅ Rys MD instalado com sucesso em /Applications/Rys MD.app!"
echo "🚀 Abrindo o Rys MD..."
open "${INSTALL_DIR}/${APP_NAME}"
