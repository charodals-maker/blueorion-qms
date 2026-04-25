FROM node:20-alpine
WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

EXPOSE 10000
ENV PORT=10000
CMD ["node", "server-enhanced.js"]
