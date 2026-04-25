FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy all files
COPY . .

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "server.js"]
