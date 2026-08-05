# Script interactivo para Marca Blanca (Multi-Tenant)

function Show-Header {
    Clear-Host
    Write-Host ''
    Write-Host '  +--------------------------------------------------------------+' -ForegroundColor Cyan
    Write-Host '  |   GESTION DE CLIENTES MARCA BLANCA (MULTI-TENANT FIREBASE)  |' -ForegroundColor Cyan
    Write-Host '  +--------------------------------------------------------------+' -ForegroundColor Cyan
    Write-Host ''
}

Show-Header

$files = @()

if (Test-Path ".dev_creds.json") {
    $files += [PSCustomObject]@{ Name = "Desarrollo (.dev_creds.json)"; Path = ".dev_creds.json"; Tag = "dev" }
}
if (Test-Path ".main_creds.json") {
    $files += [PSCustomObject]@{ Name = "Produccion (.main_creds.json)"; Path = ".main_creds.json"; Tag = "main" }
}

if (Test-Path "creds") {
    $credsDirFiles = Get-ChildItem -Path "creds" -Filter "*.json" -ErrorAction SilentlyContinue
    foreach ($f in $credsDirFiles) {
        $tagName = $f.BaseName.ToLower() -replace '[^a-z0-9_-]', ''
        $files += [PSCustomObject]@{ Name = "creds/$($f.Name)"; Path = $f.FullName; Tag = $tagName }
    }
}

if ($files.Count -eq 0) {
    Write-Host '  ⚠️  No se encontraron archivos de credenciales JSON.' -ForegroundColor Yellow
    Write-Host '     Coloca tus archivos de credenciales en la carpeta creds/ (ej: creds/cliente1.json)' -ForegroundColor Yellow
    Write-Host ''
    Read-Host '  Presiona Enter para volver...'
    exit 0
}

Write-Host '  Selecciona el Cliente / Base de Datos a operar:' -ForegroundColor White
Write-Host ''

for ($idx = 0; $idx -lt $files.Count; $idx++) {
    $itemNum = $idx + 1
    Write-Host "   [$itemNum]  $($files[$idx].Name)" -ForegroundColor Green
}
Write-Host '   [0]  Volver al menu principal' -ForegroundColor Gray
Write-Host ''

$choiceStr = Read-Host "  Selecciona una opcion [0-$($files.Count)]"
$choice = 0
if (![int]::TryParse($choiceStr, [ref]$choice) -or $choice -lt 0 -or $choice -gt $files.Count) {
    Write-Host '  Opcion invalida.' -ForegroundColor Red
    Start-Sleep -Seconds 2
    exit 0
}

if ($choice -eq 0) { exit 0 }

$selectedTenant = $files[$choice - 1]

Show-Header
Write-Host '  Cliente seleccionado: ' -NoNewline
Write-Host "$($selectedTenant.Name)" -ForegroundColor Yellow
Write-Host ''
Write-Host '  Que accion queres ejecutar?' -ForegroundColor White
Write-Host '   [1]  Auditar Sistema (45 Pruebas + Reporte HTML)' -ForegroundColor Green
Write-Host '   [2]  Resguardo / Backup Local a JSON' -ForegroundColor Green
Write-Host '   [3]  Limpieza y Purgado de datos viejos' -ForegroundColor Green
Write-Host '   [0]  Cancelar' -ForegroundColor Gray
Write-Host ''

$action = Read-Host '  Selecciona una accion [0-3]'

if ($action -eq '1') {
    Write-Host ''
    & powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-audit-helper.ps1 -Arg "--creds=`"$($selectedTenant.Path)`" --env=$($selectedTenant.Tag)" -ScriptTarget "scripts\auditoria-integral-sistema.cjs" -Label "Auditando cliente $($selectedTenant.Tag)..."
    $reportName = "audit-report-$($selectedTenant.Tag).html"
    if (Test-Path $reportName) {
        Start-Process $reportName
    }
    Read-Host '  Presiona Enter para continuar...'
}
elseif ($action -eq '2') {
    Write-Host ''
    & powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-audit-helper.ps1 -Arg "--creds=`"$($selectedTenant.Path)`" --env=$($selectedTenant.Tag)" -ScriptTarget "scripts\backup-firestore.cjs" -Label "Exportando backup de $($selectedTenant.Tag)..."
    Read-Host '  Presiona Enter para continuar...'
}
elseif ($action -eq '3') {
    Write-Host ''
    & powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-audit-helper.ps1 -Arg "--creds=`"$($selectedTenant.Path)`" --env=$($selectedTenant.Tag)" -ScriptTarget "scripts\mantenimiento-limpieza.cjs" -Label "Limpiando $($selectedTenant.Tag)..."
    Read-Host '  Presiona Enter para continuar...'
}
else {
    Write-Host '  Operacion cancelada.'
}
