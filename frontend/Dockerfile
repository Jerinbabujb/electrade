FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY . .
# Add these near the top of your Dockerfile
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Then your existing build commands
RUN npm install
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
