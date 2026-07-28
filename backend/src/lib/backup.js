const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups');

async function performBackup(db) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `pos-backup-${dateStr}.db`);

  try {
    await db.backup(dest);

    const verifyDb = new Database(dest, { readonly: true });
    const result = verifyDb.pragma('integrity_check', { simple: true });
    verifyDb.close();

    if (result !== 'ok') {
      try { fs.unlinkSync(dest); } catch {}
      throw new Error('Backup integrity check failed');
    }

    cleanupOldBackups();
    return dest;
  } catch (err) {
    try { fs.unlinkSync(dest); } catch {}
    throw err;
  }
}

function cleanupOldBackups() {
  const retentionDays = parseInt(process.env.BACKUP_RETENTION || '30', 10);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  if (!fs.existsSync(BACKUP_DIR)) return;

  const files = fs.readdirSync(BACKUP_DIR);
  for (const file of files) {
    const filePath = path.join(BACKUP_DIR, file);
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs < cutoff) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
}

module.exports = { performBackup, BACKUP_DIR };