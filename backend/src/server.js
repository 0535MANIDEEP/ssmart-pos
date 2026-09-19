const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:1994';

// Warn if HTTPS origin but cookie not secure
if (FRONTEND_ORIGIN.startsWith('https://') && !COOKIE_SECURE) {
  console.warn('[WARN] FRONTEND_ORIGIN uses HTTPS but COOKIE_SECURE is not true. Session cookies will not be sent over HTTPS. Set COOKIE_SECURE=true in production.');
}

const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const productRoutes = require('./routes/products');
const customerRoutes = require('./routes/customers');
const invoiceRoutes = require('./routes/invoices');
const returnRoutes = require('./routes/returns');
const printRoutes = require('./routes/print');
const mastersRoutes = require('./routes/masters');
const billsRoutes = require('./routes/bills');
const backupRoutes = require('./routes/backup');
const accountingRoutes = require('./routes/accounting');
const migrateRoutes = require('./routes/migrate');
const supplierRoutes = require('./routes/suppliers');
const salesmanRoutes = require('./routes/salesmen');
const packingRoutes = require('./routes/packing');
const syncRoutes = require('./routes/sync');

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:1994';

// Behind the Next.js proxy we see its address; trust one hop so rate-limit
// and IP logging use the real client where a forwarded header is present.
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false })); // CSP is served by the Next.js frontend
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// Session cookie settings
app.use((req, res, next) => {
  const isSecure = COOKIE_SECURE || process.env.NODE_ENV === 'production';
  res.cookie = (name, value, options = {}) => {
    res.cookie(name, value, {
      ...options,
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
    });
    return res;
  };
  next();
});

// Defense-in-depth: cap overall request volume per IP.
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/print', printRoutes);
app.use('/api/masters', mastersRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/migrate', migrateRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/salesmen', salesmanRoutes);
app.use('/api/packing', packingRoutes);
app.use('/api/sync', syncRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Prevent server crash from stray async errors outside Express
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`SS Mart POS backend listening on port ${PORT}`);

  const { performBackup } = require('./lib/backup');
  const { rawDb } = require('./lib/prisma');

  const schedule = process.env.BACKUP_SCHEDULE || '0 0 2 * * *';
  cron.schedule(schedule, async () => {
    try {
      const dest = await performBackup(rawDb);
      console.log(`[backup] Daily backup saved to ${dest}`);
    } catch (err) {
      console.error('[backup] Daily backup failed:', err.message);
    }
  }, {
    name: 'daily-backup',
    timezone: 'Asia/Kolkata',
    noOverlap: true,
    missedExecutionTolerance: 2 * 60 * 60 * 1000,
  });

  const ist = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const today = new Date(ist).toLocaleDateString('en-IN');
  const lastBackupFile = path.join(__dirname, '..', '.last-backup');
  let lastBackupDate = '';
  try { lastBackupDate = fs.readFileSync(lastBackupFile, 'utf8').trim(); } catch {}
  if (lastBackupDate !== today) {
    console.log('[backup] Running missed daily backup on startup...');
    performBackup(rawDb).then((dest) => {
      console.log(`[backup] Startup backup saved to ${dest}`);
      fs.writeFileSync(lastBackupFile, today);
    }).catch((err) => {
      console.error('[backup] Startup backup failed:', err.message);
    });
  }
});
