#!/bin/bash
set -e

echo "Starting backend container..."

# Initialize database if needed
echo "Checking database initialization..."
python init_db.py

# Start the FastAPI application
echo "Starting FastAPI server..."
WORKERS="${BACKEND_WORKERS:-1}"
UVICORN_LOOP="${UVICORN_LOOP:-auto}"
UVICORN_HTTP="${UVICORN_HTTP:-auto}"

exec uvicorn main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers "${WORKERS}" \
  --loop "${UVICORN_LOOP}" \
  --http "${UVICORN_HTTP}"
