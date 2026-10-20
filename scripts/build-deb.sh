#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.cargo/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo "0.9.1")"
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
StartupNotify=false
Keywords=notes;markdown;rys;editor;
EOF

# Create DEBIAN/postinst to ensure clean auto-update relaunch even when upgrading from older versions (e.g. v0.7.0)
cat > "$DEB_DIR/DEBIAN/postinst" << 'EOF'
#!/bin/sh
set -e
rm -f /var/lib/dpkg/info/rys-md.prerm 2>/dev/null || true

if [ -f /tmp/rys-md-auto-update.deb ]; then
  cat > /tmp/rys-md-postinst.py << 'PYEOF'
import os, sys, pwd, time, subprocess

deb_path = '/tmp/rys-md-auto-update.deb'
target_uid = None
target_gid = None

try:
    st = os.stat(deb_path)
    if st.st_uid > 0:
        target_uid = st.st_uid
        target_gid = st.st_gid
except Exception:
    pass

if not target_uid:
    for env_key in ('PKEXEC_UID', 'SUDO_UID'):
        val = os.environ.get(env_key, '')
        if val.isdigit() and int(val) > 0:
            target_uid = int(val)
            break

if not target_uid:
    sys.exit(0)

try:
    if os.fork() > 0:
        os._exit(0)
    os.setsid()
    if os.fork() > 0:
        os._exit(0)
except Exception:
    pass

try:
    pw = pwd.getpwuid(target_uid)
    target_gid = target_gid or pw.pw_gid
except Exception:
    sys.exit(0)

env = {
    'HOME': pw.pw_dir,
    'USER': pw.pw_name,
    'LOGNAME': pw.pw_name,
    'XDG_RUNTIME_DIR': f'/run/user/{target_uid}',
    'PATH': '/usr/local/bin:/usr/bin:/bin'
}

for pid in os.listdir('/proc'):
    if not pid.isdigit():
        continue
    try:
        st = os.stat(f'/proc/{pid}')
        if st.st_uid != target_uid:
            continue
        raw = open(f'/proc/{pid}/environ', 'rb').read().split(b'\0')
        d = {}
        for item in raw:
            if b'=' in item:
                k, v = item.decode('utf-8', 'ignore').split('=', 1)
                d[k] = v
        if 'DISPLAY' in d and ('DBUS_SESSION_BUS_ADDRESS' in d or 'WAYLAND_DISPLAY' in d):
            for k in (
                'DISPLAY',
                'WAYLAND_DISPLAY',
                'XAUTHORITY',
                'XDG_RUNTIME_DIR',
                'DBUS_SESSION_BUS_ADDRESS',
                'XDG_CURRENT_DESKTOP',
                'XDG_SESSION_TYPE',
                'PATH'
            ):
                if k in d:
                    env[k] = d[k]
            break
    except Exception:
        pass

try:
    if os.geteuid() == 0:
        os.setgid(target_gid)
        os.initgroups(pw.pw_name, target_gid)
        os.setuid(target_uid)
except Exception:
    pass

# Wait 1.2s so if the modern updater script already launched /usr/bin/rys-md, we don't launch a second copy
time.sleep(1.2)

try:
    if os.path.exists(deb_path):
        os.remove(deb_path)
except Exception:
    pass

already_running = False
for pid in os.listdir('/proc'):
    if not pid.isdigit():
        continue
    try:
        comm = open(f'/proc/{pid}/comm', 'r', errors='ignore').read().strip()
        if comm in ('rys-md', 'rys-md-desktop'):
            already_running = True
            break
    except Exception:
        pass

if not already_running and os.path.isfile('/usr/bin/rys-md'):
    with open('/dev/null', 'rb') as devnull_in, open('/dev/null', 'ab') as devnull_out:
        subprocess.Popen(
            ['/usr/bin/rys-md'],
            stdin=devnull_in,
            stdout=devnull_out,
            stderr=devnull_out,
            start_new_session=True,
            close_fds=True,
            env=env
        )
PYEOF
  /usr/bin/python3 /tmp/rys-md-postinst.py >/dev/null 2>&1 || true
fi
exit 0
EOF
chmod 0755 "$DEB_DIR/DEBIAN/postinst"

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
Homepage: https://md.rysdev.com
Maintainer: RYS DEV <contato@rysdev.com>
Description: Rys MD - Rich Markdown Note-Taking App for Linux (md.rysdev.com)
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
