#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASELINE_MIGRATION_VERSION="20260103015052"

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
  cat <<EOF
Uso:
  ./scripts/apply-supabase-migrations.sh --env <development|production>

Aplica migrations pendentes do Supabase no ambiente especificado.

  --env development   Aplica migrations no banco de DESENVOLVIMENTO
  --env production    Aplica migrations no banco de PRODUÇÃO

O ambiente alvo DEVE ser especificado explicitamente.
Nunca aplica dois ambientes na mesma execução.

PRÉ-REQUISITOS:
  - .env.development e .env.production na raiz do projeto
  - SUPABASE_PROJECT_ID e SUPABASE_DATABASE_URL em cada arquivo
  - npx disponível no PATH
EOF
  exit 1
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
TARGET_ENV=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      if [[ -z "${2:-}" ]]; then
        echo "ERRO: --env requer um valor (development ou production)" >&2
        usage
      fi
      TARGET_ENV="$2"
      shift 2
      ;;
    --help|-h)
      usage
      ;;
    *)
      echo "ERRO: Argumento desconhecido: $1" >&2
      usage
      ;;
  esac
done

# Validação: ambiente obrigatório
if [[ -z "$TARGET_ENV" ]]; then
  echo "ERRO: O ambiente alvo é obrigatório." >&2
  echo "Use --env development ou --env production." >&2
  echo "" >&2
  usage
fi

# Validação: apenas development ou production
if [[ "$TARGET_ENV" != "development" && "$TARGET_ENV" != "production" ]]; then
  echo "ERRO: Ambiente inválido: '$TARGET_ENV'" >&2
  echo "Valores aceitos: development, production" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Environment selection
# ---------------------------------------------------------------------------
if [[ "$TARGET_ENV" == "development" ]]; then
  ENV_FILE=".env.development"
elif [[ "$TARGET_ENV" == "production" ]]; then
  ENV_FILE=".env.production"
fi

ENV_PATH="$ROOT_DIR/$ENV_FILE"

if [[ ! -f "$ENV_PATH" ]]; then
  echo "ERRO: Arquivo de ambiente não encontrado: $ENV_PATH" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Production confirmation
# ---------------------------------------------------------------------------
if [[ "$TARGET_ENV" == "production" ]]; then
  echo ""
  echo "=============================================="
  echo "  ATENÇÃO: AMBIENTE DE PRODUÇÃO"
  echo "=============================================="
  echo ""
  echo "Você está prestes a aplicar migrations no banco"
  echo "de PRODUÇÃO do projeto MeuFenil."
  echo ""
  echo "Arquivo de configuração: $ENV_PATH"
  echo ""
  echo "Digite PRODUCTION para continuar:"
  read -r CONFIRMATION

  if [[ "$CONFIRMATION" != "PRODUCTION" ]]; then
    echo "Confirmação inválida. Operação cancelada."
    exit 1
  fi
  echo ""
fi

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
load_env_file() {
  local env_file="$1"

  if [[ ! -f "$env_file" ]]; then
    echo "ERRO: Arquivo não encontrado: $env_file" >&2
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
    echo "ERRO: SUPABASE_DB_PASSWORD ou SUPABASE_DATABASE_URL precisam estar definidos em $ENV_FILE." >&2
    exit 1
  fi

  local url_without_scheme="${SUPABASE_DATABASE_URL#postgresql://}"
  local password_part="${url_without_scheme#postgres:}"
  password_part="${password_part%@*}"
  password_part="$(decode_url_component "$password_part")"

  if [[ -z "$password_part" ]]; then
    echo "ERRO: Não foi possível extrair a senha de SUPABASE_DATABASE_URL." >&2
    exit 1
  fi

  export SUPABASE_DB_PASSWORD="$password_part"
}

# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------
cd "$ROOT_DIR"

echo "==================================="
echo "  MeuFenil — Migration Runner"
echo "  Ambiente: $TARGET_ENV"
echo "  Arquivo:  $ENV_FILE"
echo "==================================="
echo ""

load_env_file "$ENV_PATH"

if [[ -z "${SUPABASE_PROJECT_ID:-}" ]]; then
  echo "ERRO: SUPABASE_PROJECT_ID ausente em $ENV_FILE" >&2
  exit 1
fi

extract_db_password

echo "Projeto:   $SUPABASE_PROJECT_ID"
echo ""

echo "[1/3] Vinculando projeto..."
npx supabase link --project-ref "$SUPABASE_PROJECT_ID" --password "$SUPABASE_DB_PASSWORD"

echo "[2/3] Reparando baseline ($BASELINE_MIGRATION_VERSION)..."
npx supabase migration repair "$BASELINE_MIGRATION_VERSION" --status applied --password "$SUPABASE_DB_PASSWORD"

echo "[3/3] Aplicando migrations pendentes..."
npx supabase db push --password "$SUPABASE_DB_PASSWORD"

echo ""
echo "Migration concluída com sucesso no ambiente $TARGET_ENV."
