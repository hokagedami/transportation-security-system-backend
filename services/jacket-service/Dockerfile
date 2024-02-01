FROM node:18-alpine

WORKDIR /app

# Copy and install service dependencies
COPY services/jacket-service/package*.json ./
RUN npm install

# Copy service code
COPY services/jacket-service/ .


EXPOSE 3003

CMD ["npm", "start"]