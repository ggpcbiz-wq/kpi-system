const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { googleLogin } = require('./controllers/auth.controller');
const { requireAuth } = require('./middleware/auth.middleware');

// 1. IMPORT YOUR NEW USER ROUTES
const userRoutes = require('./routes/user.routes'); 
const targetRoutes = require('./routes/target.routes');
const submissionRoutes = require('./routes/submission.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const kintoneRoutes = require('./routes/kintone.routes');
const departmentRoutes = require('./routes/department.routes');
const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Public Auth Route
app.post('/api/auth/google', googleLogin);

// 2. MOUNT THE USER ROUTES HERE
app.use('/api/users', userRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/kintone', kintoneRoutes);
app.use('/api/departments', departmentRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});