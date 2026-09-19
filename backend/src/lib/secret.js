const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SECRET_PATHS = [
  '/run/secrets/jwt_secret',
  path.join(__dirname, '..', '..', 'data', '.jwt-secret'),
];

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  for (const path of SECRET_PATHS) {
    if (fs.existsSync(path)) {
      return fs.readFileSync(path, 'utf8').trim();
    }
  }

  const secret = crypto.randomBytes(48).toString('hex');
  // Prefer Docker secrets path, fallback to data directory
  const targetPath = fs.existsSync('/run/secrets') ? '/run/secrets/jwt_secret' : SECRET_PATHS[1];
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, secret, { mode: 0o600 });
  return secret;
}

module.exports = { getJwtSecret };
