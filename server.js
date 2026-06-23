const config = require('./config/env');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const connectDB = require('./config/db');
const setupSwagger = require('./config/swagger');
const { globalLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security headers first
app.use(helmet());
app.use(cors());

// Request logging
app.use(morgan(config.isProduction ? 'combined' : 'dev'));

// Global rate limit before any parsing
app.use(globalLimiter);

// Body parsing
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'success', data: { uptime: process.uptime() } });
});

setupSwagger(app);

app.use('/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);

// 404 + central error handler — must be last
app.use(notFound);
app.use(errorHandler);

async function start() {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`[SERVER] Running on http://localhost:${config.port} (${config.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error('[FATAL] Failed to start server:', err.message);
  process.exit(1);
});
