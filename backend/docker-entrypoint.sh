#!/bin/bash
set -e

echo "Starting backend container..."

# Initialize database if needed
echo "Checking database initialization..."
python init_db.py

# Start the FastAPI application
echo "Starting FastAPI server..."
exec uvicorn main:app --host 0.0.0.0 --port 8000
