FROM python:3.11-slim

WORKDIR /app

# Install wget for healthcheck
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

COPY backend/ .

RUN pip install --no-cache-dir -r requirements.txt

# Make entrypoint script executable
RUN chmod +x docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
