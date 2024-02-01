require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('../shared/middleware/errorHandler');
const logger = require('../shared/utils/logger');

const app = express();
const PORT = process.env.PORT || 3002;
const riderRoutes = require('./routes/riderRoutes');

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'rider-service', timestamp: new Date().toISOString() });
});

app.use('/riders', riderRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Rider Service running on port ${PORT}`);
  console.log(`Rider Service running on port ${PORT}`);
});