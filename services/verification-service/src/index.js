require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('../../../shared/middleware/errorHandler');
const logger = require('../../../shared/utils/logger');

const app = express();
const PORT = process.env.PORT || 3006;
const verificationRoutes = require('./routes/verificationRoutes');

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'verification-service', timestamp: new Date().toISOString() });
});

app.use('/', verificationRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Verification Service running on port ${PORT}`);
  console.log(`Verification Service running on port ${PORT}`);
});