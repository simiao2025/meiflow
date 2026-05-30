FROM python:3.12-slim

WORKDIR /app

# Instala dependências de sistema
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Argumento para definir qual serviço está sendo buildado
ARG SERVICE_NAME

# Copia o diretório shared para a raiz do app (acessível por todos)
COPY shared/ /app/shared/

# Muda para a pasta do serviço específico
WORKDIR /app/${SERVICE_NAME}

# Copia o pyproject do serviço específico
COPY ${SERVICE_NAME}/pyproject.toml .
RUN pip install --no-cache-dir .

# Copia o código do serviço
COPY ${SERVICE_NAME}/ .

# Define o PYTHONPATH para incluir a raiz (onde está o shared)
ENV PYTHONPATH=/app

# Comando padrão
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
