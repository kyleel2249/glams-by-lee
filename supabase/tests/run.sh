#!/usr/bin/env bash
# Runs all migrations + assertions against a throwaway local Postgres. Usage: ./supabase/tests/run.sh
set -euo pipefail
DB=${DATABASE_URL:-postgresql://postgres@localhost:5432/glams_test}
HERE=$(cd "$(dirname "$0")" && pwd)
psql "${DB%/*}/postgres" -v ON_ERROR_STOP=1 -qc "drop database if exists glams_test" -c "create database glams_test"
psql "$DB" -v ON_ERROR_STOP=1 -q -f "$HERE/00_stub_supabase.sql"
for f in "$HERE"/../migrations/*.sql; do echo "-> $(basename "$f")"; psql "$DB" -v ON_ERROR_STOP=1 -q -f "$f"; done
psql "$DB" -v ON_ERROR_STOP=1 -q -f "$HERE/01_assertions.sql"
