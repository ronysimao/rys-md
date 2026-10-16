#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.cargo/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION="0.1.0"
ARCH="amd64"
PKG_NAME="rys-md"
DEB_DIR="$ROOT_DIR/release/${PKG_NAME}_${VERSION}_${ARCH}"
DEB_FILE="$ROOT_DIR/release/${PKG_NAME}_${VERSION}_${ARCH}.deb"

echo "=== [1/4] Building Rys MD Frontend (TypeScript + Vite) ==="
if [ "${SKIP_FRONTEND_BUILD:-0}" != "1" ] || [ ! -f "$ROOT_DIR/dist/index.html" ]; then
  bun run build
else
  echo "Reutilizando build existente em dist/..."
fi

echo "=== [2/4] Compiling Native Rust Engine (rys-md) ==="
cargo build --release --manifest-path "$ROOT_DIR/src-standalone/Cargo.toml"

echo "=== [3/4] Assembling Debian Package Structure ==="
rm -rf "$DEB_DIR"
mkdir -p "$DEB_DIR/DEBIAN"
mkdir -p "$DEB_DIR/usr/bin"
mkdir -p "$DEB_DIR/usr/lib/rys-md/dist"
mkdir -p "$DEB_DIR/usr/share/applications"
mkdir -p "$DEB_DIR/usr/share/icons/hicolor/32x32/apps"
mkdir -p "$DEB_DIR/usr/share/icons/hicolor/128x128/apps"
mkdir -p "$DEB_DIR/usr/share/icons/hicolor/256x256/apps"

# Copy compiled Rust binary
cp "$ROOT_DIR/src-standalone/target/release/rys-md-desktop" "$DEB_DIR/usr/bin/rys-md"
chmod 0755 "$DEB_DIR/usr/bin/rys-md"

# Copy compiled frontend assets
cp -r "$ROOT_DIR/dist/"* "$DEB_DIR/usr/lib/rys-md/dist/"

# Copy application icons
cp "$ROOT_DIR/src-tauri/icons/32x32.png" "$DEB_DIR/usr/share/icons/hicolor/32x32/apps/rys-md.png"
cp "$ROOT_DIR/src-tauri/icons/128x128.png" "$DEB_DIR/usr/share/icons/hicolor/128x128/apps/rys-md.png"
cp "$ROOT_DIR/src-tauri/icons/128x128@2x.png" "$DEB_DIR/usr/share/icons/hicolor/256x256/apps/rys-md.png"

# Create Desktop entry
cat > "$DEB_DIR/usr/share/applications/rys-md.desktop" << 'EOF'
[Desktop Entry]
Name=Rys MD
Comment=Apple Notes UX meets Orca ADE Rich Markdown Editor
Exec=/usr/bin/rys-md
Icon=rys-md
Terminal=false
Type=Application
Categories=Office;TextEditor;Utility;
StartupWMClass=rys-md
Keywords=notes;markdown;rys;editor;
EOF

# Calculate installed size in KB
INSTALLED_SIZE=$(du -sk "$DEB_DIR/usr" | cut -f1)

# Create DEBIAN/control
cat > "$DEB_DIR/DEBIAN/control" << EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: editors
Priority: optional
Architecture: ${ARCH}
Depends: python3, python3-gi, gir1.2-gtk-3.0, gir1.2-webkit2-4.1
Installed-Size: ${INSTALLED_SIZE}
Maintainer: Rys Dev <dev@rys.md>
Description: Rys MD - Rich Markdown Note-Taking App for Linux
 Combines the 3-column layout and fluidity of Apple Notes with
 the dual-mode Rich Markdown Editor (WYSIWYG + CodeMirror 6) of Orca ADE.
 Stores notes locally as pure .md files in ~/Documentos/RYS MD.
EOF

echo "=== [4/4] Building .deb Package with dpkg-deb ==="
dpkg-deb --root-owner-group --build "$DEB_DIR" "$DEB_FILE"
rm -rf "$DEB_DIR"

echo ""
echo "✅ Pacote .deb gerado com sucesso em:"
echo "   $DEB_FILE"
ls -lh "$DEB_FILE"
