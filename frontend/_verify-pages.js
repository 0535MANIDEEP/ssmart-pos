// Verify all frontend pages load with HTTP 200
const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: 1994, path, method: 'GET' }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, length: d.length }));
    });
    req.on('error', reject);
    req.end();
  });
}

const PAGES = [
  '/',
  '/dashboard',
  '/inventory',
  '/customers',
  '/sales',
  '/settings',
  '/accounting',
  '/accounting/chart-of-accounts',
  '/accounting/journal',
  '/accounting/trial-balance',
  '/accounting/profit-loss',
  '/accounting/balance-sheet',
  '/accounting/cash-flow',
  '/accounting/receivables',
  '/accounting/payables',
  '/accounting/expenses',
  '/accounting/payments',
  '/accounting/bank-reconciliation',
  '/accounting/cost-centers',
  '/accounting/financial-years',
];

(async () => {
  let passed = 0, failed = 0;
  for (const page of PAGES) {
    try {
      const r = await get(page);
      if (r.status === 200) {
        console.log(`  ✓ ${page} — ${r.status} (${r.length} bytes)`);
        passed++;
      } else {
        console.log(`  ✗ ${page} — ${r.status}`);
        failed++;
      }
    } catch (err) {
      console.log(`  ✗ ${page} — ${err.message}`);
      failed++;
    }
  }
  console.log(`\n${passed + failed} pages: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
