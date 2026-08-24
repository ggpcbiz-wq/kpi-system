const express = require('express');
const cors = require('cors');

const departmentRoutes = require('./routes/department.routes');
const kintoneRoutes = require('./routes/kintone.routes');

const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// API Mount points
app.use('/api/departments', departmentRoutes);
app.use('/api/kintone', kintoneRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

module.exports = app;