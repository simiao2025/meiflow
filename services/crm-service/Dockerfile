FROM python:3.11-slim

WORKDIR /app

# Instalar dependências de compilação
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .

RUN pip install --no-cache-dir httpx fastapi uvicorn supabase

COPY ./app ./app
COPY ../shared /shared

ENV PYTHONPATH=/
ENV PORT=8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
