# ==============================================================================
# 🪟 Instalador / Atualizador Oficial do Rys MD para Windows 10 & 11 (x64)
# Sem bloqueio do Windows Defender SmartScreen (remove Zone.Identifier na origem)
# Uso rápido no PowerShell:
#   irm https://raw.githubusercontent.com/ronysimao/rys-md/main/scripts/install-windows.ps1 | iex
# ==============================================================================

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  🪟 Instalador Oficial do Rys MD para Windows (64-bit)   " -ForegroundColor Cyan
Write-Host "  Instalação direta sem aviso do Microsoft SmartScreen    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$InstallDir = Join-Path $env:LOCALAPPDATA "Programs\Rys MD"
$ExePath = Join-Path $InstallDir "Rys-MD.exe"
$DownloadUrl = "https://github.com/ronysimao/rys-md/releases/latest/download/Rys-MD_Windows_x64_Portable.exe"

Write-Host "1/4 🔍 Buscando a versão mais recente do Rys MD para Windows no GitHub..." -ForegroundColor Yellow
try {
    $releases = Invoke-RestMethod -Uri "https://api.github.com/repos/ronysimao/rys-md/releases?per_page=5" -Headers @{ "User-Agent" = "RysMD-WinInstaller" } -TimeoutSec 10
    foreach ($rel in $releases) {
        foreach ($asset in $rel.assets) {
            if ($asset.name -like "*Windows_x64_Portable.exe") {
                $DownloadUrl = $asset.browser_download_url
                break
            }
        }
        if ($DownloadUrl -ne "https://github.com/ronysimao/rys-md/releases/latest/download/Rys-MD_Windows_x64_Portable.exe") {
            break
        }
    }
} catch {
    # Fallback para URL estável latest
}

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# Encerra instância anterior caso esteja aberta
Get-Process -Name "Rys-MD", "rys-md", "Rys MD Portable" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 400

Write-Host "2/4 ⬇️  Baixando executável oficial ($($DownloadUrl.Split('/')[-1]))..." -ForegroundColor Yellow
$TmpExe = Join-Path $env:TEMP "Rys-MD-Download.exe"
Remove-Item -Path $TmpExe -Force -ErrorAction SilentlyContinue

& curl.exe -fL "$DownloadUrl" -o "$TmpExe"
if (-not (Test-Path $TmpExe) -or ((Get-Item $TmpExe).Length -lt 1000000)) {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TmpExe -UseBasicParsing
}

Move-Item -Path $TmpExe -Destination $ExePath -Force

Write-Host "3/4 🔓 Removendo marcação Zone.Identifier (SmartScreen)..." -ForegroundColor Yellow
Unblock-File -Path $ExePath -ErrorAction SilentlyContinue
cmd.exe /c "del /f /q `"$ExePath:Zone.Identifier`" >nul 2>&1"

Write-Host "4/4 🖥️  Criando atalhos na Área de Trabalho e no Menu Iniciar..." -ForegroundColor Yellow
$WshShell = New-Object -ComObject WScript.Shell

$DesktopShortcutPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "Rys MD.lnk"
$DesktopShortcut = $WshShell.CreateShortcut($DesktopShortcutPath)
$DesktopShortcut.TargetPath = $ExePath
$DesktopShortcut.WorkingDirectory = $InstallDir
$DesktopShortcut.IconLocation = "$ExePath,0"
$DesktopShortcut.Description = "Rys MD - Liquid Glass Markdown Notes"
$DesktopShortcut.Save()

$StartMenuDir = Join-Path ([Environment]::GetFolderPath("Programs")) "Rys MD"
if (-not (Test-Path $StartMenuDir)) {
    New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null
}
$StartMenuShortcut = $WshShell.CreateShortcut((Join-Path $StartMenuDir "Rys MD.lnk"))
$StartMenuShortcut.TargetPath = $ExePath
$StartMenuShortcut.WorkingDirectory = $InstallDir
$StartMenuShortcut.IconLocation = "$ExePath,0"
$StartMenuShortcut.Description = "Rys MD - Liquid Glass Markdown Notes"
$StartMenuShortcut.Save()

Write-Host ""
Write-Host "✅ Rys MD instalado e desbloqueado com sucesso!" -ForegroundColor Green
Write-Host "🚀 Iniciando o Rys MD..." -ForegroundColor Green
Start-Process -FilePath $ExePath
