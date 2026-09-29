const path = require('path');
const express = require('express');
const cors = require('cors');
const db = require('./db/connection');

const { router: authRouter } = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const transactionsRouter = require('./routes/transactions');
const studentsRouter = require('./routes/students');
const teachersRouter = require('./routes/teachers');
const cohortsRouter = require('./routes/cohorts');
const ownerRouter = require('./routes/owner');
const reportsRouter = require('./routes/reports');
const settingsRouter = require('./routes/settings');
const backupRouter = require('./routes/backup');
const auditRouter = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health / Status Check
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    app: 'NG Financial System',
    version: '1.0.0',
    engine: db.getCurrentEngine(),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/students', studentsRouter);
app.use('/api/teachers', teachersRouter);
app.use('/api/cohorts', cohortsRouter);
app.use('/api/owner', ownerRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/backup', backupRouter);
app.use('/api/audit', auditRouter);

// Serve static frontend files if built
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// Catch-all route for SPA client routing
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('NG Financial System Backend Running. Please build the client UI.');
  }
});

// Start Database and Server
async function startServer() {
  try {
    const engine = await db.initDb();
    console.log(`[Database] Initialized with engine: ${engine}`);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(`🚀 NG Financial System is running!`);
      console.log(`📍 Local Server: http://0.0.0.0:${PORT}`);
      console.log(`💎 Mode: Local / Desktop Offline First`);
      console.log(`💾 Database Engine: ${engine.toUpperCase()}`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Failed to initialize server:', err);
    process.exit(1);
  }
}

startServer();
