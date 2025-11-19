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
  console.log('✅ Admin app found at:', adminDistPath);
  
  // Serve static files from admin dist (CSS, JS, images, etc.)
  // This serves files like /admin/assets/index.js, /admin/assets/index.css, etc.
  app.use('/admin', express.static(adminDistPath, {
    index: false // Don't serve index.html automatically, we'll handle it manually
  }));
  
  // Serve index.html for /admin route
  app.get('/admin', (req, res) => {
    const indexPath = path.join(adminDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Admin app index.html not found');
    }
  });
  
  // Handle all admin sub-routes (for React Router) - serve index.html for SPA routing
  // Exclude asset files (they're handled by static middleware)
  app.get(/^\/admin\/(?!assets\/).+$/, (req, res) => {
    const indexPath = path.join(adminDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Admin app not found');
    }
  });
} else {
  console.log('⚠️  Admin app not found at:', adminDistPath);
  console.log('⚠️  Run: cd eventsadminweb && npm install && npm run build');
  
  // Provide helpful error message
  app.get('/admin', (req, res) => {
    res.status(503).send(`
      <h1>Admin App Not Built</h1>
      <p>The admin app has not been built yet.</p>
      <p>Please run: <code>cd eventsadminweb && npm install && npm run build</code></p>
      <p>Or configure your build process to run: <code>npm run build</code></p>
    `);
  });
}

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true, useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB connected');
  app.listen(process.env.PORT || 5050, () => {
    console.log(`🚀 Server running on port ${process.env.PORT || 5050}`);
  });
}).catch(err => console.error('❌ MongoDB error:', err));
