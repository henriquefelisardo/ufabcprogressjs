# Estágio 1: Construir o React (Frontend)
FROM node:18-alpine AS build-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Estágio 2: Configurar o Python (Backend)
FROM python:3.12-slim
WORKDIR /app

# Criar um usuário não-root (Exigência de segurança do Hugging Face)
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

# Instalar dependências do Python
COPY --chown=user backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copiar os arquivos do backend (incluindo o CSV)
COPY --chown=user backend/ ./backend/

# Copiar a interface gráfica compilada do Estágio 1 para dentro da pasta do backend
COPY --from=build-frontend --chown=user /app/frontend/dist ./backend/dist/

# O Hugging Face Docker Spaces exige rodar na porta 7860
EXPOSE 7860

# Comando para iniciar o servidor
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]