# Construye la base de ShopCart en Windows ejecutando los scripts numerados en orden.
#
#   .\database\run-all.ps1                 crea la base solo si no existe
#   .\database\run-all.ps1 -Reset          la elimina y la vuelve a crear
#   .\database\run-all.ps1 -Servidor "localhost\SQLEXPRESS"
#
# Requiere sqlcmd (viene con SQL Server / SSMS, o se instala con: winget install sqlcmd).
# Si prefieres no instalarlo, desde backend/ puedes correr: npm run db:setup
param(
    [string]$Servidor = $(if ($env:DB_HOST) { "$($env:DB_HOST),$(if ($env:DB_PORT) { $env:DB_PORT } else { '1433' })" } else { "localhost,1433" }),
    [string]$BaseDatos = $(if ($env:DB_NAME) { $env:DB_NAME } else { "ShopCart" }),
    [string]$UsuarioSa = $(if ($env:DB_SA_USER) { $env:DB_SA_USER } else { "sa" }),
    [string]$ClaveSa = $env:DB_SA_PASSWORD,
    [string]$UsuarioApp = $(if ($env:DB_APP_USER) { $env:DB_APP_USER } else { "shopcart_app" }),
    [string]$ClaveApp = $env:DB_APP_PASSWORD,
    [switch]$Reset
)

$ErrorActionPreference = "Stop"

if (-not $ClaveSa)  { $ClaveSa  = Read-Host "Clave del usuario $UsuarioSa" }
if (-not $ClaveApp) { $ClaveApp = Read-Host "Clave para el usuario de la aplicacion ($UsuarioApp)" }

if ($BaseDatos -notmatch '^[A-Za-z][A-Za-z0-9_]{0,63}$' -or $UsuarioApp -notmatch '^[A-Za-z][A-Za-z0-9_]{0,63}$') {
    throw "El nombre de la base y del usuario solo pueden tener letras, numeros y guion bajo."
}
if ($ClaveApp.Contains("'")) { throw "La clave de la aplicacion no puede contener comillas simples." }

if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) {
    throw "No encontre sqlcmd. Instalalo (winget install sqlcmd) o usa 'npm run db:setup' desde backend."
}

$env:SQLCMDPASSWORD = $ClaveSa
$scripts = Join-Path $PSScriptRoot "scripts"

$existe = (sqlcmd -S $Servidor -U $UsuarioSa -C -b -I -h -1 -W -Q "SET NOCOUNT ON; SELECT CASE WHEN DB_ID(N'$BaseDatos') IS NULL THEN 0 ELSE 1 END").Trim()
if ($existe -eq "1" -and -not $Reset) {
    Write-Host "La base $BaseDatos ya existe, no toco nada. Usa -Reset si quieres recrearla."
    exit 0
}

Get-ChildItem -Path $scripts -Filter *.sql | Sort-Object Name | ForEach-Object {
    Write-Host "  -> $($_.Name)"
    sqlcmd -S $Servidor -U $UsuarioSa -C -b -I -i $_.FullName -v DBName="$BaseDatos" AppUser="$UsuarioApp" AppPassword="$ClaveApp"
    if ($LASTEXITCODE -ne 0) { throw "Fallo el script $($_.Name)" }
}

Write-Host "Listo: base $BaseDatos creada con sus objetos y datos semilla."
