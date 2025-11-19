require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const eventRoutes = require('./routes/events');
const ticketRoutes = require('./routes/tickets');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

dotenv.config();
const app = express();
app.use(cors());
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

app.get('/', (req, res) => {
  res.send('LGBT Agenda backend is running!');
});

// Serve admin web app
const adminDistPath = path.join(__dirname, 'eventsadminweb', 'dist');
const fs = require('fs');

// Check if admin dist folder exists
if (fs.existsSync(adminDistPath)) {
  // Serve static files from admin dist (CSS, JS, images, etc.)
  app.use('/admin', express.static(adminDistPath));
  
  // Catch-all for admin routes - serve index.html for SPA routing
  // This must come after static middleware so files are served first
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(adminDistPath, 'index.html'));
  });
  
  // Handle all admin sub-routes (for React Router)
  app.get(/^\/admin\/.+$/, (req, res) => {
    res.sendFile(path.join(adminDistPath, 'index.html'));
  });
} else {
  console.log('⚠️  Admin app not found. Run: cd eventsadminweb && npm install && npm run build');
}

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true, useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB connected');
  app.listen(process.env.PORT || 5050, () => {
    console.log(`🚀 Server running on port ${process.env.PORT || 5050}`);
  });
}).catch(err => console.error('❌ MongoDB error:', err));
