param(
    [string]$Arg,
    [string]$ScriptTarget = "scripts\auditoria-integral-sistema.cjs",
    [string]$Label = "Ejecutando proceso..."
)

$startTime = Get-Date

$proc = Start-Process node `
    -ArgumentList @($ScriptTarget, $Arg) `
    -NoNewWindow -PassThru `
    -RedirectStandardOutput 'audit_out.tmp' `
    -RedirectStandardError  'audit_err.tmp'

$frames = @('-', '\', '|', '/')
$i = 0

while (!$proc.HasExited) {
    $elapsed = [int]((Get-Date) - $startTime).TotalSeconds
    $spin    = $frames[$i % 4]
    Write-Host ("`r  $spin  $Label [$elapsed seg]  ") -NoNewline
    Start-Sleep -Milliseconds 500
    $i++
}

$proc.WaitForExit()
$totalSec = [int]((Get-Date) - $startTime).TotalSeconds
Write-Host ("`r  Completado en $totalSec segundos.                          ")
Write-Host ""

$out = Get-Content 'audit_out.tmp' -ErrorAction SilentlyContinue
if ($out) { $out | ForEach-Object { Write-Host $_ } }

$err = Get-Content 'audit_err.tmp' -ErrorAction SilentlyContinue
if ($err) { $err | ForEach-Object { Write-Host $_ } }

Remove-Item 'audit_out.tmp','audit_err.tmp' -ErrorAction SilentlyContinue

$exitCode = $proc.ExitCode
if ($null -eq $exitCode) { $exitCode = 1 }
exit $exitCode
