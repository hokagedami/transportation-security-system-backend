FROM node:18-alpine

WORKDIR /app

# Copy and install service dependencies
COPY services/auth-service/package*.json ./
RUN npm install

# Copy service code
COPY services/auth-service/ .


EXPOSE 3001

CMD ["npm", "start"]