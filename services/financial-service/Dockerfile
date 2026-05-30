FROM python:3.12-slim

WORKDIR /app

# Instala dependências de sistema para httpx e postgres
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copia os arquivos de dependência
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# Copia o código fonte e o diretório shared (contexto do docker-compose)
COPY . .

# Comando para rodar a aplicação
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
