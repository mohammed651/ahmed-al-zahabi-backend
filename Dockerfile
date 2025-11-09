# backend/Dockerfile
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files first (for better caching)
COPY package*.json ./

# Install deps
RUN npm ci --only=production

# Copy app source
COPY . .

# Expose port (backend uses PORT from .env)
EXPOSE 5000

# Ensure .env will be provided via docker-compose env_file
CMD ["node", "src/server.js"]
