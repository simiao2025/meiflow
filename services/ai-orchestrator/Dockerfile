FROM python:3.12-slim

# Evitar que o Python gere arquivos .pyc e garantir output em tempo real
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Instalar dependências de sistema necessárias
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar apenas o arquivo de configuração primeiro para aproveitar o cache do Docker
COPY pyproject.toml .

# Instalar as dependências do projeto
RUN pip install --no-cache-dir .

# Copiar o restante do código
COPY . .

# Expor a porta que o FastAPI vai rodar
EXPOSE 8000

# Comando para rodar a aplicação
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
