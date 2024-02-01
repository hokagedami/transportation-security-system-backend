FROM node:18-alpine

WORKDIR /app

# Copy and install service dependencies
COPY services/rider-service/package*.json ./
RUN npm install

# Copy service code
COPY services/rider-service/ .


EXPOSE 3002

CMD ["npm", "start"]