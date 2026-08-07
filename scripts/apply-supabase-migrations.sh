#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASELINE_MIGRATION_VERSION="20260103015052"

load_env_file() {
  local env_file="$1"

  if [[ ! -f "$env_file" ]]; then
    echo "Arquivo não encontrado: $env_file" >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
}

decode_url_component() {
  node -e 'try { process.stdout.write(decodeURIComponent(process.argv[1])); } catch { process.exit(1); }' "$1"
}

extract_db_password() {
  if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
    return 0
  fi

  if [[ -z "${SUPABASE_DATABASE_URL:-}" ]]; then
    echo "SUPABASE_DB_PASSWORD ou SUPABASE_DATABASE_URL precisam estar definidos." >&2
    exit 1
  fi

  local url_without_scheme="${SUPABASE_DATABASE_URL#postgresql://}"
  local password_part="${url_without_scheme#postgres:}"
  password_part="${password_part%@*}"
  password_part="$(decode_url_component "$password_part")"

  if [[ -z "$password_part" ]]; then
    echo "Não foi possível extrair a senha de SUPABASE_DATABASE_URL." >&2
    exit 1
  fi

  export SUPABASE_DB_PASSWORD="$password_part"
}

apply_migrations_for_env() {
  local env_file="$1"

  unset SUPABASE_DB_PASSWORD SUPABASE_DATABASE_URL SUPABASE_PROJECT_ID
  load_env_file "$env_file"

  if [[ -z "${SUPABASE_PROJECT_ID:-}" ]]; then
    echo "SUPABASE_PROJECT_ID ausente em $env_file" >&2
    exit 1
  fi

  extract_db_password

  echo "Aplicando migrations em ${SUPABASE_PROJECT_ID} (${env_file})"
  npx supabase link --project-ref "$SUPABASE_PROJECT_ID" --password "$SUPABASE_DB_PASSWORD"
  npx supabase migration repair "$BASELINE_MIGRATION_VERSION" --status applied --password "$SUPABASE_DB_PASSWORD"
  npx supabase db push --password "$SUPABASE_DB_PASSWORD"
}

main() {
  cd "$ROOT_DIR"

  if [[ ! -f ".env.development" ]]; then
    echo ".env.development não encontrado na raiz do projeto." >&2
    exit 1
  fi

  if [[ ! -f ".env.production" ]]; then
    echo ".env.production não encontrado na raiz do projeto." >&2
    exit 1
  fi

  if ! command -v npx >/dev/null 2>&1; then
    echo "npx não encontrado no PATH." >&2
    exit 1
  fi

  apply_migrations_for_env ".env.development"
  apply_migrations_for_env ".env.production"
}

main "$@"
