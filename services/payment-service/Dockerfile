FROM node:18-alpine

WORKDIR /app

# Copy and install service dependencies
COPY services/payment-service/package*.json ./
RUN npm install

# Copy service code
COPY services/payment-service/ .


EXPOSE 3004

CMD ["npm", "start"]