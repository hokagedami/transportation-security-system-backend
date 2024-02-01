FROM node:18-alpine

WORKDIR /app

# Copy and install service dependencies
COPY services/verification-service/package*.json ./
RUN npm install

# Copy service code
COPY services/verification-service/ .


EXPOSE 3006

CMD ["npm", "start"]