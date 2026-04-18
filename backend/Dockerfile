FROM node:20-alpine
RUN apk add --no-cache postgresql16-client
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src/ ./src/
RUN mkdir -p /app/backups
EXPOSE 3001
CMD ["node", "src/server.js"]
