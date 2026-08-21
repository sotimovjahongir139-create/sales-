const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { startScheduler } = require('./jobs/scheduler');

const dashboardRoutes = require('./routes/dashboard.routes');
const callsRoutes = require('./routes/calls.routes');
const syncRoutes = require('./routes/sync.routes');
const healthRoutes = require('./routes/health.routes');
const settingsRoutes = require('./routes/settings.routes');
const salespersonRoutes = require('./routes/salesperson.routes');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.frontendUrl }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/salesperson', salespersonRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`AI Sales Call Analyzer backend ${env.port}-portda ishga tushdi.`);
  startScheduler();
});
