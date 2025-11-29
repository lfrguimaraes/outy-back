require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const eventRoutes = require('./routes/events');
const ticketRoutes = require('./routes/tickets');
const analyticsRoutes = require('./routes/analytics');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

dotenv.config();
const app = express();

// Trust proxy to correctly extract IP addresses when behind a proxy (e.g., Render, Heroku)
app.set('trust proxy', 1);

// CORS configuration - allow requests from admin app (deployed separately on GitHub Pages)
app.use(cors({
  origin: [
    'https://lfrguimaraes.github.io', // GitHub Pages domain (admin app)
    'http://localhost:3001', // Local development
    'http://localhost:5173' // Vite dev server
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Serve the generated OpenAPI JSON and Swagger UI
const openApiSpec = require(path.join(__dirname, 'docs', 'openapi.json'));
app.get('/openapi.json', (req, res) => {
  res.json(openApiSpec);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/analytics', analyticsRoutes);

app.get('/', (req, res) => {
  res.send('Outy backend is running!');
});

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true, useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB connected');
  app.listen(process.env.PORT || 5050, () => {
    console.log(`🚀 Server running on port ${process.env.PORT || 5050}`);
  });
}).catch(err => console.error('❌ MongoDB error:', err));
