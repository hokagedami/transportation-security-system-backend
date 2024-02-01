require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('../shared/middleware/errorHandler');
const logger = require('../shared/utils/logger');

const app = express();
const PORT = process.env.PORT || 3004;
const paymentRoutes = require('./routes/paymentRoutes');

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'payment-service', timestamp: new Date().toISOString() });
});

app.use('/payment', paymentRoutes);
app.use('/payments', paymentRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Payment Service running on port ${PORT}`);
  console.log(`Payment Service running on port ${PORT}`);
});