FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY services/crm-service/pyproject.toml .

RUN pip install --no-cache-dir .

COPY services/crm-service/app ./app
COPY services/shared /shared

ENV PYTHONPATH=/
ENV PORT=8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
