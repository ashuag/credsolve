#!/usr/bin/env sh
# Load city → pincode → negative pincode flags into MySQL/MariaDB.
# Usage (from repo root or this directory):
#   sh backend/prisma/raw_sql/load_geo_data.sh
# Or with an explicit URL:
#   DATABASE_URL='mysql://user:pass@host:3306/moneyCash' sh backend/prisma/raw_sql/load_geo_data.sh
#
# Requires `mysql` client on PATH.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

if [ -z "${DATABASE_URL:-}" ] && [ -f ../../.env ]; then
  # shellcheck disable=SC1091
  set -a
  . ../../.env
  set +a
fi

URL="${DIRECT_DATABASE_URL:-${DATABASE_URL:-}}"
if [ -z "$URL" ]; then
  echo "Set DATABASE_URL (or DIRECT_DATABASE_URL) before running." >&2
  exit 1
fi

# mysql://user:pass@host:port/db?...
REST=${URL#mysql://}
REST=${REST#mariadb://}
USERINFO=${REST%%@*}
HOSTPART=${REST#*@}
USER=${USERINFO%%:*}
PASS=${USERINFO#*:}
HOSTPORT=${HOSTPART%%/*}
DBPATH=${HOSTPART#*/}
DB=${DBPATH%%\?*}
HOST=${HOSTPORT%%:*}
PORT=${HOSTPORT##*:}
if [ "$HOST" = "$PORT" ]; then
  PORT=3306
fi

if ! command -v mysql >/dev/null 2>&1; then
  echo "mysql client not found on PATH." >&2
  exit 1
fi

MYSQL_PWD=$PASS
export MYSQL_PWD

run_file() {
  file=$1
  echo "==> Loading $file ..."
  mysql --protocol=TCP -h "$HOST" -P "$PORT" -u "$USER" --default-character-set=utf8mb4 "$DB" < "$file"
  echo "    done: $file"
}

# Order matters: city rows must exist before pincode FKs; negative flags update pincode.
run_file city.sql
run_file pincode.sql
run_file negative_pin.sql

echo "Geo data load complete."
