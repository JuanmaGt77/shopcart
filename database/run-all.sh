#!/usr/bin/env bash
# Construye la base de ShopCart ejecutando los scripts de database/scripts en orden.
#
#   ./database/run-all.sh           crea la base solo si todavía no existe
#   ./database/run-all.sh --reset   la elimina y la vuelve a crear desde cero
#
# Lee la conexión de variables de entorno (ver .env.example). Necesita sqlcmd;
# si no lo tienes instalado puedes usar `npm run db:setup` desde la carpeta backend.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-1433}"
DB_NAME="${DB_NAME:-ShopCart}"
DB_SA_USER="${DB_SA_USER:-sa}"
DB_APP_USER="${DB_APP_USER:-shopcart_app}"
: "${DB_SA_PASSWORD:?Falta DB_SA_PASSWORD}"
: "${DB_APP_PASSWORD:?Falta DB_APP_PASSWORD}"

# Los nombres van dentro de los scripts, así que solo acepto caracteres seguros
if [[ ! "$DB_NAME" =~ ^[A-Za-z][A-Za-z0-9_]{0,63}$ || ! "$DB_APP_USER" =~ ^[A-Za-z][A-Za-z0-9_]{0,63}$ ]]; then
  echo "DB_NAME y DB_APP_USER solo pueden tener letras, números y guion bajo." >&2
  exit 1
fi
if [[ "$DB_APP_PASSWORD" == *"'"* ]]; then
  echo "DB_APP_PASSWORD no puede contener comillas simples." >&2
  exit 1
fi

if [[ -z "${SQLCMD:-}" ]]; then
  if command -v sqlcmd >/dev/null 2>&1; then
    SQLCMD="$(command -v sqlcmd)"
  elif [[ -x /opt/mssql-tools18/bin/sqlcmd ]]; then
    SQLCMD=/opt/mssql-tools18/bin/sqlcmd
  else
    echo "No encontré sqlcmd. Instálalo o usa 'npm run db:setup' desde backend/." >&2
    exit 1
  fi
fi

RESET=false
[[ "${1:-}" == "--reset" ]] && RESET=true

# La clave va por variable de entorno para que no aparezca en la lista de procesos
export SQLCMDPASSWORD="$DB_SA_PASSWORD"
sqlcmd_run() {
  "$SQLCMD" -S "$DB_HOST,$DB_PORT" -U "$DB_SA_USER" -C -b -I "$@"
}

echo "Esperando a SQL Server en $DB_HOST:$DB_PORT..."
for _ in $(seq 1 40); do
  if sqlcmd_run -h -1 -Q "SET NOCOUNT ON; SELECT 1" >/dev/null 2>&1; then break; fi
  sleep 2
done

EXISTE=$(sqlcmd_run -h -1 -W -Q "SET NOCOUNT ON; SELECT CASE WHEN DB_ID(N'$DB_NAME') IS NULL THEN 0 ELSE 1 END" | tr -d '[:space:]')
if [[ "$EXISTE" == "1" && "$RESET" == false ]]; then
  echo "La base $DB_NAME ya existe, no toco nada. Usa --reset si quieres recrearla."
  exit 0
fi

for script in "$DIR"/scripts/*.sql; do
  echo "  -> $(basename "$script")"
  sqlcmd_run -i "$script" -v DBName="$DB_NAME" AppUser="$DB_APP_USER" AppPassword="$DB_APP_PASSWORD"
done

echo "Listo: base $DB_NAME creada con sus objetos y datos semilla."
