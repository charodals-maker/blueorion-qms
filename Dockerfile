FROM node:20-slim
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 10000
ENV PORT=10000
CMD ["node", "server-enhanced.js"]
