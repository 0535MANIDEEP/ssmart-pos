const express = require('express');

const router = express.Router();

router.post('/run', async (req, res) => {
  try {
    const { performBackup } = require('../lib/backup');
    const { rawDb } = require('../lib/prisma');
    const dest = await performBackup(rawDb);
    res.json({ ok: true, path: dest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { BACKUP_DIR } = require('../lib/backup');

    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json({ lastBackup: null, nextScheduled: null, count: 0, backups: [] });
    }

    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db'));
    files.sort().reverse();

    const backups = files.map((file) => {
      const filePath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(filePath);
      return {
        filename: file,
        size: stat.size,
        modified: stat.mtime,
      };
    });

    const lastBackup = backups.length > 0 ? backups[0] : null;

    const schedule = req.app.get('backupSchedule') || '0 2 * * *';
    const now = new Date();
    const parts = schedule.split(' ');
    const [min, hour] = parts.slice(0, 2).map(Number);
    const nextRun = new Date(now);
    nextRun.setHours(hour, min, 0, 0);
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    res.json({
      lastBackup,
      nextScheduled: nextRun,
      count: backups.length,
      backups,
      schedule,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/list', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { BACKUP_DIR } = require('../lib/backup');

    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json([]);
    }

    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db'));
    files.sort().reverse();
    const backups = files.map((file) => {
      const filePath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(filePath);
      return {
        filename: file,
        size: stat.size,
        modified: stat.mtime,
      };
    });

    res.json(backups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;