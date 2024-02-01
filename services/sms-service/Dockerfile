FROM node:18-alpine

WORKDIR /app

# Copy and install service dependencies
COPY services/sms-service/package*.json ./
RUN npm install

# Copy service code
COPY services/sms-service/ .


EXPOSE 3005

CMD ["npm", "start"]